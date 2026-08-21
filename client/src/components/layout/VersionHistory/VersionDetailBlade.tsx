import { VERSION_HISTORY } from "./versionHistory";
import styles from "./VersionBlades.module.css";

interface VersionDetailBladeProps {
  version: string | null;
  onClose: () => void;
}

export function VersionDetailBlade({ version, onClose }: VersionDetailBladeProps) {
  const entry = version ? VERSION_HISTORY.find((e) => e.version === version) : undefined;
  const open = entry !== undefined;

  return (
    <div className={`${styles.blade} ${styles.detailBlade} ${open ? styles.detailBladeOpen : ""}`} aria-hidden={!open}>
      <div className={styles.header}>
        <h2 className={styles.title}>{entry ? `${entry.version} — ${entry.kind}` : ""}</h2>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close version details">
          ×
        </button>
      </div>
      <div className={styles.content}>
        <ul className={styles.changeList}>
          {entry?.changes.map((change) => <li key={change}>{change}</li>)}
        </ul>
      </div>
    </div>
  );
}
