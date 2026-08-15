import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createNodeSchema, updateNodePositionSchema, updateNodeSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as nodeService from "../services/nodeService.js";

export function nodesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(nodeService.listNodes(db));
  });

  router.get("/:id", (req, res) => {
    res.json(nodeService.getNodeOrThrow(db, req.params.id));
  });

  router.post("/", validateBody(createNodeSchema), (req, res) => {
    const node = nodeService.createNode(db, req.body);
    res.status(201).json(node);
  });

  router.patch("/:id", validateBody(updateNodeSchema), (req, res) => {
    const node = nodeService.updateNode(db, req.params.id, req.body);
    res.json(node);
  });

  router.patch("/:id/position", validateBody(updateNodePositionSchema), (req, res) => {
    const node = nodeService.updateNodePosition(db, req.params.id, req.body);
    res.json(node);
  });

  router.delete("/:id", (req, res) => {
    nodeService.deleteNode(db, req.params.id);
    res.status(204).send();
  });

  return router;
}

