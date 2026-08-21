export type VersionKind = "Initial release" | "Minor update" | "Major update";

export interface VersionEntry {
  version: string;
  kind: VersionKind;
  changes: string[];
}

// Newest first — the table (VersionHistoryBlade) reads off this list
// directly, and CURRENT_VERSION below is just its own first entry, so a new
// release is the only change a future bump needs: prepend one entry here,
// nothing else has its own copy of the version string to fall out of sync.
export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "2026.1.02",
    kind: "Minor update",
    changes: [
      "Auto-arranging layout now groups connected work and reduces crossing lines",
      "Click a tile to highlight its full dependency chain",
      "Multi-select and drag a group of tiles together, snapped to grid",
      "Project tiles show rollup counts of upstream tasks & POA&Ms",
      "Insert a new tile directly into an existing dependency chain",
      "Portable, no-install build for running independance anywhere",
    ],
  },
  {
    version: "2026.1.0",
    kind: "Initial release",
    changes: [
      "Visual dependency map for projects, tasks, and POA&Ms",
      "Auto-arranging layout — no manual positioning required",
      "Click-to-edit tiles with type-specific fields",
      "Fully local and private — no account, no cloud",
    ],
  },
];

export const CURRENT_VERSION = `v${VERSION_HISTORY[0].version}`;
