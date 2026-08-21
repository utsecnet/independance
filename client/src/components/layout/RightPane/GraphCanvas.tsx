import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ViewportPortal,
  type OnNodeDrag,
  type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { NodeType } from "@independance/shared";
import { handlesForRelationship, useGraphStore, type GraphRFEdge, type GraphRFNode } from "../../../state/store";
import { arrangeNodes, CROSS_STEP, DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, DOT_GRID_SIZE, MAIN_STEP } from "../../../state/layout";
import { computeDependencyRollups } from "../../../state/dependencyRollup";
import { collectDependencyChain } from "../../../state/dependencyChain";
import { collapseHiddenNodes } from "../../../state/graphCollapse";
import { useFilterStore } from "../../../state/filterStore";
import { fieldValueTokens } from "../../../state/tileFieldValues";
import { useDragLinkStore, type DropHalf } from "../../../state/dragLinkStore";
import { graphNodeTypes } from "./nodes/GraphNodeCard";
import { graphEdgeTypes } from "./edges/InsertableEdge";
import { useGestures } from "./gestures/useGestures";
import { CreateNodeButton } from "./CreateNodeButton";
import { ExportButton } from "./ExportButton";
import { FilterMenu } from "./FilterMenu";
import { PlacementModeToggle } from "./PlacementModeToggle";
import styles from "./GraphCanvas.module.css";

/**
 * Applies the map filter (see filterStore) to what's actually rendered.
 * Filtering doesn't just hide nodes and leave gaps where they used to be —
 * every surviving node is re-laid-out via the exact same arrangeNodes
 * rules the unfiltered map uses (tiering, ordering, spacing — see
 * layout.ts), as if the hidden nodes had never existed, so the map
 * visually *collapses* to fill the space they left. Where a hidden run
 * used to sit between two things that are still visible, a single
 * "bridge" edge takes its place carrying a `[N]` label — same solid line
 * as any other edge, just with a count badge in the middle — so it's clear
 * something was filtered out there and how much, rather than the
 * connection just silently vanishing along with the nodes it used to run
 * through (see collapseHiddenNodes).
 *
 * Purely a display-layer transform — never touches the underlying graph's
 * real stored positions, so clearing the filter always restores exactly
 * where everything was before.
 */
export function filterGraphForDisplay(
  nodes: GraphRFNode[],
  edges: GraphRFEdge[],
  hiddenTypeIds: Set<string>,
  hiddenFieldValues: Map<string, Set<string>>
): { nodes: GraphRFNode[]; edges: GraphRFEdge[] } {
  if (hiddenTypeIds.size === 0 && hiddenFieldValues.size === 0) return { nodes, edges };

  const hiddenIds = new Set(
    nodes
      .filter((n) => {
        if (hiddenTypeIds.has(n.data.nodeType)) return true;
        // Any field the map is currently filtering on for this tile's own
        // type — a tile is hidden the moment one of its own values (any one
        // of them, for a multi-valued field like tags) is unchecked, same
        // "uncheck to hide" convention Type already uses.
        for (const [key, hiddenValues] of hiddenFieldValues) {
          const [typeId, fieldId] = key.split("::");
          if (typeId !== n.data.nodeType) continue;
          const tokens = fieldValueTokens(fieldId, n.data.status, n.data.metadata);
          if (tokens.some((t) => hiddenValues.has(t))) return true;
        }
        return false;
      })
      .map((n) => n.id)
  );
  if (hiddenIds.size === 0) return { nodes, edges };

  const { visibleNodeIds, bridgeEdges, danglingCounts } = collapseHiddenNodes(
    nodes.map((n) => n.id),
    edges.map((e) => ({ source: e.source, target: e.target, relationshipType: e.data!.relationshipType })),
    hiddenIds
  );

  const positions = arrangeNodes(
    visibleNodeIds,
    bridgeEdges.map((b) => ({ source: b.source, target: b.target, data: { relationshipType: "blocks" as const } }))
  );

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const collapsedNodes = visibleNodeIds.map((id) => {
    const original = nodeById.get(id)!;
    const position = positions.get(id);
    const filteredCounts = danglingCounts.get(id);
    const base = position ? { ...original, position } : original;
    return filteredCounts ? { ...base, data: { ...base.data, filteredCounts } } : base;
  });

  // Not selectable/deletable: a bridge edge (and, once collapsed, even a
  // hiddenCount-0 one) no longer corresponds 1:1 to a single real edge
  // record the way an ordinary edge's own id does, so there's nothing
  // sensible for clicking or Delete to act on while the map is in this
  // temporary, filtered-and-collapsed state.
  const collapsedEdges: GraphRFEdge[] = bridgeEdges.map((b) => ({
    id: `bridge:${b.source}->${b.target}`,
    source: b.source,
    target: b.target,
    selectable: false,
    deletable: false,
    ...(b.hiddenCount > 0
      ? {
          label: `[${b.hiddenCount}]`,
          labelBgPadding: [4, 2] as [number, number],
          labelBgBorderRadius: 4,
          labelBgStyle: { fill: "var(--surface-raised)" },
          labelStyle: { fill: "var(--text-dim)", fontSize: 10, fontWeight: 700 },
        }
      : {}),
    data: { relationshipType: "blocks" },
  }));

  return { nodes: collapsedNodes, edges: collapsedEdges };
}

