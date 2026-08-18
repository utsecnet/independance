import type { DatabaseSync } from "node:sqlite";
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

export function listEdges(db: DatabaseSync): GraphEdge[] {
  const rows = db.prepare("SELECT * FROM edges ORDER BY created_at, id").all() as unknown as EdgeRow[];
  return rows.map(rowToEdge);
}

export function getEdge(db: DatabaseSync, id: string): GraphEdge | undefined {
  const row = db.prepare("SELECT * FROM edges WHERE id = ?").get(id) as unknown as EdgeRow | undefined;
  return row ? rowToEdge(row) : undefined;
}

/** Every edge connecting these two nodes, in either direction — used to look for a conflicting opposite-direction edge without scanning the whole table. */
export function getEdgesBetween(db: DatabaseSync, aId: string, bId: string): GraphEdge[] {
  const rows = db
    .prepare("SELECT * FROM edges WHERE (source_id = @a AND target_id = @b) OR (source_id = @b AND target_id = @a)")
    .all({ a: aId, b: bId }) as unknown as EdgeRow[];
  return rows.map(rowToEdge);
}

export interface CreateEdgeInput {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  label?: string;
}

export function insertEdge(db: DatabaseSync, input: CreateEdgeInput): GraphEdge {
  db.prepare(
    `INSERT INTO edges (id, source_id, target_id, relationship_type, label)
     VALUES (@id, @sourceId, @targetId, @relationshipType, @label)`
  ).run({
    id: input.id,
    sourceId: input.sourceId,
    targetId: input.targetId,
    relationshipType: input.relationshipType,
    label: input.label ?? null,
  });
  return getEdge(db, input.id)!;
}

export interface UpdateEdgeInput {
  relationshipType?: RelationshipType;
  label?: string;
}

export function updateEdge(db: DatabaseSync, id: string, input: UpdateEdgeInput): GraphEdge | undefined {
  const existing = getEdge(db, id);
  if (!existing) return undefined;

  db.prepare(
    `UPDATE edges SET
       relationship_type = @relationshipType,
       label = @label,
       updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now')
     WHERE id = @id`
  ).run({
    id,
    relationshipType: input.relationshipType ?? existing.relationshipType,
    label: (input.label ?? existing.label) ?? null,
  });
  return getEdge(db, id);
}

export function deleteEdge(db: DatabaseSync, id: string): boolean {
  const result = db.prepare("DELETE FROM edges WHERE id = ?").run(id);
  return result.changes > 0;
}

