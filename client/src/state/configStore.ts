import { create } from "zustand";
import type { AppSettings, NodeStatusConfig, NodeTypeConfig } from "@independance/shared";
import { DEFAULT_LINK_ORIENTATION, DEFAULT_TILE_FIELDS } from "@independance/shared";
import { nodeTypesApi, type CreateNodeTypePayload, type UpdateNodeTypePayload } from "../api/nodeTypes";
import { statusesApi, type CreateStatusPayload, type UpdateStatusPayload } from "../api/statuses";
import { appSettingsApi, type UpdateAppSettingsPayload } from "../api/appSettings";

interface ConfigState {
  nodeTypes: NodeTypeConfig[];
  statuses: NodeStatusConfig[];
  tileFields: AppSettings["tileFields"];
  linkOrientation: AppSettings["linkOrientation"];
  status: "idle" | "loading" | "ready" | "error";
  error: string | null;

  loadConfig: () => Promise<void>;
  loadAppSettings: () => Promise<void>;
  updateAppSettings: (payload: UpdateAppSettingsPayload) => Promise<void>;
  clearError: () => void;

  createNodeType: (payload: CreateNodeTypePayload) => Promise<void>;
  updateNodeType: (id: string, payload: UpdateNodeTypePayload) => Promise<void>;
  deleteNodeType: (id: string) => Promise<void>;

  createStatus: (payload: CreateStatusPayload) => Promise<void>;
  updateStatus: (id: string, payload: UpdateStatusPayload) => Promise<void>;
  deleteStatus: (id: string) => Promise<void>;
}

export const useConfigStore = create<ConfigState>((set, get) => ({
  nodeTypes: [],
  statuses: [],
  tileFields: DEFAULT_TILE_FIELDS,
  linkOrientation: DEFAULT_LINK_ORIENTATION,
  status: "idle",
  error: null,

  loadConfig: async () => {
    set({ status: "loading", error: null });
    try {
      const [nodeTypes, statuses] = await Promise.all([nodeTypesApi.list(), statusesApi.list()]);
      set({ nodeTypes, statuses, status: "ready" });
    } catch (err) {
      set({ status: "error", error: err instanceof Error ? err.message : "Failed to load settings" });
    }
    get().loadAppSettings();
  },

  loadAppSettings: async () => {
    try {
      const settings = await appSettingsApi.get();
      set({ tileFields: settings.tileFields, linkOrientation: settings.linkOrientation });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load appearance settings" });
    }
  },

  updateAppSettings: async (payload) => {
    try {
      const settings = await appSettingsApi.update(payload);
      set({ tileFields: settings.tileFields, linkOrientation: settings.linkOrientation });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update appearance settings" });
    }
  },

  clearError: () => set({ error: null }),

  createNodeType: async (payload) => {
    try {
      const type = await nodeTypesApi.create(payload);
      set({ nodeTypes: [...get().nodeTypes, type] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create type" });
    }
  },

  updateNodeType: async (id, payload) => {
    try {
      const type = await nodeTypesApi.update(id, payload);
      set({ nodeTypes: get().nodeTypes.map((t) => (t.id === id ? type : t)) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update type" });
    }
  },

  deleteNodeType: async (id) => {
    try {
      await nodeTypesApi.remove(id);
      set({
        nodeTypes: get().nodeTypes.filter((t) => t.id !== id),
        statuses: get().statuses.filter((s) => s.typeId !== id),
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete type" });
    }
  },

  createStatus: async (payload) => {
    try {
      const status = await statusesApi.create(payload);
      const statuses = payload.isDefault
        ? get().statuses.map((s) => (s.typeId === payload.typeId ? { ...s, isDefault: false } : s))
        : get().statuses;
      set({ statuses: [...statuses, status] });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to create status" });
    }
  },

  updateStatus: async (id, payload) => {
    try {
      const updated = await statusesApi.update(id, payload);
      const statuses = payload.isDefault
        ? get().statuses.map((s) => (s.typeId === updated.typeId && s.id !== id ? { ...s, isDefault: false } : s))
        : get().statuses;
      set({ statuses: statuses.map((s) => (s.id === id ? updated : s)) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to update status" });
    }
  },

  deleteStatus: async (id) => {
    try {
      await statusesApi.remove(id);
      set({ statuses: get().statuses.filter((s) => s.id !== id) });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to delete status" });
    }
  },
}));
