import { useEffect, useMemo, useRef, useState } from "react";
import type { NodeMetadata, NodeStatus, NodeType } from "@independance/shared";
import { useGraphStore, type RFNodeData } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { useDebouncedCallback } from "../../../../hooks/useDebouncedCallback";
import { MetadataFields, type MetadataFormValues } from "./MetadataFields";
import { RelationshipsTab } from "./RelationshipsTab";
import { PoamsTab } from "./PoamsTab";
import styles from "./NodeCardForm.module.css";

const AUTOSAVE_DEBOUNCE_MS = 500;
const BASE_TABS = ["Details", "Relationships"] as const;
// Only Task/Project tiles roll up POA&Ms from further down their own
// dependency chain (see collectUpstreamIdsByType) — a POA&M has nothing
// upstream of itself to roll up, and this tab would always be empty there.
const POAMS_TAB = "POA&Ms" as const;
type Tab = (typeof BASE_TABS)[number] | typeof POAMS_TAB;

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
  if (type === "poam") {
    return {
      control: (m.control as string) ?? "",
      severity: (m.severity as string) ?? "",
      residualRisk: (m.residualRisk as string) ?? "",
      nextMilestoneDate: (m.nextMilestoneDate as string) ?? "",
      poc: (m.poc as string) ?? "",
    };
  }
  return {};
}

