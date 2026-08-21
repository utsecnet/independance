import { create } from "zustand";

interface EdgeHoverState {
  /**
   * Which edge's insert (+) button is currently shown, if any — mirrors
   * hoverStore.ts exactly, but kept as a fully separate store rather than
   * sharing one id-space with tile hover. See hoverStore.ts's own doc
   * comment for why: a tile's quick-add button sits right where its own
   * connecting edge visually runs, so the cursor crossing the edge's wide
   * hit-area en route to the button would otherwise overwrite a shared
   * value with the edge's id mid-transit, blanking the tile's buttons
   * before the click landed.
   */
  hoveredEdgeId: string | null;
  setHovered: (id: string) => void;
  /** Only clears if `id` is still the hovered one — a stale delayed clear
   * from an edge the pointer already left must not blank out whichever
   * edge is hovered now. */
  clearHovered: (id: string) => void;
}

export const useEdgeHoverStore = create<EdgeHoverState>((set, get) => ({
  hoveredEdgeId: null,
  setHovered: (id) => set({ hoveredEdgeId: id }),
  clearHovered: (id) => {
    if (get().hoveredEdgeId === id) set({ hoveredEdgeId: null });
  },
}));
