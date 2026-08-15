import type { GraphGesture } from "./types";

/**
 * Drag one tile over another and hold for 500ms to link them without using
 * the handle-drag gesture: hovering the target's bottom half means the
 * dragged tile blocks it; hovering the top half means the dragged tile is
 * blocked by (depends on) it. Handled via React Flow's onNodeDragStart /
 * onNodeDrag / onNodeDragStop props directly in GraphCanvas + the store's
 * dropHover/dragLinkSessions bookkeeping (store.ts) — those props are RF's
 * own drag lifecycle, not a DOM event this registry's attach() would
 * otherwise be needed for. Registered here so it's discoverable in the full
 * gesture inventory alongside dragConnect.
 */
export const dragOverlapLinkGesture: GraphGesture = {
  id: "drag-overlap-link",
  description: "Drag a tile over another and hold 0.5s: bottom half = blocks, top half = blocked by.",
  attach: () => () => {},
};
