import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { updateAppSettingsSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as appSettingsService from "../services/appSettingsService.js";

export function appSettingsRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(appSettingsService.getSettings(db, req.boardId));
  });

  router.patch("/", validateBody(updateAppSettingsSchema), (req, res) => {
    res.json(appSettingsService.updateSettings(db, req.boardId, req.body));
  });

  return router;
}
