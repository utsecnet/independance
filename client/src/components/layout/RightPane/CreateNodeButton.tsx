import { useState } from "react";
import type { NodeType } from "@independance/shared";
import { useConfigStore } from "../../../state/configStore";
import styles from "./CreateNodeButton.module.css";

interface CreateNodeButtonProps {
  onCreate: (type: NodeType) => void;
}

export function CreateNodeButton({ onCreate }: CreateNodeButtonProps) {
  const [open, setOpen] = useState(false);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-label="Add a new item"
        title="Add a new item"
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
                onClick={() => {
                  onCreate(type.id);
                  setOpen(false);
                }}
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
