import type { AppSettings } from "@independance/shared";
import { api } from "./client";

export interface UpdateAppSettingsPayload {
  tileFields?: AppSettings["tileFields"];
  linkOrientation?: AppSettings["linkOrientation"];
}

export const appSettingsApi = {
  get: () => api.get<AppSettings>("/settings"),
  update: (payload: UpdateAppSettingsPayload) => api.patch<AppSettings>("/settings", payload),
};
