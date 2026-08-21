import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { NodeType } from "@independance/shared";
import { useGraphStore, type GraphRFNode } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { useQuickAddMenuStore } from "../../../../state/quickAddMenuStore";
import { CROSS_STEP, MAIN_STEP } from "../../../../state/layout";
import styles from "./QuickAddButton.module.css";

const MENU_GAP = 8;

/**
 * The naive "one column over, same row as the anchor" slot (see handleSelect
 * below) collides whenever the anchor already has a neighbor in that
 * direction — e.g. adding a second child to a tile that already blocks
 * something puts the new tile exactly on top of the existing one instead of
 * next to it. Walks down the same column in CROSS_STEP increments to the
 * first row nothing already occupies, leaving every existing tile
 * (including the one that would otherwise get covered) exactly where it
 * was.
 */
export function findFreeRow(nodes: GraphRFNode[], x: number, startY: number): number {
  const occupiedYs = new Set(nodes.filter((n) => Math.abs(n.position.x - x) < 1).map((n) => n.position.y));
  let y = startY;
  while (occupiedYs.has(y)) y += CROSS_STEP;
  return y;
}

type Axis = "left" | "right";

interface QuickAddButtonProps {
  nodeId: string;
  axis: Axis;
  /**
   * Whether the hovered tile blocks the newly created tile, or is blocked by
   * it. Mirrors the facing-sides convention used by handlesForRelationship:
   * the right connection point is this tile's "blocker" side (whatever
   * attaches there is blocked by this tile), the left point is its
   * "blocked" side (whatever attaches there blocks this tile).
   */
  hoveredBlocksNew: boolean;
  visible: boolean;
}

interface MenuPosition {
  top: number;
  left?: number;
  right?: number;
}

export function QuickAddButton({ nodeId, axis, hoveredBlocksNew, visible }: QuickAddButtonProps) {
  // Shared across every QuickAddButton on the canvas (not local state) so
  // opening one always closes whichever other one might already be open —
  // otherwise each + kept its own independent open/closed flag and any
  // number of these could be stacked open at once.
  const menuKey = `${nodeId}-${axis}`;
  const openKey = useQuickAddMenuStore((s) => s.openKey);
  const setOpenKey = useQuickAddMenuStore((s) => s.setOpenKey);
  const open = openKey === menuKey;

  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuPosition, setMenuPosition] = useState<MenuPosition | null>(null);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);

  // The menu portals straight to <body> (see the render below) rather than
  // nesting under this tile's own DOM subtree, because React Flow positions
  // every tile with a CSS `transform`, and a `transform` on an ancestor
  // makes it the containing block for `position: fixed` descendants — so
  // without the portal, a neighboring tile later in the DOM (which is under
  // its own separate transformed node, with no relation to this menu's own
  // z-index at all) could still paint on top of it. Portaling escapes that
  // entirely, so the menu always renders above every tile regardless of
  // paint order. Position has to be computed here, from the button's own
  // screen rect, since a portaled element can no longer inherit "next to
  // the button" for free from CSS alone.
  function handleToggle() {
    if (open) {
      setOpenKey(null);
      return;
    }
    const rect = buttonRef.current?.getBoundingClientRect();
    if (rect) {
      setMenuPosition(
        axis === "left"
          ? { top: rect.top + rect.height / 2, right: window.innerWidth - rect.left + MENU_GAP }
          : { top: rect.top + rect.height / 2, left: rect.right + MENU_GAP }
      );
    }
    setOpenKey(menuKey);
  }

  async function handleSelect(type: NodeType) {
    setOpenKey(null);
    const { createNode, createEdge, nodes, placementMode } = useGraphStore.getState();
    // In auto mode, no position here — arrangeGraph (run by createNode)
    // places every tile on the standardized grid immediately after, so
    // there's nothing useful to compute up front. In manual mode
    // arrangeGraph never runs, so without this the new tile would default
    // to appearing at the bottom of everything instead of next to the tile
    // it was just added from.
    let position: { x: number; y: number } | undefined;
    if (placementMode === "manual") {
      const anchor = nodes.find((n) => n.id === nodeId);
      if (anchor) {
        const x = anchor.position.x + (axis === "right" ? MAIN_STEP : -MAIN_STEP);
        position = { x, y: findFreeRow(nodes, x, anchor.position.y) };
      }
    }
    // No title — the new tile opens straight into its edit form with the
    // title field empty and focused (see NodeCardForm).
    const created = await createNode({ type, title: "", position });

    if (hoveredBlocksNew) {
      await createEdge(nodeId, created.id, "blocks");
    } else {
      await createEdge(created.id, nodeId, "blocks");
    }
  }

  const show = visible || open;

  return (
    <div
      className={`${styles.wrapper} ${styles[axis]} ${show ? styles.show : ""} nodrag`}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.button}
        onClick={handleToggle}
        aria-label="Add connected item"
        title="Add connected item"
      >
        +
      </button>
      {open &&
        menuPosition &&
        createPortal(
          <>
            <div className={styles.overlay} onClick={() => setOpenKey(null)} />
            <div
              className={styles.menu}
              style={{ top: menuPosition.top, left: menuPosition.left, right: menuPosition.right }}
            >
              {nodeTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleSelect(type.id)}
                >
                  <span className={styles.dot} style={{ background: type.color }} />
                  {type.label}
                </button>
              ))}
            </div>
          </>,
          document.body
        )}
    </div>
  );
}
