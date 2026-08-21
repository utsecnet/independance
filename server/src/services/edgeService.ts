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

/**
 * layout.ts's tiering (see arrangeNodes' tierFor) assumes the blocker graph
 * is acyclic and only guards against infinite recursion on a cycle, not
 * against producing a nonsensical layout from one — so that invariant has
 * to actually be enforced here, at the one place a blocks/depends_on edge
 * can be introduced. The direct two-node case (A blocks B, then B blocks A)
 * was already handled above by replacing the opposite edge rather than
 * stacking a contradiction, but that check never looked past the two
 * endpoints — a longer chain (A blocks B, B blocks C, then C blocks A) used
 * to sail straight through untouched. Walks forward from `blockedId`
 * through the existing blocker graph (excluding `excludeEdgeId`, so
 * updateEdge can check "as if this edge weren't already there") — if that
 * walk ever reaches `blockerId`, the new edge would close a cycle back to
 * where it started.
 */
function wouldCreateCycle(
  db: DatabaseSync,
  blockerId: string,
  blockedId: string,
  excludeEdgeId?: string
): boolean {
  if (blockerId === blockedId) return true;
  const adjacency = new Map<string, string[]>();
  for (const edge of edgeQueries.listEdges(db)) {
    if (edge.id === excludeEdgeId) continue;
    const pair = blockingPair(edge);
    if (!pair) continue;
    const list = adjacency.get(pair.blockerId);
    if (list) list.push(pair.blockedId);
    else adjacency.set(pair.blockerId, [pair.blockedId]);
  }
  const stack = [blockedId];
  const visited = new Set<string>();
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (id === blockerId) return true;
    if (visited.has(id)) continue;
    visited.add(id);
    for (const nextId of adjacency.get(id) ?? []) stack.push(nextId);
  }
  return false;
}

export function createEdge(db: DatabaseSync, input: z.infer<typeof createEdgeSchema>) {
  getNodeOrThrow(db, input.sourceId);
  getNodeOrThrow(db, input.targetId);

  // blockingPair (and so wouldCreateCycle, below) only ever runs for
  // blocks/depends_on — relates_to and remediates skip it entirely, which
  // used to let a node link to itself under those two types (sourceId ===
  // targetId sailed straight through, since there was no directional
  // "blocking" pair to walk). A self-loop isn't meaningful for any
  // relationship type, so it's rejected here, before branching by type.
  if (input.sourceId === input.targetId) {
    throw new HttpError(409, "self_loop", "An item can't be linked to itself.");
  }

  const newPair = blockingPair(input);
  if (newPair) {
    for (const edge of edgeQueries.getEdgesBetween(db, input.sourceId, input.targetId)) {
      const existingPair = blockingPair(edge);
      if (existingPair && existingPair.blockerId === newPair.blockedId && existingPair.blockedId === newPair.blockerId) {
        edgeQueries.deleteEdge(db, edge.id);
      }
    }
    if (wouldCreateCycle(db, newPair.blockerId, newPair.blockedId)) {
      throw new HttpError(409, "circular_dependency", "This would create a circular dependency chain.");
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
  const existing = edgeQueries.getEdge(db, id);
  if (!existing) throw new HttpError(404, "not_found", `Edge ${id} not found`);

  if (input.relationshipType) {
    const newPair = blockingPair({ ...existing, relationshipType: input.relationshipType });
    if (newPair && wouldCreateCycle(db, newPair.blockerId, newPair.blockedId, id)) {
      throw new HttpError(409, "circular_dependency", "This would create a circular dependency chain.");
    }
  }

  const edge = edgeQueries.updateEdge(db, id, input);
  if (!edge) throw new HttpError(404, "not_found", `Edge ${id} not found`);
  return edge;
}

export function deleteEdge(db: DatabaseSync, id: string) {
  const deleted = edgeQueries.deleteEdge(db, id);
  if (!deleted) throw new HttpError(404, "not_found", `Edge ${id} not found`);
}

