import { useState } from "react";
import { useConfigStore } from "../../../state/configStore";
import { useFilterStore } from "../../../state/filterStore";
import { SEVERITY_LEVELS } from "../../../constants/severity";
import styles from "./FilterMenu.module.css";

function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

// Floating icon button (matches CreateNodeButton/ExportButton's own toggle
// pattern) that expands into a checkbox panel — collapses again on a second
// click, an outside click, or picking a filter doesn't need to close it since
// multiple boxes are usually toggled in one visit.
export function FilterMenu() {
  const [open, setOpen] = useState(false);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const hiddenTypeIds = useFilterStore((s) => s.hiddenTypeIds);
  const hiddenSeverities = useFilterStore((s) => s.hiddenSeverities);
  const toggleType = useFilterStore((s) => s.toggleType);
  const toggleSeverity = useFilterStore((s) => s.toggleSeverity);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  const activeCount = hiddenTypeIds.size + hiddenSeverities.size;
  // Severity only ever applies to POA&M nodes (see MetadataFields) — no
  // point offering severity checkboxes when there's no POA&M type to filter.
  const hasPoam = nodeTypes.some((t) => t.id === "poam");

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.button} ${activeCount > 0 ? styles.active : ""}`}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Filter map"
        title="Filter map"
      >
        <FilterIcon />
        {activeCount > 0 && <span className={styles.badge}>{activeCount}</span>}
      </button>
      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.panel}>
            <div className={styles.panelHeader}>
              <span>Filter</span>
              {activeCount > 0 && (
                <button type="button" className={styles.clearButton} onClick={resetFilters}>
                  Clear
                </button>
              )}
            </div>

            <div className={styles.group}>
              <div className={styles.groupTitle}>Type</div>
              {nodeTypes.map((type) => (
                <label key={type.id} className={styles.option}>
                  <input type="checkbox" checked={!hiddenTypeIds.has(type.id)} onChange={() => toggleType(type.id)} />
                  <span className={styles.dot} style={{ background: type.color }} />
                  {type.label}
                </label>
              ))}
            </div>

            {hasPoam && (
              <div className={styles.group}>
                <div className={styles.groupTitle}>Severity (POA&amp;M)</div>
                {SEVERITY_LEVELS.map((level) => (
                  <label key={level.value} className={styles.option}>
                    <input
                      type="checkbox"
                      checked={!hiddenSeverities.has(level.value)}
                      onChange={() => toggleSeverity(level.value)}
                    />
                    <span className={`${styles.dot} ${styles[`severity-${level.value}`]}`} />
                    {level.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
