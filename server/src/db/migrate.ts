import type { DatabaseSync } from "node:sqlite";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, "migrations");

export function runMigrations(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);

  const applied = new Set(
    db.prepare("SELECT filename FROM _migrations").all().map((row) => (row as { filename: string }).filename)
  );

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const markApplied = db.prepare("INSERT INTO _migrations (filename) VALUES (?)");

  // Deliberately not auto-wrapped in BEGIN/COMMIT here: a migration that
  // needs to toggle PRAGMA foreign_keys=OFF (required for SQLite's
  // table-rebuild pattern, e.g. dropping a CHECK constraint) can only do so
  // outside an active transaction, so it has to own its BEGIN/COMMIT itself
  // — nesting our own BEGIN around that would fail ("cannot start a
  // transaction within a transaction"). Simple migrations that don't need
  // this can just list statements with no explicit transaction; each DDL
  // statement is already atomic on its own.
  for (const file of files) {
    if (applied.has(file)) continue;
    const sql = readFileSync(path.join(MIGRATIONS_DIR, file), "utf-8");
    db.exec(sql);
    markApplied.run(file);
  }
}
