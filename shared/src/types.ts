export type NodeType = string;

export type NodeStatus = string;

export type RelationshipType = "depends_on" | "blocks" | "relates_to" | "remediates";

/**
 * A named, independent graph within one install — its own nodes, edges,
 * node types/statuses, and tileFields/placementMode settings. `theme` is
 * the one exception: a pure cross-board UI preference, not board data, so
 * it lives outside any board entirely.
 */
export interface BoardConfig {
  id: string;
  name: string;
  sortOrder: number;
}

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
 * can belong to more than one group, in which case it's shown once under
 * each relevant heading.
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
  { id: "dueDate", label: "Due Date", groups: ["task"] },
  { id: "owner", label: "Owner", groups: ["project"] },
  { id: "targetDate", label: "Target Date", groups: ["project"] },
  { id: "tags", label: "Tags", groups: ["project"] },
  // The NIST 800-53 control this POA&M is about (e.g. "AC-2(4)"). Shown
  // first whenever a POA&M is listed as a row rather than a full tile (see
  // ItemsBlade/PoamsTab), ahead of even the title, since it's the detail
  // someone scanning a list of POA&Ms usually wants first.
  { id: "control", label: "Control", groups: ["poam"] },
  { id: "severity", label: "Inherent Risk", groups: ["poam"] },
  { id: "residualRisk", label: "Residual Risk", groups: ["poam"] },
  { id: "poc", label: "POC", groups: ["poam"] },
  { id: "nextMilestoneDate", label: "Next Milestone Date", groups: ["poam"] },
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

// POA&M severity is a fixed 5-level scale (unlike node types/statuses, which
// are user-configurable) — single source of truth shared by the metadata
// form, the tile's severity badge, the map's severity filter, and the
// server-side CSV import validator (see poamImportService), which is why
// this lives in shared rather than client-only.
export const SEVERITY_LEVELS = [
  { value: "very_high", label: "Very High" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
  { value: "very_low", label: "Very Low" },
] as const;

export const SEVERITY_LABELS: Record<string, string> = Object.fromEntries(
  SEVERITY_LEVELS.map((s) => [s.value, s.label])
);

/** Cap on rows accepted by a single POA&M CSV import request. */
export const MAX_BULK_IMPORT_ROWS = 1000;

/**
 * Ordered CSV header <-> internal field mapping for POA&M import. Headers
 * deliberately match the labels already shown on a POA&M tile/form (Control,
 * Inherent Risk, Residual Risk, POC, Next Milestone Date come from
 * TILE_FIELD_DEFS above; Title/Description/Status aren't in that list —
 * Title is always-on and Description has no tile-field entry at all — so
 * they're listed explicitly here instead) so a CSV a user builds by hand
 * matches what they already see in the app, with no separate mapping step.
 */
export const POAM_CSV_COLUMNS = [
  { header: "Title", field: "title" },
  { header: "Description", field: "description" },
  { header: "Status", field: "status" },
  { header: "Control", field: "control" },
  { header: "Inherent Risk", field: "severity" },
  { header: "Residual Risk", field: "residualRisk" },
  { header: "POC", field: "poc" },
  { header: "Next Milestone Date", field: "nextMilestoneDate" },
] as const satisfies readonly { header: string; field: string }[];

/** One CSV row's cells, keyed by POAM_CSV_COLUMNS' internal field ids — every
 * field is an optional string since usability (not shape) is what the
 * importer validates row-by-row. */
export interface RawPoamCsvRow {
  title?: string;
  description?: string;
  status?: string;
  control?: string;
  severity?: string;
  residualRisk?: string;
  poc?: string;
  nextMilestoneDate?: string;
}

export interface BulkImportRowNote {
  field: string;
  message: string;
}

export interface BulkImportPoamRowResult {
  /** 1-based row number, excluding the CSV header row. */
  row: number;
  outcome: "created" | "skipped";
  title?: string;
  nodeId?: string;
  /** Present only on a real (non-dryRun) "created" row. */
  node?: GraphNode;
  notes: BulkImportRowNote[];
}

export interface BulkImportPoamsResult {
  dryRun: boolean;
  createdCount: number;
  skippedCount: number;
  rows: BulkImportPoamRowResult[];
}

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

/**
 * Everything needed to exactly reconstitute one board: not just nodes/edges
 * but the node types/statuses and tileFields/placementMode settings that
 * board depends on to render and behave the same way after a restore.
 * `version` is a literal so an old-format file fails fast with a clear
 * error instead of being silently misread — bumped to 2 when boards were
 * introduced (a v1 backup predates boards and has no boardId/boardName).
 */
export interface FullBackup {
  version: 2;
  exportedAt: string;
  boardId: string;
  boardName: string;
  nodeTypes: NodeTypeConfig[];
  statuses: NodeStatusConfig[];
  nodes: GraphNode[];
  edges: GraphEdge[];
  appSettings: AppSettings;
}
