import { useState } from "react";
import type { NodeMetadata, NodeStatus, NodeType } from "@independance/shared";
import { useGraphStore, type GraphRFNode } from "../../../state/store";
import { MetadataFields, type MetadataFormValues } from "./MetadataFields";
import styles from "./NodeForm.module.css";

const STATUS_OPTIONS: NodeStatus[] = ["not_started", "in_progress", "blocked", "complete"];
const TYPE_OPTIONS: NodeType[] = ["task", "project", "poam"];

function metadataToFormValues(type: NodeType, metadata: NodeMetadata): MetadataFormValues {
  const m = metadata as Record<string, unknown>;
  if (type === "task") {
    return {
      assignee: (m.assignee as string) ?? "",
      estimateHours: m.estimateHours !== undefined ? String(m.estimateHours) : "",
      dueDate: (m.dueDate as string) ?? "",
    };
  }
  if (type === "project") {
    return {
      owner: (m.owner as string) ?? "",
      targetDate: (m.targetDate as string) ?? "",
      tags: Array.isArray(m.tags) ? (m.tags as string[]).join(", ") : "",
    };
  }
  return {
    severity: (m.severity as string) ?? "",
    dueDate: (m.dueDate as string) ?? "",
    poc: (m.poc as string) ?? "",
    controlRefs: Array.isArray(m.controlRefs) ? (m.controlRefs as string[]).join(", ") : "",
  };
}

function formValuesToMetadata(type: NodeType, values: MetadataFormValues): NodeMetadata {
  if (type === "task") {
    return {
      assignee: values.assignee || undefined,
      estimateHours: values.estimateHours ? Number(values.estimateHours) : undefined,
      dueDate: values.dueDate || undefined,
    };
  }
  if (type === "project") {
    return {
      owner: values.owner || undefined,
      targetDate: values.targetDate || undefined,
      tags: values.tags
        ? values.tags.split(",").map((t) => t.trim()).filter(Boolean)
        : undefined,
    };
  }
  return {
    severity: (values.severity || undefined) as "low" | "moderate" | "high" | undefined,
    dueDate: values.dueDate || undefined,
    poc: values.poc || undefined,
    controlRefs: values.controlRefs
      ? values.controlRefs.split(",").map((t) => t.trim()).filter(Boolean)
      : undefined,
  };
}

interface NodeFormProps {
  editingNode: GraphRFNode | null;
  onDone: () => void;
}

export function NodeForm({ editingNode, onDone }: NodeFormProps) {
  const createNode = useGraphStore((s) => s.createNode);
  const updateNode = useGraphStore((s) => s.updateNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);

  const [type, setType] = useState<NodeType>(editingNode?.data.nodeType ?? "task");
  const [title, setTitle] = useState(editingNode?.data.title ?? "");
  const [description, setDescription] = useState(editingNode?.data.description ?? "");
  const [status, setStatus] = useState<NodeStatus>(editingNode?.data.status ?? "not_started");
  const [metaValues, setMetaValues] = useState<MetadataFormValues>(
    editingNode ? metadataToFormValues(editingNode.data.nodeType, editingNode.data.metadata) : {}
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = editingNode !== null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const metadata = formValuesToMetadata(type, metaValues);
      if (isEditing) {
        await updateNode(editingNode.id, { title, description, status, metadata });
      } else {
        await createNode({ type, title, description, status, metadata });
        setTitle("");
        setDescription("");
        setStatus("not_started");
        setMetaValues({});
      }
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!editingNode) return;
    setSubmitting(true);
    try {
      await deleteNode(editingNode.id);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setSubmitting(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Type</span>
          <select value={type} onChange={(e) => setType(e.target.value as NodeType)} disabled={isEditing}>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>
                {t === "poam" ? "POA&M" : t[0].toUpperCase() + t.slice(1)}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s.replace("_", " ")}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className={styles.field}>
        <span>Title</span>
        <input value={title} onChange={(e) => setTitle(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span>Description</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <MetadataFields type={type} values={metaValues} onChange={setMetaValues} />
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting}>
          {isEditing ? "Save changes" : "Create"}
        </button>
        {isEditing && (
          <>
            <button type="button" className={styles.secondary} onClick={onDone}>
              Cancel
            </button>
            <button type="button" className={styles.danger} onClick={handleDelete} disabled={submitting}>
              Delete
            </button>
          </>
        )}
      </div>
    </form>
  );
}
