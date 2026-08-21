import { z } from "zod";
import { MAX_EXTRA_TILE_FIELDS, TILE_FIELD_IDS } from "./types.js";

const slugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z][a-z0-9_]*$/, "Must be lowercase letters, numbers, and underscores, starting with a letter.");
const hexColorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Must be a hex color like #3b82f6.");

export const nodeTypeSchema = z.string().min(1);
export const nodeStatusSchema = z.string().min(1);
export const relationshipTypeSchema = z.enum(["depends_on", "blocks", "relates_to", "remediates"]);

export const nodeMetadataSchema = z.record(z.string(), z.unknown());

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
