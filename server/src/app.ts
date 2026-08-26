import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { DatabaseSync } from "node:sqlite";
import { createDb } from "./db/connection.js";
import { healthRouter } from "./routes/health.js";
import { boardsRouter } from "./routes/boards.js";
import { nodesRouter } from "./routes/nodes.js";
import { edgesRouter } from "./routes/edges.js";
import { graphRouter } from "./routes/graph.js";
import { nodeTypesRouter } from "./routes/nodeTypes.js";
import { statusesRouter } from "./routes/statuses.js";
import { appSettingsRouter } from "./routes/appSettings.js";
import { backupRouter } from "./routes/backup.js";
import { requireBoard } from "./middleware/board.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CreateAppOptions {
  dbPath: string;
}

// Returns the raw db handle alongside the app (rather than just the app)
// so a caller that opens many short-lived instances — every test file's own
// createTestApp, one fresh :memory: database per test — has something to
// call .close() on afterward instead of just letting each one go
// unreferenced and rely on GC to reclaim its native handle eventually. The
// long-running server process (index.ts) has no equivalent need since it
// only ever opens one, for its own full lifetime, but takes the same shape
// for a single, consistent createApp contract.
export function createApp({ dbPath }: CreateAppOptions): { app: Express; db: DatabaseSync } {
  const db = createDb(dbPath);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  // Unscoped: switching boards has to work before a board is even selected.
  app.use("/api/boards", boardsRouter(db));

  // Everything below operates on one board, resolved from the X-Board-Id
  // header (defaulting to "default" — see requireBoard's own doc comment).
  app.use("/api", requireBoard(db));
  app.use("/api/nodes", nodesRouter(db));
  app.use("/api/edges", edgesRouter(db));
  app.use("/api/graph", graphRouter(db));
  app.use("/api/node-types", nodeTypesRouter(db));
  app.use("/api/statuses", statusesRouter(db));
  app.use("/api/settings", appSettingsRouter(db));
  app.use("/api/backup", backupRouter(db));

  // The portable build's launcher points CLIENT_DIST_DIR at its bundled
  // static client so one process serves both the API and the UI on one
  // port. No-op in the normal dev/build workflow, where the client is
  // served separately by Vite's own dev server and this directory won't
  // exist — express.static's default index.html handling for "/" is all
  // this single-page, router-less app ever needs.
  const clientDistDir = process.env.CLIENT_DIST_DIR
    ? path.resolve(process.env.CLIENT_DIST_DIR)
    : path.join(__dirname, "..", "..", "client", "dist");
  if (existsSync(clientDistDir)) {
    app.use(express.static(clientDistDir));
  }

  app.use(errorHandler);

  return { app, db };
}

