import { VERSION_HISTORY } from "./versionHistory";
import styles from "./VersionBlades.module.css";

interface VersionHistoryBladeProps {
  open: boolean;
  onClose: () => void;
  onSelectVersion: (version: string) => void;
}

export function VersionHistoryBlade({ open, onClose, onSelectVersion }: VersionHistoryBladeProps) {
  return (
    <div
      className={`${styles.blade} ${styles.historyBlade} ${open ? styles.historyBladeOpen : ""}`}
      aria-hidden={!open}
    >
      <div className={styles.header}>
        <h2 className={styles.title}>Version history</h2>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close version history">
          ×
        </button>
      </div>
      <div className={styles.content}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Version</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {VERSION_HISTORY.map((entry) => (
              <tr key={entry.version} className={styles.row} onClick={() => onSelectVersion(entry.version)}>
                <td className={styles.rowVersion}>{entry.version}</td>
                <td>{entry.kind}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
