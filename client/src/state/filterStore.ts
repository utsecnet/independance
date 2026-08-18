import { create } from "zustand";

interface FilterState {
  /** Node type ids currently hidden from the map. Empty = show every type. */
  hiddenTypeIds: Set<string>;
  /** Severity values currently hidden (POA&M nodes only). Empty = show every severity. */
  hiddenSeverities: Set<string>;
  toggleType: (typeId: string) => void;
  toggleSeverity: (severity: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  hiddenTypeIds: new Set(),
  hiddenSeverities: new Set(),

  toggleType: (typeId) => {
    const next = new Set(get().hiddenTypeIds);
    if (next.has(typeId)) next.delete(typeId);
    else next.add(typeId);
    set({ hiddenTypeIds: next });
  },

  toggleSeverity: (severity) => {
    const next = new Set(get().hiddenSeverities);
    if (next.has(severity)) next.delete(severity);
    else next.add(severity);
    set({ hiddenSeverities: next });
  },

  resetFilters: () => set({ hiddenTypeIds: new Set(), hiddenSeverities: new Set() }),
}));
