import { create } from "zustand";

interface QuickAddMenuState {
  /** Uniquely identifies whichever QuickAddButton's menu is currently open (`${nodeId}-${axis}`), or null if none is. Shared across every instance so opening one always closes any other — only one item-type picker can ever be on screen at once. */
  openKey: string | null;
  setOpenKey: (key: string | null) => void;
}

export const useQuickAddMenuStore = create<QuickAddMenuState>((set) => ({
  openKey: null,
  setOpenKey: (key) => set({ openKey: key }),
}));
