import type { RelationshipType } from "@independance/shared";

/** One square of the canvas's dot background grid (see BackgroundVariant.Dots gap in GraphCanvas). */
export const DOT_GRID_SIZE = 20;
/** Horizontal edge-to-edge gap enforced between columns: 4.5 dot-grid squares. */
export const TILE_GAP = DOT_GRID_SIZE * 4.5;
/** Vertical edge-to-edge gap enforced between rows — independently tunable from TILE_GAP. */
export const ROW_GAP = 45;

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 90;

/** Column (main-axis) spacing — exported so manual-mode dragging (see GraphCanvas's snapGrid) can snap to the exact same grid this file lays tiles out on. */
export const MAIN_STEP = DEFAULT_NODE_WIDTH + TILE_GAP;
/**
 * Row (cross-axis) spacing — mirrors how MAIN_STEP is built: tile height
 * plus a real edge-to-edge gap, so "the minimum vertical distance" means
 * actual visible space between two stacked tiles, not distance between
 * their top-left corners (which, for a 90px-tall tile, would put their
 * edges flush against each other with no gap at all once the gap reached
 * 0). Uses ROW_GAP rather than TILE_GAP since the two axes' minimum gaps
 * have been tuned independently.
 */
export const CROSS_STEP = DEFAULT_NODE_HEIGHT + ROW_GAP;

interface LayoutEdge {
  source: string;
  target: string;
  data?: { relationshipType: RelationshipType };
}

