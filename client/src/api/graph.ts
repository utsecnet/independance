import type { GraphPayload } from "@independance/shared";
import { api } from "./client";

export const graphApi = {
  get: () => api.get<GraphPayload>("/graph"),
};
