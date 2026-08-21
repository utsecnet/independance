import type { RelationshipType } from "@independance/shared";

export interface ChainEdge {
  id: string;
  source: string;
  target: string;
  relationshipType: RelationshipType;
}

export interface DependencyChain {
  nodeIds: Set<string>;
  edgeIds: Set<string>;
}

/**
 * `nodeId`'s full ancestor lineage (everything that blocks it, and
 * everything that blocks *those*, arbitrarily far back) plus its full
 * descendant lineage (everything it blocks, transitively forward) — the
 * straight line of dependencies running through this one tile — plus the
 * edges that connect them. Used to highlight "the chain this tile sits on"
 * (see GraphCanvas's selection-driven focus mode).
 *
 * Deliberately two *directed* walks (mirroring blockedBy/blocks in
 * layout.ts), not one undirected walk over "any connected edge": an
 * undirected walk starting from a leaf with siblings (e.g. a blocks both b
 * and d) would climb up to the shared parent and then back down every
 * *other* branch too, pulling in tiles that are neither an ancestor nor a
 * descendant of the one actually selected — cousins by way of a shared
 * ancestor, not part of its own line. Walking blockedBy and blocks
 * separately, each strictly in its own direction, never crosses into a
 * sibling's own subtree. relates_to/remediates edges don't count as
 * "dependencies" and are excluded, same as everywhere else in this app
 * that reasons about dependency chains specifically.
 */
export function collectDependencyChain(nodeId: string, edges: ChainEdge[]): DependencyChain {
  const blockedBy = new Map<string, { neighborId: string; edgeId: string }[]>();
  const blocks = new Map<string, { neighborId: string; edgeId: string }[]>();
  function link(map: Map<string, { neighborId: string; edgeId: string }[]>, a: string, b: string, edgeId: string) {
    const list = map.get(a);
    const entry = { neighborId: b, edgeId };
    if (list) list.push(entry);
    else map.set(a, [entry]);
  }
  for (const e of edges) {
    const relationshipType = e.relationshipType;
    const blockerId = relationshipType === "blocks" ? e.source : relationshipType === "depends_on" ? e.target : null;
    const blockedId = relationshipType === "blocks" ? e.target : relationshipType === "depends_on" ? e.source : null;
    if (blockerId === null || blockedId === null) continue;
    link(blockedBy, blockedId, blockerId, e.id);
    link(blocks, blockerId, blockedId, e.id);
  }

  const nodeIds = new Set<string>([nodeId]);
  const edgeIds = new Set<string>();
  function walk(map: Map<string, { neighborId: string; edgeId: string }[]>) {
    const queue = [nodeId];
    while (queue.length > 0) {
      const current = queue.pop()!;
      for (const { neighborId, edgeId } of map.get(current) ?? []) {
        edgeIds.add(edgeId);
        if (!nodeIds.has(neighborId)) {
          nodeIds.add(neighborId);
          queue.push(neighborId);
        }
      }
    }
  }
  walk(blockedBy);
  walk(blocks);

  return { nodeIds, edgeIds };
}
