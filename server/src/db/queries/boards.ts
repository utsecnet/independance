import type { DatabaseSync } from "node:sqlite";
import type { BoardConfig } from "@independance/shared";

interface BoardRow {
  id: string;
  name: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

function rowToBoard(row: BoardRow): BoardConfig {
  return { id: row.id, name: row.name, sortOrder: row.sort_order };
}

export function listBoards(db: DatabaseSync): BoardConfig[] {
  const rows = db.prepare("SELECT * FROM boards ORDER BY sort_order, name").all() as unknown as BoardRow[];
  return rows.map(rowToBoard);
}

export function getBoard(db: DatabaseSync, id: string): BoardConfig | undefined {
  const row = db.prepare("SELECT * FROM boards WHERE id = ?").get(id) as unknown as BoardRow | undefined;
  return row ? rowToBoard(row) : undefined;
}

export interface CreateBoardInput {
  id: string;
  name: string;
}

export function insertBoard(db: DatabaseSync, input: CreateBoardInput): BoardConfig {
  const maxSortOrder = db.prepare("SELECT COALESCE(MAX(sort_order), -1) AS m FROM boards").get() as unknown as {
    m: number;
  };
  db.prepare(`INSERT INTO boards (id, name, sort_order) VALUES (@id, @name, @sortOrder)`).run({
    id: input.id,
    name: input.name,
    sortOrder: maxSortOrder.m + 1,
  });
  return getBoard(db, input.id)!;
}

export interface UpdateBoardInput {
  name?: string;
  sortOrder?: number;
}

export function updateBoard(db: DatabaseSync, id: string, input: UpdateBoardInput): BoardConfig | undefined {
  const existing = getBoard(db, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE boards SET
       name = @name,
       sort_order = @sortOrder,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({
    id,
    name: input.name ?? existing.name,
    sortOrder: input.sortOrder ?? existing.sortOrder,
  });
  return getBoard(db, id);
}

export function deleteBoard(db: DatabaseSync, id: string): boolean {
  const result = db.prepare("DELETE FROM boards WHERE id = ?").run(id);
  return result.changes > 0;
}

export function countBoards(db: DatabaseSync): number {
  const row = db.prepare("SELECT COUNT(*) AS c FROM boards").get() as unknown as { c: number };
  return row.c;
}
