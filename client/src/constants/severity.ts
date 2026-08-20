// POA&M severity is a fixed 5-level scale (unlike node types/statuses, which
// are user-configurable) — single source of truth shared by the metadata
// form, the tile's severity badge, and the map's severity filter.
export const SEVERITY_LEVELS = [
  { value: "very_high", label: "Very High" },
  { value: "high", label: "High" },
  { value: "moderate", label: "Moderate" },
  { value: "low", label: "Low" },
  { value: "very_low", label: "Very Low" },
] as const;

export const SEVERITY_LABELS: Record<string, string> = Object.fromEntries(
  SEVERITY_LEVELS.map((s) => [s.value, s.label])
);
