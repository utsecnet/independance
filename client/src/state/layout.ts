import type { RelationshipType } from "@independance/shared";

/** One square of the canvas's dot background grid (see BackgroundVariant.Dots gap in GraphCanvas). */
export const DOT_GRID_SIZE = 20;
/** Standard edge-to-edge gap enforced between every pair of tiles: three dot-grid squares. */
export const TILE_GAP = DOT_GRID_SIZE * 3;

export const DEFAULT_NODE_WIDTH = 180;
export const DEFAULT_NODE_HEIGHT = 90;

/** Column (main-axis) spacing — exported so manual-mode dragging (see GraphCanvas's snapGrid) can snap to the exact same grid this file lays tiles out on. */
export const MAIN_STEP = DEFAULT_NODE_WIDTH + TILE_GAP;
/** Row (cross-axis) spacing — exported for the same reason as MAIN_STEP, plus callers (e.g. the store's manual-mode placement fallback) that need to space a new tile the same way this file does. */
export const CROSS_STEP = DEFAULT_NODE_HEIGHT + TILE_GAP;

// Alternating barycenter sweeps for phase 1 (ordering) — a fixed count so
// the result stays deterministic regardless of graph shape.
const ORDERING_SWEEPS = 6;

interface LayoutEdge {
  source: string;
  target: string;
  data?: { relationshipType: RelationshipType };
}

/**
 * Least-squares projection of `values` onto the nearest non-decreasing
 * sequence (the standard pool-adjacent-violators algorithm, unweighted —
 * every input treated as equally free to move). Used below to resolve
 * spacing symmetrically *within* one priority level, where there's no
 * reason to prefer one tile over another.
 */
function isotonicRegression(values: number[]): number[] {
  const blockValue: number[] = [];
  const blockCount: number[] = [];
  for (const raw of values) {
    let value = raw;
    let count = 1;
    while (blockValue.length > 0 && blockValue[blockValue.length - 1] > value) {
      const prevValue = blockValue.pop()!;
      const prevCount = blockCount.pop()!;
      value = (value * count + prevValue * prevCount) / (count + prevCount);
      count += prevCount;
    }
    blockValue.push(value);
    blockCount.push(count);
  }
  const result: number[] = [];
  for (let i = 0; i < blockValue.length; i++) {
    for (let j = 0; j < blockCount[i]; j++) result.push(blockValue[i]);
  }
  return result;
}

/**
 * Adjusts one tier's ideal cross-axis positions to respect `orderedIds`'
 * existing order and a minimum CROSS_STEP gap, using strict priority
 * *levels* rather than a single weighted average: tiles are resolved one
 * priority level at a time, highest first. Within a level, tied tiles
 * split the difference symmetrically among themselves (there's no reason
 * to prefer one over another when their priority is equal) via ordinary
 * isotonic regression — then the whole level is shifted just enough, as a
 * block, to clear whatever an earlier (higher-priority) level already
 * fixed in place, never the other way around.
 *
 * A single weighted average (an earlier version of this) broke the moment
 * *both* sides of a conflict carried some real priority rather than one
 * real chain vs. one dead end — it still split the difference in
 * proportion to how close the two priorities happened to be, dragging an
 * already-load-bearing chain off its own row by a large amount just
 * because an unrelated tile sharing its column also happened to lead
 * somewhere. Resolving by level keeps that from ever happening: only
 * which level is *higher* matters, never by how much.
 */
