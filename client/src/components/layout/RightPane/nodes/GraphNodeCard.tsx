import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { DEFAULT_TILE_FIELDS, TILE_FIELD_DEFS, TILE_FIELD_IDS, type TileFieldId } from "@independance/shared";
import { useGraphStore, type GraphRFNode, type RFNodeData } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { useDragLinkStore } from "../../../../state/dragLinkStore";
import { SEVERITY_LABELS } from "../../../../constants/severity";
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
  const isExpanded = useGraphStore((s) => s.selectedId === id);
  const selectNode = useGraphStore((s) => s.selectNode);
  const typeConfig = useConfigStore((s) => s.nodeTypes.find((t) => t.id === data.nodeType));
  const statusConfig = useConfigStore((s) =>
    s.statuses.find((st) => st.typeId === data.nodeType && st.value === data.status)
  );
  // Selected fields are per node type (see AppSettings.tileFields) so a
  // type with nothing chosen yet falls back to the same type/status
  // defaults every tile used to show unconditionally, rather than nothing.
  const tileFields = useConfigStore((s) => s.tileFields[data.nodeType] ?? DEFAULT_TILE_FIELDS);

  const [hovered, setHovered] = useState(false);
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
    setHovered(true);
  }

  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => {
      setHovered(false);
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

  // Defensively drop any stored field id that no longer exists in the
  // registry (e.g. leftover settings from before Title became the only
  // fixed field) rather than rendering a bogus row.
  const extraFields = tileFields
    .filter((f) => f !== "type" && f !== "status" && f !== "severity" && (TILE_FIELD_IDS as readonly string[]).includes(f))
    .map((f) => ({ id: f, label: TILE_FIELD_DEFS.find((def) => def.id === f)?.label ?? f, value: formatExtraFieldValue(f, data) }))
    .filter((f) => f.value !== null);

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.expanded : ""}`}
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
        <NodeCardForm id={id} data={data} onClose={() => selectNode(null)} />
      ) : (
        <>
          {showType && <div className={styles.typeLabel}>{typeConfig?.label ?? data.nodeType}</div>}
          <div className={styles.title}>{data.title}</div>
          {showStatus && (
            <div
              className={`${styles.status} ${knownStatusClass ?? ""}`}
              style={knownStatusClass ? undefined : fallbackStatusStyle(data.status)}
            >
              {statusConfig?.label ?? data.status}
            </div>
          )}
          {showSeverity && severityValue && (
            <div className={`${styles.severity} ${severityClass ?? ""}`}>
              {SEVERITY_LABELS[severityValue] ?? severityValue}
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
