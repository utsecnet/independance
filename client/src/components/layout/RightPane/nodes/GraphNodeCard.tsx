import { useEffect, useMemo, useRef, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import {
  DEFAULT_TILE_FIELDS,
  SEVERITY_LABELS,
  TILE_FIELD_DEFS,
  TILE_FIELD_IDS,
  type TileFieldId,
} from "@independance/shared";
import { useGraphStore, type GraphRFNode, type RFNodeData } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { useDragLinkStore } from "../../../../state/dragLinkStore";
import { useHoverStore } from "../../../../state/hoverStore";
import { NodeCardForm } from "./NodeCardForm";
import { QuickAddButton } from "./QuickAddButton";
import styles from "./GraphNodeCard.module.css";

const KNOWN_STATUS_CLASSES = new Set([
  "not_started",
  "drafting",
  "in_progress",
  "blocked",
  "complete",
  "assessment",
  "planning",
  "isso_review",
  "issm_review",
]);

/** Stable hue from a status value, for statuses with no pre-authored CSS class. */
function fallbackStatusStyle(value: string): { backgroundColor: string; color: string } {
  let hash = 0;
  for (let i = 0; i < value.length; i++) hash = (hash * 31 + value.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return { backgroundColor: `hsl(${hue}, 55%, 20%)`, color: `hsl(${hue}, 70%, 75%)` };
}

/** Renders one of the user-configurable "extra" tile fields (on top of the always-on type/title/status), or null if that field has no value on this node. */
function formatExtraFieldValue(fieldId: TileFieldId, data: RFNodeData): string | null {
  const raw = (data.metadata as Record<string, unknown>)[fieldId];
  if (raw === undefined || raw === null || raw === "") return null;
  if (Array.isArray(raw)) return raw.length ? raw.join(", ") : null;
  if (fieldId === "estimateHours") return `${raw} hrs`;
  return String(raw);
}

export function GraphNodeCard({ id, data }: NodeProps<GraphRFNode>) {
  const dropHover = useDragLinkStore((s) => (s.dropHover?.targetId === id ? s.dropHover.half : null));
  const isExpanded = useGraphStore((s) => s.editingId === id);
  // Highlight-only state: a plain tile click sets this without opening the
  // edit form (see GraphCanvas's onNodeClick) — the pencil icon below is
  // the only thing on the card itself that opens editing.
  const isSelected = useGraphStore((s) => s.selectedId === id);
  const startEditing = useGraphStore((s) => s.startEditing);
  const stopEditing = useGraphStore((s) => s.stopEditing);
  const updateNode = useGraphStore((s) => s.updateNode);
  const typeConfig = useConfigStore((s) => s.nodeTypes.find((t) => t.id === data.nodeType));
  const statusConfig = useConfigStore((s) =>
    s.statuses.find((st) => st.typeId === data.nodeType && st.value === data.status)
  );
  // Powers the collapsed tile's own status <select> (below) so status can
  // be changed right from the map without expanding the card into its full
  // edit form. Filtered/sorted via useMemo off the raw statuses array
  // (rather than inline in the selector) so this only recomputes when the
  // statuses list or this node's own type actually changes, instead of a
  // fresh array — and a re-render — on every unrelated config store update.
  const allStatuses = useConfigStore((s) => s.statuses);
  const statusOptions = useMemo(
    () => allStatuses.filter((st) => st.typeId === data.nodeType).sort((a, b) => a.sortOrder - b.sortOrder),
    [allStatuses, data.nodeType]
  );
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  // Small colored "N" tabs across the top of Project/Task tiles showing how
  // many Tasks/POA&Ms sit upstream in the "blocks" chain (see
  // computeDependencyRollups, computed once per graph change by GraphCanvas
  // and threaded in via data.dependencyCounts rather than recomputed here
  // per tile). One tab per type that has a nonzero count, colored with that
  // type's own tile color and ordered the same as the Settings type list.
  const rollupTabs = useMemo(() => {
    const counts = data.dependencyCounts;
    if (!counts) return [];
    return nodeTypes
      .filter((t) => (counts[t.id] ?? 0) > 0)
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((t) => ({ id: t.id, label: t.label, color: t.color, count: counts[t.id] }));
  }, [data.dependencyCounts, nodeTypes]);
  // Selected fields are per node type (see AppSettings.tileFields) so a
  // type with nothing chosen yet falls back to the same type/status
  // defaults every tile used to show unconditionally, rather than nothing.
  const tileFields = useConfigStore((s) => s.tileFields[data.nodeType] ?? DEFAULT_TILE_FIELDS);
  // Set only while the map filter is active and this tile has a hidden
  // neighbor run with no visible far end to bridge to (see
  // filterGraphForDisplay/collapseHiddenNodes) — a leftmost/rightmost hidden
  // run otherwise vanishes with nothing on the map showing it was ever
  // there.
  const filteredCounts = data.filteredCounts;

  // Shared across every card (see hoverStore) rather than local state, so
  // hovering a new tile hides whichever other tile's + buttons were showing
  // right away instead of leaving both up until the old one's own hide
  // delay elapses — only one tile's + buttons should ever be visible at once.
  const hovered = useHoverStore((s) => s.hoveredId === id);
  // The quick-add buttons render outside the card's own box (clear of the
  // connection handles at its edges — see QuickAddButton), so the mouse has
  // to cross a small gap of "nothing" to reach one. Hiding on mouseleave
  // immediately closed that window before the pointer got there; a short
  // grace period gives it time to arrive without leaving the buttons
  // lingering indefinitely once the pointer is genuinely elsewhere.
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (hideTimer.current) clearTimeout(hideTimer.current);
    };
  }, []);

  function handleMouseEnter() {
    if (hideTimer.current) {
      clearTimeout(hideTimer.current);
      hideTimer.current = null;
    }
    useHoverStore.getState().setHovered(id);
  }

  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => {
      useHoverStore.getState().clearHovered(id);
      hideTimer.current = null;
    }, 400);
  }

  const knownStatusClass = KNOWN_STATUS_CLASSES.has(data.status) ? styles[`status-${data.status}`] : undefined;

  // Type and Status are selectable like any other field (see
  // TILE_FIELD_DEFS) but, unlike the rest, come from top-level node data
  // rather than data.metadata — rendered directly below instead of going
  // through formatExtraFieldValue's generic metadata lookup, so they're
  // excluded here to avoid also showing up as a bogus blank extra row.
  const showType = tileFields.includes("type");
  const showStatus = tileFields.includes("status");

  // Severity gets its own colored badge (like Status) rather than going
  // through the generic extraFields text row below, so the fixed
  // very_high..very_low color scale (see theme.css) is always visible
  // whenever a user has chosen to show it — not just readable as text.
  const showSeverity = tileFields.includes("severity");
  const severityRaw = (data.metadata as Record<string, unknown>).severity;
  const severityValue = typeof severityRaw === "string" && severityRaw ? severityRaw : null;
  const severityClass = severityValue ? styles[`severity-${severityValue}`] : undefined;

  // Residual Risk shares Inherent Risk's five-level scale and gets the same
  // colored-badge treatment (and the same severity-* color classes — the
  // color scale is keyed by level, not by which risk field it's showing).
  const showResidualRisk = tileFields.includes("residualRisk");
  const residualRiskRaw = (data.metadata as Record<string, unknown>).residualRisk;
  const residualRiskValue = typeof residualRiskRaw === "string" && residualRiskRaw ? residualRiskRaw : null;
  const residualRiskClass = residualRiskValue ? styles[`severity-${residualRiskValue}`] : undefined;

  // Defensively drop any stored field id that no longer exists in the
  // registry (e.g. leftover settings from before Title became the only
  // fixed field) rather than rendering a bogus row.
  const extraFields = tileFields
    .filter(
      (f) =>
        f !== "type" && f !== "status" && f !== "severity" && f !== "residualRisk" &&
        (TILE_FIELD_IDS as readonly string[]).includes(f)
    )
    .map((f) => ({ id: f, label: TILE_FIELD_DEFS.find((def) => def.id === f)?.label ?? f, value: formatExtraFieldValue(f, data) }))
    .filter((f) => f.value !== null);

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.expanded : isSelected ? styles.selected : ""} ${data.dimmed ? styles.dimmed : ""}`}
      style={
        {
          borderLeftColor: typeConfig?.color ?? "var(--border)",
          // Drives the card's background tint below — a CSS custom property
          // rather than computing the tinted color here in JS so it can be
          // mixed with `--surface` via color-mix(), which already accounts
          // for whichever theme (light/dark) is active instead of this
          // component needing to know or duplicate that.
          "--type-color": typeConfig?.color,
        } as CSSProperties
      }
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Hover-revealed (same `hovered` state QuickAddButton uses), opens
          the full edit form without going through the collapsed card's own
          click handler (see GraphCanvas's onNodeClick) — a plain click
          anywhere else on the tile only selects/highlights it now. Both
          onClick AND onPointerDown need stopping, same as the status
          <select> below: onPaneClick/onNodeClick fire off the pointerdown
          that starts the click, so stopping propagation only on the click
          event itself is too late — onPaneClick had already reset
          selectedId to null out from under startEditing's own set() by the
          time it ran, which is what broke the always-on-top z-index boost
          (that boost keys off selectedId — see GraphCanvas). */}
      {!isExpanded && (
        <button
          type="button"
          className={`${styles.editButton} ${hovered ? styles.show : ""} nodrag`}
          onClick={(e) => {
            e.stopPropagation();
            startEditing(id);
          }}
          onPointerDown={(e) => e.stopPropagation()}
          aria-label="Edit tile"
          title="Edit tile"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        </button>
      )}
      {!isExpanded && rollupTabs.length > 0 && (
        <div className={styles.rollupTabs}>
          {rollupTabs.map((t) => (
            <div
              key={t.id}
              className={styles.rollupTab}
              style={{ background: t.color }}
              title={`${t.count} dependent ${t.label}${t.count === 1 ? "" : "s"}`}
            >
              {t.count}
            </div>
          ))}
        </div>
      )}
      {/* A stub of a bridge edge with nothing on its far end to connect to
          (see filterGraphForDisplay) — same bracketed [N] look as a real
          bridge's label, just hanging off a short wire planted on the
          tile's own edge instead of spanning to a second node, so it reads
          as "something used to connect here" without covering any part of
          the tile itself. */}
      {!isExpanded && !!filteredCounts?.upstream && (
        <div
          className={`${styles.filteredStub} ${styles.filteredStubLeft}`}
          title={`${filteredCounts.upstream} hidden item${filteredCounts.upstream === 1 ? "" : "s"} filtered out here`}
        >
          <span className={styles.filteredBadge}>[{filteredCounts.upstream}]</span>
          <span className={styles.filteredWire} />
        </div>
      )}
      {!isExpanded && !!filteredCounts?.downstream && (
        <div
          className={`${styles.filteredStub} ${styles.filteredStubRight}`}
          title={`${filteredCounts.downstream} hidden item${filteredCounts.downstream === 1 ? "" : "s"} filtered out here`}
        >
          <span className={styles.filteredWire} />
          <span className={styles.filteredBadge}>[{filteredCounts.downstream}]</span>
        </div>
      )}
      {/* Manual-mode drag-onto-tile gesture: dropping a dragged tile on this
          tile's left half means the dragged tile blocks this one; dropping
          on the right half means the dragged tile is blocked by this one
          (see GraphCanvas's handleNodeDragStop for the commit logic). */}
      {dropHover === "left" && <div className={`${styles.dropHint} ${styles.dropHintLeft}`}>blocks this</div>}
      {dropHover === "right" && <div className={`${styles.dropHint} ${styles.dropHintRight}`}>blocked by this</div>}
      {/* Both left and right carry a source AND a target handle, stacked at
          the same spot, so an edge can visually flow either direction
          depending on what it means (see handlesForRelationship in store.ts). */}
      <Handle type="target" position={Position.Left} id="left-target" className={styles.handle} />
      <Handle type="source" position={Position.Left} id="left-source" className={styles.handle} />
      {!isExpanded && <QuickAddButton nodeId={id} axis="left" hoveredBlocksNew={false} visible={hovered} />}

      {isExpanded ? (
        <NodeCardForm id={id} data={data} onClose={stopEditing} />
      ) : (
        <>
          {showType && <div className={styles.typeLabel}>{typeConfig?.label ?? data.nodeType}</div>}
          <div className={styles.title}>{data.title}</div>
          {showStatus && (
            // The visible label + arrow (normal flow) are what actually
            // size this wrapper to fit its content; the <select> itself is
            // a fully transparent overlay stretched to cover the wrapper
            // exactly (see .statusSelect), so the whole pill — not just the
            // rendered text — is one native click-to-open-dropdown hit
            // target, the same way any custom-styled select has to be
            // built (a <select>'s own box only ever wraps its own text).
            <div
              className={`${styles.status} ${styles.statusWrap} ${knownStatusClass ?? ""}`}
              style={knownStatusClass ? undefined : fallbackStatusStyle(data.status)}
              onClick={(e) => e.stopPropagation()}
            >
              <span className={styles.statusLabel}>{statusConfig?.label ?? data.status}</span>
              <svg
                className={styles.statusArrow}
                viewBox="0 0 10 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M1 1l4 4 4-4" />
              </svg>
              <select
                className={`${styles.statusSelect} nodrag`}
                value={data.status}
                // Changing status right from the collapsed tile shouldn't
                // also expand it into the full edit card — onNodeClick (see
                // GraphCanvas) fires from the same click that opens the
                // native option list, so both handlers need to be stopped
                // here rather than just one.
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
                onChange={(e) => {
                  e.stopPropagation();
                  updateNode(id, { status: e.target.value });
                }}
                title={statusConfig?.label ?? data.status}
              >
                {statusOptions.map((s) => (
                  <option key={s.id} value={s.value}>
                    {s.label}
                  </option>
                ))}
                {/* Defensive fallback: a status value the current type's own
                    status list no longer contains (e.g. deleted in Settings
                    after this node was set to it) still needs a visible,
                    selectable option instead of the <select> silently
                    collapsing to the first list entry. */}
                {!statusOptions.some((s) => s.value === data.status) && (
                  <option value={data.status}>{statusConfig?.label ?? data.status}</option>
                )}
              </select>
            </div>
          )}
          {((showSeverity && severityValue) || (showResidualRisk && residualRiskValue)) && (
            // Both risk badges sit in one row (rather than each stacking on
            // its own line, like a lone risk badge does) so a tile showing
            // both reads as one Inherent/Residual pair rather than two
            // unrelated rows.
            <div className={styles.riskRow}>
              {showSeverity && severityValue && (
                <div
                  className={`${styles.severity} ${severityClass ?? ""}`}
                  title={`Inherent Risk: ${SEVERITY_LABELS[severityValue] ?? severityValue}`}
                  // Pinned to column 1 regardless of whether Residual Risk
                  // renders into column 2 — see .riskRow — so Inherent Risk
                  // always occupies the same slot rather than the grid
                  // collapsing around whichever badge happens to be present.
                  style={{ gridColumn: 1 }}
                >
                  {/* Abbreviated only when Residual Risk is also on the tile
                      — with just one risk badge shown, the level alone (e.g.
                      "High") is unambiguous, same as before this field
                      existed. The title attribute above always spells both
                      out in full, for when the row's too narrow and this
                      truncates. */}
                  {showResidualRisk ? `IR: ${SEVERITY_LABELS[severityValue] ?? severityValue}` : SEVERITY_LABELS[severityValue] ?? severityValue}
                </div>
              )}
              {showResidualRisk && residualRiskValue && (
                <div
                  className={`${styles.severity} ${residualRiskClass ?? ""}`}
                  title={`Residual Risk: ${SEVERITY_LABELS[residualRiskValue] ?? residualRiskValue}`}
                  style={{ gridColumn: 2 }}
                >
                  {showSeverity ? `RR: ${SEVERITY_LABELS[residualRiskValue] ?? residualRiskValue}` : SEVERITY_LABELS[residualRiskValue] ?? residualRiskValue}
                </div>
              )}
            </div>
          )}
          {extraFields.map((f) => (
            <div key={f.id} className={styles.extraField}>
              <span className={styles.extraFieldLabel}>{f.label}:</span> {f.value}
            </div>
          ))}
        </>
      )}

      <Handle type="target" position={Position.Right} id="right-target" className={styles.handle} />
      <Handle type="source" position={Position.Right} id="right-source" className={styles.handle} />
      {!isExpanded && <QuickAddButton nodeId={id} axis="right" hoveredBlocksNew={true} visible={hovered} />}
    </div>
  );
}

// React Flow's `nodeTypes` prop is a compile-time map keyed by RF's own
// `node.type`, resolved once at mount. Every app node uses the same fixed RF
// type ("graphNode" — see toRFNode in store.ts) regardless of its real
// (dynamic, user-extensible) app-level type, which lives in `data.nodeType`
// instead — so adding a new custom type needs zero React Flow registration.
// Deliberately not named "default": React Flow's own stylesheet ships a
// `.react-flow__node-default` rule (white background, 3px radius) targeting
// its built-in default node renderer, and RF stamps a `react-flow__node-{type}`
// class on every node wrapper regardless of which component actually renders
// it — using "default" as the type string made that unrelated rule bleed
// through behind our own card.
export const graphNodeTypes = {
  graphNode: GraphNodeCard,
};
