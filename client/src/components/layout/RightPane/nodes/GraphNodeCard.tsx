import { useEffect, useState } from "react";
import { Handle, Position, useUpdateNodeInternals, type NodeProps } from "@xyflow/react";
import { TILE_FIELD_DEFS, TILE_FIELD_IDS, type TileFieldId } from "@independance/shared";
import { useGraphStore, type GraphRFNode, type RFNodeData } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
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

const SEVERITY_LABELS: Record<string, string> = {
  very_high: "Very High",
  high: "High",
  moderate: "Moderate",
  low: "Low",
  very_low: "Very Low",
};

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
  if (fieldId === "severity" && typeof raw === "string") return SEVERITY_LABELS[raw] ?? raw;
  if (fieldId === "estimateHours") return `${raw} hrs`;
  return String(raw);
}

export function GraphNodeCard({ id, data }: NodeProps<GraphRFNode>) {
  const dropHover = useGraphStore((s) => (s.dropHover?.targetId === id ? s.dropHover.half : null));
  const isExpanded = useGraphStore((s) => s.selectedId === id);
  const selectNode = useGraphStore((s) => s.selectNode);
  const typeConfig = useConfigStore((s) => s.nodeTypes.find((t) => t.id === data.nodeType));
  const statusConfig = useConfigStore((s) =>
    s.statuses.find((st) => st.typeId === data.nodeType && st.value === data.status)
  );
  const tileFields = useConfigStore((s) => s.tileFields);
  const horizontal = useConfigStore((s) => s.linkOrientation === "horizontal");

  // React Flow only re-measures a node's handle positions (`internals.
  // handleBounds`, used to route edges) via ResizeObserver, which fires on
  // size changes — not when the *set* of rendered handles changes at the
  // same overall size, as happens here when `horizontal` flips and this
  // card swaps its top/bottom Handle elements for left/right ones (or vice
  // versa). Left alone, RF keeps routing edges against the old handle ids
  // forever and logs "Couldn't create edge for source handle id" — this
  // explicitly tells it to re-measure whenever the rendered handle set
  // changes for this node.
  const updateNodeInternals = useUpdateNodeInternals();
  useEffect(() => {
    updateNodeInternals(id);
  }, [id, horizontal, updateNodeInternals]);

  const [hovered, setHovered] = useState(false);

  const knownStatusClass = KNOWN_STATUS_CLASSES.has(data.status) ? styles[`status-${data.status}`] : undefined;

  // Defensively drop any stored field id that no longer exists in the
  // registry (e.g. leftover settings from before Type/Title/Status/
  // Description became fixed/removed) rather than rendering a bogus row.
  const extraFields = tileFields
    .filter((f) => (TILE_FIELD_IDS as readonly string[]).includes(f))
    .map((f) => ({ id: f, label: TILE_FIELD_DEFS.find((def) => def.id === f)?.label ?? f, value: formatExtraFieldValue(f, data) }))
    .filter((f) => f.value !== null);

  return (
    <div
      className={`${styles.card} ${isExpanded ? styles.expanded : ""}`}
      style={{ borderLeftColor: typeConfig?.color ?? "var(--border)" }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {horizontal ? (
        <>
          {dropHover === "left" && <div className={`${styles.dropHint} ${styles.dropHintLeft}`}>blocks this</div>}
          {dropHover === "right" && (
            <div className={`${styles.dropHint} ${styles.dropHintRight}`}>blocked by this</div>
          )}
          {/* Both left and right carry a source AND a target handle, stacked at
              the same spot, so an edge can visually flow either direction
              depending on what it means (see handlesForRelationship in store.ts). */}
          <Handle type="target" position={Position.Left} id="left-target" className={styles.handle} />
          <Handle type="source" position={Position.Left} id="left-source" className={styles.handle} />
          {!isExpanded && (
            <QuickAddButton nodeId={id} axis="left" hoveredBlocksNew={false} visible={hovered} />
          )}
        </>
      ) : (
        <>
          {dropHover === "top" && <div className={`${styles.dropHint} ${styles.dropHintTop}`}>blocked by this</div>}
          {dropHover === "bottom" && <div className={`${styles.dropHint} ${styles.dropHintBottom}`}>blocks this</div>}
          {/* Both top and bottom carry a source AND a target handle, stacked at
              the same spot, so an edge can visually flow either direction
              depending on what it means (see handlesForRelationship in store.ts). */}
          <Handle type="target" position={Position.Top} id="top-target" className={styles.handle} />
          <Handle type="source" position={Position.Top} id="top-source" className={styles.handle} />
          {!isExpanded && (
            <QuickAddButton nodeId={id} axis="top" hoveredBlocksNew={true} visible={hovered} />
          )}
        </>
      )}

      {isExpanded ? (
        <NodeCardForm id={id} data={data} onClose={() => selectNode(null)} />
      ) : (
        <>
          <div className={styles.typeLabel}>{typeConfig?.label ?? data.nodeType}</div>
          <div className={styles.title}>{data.title}</div>
          <div
            className={`${styles.status} ${knownStatusClass ?? ""}`}
            style={knownStatusClass ? undefined : fallbackStatusStyle(data.status)}
          >
            {statusConfig?.label ?? data.status}
          </div>
          {extraFields.map((f) => (
            <div key={f.id} className={styles.extraField}>
              <span className={styles.extraFieldLabel}>{f.label}:</span> {f.value}
            </div>
          ))}
        </>
      )}

      {horizontal ? (
        <>
          <Handle type="target" position={Position.Right} id="right-target" className={styles.handle} />
          <Handle type="source" position={Position.Right} id="right-source" className={styles.handle} />
          {!isExpanded && (
            <QuickAddButton nodeId={id} axis="right" hoveredBlocksNew={true} visible={hovered} />
          )}
        </>
      ) : (
        <>
          <Handle type="target" position={Position.Bottom} id="bottom-target" className={styles.handle} />
          <Handle type="source" position={Position.Bottom} id="bottom-source" className={styles.handle} />
          {!isExpanded && (
            <QuickAddButton nodeId={id} axis="bottom" hoveredBlocksNew={false} visible={hovered} />
          )}
        </>
      )}
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
