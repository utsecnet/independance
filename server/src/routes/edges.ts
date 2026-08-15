import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createEdgeSchema, updateEdgeSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as edgeService from "../services/edgeService.js";

export function edgesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(edgeService.listEdges(db));
  });

  router.post("/", validateBody(createEdgeSchema), (req, res) => {
    const edge = edgeService.createEdge(db, req.body);
    res.status(201).json(edge);
  });

  router.patch("/:id", validateBody(updateEdgeSchema), (req, res) => {
    const edge = edgeService.updateEdge(db, req.params.id, req.body);
    res.json(edge);
  });

  router.delete("/:id", (req, res) => {
    edgeService.deleteEdge(db, req.params.id);
    res.status(204).send();
  });

  return router;
}

