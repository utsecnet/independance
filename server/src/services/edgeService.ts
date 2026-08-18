import type { DatabaseSync } from "node:sqlite";
import * as edgeQueries from "../db/queries/edges.js";
import { getNodeOrThrow } from "./nodeService.js";
import { HttpError } from "../middleware/errorHandler.js";
import type { createEdgeSchema, updateEdgeSchema } from "@independance/shared";
import type { RelationshipType } from "@independance/shared";
import type { z } from "zod";

export function listEdges(db: DatabaseSync) {
  return edgeQueries.listEdges(db);
}

/**
 * "blocks" and "depends_on" both describe the same underlying relationship
 * (who blocks whom) from opposite ends. Normalize either encoding to a
 * canonical {blockerId, blockedId} pair so opposite-direction edges between
 * the same two nodes can be detected regardless of which endpoint they were
 * created from. Returns null for relationship types with no directional
 * blocking meaning (relates_to, remediates) — those aren't subject to the
 * no-circular-dependency rule.
 */
function blockingPair(
  edge: { sourceId: string; targetId: string; relationshipType: RelationshipType }
): { blockerId: string; blockedId: string } | null {
  if (edge.relationshipType === "blocks") return { blockerId: edge.sourceId, blockedId: edge.targetId };
  if (edge.relationshipType === "depends_on") return { blockerId: edge.targetId, blockedId: edge.sourceId };
  return null;
}

const SQLITE_CONSTRAINT_UNIQUE = 2067;

// relates_to has no directional meaning — A relates_to B and B relates_to A
// describe the identical fact, so a reverse-direction edge of the same type
// is a duplicate, not a distinct relationship. remediates is deliberately
// excluded: "A remediates B" and "B remediates A" mean different things, so
// both directions may legitimately coexist.
const SYMMETRIC_RELATIONSHIP_TYPES: RelationshipType[] = ["relates_to"];

export function createEdge(db: DatabaseSync, input: z.infer<typeof createEdgeSchema>) {
  getNodeOrThrow(db, input.sourceId);
  getNodeOrThrow(db, input.targetId);

  const newPair = blockingPair(input);
  if (newPair) {
    for (const edge of edgeQueries.getEdgesBetween(db, input.sourceId, input.targetId)) {
      const existingPair = blockingPair(edge);
      if (existingPair && existingPair.blockerId === newPair.blockedId && existingPair.blockedId === newPair.blockerId) {
        edgeQueries.deleteEdge(db, edge.id);
      }
    }
  } else if (SYMMETRIC_RELATIONSHIP_TYPES.includes(input.relationshipType)) {
    for (const edge of edgeQueries.getEdgesBetween(db, input.sourceId, input.targetId)) {
      if (
        edge.relationshipType === input.relationshipType &&
        edge.sourceId === input.targetId &&
        edge.targetId === input.sourceId
      ) {
        edgeQueries.deleteEdge(db, edge.id);
      }
    }
  }

  try {
    return edgeQueries.insertEdge(db, input);
  } catch (err) {
    if (err && typeof err === "object" && "errcode" in err && err.errcode === SQLITE_CONSTRAINT_UNIQUE) {
      throw new HttpError(409, "duplicate_edge", "These two items are already linked this way.");
    }
    throw err;
  }
}

export function updateEdge(db: DatabaseSync, id: string, input: z.infer<typeof updateEdgeSchema>) {
  const edge = edgeQueries.updateEdge(db, id, input);
  if (!edge) throw new HttpError(404, "not_found", `Edge ${id} not found`);
  return edge;
}

export function deleteEdge(db: DatabaseSync, id: string) {
  const deleted = edgeQueries.deleteEdge(db, id);
  if (!deleted) throw new HttpError(404, "not_found", `Edge ${id} not found`);
}

