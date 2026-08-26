import type { DatabaseSync } from "node:sqlite";
import { randomUUID } from "node:crypto";
import * as boardQueries from "../db/queries/boards.js";
import * as nodeTypeQueries from "../db/queries/nodeTypes.js";
import * as statusQueries from "../db/queries/statuses.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createBoardSchema, updateBoardSchema } from "@independance/shared";
import type { z } from "zod";

export function listBoards(db: DatabaseSync) {
  return boardQueries.listBoards(db);
}

export function getBoardOrThrow(db: DatabaseSync, id: string) {
  const board = boardQueries.getBoard(db, id);
  if (!board) throw new HttpError(404, "not_found", `Board ${id} not found`);
  return board;
}

// Mirrors 004_boards.sql's own backfill of the original 'default' board
// (task/project/poam, each with the same statuses seeded there) — every
// *new* board gets the identical out-of-the-box shape, so it behaves like
// any other board from the moment it's created, and every place in the
// codebase (client included) that assumes a "task"/"project"/"poam" type
// exists keeps working for it.
const DEFAULT_TYPES = [
  { id: "task", label: "Task", color: "#3b82f6" },
  { id: "project", label: "Project", color: "#9a6bde" },
  { id: "poam", label: "POA&M", color: "#dc4444" },
] as const;

const DEFAULT_STATUSES: Record<string, { value: string; label: string; isDefault: boolean }[]> = {
  task: [
    { value: "not_started", label: "Not Started", isDefault: true },
    { value: "in_progress", label: "In Progress", isDefault: false },
    { value: "blocked", label: "Blocked", isDefault: false },
    { value: "complete", label: "Complete", isDefault: false },
  ],
  project: [
    { value: "not_started", label: "Not Started", isDefault: true },
    { value: "in_progress", label: "In Progress", isDefault: false },
    { value: "blocked", label: "Blocked", isDefault: false },
    { value: "complete", label: "Complete", isDefault: false },
  ],
  poam: [
    { value: "drafting", label: "Drafting", isDefault: true },
    { value: "assessment", label: "Assessment", isDefault: false },
    { value: "planning", label: "Planning", isDefault: false },
    { value: "isso_review", label: "ISSO Review", isDefault: false },
    { value: "issm_review", label: "ISSM Review", isDefault: false },
    { value: "complete", label: "Complete", isDefault: false },
  ],
};

function seedDefaultTypes(db: DatabaseSync, boardId: string) {
  for (const type of DEFAULT_TYPES) {
    nodeTypeQueries.insertNodeType(db, boardId, type);
    for (const status of DEFAULT_STATUSES[type.id]) {
      statusQueries.insertStatus(db, boardId, {
        id: randomUUID(),
        typeId: type.id,
        value: status.value,
        label: status.label,
        isDefault: status.isDefault,
      });
    }
  }
}

export function createBoard(db: DatabaseSync, input: z.infer<typeof createBoardSchema>) {
  const board = boardQueries.insertBoard(db, { id: randomUUID(), name: input.name });
  seedDefaultTypes(db, board.id);
  return board;
}

export function updateBoard(db: DatabaseSync, id: string, input: z.infer<typeof updateBoardSchema>) {
  const board = boardQueries.updateBoard(db, id, input);
  if (!board) throw new HttpError(404, "not_found", `Board ${id} not found`);
  return board;
}

export function deleteBoard(db: DatabaseSync, id: string) {
  getBoardOrThrow(db, id);
  if (boardQueries.countBoards(db) <= 1) {
    throw new HttpError(409, "last_board", "Can't delete the only board — every install needs at least one.");
  }
  boardQueries.deleteBoard(db, id);
}
