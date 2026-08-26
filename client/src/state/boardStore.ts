import { create } from "zustand";
import type { BoardConfig } from "@independance/shared";
import { boardsApi, type CreateBoardPayload } from "../api/boards";
import { useConfigStore } from "./configStore";
import { useGraphStore } from "./store";
import { useFilterStore } from "./filterStore";

const LAST_BOARD_STORAGE_KEY = "independance.lastBoardId";

interface BoardState {
  boards: BoardConfig[];
  currentBoardId: string | null;
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  /** Fetches every board and resolves + selects the initial one (the
   * last-selected id from localStorage if it still exists, else the
   * first board) — call once, at app bootstrap, before loadConfig/loadGraph. */
  loadBoards: () => Promise<void>;
  /** Switches the active board: sets currentBoardId, persists the choice,
   * and reloads every piece of client state that's board-scoped. */
  selectBoard: (id: string) => Promise<void>;
  createBoard: (payload: CreateBoardPayload) => Promise<void>;
  renameBoard: (id: string, name: string) => Promise<void>;
  deleteBoard: (id: string) => Promise<void>;
  clearError: () => void;
}

async function reloadBoardScopedState() {
  useFilterStore.getState().resetFilters();
  await useConfigStore.getState().loadConfig();
  const loadedMode = useConfigStore.getState().placementMode;
  if (loadedMode) useGraphStore.getState().applyLoadedPlacementMode(loadedMode);
  await useGraphStore.getState().loadGraph();
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  currentBoardId: null,
  status: "idle",
  error: null,

  loadBoards: async () => {
    set({ status: "loading", error: null });
    try {
      const boards = await boardsApi.list();
      const lastId = localStorage.getItem(LAST_BOARD_STORAGE_KEY);
      const initial = boards.find((b) => b.id === lastId) ?? boards[0];
      set({ boards, status: "ready" });
      if (initial) await get().selectBoard(initial.id);
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Failed to load boards" });
    }
  },

  selectBoard: async (id) => {
    set({ currentBoardId: id });
    localStorage.setItem(LAST_BOARD_STORAGE_KEY, id);
    await reloadBoardScopedState();
  },

  createBoard: async (payload) => {
    try {
      const board = await boardsApi.create(payload);
      set({ boards: [...get().boards, board] });
      await get().selectBoard(board.id);
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create board" });
    }
  },

  renameBoard: async (id, name) => {
    try {
      const board = await boardsApi.update(id, { name });
      set({ boards: get().boards.map((b) => (b.id === id ? board : b)) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to rename board" });
    }
  },

  deleteBoard: async (id) => {
    try {
      await boardsApi.remove(id);
      const remaining = get().boards.filter((b) => b.id !== id);
      set({ boards: remaining });
      if (get().currentBoardId === id && remaining[0]) {
        await get().selectBoard(remaining[0].id);
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete board" });
    }
  },

  clearError: () => set({ error: null }),
}));
