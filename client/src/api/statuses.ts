import type { NodeStatusConfig } from "@independance/shared";
import { api } from "./client";

export interface CreateStatusPayload {
  typeId: string;
  value: string;
  label: string;
  isDefault?: boolean;
}

export interface UpdateStatusPayload {
  label?: string;
  sortOrder?: number;
  isDefault?: boolean;
}

export const statusesApi = {
  list: (typeId?: string) => api.get<NodeStatusConfig[]>(typeId ? `/statuses?typeId=${typeId}` : "/statuses"),
  create: (payload: CreateStatusPayload) => api.post<NodeStatusConfig>("/statuses", payload),
  update: (id: string, payload: UpdateStatusPayload) => api.patch<NodeStatusConfig>(`/statuses/${id}`, payload),
  remove: (id: string) => api.delete(`/statuses/${id}`),
};
