import type { ReactNode } from "react";
import type { NodeType } from "@independance/shared";
import { SEVERITY_LEVELS } from "../../../../constants/severity";
import styles from "./NodeCardForm.module.css";

export interface MetadataFormValues {
  assignee?: string;
  estimateHours?: string;
  dueDate?: string;
  owner?: string;
  targetDate?: string;
  tags?: string;
  control?: string;
  severity?: string;
  residualRisk?: string;
  poc?: string;
  nextMilestoneDate?: string;
}

interface MetadataFieldsProps {
  type: NodeType;
  values: MetadataFormValues;
  onChange: (values: MetadataFormValues) => void;
  /**
   * The pre-rendered Status field (see NodeCardForm) — every type but
   * POA&M renders it up front instead, ahead of this component entirely,
   * so it's only actually placed here for poam's own field order (Control,
   * Status, Inherent Risk, Residual Risk, POC, Next milestone date).
   */
  statusField: ReactNode;
}

export function MetadataFields({ type, values, onChange, statusField }: MetadataFieldsProps) {
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
          <span>Control</span>
          <input
            placeholder="e.g. AC-2(4)"
            value={values.control ?? ""}
            onChange={(e) => set("control", e.target.value)}
          />
        </label>
        {statusField}
        <label className={styles.field}>
          <span>Inherent Risk</span>
          <select value={values.severity ?? ""} onChange={(e) => set("severity", e.target.value)}>
            <option value="">—</option>
            {SEVERITY_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Residual Risk</span>
          <select value={values.residualRisk ?? ""} onChange={(e) => set("residualRisk", e.target.value)}>
            <option value="">—</option>
            {SEVERITY_LEVELS.map((level) => (
              <option key={level.value} value={level.value}>
                {level.label}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>POC</span>
          <input value={values.poc ?? ""} onChange={(e) => set("poc", e.target.value)} />
        </label>
        <label className={styles.field}>
          <span>Next milestone date</span>
          <input
            type="date"
            value={values.nextMilestoneDate ?? ""}
            onChange={(e) => set("nextMilestoneDate", e.target.value)}
          />
        </label>
      </>
    );
  }

  return null;
}
