import path from "node:path";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "data");
mkdirSync(dataDir, { recursive: true });

const dbPath = path.join(dataDir, "independance.db");
const port = process.env.PORT ? Number(process.env.PORT) : 5175;

const app = createApp({ dbPath });

app.listen(port, () => {
  console.log(`independance server listening on http://localhost:${port}`);
});
