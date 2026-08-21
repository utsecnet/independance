export interface RollupNode {
  id: string;
  type: string;
}

export interface RollupEdge {
  source: string;
  target: string;
  relationshipType: string;
}

// Normalizes both edge encodings into a single blocker -> blocked
// direction, same as arrangeNodes in layout.ts and collectDependencyChain —
// a "depends_on" edge is just the inverse spelling of the same
// relationship, not a different one. Only checking for literal "blocks"
// here (as this used to) silently missed every predecessor connected via
// "depends_on", which is common: e.g. a task that gates a project is
// usually expressed as "project depends_on task", not "task blocks
// project" — a project connected to the rest of the graph only that way
// would compute a totally empty upstream set and show no rollup tabs at
// all, even though it clearly has dependents.
function buildPredecessors(edges: RollupEdge[]): Map<string, string[]> {
  const predecessors = new Map<string, string[]>();
  for (const e of edges) {
    const blockerId = e.relationshipType === "blocks" ? e.source : e.relationshipType === "depends_on" ? e.target : null;
    const blockedId = e.relationshipType === "blocks" ? e.target : e.relationshipType === "depends_on" ? e.source : null;
    if (blockerId === null || blockedId === null) continue;
    const list = predecessors.get(blockedId);
    if (list) list.push(blockerId);
    else predecessors.set(blockedId, [blockerId]);
  }
  return predecessors;
}

/**
 * Walks upstream from `nodeId` along blocking edges (things that must
 * happen before it can — see buildPredecessors for how both "blocks" and
 * "depends_on" edges normalize into this), grouping every unique
 * task/POA&M-type node
 * reachable that way by its own type id — the underlying set both
 * computeDependencyRollups (just the counts, for the tile's tab badges)
 * and PoamsTab (the actual POA&M items, listed by title) are built from.
 *
 * A "project"-type node is a hard boundary: reaching one while walking
 * upstream stops that branch right there — it's neither included itself
 * nor traversed past — so one Project's upstream set never leaks into
 * another Project's. Everything else (Tasks, POA&Ms, any custom type in
 * between) is walked through and included, so a Task's own upstream
 * Task/POA&M chain rolls all the way up into whichever Project eventually
 * sits downstream of it, in addition to that Task's own (smaller) set.
 */
function collectUpstreamIdsByTypeFromPredecessors(
  nodeId: string,
  typeById: Map<string, string>,
  predecessors: Map<string, string[]>
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const visited = new Set<string>();
  const queue = [...(predecessors.get(nodeId) ?? [])];
  while (queue.length > 0) {
    const id = queue.pop()!;
    if (visited.has(id)) continue;
    visited.add(id);
    const type = typeById.get(id);
    if (type === undefined || type === "project") continue;
    const list = result.get(type);
    if (list) list.push(id);
    else result.set(type, [id]);
    for (const p of predecessors.get(id) ?? []) {
      if (!visited.has(p)) queue.push(p);
    }
  }
  return result;
}

/** Single-node convenience wrapper — see collectUpstreamIdsByTypeFromPredecessors. */
export function collectUpstreamIdsByType(
  nodeId: string,
  nodes: RollupNode[],
  edges: RollupEdge[]
): Map<string, string[]> {
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  return collectUpstreamIdsByTypeFromPredecessors(nodeId, typeById, buildPredecessors(edges));
}

/**
 * For every Project node, counts how many task/POA&M-type nodes sit
 * upstream of it in the blocking chain — broken down per node type, so a
 * Project showing 3 POA&Ms + 4 Tasks means 3 unique POA&Ms and 4 unique
 * Tasks are somewhere in the chain of things blocking it (see
 * GraphNodeCard's rollup tabs). Project-only: a Task's own tab would just
 * be re-summarizing a small slice of the same chain its Project already
 * rolls all the way up, immediately below it on the map — not a distinct
 * enough number to be worth a second badge everywhere. Just the sizes of
 * collectUpstreamIdsByType's sets, computed for every Project node in one
 * pass over a predecessors map built once and shared across all of them
 * (rather than each node rebuilding it from scratch).
 */
export function computeDependencyRollups(
  nodes: RollupNode[],
  edges: RollupEdge[]
): Map<string, Map<string, number>> {
  const typeById = new Map(nodes.map((n) => [n.id, n.type]));
  const predecessors = buildPredecessors(edges);

  const result = new Map<string, Map<string, number>>();
  for (const n of nodes) {
    if (n.type !== "project") continue;
    const byType = collectUpstreamIdsByTypeFromPredecessors(n.id, typeById, predecessors);
    const counts = new Map<string, number>();
    for (const [type, ids] of byType) counts.set(type, ids.length);
    result.set(n.id, counts);
  }
  return result;
}
