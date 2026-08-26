import { useLayoutEffect, useRef, useState } from "react";
import { SEVERITY_LEVELS, TILE_FIELD_DEFS, type TileFieldId } from "@independance/shared";
import { useConfigStore } from "../../../state/configStore";
import { useGraphStore } from "../../../state/store";
import { useFilterStore } from "../../../state/filterStore";
import { useFilterMenuOpenStore } from "../../../state/filterMenuUIStore";
import { EMPTY_FIELD_VALUE, fieldValueTokens } from "../../../state/tileFieldValues";
import styles from "./FilterMenu.module.css";

// Exported so the command wheel's Filter slice can reuse the same icon.
export function FilterIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

interface FieldOption {
  value: string;
  label: string;
  severityClass?: string;
}

// severity and residualRisk share the fixed 5-level scale — every level is
// always offered, whether or not a current tile actually uses it, same as
// Type never disappearing just because a type currently has zero tiles.
const SEVERITY_FIELD_IDS = new Set(["severity", "residualRisk"]);

/**
 * Nudges an anchored popover's top-left corner inward so it fits within the
 * viewport, given its own actual measured size — the panel's height varies
 * with how many type sections are expanded, so (unlike the command wheel's
 * fixed-radius ring) this can't be clamped against a static margin and has
 * to use the real rendered size instead. Falls back to centering when the
 * viewport itself is smaller than the panel, same reasoning as
 * clampToViewport in wheelGeometry.ts.
 */
export function clampPanelPosition(
  anchor: { x: number; y: number },
  panelSize: { width: number; height: number },
  viewport: { width: number; height: number },
  margin = 8
): { x: number; y: number } {
  const clampAxis = (value: number, panelExtent: number, viewportExtent: number) => {
    if (viewportExtent <= panelExtent + margin * 2) return (viewportExtent - panelExtent) / 2;
    return Math.min(Math.max(value, margin), viewportExtent - panelExtent - margin);
  };
  return {
    x: clampAxis(anchor.x, panelSize.width, viewport.width),
    y: clampAxis(anchor.y, panelSize.height, viewport.height),
  };
}

function formatValueLabel(fieldId: string, value: string): string {
  if (fieldId === "estimateHours") return `${value} hrs`;
  return value;
}

/**
 * The checkbox options for one (type, field) filter group. Status/severity/
 * residualRisk draw from their own fixed configuration (every known value
 * offered, matching how the Type group above never hides an empty type);
 * everything else — free text, dates, tags — draws from whatever values
 * actually appear on this type's tiles right now, so the list only ever
 * offers something a filter could actually match. "(none)" is appended
 * last, and only when at least one tile genuinely has nothing set for that
 * field.
 */
function optionsForField(
  fieldId: TileFieldId,
  typeId: string,
  nodes: ReturnType<typeof useGraphStore.getState>["nodes"],
  statuses: ReturnType<typeof useConfigStore.getState>["statuses"]
): FieldOption[] {
  if (fieldId === "status") {
    return statuses
      .filter((s) => s.typeId === typeId)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((s) => ({ value: s.value, label: s.label }));
  }
  if (SEVERITY_FIELD_IDS.has(fieldId)) {
    return SEVERITY_LEVELS.map((level) => ({
      value: level.value,
      label: level.label,
      severityClass: styles[`severity-${level.value}`],
    }));
  }

  const values = new Set<string>();
  for (const n of nodes) {
    if (n.data.nodeType !== typeId) continue;
    for (const token of fieldValueTokens(fieldId, n.data.status, n.data.metadata)) values.add(token);
  }
  const hasEmpty = values.delete(EMPTY_FIELD_VALUE);
  const sorted = [...values].sort((a, b) =>
    fieldId === "estimateHours" ? Number(a) - Number(b) : a.localeCompare(b, undefined, { sensitivity: "base" })
  );
  const options = sorted.map((v) => ({ value: v, label: formatValueLabel(fieldId, v) }));
  if (hasEmpty) options.push({ value: EMPTY_FIELD_VALUE, label: "(none)" });
  return options;
}