// A dropped tile's vertical center snaps to the *nearest already-placed
// tile's* center — not to a fixed row grid measured from y = 0 — because
// row positions in this graph aren't actually evenly spaced multiples of
// CROSS_STEP from a shared origin: arrangeNodes centers a tile between
// several blockers by averaging their rows, which routinely lands on a
// fraction of CROSS_STEP. Rounding to the nearest multiple of CROSS_STEP
// from 0 would then snap a drop to a row nothing is actually on. Aligning
// to whatever's already there — which is what actually keeps a connecting
// line horizontal — is correct regardless of how that neighbor got its
// row. Only falls back to the fixed grid when there's nothing nearby to
// align to at all (an empty area of the canvas, or an empty graph).
//
// The radius has to stay well under CROSS_STEP itself, not equal to it —
// CROSS_STEP is the *minimum* gap this app ever enforces between two
// different rows, so a full CROSS_STEP is exactly "the nearest occupied
// row a drop could possibly be next to" even when that row has nothing to
// do with where the tile actually landed. At that radius, dropping a tile
// on its own already-correct row could still get yanked onto a completely
// different, merely-adjacent tile's row instead — a real bug: dragging a
// tile straight sideways (no vertical movement intended at all) could pull
// it onto whatever row happened to sit one CROSS_STEP away, making "put it
// back roughly where it already was, just shifted over" reliably
// impossible near any other structure. A third of CROSS_STEP keeps the
// magnet for genuinely aligning with a specific nearby off-grid neighbor
// (the whole reason this exists) while no longer firing on a neighbor
// that's merely in the next row over.
const ROW_SNAP_RADIUS = CROSS_STEP / 3;

export function snapToCenterGrid(
  position: { x: number; y: number },
  height: number,
  neighborCenterYs: number[]
): { x: number; y: number } {
  const x = MAIN_STEP * Math.round(position.x / MAIN_STEP);
  const centerY = position.y + height / 2;

  let nearest: number | null = null;
  let nearestDist = Infinity;
  for (const candidate of neighborCenterYs) {
    const dist = Math.abs(candidate - centerY);
    if (dist < nearestDist) {
      nearest = candidate;
      nearestDist = dist;
    }
  }

  if (nearest !== null && nearestDist <= ROW_SNAP_RADIUS) {
    return { x, y: nearest - height / 2 };
  }
  // Nothing nearby to align with — fall back to a plain CROSS_STEP grid,
  // measured on the tile's own top-left row rather than its center.
  // arrangeNodes' own cross values (and every other manual-mode placement
  // in this app — findFreeRow's increments, the store's new-root fallback)
  // are top-left row positions that land on whole multiples of CROSS_STEP;
  // rounding the *center* instead — as this used to — measures against a
  // grid offset by half the tile's height from that one, so a tile could
  // never make it back to its own already-correct auto-layout row by
  // dragging it: it'd resettle half a row off, every time.
  return { x, y: CROSS_STEP * Math.round(position.y / CROSS_STEP) };
}

