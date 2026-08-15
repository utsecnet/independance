import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { GraphEdge, GraphNode, NodeMetadata, NodeStatus, NodeType, RelationshipType } from "@independance/shared";
import { graphApi } from "../api/graph";
import { nodesApi, type CreateNodePayload, type UpdateNodePayload } from "../api/nodes";
import { edgesApi } from "../api/edges";
import { ApiError } from "../api/client";

export interface RFNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  status: NodeStatus;
  nodeType: NodeType;
  metadata: NodeMetadata;
}

export interface RFEdgeData extends Record<string, unknown> {
  relationshipType: RelationshipType;
  label?: string;
}

export type GraphRFNode = Node<RFNodeData>;
export type GraphRFEdge = Edge<RFEdgeData>;

const POSITION_SAVE_DEBOUNCE_MS = 400;
const positionSaveTimers = new Map<string, ReturnType<typeof setTimeout>>();

const DEFAULT_NODE_WIDTH = 180;
const DEFAULT_NODE_HEIGHT = 90;

export interface DropHover {
  targetId: string;
  half: "top" | "bottom";
}

interface DragLinkSession {
  startPosition: { x: number; y: number };
  hoverKey: string | null;
}

// Keyed by dragged node id. Ephemeral per-gesture interaction state — not
// part of the reactive store because nothing needs to re-render off of it
// directly (only `dropHover` below does).
const dragLinkSessions = new Map<string, DragLinkSession>();

function nodeRect(node: GraphRFNode) {
  return {
    x: node.position.x,
    y: node.position.y,
    width: node.measured?.width ?? DEFAULT_NODE_WIDTH,
    height: node.measured?.height ?? DEFAULT_NODE_HEIGHT,
  };
}

/**
 * Finds which node (if any) the dragged node currently overlaps most, and
 * whether the dragged node's center sits over that target's top or bottom
 * half — hovering the top half means "dragged blocks target", hovering the
 * bottom half means "dragged is blocked by (depends on) target".
 */
export function findDropTarget(
  draggedId: string,
  draggedPosition: { x: number; y: number },
  allNodes: GraphRFNode[]
): { id: string; half: "top" | "bottom" } | null {
  const draggedNode = allNodes.find((n) => n.id === draggedId);
  const width = draggedNode?.measured?.width ?? DEFAULT_NODE_WIDTH;
  const height = draggedNode?.measured?.height ?? DEFAULT_NODE_HEIGHT;
  const draggedRect = { x: draggedPosition.x, y: draggedPosition.y, width, height };
  const draggedCenterY = draggedPosition.y + height / 2;

  let best: { id: string; half: "top" | "bottom" } | null = null;
  let bestArea = 0;

  for (const node of allNodes) {
    if (node.id === draggedId) continue;
    const rect = nodeRect(node);
    const overlapX =
      Math.min(draggedRect.x + draggedRect.width, rect.x + rect.width) - Math.max(draggedRect.x, rect.x);
    const overlapY =
      Math.min(draggedRect.y + draggedRect.height, rect.y + rect.height) - Math.max(draggedRect.y, rect.y);
    if (overlapX <= 0 || overlapY <= 0) continue;

    const area = overlapX * overlapY;
    if (area > bestArea) {
      bestArea = area;
      const midY = rect.y + rect.height / 2;
      best = { id: node.id, half: draggedCenterY < midY ? "top" : "bottom" };
    }
  }

  return best;
}

function schedulePositionSave(id: string, position: { x: number; y: number }, onError: (message: string) => void) {
  const existing = positionSaveTimers.get(id);
  if (existing) clearTimeout(existing);

  positionSaveTimers.set(
    id,
    setTimeout(() => {
      positionSaveTimers.delete(id);
      nodesApi.updatePosition(id, position).catch((err: unknown) => {
        onError(err instanceof Error ? err.message : "Failed to save node position");
      });
    }, POSITION_SAVE_DEBOUNCE_MS)
  );
}

function toRFNode(node: GraphNode): GraphRFNode {
  return {
    id: node.id,
    type: node.type,
    position: node.position,
    data: {
      title: node.title,
      description: node.description,
      status: node.status,
      nodeType: node.type,
      metadata: node.metadata,
    },
  };
}

function toRFEdge(edge: GraphEdge): GraphRFEdge {
  return {
    id: edge.id,
    source: edge.sourceId,
    target: edge.targetId,
    data: { relationshipType: edge.relationshipType, label: edge.label },
  };
}

interface GraphState {
  nodes: GraphRFNode[];
  edges: GraphRFEdge[];
  selectedId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  dropHover: DropHover | null;

