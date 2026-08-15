import type { GraphGesture } from "./types";

/**
 * Drag one tile over another and release to link them without using the
 * handle-drag gesture: in vertical mode (default), hovering the target's
 * bottom half means the dragged tile blocks it, top half means it's
 * blocked by (depends on) it. In horizontal mode (Settings > Appearance),
 * left/right take over that same role: left means the dragged tile blocks
 * the target. The relationship commits at mouse-up, using whichever half
 * was under the pointer at that moment — there is no hold delay. Handled
 * via React Flow's onNodeDragStart / onNodeDrag / onNodeDragStop props
 * directly in GraphCanvas + the store's dropHover/dragLinkSessions
 * bookkeeping (store.ts) — those props are RF's own drag lifecycle, not a
 * DOM event this registry's attach() would otherwise be needed for.
 * Registered here so it's discoverable in the full gesture inventory
 * alongside dragConnect.
 */
export const dragOverlapLinkGesture: GraphGesture = {
  id: "drag-overlap-link",
  description:
    "Drag a tile over another and release: near half (bottom/left) = blocks, far half (top/right) = blocked by.",
  attach: () => () => {},
};