/**
 * snapToCenterGrid deliberately snaps to the nearest *existing* tile's row
 * for clean alignment, regardless of which column that tile is in — but it
 * has no notion of "and that row is already occupied by something in my own
 * column," so a tile dragged to hover near another one's row (in the same
 * column) could land exactly on top of it instead of next to it. Walks the
 * snapped position away from any same-column tile it still overlaps, one
 * row at a time, continuing in whichever direction it was already on
 * relative to that tile (preserving "I dropped it above" vs "below") until
 * clear of every same-column neighbor.
 *
 * Capped rather than run to a fixed point — real bug: two same-column
 * neighbors less than 2 * CROSS_STEP apart (e.g. dropped into a gap that
 * genuinely isn't wide enough to clear both) can each keep pushing the
 * dragged tile back onto the other, forever, since satisfying either one
 * alone re-triggers the other's own check on the very next pass. That's an
 * infinite loop on the render thread — the whole tab hangs, which is what
 * actually reaches the user as "the app crashes." A tile landing not
 * perfectly clear of every neighbor in a spot that was never wide enough to
 * begin with is a real, visible limitation; freezing the tab over it isn't
 * — the same tradeoff transposePass's own MAX_TRANSPOSE_PASSES already
 * makes elsewhere in this app for the identical reason.
 */
const MAX_COLLISION_PASSES = 20;
export function avoidRowCollision(
  position: { x: number; y: number },
  height: number,
  others: { x: number; y: number; height: number }[]
): { x: number; y: number } {
  const sameColumn = others.filter((o) => Math.abs(o.x - position.x) < 1);
  let y = position.y;
  for (let pass = 0; pass < MAX_COLLISION_PASSES; pass++) {
    let changed = false;
    for (const o of sameColumn) {
      const centerDist = Math.abs(y + height / 2 - (o.y + o.height / 2));
      if (centerDist < CROSS_STEP - 1e-6) {
        const direction = y <= o.y ? -1 : 1;
        y = o.y + direction * CROSS_STEP;
        changed = true;
      }
    }
    if (!changed) break;
  }
  return { x: position.x, y };
}

/**
 * Which half of `targetRect` the dragged tile's center currently sits over
 * — left means "dragged blocks target" (the dragged tile ends up to the
 * target's left, matching the "A left of B, A blocks B" convention this
 * graph already draws chains in), right means "dragged is blocked by
 * (depends on) target".
 */
export function halfForDrop(
  draggedRect: { x: number; y: number; width: number; height: number },
  targetRect: { x: number; width: number }
): DropHalf {
  const draggedCenterX = draggedRect.x + draggedRect.width / 2;
  const targetMidX = targetRect.x + targetRect.width / 2;
  return draggedCenterX < targetMidX ? "left" : "right";
}

