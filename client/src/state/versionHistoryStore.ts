import { create } from "zustand";

// Own store, not local component state, because the trigger (LeftRail's
// version link) and the two blades it opens (VersionHistoryOverlay, mounted
// inside mapArea) are siblings, not parent/child — LeftRail sits outside
// mapArea in App's layout, so there's no single component both could share
// state through via props without threading it up through App itself.
interface VersionHistoryState {
  historyOpen: boolean;
  selectedVersion: string | null;
  openHistory: () => void;
  closeHistory: () => void;
  selectVersion: (version: string) => void;
  closeDetail: () => void;
}

export const useVersionHistoryStore = create<VersionHistoryState>((set) => ({
  historyOpen: false,
  selectedVersion: null,

  openHistory: () => set({ historyOpen: true }),
  // Closing history takes whatever it opened (the detail blade) with it —
  // the detail blade can't stay open once its own history table is gone.
  closeHistory: () => set({ historyOpen: false, selectedVersion: null }),
  selectVersion: (version) => set({ selectedVersion: version }),
  closeDetail: () => set({ selectedVersion: null }),
}));
