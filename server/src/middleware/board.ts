import type { NextFunction, Request, Response } from "express";
import type { DatabaseSync } from "node:sqlite";
import * as boardQueries from "../db/queries/boards.js";
import { HttpError } from "./errorHandler.js";

/**
 * Resolves which board a request targets from the X-Board-Id header,
 * defaulting to the literal id "default" when absent — the board every
 * fresh/upgraded install always has (see 004_boards.sql) — rather than
 * rejecting. That default is what lets every pre-multi-board API consumer
 * (including the whole existing test suite) keep working unmodified: "no
 * header" and "explicitly select the original board" behave identically.
 */
export function requireBoard(db: DatabaseSync) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const boardId = req.header("X-Board-Id") || "default";
    if (!boardQueries.getBoard(db, boardId)) {
      throw new HttpError(404, "not_found", `Board "${boardId}" not found`);
    }
    req.boardId = boardId;
    next();
  };
}