// Floating icon button (matches CreateNodeButton/ExportButton's own toggle
// pattern) that expands into a panel — collapses again on a second click, an
// outside click, or picking a filter doesn't need to close it since multiple
// boxes are usually toggled in one visit. Below the always-visible Type
// group, one collapsible section per node type offers every field that
// applies to it (see TILE_FIELD_DEFS), each as its own checkbox group — so
// "filter by any field" reads as "open the type you care about, then the
// field you care about" rather than one long undifferentiated list.
export function FilterMenu() {
  const open = useFilterMenuOpenStore((s) => s.open);
  const anchor = useFilterMenuOpenStore((s) => s.anchor);
  const setOpen = useFilterMenuOpenStore((s) => s.setOpen);
  const [expandedTypeIds, setExpandedTypeIds] = useState<Set<string>>(new Set());
  const panelRef = useRef<HTMLDivElement>(null);
  // Anchor as given can't account for the panel's own size (only known once
  // rendered) — this holds the version nudged back on-screen, computed
  // after each render via the panel's real measured box. Runs in
  // useLayoutEffect (not useEffect) so the correction lands before the
  // browser paints, rather than as a visible jump a frame later.
  const [clampedAnchor, setClampedAnchor] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!open || !anchor || !panelRef.current) {
      setClampedAnchor(null);
      return;
    }
    const rect = panelRef.current.getBoundingClientRect();
    setClampedAnchor(
      clampPanelPosition(
        anchor,
        { width: rect.width, height: rect.height },
        { width: window.innerWidth, height: window.innerHeight }
      )
    );
    // expandedTypeIds too: expanding a type section grows the panel's real
    // height after the initial anchor/open-driven measurement, which can
    // push it past the viewport bottom the same way an unmeasured anchor
    // would — re-measuring on every expand/collapse keeps it on-screen as
    // the content grows, not just at the moment it first opens.
  }, [open, anchor, expandedTypeIds]);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const statuses = useConfigStore((s) => s.statuses);
  const nodes = useGraphStore((s) => s.nodes);
  const hiddenTypeIds = useFilterStore((s) => s.hiddenTypeIds);
  const hiddenFieldValues = useFilterStore((s) => s.hiddenFieldValues);
  const toggleType = useFilterStore((s) => s.toggleType);
  const toggleFieldValue = useFilterStore((s) => s.toggleFieldValue);
  const resetFilters = useFilterStore((s) => s.resetFilters);

  let fieldFilterCount = 0;
  for (const values of hiddenFieldValues.values()) fieldFilterCount += values.size;
  const activeCount = hiddenTypeIds.size + fieldFilterCount;

  function toggleExpanded(typeId: string) {
    const next = new Set(expandedTypeIds);
    if (next.has(typeId)) next.delete(typeId);
    else next.add(typeId);
    setExpandedTypeIds(next);
  }

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={`${styles.button} ${activeCount > 0 ? styles.active : ""}`}
        onClick={() => setOpen(!open)}
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
          <div
            ref={panelRef}
            className={`${styles.panel} ${anchor ? styles.panelAnchored : ""}`}
            style={anchor ? { left: (clampedAnchor ?? anchor).x, top: (clampedAnchor ?? anchor).y } : undefined}
          >
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

            {nodeTypes.map((type) => {
              const fields = TILE_FIELD_DEFS.filter(
                (field) => field.id !== "type" && (field.groups as readonly string[]).includes(type.id)
              );
              const fieldGroups = fields
                .map((field) => ({ field, options: optionsForField(field.id, type.id, nodes, statuses) }))
                .filter((g) => g.options.length > 0);
              if (fieldGroups.length === 0) return null;

              const typeFilterCount = fieldGroups.reduce(
                (sum, g) => sum + (hiddenFieldValues.get(`${type.id}::${g.field.id}`)?.size ?? 0),
                0
              );
              const expanded = expandedTypeIds.has(type.id);

              return (
                <div key={type.id} className={styles.typeSection}>
                  <button type="button" className={styles.typeHeader} onClick={() => toggleExpanded(type.id)}>
                    <span className={styles.dot} style={{ background: type.color }} />
                    <span className={styles.typeHeaderLabel}>{type.label}</span>
                    {typeFilterCount > 0 && <span className={styles.typeFilterCount}>{typeFilterCount}</span>}
                    <span className={styles.chevron}>{expanded ? "▾" : "▸"}</span>
                  </button>

                  {expanded && (
                    <div className={styles.fieldList}>
                      {fieldGroups.map(({ field, options }) => (
                        <div key={field.id} className={styles.group}>
                          <div className={styles.groupTitle}>{field.label}</div>
                          {options.map((option) => (
                            <label key={option.value} className={styles.option}>
                              <input
                                type="checkbox"
                                checked={!hiddenFieldValues.get(`${type.id}::${field.id}`)?.has(option.value)}
                                onChange={() => toggleFieldValue(type.id, field.id, option.value)}
                              />
                              {option.severityClass && <span className={`${styles.dot} ${option.severityClass}`} />}
                              {option.label}
                            </label>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
