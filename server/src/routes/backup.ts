import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { fullBackupSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as backupService from "../services/backupService.js";

export function backupRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(backupService.exportBackup(db, req.boardId));
  });

  router.post("/restore", validateBody(fullBackupSchema), (req, res) => {
    const result = backupService.restoreBackup(db, req.boardId, req.body);
    res.status(200).json(result);
  });

  return router;
}
