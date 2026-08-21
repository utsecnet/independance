import { create } from "zustand";

function fieldKey(typeId: string, fieldId: string): string {
  return `${typeId}::${fieldId}`;
}

interface FilterState {
  /** Node type ids currently hidden from the map. Empty = show every type. */
  hiddenTypeIds: Set<string>;
  /**
   * Hidden values for a (type, field) pair, keyed by `${typeId}::${fieldId}`
   * (see fieldKey) — the same field id (e.g. "status") means something
   * different on each node type, so its hidden-value set is tracked per
   * type rather than globally. An absent key or empty set means "show every
   * value" for that field, same convention as hiddenTypeIds.
   */
  hiddenFieldValues: Map<string, Set<string>>;
  toggleType: (typeId: string) => void;
  toggleFieldValue: (typeId: string, fieldId: string, value: string) => void;
  resetFilters: () => void;
}

export const useFilterStore = create<FilterState>((set, get) => ({
  hiddenTypeIds: new Set(),
  hiddenFieldValues: new Map(),

  toggleType: (typeId) => {
    const next = new Set(get().hiddenTypeIds);
    if (next.has(typeId)) next.delete(typeId);
    else next.add(typeId);
    set({ hiddenTypeIds: next });
  },

  toggleFieldValue: (typeId, fieldId, value) => {
    const key = fieldKey(typeId, fieldId);
    const nextMap = new Map(get().hiddenFieldValues);
    const nextSet = new Set(nextMap.get(key));
    if (nextSet.has(value)) nextSet.delete(value);
    else nextSet.add(value);
    if (nextSet.size > 0) nextMap.set(key, nextSet);
    else nextMap.delete(key);
    set({ hiddenFieldValues: nextMap });
  },

  resetFilters: () => set({ hiddenTypeIds: new Set(), hiddenFieldValues: new Map() }),
}));

export { fieldKey };
