import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createNodeTypeSchema, updateNodeTypeSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as nodeTypeService from "../services/nodeTypeService.js";

export function nodeTypesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(nodeTypeService.listNodeTypes(db));
  });

  router.post("/", validateBody(createNodeTypeSchema), (req, res) => {
    const type = nodeTypeService.createNodeType(db, req.body);
    res.status(201).json(type);
  });

  router.patch("/:id", validateBody(updateNodeTypeSchema), (req, res) => {
    const type = nodeTypeService.updateNodeType(db, req.params.id, req.body);
    res.json(type);
  });

  router.delete("/:id", (req, res) => {
    nodeTypeService.deleteNodeType(db, req.params.id);
    res.status(204).send();
  });

  return router;
}
