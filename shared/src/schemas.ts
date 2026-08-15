import { z } from "zod";

export const nodeTypeSchema = z.enum(["task", "project", "poam"]);
export const nodeStatusSchema = z.enum(["not_started", "in_progress", "blocked", "complete"]);
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
  severity: z.enum(["low", "moderate", "high"]).optional(),
  controlRefs: z.array(z.string()).optional(),
  poc: z.string().optional(),
  milestones: z.array(poamMilestoneSchema).optional(),
});

export const nodeMetadataSchema = z.union([
  taskMetadataSchema,
  projectMetadataSchema,
  poamMetadataSchema,
]);

export const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

export const createNodeSchema = z.object({
  id: z.string().uuid(),
  type: nodeTypeSchema,
  title: z.string().min(1),
  description: z.string().optional(),
  status: nodeStatusSchema.default("not_started"),
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
