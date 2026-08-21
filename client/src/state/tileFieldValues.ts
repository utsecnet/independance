import type { NodeMetadata } from "@independance/shared";

// Sentinel for "this field has no value on this tile" — a real value can
// never collide with it (metadata values are always non-empty strings/
// numbers by the time they're saved — see MetadataFields), so it's safe to
// treat as just another filterable value alongside the real ones. Shared
// between FilterMenu (to offer a "(none)" checkbox) and filterGraphForDisplay
// (to know what an absent value hides against) so the two can't drift.
export const EMPTY_FIELD_VALUE = "__empty__";

/**
 * The raw value(s) a tile has for one field, as filterable string tokens.
 * Almost every field is single-valued (one token); "tags" is the one
 * multi-valued field (a comma-separated string split into its individual
 * tokens), so a tile can match a tag filter on any one of several tags
 * rather than needing an exact whole-string match. A field with nothing set
 * — never assigned, blank string, or genuinely absent from metadata — comes
 * back as [EMPTY_FIELD_VALUE] rather than an empty array, so "(none)" is
 * something a filter can target just like any other value.
 */
export function fieldValueTokens(fieldId: string, status: string, metadata: NodeMetadata): string[] {
  if (fieldId === "status") return [status];

  const raw = metadata[fieldId];
  if (fieldId === "tags") {
    if (typeof raw !== "string") return [EMPTY_FIELD_VALUE];
    const tokens = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    return tokens.length > 0 ? tokens : [EMPTY_FIELD_VALUE];
  }

  if (raw === undefined || raw === null || raw === "") return [EMPTY_FIELD_VALUE];
  return [String(raw)];
}
