import { create } from "zustand";

interface HoverState {
  /**
   * Which tile's quick-add (+) buttons are currently shown, if any — a
   * single shared id (same pattern as dragLinkStore's dropHover) rather
   * than per-card local state, so hovering a new tile hides the previous
   * one's buttons immediately instead of waiting out its own hide delay
   * (see GraphNodeCard's hideTimer): only one tile's + buttons should ever
   * be visible at once.
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
