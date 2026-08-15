import { create } from "zustand";
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type { NodeMetadata, NodeStatus, NodeType, RelationshipType } from "@independance/shared";

export interface RFNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  status: NodeStatus;
  nodeType: NodeType;
  metadata: NodeMetadata;
}

export interface RFEdgeData extends Record<string, unknown> {
  relationshipType: RelationshipType;
}

export type GraphRFNode = Node<RFNodeData>;
export type GraphRFEdge = Edge<RFEdgeData>;

function sampleNodes(): GraphRFNode[] {
  return [
    {
      id: "n-project-1",
      type: "project",
      position: { x: 0, y: 0 },
      data: { title: "Modernize Auth", status: "in_progress", nodeType: "project", metadata: {} },
    },
    {
      id: "n-task-1",
      type: "task",
      position: { x: -220, y: 180 },
      data: { title: "Design token schema", status: "complete", nodeType: "task", metadata: {} },
    },
    {
      id: "n-task-2",
      type: "task",
      position: { x: 220, y: 180 },
      data: { title: "Migrate session store", status: "in_progress", nodeType: "task", metadata: {} },
    },
    {
      id: "n-poam-1",
      type: "poam",
      position: { x: 0, y: 360 },
      data: {
        title: "Remediate weak cipher usage",
        status: "not_started",
        nodeType: "poam",
        metadata: { severity: "high" },
      },
    },
  ];
}

function sampleEdges(): GraphRFEdge[] {
  return [
    {
      id: "e-1",
      source: "n-project-1",
      target: "n-task-1",
      data: { relationshipType: "relates_to" },
    },
    {
      id: "e-2",
      source: "n-project-1",
      target: "n-task-2",
      data: { relationshipType: "relates_to" },
    },
    {
      id: "e-3",
      source: "n-task-2",
      target: "n-poam-1",
      data: { relationshipType: "remediates" },
    },
  ];
}

interface GraphState {
  nodes: GraphRFNode[];
  edges: GraphRFEdge[];
  selectedId: string | null;
  onNodesChange: (changes: NodeChange<GraphRFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphRFEdge>[]) => void;
  onConnect: (connection: Connection) => void;
  selectNode: (id: string | null) => void;
}

export const useGraphStore = create<GraphState>((set, get) => ({
  nodes: sampleNodes(),
  edges: sampleEdges(),
  selectedId: null,
  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },
  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },
  onConnect: (connection) => {
    set({
      edges: addEdge({ ...connection, data: { relationshipType: "depends_on" } }, get().edges),
    });
  },
  selectNode: (id) => set({ selectedId: id }),
}));
