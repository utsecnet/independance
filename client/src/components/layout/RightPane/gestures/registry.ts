import type { GraphGesture } from "./types";
import { dragConnectGesture } from "./dragConnect";
import { dragOverlapLinkGesture } from "./dragOverlapLink";

/**
 * Every mouse gesture the graph canvas supports. Add a new gesture by
 * implementing GraphGesture (see dragConnect.ts) and appending it here —
 * the data layer (Zustand store CRUD actions) never needs to change.
 */
export const gestureRegistry: GraphGesture[] = [dragConnectGesture, dragOverlapLinkGesture];
