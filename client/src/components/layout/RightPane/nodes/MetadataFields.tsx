import type { NodeType } from "@independance/shared";
import styles from "./NodeCardForm.module.css";

export interface MetadataFormValues {
  assignee?: string;
  estimateHours?: string;
  dueDate?: string;
  owner?: string;
  targetDate?: string;
  tags?: string;
  severity?: string;
  poc?: string;
  controlRefs?: string;
}

interface MetadataFieldsProps {
  type: NodeType;
  values: MetadataFormValues;
  onChange: (values: MetadataFormValues) => void;
}

export function MetadataFields({ type, values, onChange }: MetadataFieldsProps) {
  function set<K extends keyof MetadataFormValues>(key: K, value: string) {
    onChange({ ...values, [key]: value });
  }

  if (type === "task") {
    return (
      <>
        <label className={styles.field}>
          <span>Assignee</span>
          <input value={values.assignee ?? ""} onChange={(e) => set("assignee", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Estimate (hours)</span>
          <input
            type="number"
            min="0"
            value={values.estimateHours ?? ""}
            onChange={(e) => set("estimateHours", e.target.value)}
          />
        </label>
        <label className={styles.field}>
          <span>Due date</span>
          <input type="date" value={values.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} />
        </label>
      </>
    );
  }

  if (type === "project") {
    return (
      <>
        <label className={styles.field}>
          <span>Owner</span>
          <input value={values.owner ?? ""} onChange={(e) => set("owner", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Target date</span>
          <input type="date" value={values.targetDate ?? ""} onChange={(e) => set("targetDate", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Tags (comma separated)</span>
          <input value={values.tags ?? ""} onChange={(e) => set("tags", e.target.value)} />
        </label>
      </>
    );
  }

  if (type === "poam") {
    return (
      <>
        <label className={styles.field}>
          <span>Severity</span>
          <select value={values.severity ?? ""} onChange={(e) => set("severity", e.target.value)}>
            <option value="">—</option>
            <option value="very_high">Very High</option>
            <option value="high">High</option>
            <option value="moderate">Moderate</option>
            <option value="low">Low</option>
            <option value="very_low">Very Low</option>
          </select>
        </label>
        <label className={styles.field}>
          <span>Due date</span>
          <input type="date" value={values.dueDate ?? ""} onChange={(e) => set("dueDate", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>POC</span>
          <input value={values.poc ?? ""} onChange={(e) => set("poc", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Control refs (comma separated)</span>
          <input value={values.controlRefs ?? ""} onChange={(e) => set("controlRefs", e.target.value)} />
        </label>
      </>
    );
  }

  return null;
}
