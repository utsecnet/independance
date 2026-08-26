import type { DatabaseSync, SQLInputValue } from "node:sqlite";
import type { GraphEdge, RelationshipType } from "@independance/shared";

interface EdgeRow {
  id: string;
  source_id: string;
  target_id: string;
  relationship_type: RelationshipType;
  label: string | null;
  created_at: string;
  updated_at: string;
}

function rowToEdge(row: EdgeRow): GraphEdge {
  return {
    id: row.id,
    sourceId: row.source_id,
    targetId: row.target_id,
    relationshipType: row.relationship_type,
    label: row.label ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listEdges(db: DatabaseSync, boardId: string): GraphEdge[] {
  const rows = db
    .prepare("SELECT * FROM edges WHERE board_id = ? ORDER BY created_at, id")
    .all(boardId) as unknown as EdgeRow[];
  return rows.map(rowToEdge);
}

export function getEdge(db: DatabaseSync, boardId: string, id: string): GraphEdge | undefined {
  const row = db
    .prepare("SELECT * FROM edges WHERE board_id = ? AND id = ?")
    .get(boardId, id) as unknown as EdgeRow | undefined;
  return row ? rowToEdge(row) : undefined;
}

/** Every edge connecting these two nodes, in either direction — used to look for a conflicting opposite-direction edge without scanning the whole table. */
export function getEdgesBetween(db: DatabaseSync, boardId: string, aId: string, bId: string): GraphEdge[] {
  const rows = db
    .prepare(
      "SELECT * FROM edges WHERE board_id = @boardId AND ((source_id = @a AND target_id = @b) OR (source_id = @b AND target_id = @a))"
    )
    .all({ boardId, a: aId, b: bId }) as unknown as EdgeRow[];
  return rows.map(rowToEdge);
}

export interface CreateEdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  label?: string;
  /** Restore-only: pins the exact original timestamps instead of the DB's
   * default `now()`. Omitted by every normal create path. */
  createdAt?: string;
  updatedAt?: string;
}

export function insertEdge(db: DatabaseSync, boardId: string, input: CreateEdgeInput): GraphEdge {
  const columns = ["board_id", "id", "source_id", "target_id", "relationship_type", "label"];
  const params: Record<string, SQLInputValue> = {
    board_id: boardId,
    id: input.id,
    source_id: input.sourceId,
    target_id: input.targetId,
    relationship_type: input.relationshipType,
    label: input.label ?? null,
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
    `INSERT INTO edges (${columns.join(", ")}) VALUES (${columns.map((c) => "@" + c).join(", ")})`
  ).run(params);
  return getEdge(db, boardId, input.id)!;
}

export interface UpdateEdgeInput {
  relationshipType?: RelationshipType;
  label?: string;
}

export function updateEdge(
  db: DatabaseSync,
  boardId: string,
  id: string,
  input: UpdateEdgeInput
): GraphEdge | undefined {
  const existing = getEdge(db, boardId, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE edges SET
       relationship_type = @relationshipType,
       label = @label,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE board_id = @boardId AND id = @id`
  ).run({
    boardId,
    id,
    relationshipType: input.relationshipType ?? existing.relationshipType,
    label: (input.label ?? existing.label) ?? null,
  });
  return getEdge(db, boardId, id);
}

export function deleteEdge(db: DatabaseSync, boardId: string, id: string): boolean {
  const result = db.prepare("DELETE FROM edges WHERE board_id = ? AND id = ?").run(boardId, id);
  return result.changes > 0;
}
