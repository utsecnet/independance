import { useEffect, type CSSProperties, type ReactNode } from "react";
import { wheelItemPosition } from "./wheelGeometry";
import styles from "./CommandWheel.module.css";

export interface WheelItem {
  id: string;
  label: string;
  /** Every slice gets one — a node type's own dot color, or one of the
   * fixed synthwave accents for the non-type slices (Filter/toggle/Edit/
   * Delete) — so every icon on the wheel carries its own neon glow. */
  color: string;
  icon: ReactNode;
  onSelect: () => void;
}

interface CommandWheelProps {
  items: WheelItem[];
  /** Center point, relative to the nearest positioned ancestor (GraphCanvas's
   * .pane) — not a portal target, since .pane itself (unlike a tile) carries
   * no CSS transform, so plain position:absolute works without the
   * portal-to-body dance QuickAddButton needs. */
  anchor: { x: number; y: number };
  onClose: () => void;
}

const RADIUS = 64;
const ITEM_MARKER_ATTR = "data-wheel-item-id";

/**
 * A right-click radial menu — the real GTA5 gesture this time (opens the
 * instant the button goes down, tracks whichever slice the cursor is
 * currently over while held, selects it on release), not the earlier
 * click-to-open/click-to-select web adaptation. GraphCanvas is what
 * actually opens this (on mousedown, see its own handleCanvasMouseDown) —
 * this component just owns what happens for the rest of that one held
 * gesture: highlighting under the cursor (plain CSS :hover already does
 * this, since it tracks real cursor position regardless of which mouse
 * button is down) and resolving the release.
 */
export function CommandWheel({ items, anchor, onClose }: CommandWheelProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Cancel-while-held — released later than the key itself, but there's
      // nothing to select yet at the moment Escape is pressed either way.
      if (e.key === "Escape") onClose();
    }

    // Document-level (not just this component's own DOM) because the mouse
    // can easily drift outside the wheel's small footprint while the button
    // is still held — the release has to be caught wherever it happens.
    // elementFromPoint at the exact release point is what actually decides
    // the selection: whichever slice's own marked element the cursor is
    // over right then, the same real hit-testing :hover already uses for
    // the highlight, rather than reimplementing angle/distance geometry.
    function handleMouseUp(e: MouseEvent) {
      if (e.button !== 2) return;
      const hit = document.elementFromPoint(e.clientX, e.clientY)?.closest(`[${ITEM_MARKER_ATTR}]`);
      const itemId = hit?.getAttribute(ITEM_MARKER_ATTR);
      const item = itemId ? items.find((i) => i.id === itemId) : undefined;
      item?.onSelect();
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("mouseup", handleMouseUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("mouseup", handleMouseUp);
    };
    // items/onClose intentionally omitted — re-subscribing mid-hold on every
    // render (e.g. from an unrelated store update ticking placementMode's
    // label) would risk missing the one mouseup that matters between the
    // old listener detaching and the new one attaching. The still-open
    // wheel's items are fixed for the duration of one hold anyway.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.wheel} style={{ left: anchor.x, top: anchor.y }}>
      {/* Always visible, not a wheel slice — a slice clicked after this
          menu is already open can't retroactively bring back the native
          context menu (browsers only honor the original, trusted
          right-click event), so the escape hatch has to be a modifier key
          decided at click time instead. This caption is what makes that
          discoverable rather than a hidden shortcut. */}
      <div className={styles.hint}>Hold Shift + right-click for your browser's menu</div>
      {items.map((item, i) => {
        const { x, y } = wheelItemPosition(i, items.length, RADIUS);
        return (
          <div
            key={item.id}
            className={styles.item}
            style={
              {
                transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
                // Drives .itemIcon's glow ring and .itemLabel's hover color
                // (both read it via inheritance, so it's set once here
                // rather than duplicated on each sibling).
                "--glow-color": item.color,
              } as CSSProperties
            }
            {...{ [ITEM_MARKER_ATTR]: item.id }}
          >
            <span
              className={styles.itemIcon}
              style={{
                // Glossy neon-bulb look: a soft highlight over the flat
                // type/accent color.
                background: `radial-gradient(circle at 32% 28%, rgba(255,255,255,0.45), rgba(255,255,255,0) 55%), ${item.color}`,
              }}
            >
              {item.icon}
            </span>
            <span className={styles.itemLabel}>{item.label}</span>
          </div>
        );
      })}
    </div>
  );
}
