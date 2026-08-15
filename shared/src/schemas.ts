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

export const poamMilestoneSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  targetDate: z.string(),
  status: nodeStatusSchema,
  completedDate: z.string().optional(),
});

export const taskMetadataSchema = z.object({
  assignee: z.string().optional(),
  estimateHours: z.number().nonnegative().optional(),
  dueDate: z.string().optional(),
});

export const projectMetadataSchema = z.object({
  owner: z.string().optional(),
  targetDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

export const poamMetadataSchema = z.object({
  dueDate: z.string().optional(),
  severity: z.enum(["very_high", "high", "moderate", "low", "very_low"]).optional(),
  controlRefs: z.array(z.string()).optional(),
  poc: z.string().optional(),
  milestones: z.array(poamMilestoneSchema).optional(),
});

export const nodeMetadataSchema = z.record(z.string(), z.unknown());

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const createNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  status: nodeStatusSchema.optional(),
  metadata: nodeMetadataSchema.default({}),
  position: positionSchema.default({ x: 0, y: 0 }),
});

export const updateNodeSchema = z.object({
  title: z.string().min(1).optional(),
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
export const linkOrientationSchema = z.enum(["vertical", "horizontal"]);

export const updateAppSettingsSchema = z.object({
  tileFields: z.array(tileFieldIdSchema).max(MAX_EXTRA_TILE_FIELDS).optional(),
  linkOrientation: linkOrientationSchema.optional(),
});
