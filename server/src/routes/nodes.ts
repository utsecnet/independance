import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { bulkImportPoamsSchema, createNodeSchema, updateNodePositionSchema, updateNodeSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as nodeService from "../services/nodeService.js";
import * as poamImportService from "../services/poamImportService.js";

export function nodesRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (req, res) => {
    res.json(nodeService.listNodes(db, req.boardId));
  });

  router.get("/:id", (req, res) => {
    res.json(nodeService.getNodeOrThrow(db, req.boardId, req.params.id));
  });

  router.post("/", validateBody(createNodeSchema), (req, res) => {
    const node = nodeService.createNode(db, req.boardId, req.body);
    res.status(201).json(node);
  });

  // Mixed-batch result (some rows created, some skipped) rather than one
  // created resource, so this returns 200 rather than 201.
  router.post("/import-poams", validateBody(bulkImportPoamsSchema), (req, res) => {
    const result = poamImportService.importPoams(db, req.boardId, req.body.rows, { dryRun: req.body.dryRun ?? false });
    res.status(200).json(result);
  });

  router.patch("/:id", validateBody(updateNodeSchema), (req, res) => {
    const node = nodeService.updateNode(db, req.boardId, req.params.id, req.body);
    res.json(node);
  });

  router.patch("/:id/position", validateBody(updateNodePositionSchema), (req, res) => {
    const node = nodeService.updateNodePosition(db, req.boardId, req.params.id, req.body);
    res.json(node);
  });

  router.delete("/:id", (req, res) => {
    nodeService.deleteNode(db, req.boardId, req.params.id);
    res.status(204).send();
  });

  return router;
}
