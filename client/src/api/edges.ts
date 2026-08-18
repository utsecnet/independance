import type { GraphEdge, RelationshipType } from "@independance/shared";
import { api } from "./client";

export interface CreateEdgePayload {
  id: string;
  sourceId: string;
  targetId: string;
  relationshipType?: RelationshipType;
  label?: string;
}

export const edgesApi = {
  list: () => api.get<GraphEdge[]>("/edges"),
  create: (payload: CreateEdgePayload) => api.post<GraphEdge>("/edges", payload),
  remove: (id: string) => api.delete(`/edges/${id}`),
};
