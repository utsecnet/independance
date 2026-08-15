export type NodeType = "task" | "project" | "poam";

export type TaskProjectStatus = "not_started" | "in_progress" | "blocked" | "complete";

export type PoamStatus = "drafting" | "assessment" | "planning" | "isso_review" | "issm_review" | "complete";

export type NodeStatus = TaskProjectStatus | PoamStatus;

export type RelationshipType = "depends_on" | "blocks" | "relates_to" | "remediates";

export interface TaskMetadata {
  assignee?: string;
  estimateHours?: number;
  dueDate?: string;
}

export interface ProjectMetadata {
  owner?: string;
  targetDate?: string;
  tags?: string[];
}

export interface PoamMilestone {
  id: string;
  title: string;
  targetDate: string;
  status: NodeStatus;
  completedDate?: string;
}

export interface PoamMetadata {
  dueDate?: string;
  severity?: "low" | "moderate" | "high";
  controlRefs?: string[];
  poc?: string;
  milestones?: PoamMilestone[];
}

export type NodeMetadata = TaskMetadata | ProjectMetadata | PoamMetadata;

export interface GraphNode {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status: NodeStatus;
  metadata: NodeMetadata;
  position: { x: number; y: number };
  createdAt: string;
  updatedAt: string;
}

export interface GraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  label?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GraphPayload {
  nodes: GraphNode[];
  edges: GraphEdge[];
}
