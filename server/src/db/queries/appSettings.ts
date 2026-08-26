import type { DatabaseSync } from "node:sqlite";

interface SettingRow {
  key: string;
  value: string;
}

// tileFields/placementMode — meaningfully per-board (tileFields is keyed by
// per-board type ids; placementMode describes how that board's map is
// arranged).
export function getBoardSettings(db: DatabaseSync, boardId: string): Record<string, unknown> {
  const rows = db.prepare("SELECT key, value FROM app_settings WHERE board_id = ?").all(boardId) as unknown as SettingRow[];
  const result: Record<string, unknown> = {};
  for (const row of rows) {
    result[row.key] = JSON.parse(row.value);
  }
  return result;
}

export function setBoardSetting(db: DatabaseSync, boardId: string, key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO app_settings (board_id, key, value) VALUES (@boardId, @key, @value)
     ON CONFLICT(board_id, key) DO UPDATE SET value = excluded.value`
  ).run({ boardId, key, value: JSON.stringify(value) });
}

// theme — a pure cross-board UI preference, not board data, so it lives in
// its own unscoped table rather than app_settings.
export function getGlobalSetting(db: DatabaseSync, key: string): unknown {
  const row = db.prepare("SELECT value FROM global_settings WHERE key = ?").get(key) as unknown as
    | { value: string }
    | undefined;
  return row ? JSON.parse(row.value) : undefined;
}

export function setGlobalSetting(db: DatabaseSync, key: string, value: unknown): void {
  db.prepare(
    `INSERT INTO global_settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run({ key, value: JSON.stringify(value) });
}
