import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createDb } from "./db/connection.js";
import { healthRouter } from "./routes/health.js";
import { nodesRouter } from "./routes/nodes.js";
import { edgesRouter } from "./routes/edges.js";
import { graphRouter } from "./routes/graph.js";
import { nodeTypesRouter } from "./routes/nodeTypes.js";
import { statusesRouter } from "./routes/statuses.js";
import { appSettingsRouter } from "./routes/appSettings.js";
import { errorHandler } from "./middleware/errorHandler.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export interface CreateAppOptions {
  dbPath: string;
}

export function createApp({ dbPath }: CreateAppOptions): Express {
  const db = createDb(dbPath);

  const app = express();
  app.use(cors());
  app.use(express.json());

  app.use("/api", healthRouter);
  app.use("/api/nodes", nodesRouter(db));
  app.use("/api/edges", edgesRouter(db));
  app.use("/api/graph", graphRouter(db));
  app.use("/api/node-types", nodeTypesRouter(db));
  app.use("/api/statuses", statusesRouter(db));
  app.use("/api/settings", appSettingsRouter(db));

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

  return app;
}

