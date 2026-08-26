import type { FullBackup } from "@independance/shared";
import { api } from "./client";

export interface RestoreResult {
  nodeTypeCount: number;
  statusCount: number;
  nodeCount: number;
  edgeCount: number;
}

export const backupApi = {
  export: () => api.get<FullBackup>("/backup"),
  restore: (backup: FullBackup) => api.post<RestoreResult>("/backup/restore", backup),
};
