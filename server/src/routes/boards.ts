import { Router } from "express";
import type { DatabaseSync } from "node:sqlite";
import { createBoardSchema, updateBoardSchema } from "@independance/shared";
import { validateBody } from "../middleware/validate.js";
import * as boardService from "../services/boardService.js";

// Unscoped by design — mounted before requireBoard, since switching boards
// has to work before a board is even selected.
export function boardsRouter(db: DatabaseSync): Router {
  const router = Router();

  router.get("/", (_req, res) => {
    res.json(boardService.listBoards(db));
  });

  router.post("/", validateBody(createBoardSchema), (req, res) => {
    const board = boardService.createBoard(db, req.body);
    res.status(201).json(board);
  });

  router.patch("/:id", validateBody(updateBoardSchema), (req, res) => {
    const board = boardService.updateBoard(db, req.params.id, req.body);
    res.json(board);
  });

  router.delete("/:id", (req, res) => {
    boardService.deleteBoard(db, req.params.id);
    res.status(204).send();
  });

  return router;
}
