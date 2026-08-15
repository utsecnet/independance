export type NodeType = string;

export type NodeStatus = string;

export type RelationshipType = "depends_on" | "blocks" | "relates_to" | "remediates";

export interface NodeTypeConfig {
  id: string;
  label: string;
  color: string;
  sortOrder: number;
}

export interface NodeStatusConfig {
  id: string;
  typeId: string;
  value: string;
  label: string;
  sortOrder: number;
  isDefault: boolean;
}

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
  severity?: "very_high" | "high" | "moderate" | "low" | "very_low";
  controlRefs?: string[];
  poc?: string;
  milestones?: PoamMilestone[];
}

export type NodeMetadata = TaskMetadata | ProjectMetadata | PoamMetadata | Record<string, unknown>;

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

/**
 * Type, Title, and Status always show on every tile — they aren't part of
 * the configurable field list at all, just unconditionally rendered.
 */
export const ALWAYS_ON_TILE_FIELDS = ["type", "title", "status"] as const;

/**
 * A field's group says which node type(s) it's relevant to, so the
 * Appearance settings field picker can present it under that type's own
 * heading instead of one long undifferentiated list — useful since e.g.
 * POA&Ms and Tasks have almost entirely different metadata fields. A field
 * can belong to more than one group (Due Date is meaningful for both Task
 * and POA&M), in which case it's shown once under each relevant heading.
 */
export type TileFieldGroup = "task" | "project" | "poam";

/**
 * Registry of *optional* fields a tile can additionally display, on top of
 * the always-on Type/Title/Status — driving the Settings > Appearance
 * field picker. Each comes from a specific type's metadata shape (see
 * TaskMetadata/ProjectMetadata/PoamMetadata above) and simply has no value
 * to show on a node of a different type.
 */
export const TILE_FIELD_DEFS = [
  { id: "assignee", label: "Assignee", groups: ["task"] },
  { id: "estimateHours", label: "Estimate (hours)", groups: ["task"] },
  { id: "dueDate", label: "Due Date", groups: ["task", "poam"] },
  { id: "owner", label: "Owner", groups: ["project"] },
  { id: "targetDate", label: "Target Date", groups: ["project"] },
  { id: "tags", label: "Tags", groups: ["project"] },
  { id: "severity", label: "Severity", groups: ["poam"] },
  { id: "poc", label: "POC", groups: ["poam"] },
  { id: "controlRefs", label: "Control Refs", groups: ["poam"] },
] as const satisfies readonly { id: string; label: string; groups: readonly TileFieldGroup[] }[];

export type TileFieldId = (typeof TILE_FIELD_DEFS)[number]["id"];

export const TILE_FIELD_IDS = TILE_FIELD_DEFS.map((f) => f.id) as TileFieldId[];

/** Max *additional* fields on top of the always-on Type/Title/Status. */
export const MAX_EXTRA_TILE_FIELDS = 3;

export const DEFAULT_TILE_FIELDS: TileFieldId[] = [];

export type LinkOrientation = "vertical" | "horizontal";

export const DEFAULT_LINK_ORIENTATION: LinkOrientation = "vertical";

export interface AppSettings {
  tileFields: TileFieldId[];
  linkOrientation: LinkOrientation;
}
