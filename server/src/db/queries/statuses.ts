import type { DatabaseSync } from "node:sqlite";
import type { NodeStatusConfig } from "@independance/shared";

interface StatusRow {
  board_id: string;
  id: string;
  type_id: string;
  value: string;
  label: string;
  sort_order: number;
  is_default: number;
  created_at: string;
}

function rowToStatus(row: StatusRow): NodeStatusConfig {
  return {
    id: row.id,
    typeId: row.type_id,
    value: row.value,
    label: row.label,
    sortOrder: row.sort_order,
    isDefault: row.is_default === 1,
  };
}

export function listStatuses(db: DatabaseSync, boardId: string, typeId?: string): NodeStatusConfig[] {
  const rows = (
    typeId
      ? db
          .prepare("SELECT * FROM node_statuses WHERE board_id = ? AND type_id = ? ORDER BY sort_order, label")
          .all(boardId, typeId)
      : db
          .prepare("SELECT * FROM node_statuses WHERE board_id = ? ORDER BY type_id, sort_order, label")
          .all(boardId)
  ) as unknown as StatusRow[];
  return rows.map(rowToStatus);
}

export function getStatus(db: DatabaseSync, boardId: string, id: string): NodeStatusConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_statuses WHERE board_id = ? AND id = ?")
    .get(boardId, id) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export function getStatusByValue(
  db: DatabaseSync,
  boardId: string,
  typeId: string,
  value: string
): NodeStatusConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_statuses WHERE board_id = ? AND type_id = ? AND value = ?")
    .get(boardId, typeId, value) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export function getDefaultStatus(db: DatabaseSync, boardId: string, typeId: string): NodeStatusConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_statuses WHERE board_id = ? AND type_id = ? AND is_default = 1 LIMIT 1")
    .get(boardId, typeId) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export interface CreateStatusInput {
  id: string;
  typeId: string;
  value: string;
  label: string;
  isDefault?: boolean;
}

export function insertStatus(db: DatabaseSync, boardId: string, input: CreateStatusInput): NodeStatusConfig {
  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM node_statuses WHERE board_id = ? AND type_id = ?")
    .get(boardId, input.typeId) as unknown as { m: number };

  if (input.isDefault) {
    db.prepare("UPDATE node_statuses SET is_default = 0 WHERE board_id = ? AND type_id = ?").run(
      boardId,
      input.typeId
    );
  }

  db.prepare(
    `INSERT INTO node_statuses (board_id, id, type_id, value, label, sort_order, is_default)
     VALUES (@boardId, @id, @typeId, @value, @label, @sortOrder, @isDefault)`
  ).run({
    boardId,
    id: input.id,
    typeId: input.typeId,
    value: input.value,
    label: input.label,
    sortOrder: maxSortOrder.m + 1,
    isDefault: input.isDefault ? 1 : 0,
  });
  return getStatus(db, boardId, input.id)!;
}

export interface UpdateStatusInput {
  label?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

export function updateStatus(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: UpdateStatusInput
): NodeStatusConfig | undefined {
  const existing = getStatus(db, boardId, id);
  if (!existing) return undefined;

  if (input.isDefault) {
    db.prepare("UPDATE node_statuses SET is_default = 0 WHERE board_id = ? AND type_id = ?").run(
      boardId,
      existing.typeId
    );
  }

  db.prepare(
    `UPDATE node_statuses SET
       label = @label,
       sort_order = @sortOrder,
       is_default = @isDefault
     WHERE board_id = @boardId AND id = @id`
  ).run({
    boardId,
    id,
    label: input.label ?? existing.label,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    isDefault: (input.isDefault ?? existing.isDefault) ? 1 : 0,
  });
  return getStatus(db, boardId, id);
}

export function deleteStatus(db: DatabaseSync, boardId: string, id: string): boolean {
  const result = db.prepare("DELETE FROM node_statuses WHERE board_id = ? AND id = ?").run(boardId, id);
  return result.changes > 0;
}
