import { DatabaseSync } from "node:sqlite";
import { runMigrations } from "./migrate.js";

export function createDb(dbPath: string): DatabaseSync {
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA foreign_keys = ON");
  if (dbPath !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL");
  }
  runMigrations(db);
  return db;
}
