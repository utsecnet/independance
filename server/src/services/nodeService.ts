import type { DatabaseSync } from "node:sqlite";
import * as nodeQueries from "../db/queries/nodes.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createNodeSchema, updateNodePositionSchema, updateNodeSchema } from "@independance/shared";
import type { z } from "zod";

export function listNodes(db: DatabaseSync) {
  return nodeQueries.listNodes(db);
}

export function createNode(db: DatabaseSync, input: z.infer<typeof createNodeSchema>) {
  return nodeQueries.insertNode(db, input);
}

export function updateNode(db: DatabaseSync, id: string, input: z.infer<typeof updateNodeSchema>) {
  const node = nodeQueries.updateNode(db, id, input);
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

