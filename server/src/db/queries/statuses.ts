import type { DatabaseSync } from "node:sqlite";
import type { NodeStatusConfig } from "@independance/shared";

interface StatusRow {
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

export function listStatuses(db: DatabaseSync, typeId?: string): NodeStatusConfig[] {
  const rows = (
    typeId
      ? db.prepare("SELECT * FROM node_statuses WHERE type_id = ? ORDER BY sort_order, label").all(typeId)
      : db.prepare("SELECT * FROM node_statuses ORDER BY type_id, sort_order, label").all()
  ) as unknown as StatusRow[];
  return rows.map(rowToStatus);
}

export function getStatus(db: DatabaseSync, id: string): NodeStatusConfig | undefined {
  const row = db.prepare("SELECT * FROM node_statuses WHERE id = ?").get(id) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export function getStatusByValue(db: DatabaseSync, typeId: string, value: string): NodeStatusConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_statuses WHERE type_id = ? AND value = ?")
    .get(typeId, value) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export function getDefaultStatus(db: DatabaseSync, typeId: string): NodeStatusConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_statuses WHERE type_id = ? AND is_default = 1 LIMIT 1")
    .get(typeId) as unknown as StatusRow | undefined;
  return row ? rowToStatus(row) : undefined;
}

export interface CreateStatusInput {
  id: string;
  typeId: string;
  value: string;
  label: string;
  isDefault?: boolean;
}

export function insertStatus(db: DatabaseSync, input: CreateStatusInput): NodeStatusConfig {
  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM node_statuses WHERE type_id = ?")
    .get(input.typeId) as unknown as { m: number };

  if (input.isDefault) {
    db.prepare("UPDATE node_statuses SET is_default = 0 WHERE type_id = ?").run(input.typeId);
  }

  db.prepare(
    `INSERT INTO node_statuses (id, type_id, value, label, sort_order, is_default)
     VALUES (@id, @typeId, @value, @label, @sortOrder, @isDefault)`
  ).run({
    id: input.id,
    typeId: input.typeId,
    value: input.value,
    label: input.label,
    sortOrder: maxSortOrder.m + 1,
    isDefault: input.isDefault ? 1 : 0,
  });
  return getStatus(db, input.id)!;
}

export interface UpdateStatusInput {
  label?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

export function updateStatus(db: DatabaseSync, id: string, input: UpdateStatusInput): NodeStatusConfig | undefined {
  const existing = getStatus(db, id);
  if (!existing) return undefined;

  if (input.isDefault) {
    db.prepare("UPDATE node_statuses SET is_default = 0 WHERE type_id = ?").run(existing.typeId);
  }

  db.prepare(
    `UPDATE node_statuses SET
       label = @label,
       sort_order = @sortOrder,
       is_default = @isDefault
     WHERE id = @id`
  ).run({
    id,
    label: input.label ?? existing.label,
    sortOrder: input.sortOrder ?? existing.sortOrder,
    isDefault: (input.isDefault ?? existing.isDefault) ? 1 : 0,
  });
  return getStatus(db, id);
}

export function deleteStatus(db: DatabaseSync, id: string): boolean {
  const result = db.prepare("DELETE FROM node_statuses WHERE id = ?").run(id);
  return result.changes > 0;
}
