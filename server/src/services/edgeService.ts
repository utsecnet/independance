import type { DatabaseSync } from "node:sqlite";
import * as edgeQueries from "../db/queries/edges.js";
import { getNodeOrThrow } from "./nodeService.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createEdgeSchema, updateEdgeSchema } from "@independance/shared";
import type { z } from "zod";

export function listEdges(db: DatabaseSync) {
  return edgeQueries.listEdges(db);
}

export function createEdge(db: DatabaseSync, input: z.infer<typeof createEdgeSchema>) {
  getNodeOrThrow(db, input.sourceId);
  getNodeOrThrow(db, input.targetId);
  return edgeQueries.insertEdge(db, input);
}

export function updateEdge(db: DatabaseSync, id: string, input: z.infer<typeof updateEdgeSchema>) {
  const edge = edgeQueries.updateEdge(db, id, input);
  if (!edge) throw new HttpError(404, "not_found", `Edge ${id} not found`);
  return edge;
}

export function deleteEdge(db: DatabaseSync, id: string) {
  const deleted = edgeQueries.deleteEdge(db, id);
  if (!deleted) throw new HttpError(404, "not_found", `Edge ${id} not found`);
}

