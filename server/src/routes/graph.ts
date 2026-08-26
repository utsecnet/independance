import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import type { GraphPayload } from "@independance/shared";
import * as nodeService from "../services/nodeService.js";
import * as edgeService from "../services/edgeService.js";

export function graphRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (req, res) => {
    const payload: GraphPayload = {
      nodes: nodeService.listNodes(db, req.boardId),
      edges: edgeService.listEdges(db, req.boardId),
    };
    res.json(payload);
  });

  return router;
}
