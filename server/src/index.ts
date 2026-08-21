import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// The portable build sets INDEPENDANCE_DATA_DIR to a folder inside its own
// distribution (see build-portable.mjs) so the DB and settings travel with
// it as one unit. Unset in normal dev/build, where the relative default
// (next to wherever this file itself lives) is what's always been used.
const dataDir = process.env.INDEPENDANCE_DATA_DIR
  ? path.resolve(process.env.INDEPENDANCE_DATA_DIR)
  : path.join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "independance.db");
const parsedPort = process.env.PORT ? Number(process.env.PORT) : NaN;
const port = Number.isInteger(parsedPort) && parsedPort > 0 ? parsedPort : 5175;

const { app } = createApp({ dbPath });

// Explicit host, not just a port — app.listen(port, cb) with no host binds
// every interface (0.0.0.0), not just this machine, so without this the
// unauthenticated API is reachable from anything else on the LAN despite
// this being a single-user, local-only tool. 127.0.0.1 keeps it actually
// local: only processes on this same machine can reach it.
app.listen(port, "127.0.0.1", () => {
  console.log(`independance server listening on http://localhost:${port}`);
});
