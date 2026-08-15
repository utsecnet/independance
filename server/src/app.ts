import express, { type Express } from "express";
import cors from "cors";
import { createDb } from "./db/connection.js";
import { healthRouter } from "./routes/health.js";
import { nodesRouter } from "./routes/nodes.js";
import { edgesRouter } from "./routes/edges.js";
import { graphRouter } from "./routes/graph.js";
import { errorHandler } from "./middleware/errorHandler.js";

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

  app.use(errorHandler);

  return app;
}

