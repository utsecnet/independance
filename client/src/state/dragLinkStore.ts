import { create } from "zustand";

export type DropHalf = "left" | "right";

export interface DropHover {
  targetId: string;
  half: DropHalf;
}

interface DragLinkState {
  /**
   * Which tile (and which half of it) a manually-dragged tile is currently
   * hovering over, if any — read by that tile's own GraphNodeCard to show
   * the "blocks this" / "blocked by this" hint, and by GraphCanvas to
   * highlight it. Ephemeral UI-only interaction state, not app data, so it
   * lives in its own small store (same pattern as quickAddMenuStore/
   * filterStore) rather than the graph store or React Flow's own node data.
   */
  dropHover: DropHover | null;
  setDropHover: (hover: DropHover | null) => void;
}

export const useDragLinkStore = create<DragLinkState>((set) => ({
  dropHover: null,
  setDropHover: (dropHover) => set({ dropHover }),
}));
