import type { BoardConfig } from "@independance/shared";
import { api } from "./client";

export interface CreateBoardPayload {
  name: string;
}

export interface UpdateBoardPayload {
  name?: string;
  sortOrder?: number;
}

export const boardsApi = {
  list: () => api.get<BoardConfig[]>("/boards"),
  create: (payload: CreateBoardPayload) => api.post<BoardConfig>("/boards", payload),
  update: (id: string, payload: UpdateBoardPayload) => api.patch<BoardConfig>(`/boards/${id}`, payload),
  remove: (id: string) => api.delete(`/boards/${id}`),
};
