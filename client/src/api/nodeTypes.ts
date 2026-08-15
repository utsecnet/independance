import type { NodeTypeConfig } from "@independance/shared";
import { api } from "./client";

export interface CreateNodeTypePayload {
  id: string;
  label: string;
  color: string;
}

export interface UpdateNodeTypePayload {
  label?: string;
  color?: string;
  sortOrder?: number;
}

export const nodeTypesApi = {
  list: () => api.get<NodeTypeConfig[]>("/node-types"),
  create: (payload: CreateNodeTypePayload) => api.post<NodeTypeConfig>("/node-types", payload),
  update: (id: string, payload: UpdateNodeTypePayload) => api.patch<NodeTypeConfig>(`/node-types/${id}`, payload),
  remove: (id: string) => api.delete(`/node-types/${id}`),
};