/**
 * Assigns every tile a position on the map, per this fixed rule set:
 *
 *  1. Columns (the "main axis") are a fixed MAIN_STEP apart. A tile that
 *     blocks others but isn't blocked by anything itself sits in column 0;
 *     everything else lands one column past the deepest column among
 *     whatever blocks it (longest-path layering), so a chain reads left to
 *     right in blocking order. Columns are never collapsed to close up a
 *     gap — a chain that only needs 2 columns doesn't get stretched or
 *     squeezed to line up with a longer one elsewhere on the map.
 *
 *  2. Rows (the "cross axis") are a fixed CROSS_STEP apart, enforced as a
 *     hard minimum between any two tiles sharing a column — tiles never
 *     overlap.
 *
 *  3. A tile's row is the average of its blockers' rows. A tile with
 *     exactly one blocker therefore inherits that blocker's row exactly —
 *     a plain chain reads as a perfectly straight horizontal line, never
 *     bent to make room for anything else. A tile with several blockers
 *     centers on their average, which can land it between two rows rather
 *     than on either one (e.g. two blockers one row apart average out to
 *     the point exactly between them).
 *
 *     This is a single left-to-right pass, column by column, so a tile's
 *     row only ever depends on tiles already finalized in an earlier
 *     column — nothing downstream of a tile is ever allowed to pull it off
 *     the row its own blockers already settled, which is what keeps a
 *     straight run of tiles straight no matter what merges or branches
 *     several columns later.
 *
 *  4. Within a column, a spacing conflict (two tiles whose ideal rows land
 *     less than one CROSS_STEP apart) is resolved by chain length: the
 *     tile belonging to the longer chain of links (counting every tile
 *     reachable from it by following blocker/blocked links in either
 *     direction) keeps its exact ideal row, and the shorter one is pushed
 *     down just far enough to clear — down specifically, never up, since
 *     the canvas has no lower bound and there's always room that way.
 *     Ties in length fall back to whichever ideal row is lower (so the
 *     visual order still reads top to bottom), then to id for full
 *     determinism. Never symmetric.
 *
 *  5. Leftmost-column (dependency-free) tiles are a special case, since
 *     step 3's "average of blockers" has nothing to average for them —
 *     they get an even, arbitrary starting row instead. Once every other
 *     column has settled, any leftmost tile that branches into two or more
 *     chains re-centers on the average row of what it blocks (mirroring
 *     step 3 for the one place a tile's links run rightward instead of
 *     leftward), inserting around whatever's already there without ever
 *     displacing it. A leftmost tile with zero or exactly one thing it
 *     blocks is left untouched instead of being run through this "average
 *     of one value" no-op — if that one child is itself a merge point
 *     further down the line, its row isn't pure inheritance from this tile
 *     anymore, and re-centering onto it could collide with an unrelated
 *     neighbor and drag a genuine single-file chain (step 3, which takes
 *     priority) off its line to make room. So only real branch points ever
 *     move here, and they only ever nudge themselves to fit, never the
 *     single-child tiles they land near.
 *
 *     This step runs once, last, after every column is otherwise finished —
 *     it never ripples forward into a second pass over column 1+. In the
 *     rare case where a branch point is *also* one of several blockers
 *     feeding a downstream merge tile (step 3), that merge tile's average
 *     is computed from the branch point's pre-recenter row, not its final
 *     one. The alternative (re-running step 3 after a recenter) was tried
 *     and reverted: it can turn a root and its own single-blocker children
 *     into a circular disagreement, each side averaging against the
 *     other's now-stale position with nothing pinning either one down.
 *     Left as a known, deliberate trade-off.
 *
 * Deterministic and idempotent — the same graph always produces the same
 * positions, so callers can diff against current positions and only persist
 * what actually moved.
 *
 * `currentPositions` is the layout as of the last time this ran (omitted or
 * empty for a first-ever layout, e.g. a graph with nothing positioned yet).
 * When it's supplied, every node it already has an entry for keeps that
 * exact position — steps 3-5 above are skipped entirely in favor of an
 * incremental placement that only ever decides where *new* nodes (the ones
 * missing from `currentPositions`, or whose stored column no longer matches
 * where the current graph shape puts them — e.g. a tile that used to be two
 * hops from its nearest blocker and now, after some other tile was deleted
 * and this file bridged around it, is one hop away) go, nudging aside the
 * minimum number of already-placed neighbors needed to fit them in without
 * overlapping. Existing structure only ever moves here as a direct,
 * minimum-necessary consequence of making room for something new next to
 * it, or of the graph's own shape having changed underneath it.
 *
 * `resnapOrder` is for the manual-to-auto placement switch: tiles just
 * dragged freely by hand have no relationship between their row and their
 * column (a manually-placed tile's x doesn't necessarily match its
 * structural column at all), so treating them as already-pinned the way the
 * incremental path above does would leave them wherever they were dropped,
 * overlaps and all. `resnapOrder` instead uses `currentPositions` only as
 * an *ordering* hint (each column's tiles are sorted top-to-bottom by
 * whatever row they were last dragged to, so a deliberate manual ordering
 * survives the resnap) and then fully recomputes every coordinate through
 * the same rules a first-ever layout uses.
 *
 * Rule 6 (chain length) governs collisions *within* a connected group of
 * tiles, but says nothing about how two entirely *unconnected* groups
 * relate to each other — nothing links them, so nothing about steps 1-5
 * ever forces them apart or keeps them clear of each other's lines. A
 * fresh layout or resnap (never incremental — see below) handles that
 * separately, one connected group at a time: every weakly-connected group
 * (blocks/depends_on reachability, no direction) is laid out independently
 * by steps 1-5 above, then the groups are stacked vertically in their own
 * dedicated band, largest (most tiles) first, smallest last, with a full
 * empty row between one group's bottom and the next group's top — so two
 * unrelated dependency lines can never cross, and which one reads "first"
 * is always the same regardless of where its tiles happen to sit
 * structurally. Ties in size fall back to whichever group's lowest tile id
 * sorts first, for determinism.
 */
