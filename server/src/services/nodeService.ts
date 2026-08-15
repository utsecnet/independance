import type { DatabaseSync } from "node:sqlite";
import * as nodeQueries from "../db/queries/nodes.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import { resolveStatusForType } from "./statusService.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createNodeSchema, updateNodePositionSchema, updateNodeSchema } from "@independance/shared";
import type { z } from "zod";

export function listNodes(db: DatabaseSync) {
  return nodeQueries.listNodes(db);
}

export function createNode(db: DatabaseSync, input: z.infer<typeof createNodeSchema>) {
  if (!nodeTypeQueries.getNodeType(db, input.type)) {
    throw new HttpError(404, "not_found", `Unknown node type "${input.type}"`);
  }
  const status = resolveStatusForType(db, input.type, input.status);
  return nodeQueries.insertNode(db, { ...input, status });
}

export function updateNode(db: DatabaseSync, id: string, input: z.infer<typeof updateNodeSchema>) {
  const existing = getNodeOrThrow(db, id);
  const status = input.status !== undefined ? resolveStatusForType(db, existing.type, input.status) : undefined;
  const node = nodeQueries.updateNode(db, id, { ...input, status });
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}

export function updateNodePosition(
  db: DatabaseSync,
  id: string,
  input: z.infer<typeof updateNodePositionSchema>
) {
  const node = nodeQueries.updateNodePosition(db, id, input.position);
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}

export function deleteNode(db: DatabaseSync, id: string) {
  const deleted = nodeQueries.deleteNode(db, id);
  if (!deleted) throw new HttpError(404, "not_found", `Node ${id} not found`);
}

export function getNodeOrThrow(db: DatabaseSync, id: string) {
  const node = nodeQueries.getNode(db, id);
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}

