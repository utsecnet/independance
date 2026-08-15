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
import type {
  GraphEdge,
  GraphNode,
  LinkOrientation,
  NodeMetadata,
  NodeStatus,
  NodeType,
  RelationshipType,
} from "@independance/shared";
import { graphApi } from "../api/graph";
import { nodesApi, type CreateNodePayload, type UpdateNodePayload } from "../api/nodes";
import { edgesApi } from "../api/edges";
import { ApiError } from "../api/client";
import { useConfigStore } from "./configStore";

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

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 90;

export type DropHalf = "top" | "bottom" | "left" | "right";

export interface DropHover {
  targetId: string;
  half: DropHalf;
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
 * whether the dragged node's center sits over that target's near or far
 * half along the active link axis. In vertical mode (default) that's
 * top/bottom — hovering the bottom half means "dragged blocks target",
 * hovering the top half means "dragged is blocked by (depends on) target".
 * In horizontal mode it's left/right — hovering the left half means
 * "dragged blocks target" (dragged tile ends up to target's left, matching
 * the "A left of B, A blocks B" convention), hovering the right half means
 * "dragged is blocked by (depends on) target".
 */
export function findDropTarget(
  draggedId: string,
  draggedPosition: { x: number; y: number },
  allNodes: GraphRFNode[],
  orientation: LinkOrientation
): { id: string; half: DropHalf } | null {
  const draggedNode = allNodes.find((n) => n.id === draggedId);
  const width = draggedNode?.measured?.width ?? DEFAULT_NODE_WIDTH;
  const height = draggedNode?.measured?.height ?? DEFAULT_NODE_HEIGHT;
  const draggedRect = { x: draggedPosition.x, y: draggedPosition.y, width, height };
  const draggedCenterX = draggedPosition.x + width / 2;
  const draggedCenterY = draggedPosition.y + height / 2;

  let best: { id: string; half: DropHalf } | null = null;
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
      if (orientation === "horizontal") {
        const midX = rect.x + rect.width / 2;
        best = { id: node.id, half: draggedCenterX < midX ? "left" : "right" };
      } else {
        const midY = rect.y + rect.height / 2;
        best = { id: node.id, half: draggedCenterY < midY ? "top" : "bottom" };
      }
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
    type: "graphNode",
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

/**
 * Each node renders four handles at the two ends of the active link axis
 * (top/bottom in vertical mode, left/right in horizontal mode) — a source
 * AND a target handle stacked at each end — so an edge can visually run
 * either direction depending on what it means. Both orientations connect
 * the two nodes' *facing* sides — the side of each tile that's actually
 * nearest the other tile — not a fixed side regardless of layout: for
 * "blocks" the blocker sits on the near side of whichever edge faces the
 * blocked tile (bottom when the blocker ends up above it, top when below;
 * right when to its left, left when to its right), and the blocked tile's
 * handle is the corresponding facing side back. Every other relationship
 * (depends_on included) keeps the reverse flow.
 *
 * Deliberately NOT baked into the edge objects stored in this Zustand
 * store: an edge's correct sourceHandle/targetHandle depends on the
 * *current* linkOrientation setting, which lives in a separate store and
 * can change at any time. Computing them once at fetch time and storing
 * the result went stale the moment orientation changed afterward — nodes
 * would re-render with the new orientation's handles while already-loaded
 * edges kept pointing at the old orientation's (now nonexistent) handle
 * ids, and React Flow would silently stop drawing them. Exported so
 * GraphCanvas can derive each edge's handles fresh on every render via
 * useMemo instead, which is correct by construction — there's no stale
 * copy that a change to orientation needs to remember to go update.
 */
export function handlesForRelationship(
  relationshipType: RelationshipType,
  orientation: LinkOrientation
): { sourceHandle: string; targetHandle: string } {
  if (orientation === "horizontal") {
    if (relationshipType === "blocks") {
      return { sourceHandle: "right-source", targetHandle: "left-target" };
    }
    return { sourceHandle: "left-source", targetHandle: "right-target" };
  }
  if (relationshipType === "blocks") {
    return { sourceHandle: "top-source", targetHandle: "bottom-target" };
  }
  return { sourceHandle: "bottom-source", targetHandle: "top-target" };
}

/**
 * Inverse of handlesForRelationship: React Flow's own connect-drag gesture
 * (dragging directly from one handle circle to another) reports which
 * specific handles were used, but until this was fixed `onConnect` ignored
 * that and always created a "depends_on" edge — meaning "blocks" could
 * never be hand-drawn, and hand-drawing a new line between two already-
 * linked tiles in an attempt to reverse the relationship would either
 * recreate the exact same edge (a confusing "already linked" 409) or leave
 * the relationship unchanged instead of actually swapping blocker/blocked.
 * Reading the handle pair back out lets a hand-drawn connection express
 * "blocks" the same way the drag-a-whole-tile-over-another gesture does.
 */
function relationshipTypeForHandles(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined
): RelationshipType {
  if (sourceHandle === "top-source" && targetHandle === "bottom-target") return "blocks";
  if (sourceHandle === "right-source" && targetHandle === "left-target") return "blocks";
  return "depends_on";
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
    const relationshipType = relationshipTypeForHandles(connection.sourceHandle, connection.targetHandle);
    await get().createEdge(connection.source, connection.target, relationshipType);
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

    const orientation = useConfigStore.getState().linkOrientation;
    const target = findDropTarget(id, position, get().nodes, orientation);
    const key = target ? `${target.id}:${target.half}` : null;
    if (key === session.hoverKey) return;

    session.hoverKey = key;
    set({ dropHover: target ? { targetId: target.id, half: target.half } : null });
  },

  onNodeDragStop: (id, position) => {
    const session = dragLinkSessions.get(id);
    dragLinkSessions.delete(id);
    set({ dropHover: null });

    const orientation = useConfigStore.getState().linkOrientation;
    const target = findDropTarget(id, position, get().nodes, orientation);
    if (target && session) {
      const relationshipType: RelationshipType =
        target.half === "bottom" || target.half === "left" ? "blocks" : "depends_on";
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
      status: input.status,
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
      await edgesApi.create({ id: crypto.randomUUID(), sourceId, targetId, relationshipType });
      // Re-fetch rather than append: creating a blocks/depends_on edge may
      // have silently removed a conflicting opposite-direction edge
      // server-side (no circular two-node dependencies), so the local list
      // can't just be appended to — it needs to match the server exactly.
      const edges = await edgesApi.list();
      set({ edges: edges.map(toRFEdge) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create edge" });
    }
  },
}));
