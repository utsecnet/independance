import { useMemo, useState } from "react";
import { useGraphStore } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import styles from "./RelationshipsTab.module.css";

interface RelatedIssue {
  id: string;
  title: string;
  typeLabel: string;
  typeColor: string;
}

/**
 * "blocks" and "depends_on" edges both describe the same underlying
 * blocker/blocked relationship from opposite ends (mirrors blockingPair in
 * the server's edgeService) — a "blocks" edge's source blocks its target,
 * while a "depends_on" edge's target blocks its source. Normalizing both
 * into per-node blocks/blockedBy sets here means the UI doesn't need to
 * care which encoding a given edge happens to use.
 *
 * `availableToAdd` is every other node minus this one, minus anything
 * already in either list — the same exclusion set works for both the
 * "Blocks" and "Is Blocked By" pickers, since a node that's already on
 * either side can't validly be added to the other: adding it to the
 * opposite side would make it simultaneously block and be blocked by this
 * node (a direct 2-node cycle), and adding it to the same side would just
 * duplicate the existing edge.
 */
function useNodeRelationships(nodeId: string): {
  blocks: RelatedIssue[];
  blockedBy: RelatedIssue[];
  availableToAdd: RelatedIssue[];
} {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);

  return useMemo(() => {
    const blocksIds = new Set<string>();
    const blockedByIds = new Set<string>();

    for (const edge of edges) {
      const relationshipType = edge.data?.relationshipType;
      if (relationshipType === "blocks") {
        if (edge.source === nodeId) blocksIds.add(edge.target);
        if (edge.target === nodeId) blockedByIds.add(edge.source);
      } else if (relationshipType === "depends_on") {
        if (edge.target === nodeId) blocksIds.add(edge.source);
        if (edge.source === nodeId) blockedByIds.add(edge.target);
      }
    }

    function toIssue(id: string): RelatedIssue | null {
      const node = nodes.find((n) => n.id === id);
      if (!node) return null;
      const typeConfig = nodeTypes.find((t) => t.id === node.data.nodeType);
      return {
        id,
        title: node.data.title,
        typeLabel: typeConfig?.label ?? node.data.nodeType,
        typeColor: typeConfig?.color ?? "var(--border)",
      };
    }

    const availableToAdd = nodes
      .map((n) => n.id)
      .filter((id) => id !== nodeId && !blocksIds.has(id) && !blockedByIds.has(id))
      .map(toIssue)
      .filter((issue): issue is RelatedIssue => issue !== null);

    return {
      blocks: Array.from(blocksIds)
        .map(toIssue)
        .filter((issue): issue is RelatedIssue => issue !== null),
      blockedBy: Array.from(blockedByIds)
        .map(toIssue)
        .filter((issue): issue is RelatedIssue => issue !== null),
      availableToAdd,
    };
  }, [edges, nodes, nodeTypes, nodeId]);
}

interface AddIssuePickerProps {
  label: string;
  candidates: RelatedIssue[];
  onAdd: (id: string) => void;
}

function AddIssuePicker({ label, candidates, onAdd }: AddIssuePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () => candidates.filter((issue) => issue.title.toLowerCase().includes(query.toLowerCase())),
    [candidates, query]
  );

  function handleAdd(id: string) {
    onAdd(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div className={styles.addWrapper}>
      <button
        type="button"
        className={styles.addButton}
        onClick={() => setOpen((v) => !v)}
        aria-label={`Add to ${label}`}
        title={`Add to ${label}`}
      >
        +
      </button>
      {open && (
        <>
          <div className={styles.addOverlay} onClick={() => setOpen(false)} />
          <div className={styles.addMenu}>
            <input
              type="text"
              className={styles.addSearch}
              placeholder="Search issues…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
            />
            <div className={styles.addList}>
              {filtered.length === 0 ? (
                <div className={styles.addEmpty}>
                  {candidates.length === 0 ? "No eligible issues" : "No matches"}
                </div>
              ) : (
                filtered.map((issue) => (
                  <button
                    key={issue.id}
                    type="button"
                    className={styles.addItem}
                    onClick={() => handleAdd(issue.id)}
                  >
                    <span className={styles.dot} style={{ background: issue.typeColor }} />
                    <span className={styles.itemTitle}>{issue.title}</span>
                    <span className={styles.itemType}>{issue.typeLabel}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

interface RelationshipSectionProps {
  title: string;
  issues: RelatedIssue[];
  emptyText: string;
  candidates: RelatedIssue[];
  onSelectIssue: (id: string) => void;
  onAddIssue: (id: string) => void;
}

function RelationshipSection({
  title,
  issues,
  emptyText,
  candidates,
  onSelectIssue,
  onAddIssue,
}: RelationshipSectionProps) {
  return (
    <div className={styles.section}>
      <div className={styles.sectionHeader}>
        <h4 className={styles.sectionTitle}>
          {title} ({issues.length})
        </h4>
        <AddIssuePicker label={title} candidates={candidates} onAdd={onAddIssue} />
      </div>
      {issues.length === 0 ? (
        <p className={styles.empty}>{emptyText}</p>
      ) : (
        <ul className={styles.list}>
          {issues.map((issue) => (
            <li key={issue.id}>
              <button type="button" className={styles.item} onClick={() => onSelectIssue(issue.id)}>
                <span className={styles.dot} style={{ background: issue.typeColor }} />
                <span className={styles.itemTitle}>{issue.title}</span>
                <span className={styles.itemType}>{issue.typeLabel}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface RelationshipsTabProps {
  nodeId: string;
}

export function RelationshipsTab({ nodeId }: RelationshipsTabProps) {
  const { blocks, blockedBy, availableToAdd } = useNodeRelationships(nodeId);
  const startEditing = useGraphStore((s) => s.startEditing);
  const createEdge = useGraphStore((s) => s.createEdge);

  return (
    <div className={styles.wrapper}>
      <RelationshipSection
        title="Blocks"
        issues={blocks}
        emptyText="This item doesn't block anything."
        candidates={availableToAdd}
        onSelectIssue={startEditing}
        onAddIssue={(id) => createEdge(nodeId, id, "blocks")}
      />
      <RelationshipSection
        title="Is Blocked By"
        issues={blockedBy}
        emptyText="Nothing is blocking this item."
        candidates={availableToAdd}
        onSelectIssue={startEditing}
        onAddIssue={(id) => createEdge(id, nodeId, "blocks")}
      />
    </div>
  );
}
