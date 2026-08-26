import { create } from "zustand";
import {
  applyEdgeChanges,
  applyNodeChanges,
  type Connection,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import type {
  GraphEdge,
  GraphNode,
  NodeMetadata,
  NodeStatus,
  NodeType,
  PlacementMode,
  RelationshipType,
} from "@independance/shared";
import { graphApi } from "../api/graph";
import { nodesApi, type CreateNodePayload, type UpdateNodePayload } from "../api/nodes";
import { edgesApi } from "../api/edges";
import { ApiError } from "../api/client";
import { useConfigStore } from "./configStore";
import { arrangeNodes, CROSS_STEP } from "./layout";

export type { PlacementMode };

export interface RFNodeData extends Record<string, unknown> {
  title: string;
  description?: string;
  status: NodeStatus;
  nodeType: NodeType;
  metadata: NodeMetadata;
  /**
   * UI-only rollup of dependent task/POA&M-type counts upstream of this
   * node in the "blocks" chain, keyed by node type id — computed fresh by
   * GraphCanvas (see computeDependencyRollups) on every nodes/edges change,
   * never persisted or round-tripped through the server. Only set for
   * Project/Task-type nodes; see GraphNodeCard's rollup tabs.
   */
  dependencyCounts?: Record<string, number>;
  /**
   * UI-only, set only while the map filter is active (see filterStore) —
   * how many hidden nodes sit off this tile's left (upstream/blocker) or
   * right (downstream/blocked) side with no visible node of their own to
   * bridge to, so filtering them out would otherwise leave zero trace (a
   * hidden run *between* two still-visible tiles gets a bridge edge
   * instead — see filterGraphForDisplay/collapseHiddenNodes). Computed
   * fresh by GraphCanvas on every filter change, never persisted.
   */
  filteredCounts?: { upstream: number; downstream: number };
  /**
   * UI-only — set on every node whenever some tile is selected and this
   * one isn't part of its dependency chain (see GraphCanvas's chain memo
   * and collectDependencyChain), so GraphNodeCard can fade it out of a
   * focused view. Always false while nothing is selected. Never persisted.
   */
  dimmed?: boolean;
}

export interface RFEdgeData extends Record<string, unknown> {
  relationshipType: RelationshipType;
  label?: string;
}

export type GraphRFNode = Node<RFNodeData>;
export type GraphRFEdge = Edge<RFEdgeData>;

function toRFNode(node: GraphNode): GraphRFNode {
  return {
    id: node.id,
    type: "graphNode",
    position: node.position,
    data: {
      title: node.title,
      description: node.description,
      status: node.status,
      nodeType: node.type,
      metadata: node.metadata,
    },
  };
}

/**
 * Every node renders a source AND a target handle stacked at its left side,
 * and the same pair stacked at its right side, so an edge can visually run
 * either direction depending on what it means. The two sides connect the
 * nodes' *facing* sides — a "blocks" edge's blocker uses its right handle
 * (the side facing whatever it blocks) and the blocked tile uses its left
 * handle back; every other relationship (depends_on included) keeps the
 * reverse flow.
 *
 * Deliberately not baked into the edge objects stored in this Zustand
 * store — computed fresh by GraphCanvas via useMemo on every render, kept
 * as a pure function here mainly so relationshipTypeForHandles right below
 * stays an obvious inverse of it.
 */
export function handlesForRelationship(relationshipType: RelationshipType): {
  sourceHandle: string;
  targetHandle: string;
} {
  if (relationshipType === "blocks") {
    return { sourceHandle: "right-source", targetHandle: "left-target" };
  }
  return { sourceHandle: "left-source", targetHandle: "right-target" };
}

/**
 * Inverse of handlesForRelationship: React Flow's own connect-drag gesture
 * (dragging directly from one handle circle to another) reports which
 * specific handles were used, but until this was fixed `onConnect` ignored
 * that and always created a "depends_on" edge — meaning "blocks" could
 * never be hand-drawn, and hand-drawing a new line between two already-
 * linked tiles in an attempt to reverse the relationship would either
 * recreate the exact same edge (a confusing "already linked" 409) or leave
 * the relationship unchanged instead of actually swapping blocker/blocked.
 * Reading the handle pair back out lets a hand-drawn connection express
 * "blocks" the same way the drag-a-whole-tile-over-another gesture does.
 */
function relationshipTypeForHandles(
  sourceHandle: string | null | undefined,
  targetHandle: string | null | undefined
): RelationshipType {
  if (sourceHandle === "right-source" && targetHandle === "left-target") return "blocks";
  return "depends_on";
}

function toRFEdge(edge: GraphEdge): GraphRFEdge {
  return {
    id: edge.id,
    // A real, persisted edge — as opposed to a synthetic "bridge" edge
    // filterGraphForDisplay draws across a run of filtered-out nodes, which
    // has no real edge id behind it to splice a tile into and is built
    // through a separate code path that never calls this function at all.
    // InsertableEdge reads this to decide whether to offer its hover "+".
    type: "insertable",
    source: edge.sourceId,
    target: edge.targetId,
    data: { relationshipType: edge.relationshipType, label: edge.label },
  };
}

// Minimal snapshots — just enough to recreate a node/edge via the create
// APIs (which accept a client-chosen id, so undo can restore one with the
// exact id it originally had) — rather than the full server response shape,
// which also carries createdAt/updatedAt that undo has no use for.
interface NodeSnapshot {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status: NodeStatus;
  metadata: NodeMetadata;
  position: { x: number; y: number };
}

interface EdgeSnapshot {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType: RelationshipType;
  label?: string;
}

function snapshotNode(n: GraphRFNode): NodeSnapshot {
  return {
    id: n.id,
    type: n.data.nodeType,
    title: n.data.title,
    description: n.data.description,
    status: n.data.status,
    metadata: n.data.metadata,
    position: n.position,
  };
}

function snapshotEdge(e: GraphRFEdge): EdgeSnapshot {
  return {
    id: e.id,
    sourceId: e.source,
    targetId: e.target,
    relationshipType: e.data!.relationshipType,
    label: e.data?.label,
  };
}

interface UndoableNodeFields {
  title: string;
  description?: string;
  status: NodeStatus;
  metadata: NodeMetadata;
}

// One reversible unit of change. "History entries" (below) group these into
// a single user-perceived action — e.g. deleting a node whose edges cascade
// away server-side bundles the node and each of those edges into one entry,
// so one undo brings all of it back together.
type AtomicOp =
  | { kind: "createNode"; node: NodeSnapshot }
  | { kind: "deleteNode"; node: NodeSnapshot; edges: EdgeSnapshot[] }
  | { kind: "updateNode"; id: string; before: UndoableNodeFields; after: UndoableNodeFields }
  | { kind: "createEdge"; edge: EdgeSnapshot; replaced: EdgeSnapshot | null }
  | { kind: "deleteEdge"; edge: EdgeSnapshot };

type HistoryEntry = AtomicOp[];

// Enough undo/redo depth for a normal editing session without the stacks
// (small JSON snapshots) growing unbounded — old entries are simply
// dropped once this is exceeded.
const MAX_HISTORY = 50;

interface GraphState {
  nodes: GraphRFNode[];
  edges: GraphRFEdge[];
  // Highlighted (border/glow), but still showing the collapsed card — set
  // by clicking the tile itself, the Left Rail, or a relationship/POA&M
  // list entry. Independent of editingId: a tile can be selected without
  // its edit form open, and (via startEditing) is always also selected
  // while its edit form *is* open.
  selectedId: string | null;
  // Which tile's card is showing its full edit form (NodeCardForm) in
  // place of the collapsed view — set by the pencil icon (see
  // GraphNodeCard), or by any entry point that means "select and show me
  // its details" (Left Rail, POA&M/relationship list clicks, a freshly
  // created tile). A plain tile click only ever sets selectedId, never
  // this — see rule below.
  editingId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;
  /**
   * "auto" (the default): every action that changes the graph's shape
   * re-runs arrangeGraph, which owns every tile's position. "manual": tiles
   * are freely draggable and arrangeGraph never touches them; the only way
   * a tile moves is the user dragging it (see moveNode) or dragging one
   * tile onto another to link them (see GraphCanvas's drag handlers).
   */
  placementMode: PlacementMode;

  loadGraph: () => Promise<void>;
  onNodesChange: (changes: NodeChange<GraphRFNode>[]) => void;
  onEdgesChange: (changes: EdgeChange<GraphRFEdge>[]) => void;
  onConnect: (connection: Connection) => Promise<void>;
  onNodesDelete: (nodes: GraphRFNode[]) => Promise<void>;
  onEdgesDelete: (edges: GraphRFEdge[]) => Promise<void>;
  selectNode: (id: string | null) => void;
  startEditing: (id: string) => void;
  stopEditing: () => void;
  clearError: () => void;

  createNode: (input: {
    type: NodeType;
    title: string;
    description?: string;
    status?: NodeStatus;
    metadata?: NodeMetadata;
    position?: { x: number; y: number };
  }) => Promise<GraphRFNode>;
  updateNode: (id: string, patch: UpdateNodePayload) => Promise<void>;
  deleteNode: (id: string) => Promise<void>;
  /**
   * Adds a batch of already-server-created nodes (e.g. from a CSV import
   * commit) into local state in one shot: a single `set()` instead of one
   * per node, one grouped undo entry so Ctrl+Z reverts the whole batch
   * together, and exactly one arrangeGraph() call at the end. Deliberately
   * not implemented as a loop over `createNode`, which would call
   * arrangeGraph (and its position-persisting PATCHes) once per row —
   * wasteful for a batch of dozens/hundreds of imported tiles.
   */
  importPoamNodes: (createdNodes: GraphNode[]) => Promise<void>;
  createEdge: (sourceId: string, targetId: string, relationshipType?: RelationshipType) => Promise<void>;
  /**
   * Splices a brand new tile into an existing edge: the edge's source now
   * blocks (or depends on, matching whatever the original edge's own
   * relationshipType already meant) the new tile instead of the original
   * target, and the new tile takes over blocking the original target — one
   * edge becomes a new tile plus two, never three tiles all still directly
   * linked. `position` is only meaningful in manual mode (see InsertableEdge,
   * which computes the midpoint between the edge's two endpoints); ignored
   * in auto mode, where arrangeGraph places every tile itself regardless of
   * whatever this was set to.
   */
  insertNodeOnEdge: (edgeId: string, type: NodeType, position?: { x: number; y: number }) => Promise<void>;
  /**
   * Recomputes every node's position from the current graph shape (see
   * arrangeNodes in layout.ts) and persists whatever moved. A no-op in
   * manual placement mode — see `placementMode`. Called after every action
   * that can change the graph's shape (load, create/delete node,
   * create/delete edge) to keep auto-mode positions always matching the
   * standardized layout.
   */
  arrangeGraph: () => Promise<void>;
  /**
   * Persists a tile's position after a manual drag (manual mode only —
   * this is the only thing besides arrangeGraph that ever sets position).
   * Not undoable: undo/redo tracks content changes, not where a tile was
   * dragged, matching that dragging was never possible at all before
   * manual mode existed.
   */
  moveNode: (id: string, position: { x: number; y: number }) => Promise<void>;
  /**
   * Switches between auto and manual placement. Auto -> manual is just a
   * flag flip. Manual -> auto re-lays-out using each tile's *current* row
   * as an ordering hint (see arrangeNodes' `resnapOrder`) rather than
   * discarding the manual arrangement for the from-scratch heuristic.
   */
  setPlacementMode: (mode: PlacementMode) => Promise<void>;
  /**
   * Applies a placement mode already persisted server-side (see
   * configStore's settings), without re-persisting it or re-arranging the
   * graph — used once at startup to adopt the saved mode before loadGraph
   * runs, so its own initial arrangeGraph call never auto-arranges (and
   * persists!) a graph that was actually left in manual mode.
   */
  applyLoadedPlacementMode: (mode: PlacementMode) => void;
  /** Reverses the most recent create/delete/edit, if any (Ctrl+Z). */
  undo: () => Promise<void>;
  /** Re-applies the most recently undone action, if any (Ctrl+Y). */
  redo: () => Promise<void>;
}

export const useGraphStore = create<GraphState>((set, get) => {
  // Kept as plain closure variables rather than reactive store fields —
  // nothing needs to re-render off the stacks' contents directly, only off
  // the graph state changes undo/redo produce, which already go through
  // `set`.
  const undoStack: HistoryEntry[] = [];
  const redoStack: HistoryEntry[] = [];
  let historyBusy = false;
  // The layout as of the last arrangeGraph call, keyed by node id — passed
  // back into arrangeNodes so it only has to place nodes that are new since
  // then, instead of relaying out (and potentially reshuffling) everything.
  // See the currentPositions doc comment on arrangeNodes for why.
  let lastArrangedPositions = new Map<string, { x: number; y: number }>();

  function pushHistory(entry: HistoryEntry) {
    if (entry.length === 0) return;
    undoStack.push(entry);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    // A fresh action invalidates whatever redo branch was pending.
    redoStack.length = 0;
  }

  async function rawCreateNode(node: NodeSnapshot): Promise<void> {
    await nodesApi.create({
      id: node.id,
      type: node.type,
      title: node.title,
      description: node.description,
      status: node.status,
      metadata: node.metadata,
      position: node.position,
    });
  }

  async function rawDeleteNode(id: string): Promise<void> {
    await nodesApi.remove(id);
  }

  async function rawUpdateNode(id: string, fields: UndoableNodeFields): Promise<void> {
    await nodesApi.update(id, fields);
  }

  async function rawCreateEdge(edge: EdgeSnapshot): Promise<void> {
    await edgesApi.create({
      id: edge.id,
      sourceId: edge.sourceId,
      targetId: edge.targetId,
      relationshipType: edge.relationshipType,
      label: edge.label,
    });
  }

  async function rawDeleteEdge(id: string): Promise<void> {
    await edgesApi.remove(id);
  }

  // Shared by arrangeGraph and setPlacementMode's auto branch: diff a
  // freshly computed layout against each node's current position, apply
  // only what actually moved, and persist those via PATCH.
  async function applyArrangedPositions(positions: Map<string, { x: number; y: number }>): Promise<void> {
    const changed: { id: string; position: { x: number; y: number } }[] = [];
    set({
      nodes: get().nodes.map((n) => {
        const next = positions.get(n.id);
        if (!next || (next.x === n.position.x && next.y === n.position.y)) return n;
        changed.push({ id: n.id, position: next });
        return { ...n, position: next };
      }),
    });
    if (changed.length === 0) return;
    try {
      await Promise.all(changed.map((c) => nodesApi.updatePosition(c.id, c.position)));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to save tile positions" });
    }
  }

  async function refreshGraph(): Promise<void> {
    const graph = await graphApi.get();
    const nodes = graph.nodes.map(toRFNode);
    set({
      nodes,
      edges: graph.edges.map(toRFEdge),
      selectedId: nodes.some((n) => n.id === get().selectedId) ? get().selectedId : null,
      editingId: nodes.some((n) => n.id === get().editingId) ? get().editingId : null,
    });
    await get().arrangeGraph();
  }

  async function applyInverse(op: AtomicOp): Promise<void> {
    switch (op.kind) {
      case "createNode":
        await rawDeleteNode(op.node.id);
        return;
      case "deleteNode":
        await rawCreateNode(op.node);
        for (const edge of op.edges) await rawCreateEdge(edge);
        return;
      case "updateNode":
        await rawUpdateNode(op.id, op.before);
        return;
      case "createEdge":
        await rawDeleteEdge(op.edge.id);
        if (op.replaced) await rawCreateEdge(op.replaced);
        return;
      case "deleteEdge":
        await rawCreateEdge(op.edge);
        return;
    }
  }

  async function applyForward(op: AtomicOp): Promise<void> {
    switch (op.kind) {
      case "createNode":
        await rawCreateNode(op.node);
        return;
      case "deleteNode":
        await rawDeleteNode(op.node.id);
        return;
      case "updateNode":
        await rawUpdateNode(op.id, op.after);
        return;
      case "createEdge":
        // Recreating with the same id reproduces the original silent
        // replacement of `replaced` too, if it's still present to replace.
        await rawCreateEdge(op.edge);
        return;
      case "deleteEdge":
        await rawDeleteEdge(op.edge.id);
        return;
    }
  }

  return {
  nodes: [],
  edges: [],
  selectedId: null,
  editingId: null,
  status: "idle",
  error: null,
  placementMode: "auto",

  loadGraph: async () => {
    set({ status: "loading", error: null });
    undoStack.length = 0;
    redoStack.length = 0;
    lastArrangedPositions = new Map();
    try {
      const graph = await graphApi.get();
      set({
        nodes: graph.nodes.map(toRFNode),
        edges: graph.edges.map(toRFEdge),
        status: "ready",
      });
      await get().arrangeGraph();
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Failed to load graph" });
    }
  },

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: async (connection) => {
    if (!connection.source || !connection.target) return;
    const relationshipType = relationshipTypeForHandles(connection.sourceHandle, connection.targetHandle);
    await get().createEdge(connection.source, connection.target, relationshipType);
  },

  onNodesDelete: async (nodesToDelete) => {
    // Each node's own DELETE request runs concurrently — they're
    // independent server calls, so there's no reason to wait for one to
    // finish before starting the next. attachedEdges is captured up front
    // (before any request goes out) from the one shared `get().edges`
    // snapshot, same as every node saw when this ran sequentially.
    const results = await Promise.all(
      nodesToDelete.map(async (node) => {
        const attachedEdges = get().edges.filter((e) => e.source === node.id || e.target === node.id);
        try {
          await nodesApi.remove(node.id);
          return { node, attachedEdges, ok: true as const };
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            set({ error: err instanceof Error ? err.message : "Failed to delete node" });
          }
          return { node, attachedEdges, ok: false as const };
        }
      })
    );
    const deletedIds = new Set(results.filter((r) => r.ok).map((r) => r.node.id));
    if (deletedIds.size > 0) {
      set({ edges: get().edges.filter((e) => !deletedIds.has(e.source) && !deletedIds.has(e.target)) });
    }
    const ops: AtomicOp[] = results
      .filter((r) => r.ok)
      .map((r) => ({ kind: "deleteNode", node: snapshotNode(r.node), edges: r.attachedEdges.map(snapshotEdge) }));
    if (nodesToDelete.some((n) => n.id === get().selectedId)) {
      set({ selectedId: null });
    }
    if (nodesToDelete.some((n) => n.id === get().editingId)) {
      set({ editingId: null });
    }
    pushHistory(ops);
    await get().arrangeGraph();
  },

  onEdgesDelete: async (edgesToDelete) => {
    const results = await Promise.all(
      edgesToDelete.map(async (edge) => {
        try {
          await edgesApi.remove(edge.id);
          return { edge, ok: true as const };
        } catch (err) {
          if (!(err instanceof ApiError && err.status === 404)) {
            set({ error: err instanceof Error ? err.message : "Failed to delete edge" });
          }
          return { edge, ok: false as const };
        }
      })
    );
    const ops: AtomicOp[] = results
      .filter((r) => r.ok)
      .map((r) => ({ kind: "deleteEdge", edge: snapshotEdge(r.edge) }));
    pushHistory(ops);
    await get().arrangeGraph();
  },

  selectNode: (id) => set({ selectedId: id }),
  // Editing always implies selected too — see editingId's own doc comment
  // on why this pairing exists (zIndex boost, fitView, Delete-key target
  // all key off selectedId, and should keep working the same way whether
  // a tile got there via a plain click or the pencil icon).
  startEditing: (id) => set({ editingId: id, selectedId: id }),
  // Leaves selectedId alone — closing the edit form goes back to "selected
  // but collapsed," not fully deselected, since the user was just working
  // on this exact tile.
  stopEditing: () => set({ editingId: null }),
  clearError: () => set({ error: null }),

  createNode: async (input) => {
    const { nodes, placementMode } = get();
    // In auto mode this is overwritten by arrangeGraph immediately below —
    // just the transient position before that layout pass lands. In manual
    // mode arrangeGraph is a no-op (see its own comment), so a new tile
    // needs a real position up front: append it below whatever's already
    // there, the same "don't guess a spot in the middle" fallback the
    // incremental auto-layout uses for a brand new root.
    const fallbackPosition =
      placementMode === "manual" && nodes.length > 0
        ? { x: 0, y: Math.max(...nodes.map((n) => n.position.y)) + CROSS_STEP }
        : { x: 0, y: 0 };
    const payload: CreateNodePayload = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      status: input.status,
      metadata: input.metadata ?? {},
      position: input.position ?? fallbackPosition,
    };
    const created = await nodesApi.create(payload);
    const rfNode = toRFNode(created);
    // New tile opens straight into its edit form (see NodeCardForm's
    // auto-focus-title effect) — plain selection alone wouldn't show it.
    set({ nodes: [...get().nodes, rfNode], selectedId: rfNode.id, editingId: rfNode.id });
    pushHistory([{ kind: "createNode", node: snapshotNode(rfNode) }]);
    await get().arrangeGraph();
    return get().nodes.find((n) => n.id === rfNode.id) ?? rfNode;
  },

  importPoamNodes: async (createdNodes) => {
    if (createdNodes.length === 0) return;
    const rfNodes = createdNodes.map(toRFNode);
    set({ nodes: [...get().nodes, ...rfNodes] });
    pushHistory(rfNodes.map((n) => ({ kind: "createNode", node: snapshotNode(n) })));
    await get().arrangeGraph();
  },

  updateNode: async (id, patch) => {
    const previous = get().nodes.find((n) => n.id === id);
    const updated = await nodesApi.update(id, patch);
    set({ nodes: get().nodes.map((n) => (n.id === id ? toRFNode(updated) : n)) });
    if (previous) {
      const before: UndoableNodeFields = {
        title: previous.data.title,
        description: previous.data.description,
        status: previous.data.status,
        metadata: previous.data.metadata,
      };
      const after: UndoableNodeFields = {
        title: updated.title,
        description: updated.description,
        status: updated.status,
        metadata: updated.metadata,
      };
      // NodeCardForm's autosave can fire a save whose result is identical to
      // what was already there (most visibly right after a tile is created,
      // when its form opens automatically) — nothing to undo in that case,
      // and recording it anyway would mean Ctrl+Z has to burn a step
      // reverting a no-op before it reaches whatever the user actually did.
      if (JSON.stringify(before) !== JSON.stringify(after)) {
        pushHistory([{ kind: "updateNode", id, before, after }]);
      }
    }
  },

  deleteNode: async (id) => {
    const node = get().nodes.find((n) => n.id === id);
    const attachedEdges = get().edges.filter((e) => e.source === id || e.target === id);

    // Reconnect around the gap this deletion leaves in any blocking chain:
    // for every tile that blocked `id` and every tile `id` blocked, wire a
    // direct edge between them (mirrors the same blocks/depends_on
    // normalization RelationshipsTab's own hook uses) so removing a
    // mid-chain tile doesn't just sever the chain in two — it splices back
    // together, the same way inserting a tile splices apart. Only
    // blocks/depends_on carry that chain meaning; relates_to/remediates
    // links to this tile are simply gone, same as before.
    const blockerIds = new Set<string>();
    const blockedIds = new Set<string>();
    for (const edge of attachedEdges) {
      const relationshipType = edge.data?.relationshipType;
      if (relationshipType === "blocks") {
        if (edge.target === id) blockerIds.add(edge.source);
        if (edge.source === id) blockedIds.add(edge.target);
      } else if (relationshipType === "depends_on") {
        if (edge.source === id) blockerIds.add(edge.target);
        if (edge.target === id) blockedIds.add(edge.source);
      }
    }

    await nodesApi.remove(id);

    const reconnected: GraphRFEdge[] = [];
    for (const blockerId of blockerIds) {
      for (const blockedId of blockedIds) {
        try {
          const created = await edgesApi.create({
            id: crypto.randomUUID(),
            sourceId: blockerId,
            targetId: blockedId,
            relationshipType: "blocks",
          });
          reconnected.push(toRFEdge(created));
        } catch (err) {
          // Already connected some other way (e.g. a direct edge existed
          // alongside the indirect path through the deleted tile) — leaving
          // that alone is correct, nothing to reconnect.
          if (!(err instanceof ApiError && err.status === 409)) throw err;
        }
      }
    }

    set({
      nodes: get().nodes.filter((n) => n.id !== id),
      edges: [...get().edges.filter((e) => e.source !== id && e.target !== id), ...reconnected],
      selectedId: get().selectedId === id ? null : get().selectedId,
      editingId: get().editingId === id ? null : get().editingId,
    });
    if (node) {
      pushHistory([
        { kind: "deleteNode", node: snapshotNode(node), edges: attachedEdges.map(snapshotEdge) },
        ...reconnected.map((e): AtomicOp => ({ kind: "createEdge", edge: snapshotEdge(e), replaced: null })),
      ]);
    }
    await get().arrangeGraph();
  },

  createEdge: async (sourceId, targetId, relationshipType = "depends_on") => {
    try {
      const beforeEdges = get().edges;
      const created = await edgesApi.create({ id: crypto.randomUUID(), sourceId, targetId, relationshipType });
      // Re-fetch rather than append: creating a blocks/depends_on edge may
      // have silently removed a conflicting opposite-direction edge
      // server-side (no circular two-node dependencies), so the local list
      // can't just be appended to — it needs to match the server exactly.
      const allEdges = await edgesApi.list();
      const afterIds = new Set(allEdges.map((e) => e.id));
      const replaced = beforeEdges.find((e) => !afterIds.has(e.id));
      set({ edges: allEdges.map(toRFEdge) });
      pushHistory([
        {
          kind: "createEdge",
          edge: {
            id: created.id,
            sourceId: created.sourceId,
            targetId: created.targetId,
            relationshipType: created.relationshipType,
            label: created.label,
          },
          replaced: replaced ? snapshotEdge(replaced) : null,
        },
      ]);
      await get().arrangeGraph();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create edge" });
    }
  },

  insertNodeOnEdge: async (edgeId, type, position) => {
    const edge = get().edges.find((e) => e.id === edgeId);
    if (!edge) return;
    const relationshipType = edge.data!.relationshipType;
    try {
      const createdNode = await nodesApi.create({
        id: crypto.randomUUID(),
        type,
        title: "",
        metadata: {},
        position: position ?? { x: 0, y: 0 },
      });
      await edgesApi.remove(edge.id);
      const createdEdge1 = await edgesApi.create({
        id: crypto.randomUUID(),
        sourceId: edge.source,
        targetId: createdNode.id,
        relationshipType,
      });
      const createdEdge2 = await edgesApi.create({
        id: crypto.randomUUID(),
        sourceId: createdNode.id,
        targetId: edge.target,
        relationshipType,
      });

      const rfNode = toRFNode(createdNode);
      set({
        nodes: [...get().nodes, rfNode],
        edges: [...get().edges.filter((e) => e.id !== edge.id), toRFEdge(createdEdge1), toRFEdge(createdEdge2)],
        selectedId: rfNode.id,
        editingId: rfNode.id,
      });
      pushHistory([
        { kind: "createNode", node: snapshotNode(rfNode) },
        { kind: "deleteEdge", edge: snapshotEdge(edge) },
        {
          kind: "createEdge",
          edge: {
            id: createdEdge1.id,
            sourceId: createdEdge1.sourceId,
            targetId: createdEdge1.targetId,
            relationshipType: createdEdge1.relationshipType,
            label: createdEdge1.label,
          },
          replaced: null,
        },
        {
          kind: "createEdge",
          edge: {
            id: createdEdge2.id,
            sourceId: createdEdge2.sourceId,
            targetId: createdEdge2.targetId,
            relationshipType: createdEdge2.relationshipType,
            label: createdEdge2.label,
          },
          replaced: null,
        },
      ]);
      await get().arrangeGraph();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to insert tile" });
    }
  },

  undo: async () => {
    if (historyBusy) return;
    const entry = undoStack.pop();
    if (!entry) return;
    historyBusy = true;
    redoStack.push(entry);
    if (redoStack.length > MAX_HISTORY) redoStack.shift();
    try {
      for (let i = entry.length - 1; i >= 0; i--) await applyInverse(entry[i]);
      await refreshGraph();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to undo" });
    } finally {
      historyBusy = false;
    }
  },

  redo: async () => {
    if (historyBusy) return;
    const entry = redoStack.pop();
    if (!entry) return;
    historyBusy = true;
    undoStack.push(entry);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    try {
      for (const op of entry) await applyForward(op);
      await refreshGraph();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to redo" });
    } finally {
      historyBusy = false;
    }
  },

  arrangeGraph: async () => {
    const { nodes, edges, placementMode } = get();
    if (nodes.length === 0 || placementMode === "manual") return;
    const positions = arrangeNodes(
      nodes.map((n) => n.id),
      edges.map((e) => ({ source: e.source, target: e.target, data: e.data })),
      lastArrangedPositions
    );
    lastArrangedPositions = positions;
    await applyArrangedPositions(positions);
  },

  moveNode: async (id, position) => {
    const { nodes } = get();
    set({ nodes: nodes.map((n) => (n.id === id ? { ...n, position } : n)) });
    lastArrangedPositions.set(id, position);
    try {
      await nodesApi.updatePosition(id, position);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to save tile position" });
    }
  },

  setPlacementMode: async (mode) => {
    // Fire-and-forget: this is a same-machine loopback call, and the local
    // state below already updates immediately — no reason to block the UI
    // on the round trip.
    useConfigStore.getState().updateAppSettings({ placementMode: mode });
    if (mode === "auto") {
      const { nodes, edges } = get();
      set({ placementMode: "auto" });
      if (nodes.length === 0) return;
      const currentPositions = new Map(nodes.map((n) => [n.id, n.position]));
      const positions = arrangeNodes(
        nodes.map((n) => n.id),
        edges.map((e) => ({ source: e.source, target: e.target, data: e.data })),
        currentPositions,
        { resnapOrder: true }
      );
      lastArrangedPositions = positions;
      await applyArrangedPositions(positions);
    } else {
      set({ placementMode: "manual" });
    }
  },

  applyLoadedPlacementMode: (mode) => set({ placementMode: mode }),
  };
});
