import type { DatabaseSync } from "node:sqlite";
import * as settingsQueries from "../db/queries/appSettings.js";
import type { AppSettings } from "@independance/shared";
import type { updateAppSettingsSchema } from "@independance/shared";
import type { z } from "zod";

// A type with no entry at all (never touched in Settings > Appearance)
// falls back to DEFAULT_TILE_FIELDS client-side — this is deliberately just
// `{}`, not pre-seeded per type, since node types are user-defined and this
// service has no reason to know the current type list.
const DEFAULTS: AppSettings = {
  tileFields: {},
};

function isTileFieldsRecord(value: unknown): value is AppSettings["tileFields"] {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function getSettings(db: DatabaseSync): AppSettings {
  const stored = settingsQueries.getAllSettings(db);
  // tileFields used to be stored as a flat array (one shared list for every
  // node type) before selection became per-type — a row saved under that
  // old shape would otherwise get spread as if it were a record (numeric
  // index keys instead of type ids) the next time settings are read back,
  // which fails validation on the very next PATCH. Treating anything that
  // isn't a plain object as "nothing saved yet" self-heals that instead.
  const settings: AppSettings = {
    tileFields: isTileFieldsRecord(stored.tileFields) ? stored.tileFields : DEFAULTS.tileFields,
  };
  if (stored.theme === "dark" || stored.theme === "light") settings.theme = stored.theme;
  if (stored.placementMode === "auto" || stored.placementMode === "manual") settings.placementMode = stored.placementMode;
  return settings;
}

export function updateSettings(db: DatabaseSync, input: z.infer<typeof updateAppSettingsSchema>): AppSettings {
  if (input.tileFields !== undefined) settingsQueries.setSetting(db, "tileFields", input.tileFields);
  if (input.theme !== undefined) settingsQueries.setSetting(db, "theme", input.theme);
  if (input.placementMode !== undefined) settingsQueries.setSetting(db, "placementMode", input.placementMode);
  return getSettings(db);
}
