import type { DatabaseSync } from "node:sqlite";
import type { NodeTypeConfig } from "@independance/shared";

interface NodeTypeRow {
  board_id: string;
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

export function listNodeTypes(db: DatabaseSync, boardId: string): NodeTypeConfig[] {
  const rows = db
    .prepare("SELECT * FROM node_types WHERE board_id = ? ORDER BY sort_order, label")
    .all(boardId) as unknown as NodeTypeRow[];
  return rows.map(rowToNodeType);
}

export function getNodeType(db: DatabaseSync, boardId: string, id: string): NodeTypeConfig | undefined {
  const row = db
    .prepare("SELECT * FROM node_types WHERE board_id = ? AND id = ?")
    .get(boardId, id) as unknown as NodeTypeRow | undefined;
  return row ? rowToNodeType(row) : undefined;
}

export interface CreateNodeTypeInput {
  id: string;
  label: string;
  color: string;
}

export function insertNodeType(db: DatabaseSync, boardId: string, input: CreateNodeTypeInput): NodeTypeConfig {
  const maxSortOrder = db
    .prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM node_types WHERE board_id = ?")
    .get(boardId) as unknown as { m: number };
  db.prepare(
    `INSERT INTO node_types (board_id, id, label, color, sort_order) VALUES (@boardId, @id, @label, @color, @sortOrder)`
  ).run({ boardId, id: input.id, label: input.label, color: input.color, sortOrder: maxSortOrder.m + 1 });
  return getNodeType(db, boardId, input.id)!;
}

export interface UpdateNodeTypeInput {
  label?: string;
  color?: string;
  sortOrder?: number;
}

export function updateNodeType(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: UpdateNodeTypeInput
): NodeTypeConfig | undefined {
  const existing = getNodeType(db, boardId, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE node_types SET
       label = @label,
       color = @color,
       sort_order = @sortOrder,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE board_id = @boardId AND id = @id`
  ).run({
    boardId,
    id,
    label: input.label ?? existing.label,
    color: input.color ?? existing.color,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  });
  return getNodeType(db, boardId, id);
}

export function deleteNodeType(db: DatabaseSync, boardId: string, id: string): boolean {
  const result = db.prepare("DELETE FROM node_types WHERE board_id = ? AND id = ?").run(boardId, id);
  return result.changes > 0;
}
