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

  loadGraph: () => Promise<void>;
  onNodesChange: (changes: NodeChange<GraphRFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphRFEdge>[]) => void;
  onConnect: (connection: Connection) => Promise<void>;
  onNodesDelete: (nodes: GraphRFNode[]) => Promise<void>;
  onEdgesDelete: (edges: GraphRFEdge[]) => Promise<void>;
  selectNode: (id: string | null) => void;

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

  selectNode: (id) => set({ selectedId: id }),

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
