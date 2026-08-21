import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { BaseEdge, EdgeLabelRenderer, getBezierPath, type EdgeProps } from "@xyflow/react";
import type { NodeType } from "@independance/shared";
import { useGraphStore, type GraphRFEdge } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { useEdgeHoverStore } from "../../../../state/edgeHoverStore";
import { useQuickAddMenuStore } from "../../../../state/quickAddMenuStore";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH } from "../../../../state/layout";
import styles from "./InsertableEdge.module.css";

const MENU_GAP = 8;

interface MenuPosition {
  top: number;
  left: number;
}

/**
 * The default edge type for every real (never a synthetic filtered-view
 * "bridge") edge — see toRFEdge. Renders exactly like React Flow's own
 * default bezier edge, plus a hover-revealed "+" at the midpoint (same
 * 400ms hide grace period as GraphNodeCard's own quick-add buttons, so the
 * cursor has time to travel from the thin line to the button without it
 * vanishing first) that splices a brand new tile into this edge — see
 * insertNodeOnEdge in store.ts. Only offered for blocks/depends_on: those
 * are the only relationship types with any chain position for a new tile
 * to land *in*; relates_to and remediates have no such notion.
 */
export function InsertableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
  data,
}: EdgeProps<GraphRFEdge>) {
  const [edgePath, labelX, labelY] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const insertable = data?.relationshipType === "blocks" || data?.relationshipType === "depends_on";

  const hovered = useEdgeHoverStore((s) => s.hoveredEdgeId === id);
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
    useEdgeHoverStore.getState().setHovered(id);
  }

  function handleMouseLeave() {
    hideTimer.current = setTimeout(() => {
      useEdgeHoverStore.getState().clearHovered(id);
      hideTimer.current = null;
    }, 400);
  }

  const menuKey = `edge-${id}`;
  const openKey = useQuickAddMenuStore((s) => s.openKey);
  const setOpenKey = useQuickAddMenuStore((s) => s.setOpenKey);
  const open = openKey === menuKey;
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);

  function handleToggle() {
    if (open) {
      setOpenKey(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) setMenuPosition({ top: rect.bottom + MENU_GAP, left: rect.left + rect.width / 2 });
    setOpenKey(menuKey);
  }

  async function handleSelect(type: NodeType) {
    setOpenKey(null);
    const { placementMode } = useGraphStore.getState();
    // Manual mode has no auto-layout pass to place the new tile, so it's
    // seeded at the midpoint of this edge's two endpoints (converted from
    // the desired *center* point to the top-left `position` every tile
    // actually stores) — a reasonable starting spot the user can drag from.
    // Auto mode ignores this entirely; arrangeGraph places every tile
    // itself right after.
    const position =
      placementMode === "manual"
        ? {
            x: (sourceX + targetX) / 2 - DEFAULT_NODE_WIDTH / 2,
            y: (sourceY + targetY) / 2 - DEFAULT_NODE_HEIGHT / 2,
          }
        : undefined;
    await useGraphStore.getState().insertNodeOnEdge(id, type, position);
  }

  const show = insertable && (hovered || open);

  return (
    <>
      <BaseEdge id={id} path={edgePath} style={style} markerEnd={markerEnd} />
      {insertable && (
        <path
          d={edgePath}
          className={`${styles.hitArea} nodrag nopan`}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        />
      )}
      {insertable && (
        <EdgeLabelRenderer>
          <div
            className={`${styles.wrapper} ${show ? styles.show : ""} nodrag nopan`}
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)` }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              ref={buttonRef}
              type="button"
              className={styles.button}
              onClick={handleToggle}
              aria-label="Insert a tile here"
              title="Insert a tile here"
            >
              +
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
      {open &&
        menuPosition &&
        createPortal(
          <>
            <div className={styles.overlay} onClick={() => setOpenKey(null)} />
            <div className={styles.menu} style={{ top: menuPosition.top, left: menuPosition.left }}>
              {nodeTypes.map((type) => (
                <button key={type.id} type="button" className={styles.menuItem} onClick={() => handleSelect(type.id)}>
                  <span className={styles.dot} style={{ background: type.color }} />
                  {type.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </>
  );
}

export const graphEdgeTypes = {
  insertable: InsertableEdge,
};
