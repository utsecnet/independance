import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import * as statusQueries from "../db/queries/statuses.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createStatusSchema, updateStatusSchema } from "@independance/shared";
import type { z } from "zod";

export function listStatuses(db: DatabaseSync, boardId: string, typeId?: string) {
  return statusQueries.listStatuses(db, boardId, typeId);
}

export function createStatus(db: DatabaseSync, boardId: string, input: z.infer<typeof createStatusSchema>) {
  if (!nodeTypeQueries.getNodeType(db, boardId, input.typeId)) {
    throw new HttpError(404, "not_found", `Node type "${input.typeId}" not found`);
  }
  if (statusQueries.getStatusByValue(db, boardId, input.typeId, input.value)) {
    throw new HttpError(
      409,
      "status_exists",
      `A status with value "${input.value}" already exists for this type.`
    );
  }
  return statusQueries.insertStatus(db, boardId, { id: randomUUID(), ...input });
}

export function updateStatus(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: z.infer<typeof updateStatusSchema>
) {
  const existing = statusQueries.getStatus(db, boardId, id);
  if (!existing) throw new HttpError(404, "not_found", `Status ${id} not found`);
  // Setting isDefault:true on some other status already clears this flag
  // off the old one (see insertStatus/updateStatus in db/queries/statuses),
  // so that path always leaves exactly one default. The only way to reach
  // zero is unsetting *this* one directly without anything else taking its
  // place — resolveStatusForType (used by every node-creation path that
  // doesn't specify a status explicitly) would then have nothing to fall
  // back to for this type.
  if (input.isDefault === false && existing.isDefault) {
    throw new HttpError(
      409,
      "default_status_required",
      "Set a different status as default before unsetting this one — a type always needs one."
    );
  }
  const status = statusQueries.updateStatus(db, boardId, id, input);
  if (!status) throw new HttpError(404, "not_found", `Status ${id} not found`);
  return status;
}

export function deleteStatus(db: DatabaseSync, boardId: string, id: string) {
  const existing = statusQueries.getStatus(db, boardId, id);
  if (!existing) throw new HttpError(404, "not_found", `Status ${id} not found`);
  if (existing.isDefault) {
    throw new HttpError(
      409,
      "default_status_required",
      "Set a different status as default before deleting this one — a type always needs one."
    );
  }
  statusQueries.deleteStatus(db, boardId, id);
}

/**
 * Resolves the status to store for a node of `typeId` (within `boardId`):
 * validates an explicit `status` value against that type's configured
 * statuses, or falls back to the type's default status when none was given.
 */
export function resolveStatusForType(
  db: DatabaseSync,
  boardId: string,
  typeId: string,
  status: string | undefined
): string {
  if (status === undefined) {
    const def = statusQueries.getDefaultStatus(db, boardId, typeId);
    if (!def) throw new HttpError(400, "no_default_status", `Type "${typeId}" has no default status configured.`);
    return def.value;
  }
  const match = statusQueries.getStatusByValue(db, boardId, typeId, status);
  if (!match) throw new HttpError(400, "invalid_status", `"${status}" isn't a valid status for this type.`);
  return match.value;
}