export function GraphCanvas() {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const status = useGraphStore((s) => s.status);
  const selectedId = useGraphStore((s) => s.selectedId);
  const editingId = useGraphStore((s) => s.editingId);
  const stopEditing = useGraphStore((s) => s.stopEditing);
  const placementMode = useGraphStore((s) => s.placementMode);
  const onNodesChange = useGraphStore((s) => s.onNodesChange);
  const onEdgesChange = useGraphStore((s) => s.onEdgesChange);
  const onConnect = useGraphStore((s) => s.onConnect);
  const onNodesDelete = useGraphStore((s) => s.onNodesDelete);
  const onEdgesDelete = useGraphStore((s) => s.onEdgesDelete);
  const selectNode = useGraphStore((s) => s.selectNode);
  const createNode = useGraphStore((s) => s.createNode);
  const moveNode = useGraphStore((s) => s.moveNode);
  const createEdge = useGraphStore((s) => s.createEdge);
  const hiddenTypeIds = useFilterStore((s) => s.hiddenTypeIds);
  const hiddenFieldValues = useFilterStore((s) => s.hiddenFieldValues);
  // Positions while filtered are a temporary, collapsed re-layout (see
  // filterGraphForDisplay) rather than the graph's real ones — dragging has
  // to stay off for the duration regardless of placementMode, since a drop
  // would otherwise persist one of those temporary coordinates as if it
  // were a real manual placement.
  const isFiltered = hiddenTypeIds.size > 0 || hiddenFieldValues.size > 0;
  const setDropHover = useDragLinkStore((s) => s.setDropHover);

  const paneRef = useRef<HTMLDivElement>(null);
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance<GraphRFNode, GraphRFEdge> | null>(null);
  // Where the tile currently being dragged would actually land if released
  // right now — the exact same snapToCenterGrid + avoidRowCollision pipeline
  // handleNodeDragStop itself commits with, just run a frame early so a
  // ghost outline (see the ViewportPortal below) can show it before the
  // drop happens. Cleared whenever there's nothing being dragged, or the
  // drag is currently hovering a link target instead (see handleNodeDrag) —
  // dropping there links two tiles rather than snapping to the grid, so a
  // grid-snap preview would be actively misleading in that moment.
  const [snapPreview, setSnapPreview] = useState<{ x: number; y: number; width: number; height: number } | null>(
    null
  );
  // Captured at the start of a manual drag so a tile that ends up linking
  // to another one (see handleNodeDragStop) can snap back to exactly where
  // it started, instead of staying wherever it was dropped — linking two
  // tiles is a distinct gesture from repositioning one, and leaving the
  // dragged tile stacked on its new link target would look like a mistake.
  const dragStartPosition = useRef<{ x: number; y: number } | null>(null);

  useGestures(paneRef.current, rfInstance);

  // Initial data load (config, then graph, in that order) is kicked off
  // once at the App level, not here — see App.tsx's bootstrap effect for
  // why the ordering matters.

  // Selecting a tile expands it into a much taller card, but React Flow's
  // `measured` size for that node comes from a ResizeObserver that hasn't
  // caught up yet in the same tick selectedId changes — calling fitView
  // immediately would frame the stale, still-collapsed size. A short delay
  // lets the resize land first so fitView centers on the actual expanded
  // card instead of leaving it hanging off the bottom of the viewport.
  useEffect(() => {
    if (!rfInstance || !selectedId) return;
    const timer = setTimeout(() => {
      rfInstance.fitView({ nodes: [{ id: selectedId }], duration: 400, maxZoom: 1.2 });
    }, 60);
    return () => clearTimeout(timer);
  }, [rfInstance, selectedId]);

  // React Flow only auto-raises a node's stacking order when its own
  // internal `node.selected` flag is set, which this app never sets (see the
  // Delete-key handling note below — selection here is driven entirely by
  // our own `selectedId`, not RF's selection NodeChanges). Without this, an
  // expanded card can end up visually covered by a neighboring collapsed
  // tile. Boosting zIndex explicitly on whichever node matches `selectedId`
  // keeps the expanded card on top regardless of RF's internal state.
  const { nodes: visibleNodes, edges: visibleEdges } = useMemo(
    () => filterGraphForDisplay(nodes, edges, hiddenTypeIds, hiddenFieldValues),
    [nodes, edges, hiddenTypeIds, hiddenFieldValues]
  );

  // Computed off the full (unfiltered) graph, not visibleNodes/visibleEdges
  // — a tile's dependency tally shouldn't shrink just because the map
  // filter is currently hiding some of what feeds it.
  const rollups = useMemo(
    () =>
      computeDependencyRollups(
        nodes.map((n) => ({ id: n.id, type: n.data.nodeType })),
        edges.map((e) => ({ source: e.source, target: e.target, relationshipType: e.data!.relationshipType }))
      ),
    [nodes, edges]
  );

  // Selecting a tile doubles as "highlight its dependency chain" — every
  // tile and edge connected to it by an unbroken run of blocks/depends_on
  // links (either direction) stays at full visibility; everything else
  // dims, turning a busy map into a focused view of just that one line of
  // dependencies. Deselecting (pane click) clears it the same way it
  // already clears the plain selection glow — see collectDependencyChain.
  const chain = useMemo(
    () =>
      selectedId
        ? collectDependencyChain(
            selectedId,
            edges.map((e) => ({ id: e.id, source: e.source, target: e.target, relationshipType: e.data!.relationshipType }))
          )
        : null,
    [selectedId, edges]
  );

  const displayNodes = useMemo(
    () =>
      visibleNodes.map((n) => {
        const zIndex = n.id === selectedId ? 1000 : undefined;
        const counts = rollups.get(n.id);
        const dimmed = chain !== null && !chain.nodeIds.has(n.id);
        if (zIndex === undefined && !counts && !dimmed) return n;
        return {
          ...n,
          ...(zIndex !== undefined ? { zIndex } : {}),
          data: {
            ...n.data,
            ...(counts ? { dependencyCounts: Object.fromEntries(counts) } : {}),
            dimmed,
          },
        };
      }),
    [visibleNodes, selectedId, rollups, chain]
  );

  const displayEdges = useMemo(
    () =>
      visibleEdges.map((e) => {
        // Checked by the edge's *endpoints*, not chain.edgeIds directly —
        // while the map filter is active, every edge here (even an
        // otherwise-untouched one) is a synthetic bridge with a freshly
        // generated id (see filterGraphForDisplay), which would never match
        // a real edge's id from the underlying, unfiltered chain. Node ids
        // stay stable either way, so membership by endpoint works uniformly
        // whether this is a real edge or a bridge standing in for a run of
        // now-hidden ones.
        const inChain = chain !== null && chain.nodeIds.has(e.source) && chain.nodeIds.has(e.target);
        return {
          ...e,
          ...handlesForRelationship(e.data!.relationshipType),
          style: chain === null ? undefined : inChain ? { stroke: "var(--accent-cyan)", strokeWidth: 2.5 } : { opacity: 0.15 },
        };
      }),
    [visibleEdges, chain]
  );

  // React Flow's deleteKeyCode only removes nodes it considers internally
  // "selected" (node.selected), which requires a selection NodeChange to
  // have gone through onNodesChange — but our nodes never get that flag set
  // (clicking a tile drives its own selectedId/expand state directly via
  // onNodeClick, never a real RF selection change), so Delete silently did
  // nothing for tiles even though it already worked for edges via RF's own
  // mechanism. Handling it ourselves off the same selectedId that already
  // drives which tile is expanded keeps this in sync by construction. Uses
  // deleteNode (not onNodesDelete) since onNodesDelete only makes the API
  // call and expects RF's own remove-NodeChange dispatch to strip the node
  // from local state — a step that only happens inside RF's internal
  // delete flow, not when called directly like this.
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const active = document.activeElement;
      const isEditableFocused =
        active instanceof HTMLElement &&
        (active.tagName === "INPUT" ||
          active.tagName === "TEXTAREA" ||
          active.tagName === "SELECT" ||
          active.isContentEditable);
      if (isEditableFocused) return;

      if (event.key === "Delete") {
        const state = useGraphStore.getState();
        if (state.selectedId) {
          state.deleteNode(state.selectedId);
        }
        return;
      }

      // Ctrl+Z / Ctrl+Y undo/redo the last create, delete, or edit — see
      // the undo/redo actions in store.ts for what counts as one step.
      if (event.ctrlKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        useGraphStore.getState().undo();
        return;
      }
      if (event.ctrlKey && event.key.toLowerCase() === "y") {
        event.preventDefault();
        useGraphStore.getState().redo();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Plain scroll still zooms (React Flow's default). Shift+scroll pans
  // horizontally and Ctrl+scroll pans vertically instead — neither has a
  // matching built-in React Flow prop (panOnScroll only supports a single
  // modifier that toggles pan vs. zoom), so both are handled here directly,
  // capturing the wheel event before it reaches React Flow's own handler.
  useEffect(() => {
    const paneEl = paneRef.current;
    const instance = rfInstance;
    if (!paneEl || !instance) return;

    function handleWheel(event: WheelEvent) {
      if (!event.shiftKey && !event.ctrlKey) return;
      event.preventDefault();
      event.stopPropagation();
      const { x, y, zoom } = instance!.getViewport();
      if (event.shiftKey) {
        instance!.setViewport({ x: x - event.deltaY, y, zoom }, { duration: 0 });
      } else {
        instance!.setViewport({ x, y: y - event.deltaY, zoom }, { duration: 0 });
      }
    }

    paneEl.addEventListener("wheel", handleWheel, { passive: false, capture: true });
    return () => paneEl.removeEventListener("wheel", handleWheel, { capture: true });
  }, [rfInstance]);

  // Captures where the tile was before this drag, in case it ends up
  // linking to another tile (see handleNodeDragStop) rather than just
  // moving — the store's own position is still the pre-drag one at this
  // point, since RF only mutates its own internal copy during the drag.
  const handleNodeDragStart: OnNodeDrag<GraphRFNode> = (_, node) => {
    dragStartPosition.current = node.position;
  };

  // Manual-mode-only: while dragging a tile, find whichever other tile it's
  // currently overlapping most and which half of it (left/right) the
  // dragged tile's center sits over, so that tile can show the pending
  // relationship before the drop actually creates it. getIntersectingNodes
  // does the overlap test against React Flow's own measured node rects.
  //
  // React Flow's third callback argument is every node actually being
  // dragged together (a shift-selected group, not just the one the pointer
  // is over — see @xyflow/system's getDragItems/getEventHandlerParams).
  // Ignoring it meant a multi-select drag only ever snapped/avoided-collision
  // for the single tile under the cursor; every other selected tile kept
  // whatever raw, unsnapped pixel position React Flow's own group-translate
  // left it at. The drag-onto-another-tile-to-link gesture below only makes
  // sense for one tile at a time, so a multi-drag skips straight to preview
  // snapping instead, treating every *other* currently-dragged tile as part
  // of the group (never an obstacle for it to avoid) rather than a neighbor.
  const handleNodeDrag: OnNodeDrag<GraphRFNode> = (_, node, nodes) => {
    if (!rfInstance) return;
    if (nodes.length > 1) {
      setDropHover(null);
      const draggedIds = new Set(nodes.map((n) => n.id));
      const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
      const otherNodes = rfInstance.getNodes().filter((n) => !draggedIds.has(n.id));
      const neighborCenterYs = otherNodes.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2);
      const snapped = snapToCenterGrid(node.position, height, neighborCenterYs);
      const others = otherNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        height: n.measured?.height ?? DEFAULT_NODE_HEIGHT,
      }));
      const finalPosition = avoidRowCollision(snapped, height, others);
      setSnapPreview({ ...finalPosition, width, height });
      return;
    }
    const target = rfInstance.getIntersectingNodes(node).filter((n) => n.id !== node.id)[0];
    if (!target) {
      setDropHover(null);
      const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      const width = node.measured?.width ?? DEFAULT_NODE_WIDTH;
      const otherNodes = rfInstance.getNodes().filter((n) => n.id !== node.id);
      const neighborCenterYs = otherNodes.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2);
      const snapped = snapToCenterGrid(node.position, height, neighborCenterYs);
      const others = otherNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        height: n.measured?.height ?? DEFAULT_NODE_HEIGHT,
      }));
      const finalPosition = avoidRowCollision(snapped, height, others);
      setSnapPreview({ ...finalPosition, width, height });
      return;
    }
    setSnapPreview(null);
    const draggedRect = { ...node.position, width: node.measured?.width ?? DEFAULT_NODE_WIDTH, height: node.measured?.height ?? DEFAULT_NODE_HEIGHT };
    const targetRect = { x: target.position.x, width: target.measured?.width ?? DEFAULT_NODE_WIDTH };
    setDropHover({ targetId: target.id, half: halfForDrop(draggedRect, targetRect) });
  };

  // Dropping a tile onto another one links them instead of just
  // repositioning it — the near (left) half means the dragged tile blocks
  // the target, the far (right) half means it's blocked by (depends on)
  // the target — this is the "hover to connect" gesture manual mode adds
  // on top of free dragging. A successful link snaps the dragged tile back
  // to where it started rather than leaving it stacked on its new link
  // target; otherwise the drop position persists as an ordinary reposition
  // (moveNode) — either way is what makes manual mode "manual": arrangeGraph
  // never runs, so this is the only thing that saves where a drag ends up.
  // Re-checks intersection against the final position directly (rather than
  // trusting the last onNodeDrag event, which only fires per animation
  // frame) so the connect decision always matches where the tile actually
  // ended up.
  const handleNodeDragStop: OnNodeDrag<GraphRFNode> = (_, node, nodes) => {
    setDropHover(null);
    setSnapPreview(null);

    // Multi-select drag: the group moves as one rigid unit, snapped as a
    // whole rather than each tile independently — snap/avoid-collision is
    // computed once for the tile the pointer was actually over (against
    // every *non*-dragged tile only), and every other selected tile is
    // carried by that same offset, preserving their positions relative to
    // each other. Persisted individually (moveNode per tile) since there's
    // no batch position-update endpoint; each one's own row still comes out
    // correctly snapped, just via a shared delta instead of its own
    // independent nearest-neighbor search.
    if (nodes.length > 1) {
      const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
      const draggedIds = new Set(nodes.map((n) => n.id));
      const otherNodes = (rfInstance?.getNodes() ?? []).filter((n) => !draggedIds.has(n.id));
      const neighborCenterYs = otherNodes.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2);
      const snapped = snapToCenterGrid(node.position, height, neighborCenterYs);
      const others = otherNodes.map((n) => ({
        x: n.position.x,
        y: n.position.y,
        height: n.measured?.height ?? DEFAULT_NODE_HEIGHT,
      }));
      const finalPrimary = avoidRowCollision(snapped, height, others);
      const dx = finalPrimary.x - node.position.x;
      const dy = finalPrimary.y - node.position.y;
      for (const n of nodes) {
        moveNode(n.id, { x: n.position.x + dx, y: n.position.y + dy });
      }
      return;
    }

    const target = rfInstance?.getIntersectingNodes(node).filter((n) => n.id !== node.id)[0];
    if (target) {
      const draggedRect = { ...node.position, width: node.measured?.width ?? DEFAULT_NODE_WIDTH, height: node.measured?.height ?? DEFAULT_NODE_HEIGHT };
      const targetRect = { x: target.position.x, width: target.measured?.width ?? DEFAULT_NODE_WIDTH };
      const half = halfForDrop(draggedRect, targetRect);
      const relationshipType = half === "left" ? "blocks" : "depends_on";
      createEdge(node.id, target.id, relationshipType);
      if (dragStartPosition.current) moveNode(node.id, dragStartPosition.current);
      return;
    }

    const height = node.measured?.height ?? DEFAULT_NODE_HEIGHT;
    // Read every other tile's own row straight from React Flow's internal
    // node list (rather than the store's `nodes`) since that's the copy
    // that actually carries each one's live measured height — needed to
    // get their true centers, not just their stored top-left `position.y`.
    const otherNodes = (rfInstance?.getNodes() ?? []).filter((n) => n.id !== node.id);
    const neighborCenterYs = otherNodes.map((n) => n.position.y + (n.measured?.height ?? DEFAULT_NODE_HEIGHT) / 2);
    const snapped = snapToCenterGrid(node.position, height, neighborCenterYs);
    const others = otherNodes.map((n) => ({
      x: n.position.x,
      y: n.position.y,
      height: n.measured?.height ?? DEFAULT_NODE_HEIGHT,
    }));
    moveNode(node.id, avoidRowCollision(snapped, height, others));
  };

  // No position is passed here — arrangeGraph (called by createNode) places
  // every tile on the standardized grid immediately after creation, so
  // there's nothing useful to compute up front. No title either — the new
  // tile opens straight into its edit form with the title field empty and
  // focused (see NodeCardForm), so there's nothing here to name it with.
  function handleCreate(type: NodeType) {
    createNode({ type, title: "" });
  }

  if (status === "loading" || status === "idle") {
    return <div className={styles.pane}>Loading graph…</div>;
  }

  return (
    <div className={styles.pane} ref={paneRef}>
      <CreateNodeButton onCreate={handleCreate} />
      <FilterMenu />
      <PlacementModeToggle />
      <ExportButton rfInstance={rfInstance} />
      {nodes.length === 0 && (
        <div className={styles.empty}>
          <div>
            <div className={styles.emptyTitle}>No dependency map yet</div>
            <div>Click the + button in the top-left to start mapping.</div>
          </div>
        </div>
      )}
      {nodes.length > 0 && visibleNodes.length === 0 && (
        <div className={styles.empty}>
          <div>
            <div className={styles.emptyTitle}>No items match the current filter</div>
            <div>Adjust or clear the filter to see your dependency map.</div>
          </div>
        </div>
      )}
      <ReactFlow<GraphRFNode, GraphRFEdge>
        nodes={displayNodes}
        edges={displayEdges}
        onInit={setRfInstance}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodesDelete}
        onEdgesDelete={onEdgesDelete}
        onNodeDragStart={placementMode === "manual" && !isFiltered ? handleNodeDragStart : undefined}
        onNodeDrag={placementMode === "manual" && !isFiltered ? handleNodeDrag : undefined}
        onNodeDragStop={placementMode === "manual" && !isFiltered ? handleNodeDragStop : undefined}
        onNodeClick={(event, node) => {
          // Shift-click is React Flow's own gesture for adding a tile to a
          // multi-selection (see multiSelectionKeyCode below) — our own
          // single-tile select/chain-highlight/close-the-open-form logic
          // doesn't make sense mid-multi-select, so it's skipped entirely
          // here and left to React Flow's own selection state, which is
          // what handleNodeDrag/handleNodeDragStop read from.
          if (event.shiftKey) return;
          selectNode(node.id);
          // Clicking a *different* tile than the one currently being
          // edited closes that edit form — only one tile's form is ever
          // open at a time. A click bubbling up from inside the edited
          // tile's own card (its blank padding, say) reports the same
          // node.id here and must NOT close its own form out from under
          // the user still working in it.
          if (editingId && editingId !== node.id) stopEditing();
        }}
        onPaneClick={() => {
          selectNode(null);
          stopEditing();
        }}
        nodeTypes={graphNodeTypes}
        edgeTypes={graphEdgeTypes}
        nodesDraggable={placementMode === "manual" && !isFiltered}
        deleteKeyCode="Delete"
        // Default is Ctrl/Cmd — Shift is the far more common convention for
        // "add this tile to the selection" (Figma and most design/diagram
        // tools use it), and it's also already what selectionKeyCode (the
        // rubber-band-drag-select modifier, on by default) uses, so both
        // multi-select gestures now share one consistent modifier key.
        multiSelectionKeyCode="Shift"
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background variant={BackgroundVariant.Dots} gap={DOT_GRID_SIZE} size={1} color="var(--border)" />
        {snapPreview && (
          // Renders straight into React Flow's own pannable/zoomable
          // viewport layer (flow coordinates, not screen ones) — the same
          // technique React Flow's own "helper lines" example uses — so
          // this tracks the drag correctly under any pan or zoom without
          // having to redo that math by hand.
          <ViewportPortal>
            <div
              className={styles.snapPreview}
              style={{
                width: snapPreview.width,
                height: snapPreview.height,
                transform: `translate(${snapPreview.x}px, ${snapPreview.y}px)`,
              }}
            />
          </ViewportPortal>
        )}
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          bgColor="var(--surface)"
          maskColor="rgba(0, 0, 0, 0.3)"
          nodeColor="var(--text-dim)"
          nodeStrokeColor="var(--accent-cyan)"
          nodeStrokeWidth={2}
        />
      </ReactFlow>
      <div className={styles.watermark}>© 2026 utsecnet. All rights reserved.</div>
    </div>
  );
}
