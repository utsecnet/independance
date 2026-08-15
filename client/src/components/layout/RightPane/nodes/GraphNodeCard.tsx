import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useGraphStore, type GraphRFNode } from "../../../../state/store";
import { STATUS_LABELS } from "../../../../constants/nodeStatus";
import { TYPE_LABEL } from "../../../../constants/nodeType";
import { NodeCardForm } from "./NodeCardForm";
import styles from "./GraphNodeCard.module.css";

export function GraphNodeCard({ id, data }: NodeProps<GraphRFNode>) {
  const dropHover = useGraphStore((s) => (s.dropHover?.targetId === id ? s.dropHover.half : null));
  const isExpanded = useGraphStore((s) => s.selectedId === id);
  const selectNode = useGraphStore((s) => s.selectNode);

  return (
    <div className={`${styles.card} ${styles[data.nodeType]} ${isExpanded ? styles.expanded : ""}`}>
      {dropHover === "top" && <div className={`${styles.dropHint} ${styles.dropHintTop}`}>blocked by this</div>}
      {dropHover === "bottom" && <div className={`${styles.dropHint} ${styles.dropHintBottom}`}>blocks this</div>}
      {/* Both top and bottom carry a source AND a target handle, stacked at
          the same spot, so an edge can visually flow either direction
          depending on what it means (see handlesForRelationship in store.ts). */}
      <Handle type="target" position={Position.Top} id="top-target" className={styles.handle} />
      <Handle type="source" position={Position.Top} id="top-source" className={styles.handle} />

      {isExpanded ? (
        <NodeCardForm id={id} data={data} onClose={() => selectNode(null)} />
      ) : (
        <>
          <div className={styles.typeLabel}>{TYPE_LABEL[data.nodeType]}</div>
          <div className={styles.title}>{data.title}</div>
          <div className={`${styles.status} ${styles[`status-${data.status}`]}`}>{STATUS_LABELS[data.status]}</div>
        </>
      )}

      <Handle type="target" position={Position.Bottom} id="bottom-target" className={styles.handle} />
      <Handle type="source" position={Position.Bottom} id="bottom-source" className={styles.handle} />
    </div>
  );
}

export const graphNodeTypes = {
  task: GraphNodeCard,
  project: GraphNodeCard,
  poam: GraphNodeCard,
};