function resolveTierSpacing(
  orderedIds: string[],
  ideal: Map<string, number>,
  priority: Map<string, number>
): Map<string, number> {
  const n = orderedIds.length;
  const priorityOf = orderedIds.map((id) => priority.get(id) ?? 0);
  const levels = Array.from(new Set(priorityOf)).sort((a, b) => b - a);

  const placed: (number | null)[] = new Array(n).fill(null);

  for (const level of levels) {
    const groupIndices: number[] = [];
    for (let i = 0; i < n; i++) if (priorityOf[i] === level) groupIndices.push(i);

    const shifted = groupIndices.map((i) => (ideal.get(orderedIds[i]) ?? 0) - i * CROSS_STEP);
    const resolved = isotonicRegression(shifted);
    let groupPos = groupIndices.map((i, k) => resolved[k] + i * CROSS_STEP);

    // Shift the whole group (preserving its own internal spacing) just
    // enough to clear the nearest already-placed tile on either side.
    const firstIndex = groupIndices[0];
    const lastIndex = groupIndices[groupIndices.length - 1];

    let minRequired = -Infinity;
    for (let j = firstIndex - 1; j >= 0; j--) {
      if (placed[j] !== null) {
        minRequired = placed[j]! + (firstIndex - j) * CROSS_STEP;
        break;
      }
    }
    let maxAllowed = Infinity;
    for (let j = lastIndex + 1; j < n; j++) {
      if (placed[j] !== null) {
        maxAllowed = placed[j]! - (j - lastIndex) * CROSS_STEP;
        break;
      }
    }

    let shift = 0;
    if (groupPos[0] < minRequired) shift = minRequired - groupPos[0];
    if (groupPos[groupPos.length - 1] + shift > maxAllowed) {
      shift = Math.min(shift, maxAllowed - groupPos[groupPos.length - 1]);
    }
    if (shift !== 0) groupPos = groupPos.map((p) => p + shift);

    groupIndices.forEach((i, k) => {
      placed[i] = groupPos[k];
    });
  }

  // The per-level shift above only clears the nearest already-placed
  // neighbor just *outside* this level's own index span — but a lower-
  // priority level's indices aren't necessarily contiguous with (or
  // outside) a higher-priority level's: reorderTiedSiblings routinely sorts
  // dead-end tiles to bookend a tied group's chain-continuing members
  // (pushed away on both sides), so a later, lower-priority pass can end up
  // with indices that straddle indices a higher-priority pass already
  // placed *in between* them — invisible to a check that only ever looks
  // just past the group's own two ends. Once every level has been
  // resolved, `placed` is in final top-to-bottom order regardless of which
  // level put each value there, so a single forward sweep enforcing the
  // minimum gap against whatever landed immediately before it catches
  // every such case a level's own local shift couldn't see. A no-op
  // wherever spacing was already fine, since it only ever pushes an entry
  // down to (never above) its predecessor plus one row.
  for (let i = 1; i < n; i++) {
    const minAllowed = placed[i - 1]! + CROSS_STEP;
    if (placed[i]! < minAllowed) placed[i] = minAllowed;
  }

  const result = new Map<string, number>();
  orderedIds.forEach((id, i) => result.set(id, placed[i]!));
  return result;
}

// Ties within a column (e.g. two tiles blocked by nothing but the same
// single tile) count as equal for this purpose if their ideal positions are
// within this many pixels of each other — comfortably tighter than any real
// distinct row, loose enough to absorb ordinary floating-point noise.
const TIE_EPSILON = 1e-6;

/**
 * Within one column's already-established order, re-sorts each run of
 * tied (near-identical ideal position) siblings so the lower-priority ones
 * end up pushed *away* from the rest of the graph rather than toward it.
 * resolveTierSpacing's weighting keeps a tied group's highest-priority
 * member essentially pinned to the shared ideal regardless of which side of
 * it the tied siblings fall on — so this is what decides *which* side a
 * dead-end tile lands on. Extending outward, away from `referenceCenter`
 * (the average row of everything already placed), keeps a tile that's only
 * connected to one already-established chain from being routed through the
 * middle of unrelated structure on the opposite side of that chain.
 */
function reorderTiedSiblings(
  orderedIds: string[],
  ideal: Map<string, number>,
  priority: Map<string, number>,
  referenceCenter: number
): string[] {
  const result: string[] = [];
  let i = 0;
  while (i < orderedIds.length) {
    let j = i + 1;
    while (j < orderedIds.length && Math.abs((ideal.get(orderedIds[j]) ?? 0) - (ideal.get(orderedIds[i]) ?? 0)) < TIE_EPSILON) {
      j++;
    }
    const group = orderedIds.slice(i, j);
    if (group.length > 1) {
      const groupIdeal = ideal.get(group[0]) ?? 0;
      // The group already sits above center: push low-priority members
      // further up (smaller index) so they extend away from center rather
      // than crossing toward it — and the reverse when it sits below.
      const pushUp = groupIdeal < referenceCenter;
      group.sort((a, b) => {
        const diff = (priority.get(a) ?? 0) - (priority.get(b) ?? 0);
        return pushUp ? diff : -diff;
      });
    }
    result.push(...group);
    i = j;
  }
  return result;
}

