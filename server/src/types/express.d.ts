export {};

declare global {
  namespace Express {
    interface Request {
      /** Set by requireBoard (see middleware/board.ts) before any
       * board-scoped router runs. */
      boardId: string;
    }
  }
}
