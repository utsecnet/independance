import { useState } from "react";
import type { RelationshipType } from "@independance/shared";
import { useGraphStore } from "../../../state/store";
import styles from "./NodeForm.module.css";

const RELATIONSHIP_OPTIONS: RelationshipType[] = ["depends_on", "blocks", "relates_to", "remediates"];

export function EdgeCreator() {
  const nodes = useGraphStore((s) => s.nodes);
  const createEdge = useGraphStore((s) => s.createEdge);

  const [sourceId, setSourceId] = useState("");
  const [targetId, setTargetId] = useState("");
  const [relationshipType, setRelationshipType] = useState<RelationshipType>("depends_on");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sourceId || !targetId || sourceId === targetId) return;
    setSubmitting(true);
    setError(null);
    try {
      await createEdge(sourceId, targetId, relationshipType);
      setSourceId("");
      setTargetId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to link");
    } finally {
      setSubmitting(false);
    }
  }

  if (nodes.length < 2) return null;

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <label className={styles.field}>
        <span>From</span>
        <select value={sourceId} onChange={(e) => setSourceId(e.target.value)}>
          <option value="">Select node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.title}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>Relationship</span>
        <select value={relationshipType} onChange={(e) => setRelationshipType(e.target.value as RelationshipType)}>
          {RELATIONSHIP_OPTIONS.map((r) => (
            <option key={r} value={r}>
              {r.replace("_", " ")}
            </option>
          ))}
        </select>
      </label>
      <label className={styles.field}>
        <span>To</span>
        <select value={targetId} onChange={(e) => setTargetId(e.target.value)}>
          <option value="">Select node…</option>
          {nodes.map((n) => (
            <option key={n.id} value={n.id}>
              {n.data.title}
            </option>
          ))}
        </select>
      </label>
      {error && <div className={styles.error}>{error}</div>}
      <div className={styles.actions}>
        <button type="submit" className={styles.submit} disabled={submitting || !sourceId || !targetId}>
          Link nodes
        </button>
      </div>
    </form>
  );
}
