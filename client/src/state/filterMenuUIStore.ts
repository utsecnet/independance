import { create } from "zustand";

/**
 * Just "is FilterMenu's panel open" (plus, when opened from somewhere other
 * than its own toolbar button, where it should appear), lifted out of
 * FilterMenu's own local state — same reasoning as quickAddMenuStore: a
 * second trigger (the command wheel's Filter slice) needs to open the same
 * panel from outside the component, which a private useState can't do.
 */
interface FilterMenuUIState {
  open: boolean;
  /** Viewport coordinates (event.clientX/clientY) to open the panel at —
   * set when opened from the command wheel, so it appears where the user's
   * cursor actually is instead of always snapping back to the toolbar
   * button's fixed position. Null (the default toolbar-button open path)
   * means "use the normal position next to the toolbar button." */
  anchor: { x: number; y: number } | null;
  setOpen: (open: boolean, anchor?: { x: number; y: number } | null) => void;
}

export const useFilterMenuOpenStore = create<FilterMenuUIState>((set) => ({
  open: false,
  anchor: null,
  setOpen: (open, anchor = null) => set({ open, anchor }),
}));