/**
 * Assigns every tile a position on the map. The map is horizontal-only:
 * tiles that block others but aren't blocked by anything themselves sit in
 * tier 0, the leftmost column; everything else lands one column to the
 * right of the deepest tier among whatever blocks it (longest-path
 * layering), so a chain reads left to right in blocking order. Column
 * spacing (the "main axis") is a fixed TILE_GAP between tile edges — the
 * standardized width the map always enforces, since dragging is disabled
 * and this is the only thing that ever sets position.
 *
 * Within and across columns, tiles are positioned in two phases:
 *  1. Ordering — each column's top-to-bottom order is chosen via alternating
 *     barycenter sweeps (Sugiyama-style) to minimize how often edges cross.
 *  2. Coordinates — each tile's row is set to the average row of whatever
 *     blocks it, computed in a single left-to-right pass (column by column)
 *     so a tile's row only ever depends on tiles already finalized in an
 *     earlier column — never the other way around. A tile with exactly one
 *     blocker inherits its row exactly (a plain chain is therefore *exactly*
 *     level, not just close), a tile with several blockers centers on their
 *     average, and a tile whose sole blocker fans out to several tiles ends
 *     up centered on it too — not by pulling the blocker off its own row,
 *     but because its fanned-out tiles all share that same target row and
 *     the minimum-gap spacing below spreads them symmetrically around it.
 *     Forward-only is what keeps a straight run of tiles straight even when
 *     something several columns later merges or branches — nothing a tile
 *     blocks is ever allowed to pull *it* off the row its own blockers
 *     already settled.
 *
 * Deterministic and idempotent — the same graph always produces the same
 * positions, so callers can diff against current positions and only persist
 * what actually moved.
 *
 * `currentPositions` is the layout as of the last time this ran (omitted or
 * empty for a first-ever layout, e.g. a graph with nothing positioned yet).
 * When it's supplied, every node it already has an entry for keeps that
 * exact position — phases 1 and 2 above are skipped entirely in favor of an
 * incremental placement that only ever decides where *new* nodes (the ones
 * missing from `currentPositions`) go, nudging aside the minimum number of
 * already-placed neighbors needed to fit them in without overlapping.
 * Without this, adding one new tile reruns the from-scratch
 * crossing-minimization sweep over the *entire* graph, which is free to
 * reorder any tier — including ones the new tile has nothing to do with —
 * since the heuristic has no notion of "already good enough, leave it."
 * That's what let adding a single leaf off of one tile shuffle an unrelated
 * chain halfway across the map even though nothing about that chain had
 * changed. Existing structure only ever moves here as a direct,
 * minimum-necessary consequence of making room for something new next to
 * it — never because the global heuristic decided a different arrangement
 * scores better.
 *
 * `resnapOrder` is for the manual-to-auto placement switch: tiles just
 * dragged freely by hand have no relationship between their row and their
 * column (a manually-placed tile's x doesn't necessarily match its
 * structural tier at all), so treating them as already-pinned the way the
 * incremental path above does would leave them wherever they were dropped,
 * overlaps and all — the opposite of what switching back to auto is for.
 * `resnapOrder` instead uses `currentPositions` only as an *ordering* hint
 * (each tier's tiles are sorted top-to-bottom by whatever row they were
 * last dragged to) and then fully recomputes every coordinate through the
 * same ideal + minimum-gap logic phase 2 uses for a first-ever layout —
 * "fix the tiles in place" in the sense of respecting the arrangement the
 * user was going for, not in the sense of leaving the raw pixels alone.
 */
