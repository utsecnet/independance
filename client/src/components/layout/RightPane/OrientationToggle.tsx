import { useConfigStore } from "../../../state/configStore";
import styles from "./OrientationToggle.module.css";

function HorizontalLinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="3" y1="12" x2="21" y2="12" />
      <polyline points="7 6 3 12 7 18" />
      <polyline points="17 6 21 12 17 18" />
    </svg>
  );
}

function VerticalLinkIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="3" x2="12" y2="21" />
      <polyline points="6 7 12 3 18 7" />
      <polyline points="6 17 12 21 18 17" />
    </svg>
  );
}

export function OrientationToggle() {
  const linkOrientation = useConfigStore((s) => s.linkOrientation);
  const updateAppSettings = useConfigStore((s) => s.updateAppSettings);
  const isHorizontal = linkOrientation === "horizontal";

  function toggle() {
    updateAppSettings({ linkOrientation: isHorizontal ? "vertical" : "horizontal" });
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={isHorizontal}
      className={styles.toggle}
      onClick={toggle}
      title={isHorizontal ? "Switch to vertical linking" : "Switch to horizontal linking"}
      aria-label="Toggle tile linking direction"
    >
      <span className={styles.iconSlot}>
        <VerticalLinkIcon />
      </span>
      <span className={styles.iconSlot}>
        <HorizontalLinkIcon />
      </span>
      <span className={`${styles.knob} ${isHorizontal ? styles.knobRight : ""}`} />
    </button>
  );
}