  loadGraph: () => Promise<void>;
  onNodesChange: (changes: NodeChange<GraphRFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphRFEdge>[]) => void;
  onConnect: (connection: Connection) => Promise<void>;
  onNodesDelete: (nodes: GraphRFNode[]) => Promise<void>;
  onEdgesDelete: (edges: GraphRFEdge[]) => Promise<void>;
  onNodeDragStart: (id: string, position: { x: number; y: number }) => void;
  onNodeDrag: (id: string, position: { x: number; y: number }) => void;
  onNodeDragStop: (id: string, position: { x: number; y: number }) => void;
  selectNode: (id: string | null) => void;
  clearError: () => void;

  createNode: (input: {
    type: NodeType;
    title: string;
    description?: string;
    status?: NodeStatus;
    metadata?: NodeMetadata;
    position?: { x: number; y: number };
  }) => Promise<GraphRFNode>;
  updateNode: (id: string, patch: UpdateNodePayload) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  createEdge: (sourceId: string, targetId: string, relationshipType?: RelationshipType) => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: [],
  edges: [],
  selectedId: null,
  status: "idle",
  error: null,
  dropHover: null,

  loadGraph: async () => {
    set({ status: "loading", error: null });
    try {
      const graph = await graphApi.get();
      set({
        nodes: graph.nodes.map(toRFNode),
        edges: graph.edges.map(toRFEdge),
        status: "ready",
      });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Failed to load graph" });
    }
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: async (connection) => {
    if (!connection.source || !connection.target) return;
    await get().createEdge(connection.source, connection.target);
  },

  onNodesDelete: async (nodesToDelete) => {
    for (const node of nodesToDelete) {
      try {
        await nodesApi.remove(node.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          set({ error: err instanceof Error ? err.message : "Failed to delete node" });
        }
      }
    }
    if (nodesToDelete.some((n) => n.id === get().selectedId)) {
      set({ selectedId: null });
    }
  },

  onEdgesDelete: async (edgesToDelete) => {
    for (const edge of edgesToDelete) {
      try {
        await edgesApi.remove(edge.id);
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          set({ error: err instanceof Error ? err.message : "Failed to delete edge" });
        }
      }
    }
  },

  onNodeDragStart: (id, position) => {
    dragLinkSessions.set(id, { startPosition: position, hoverKey: null });
  },

  onNodeDrag: (id, position) => {
    const session = dragLinkSessions.get(id);
    if (!session) return;

    const target = findDropTarget(id, position, get().nodes);
    const key = target ? `${target.id}:${target.half}` : null;
    if (key === session.hoverKey) return;

    session.hoverKey = key;
    set({ dropHover: target ? { targetId: target.id, half: target.half } : null });
  },

  onNodeDragStop: (id, position) => {
    const session = dragLinkSessions.get(id);
    dragLinkSessions.delete(id);
    set({ dropHover: null });

    const target = findDropTarget(id, position, get().nodes);
    if (target && session) {
      const relationshipType: RelationshipType = target.half === "top" ? "blocks" : "depends_on";
      get().createEdge(id, target.id, relationshipType);
      const finalPosition = session.startPosition;
      set({ nodes: get().nodes.map((n) => (n.id === id ? { ...n, position: finalPosition } : n)) });
      schedulePositionSave(id, finalPosition, (message) => set({ error: message }));
      return;
    }

    schedulePositionSave(id, position, (message) => set({ error: message }));
  },

  selectNode: (id) => set({ selectedId: id }),
  clearError: () => set({ error: null }),

  createNode: async (input) => {
    const payload: CreateNodePayload = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      status: input.status ?? "not_started",
      metadata: input.metadata ?? {},
      position: input.position ?? { x: Math.random() * 400 - 200, y: Math.random() * 300 },
    };
    const created = await nodesApi.create(payload);
    const rfNode = toRFNode(created);
    set({ nodes: [...get().nodes, rfNode], selectedId: rfNode.id });
    return rfNode;
  },

  updateNode: async (id, patch) => {
    const updated = await nodesApi.update(id, patch);
    set({ nodes: get().nodes.map((n) => (n.id === id ? toRFNode(updated) : n)) });
  },

  deleteNode: async (id) => {
    await nodesApi.remove(id);
    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: get().edges.filter((e) => e.source !== id && e.target !== id),
      selectedId: get().selectedId === id ? null : get().selectedId,
    });
  },

  createEdge: async (sourceId, targetId, relationshipType = "depends_on") => {
    try {
      const created = await edgesApi.create({ id: crypto.randomUUID(), sourceId, targetId, relationshipType });
      set({ edges: [...get().edges, toRFEdge(created)] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create edge" });
    }
  },
}));
