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

const app = createApp({ dbPath });

app.listen(port, () => {
  console.log(`independance server listening on http://localhost:${port}`);
});
