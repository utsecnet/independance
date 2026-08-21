import { useMemo } from "react";
import { useConfigStore } from "../../../state/configStore";
import { useGraphStore } from "../../../state/store";
import { CURRENT_VERSION } from "../VersionHistory/versionHistory";
import styles from "./LeftRail.module.css";

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      width="10"
      height="10"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 200ms ease" }}
    >
      <path d="M9 18l6-6-6-6" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

interface LeftRailProps {
  open: boolean;
  onToggle: () => void;
  /** A node type id, "settings", or null if no blade is open. */
  activeGroup: string | null;
  onSelectGroup: (group: string) => void;
  onOpenVersionHistory: () => void;
}

// The far-left, always-present nav: collapsed it's just a narrow bar with
// the toggle tab; expanded it lists every node type (grouped item counts)
// plus Settings. Picking a group doesn't affect this rail itself — it
// drives which of ItemsBlade/SettingsBlade slides out over the canvas
// (see App.tsx), the same way the old standalone gear button used to just
// toggle SettingsBlade.
export function LeftRail({ open, onToggle, activeGroup, onSelectGroup, onOpenVersionHistory }: LeftRailProps) {
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const nodes = useGraphStore((s) => s.nodes);

  const countsByType = useMemo(() => {
    const counts = new Map<string, number>();
    for (const n of nodes) counts.set(n.data.nodeType, (counts.get(n.data.nodeType) ?? 0) + 1);
    return counts;
  }, [nodes]);

  const sortedTypes = useMemo(() => [...nodeTypes].sort((a, b) => a.sortOrder - b.sortOrder), [nodeTypes]);

  return (
    <div className={`${styles.rail} ${open ? styles.railOpen : ""}`}>
      <button
        type="button"
        className={styles.toggle}
        onClick={onToggle}
        aria-label={open ? "Collapse menu" : "Expand menu"}
        aria-expanded={open}
      >
        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className={styles.groups}>
          {sortedTypes.map((type) => (
            <button
              key={type.id}
              type="button"
              className={`${styles.groupRow} ${activeGroup === type.id ? styles.groupRowActive : ""}`}
              onClick={() => onSelectGroup(type.id)}
            >
              <span className={styles.dot} style={{ background: type.color }} />
              <span className={styles.groupLabel}>{type.label}</span>
              <span className={styles.count}>{countsByType.get(type.id) ?? 0}</span>
            </button>
          ))}

          <div className={styles.divider} />

          <button
            type="button"
            className={`${styles.groupRow} ${activeGroup === "settings" ? styles.groupRowActive : ""}`}
            onClick={() => onSelectGroup("settings")}
          >
            <GearIcon />
            <span className={styles.groupLabel}>Settings</span>
          </button>
        </div>
      )}

      {open && (
        <div className={styles.footer}>
          <button type="button" className={styles.versionLink} onClick={onOpenVersionHistory}>
            {CURRENT_VERSION}
          </button>
        </div>
      )}
    </div>
  );
}
