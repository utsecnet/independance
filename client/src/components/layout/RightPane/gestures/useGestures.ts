import { useEffect } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useGraphStore, type GraphRFEdge, type GraphRFNode } from "../../../../state/store";
import { gestureRegistry } from "./registry";
import type { GestureContext } from "./types";

export function useGestures(
  paneEl: HTMLElement | null,
  reactFlowInstance: ReactFlowInstance<GraphRFNode, GraphRFEdge> | null
) {
  useEffect(() => {
    const ctx: GestureContext = { paneEl, reactFlowInstance, store: useGraphStore };
    const detachers = gestureRegistry.map((gesture) => gesture.attach(ctx));
    return () => detachers.forEach((detach) => detach());
  }, [paneEl, reactFlowInstance]);
}
