import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import * as statusQueries from "../db/queries/statuses.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createNodeTypeSchema, updateNodeTypeSchema } from "@independance/shared";
import type { z } from "zod";

const SQLITE_CONSTRAINT_FOREIGNKEY = 787;

export function listNodeTypes(db: DatabaseSync, boardId: string) {
  return nodeTypeQueries.listNodeTypes(db, boardId);
}

export function getNodeTypeOrThrow(db: DatabaseSync, boardId: string, id: string) {
  const type = nodeTypeQueries.getNodeType(db, boardId, id);
  if (!type) throw new HttpError(404, "not_found", `Node type "${id}" not found`);
  return type;
}

export function createNodeType(db: DatabaseSync, boardId: string, input: z.infer<typeof createNodeTypeSchema>) {
  if (nodeTypeQueries.getNodeType(db, boardId, input.id)) {
    throw new HttpError(409, "type_exists", `A type with id "${input.id}" already exists.`);
  }
  const type = nodeTypeQueries.insertNodeType(db, boardId, input);
  // A type with no statuses at all can't have a node created for it —
  // resolveStatusForType (statusService) requires a default status to fall
  // back to whenever one isn't explicitly given, which is the common case
  // (every node-creation entry point in the client omits status). Seeding
  // one immediately means a freshly-created type is usable right away
  // instead of 400ing until someone visits Settings to add one by hand.
  statusQueries.insertStatus(db, boardId, {
    id: randomUUID(),
    typeId: type.id,
    value: "not_started",
    label: "Not Started",
    isDefault: true,
  });
  return type;
}

export function updateNodeType(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: z.infer<typeof updateNodeTypeSchema>
) {
  const type = nodeTypeQueries.updateNodeType(db, boardId, id, input);
  if (!type) throw new HttpError(404, "not_found", `Node type "${id}" not found`);
  return type;
}

export function deleteNodeType(db: DatabaseSync, boardId: string, id: string) {
  getNodeTypeOrThrow(db, boardId, id);
  try {
    nodeTypeQueries.deleteNodeType(db, boardId, id);
  } catch (err) {
    if (err && typeof err === "object" && "errcode" in err && err.errcode === SQLITE_CONSTRAINT_FOREIGNKEY) {
      throw new HttpError(
        409,
        "type_in_use",
        "This type still has items using it — remove or reassign them first."
      );
    }
    throw err;
  }
}
