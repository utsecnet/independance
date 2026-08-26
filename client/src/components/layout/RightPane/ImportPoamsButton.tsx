import { useState } from "react";
import { ImportPoamsModal } from "./ImportPoamsModal";
import styles from "./ImportPoamsButton.module.css";

function ImportIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 8 12 3 17 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

export function ImportPoamsButton() {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen(true)}
        aria-label="Import POA&Ms from CSV"
        title="Import POA&Ms from CSV"
      >
        <ImportIcon />
      </button>
      <ImportPoamsModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
