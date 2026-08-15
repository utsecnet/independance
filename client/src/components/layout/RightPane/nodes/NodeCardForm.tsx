import { useEffect, useRef, useState } from "react";
import type { NodeMetadata, NodeStatus, NodeType } from "@independance/shared";
import { useGraphStore, type RFNodeData } from "../../../../state/store";
import { useDebouncedCallback } from "../../../../hooks/useDebouncedCallback";
import { STATUS_LABELS, statusOptionsForType } from "../../../../constants/nodeStatus";
import { MetadataFields, type MetadataFormValues } from "./MetadataFields";
import styles from "./NodeCardForm.module.css";

const AUTOSAVE_DEBOUNCE_MS = 500;

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

interface NodeCardFormProps {
  id: string;
  data: RFNodeData;
  onClose: () => void;
}

export function NodeCardForm({ id, data, onClose }: NodeCardFormProps) {
  const updateNode = useGraphStore((s) => s.updateNode);
  const deleteNode = useGraphStore((s) => s.deleteNode);

  const type = data.nodeType;
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description ?? "");
  const [status, setStatus] = useState<NodeStatus>(data.status);
  const [metaValues, setMetaValues] = useState<MetadataFormValues>(metadataToFormValues(type, data.metadata));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const skipNextAutosave = useRef(true);
  const isDirty = useRef(false);
  // The debounce timer's own unmount cleanup just cancels the pending
  // timeout — it never invokes the callback — so closing the card (Done,
  // clicking away, selecting another node) before the 500ms debounce fires
  // would silently drop the edit. This ref always holds the latest field
  // values so a separate unmount effect below can flush them for real.
  const latestValues = useRef({ title, description, status, metaValues });
  latestValues.current = { title, description, status, metaValues };

  async function persistEdit() {
    const { title, description, status, metaValues } = latestValues.current;
    if (!title.trim()) return;
    setSaveState("saving");
    setError(null);
    try {
      const metadata = formValuesToMetadata(type, metaValues);
      await updateNode(id, { title, description, status, metadata });
      isDirty.current = false;
      setSaveState("saved");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
      setSaveState("idle");
    }
  }

  const debouncedAutosave = useDebouncedCallback(persistEdit, AUTOSAVE_DEBOUNCE_MS);

  useEffect(() => {
    if (skipNextAutosave.current) {
      skipNextAutosave.current = false;
      return;
    }
    isDirty.current = true;
    debouncedAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, metaValues]);

  // Flush any unsaved edit when the card collapses, regardless of what
  // triggered it (Done, clicking away, selecting a different node).
  useEffect(() => {
    return () => {
      if (!isDirty.current) return;
      const { title, description, status, metaValues } = latestValues.current;
      if (!title.trim()) return;
      const metadata = formValuesToMetadata(type, metaValues);
      updateNode(id, { title, description, status, metadata }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleDelete() {
    isDirty.current = false;
    setSubmitting(true);
    try {
      await deleteNode(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
      setSubmitting(false);
    }
  }

  return (
    <form
      className={`${styles.form} nodrag`}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className={styles.row}>
        <label className={styles.field}>
          <span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
            {statusOptionsForType(type).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
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
      {saveState !== "idle" && !error && (
        <div className={styles.saveStatus}>{saveState === "saving" ? "Saving…" : "Saved"}</div>
      )}
      <div className={styles.actions}>
        <button type="button" className={styles.secondary} onClick={onClose}>
          Done
        </button>
        <button type="button" className={styles.danger} onClick={handleDelete} disabled={submitting}>
          Delete
        </button>
      </div>
    </form>
  );
}