export function arrangeNodes(
  nodeIds: string[],
  edges: LayoutEdge[],
  currentPositions: Map<string, { x: number; y: number }> = new Map(),
  options: { resnapOrder?: boolean } = {}
): Map<string, { x: number; y: number }> {
  // Normalize both edge encodings into a single blocker -> blocked
  // direction (mirrors blockingPair in edgeService.ts / useNodeRelationships),
  // tracked both ways: predecessors (what blocks this tile) drive tiering
  // and the forward ordering sweep, successors (what this tile blocks)
  // drive the backward sweep — and phase 2 centers on the union of both.
  const blockedBy = new Map<string, Set<string>>();
  const blocks = new Map<string, Set<string>>();
  for (const id of nodeIds) {
    blockedBy.set(id, new Set());
    blocks.set(id, new Set());
  }
  const blockerBlockedPairs: { blockerId: string; blockedId: string }[] = [];
  for (const edge of edges) {
    const relationshipType = edge.data?.relationshipType;
    const blockerId =
      relationshipType === "blocks" ? edge.source : relationshipType === "depends_on" ? edge.target : null;
    const blockedId =
      relationshipType === "blocks" ? edge.target : relationshipType === "depends_on" ? edge.source : null;
    if (blockerId === null || blockedId === null) continue;
    blockedBy.get(blockedId)?.add(blockerId);
    blocks.get(blockerId)?.add(blockedId);
    blockerBlockedPairs.push({ blockerId, blockedId });
  }

  // Longest-path layering: a tile's tier is one past its deepest blocker's
  // tier, so a blocker always lands in an earlier (further left) tier than
  // whatever it blocks, and tiles that block others but have no blockers of
  // their own land in tier 0. The app rejects edges that would create a
  // circular block, so this graph is acyclic and the memoized recursion
  // always terminates.
  const tierOf = new Map<string, number>();
  function tierFor(id: string, guard: Set<string>): number {
    const cached = tierOf.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    let tier = 0;
    for (const blockerId of blockedBy.get(id) ?? []) {
      tier = Math.max(tier, tierFor(blockerId, guard) + 1);
    }
    guard.delete(id);
    tierOf.set(id, tier);
    return tier;
  }
  for (const id of nodeIds) tierFor(id, new Set());
  const maxTier = nodeIds.reduce((max, id) => Math.max(max, tierOf.get(id) ?? 0), 0);

  // How much of the graph continues on from this tile (total tiles reachable
  // by following "blocks" edges forward) — used below to break barycenter
  // ties in favor of tiles that carry a chain further, over dead-end tiles
  // that don't. Without this, a brand-new tile that just happens to tie on
  // score with an existing chain-continuing sibling could win an early,
  // more central slot purely by id comparison, potentially landing right on
  // a long unrelated edge that passes through this column on its way
  // between two much-further-apart tiers.
  const descendantCount = new Map<string, number>();
  function countDescendants(id: string, guard: Set<string>): number {
    const cached = descendantCount.get(id);
    if (cached !== undefined) return cached;
    if (guard.has(id)) return 0;
    guard.add(id);
    let count = 0;
    for (const childId of blocks.get(id) ?? []) {
      count += 1 + countDescendants(childId, guard);
    }
    guard.delete(id);
    descendantCount.set(id, count);
    return count;
  }
  for (const id of nodeIds) countDescendants(id, new Set());

  const order = new Map<number, string[]>();
  const cross = new Map<string, number>();

  // Shared by the incremental path below and phase 3 further down: pushes
  // sortedIds[startIndex] by `amount` in `direction`, cascading to the next
  // neighbor in that same direction only if the push would otherwise leave
  // it closer than CROSS_STEP — i.e. the smallest chain of nudges that
  // restores every minimum gap, never touching anything further out than
  // it has to.
  function rippleShift(sortedIds: string[], startIndex: number, direction: 1 | -1, amount: number) {
    let index = startIndex;
    let pending = amount;
    while (pending > 1e-6) {
      const id = sortedIds[index];
      cross.set(id, (cross.get(id) ?? 0) + direction * pending);
      const nextIndex = index + direction;
      if (nextIndex < 0 || nextIndex >= sortedIds.length) break;
      const here = cross.get(id)!;
      const next = cross.get(sortedIds[nextIndex])!;
      const gap = direction > 0 ? next - here : here - next;
      pending = gap < CROSS_STEP ? CROSS_STEP - gap : 0;
      index = nextIndex;
    }
  }

  const rankCross = new Map<string, number>();
  function recomputeRankCross() {
    for (const ids of order.values()) {
      const offset = -((ids.length - 1) * CROSS_STEP) / 2;
      ids.forEach((id, i) => rankCross.set(id, offset + i * CROSS_STEP));
    }
  }

  // --- Phase 2: assign actual coordinates, one column at a time, left to
  // right. A tile's row comes only from its own blockers — always in
  // earlier, already-finalized columns — so nothing downstream can ever
  // pull an earlier column off the row it already settled on. Shared by
  // both the fresh-layout and resnap paths below — the only difference
  // between them is how `order` (each tier's top-to-bottom order) got
  // built before this runs. ---
  function runPhase2() {
    recomputeRankCross();
    for (let tier = 0; tier <= maxTier; tier++) {
      const ids = order.get(tier);
      if (!ids) continue;
      const ideal = new Map<string, number>();
      for (const id of ids) {
        const blockerIds = blockedBy.get(id) ?? new Set();
        if (blockerIds.size === 0) {
          // Nothing constrains a root tile's row — fall back to its
          // evenly-spaced rank position from phase 1.
          ideal.set(id, rankCross.get(id) ?? 0);
          continue;
        }
        let sum = 0;
        for (const blockerId of blockerIds) sum += cross.get(blockerId) ?? 0;
        ideal.set(id, sum / blockerIds.size);
      }
      // Phase 1's order is only ever an estimate for tiers where a real ideal
      // now exists (anywhere blockers are already finalized) — it was
      // computed from rankCross, a rough evenly-spaced guess, before any of
      // this tier's actual positions were known. Re-sorting by the real
      // ideal here means two unrelated tiles that happen to share a column
      // naturally end up in the order their true positions already imply,
      // rather than the crossing-minimization estimate occasionally
      // guessing "backwards" and forcing resolveTierSpacing to clamp one of
      // them away from its own correct position to keep the (unnecessary)
      // order. Array.prototype.sort is stable, so exact ties still fall back
      // to phase 1's crossing-minimizing order.
      const byIdeal = [...ids].sort((a, b) => (ideal.get(a) ?? 0) - (ideal.get(b) ?? 0));
      const placedSoFar = Array.from(cross.values());
      const referenceCenter =
        placedSoFar.length > 0 ? placedSoFar.reduce((a, b) => a + b, 0) / placedSoFar.length : 0;
      const reordered = reorderTiedSiblings(byIdeal, ideal, descendantCount, referenceCenter);
      const resolved = resolveTierSpacing(reordered, ideal, descendantCount);
      for (const [id, value] of resolved) cross.set(id, value);
    }
  }

  if (options.resnapOrder) {
    // --- Resnap: seed each tier's order from the current (e.g. just
    // hand-dragged) row alone, ignoring whatever column it's currently in —
    // a manually-placed tile's x carries no structural meaning, so the only
    // useful signal in `currentPositions` here is relative row order. Any
    // node with no current position (created while manual mode skipped
    // layout entirely) sorts after everything that has one. ---
    for (const id of nodeIds) {
      const tier = tierOf.get(id) ?? 0;
      const list = order.get(tier);
      if (list) list.push(id);
      else order.set(tier, [id]);
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
    runPhase2();
  } else if (currentPositions.size === 0) {
    // --- Phase 1: order each tier to minimize edge crossings ---
    for (const id of nodeIds) {
      const tier = tierOf.get(id) ?? 0;
      const list = order.get(tier);
      if (list) list.push(id);
      else order.set(tier, [id]);
    }
    for (const list of order.values()) list.sort();

    function barycenterSort(tier: number, neighborsOf: Map<string, Set<string>>) {
      const ids = order.get(tier);
      if (!ids) return;
      const scored = ids.map((id) => {
        const neighbors = neighborsOf.get(id) ?? new Set();
        let sum = 0;
        let count = 0;
        for (const neighborId of neighbors) {
          const pos = rankCross.get(neighborId);
          if (pos !== undefined) {
            sum += pos;
            count++;
          }
        }
        const score = count > 0 ? sum / count : (rankCross.get(id) ?? 0);
        return { id, score };
      });
      scored.sort(
        (a, b) =>
          a.score - b.score ||
          (descendantCount.get(b.id) ?? 0) - (descendantCount.get(a.id) ?? 0) ||
          (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
      );
      order.set(
        tier,
        scored.map((s) => s.id)
      );
    }

    for (let sweep = 0; sweep < ORDERING_SWEEPS; sweep++) {
      recomputeRankCross();
      if (sweep % 2 === 0) {
        for (let tier = 1; tier <= maxTier; tier++) barycenterSort(tier, blockedBy);
      } else {
        for (let tier = maxTier - 1; tier >= 0; tier--) barycenterSort(tier, blocks);
      }
    }

    runPhase2();
  } else {
    // --- Incremental placement: every node already in `currentPositions`
    // keeps that exact row, so nothing about the existing map can shift
    // just because something new was added elsewhere. Each tier's already-
    // placed nodes keep their current relative order too (derived from
    // their current row, not recomputed) — only nodes with no prior
    // position (genuinely new since the last layout) get placed, inserted
    // at the row their own blockers imply and, if that would overlap an
    // already-placed neighbor, nudging just that neighbor (and, minimally,
    // whoever is next in line past it) aside via the same ripple phase 3
    // uses for edge clearance. ---
    // A stored position is only trustworthy as-is if this node is still in
    // the same column it was in last time — e.g. a new edge drawn directly
    // between two already-existing tiles can push one of them into a later
    // tier, and its old row has no particular relationship to whatever
    // already occupies that different column. Such a node is treated as
    // new below (placed fresh, with the usual ripple protection) rather
    // than trusted to already be conflict-free where it's landing now.
    function isPinned(id: string): boolean {
      const pos = currentPositions.get(id);
      if (!pos) return false;
      return Math.round(pos.x / MAIN_STEP) === (tierOf.get(id) ?? 0);
    }

    for (let tier = 0; tier <= maxTier; tier++) {
      const idsInTier = nodeIds.filter((id) => (tierOf.get(id) ?? 0) === tier);
      if (idsInTier.length === 0) continue;

      const existingIds = idsInTier
        .filter((id) => isPinned(id))
        .sort((a, b) => currentPositions.get(a)!.y - currentPositions.get(b)!.y);
      for (const id of existingIds) cross.set(id, currentPositions.get(id)!.y);
      const tierOrder = [...existingIds];

      for (const id of idsInTier) {
        if (isPinned(id)) continue;
        const blockerIds = blockedBy.get(id) ?? new Set();
        let ideal: number;
        if (blockerIds.size === 0) {
          // No blockers to anchor a brand new root tile — append it below
          // whatever else already occupies this column instead of
          // guessing a spot in the middle of existing structure.
          const placed = tierOrder.map((existingId) => cross.get(existingId) ?? 0);
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
        while (index < tierOrder.length && (cross.get(tierOrder[index]) ?? 0) <= ideal) index++;

        // Nothing already in tierOrder — a pinned tile from a previous
        // layout, or a new tile placed earlier in this same pass — ever
        // moves to make room for a later insertion; only the tile being
        // inserted right now is free to move off its own computed ideal.
        // Clamp it down past whatever's immediately above if it's too
        // close, then keep walking forward while it's still too close to
        // whatever comes next — each step can only raise the required
        // minimum further, so this always terminates.
        let placedCross = ideal;
        for (;;) {
          if (index > 0) {
            const minAllowed = (cross.get(tierOrder[index - 1]) ?? 0) + CROSS_STEP;
            if (placedCross < minAllowed) placedCross = minAllowed;
          }
          if (index < tierOrder.length && (cross.get(tierOrder[index]) ?? 0) - placedCross < CROSS_STEP) {
            index++;
            continue;
          }
          break;
        }

        cross.set(id, placedCross);
        tierOrder.splice(index, 0, id);
      }

      order.set(tier, tierOrder);
    }
  }

  // --- Phase 3: nudge tiles clear of unrelated long edges. An edge whose
  // blocker and blocked tile aren't in adjacent columns (a "long edge")
  // draws a line straight through every column in between, but nothing
  // above ever accounts for that — an unrelated tile with no connection to
  // either end can land right where the line passes, which reads as a
  // crossing even though no edge actually touches that tile (this is what
  // was happening to "A" when "New Project A" linked straight to "AGDLP"
  // past it). This has to be a separate pass after phase 2 rather than
  // folded into it: a long edge's path isn't known until *both* of its
  // ends are finalized, which for a forward-only pass means everything has
  // to be placed first.
  //
  // Deliberately much lighter-touch than phase 2's spacing: a pass-through
  // line has no real height of its own (unlike two tiles, which each
  // contribute their own half-height), so it only needs half the standard
  // tile-to-tile clearance from whatever real tile sits nearest it — and
  // only that one tile (and, if pushing it would otherwise crowd its own
  // neighbor, a minimal ripple to that neighbor alone) ever moves. Nothing
  // here reopens phase 2's priority-level resolution, so a low-priority
  // tile that happens to also need clearing never forces a higher-priority
  // one to yield room on its behalf.
  const HALF_TILE = DEFAULT_NODE_HEIGHT / 2;
  const OBSTACLE_CLEARANCE = HALF_TILE + TILE_GAP;

  // Snapshot before phase 3 touches anything, so the chain-realignment
  // pass below can tell "this tile matched its blocker's row before phase
  // 3 ran" (a plain chain phase 3 is about to knock crooked) apart from
  // "this tile never matched its blocker's row in the first place" (a tie
  // with a sibling, or a ripple shift from inserting a new tile nearby —
  // both legitimate, and not phase 3's doing, so not this pass's business
  // to undo).
  const crossBeforePhase3 = new Map(cross);

  for (const { blockerId, blockedId } of blockerBlockedPairs) {
    const t0 = tierOf.get(blockerId) ?? 0;
    const t1 = tierOf.get(blockedId) ?? 0;
    if (t1 - t0 <= 1) continue; // adjacent columns — no intermediate tier to pass through
    const y0 = cross.get(blockerId) ?? 0;
    const y1 = cross.get(blockedId) ?? 0;
    for (let tier = t0 + 1; tier < t1; tier++) {
      const ids = order.get(tier);
      if (!ids || ids.length === 0) continue;
      const obstacleY = y0 + (y1 - y0) * ((tier - t0) / (t1 - t0));
      const sortedIds = [...ids].sort((a, b) => (cross.get(a) ?? 0) - (cross.get(b) ?? 0));
      let closestIndex = 0;
      let closestDistance = Infinity;
      sortedIds.forEach((id, i) => {
        const distance = Math.abs((cross.get(id) ?? 0) - obstacleY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = i;
        }
      });
      if (closestDistance >= OBSTACLE_CLEARANCE) continue;
      const closestY = cross.get(sortedIds[closestIndex]) ?? 0;
      const direction: 1 | -1 = closestY >= obstacleY ? 1 : -1;
      rippleShift(sortedIds, closestIndex, direction, OBSTACLE_CLEARANCE - closestDistance);
    }
  }

  // Phase 3 nudges each intermediate tier independently, purely by how
  // close that tier's own tiles happen to sit to the obstacle line passing
  // through it — it has no notion that some other tile several tiers over
  // was centered on this one's row (or averaged in with others'). The same
  // long edge can (and, with H -> J, did) cross several tiers in a row at
  // different fractional heights, nudging each one by a different amount;
  // anything downstream that was purely centered on a tile phase 3 just
  // moved is now stale — a single-blocker chain tile no longer sitting
  // exactly on its blocker's row (H -> J), or a multi-blocker tile no
  // longer centered on blockers whose rows just changed (a tile blocked by
  // both J and something untouched, e.g., no longer really centered once
  // J moved).
  //
  // Recomputing every tile's ideal — the average of its blockers' *current*
  // rows, which for a single blocker is just that row — and reapplying it
  // here, in tier order so multi-link chains cascade correctly, repairs
  // both cases the same way phase 2 originally derived them, just with
  // phase 3's corrections folded in.
  //
  // Only reapplied where phase 2 actually had a tile exactly on that ideal
  // to begin with, per crossBeforePhase3 — a tile isn't always exactly
  // centered on its blockers even before phase 3 runs (a tied dead-end
  // sibling gets pushed off it deliberately by
  // reorderTiedSiblings/resolveTierSpacing, and the incremental path's
  // ripple can shift one aside to make room for a new insertion nearby);
  // this must never overrule either of those, since there's no way to
  // re-derive what its deliberately-adjusted position should become
  // without re-running that whole resolution.
  for (let tier = 0; tier <= maxTier; tier++) {
    for (const id of order.get(tier) ?? []) {
      const blockerIds = blockedBy.get(id) ?? new Set();
      if (blockerIds.size === 0) continue;

      let sumBefore = 0;
      for (const blockerId of blockerIds) sumBefore += crossBeforePhase3.get(blockerId) ?? 0;
      const idealBefore = sumBefore / blockerIds.size;
      const before = crossBeforePhase3.get(id) ?? 0;

      if (Math.abs(before - idealBefore) < TIE_EPSILON) {
        let sumNow = 0;
        for (const blockerId of blockerIds) sumNow += cross.get(blockerId) ?? 0;
        cross.set(id, sumNow / blockerIds.size);
      }
    }
  }

  const positions = new Map<string, { x: number; y: number }>();
  for (const id of nodeIds) {
    positions.set(id, { x: (tierOf.get(id) ?? 0) * MAIN_STEP, y: cross.get(id) ?? 0 });
  }
  return positions;
}
