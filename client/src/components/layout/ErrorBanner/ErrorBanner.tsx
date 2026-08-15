import { useGraphStore } from "../../../state/store";
import styles from "./ErrorBanner.module.css";

export function ErrorBanner() {
  const error = useGraphStore((s) => s.error);
  const clearError = useGraphStore((s) => s.clearError);

  if (!error) return null;

  return (
    <div className={styles.banner} role="alert">
      <span className={styles.dot} />
      <span className={styles.message}>{error}</span>
      <button type="button" className={styles.dismiss} onClick={clearError} aria-label="Dismiss">
        ×
      </button>
    </div>
  );
}
