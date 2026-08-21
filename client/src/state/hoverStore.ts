import { create } from "zustand";

interface HoverState {
  /**
   * Which tile's quick-add (+) buttons are currently shown, if any — a
   * single shared id (same pattern as dragLinkStore's dropHover) rather
   * than per-card local state, so hovering a new tile hides the previous
   * one's buttons immediately instead of waiting out its own hide delay
   * (see GraphNodeCard's hideTimer): only one tile's + buttons should ever
   * be visible at once.
   *
   * Tile hover only — edges have their own, separate store (see
   * edgeHoverStore.ts). They used to share this one, keyed by whichever id
   * (node or edge) last called setHovered — but a tile's quick-add button
   * sits right where its own connecting edge visually runs (see
   * QuickAddButton's -34px offset), so the cursor crossing that edge's
   * wide hit-area on the way to the button (see InsertableEdge's .hitArea)
   * would overwrite this with the edge's id mid-transit, instantly hiding
   * the tile's own buttons before the click ever landed — the edge's own
   * insert button would appear in their place instead. Splitting the two
   * concerns into independent stores means grazing an edge can never blank
   * out a tile's hover state, or vice versa.
   */
  hoveredId: string | null;
  setHovered: (id: string) => void;
  /** Only clears if `id` is still the hovered one — a stale delayed clear
   * from a tile the pointer already left must not blank out whichever
   * tile is hovered now. */
  clearHovered: (id: string) => void;
}

export const useHoverStore = create<HoverState>((set, get) => ({
  hoveredId: null,
  setHovered: (id) => set({ hoveredId: id }),
  clearHovered: (id) => {
    if (get().hoveredId === id) set({ hoveredId: null });
  },
}));
