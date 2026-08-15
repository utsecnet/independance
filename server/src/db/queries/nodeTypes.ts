import type { DatabaseSync } from "node:sqlite";
import type { NodeTypeConfig } from "@independance/shared";

interface NodeTypeRow {
  id: string;
  label: string;
  color: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToNodeType(row: NodeTypeRow): NodeTypeConfig {
  return {
    id: row.id,
    label: row.label,
    color: row.color,
    sortOrder: row.sort_order,
  };
}

export function listNodeTypes(db: DatabaseSync): NodeTypeConfig[] {
  const rows = db.prepare("SELECT * FROM node_types ORDER BY sort_order, label").all() as unknown as NodeTypeRow[];
  return rows.map(rowToNodeType);
}

export function getNodeType(db: DatabaseSync, id: string): NodeTypeConfig | undefined {
  const row = db.prepare("SELECT * FROM node_types WHERE id = ?").get(id) as unknown as NodeTypeRow | undefined;
  return row ? rowToNodeType(row) : undefined;
}

export interface CreateNodeTypeInput {
  id: string;
  label: string;
  color: string;
}

export function insertNodeType(db: DatabaseSync, input: CreateNodeTypeInput): NodeTypeConfig {
  const maxSortOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM node_types").get() as unknown as {
    m: number;
  };
  db.prepare(
    `INSERT INTO node_types (id, label, color, sort_order) VALUES (@id, @label, @color, @sortOrder)`
  ).run({ id: input.id, label: input.label, color: input.color, sortOrder: maxSortOrder.m + 1 });
  return getNodeType(db, input.id)!;
}

export interface UpdateNodeTypeInput {
  label?: string;
  color?: string;
  sortOrder?: number;
}

export function updateNodeType(db: DatabaseSync, id: string, input: UpdateNodeTypeInput): NodeTypeConfig | undefined {
  const existing = getNodeType(db, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE node_types SET
       label = @label,
       color = @color,
       sort_order = @sortOrder,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({
    id,
    label: input.label ?? existing.label,
    color: input.color ?? existing.color,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  });
  return getNodeType(db, id);
}

export function deleteNodeType(db: DatabaseSync, id: string): boolean {
  const result = db.prepare("DELETE FROM node_types WHERE id = ?").run(id);
  return result.changes > 0;
}
