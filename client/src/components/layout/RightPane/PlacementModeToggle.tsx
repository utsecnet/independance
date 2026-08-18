import { useGraphStore } from "../../../state/store";
import styles from "./PlacementModeToggle.module.css";

/**
 * Auto (the default) leaves every tile's position owned by arrangeGraph.
 * Manual frees tiles up for hand-dragging, including dragging one tile
 * onto another to link them (see GraphCanvas's drag handlers) — switching
 * back to auto resnaps using whatever order the tiles were left in rather
 * than discarding the manual arrangement for the from-scratch heuristic.
 */
export function PlacementModeToggle() {
  const placementMode = useGraphStore((s) => s.placementMode);
  const setPlacementMode = useGraphStore((s) => s.setPlacementMode);

  return (
    <div className={styles.wrapper} role="group" aria-label="Tile placement mode">
      <button
        type="button"
        className={`${styles.option} ${placementMode === "auto" ? styles.active : ""}`}
        onClick={() => setPlacementMode("auto")}
        title="Positions are arranged automatically"
      >
        Auto
      </button>
      <button
        type="button"
        className={`${styles.option} ${placementMode === "manual" ? styles.active : ""}`}
        onClick={() => setPlacementMode("manual")}
        title="Drag tiles freely; drag one onto another to link them"
      >
        Manual
      </button>
    </div>
  );
}
