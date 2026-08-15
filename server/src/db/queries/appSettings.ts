import type { DatabaseSync } from "node:sqlite";

interface SettingRow {
  key: string;
  value: string;
}

export function getAllSettings(db: DatabaseSync): Record<string, unknown> {
  const rows = db.prepare("SELECT * FROM app_settings").all() as unknown as SettingRow[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

export function setSetting(db: DatabaseSync, key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO app_settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ key, value: JSON.stringify(value) });
}
