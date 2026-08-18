import type { AppSettings } from "@independance/shared";
import { api } from "./client";

export interface UpdateAppSettingsPayload {
  tileFields?: AppSettings["tileFields"];
  theme?: AppSettings["theme"];
  placementMode?: AppSettings["placementMode"];
}

export const appSettingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (payload: UpdateAppSettingsPayload) => api.patch<AppSettings>("/settings", payload),
};
