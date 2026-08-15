import { Handle, Position, type NodeProps } from "@xyflow/react";
import { useGraphStore, type GraphRFNode } from "../../../../state/store";
import { STATUS_LABELS } from "../../../../constants/nodeStatus";
import styles from "./GraphNodeCard.module.css";

const TYPE_LABEL: Record<string, string> = {
  task: "Task",
  project: "Project",
  poam: "POA&M",
};

export function GraphNodeCard({ id, data, selected }: NodeProps<GraphRFNode>) {
  const dropHover = useGraphStore((s) => (s.dropHover?.targetId === id ? s.dropHover.half : null));

  return (
    <div className={`${styles.card} ${styles[data.nodeType]} ${selected ? styles.selected : ""}`}>
      {dropHover === "top" && <div className={`${styles.dropHint} ${styles.dropHintTop}`}>blocked by this</div>}
      {dropHover === "bottom" && <div className={`${styles.dropHint} ${styles.dropHintBottom}`}>blocks this</div>}
      {/* Both top and bottom carry a source AND a target handle, stacked at
          the same spot, so an edge can visually flow either direction
          depending on what it means (see handlesForRelationship in store.ts). */}
      <Handle type="target" position={Position.Top} id="top-target" className={styles.handle} />
      <Handle type="source" position={Position.Top} id="top-source" className={styles.handle} />
      <div className={styles.typeLabel}>{TYPE_LABEL[data.nodeType]}</div>
      <div className={styles.title}>{data.title}</div>
      <div className={`${styles.status} ${styles[`status-${data.status}`]}`}>{STATUS_LABELS[data.status]}</div>
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
