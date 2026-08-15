import type { DatabaseSync } from "node:sqlite";
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

export function listNodes(db: DatabaseSync): GraphNode[] {
  const rows = db.prepare("SELECT * FROM nodes ORDER BY created_at").all() as unknown as NodeRow[];
  return rows.map(rowToNode);
}

export function getNode(db: DatabaseSync, id: string): GraphNode | undefined {
  const row = db.prepare("SELECT * FROM nodes WHERE id = ?").get(id) as unknown as NodeRow | undefined;
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
}

export function insertNode(db: DatabaseSync, input: CreateNodeInput): GraphNode {
  db.prepare(
    `INSERT INTO nodes (id, type, title, description, status, metadata, pos_x, pos_y)
     VALUES (@id, @type, @title, @description, @status, @metadata, @pos_x, @pos_y)`
  ).run({
    id: input.id,
    type: input.type,
    title: input.title,
    description: input.description ?? null,
    status: input.status,
    metadata: JSON.stringify(input.metadata ?? {}),
    pos_x: input.position.x,
    pos_y: input.position.y,
  });
  return getNode(db, input.id)!;
}

export interface UpdateNodeInput {
  title?: string;
  description?: string;
  status?: NodeStatus;
  metadata?: unknown;
}

export function updateNode(db: DatabaseSync, id: string, input: UpdateNodeInput): GraphNode | undefined {
  const existing = getNode(db, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE nodes SET
       title = @title,
       description = @description,
       status = @status,
       metadata = @metadata,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({
    id,
    title: input.title ?? existing.title,
    description: (input.description ?? existing.description) ?? null,
    status: input.status ?? existing.status,
    metadata: JSON.stringify(input.metadata ?? existing.metadata),
  });
  return getNode(db, id);
}

export function updateNodePosition(
  db: DatabaseSync,
  id: string,
  position: { x: number; y: number }
): GraphNode | undefined {
  const result = db
    .prepare(
      `UPDATE nodes SET pos_x = @x, pos_y = @y, updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
       WHERE id = @id`
    )
    .run({ id, x: position.x, y: position.y });
  if (result.changes === 0) return undefined;
  return getNode(db, id);
}

export function deleteNode(db: DatabaseSync, id: string): boolean {
  const result = db.prepare("DELETE FROM nodes WHERE id = ?").run(id);
  return result.changes > 0;
}

