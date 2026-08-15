import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import * as statusQueries from "../db/queries/statuses.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createStatusSchema, updateStatusSchema } from "@independance/shared";
import type { z } from "zod";

export function listStatuses(db: DatabaseSync, typeId?: string) {
  return statusQueries.listStatuses(db, typeId);
}

export function getStatusOrThrow(db: DatabaseSync, id: string) {
  const status = statusQueries.getStatus(db, id);
  if (!status) throw new HttpError(404, "not_found", `Status ${id} not found`);
  return status;
}

export function createStatus(db: DatabaseSync, input: z.infer<typeof createStatusSchema>) {
  if (!nodeTypeQueries.getNodeType(db, input.typeId)) {
    throw new HttpError(404, "not_found", `Node type "${input.typeId}" not found`);
  }
  if (statusQueries.getStatusByValue(db, input.typeId, input.value)) {
    throw new HttpError(
      409,
      "status_exists",
      `A status with value "${input.value}" already exists for this type.`
    );
  }
  return statusQueries.insertStatus(db, { id: randomUUID(), ...input });
}

export function updateStatus(db: DatabaseSync, id: string, input: z.infer<typeof updateStatusSchema>) {
  const status = statusQueries.updateStatus(db, id, input);
  if (!status) throw new HttpError(404, "not_found", `Status ${id} not found`);
  return status;
}

export function deleteStatus(db: DatabaseSync, id: string) {
  const deleted = statusQueries.deleteStatus(db, id);
  if (!deleted) throw new HttpError(404, "not_found", `Status ${id} not found`);
}

/**
 * Resolves the status to store for a node of `typeId`: validates an explicit
 * `status` value against that type's configured statuses, or falls back to
 * the type's default status when none was given.
 */
export function resolveStatusForType(db: DatabaseSync, typeId: string, status: string | undefined): string {
  if (status === undefined) {
    const def = statusQueries.getDefaultStatus(db, typeId);
    if (!def) throw new HttpError(400, "no_default_status", `Type "${typeId}" has no default status configured.`);
    return def.value;
  }
  const match = statusQueries.getStatusByValue(db, typeId, status);
  if (!match) throw new HttpError(400, "invalid_status", `"${status}" isn't a valid status for this type.`);
  return match.value;
}
