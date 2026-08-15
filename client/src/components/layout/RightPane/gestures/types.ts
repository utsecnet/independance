import type { ReactFlowInstance } from "@xyflow/react";
import type { GraphRFEdge, GraphRFNode, useGraphStore } from "../../../../state/store";

export interface GestureContext {
  paneEl: HTMLElement | null;
  reactFlowInstance: ReactFlowInstance<GraphRFNode, GraphRFEdge> | null;
  store: typeof useGraphStore;
}

export interface GraphGesture {
  id: string;
  description: string;
  /** Wire up the gesture and return a cleanup/detach function. */
  attach: (ctx: GestureContext) => () => void;
}