export function arrangeNodes(
  nodeIds: string[],
  edges: LayoutEdge[],
  currentPositions: Map<string, { x: number; y: number }> = new Map(),
  options: { resnapOrder?: boolean } = {}
): Map<string, { x: number; y: number }> {
  if (currentPositions.size > 0 && !options.resnapOrder) {
    // Incremental placement never regroups or restacks — every existing
    // tile must stay exactly where it was (see the doc above), which
    // group-stacking can't promise: a newly-added edge between two
    // previously-separate groups would merge them, and restacking the
    // merged result would move tiles that this mode guarantees never move.
    return arrangeGroup(nodeIds, edges, currentPositions, options);
  }

  // A group of one — a tile with no dependency edges at all — has no chain
  // to protect from crossing anything, so giving each one its own dedicated
  // band would just scatter every unrelated standalone task across the map
  // with a big gap after each one. They're folded back into a single
  // trailing band instead (ordinary CROSS_STEP spacing among themselves,
  // via the same rankCross column-0 rule step 5 always used) — trivially
  // "the fewest dependencies," so it's correct for this band to sort last
  // even though it isn't really one connected group.
  const rawGroups = groupByConnectivity(nodeIds, edges);
  const multiGroups = rawGroups.filter((g) => g.length > 1);
  const singletonIds = rawGroups.filter((g) => g.length === 1).flat();
  multiGroups.sort((a, b) => b.length - a.length || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const groups = singletonIds.length > 0 ? [...multiGroups, singletonIds] : multiGroups;

  const positions = new Map<string, { x: number; y: number }>();
  let nextTop: number | null = null;
  for (const groupIds of groups) {
    const groupIdSet = new Set(groupIds);
    const groupEdges = edges.filter((e) => groupIdSet.has(e.source) && groupIdSet.has(e.target));
    const groupCurrentPositions = new Map(
      [...currentPositions].filter(([id]) => groupIdSet.has(id))
    );
    const local = arrangeGroup(groupIds, groupEdges, groupCurrentPositions, options);

    let minY = Infinity;
    // The *row's own top*, not its bottom edge (pos.y + DEFAULT_NODE_HEIGHT)
    // — every other row-to-row gap in this file is a fixed CROSS_STEP measured
    // top-to-top, so computing this one the same way is what makes "+2 *
    // CROSS_STEP" actually mean "skip exactly one empty row" (one CROSS_STEP
    // to reach where the very next row would normally go, one more to leave
    // it empty). Measuring from the bottom edge instead double-counted the
    // tile's own height on top of that, leaving a gap that read as two empty
    // rows instead of one.
    let maxRowTop = -Infinity;
    for (const pos of local.values()) {
      minY = Math.min(minY, pos.y);
      maxRowTop = Math.max(maxRowTop, pos.y);
    }
    const shift: number = nextTop === null ? 0 : nextTop - minY;
    for (const [id, pos] of local) positions.set(id, { x: pos.x, y: pos.y + shift });
    nextTop = maxRowTop + shift + 2 * CROSS_STEP;
  }
  return positions;
}

/**
 * Partitions `nodeIds` into weakly-connected groups over blocks/depends_on
 * edges only — undirected (a group is "everything reachable by following
 * either kind of link in either direction"), unlike blockedBy/blocks above
 * which are single-direction and drive column assignment. A node with no
 * dependency edges at all is its own group of one. relates_to/remediates
 * edges don't count, same as everywhere else this app reasons about
 * dependency structure specifically.
 */
function groupByConnectivity(nodeIds: string[], edges: LayoutEdge[]): string[][] {
  const neighbors = new Map<string, string[]>();
  for (const id of nodeIds) neighbors.set(id, []);
  for (const edge of edges) {
    const relationshipType = edge.data?.relationshipType;
    if (relationshipType !== "blocks" && relationshipType !== "depends_on") continue;
    neighbors.get(edge.source)?.push(edge.target);
    neighbors.get(edge.target)?.push(edge.source);
  }

  const visited = new Set<string>();
  const groups: string[][] = [];
  for (const start of nodeIds) {
    if (visited.has(start)) continue;
    const group: string[] = [];
    const stack = [start];
    visited.add(start);
    while (stack.length > 0) {
      const current = stack.pop()!;
      group.push(current);
      for (const neighborId of neighbors.get(current) ?? []) {
        if (!visited.has(neighborId)) {
          visited.add(neighborId);
          stack.push(neighborId);
        }
      }
    }
    groups.push(group.sort());
  }
  return groups;
}

function arrangeGroup(
  nodeIds: string[],
  edges: LayoutEdge[],
  currentPositions: Map<string, { x: number; y: number }>,
  options: { resnapOrder?: boolean }
): Map<string, { x: number; y: number }> {
  // Normalize both edge encodings into a single blocker -> blocked
  // direction (mirrors blockingPair in edgeService.ts / useNodeRelationships).
  const blockedBy = new Map<string, Set<string>>();
  const blocks = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    blockedBy.set(id, new Set());
    blocks.set(id, new Set());
  }
  for (const edge of edges) {
    const relationshipType = edge.data?.relationshipType;
    const blockerId =
      relationshipType === "blocks" ? edge.source : relationshipType === "depends_on" ? edge.target : null;
    const blockedId =
      relationshipType === "blocks" ? edge.target : relationshipType === "depends_on" ? edge.source : null;
    if (blockerId === null || blockedId === null) continue;
    blockedBy.get(blockedId)?.add(blockerId);
    blocks.get(blockerId)?.add(blockedId);
  }

  // Longest-path layering: a tile's column is one past its deepest
  // blocker's column, so a blocker always lands in an earlier (further
  // left) column than whatever it blocks, and tiles that block others but
  // have no blockers of their own land in column 0. The app rejects edges
  // that would create a circular block, so this graph is acyclic and the
  // memoized recursion always terminates.
  const columnOf = new Map<string, number>();
  function columnFor(id: string, guard: Set<string>): number {
    const cached = columnOf.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    let column = 0;
    for (const blockerId of blockedBy.get(id) ?? []) {
      column = Math.max(column, columnFor(blockerId, guard) + 1);
    }
    guard.delete(id);
    columnOf.set(id, column);
    return column;
  }
  for (const id of nodeIds) columnFor(id, new Set());
  const maxColumn = nodeIds.reduce((max, id) => Math.max(max, columnOf.get(id) ?? 0), 0);

  const order = new Map<number, string[]>();
  const cross = new Map<string, number>();

  // Evenly-spaced fallback rank for a column-0 tile — the only tiles that
  // ever have nothing to average, since every tile in column 1+ has at
  // least one blocker by construction (that's what put it there).
  const rankCross = new Map<string, number>();
  function recomputeRankCross() {
    const ids = order.get(0);
    if (!ids) return;
    const offset = -((ids.length - 1) * CROSS_STEP) / 2;
    ids.forEach((id, i) => rankCross.set(id, offset + i * CROSS_STEP));
  }

  // Rule 6's tie-break: when two tiles land close enough in the same column
  // to require pushing one of them, the one belonging to the longer chain
  // of links keeps its exact ideal row, and the other is the one that
  // shifts. "Length" is ancestor count plus descendant count, computed as
  // two *separate* direction-restricted walks — never a single walk that
  // follows both blocker and blocked links from the same visited set. That
  // matters: a single bidirectional walk started from any tile in a
  // connected graph eventually reaches every other tile in it (that's what
  // "connected" means), so it degenerates into pure component size and
  // ties every tile in the same component together — which silently
  // defeats this whole tie-break, since two competing tiles are almost
  // always in the same component (this exact bug shipped once already —
  // see the regression test below for the real shape that exposed it).
  // Summing two independent one-directional counts instead means a tile's
  // score reflects only the chain actually running through it, not
  // everything its component happens to also contain off to the side.
  const ancestorCount = new Map<string, number>();
  function countAncestors(id: string, guard: Set<string>): number {
    const cached = ancestorCount.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    let count = 0;
    for (const blockerId of blockedBy.get(id) ?? []) count += 1 + countAncestors(blockerId, guard);
    guard.delete(id);
    ancestorCount.set(id, count);
    return count;
  }

  const descendantCount = new Map<string, number>();
  function countDescendants(id: string, guard: Set<string>): number {
    const cached = descendantCount.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    let count = 0;
    for (const childId of blocks.get(id) ?? []) count += 1 + countDescendants(childId, guard);
    guard.delete(id);
    descendantCount.set(id, count);
    return count;
  }

  function computeChainLength(id: string): number {
    return countAncestors(id, new Set()) + countDescendants(id, new Set());
  }
  for (const id of nodeIds) computeChainLength(id);

  // Rule 8 (experimental): two edges that span the exact same pair of
  // columns cross each other if and only if their row order flips between
  // the two ends — one starts above the other but ends below it, or vice
  // versa. That's a much cheaper test than real bezier-path intersection,
  // and it's exactly the shape this app's edges actually have (a straight
  // run between two adjacent-ish columns), so it catches the case that
  // matters: a tile pushed down past someone else's row drags its own
  // connecting line across that tile's horizontal edge to whatever's next
  // to it. Only compares edges whose *starting* column matches (an edge
  // from three columns back isn't "the same line" as one from one column
  // back, even if both happen to end in this column) — long edges spanning
  // more than one column are intentionally out of scope here, same as the
  // rest of this function.
  function countCrossings(id: string, candidateRow: number, others: string[]): number {
    let crossings = 0;
    for (const blockerId of blockedBy.get(id) ?? []) {
      const blockerRow = cross.get(blockerId);
      if (blockerRow === undefined) continue;
      const blockerColumn = columnOf.get(blockerId) ?? -1;
      for (const otherId of others) {
        if (otherId === id) continue;
        const otherRow = cross.get(otherId);
        if (otherRow === undefined) continue;
        for (const otherBlockerId of blockedBy.get(otherId) ?? []) {
          if ((columnOf.get(otherBlockerId) ?? -2) !== blockerColumn) continue;
          const otherBlockerRow = cross.get(otherBlockerId);
          if (otherBlockerRow === undefined) continue;
          const startDelta = blockerRow - otherBlockerRow;
          const endDelta = candidateRow - otherRow;
          if (startDelta !== 0 && endDelta !== 0 && startDelta > 0 !== endDelta > 0) crossings++;
        }
      }
    }
    return crossings;
  }

  // Places `column`'s tiles by processing them in priority order (longer
  // chain first, ties broken by ideal row, then id, for full determinism):
  // each tile takes its own exact `idealOf` row unless that would land it
  // within CROSS_STEP of a higher-priority tile already placed, in which
  // case it's pushed down just far enough to clear (walking past further
  // obstacles if still too close) — obstacles already placed never move,
  // only the tile currently being inserted does. Since higher-priority
  // tiles are always inserted first, a lower-priority tile can only ever
  // be the one displaced by a conflict, never the cause of one. Shared by
  // the main left-to-right pass and the column-0 re-centering step below.
  function placeColumn(column: number, idealOf: (id: string) => number, priorityOf: (id: string) => number) {
    const ids = order.get(column);
    if (!ids) return;
    const ideal = new Map(ids.map((id) => [id, idealOf(id)]));
    const priority = new Map(ids.map((id) => [id, priorityOf(id)]));
    const processOrder = [...ids].sort(
      (a, b) => priority.get(b)! - priority.get(a)! || ideal.get(a)! - ideal.get(b)! || (a < b ? -1 : a > b ? 1 : 0)
    );
    const placed: string[] = [];
    for (const id of processOrder) {
      const target = ideal.get(id)!;
      let index = 0;
      while (index < placed.length && (cross.get(placed[index]) ?? 0) <= target) index++;
      // Captured before the cascade loop below can walk `index` further
      // down chasing a chain of collisions — this is the tile it originally
      // tied/collided with, which is what "the row above" means relative
      // to (not wherever the cascade eventually landed two or three
      // obstacles later).
      const naturalIndex = index;
      let value = target;
      for (;;) {
        if (index > 0) {
          const minAllowed = (cross.get(placed[index - 1]) ?? 0) + CROSS_STEP;
          if (value < minAllowed) value = minAllowed;
        }
        if (index < placed.length && (cross.get(placed[index]) ?? 0) - value < CROSS_STEP) {
          index++;
          continue;
        }
        break;
      }

      // Being pushed off its own ideal row to resolve a collision — before
      // settling for "below" (the default direction), check whether
      // slotting in *above* the tile it originally collided with instead
      // would cross fewer of the edges already committed in this column.
      // Only tried when there's room above to fit without violating the
      // same min-gap rule everything else follows.
      if (value !== target && naturalIndex > 0) {
        const aboveIndex = naturalIndex - 1;
        const ceiling = (cross.get(placed[aboveIndex]) ?? 0) - CROSS_STEP;
        const floor = aboveIndex > 0 ? (cross.get(placed[aboveIndex - 1]) ?? 0) + CROSS_STEP : -Infinity;
        if (ceiling >= floor) {
          const aboveValue = Math.max(floor, Math.min(target, ceiling));
          const belowCrossings = countCrossings(id, value, placed);
          const aboveCrossings = countCrossings(id, aboveValue, placed);
          if (aboveCrossings < belowCrossings) {
            value = aboveValue;
            index = aboveIndex;
          }
        }
      }

      cross.set(id, value);
      placed.splice(index, 0, id);
    }
    order.set(column, placed);
  }

  function idealFromBlockers(id: string): number {
    const blockerIds = blockedBy.get(id) ?? new Set();
    if (blockerIds.size === 0) return rankCross.get(id) ?? 0;
    let sum = 0;
    for (const blockerId of blockerIds) sum += cross.get(blockerId) ?? 0;
    return sum / blockerIds.size;
  }

  function runForwardPass() {
    recomputeRankCross();
    for (let column = 0; column <= maxColumn; column++) placeColumn(column, idealFromBlockers, computeChainLength);
  }

  // Rule 6's "links to the right" case: a column-0 tile that branches into
  // two or more chains re-centers on the average row of what it blocks,
  // now that every later column has settled. Only tiles with 2+ direct
  // children are ever moved here — a tile with exactly one child is
  // deliberately left untouched even though "average of one value" would
  // be a no-op *in isolation*, because when that one child is itself a
  // merge point (several blockers, not just this tile), its row isn't
  // pure inheritance from this tile anymore, and re-centering onto it
  // could push this tile into a collision with some unrelated neighbor —
  // which, if this tile is anchoring a genuine single-file chain (rule 4),
  // would drag that whole chain off its line to make room. Rule 4's
  // straightness takes priority, so single-child tiles are treated as
  // fixed obstacles here, never as something to move or to be displaced by
  // a neighbor's re-centering.
  function recenterLeftColumn() {
    const ids = order.get(0);
    if (!ids) return;
    const fixed = ids.filter((id) => (blocks.get(id) ?? new Set()).size < 2);
    const branching = ids.filter((id) => (blocks.get(id) ?? new Set()).size >= 2);

    const obstacles = fixed.sort((a, b) => (cross.get(a) ?? 0) - (cross.get(b) ?? 0));
    const sortedBranching = branching
      .map((id) => {
        const childIds = blocks.get(id)!;
        let sum = 0;
        for (const childId of childIds) sum += cross.get(childId) ?? 0;
        return { id, ideal: sum / childIds.size };
      })
      // Rule 6 among the branch points themselves too: the one with the
      // longer chain claims its exact ideal first.
      .sort(
        (a, b) => computeChainLength(b.id) - computeChainLength(a.id) || a.ideal - b.ideal || (a.id < b.id ? -1 : 1)
      );

    // Same walk-forward insertion the incremental branch below uses: find
    // where `ideal` sorts in among the fixed obstacles (plus any branching
    // tile already placed this pass), then push down just far enough to
    // clear whatever's immediately above and keep walking while still too
    // close to what's next — obstacles never move, only the tile being
    // inserted does.
    for (const { id, ideal } of sortedBranching) {
      let index = 0;
      while (index < obstacles.length && (cross.get(obstacles[index]) ?? 0) <= ideal) index++;
      let placedCross = ideal;
      for (;;) {
        if (index > 0) {
          const minAllowed = (cross.get(obstacles[index - 1]) ?? 0) + CROSS_STEP;
          if (placedCross < minAllowed) placedCross = minAllowed;
        }
        if (index < obstacles.length && (cross.get(obstacles[index]) ?? 0) - placedCross < CROSS_STEP) {
          index++;
          continue;
        }
        break;
      }
      cross.set(id, placedCross);
      obstacles.splice(index, 0, id);
    }

    order.set(0, obstacles);
  }

  if (options.resnapOrder) {
    // Seed each column's order from the current (e.g. just hand-dragged)
    // row alone, ignoring whatever column it's currently in — a
    // manually-placed tile's x carries no structural meaning. Any node
    // with no current position sorts after everything that has one.
    for (const id of nodeIds) {
      const column = columnOf.get(id) ?? 0;
      const list = order.get(column);
      if (list) list.push(id);
      else order.set(column, [id]);
    }
    for (const ids of order.values()) {
      ids.sort((a, b) => {
        const ay = currentPositions.get(a)?.y;
        const by = currentPositions.get(b)?.y;
        if (ay !== undefined && by !== undefined) return ay - by;
        if (ay !== undefined) return -1;
        if (by !== undefined) return 1;
        return a < b ? -1 : a > b ? 1 : 0;
      });
    }
    runForwardPass();
    recenterLeftColumn();
  } else if (currentPositions.size === 0) {
    // Fresh layout — seed order alphabetically (arbitrary but deterministic).
    for (const id of nodeIds) {
      const column = columnOf.get(id) ?? 0;
      const list = order.get(column);
      if (list) list.push(id);
      else order.set(column, [id]);
    }
    for (const list of order.values()) list.sort();
    runForwardPass();
    recenterLeftColumn();
  } else {
    // Incremental placement: every node already in `currentPositions` keeps
    // that exact row, so nothing about the existing map can shift just
    // because something new was added elsewhere. Each column's already-
    // placed nodes keep their current relative order too (derived from
    // their current row, not recomputed) — only nodes with no prior
    // position (genuinely new since the last layout) get placed, inserted
    // at the row their own blockers imply and, if that would overlap an
    // already-placed neighbor, nudging just that neighbor (and, minimally,
    // whoever is next in line past it) aside.
    //
    // A stored position is only trustworthy as-is if this node is still in
    // the same column it was in last time — e.g. deleting a tile can
    // shorten the path between two of its former neighbors (the app
    // bridges around a deleted mid-chain tile with a direct edge), moving
    // one of them a column closer. Such a node is treated as new below
    // (placed fresh, with the usual nudge protection) rather than trusted
    // to already be conflict-free where it's landing now — this is what
    // makes a deletion's neighbors readjust to the rules.
    function isPinned(id: string): boolean {
      const pos = currentPositions.get(id);
      if (!pos) return false;
      return Math.round(pos.x / MAIN_STEP) === (columnOf.get(id) ?? 0);
    }

    for (let column = 0; column <= maxColumn; column++) {
      const idsInColumn = nodeIds.filter((id) => (columnOf.get(id) ?? 0) === column);
      if (idsInColumn.length === 0) continue;

      const existingIds = idsInColumn
        .filter((id) => isPinned(id))
        .sort((a, b) => currentPositions.get(a)!.y - currentPositions.get(b)!.y);
      for (const id of existingIds) cross.set(id, currentPositions.get(id)!.y);
      const columnOrder = [...existingIds];

      // Rule 6: if this batch is inserting more than one new tile into the
      // same column, the longer chain claims its exact ideal first — same
      // priority order placeColumn uses above.
      const newIds = idsInColumn
        .filter((id) => !isPinned(id))
        .sort((a, b) => computeChainLength(b) - computeChainLength(a) || (a < b ? -1 : a > b ? 1 : 0));

      for (const id of newIds) {
        const blockerIds = blockedBy.get(id) ?? new Set();
        let ideal: number;
        if (blockerIds.size === 0) {
          // No blockers to anchor a brand new leftmost tile — append it
          // below whatever else already occupies this column instead of
          // guessing a spot in the middle of existing structure.
          const placed = columnOrder.map((existingId) => cross.get(existingId) ?? 0);
          ideal = placed.length > 0 ? Math.max(...placed) + CROSS_STEP : 0;
        } else {
          let sum = 0;
          for (const blockerId of blockerIds) sum += cross.get(blockerId) ?? 0;
          ideal = sum / blockerIds.size;
        }

        // Find where `ideal` sorts into what's already here. Ties insert
        // *after* (below) the existing entry — e.g. a second child added to
        // a tile that already has one child inherits the exact same ideal
        // row as that first child, and the new arrival is always the one
        // that has to give way, never the tile that got there first.
        let index = 0;
        while (index < columnOrder.length && (cross.get(columnOrder[index]) ?? 0) <= ideal) index++;

        // Nothing already in columnOrder ever moves to make room for a
        // later insertion; only the tile being inserted right now is free
        // to move off its own computed ideal. Clamp it down past whatever's
        // immediately above if it's too close, then keep walking forward
        // while it's still too close to whatever comes next — each step can
        // only raise the required minimum further, so this always
        // terminates.
        let placedCross = ideal;
        for (;;) {
          if (index > 0) {
            const minAllowed = (cross.get(columnOrder[index - 1]) ?? 0) + CROSS_STEP;
            if (placedCross < minAllowed) placedCross = minAllowed;
          }
          if (index < columnOrder.length && (cross.get(columnOrder[index]) ?? 0) - placedCross < CROSS_STEP) {
            index++;
            continue;
          }
          break;
        }

        cross.set(id, placedCross);
        columnOrder.splice(index, 0, id);
      }

      order.set(column, columnOrder);
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    positions.set(id, { x: (columnOf.get(id) ?? 0) * MAIN_STEP, y: cross.get(id) ?? 0 });
  }
  return positions;
}
