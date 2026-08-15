import { Handle, Position, type NodeProps } from "@xyflow/react";
import type { GraphRFNode } from "../../../../state/store";
import { STATUS_LABELS } from "../../../../constants/nodeStatus";
import styles from "./GraphNodeCard.module.css";

const TYPE_LABEL: Record<string, string> = {
  task: "Task",
  project: "Project",
  poam: "POA&M",
};

export function GraphNodeCard({ data, selected }: NodeProps<GraphRFNode>) {
  return (
    <div className={`${styles.card} ${styles[data.nodeType]} ${selected ? styles.selected : ""}`}>
      <Handle type="target" position={Position.Top} className={styles.handle} />
      <div className={styles.typeLabel}>{TYPE_LABEL[data.nodeType]}</div>
      <div className={styles.title}>{data.title}</div>
      <div className={`${styles.status} ${styles[`status-${data.status}`]}`}>{STATUS_LABELS[data.status]}</div>
      <Handle type="source" position={Position.Bottom} className={styles.handle} />
    </div>
  );
}

export const graphNodeTypes = {
  task: GraphNodeCard,
  project: GraphNodeCard,
  poam: GraphNodeCard,
};
