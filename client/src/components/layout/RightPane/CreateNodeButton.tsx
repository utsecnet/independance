import { useState } from "react";
import type { NodeType } from "@independance/shared";
import { NODE_TYPES, TYPE_LABEL } from "../../../constants/nodeType";
import styles from "./CreateNodeButton.module.css";

const TYPE_DOT_CLASS: Record<NodeType, string> = {
  task: styles.dotTask,
  project: styles.dotProject,
  poam: styles.dotPoam,
};

interface CreateNodeButtonProps {
  onCreate: (type: NodeType) => void;
}

export function CreateNodeButton({ onCreate }: CreateNodeButtonProps) {
  const [open, setOpen] = useState(false);

  return (
    <div className={styles.wrapper}>
      <button
        type="button"
        className={styles.button}
        onClick={() => setOpen((v) => !v)}
        aria-label="Add task, project, or POA&M"
        title="Add task, project, or POA&M"
      >
        +
      </button>
      {open && (
        <>
          <div className={styles.overlay} onClick={() => setOpen(false)} />
          <div className={styles.menu}>
            {NODE_TYPES.map((type) => (
              <button
                key={type}
                type="button"
                className={styles.menuItem}
                onClick={() => {
                  onCreate(type);
                  setOpen(false);
                }}
              >
                <span className={`${styles.dot} ${TYPE_DOT_CLASS[type]}`} />
                {TYPE_LABEL[type]}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
