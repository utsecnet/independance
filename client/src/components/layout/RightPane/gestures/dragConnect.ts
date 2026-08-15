import type { GraphGesture } from "./types";

/**
 * Click-and-drag from one node's handle to another's to create a dependency
 * link. Handled natively by React Flow's `onConnect` prop (wired directly on
 * <ReactFlow> in GraphCanvas) — this entry has nothing to attach, it exists
 * so the full gesture inventory is discoverable in one place alongside
 * future gestures that DO need raw pointer listeners.
 */
export const dragConnectGesture: GraphGesture = {
  id: "drag-connect",
  description: "Drag from a node's handle to another node's handle to link them.",
  attach: () => () => {},
};
