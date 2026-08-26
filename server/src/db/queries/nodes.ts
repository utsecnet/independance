import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { GraphNode, NodeStatus, NodeType } from "@independance/shared";

interface NodeRow {
  id: string;
  type: NodeType;
  title: string;
  description: string | null;
  status: NodeStatus;
  metadata: string;
  pos_x: number;
  pos_y: number;
  created_at: string;
  updated_at: string;
}

function rowToNode(row: NodeRow): GraphNode {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    description: row.description ?? undefined,
    status: row.status,
    metadata: JSON.parse(row.metadata),
    position: { x: row.pos_x, y: row.pos_y },
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listNodes(db: DatabaseSync, boardId: string): GraphNode[] {
  const rows = db
    .prepare("SELECT * FROM nodes WHERE board_id = ? ORDER BY created_at, id")
    .all(boardId) as unknown as NodeRow[];
  return rows.map(rowToNode);
}

// Scoped by board_id even though `id` alone (a client-generated UUID) is
// already unambiguous — this is what stops one board from fetching/editing
// another board's node by guessing or leaking its id.
export function getNode(db: DatabaseSync, boardId: string, id: string): GraphNode | undefined {
  const row = db
    .prepare("SELECT * FROM nodes WHERE board_id = ? AND id = ?")
    .get(boardId, id) as unknown as NodeRow | undefined;
  return row ? rowToNode(row) : undefined;
}

export interface CreateNodeInput {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status: NodeStatus;
  metadata: unknown;
  position: { x: number; y: number };
  /** Restore-only: pins the exact original timestamps instead of the DB's
   * default `now()`, so listNodes' `ORDER BY created_at, id` reproduces the
   * backed-up order. Omitted by every normal create path. */
  createdAt?: string;
  updatedAt?: string;
}

export function insertNode(db: DatabaseSync, boardId: string, input: CreateNodeInput): GraphNode {
  const columns = ["board_id", "id", "type", "title", "description", "status", "metadata", "pos_x", "pos_y"];
  const params: Record<string, SQLInputValue> = {
    board_id: boardId,
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    metadata: JSON.stringify(input.metadata ?? {}),
    pos_x: input.position.x,
    pos_y: input.position.y,
  };
  if (input.createdAt !== undefined) {
    columns.push("created_at");
    params.created_at = input.createdAt;
  }
  if (input.updatedAt !== undefined) {
    columns.push("updated_at");
    params.updated_at = input.updatedAt;
  }
  db.prepare(
    `INSERT INTO nodes (${columns.join(", ")}) VALUES (${columns.map((c) => "@" + c).join(", ")})`
  ).run(params);
  return getNode(db, boardId, input.id)!;
}

export interface UpdateNodeInput {
  title?: string;
  description?: string;
  status?: NodeStatus;
  metadata?: unknown;
}

export function updateNode(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: UpdateNodeInput
): GraphNode | undefined {
  const existing = getNode(db, boardId, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE nodes SET
       title = @title,
       description = @description,
       status = @status,
       metadata = @metadata,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE board_id = @boardId AND id = @id`
  ).run({
    boardId,
    id,
    title: input.title ?? existing.title,
    description: (input.description ?? existing.description) ?? null,
    status: input.status ?? existing.status,
    metadata: JSON.stringify(input.metadata ?? existing.metadata),
  });
  return getNode(db, boardId, id);
}

export function updateNodePosition(
  db: DatabaseSync,
  boardId: string,
  id: string,
  position: { x: number; y: number }
): GraphNode | undefined {
  const result = db
    .prepare(
      `UPDATE nodes SET pos_x = @x, pos_y = @y, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE board_id = @boardId AND id = @id`
    )
    .run({ boardId, id, x: position.x, y: position.y });
  if (result.changes === 0) return undefined;
  return getNode(db, boardId, id);
}

export function deleteNode(db: DatabaseSync, boardId: string, id: string): boolean {
  const result = db.prepare("DELETE FROM nodes WHERE board_id = ? AND id = ?").run(boardId, id);
  return result.changes > 0;
}
