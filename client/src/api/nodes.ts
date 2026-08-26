import type { BulkImportPoamsResult, GraphNode, NodeMetadata, NodeStatus, NodeType, RawPoamCsvRow } from "@independance/shared";
import { api } from "./client";

export interface CreateNodePayload {
  id: string;
  type: NodeType;
  title: string;
  description?: string;
  status?: NodeStatus;
  metadata?: NodeMetadata;
  position: { x: number; y: number };
}

export interface UpdateNodePayload {
  title?: string;
  description?: string;
  status?: NodeStatus;
  metadata?: NodeMetadata;
}

export const nodesApi = {
  list: () => api.get<GraphNode[]>("/nodes"),
  create: (payload: CreateNodePayload) => api.post<GraphNode>("/nodes", payload),
  update: (id: string, payload: UpdateNodePayload) => api.patch<GraphNode>(`/nodes/${id}`, payload),
  updatePosition: (id: string, position: { x: number; y: number }) =>
    api.patch<GraphNode>(`/nodes/${id}/position`, { position }),
  remove: (id: string) => api.delete(`/nodes/${id}`),
  bulkImportPoams: (payload: { rows: RawPoamCsvRow[]; dryRun?: boolean }) =>
    api.post<BulkImportPoamsResult>("/nodes/import-poams", payload),
};
