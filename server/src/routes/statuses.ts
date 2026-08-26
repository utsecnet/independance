import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createStatusSchema, updateStatusSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as statusService from "../services/statusService.js";

export function statusesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const typeId = typeof req.query.typeId === "string" ? req.query.typeId : undefined;
    res.json(statusService.listStatuses(db, req.boardId, typeId));
  });

  router.post("/", validateBody(createStatusSchema), (req, res) => {
    const status = statusService.createStatus(db, req.boardId, req.body);
    res.status(201).json(status);
  });

  router.patch("/:id", validateBody(updateStatusSchema), (req, res) => {
    const status = statusService.updateStatus(db, req.boardId, req.params.id, req.body);
    res.json(status);
  });

  router.delete("/:id", (req, res) => {
    statusService.deleteStatus(db, req.boardId, req.params.id);
    res.status(204).send();
  });

  return router;
}
