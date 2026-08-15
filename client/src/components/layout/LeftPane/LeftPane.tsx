import { useState } from "react";
import { useGraphStore } from "../../../state/store";
import { NodeForm } from "./NodeForm";
import styles from "./LeftPane.module.css";

export function LeftPane() {
  const nodes = useGraphStore((s) => s.nodes);
  const selectedId = useGraphStore((s) => s.selectedId);
  const selectNode = useGraphStore((s) => s.selectNode);
  const [showCreate, setShowCreate] = useState(false);

  const selectedNode = nodes.find((n) => n.id === selectedId) ?? null;

  return (
    <aside className={styles.pane}>
      <h2 className={styles.heading}>
        {selectedNode ? "Edit node" : "New node"}
        {!selectedNode && (
          <button type="button" className={styles.toggle} onClick={() => setShowCreate((v) => !v)}>
            {showCreate ? "Hide" : "Add"}
          </button>
        )}
      </h2>
      {selectedNode ? (
        <NodeForm editingNode={selectedNode} onDone={() => selectNode(null)} />
      ) : (
        showCreate && <NodeForm editingNode={null} onDone={() => setShowCreate(false)} />
      )}

      <h2 className={styles.heading}>Nodes ({nodes.length})</h2>
      {nodes.length === 0 ? (
        <p className={styles.empty}>No tasks, projects, or POA&Ms yet.</p>
      ) : (
        <div className={styles.list}>
          {nodes.map((node) => (
            <button
              key={node.id}
              type="button"
              className={`${styles.row} ${node.id === selectedId ? styles.rowActive : ""}`}
              onClick={() => selectNode(node.id)}
            >
              <span className={`${styles.dot} ${styles[`dot-${node.data.nodeType}`]}`} />
              <span className={styles.rowTitle}>{node.data.title}</span>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
}
