import { z } from "zod";
import { MAX_BULK_IMPORT_ROWS, MAX_EXTRA_TILE_FIELDS, TILE_FIELD_IDS } from "./types.js";

export const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase letters, numbers, and underscores, starting with a letter.");
export const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #3b82f6.");

export const nodeTypeSchema = z.string().min(1);
export const nodeStatusSchema = z.string().min(1);
export const relationshipTypeSchema = z.enum(["depends_on", "blocks", "relates_to", "remediates"]);

export const nodeMetadataSchema = z.record(z.string(), z.unknown());

export const createBoardSchema = z.object({
  name: z.string().min(1),
});

export const updateBoardSchema = z.object({
  name: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
});

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const createNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  // Empty is allowed — a brand new tile starts with no title at all (the
  // create flow opens straight into the edit form with the title field
  // empty and focused) rather than a placeholder like "New Task" the user
  // has to notice and clear first.
  title: z.string(),
  description: z.string().optional(),
  status: nodeStatusSchema.optional(),
  metadata: nodeMetadataSchema.default({}),
  position: positionSchema.default({ x: 0, y: 0 }),
});

export const updateNodeSchema = z.object({
  // Also empty-allowed, same as createNodeSchema's title, and for a
  // connected reason: a brand new tile's title starts as "" (see above),
  // so the *first* edit a user ever makes to it has "" as its undo
  // snapshot — requiring a minimum length here would make undoing that
  // first edit fail server-side (title.min(1) rejecting the very state
  // undo needs to restore), while every UI path that actually lets a user
  // *save* a title already refuses to submit an empty one client-side
  // (see NodeCardForm's persistEdit/handleEnterSave) — this only ever
  // needs to accept "" for undo/redo's own internal restores, never for
  // anything a person directly typed and confirmed.
  title: z.string().optional(),
  description: z.string().optional(),
  status: nodeStatusSchema.optional(),
  metadata: nodeMetadataSchema.optional(),
});

export const updateNodePositionSchema = z.object({
  position: positionSchema,
});

export const createEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  relationshipType: relationshipTypeSchema.default("depends_on"),
  label: z.string().optional(),
});

export const updateEdgeSchema = z.object({
  relationshipType: relationshipTypeSchema.optional(),
  label: z.string().optional(),
});

export const createNodeTypeSchema = z.object({
  id: slugSchema,
  label: z.string().min(1),
  color: hexColorSchema,
});

export const updateNodeTypeSchema = z.object({
  label: z.string().min(1).optional(),
  color: hexColorSchema.optional(),
  sortOrder: z.number().int().optional(),
});

export const createStatusSchema = z.object({
  typeId: z.string().min(1),
  value: slugSchema,
  label: z.string().min(1),
  isDefault: z.boolean().optional(),
});

export const updateStatusSchema = z.object({
  label: z.string().min(1).optional(),
  sortOrder: z.number().int().optional(),
  isDefault: z.boolean().optional(),
});

export const tileFieldIdSchema = z.enum(TILE_FIELD_IDS as [string, ...string[]]);

export const themeModeSchema = z.enum(["dark", "light"]);
export const placementModeSchema = z.enum(["auto", "manual"]);

export const updateAppSettingsSchema = z.object({
  tileFields: z.record(z.string(), z.array(tileFieldIdSchema).max(MAX_EXTRA_TILE_FIELDS)).optional(),
  theme: themeModeSchema.optional(),
  placementMode: placementModeSchema.optional(),
});

// Deliberately loose — every field an optional string. Whether a row is
// actually usable (title present, status recognized, etc.) is a best-effort
// judgment made per-row in poamImportService, not a shape zod should reject
// the whole batch over.
export const bulkImportPoamRowSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  status: z.string().optional(),
  control: z.string().optional(),
  severity: z.string().optional(),
  residualRisk: z.string().optional(),
  poc: z.string().optional(),
  nextMilestoneDate: z.string().optional(),
});

export const bulkImportPoamsSchema = z.object({
  rows: z.array(bulkImportPoamRowSchema).min(1).max(MAX_BULK_IMPORT_ROWS),
  dryRun: z.boolean().optional(),
});

// A full backup preserves exact rows (ids, sort order, timestamps) rather
// than best-effort-importing loosely-shaped input — createNodeSchema and
// createEdgeSchema default/optionalize status and relationshipType because
// those are meant to accept a brand-new item, but a real exported node or
// edge always has one, so restore requires them.
export const backupNodeTypeSchema = createNodeTypeSchema.extend({
  sortOrder: z.number().int(),
});

export const backupStatusSchema = createStatusSchema.extend({
  id: z.string().min(1),
  sortOrder: z.number().int(),
});

export const backupNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string(),
  description: z.string().optional(),
  status: nodeStatusSchema,
  metadata: nodeMetadataSchema,
  position: positionSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
});

export const backupEdgeSchema = z.object({
  id: z.string().uuid(),
  sourceId: z.string().uuid(),
  targetId: z.string().uuid(),
  relationshipType: relationshipTypeSchema,
  label: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

// version: z.literal(2) means an old-format file (from before boards
// existed, with no boardId/boardName) fails fast with a clear error
// instead of silently misreading it, rather than needing every field to
// stay optional forever for cross-version compatibility.
export const fullBackupSchema = z.object({
  version: z.literal(2),
  exportedAt: z.string(),
  boardId: z.string(),
  boardName: z.string(),
  nodeTypes: z.array(backupNodeTypeSchema),
  statuses: z.array(backupStatusSchema),
  nodes: z.array(backupNodeSchema),
  edges: z.array(backupEdgeSchema),
  appSettings: updateAppSettingsSchema,
});
