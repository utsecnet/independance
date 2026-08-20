import type { RelationshipType } from "@independance/shared";

export interface CollapseEdge {
  source: string;
  target: string;
  relationshipType: RelationshipType;
}

/**
 * One connection in the collapsed view between two *visible* nodes —
 * either a real, untouched edge (hiddenCount 0) or a synthesized "bridge"
 * standing in for a run of one or more hidden nodes that used to sit
 * between them (hiddenCount > 0), so the map can draw a single
 * "---[N]---"-style line across the gap instead of leaving it open (see
 * GraphNodeCard's edge label) — and so arrangeNodes can lay the two
 * survivors out as if the hidden run were never there at all, closing the
 * gap instead of leaving dead space where it used to be.
 */
export interface BridgeEdge {
  source: string;
  target: string;
  hiddenCount: number;
}

/**
 * Per visible node, how many hidden nodes sit off its blocker side (left,
 * `upstream`) or blocked side (right, `downstream`) with no visible node of
 * their own to bridge to — a hidden run that dead-ends at a hidden root or
 * hidden leaf instead of eventually reconnecting to something still on the
 * map. A bridge edge can only stand in for a hidden run when *both* ends are
 * visible; a run with no visible far end has nowhere to draw a bridge to at
 * all, so without this it vanishes with zero trace (see GraphNodeCard's
 * filteredLeft/filteredRight indicators, which read this to show "N hidden"
 * directly on the tile instead).
 */
export interface DanglingCounts {
  upstream: number;
  downstream: number;
}

/**
 * Walks the hidden run reachable from `targetId` through `adjacency`
 * (`blockedBy` for an upstream/backward walk, `blocks` for a
 * downstream/forward walk), same traversal collapseHiddenNodes always did:
 * hidden nodes are transparent and get walked through (each expanded at
 * most once per target), a non-hidden id ends that path and is recorded in
 * `frontier` together with the hidden ids crossed to reach it.
 *
 * `expanded` (every hidden node visited, regardless of whether its path
 * ever reached a non-hidden id) is always a superset of the union of
 * `frontier`'s trails (every hidden node that *did* reach one) — the
 * difference between the two is exactly the hidden nodes stranded on a
 * dead-end path, which is what DanglingCounts reports.
 */
function walkHiddenRun(
  targetId: string,
  adjacency: Map<string, string[]>,
  hiddenIds: ReadonlySet<string>
): { frontier: Map<string, Set<string>>; expanded: Set<string> } {
  const frontier = new Map<string, Set<string>>();
  const expanded = new Set<string>();
  const stack: { id: string; trail: Set<string> }[] = (adjacency.get(targetId) ?? []).map((id) => ({
    id,
    trail: new Set<string>(),
  }));

  while (stack.length > 0) {
    const { id, trail } = stack.pop()!;
    if (hiddenIds.has(id)) {
      if (expanded.has(id)) continue;
      expanded.add(id);
      const nextTrail = new Set(trail);
      nextTrail.add(id);
      for (const nextId of adjacency.get(id) ?? []) {
        stack.push({ id: nextId, trail: nextTrail });
      }
    } else {
      const existing = frontier.get(id);
      if (existing) for (const hiddenId of trail) existing.add(hiddenId);
      else frontier.set(id, new Set(trail));
    }
  }

  return { frontier, expanded };
}

function danglingCount(walk: { frontier: Map<string, Set<string>>; expanded: Set<string> }): number {
  const reached = new Set<string>();
  for (const trail of walk.frontier.values()) {
    for (const hiddenId of trail) reached.add(hiddenId);
  }
  return walk.expanded.size - reached.size;
}

/**
 * Collapses a graph's hidden nodes (see filterStore) out of the layout
 * entirely: every hidden node is removed, and each surviving node's
 * blockers are re-derived by walking back through any run of hidden
 * predecessors to the nearest *visible* one(s) — turning "A blocks
 * H1 blocks H2 blocks B" (H1/H2 hidden) into a single A -> B bridge
 * carrying hiddenCount 2, in addition to A/B's own ordinary edges to
 * other visible nodes staying exactly as they were (hiddenCount 0).
 *
 * Both edge encodings ("blocks" and "depends_on") are normalized into a
 * single blocker -> blocked direction first, mirroring arrangeNodes' own
 * normalization in layout.ts — every bridge this returns is already in
 * that same blocker -> blocked order, so a caller can treat all of them
 * uniformly as "blocks" edges regardless of how the original ones were
 * encoded.
 *
 * A hidden node reached via more than one path to the same visible
 * ancestor is only ever counted once for that bridge (the accumulated
 * hidden-id set is deduped, not summed per-path) — the badge means "this
 * many distinct items are hidden between these two tiles," not "this many
 * hidden edges."
 *
 * Also returns danglingCounts (see DanglingCounts) for every visible node
 * that has at least one hidden neighbor run with no visible far end to
 * bridge to.
 */
export function collapseHiddenNodes(
  nodeIds: string[],
  edges: CollapseEdge[],
  hiddenIds: ReadonlySet<string>
): { visibleNodeIds: string[]; bridgeEdges: BridgeEdge[]; danglingCounts: Map<string, DanglingCounts> } {
  const visibleNodeIds = nodeIds.filter((id) => !hiddenIds.has(id));

  const blockedBy = new Map<string, string[]>();
  const blocks = new Map<string, string[]>();
  for (const id of nodeIds) {
    blockedBy.set(id, []);
    blocks.set(id, []);
  }
  for (const e of edges) {
    const blockerId = e.relationshipType === "blocks" ? e.source : e.relationshipType === "depends_on" ? e.target : null;
    const blockedId = e.relationshipType === "blocks" ? e.target : e.relationshipType === "depends_on" ? e.source : null;
    if (blockerId === null || blockedId === null) continue;
    blockedBy.get(blockedId)?.push(blockerId);
    blocks.get(blockerId)?.push(blockedId);
  }

  const bridgeEdges: BridgeEdge[] = [];
  const danglingCounts = new Map<string, DanglingCounts>();

  for (const targetId of visibleNodeIds) {
    const upstreamWalk = walkHiddenRun(targetId, blockedBy, hiddenIds);
    for (const [blockerId, hiddenTrail] of upstreamWalk.frontier) {
      bridgeEdges.push({ source: blockerId, target: targetId, hiddenCount: hiddenTrail.size });
    }

    const downstreamWalk = walkHiddenRun(targetId, blocks, hiddenIds);

    const upstream = danglingCount(upstreamWalk);
    const downstream = danglingCount(downstreamWalk);
    if (upstream > 0 || downstream > 0) danglingCounts.set(targetId, { upstream, downstream });
  }

  return { visibleNodeIds, bridgeEdges, danglingCounts };
}
