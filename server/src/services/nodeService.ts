import type { DatabaseSync } from "node:sqlite";
import * as nodeQueries from "../db/queries/nodes.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import { resolveStatusForType } from "./statusService.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createNodeSchema, updateNodePositionSchema, updateNodeSchema } from "@independance/shared";
import type { z } from "zod";

export function listNodes(db: DatabaseSync, boardId: string) {
  return nodeQueries.listNodes(db, boardId);
}

export function createNode(db: DatabaseSync, boardId: string, input: z.infer<typeof createNodeSchema>) {
  if (!nodeTypeQueries.getNodeType(db, boardId, input.type)) {
    throw new HttpError(404, "not_found", `Unknown node type "${input.type}"`);
  }
  const status = resolveStatusForType(db, boardId, input.type, input.status);
  return nodeQueries.insertNode(db, boardId, { ...input, status });
}

export function updateNode(db: DatabaseSync, boardId: string, id: string, input: z.infer<typeof updateNodeSchema>) {
  const existing = getNodeOrThrow(db, boardId, id);
  const status =
    input.status !== undefined ? resolveStatusForType(db, boardId, existing.type, input.status) : undefined;
  const node = nodeQueries.updateNode(db, boardId, id, { ...input, status });
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}

export function updateNodePosition(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: z.infer<typeof updateNodePositionSchema>
) {
  const node = nodeQueries.updateNodePosition(db, boardId, id, input.position);
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}

export function deleteNode(db: DatabaseSync, boardId: string, id: string) {
  const deleted = nodeQueries.deleteNode(db, boardId, id);
  if (!deleted) throw new HttpError(404, "not_found", `Node ${id} not found`);
}

export function getNodeOrThrow(db: DatabaseSync, boardId: string, id: string) {
  const node = nodeQueries.getNode(db, boardId, id);
  if (!node) throw new HttpError(404, "not_found", `Node ${id} not found`);
  return node;
}
