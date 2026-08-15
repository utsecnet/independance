import { useState } from "react";
import type { NodeType } from "@independance/shared";
import { DEFAULT_NODE_HEIGHT, DEFAULT_NODE_WIDTH, useGraphStore } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import styles from "./QuickAddButton.module.css";

type Axis = "top" | "bottom" | "left" | "right";

interface QuickAddButtonProps {
  nodeId: string;
  axis: Axis;
  /**
   * Whether the hovered tile blocks the newly created tile, or is blocked by
   * it. Mirrors the facing-sides convention already used by
   * findDropTarget/handlesForRelationship: the top/right connection point is
   * this tile's "blocker" side (whatever attaches there is blocked by this
   * tile), the bottom/left point is its "blocked" side (whatever attaches
   * there blocks this tile).
   */
  hoveredBlocksNew: boolean;
  visible: boolean;
}

const GAP = 80;

function offsetPosition(
  base: { x: number; y: number },
  size: { width: number; height: number },
  axis: Axis
): { x: number; y: number } {
  switch (axis) {
    case "top":
      return { x: base.x, y: base.y - size.height - GAP };
    case "bottom":
      return { x: base.x, y: base.y + size.height + GAP };
    case "left":
      return { x: base.x - size.width - GAP, y: base.y };
    case "right":
      return { x: base.x + size.width + GAP, y: base.y };
  }
}

export function QuickAddButton({ nodeId, axis, hoveredBlocksNew, visible }: QuickAddButtonProps) {
  const [open, setOpen] = useState(false);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);

  async function handleSelect(type: NodeType) {
    setOpen(false);
    const { nodes, createNode, createEdge } = useGraphStore.getState();
    const hoveredNode = nodes.find((n) => n.id === nodeId);
    if (!hoveredNode) return;

    const size = {
      width: hoveredNode.measured?.width ?? DEFAULT_NODE_WIDTH,
      height: hoveredNode.measured?.height ?? DEFAULT_NODE_HEIGHT,
    };
    const position = offsetPosition(hoveredNode.position, size, axis);
    const label = nodeTypes.find((t) => t.id === type)?.label ?? type;
    const created = await createNode({ type, title: `New ${label}`, position });

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
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-label="Add connected item"
        title="Add connected item"
      >
        +
      </button>
      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
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
        </>
      )}
    </div>
  );
}
