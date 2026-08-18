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

/**
 * The only colors Settings > Types & Statuses offers for a node type's tile
 * color — a fixed retro-synthwave palette instead of an open color picker,
 * so every type's color (and the tile-tint it drives — see GraphNodeCard)
 * stays visually cohesive with the app's theme, and so a future feature
 * that needs to reason about "which color" a type is has a closed, known
 * set to work with instead of arbitrary hex values. Not enforced by
 * createNodeTypeSchema/updateNodeTypeSchema (those still accept any hex
 * color) — this is a UI curation, not a data constraint, so a type colored
 * before this existed keeps rendering fine.
 */
export const RETRO_COLOR_PALETTE = [
  "#ff2e63",
  "#b5179e",
  "#7b2ff7",
  "#4361ee",
  "#4cc9f0",
  "#06ffa5",
  "#ffd60a",
  "#fb5607",
] as const;

// Metadata's actual shape is driven entirely by TILE_FIELD_DEFS/MetadataFields
// (client-side) rather than a per-type interface here — createNodeSchema and
// updateNodeSchema (schemas.ts) validate it with the same generic record.
export type NodeMetadata = Record<string, unknown>;

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
 * Title always shows on every tile — it's the one field not part of the
 * configurable field list at all, just unconditionally rendered. Type and
 * Status are otherwise-ordinary entries in TILE_FIELD_DEFS below (selectable
 * like everything else), not listed here.
 */
export const ALWAYS_ON_TILE_FIELDS = ["title"] as const;

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
 * the always-on Title — driving the Settings > Appearance field picker.
 * Type and Status apply the same way to every node type (unlike the rest,
 * each of which comes from one specific type's metadata shape — see
 * TaskMetadata/ProjectMetadata/PoamMetadata above — and simply has no value
 * to show on a node of a different type), so they're listed under all three
 * groups rather than just one.
 */
export const TILE_FIELD_DEFS = [
  { id: "type", label: "Type", groups: ["task", "project", "poam"] },
  { id: "status", label: "Status", groups: ["task", "project", "poam"] },
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

/** Max *additional* fields on top of the always-on Title. */
export const MAX_EXTRA_TILE_FIELDS = 3;

// Type and Status were unconditionally on before they became selectable —
// falling back to this for any node type with no explicit selection yet
// keeps a first-run tile looking the same as it always did, rather than
// silently losing its type/status labels until someone opens Appearance and
// re-adds them. Used both as the literal default for a type with no entry
// in tileFields at all, and as the starting point when a type is first
// expanded in Settings > Appearance.
export const DEFAULT_TILE_FIELDS: TileFieldId[] = ["type", "status"];

export type ThemeMode = "dark" | "light";

export type PlacementMode = "auto" | "manual";

/**
 * Selected fields are per node type — each type id (built-in or
 * user-created) maps to its own list, so toggling a field for one type
 * (e.g. hiding Status on POA&M) never touches any other type's tiles. A
 * type with no entry here yet falls back to DEFAULT_TILE_FIELDS rather than
 * showing nothing.
 *
 * theme and placementMode are optional — absent until the user has
 * explicitly chosen one, same convention as tileFields' per-type entries:
 * the client falls back to its own default (OS preference for theme, "auto"
 * for placement) rather than the server inventing one.
 */
export interface AppSettings {
  tileFields: Record<string, TileFieldId[]>;
  theme?: ThemeMode;
  placementMode?: PlacementMode;
}
