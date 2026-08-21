import { useMemo } from "react";
import { useGraphStore } from "../../../../state/store";
import { useConfigStore } from "../../../../state/configStore";
import { collectUpstreamIdsByType } from "../../../../state/dependencyRollup";
import { poamListLabel } from "../../../../utils/poamDisplay";
import styles from "./RelationshipsTab.module.css";

interface PoamsTabProps {
  nodeId: string;
}

// Lists the same POA&Ms the tile's own rollup tab (see GraphNodeCard) only
// shows a count for — everything upstream of this node in the "blocks"
// chain, walked through any number of Tasks in between but never crossing
// a Project boundary (see collectUpstreamIdsByType).
export function PoamsTab({ nodeId }: PoamsTabProps) {
  const nodes = useGraphStore((s) => s.nodes);
  const edges = useGraphStore((s) => s.edges);
  const startEditing = useGraphStore((s) => s.startEditing);
  const poamType = useConfigStore((s) => s.nodeTypes.find((t) => t.id === "poam"));
  const statuses = useConfigStore((s) => s.statuses);

  const poams = useMemo(() => {
    const byType = collectUpstreamIdsByType(
      nodeId,
      nodes.map((n) => ({ id: n.id, type: n.data.nodeType })),
      edges.map((e) => ({ source: e.source, target: e.target, relationshipType: e.data!.relationshipType }))
    );
    const ids = new Set(byType.get("poam") ?? []);
    return nodes
      .filter((n) => ids.has(n.id))
      .sort((a, b) => a.data.title.localeCompare(b.data.title));
  }, [nodeId, nodes, edges]);

  return (
    <div className={styles.wrapper}>
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h4 className={styles.sectionTitle}>POA&amp;Ms ({poams.length})</h4>
        </div>
        {poams.length === 0 ? (
          <p className={styles.empty}>No dependent POA&amp;Ms.</p>
        ) : (
          <ul className={styles.list}>
            {poams.map((poam) => {
              const statusLabel =
                statuses.find((s) => s.typeId === "poam" && s.value === poam.data.status)?.label ??
                poam.data.status;
              return (
                <li key={poam.id}>
                  <button type="button" className={styles.item} onClick={() => startEditing(poam.id)}>
                    <span className={styles.dot} style={{ background: poamType?.color ?? "var(--border)" }} />
                    <span className={styles.itemTitle}>{poamListLabel(poam.data.title, poam.data.metadata)}</span>
                    <span className={styles.itemType}>{statusLabel}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