function formValuesToMetadata(type: NodeType, values: MetadataFormValues, existing: NodeMetadata): NodeMetadata {
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
  if (type === "poam") {
    return {
      control: values.control || undefined,
      severity: (values.severity || undefined) as "very_high" | "high" | "moderate" | "low" | "very_low" | undefined,
      residualRisk: (values.residualRisk || undefined) as
        | "very_high"
        | "high"
        | "moderate"
        | "low"
        | "very_low"
        | undefined,
      nextMilestoneDate: values.nextMilestoneDate || undefined,
      poc: values.poc || undefined,
    };
  }
  // Custom types have no metadata form fields to edit, so leave whatever was
  // already stored untouched rather than clobbering it with {}.
  return existing;
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
  const tabs: readonly Tab[] = type === "task" || type === "project" ? [...BASE_TABS, POAMS_TAB] : BASE_TABS;
  const allStatuses = useConfigStore((s) => s.statuses);
  const statuses = useMemo(() => allStatuses.filter((st) => st.typeId === type), [allStatuses, type]);
  const [title, setTitle] = useState(data.title);
  const [description, setDescription] = useState(data.description ?? "");
  const [status, setStatus] = useState<NodeStatus>(data.status);
  const [metaValues, setMetaValues] = useState<MetadataFormValues>(metadataToFormValues(type, data.metadata));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [activeTab, setActiveTab] = useState<Tab>("Details");

  const skipNextAutosave = useRef(true);
  const titleInputRef = useRef<HTMLInputElement>(null);
  // A brand new tile opens with no title at all (see createNode's callers),
  // straight into this form — so an empty title here means this card just
  // opened *because* the tile was just created, not because it was reopened
  // for editing, and that's the one case worth landing the cursor in Title
  // automatically. Neither a plain autoFocus prop nor an immediate .focus()
  // call in an effect actually lands it, though — same root cause as the
  // fitView delay in GraphCanvas: a newly added React Flow node isn't fully
  // measured/attached in the same tick its card opens, so .focus() on it is
  // silently dropped as not-yet-focusable. The same short delay used there
  // works here too. Checked only once, at mount — data.title is
  // intentionally not a dependency, since deleting the title back to empty
  // while editing an existing tile shouldn't suddenly steal focus back to it.
  useEffect(() => {
    if (data.title !== "") return;
    const timer = setTimeout(() => titleInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const isDirty = useRef(false);
  // Unlike isDirty (cleared the moment an autosave lands), this never resets
  // once set — it's what Escape checks to decide whether there's anything
  // to revert at all, since an edit typed >500ms before Escape is pressed
  // has already autosaved and isDirty would otherwise read false by then.
  const everDirty = useRef(false);
  // Snapshot of exactly what this card looked like when it was opened, so
  // Escape can restore precisely that — not just "undo the last unsaved
  // keystroke" but "undo everything typed this time the card was open,"
  // including whatever the 500ms autosave already committed to the server.
  const originalSnapshot = useRef({ title: data.title, description: data.description ?? "", status: data.status, metadata: data.metadata });
  // The debounce timer's own unmount cleanup just cancels the pending
  // timeout — it never invokes the callback — so closing the card (Done,
  // clicking away, selecting another node) before the 500ms debounce fires
  // would silently drop the edit. This ref always holds the latest field
  // values (type and data.metadata included, even though neither is
  // editable here directly — data.metadata is read back below as the base
  // a custom type's unedited metadata is preserved against, and if it goes
  // stale that base reverts any change made elsewhere, e.g. by an undo,
  // while this card sits open) so the unmount effect further down can
  // flush them for real, using what's current at close time rather than
  // whatever was true when the card first opened.
  const latestValues = useRef({ title, description, status, metaValues, type, metadata: data.metadata });
  latestValues.current = { title, description, status, metaValues, type, metadata: data.metadata };

  async function persistEdit() {
    const { title, description, status, metaValues, type, metadata: baseMetadata } = latestValues.current;
    if (!title.trim()) return;
    setSaveState("saving");
    setError(null);
    try {
      const metadata = formValuesToMetadata(type, metaValues, baseMetadata);
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
    everDirty.current = true;
    debouncedAutosave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, description, status, metaValues]);

  // Flush any unsaved edit when the card collapses, regardless of what
  // triggered it (Done, clicking away, selecting a different node).
  useEffect(() => {
    return () => {
      if (!isDirty.current) return;
      const { title, description, status, metaValues, type, metadata: baseMetadata } = latestValues.current;
      if (!title.trim()) return;
      const metadata = formValuesToMetadata(type, metaValues, baseMetadata);
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

  // Enter saves immediately (rather than waiting out the autosave debounce)
  // and closes; Escape discards everything changed since the card opened —
  // including whatever the debounce already autosaved — and closes without
  // it. Either way isDirty is cleared before onClose so the unmount-flush
  // effect above never re-applies (Escape) or redundantly re-saves (Enter)
  // on top of what this already did.
  async function handleEnterSave() {
    if (!latestValues.current.title.trim()) return;
    debouncedAutosave.cancel();
    await persistEdit();
    onClose();
  }

  function handleEscapeDiscard() {
    debouncedAutosave.cancel();
    if (everDirty.current) {
      isDirty.current = false;
      updateNode(id, { ...originalSnapshot.current }).catch(() => {});
    }
    onClose();
  }

  // A React onKeyDown prop on the form only ever fires while focus is
  // somewhere *inside* it — expanding a tile doesn't itself focus any of
  // its fields, so with nothing clicked into yet, Escape/Enter would silently
  // do nothing. A window-level listener catches both regardless of focus,
  // same as ItemsBlade's own Escape-to-close handling. Read through a ref
  // (rather than putting the handlers themselves in the effect's deps) so
  // this only ever attaches once per card, not on every render.
  const handlersRef = useRef({ handleEnterSave, handleEscapeDiscard });
  handlersRef.current = { handleEnterSave, handleEscapeDiscard };

  useEffect(() => {
    function onWindowKeyDown(e: globalThis.KeyboardEvent) {
      if (e.key === "Enter" && !(e.target instanceof HTMLTextAreaElement) && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        handlersRef.current.handleEnterSave();
      } else if (e.key === "Escape") {
        e.preventDefault();
        handlersRef.current.handleEscapeDiscard();
      }
    }
    window.addEventListener("keydown", onWindowKeyDown);
    return () => window.removeEventListener("keydown", onWindowKeyDown);
  }, []);

  // Rendered once and placed wherever this type wants it (see the Details
  // tab below and MetadataFields' poam branch) rather than duplicating the
  // select markup in two spots.
  const statusField = (
    <label className={styles.field}>
      <span>Status</span>
      <select value={status} onChange={(e) => setStatus(e.target.value as NodeStatus)}>
        {statuses.map((s) => (
          <option key={s.id} value={s.value}>
            {s.label}
          </option>
        ))}
      </select>
    </label>
  );

  return (
    <form
      // nodrag alone only opts out of *node* dragging — with tiles
      // undraggable in Auto mode (see GraphCanvas's nodesDraggable), a
      // click-drag starting inside a text field (e.g. selecting text) had
      // nothing left to claim it, so it fell through to React Flow's pane
      // gesture and panned the whole canvas instead. nopan is the separate
      // class that opts out of that.
      className={`${styles.form} nodrag nopan`}
      onClick={(e) => e.stopPropagation()}
      onSubmit={(e) => e.preventDefault()}
    >
      <div className={styles.tabs}>
        {tabs.map((tab) => (
          <button
            key={tab}
            type="button"
            className={`${styles.tab} ${tab === activeTab ? styles.tabActive : ""}`}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>

      {activeTab === "Details" ? (
        <>
          {/* Every type but POA&M leads with Status, ahead of Title —
              POA&M instead wants it woven in after Control (see
              MetadataFields' poam branch), so it's held here as a node
              rather than rendered inline, and only placed up front for the
              types that actually want it there. */}
          {type !== "poam" && statusField}
          <label className={styles.field}>
            <span>Title</span>
            <input ref={titleInputRef} value={title} onChange={(e) => setTitle(e.target.value)} required />
          </label>
          <label className={styles.field}>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} />
          </label>
          <MetadataFields type={type} values={metaValues} onChange={setMetaValues} statusField={statusField} />
        </>
      ) : activeTab === "Relationships" ? (
        <RelationshipsTab nodeId={id} />
      ) : (
        <PoamsTab nodeId={id} />
      )}

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
