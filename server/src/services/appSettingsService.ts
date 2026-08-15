import type { DatabaseSync } from "node:sqlite";
import * as settingsQueries from "../db/queries/appSettings.js";
import type { AppSettings } from "@independance/shared";
import { DEFAULT_LINK_ORIENTATION, DEFAULT_TILE_FIELDS } from "@independance/shared";
import type { updateAppSettingsSchema } from "@independance/shared";
import type { z } from "zod";

const DEFAULTS: AppSettings = {
  tileFields: DEFAULT_TILE_FIELDS,
  linkOrientation: DEFAULT_LINK_ORIENTATION,
};

export function getSettings(db: DatabaseSync): AppSettings {
  const stored = settingsQueries.getAllSettings(db);
  return {
    tileFields: (stored.tileFields as AppSettings["tileFields"]) ?? DEFAULTS.tileFields,
    linkOrientation: (stored.linkOrientation as AppSettings["linkOrientation"]) ?? DEFAULTS.linkOrientation,
  };
}

export function updateSettings(db: DatabaseSync, input: z.infer<typeof updateAppSettingsSchema>): AppSettings {
  if (input.tileFields !== undefined) settingsQueries.setSetting(db, "tileFields", input.tileFields);
  if (input.linkOrientation !== undefined) settingsQueries.setSetting(db, "linkOrientation", input.linkOrientation);
  return getSettings(db);
}
