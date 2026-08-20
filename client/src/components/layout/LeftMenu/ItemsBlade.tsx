import { useEffect, useState } from "react";
import { useConfigStore } from "../../../state/configStore";
import { useGraphStore } from "../../../state/store";
import { poamListLabel } from "../../../utils/poamDisplay";
import styles from "./ItemsBlade.module.css";

interface ItemsBladeProps {
  /** A node type id to list, or null to keep the blade closed. */
  typeId: string | null;
  onClose: () => void;
}

// Mirrors SettingsBlade's own slide-in-from-left overlay so the two blades
// this app can show read as the same interaction, just with different
// content — one lists a node type's items, the other is app configuration.
export function ItemsBlade({ typeId, onClose }: ItemsBladeProps) {
  const open = typeId !== null;
  const typeConfig = useConfigStore((s) => s.nodeTypes.find((t) => t.id === typeId));
  const statuses = useConfigStore((s) => s.statuses);
  const nodes = useGraphStore((s) => s.nodes);
  const selectNode = useGraphStore((s) => s.selectNode);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Stale search text from one type (or from before the blade was last
  // closed) shouldn't silently keep filtering the next type it's opened
  // to — switching type or reopening always starts from a clean search.
  useEffect(() => {
    setQuery("");
  }, [typeId]);

  const allItems = typeId
    ? nodes.filter((n) => n.data.nodeType === typeId).sort((a, b) => a.data.title.localeCompare(b.data.title))
    : [];

  function labelFor(item: (typeof allItems)[number]): string {
    return item.data.nodeType === "poam" ? poamListLabel(item.data.title, item.data.metadata) : item.data.title;
  }

  const trimmedQuery = query.trim().toLowerCase();
  const items = trimmedQuery ? allItems.filter((item) => labelFor(item).toLowerCase().includes(trimmedQuery)) : allItems;

  // Closes the blade on top of selecting so the now-expanded, re-centered
  // tile (see GraphCanvas's fitView-on-selectedId effect) isn't left
  // sitting behind the blade that just picked it.
  function handleSelect(id: string) {
    selectNode(id);
    onClose();
  }

  return (
    <div className={`${styles.blade} ${open ? styles.bladeOpen : ""}`} aria-hidden={!open}>
      <div className={styles.header}>
        <div className={styles.title}>
          <span className={styles.dot} style={{ background: typeConfig?.color ?? "var(--border)" }} />
          {typeConfig?.label ?? "Items"}
          {/* "shown/total" once a search narrows the list, plain "(total)"
              the rest of the time — matches before this field existed. */}
          <span className={styles.count}>
            {trimmedQuery ? `(${items.length}/${allItems.length})` : `(${allItems.length})`}
          </span>
        </div>
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close">
          ×
        </button>
      </div>
      {allItems.length > 0 && (
        <div className={styles.searchRow}>
          <svg
            className={styles.searchIcon}
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="text"
            className={styles.searchInput}
            placeholder={`Search ${typeConfig?.label?.toLowerCase() ?? "items"}...`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label={`Search ${typeConfig?.label ?? "items"}`}
          />
          {query && (
            <button
              type="button"
              className={styles.searchClear}
              onClick={() => setQuery("")}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>
      )}
      <div className={styles.content}>
        {allItems.length === 0 ? (
          <div className={styles.empty}>No {typeConfig?.label ?? "items"} yet.</div>
        ) : items.length === 0 ? (
          <div className={styles.empty}>No {typeConfig?.label?.toLowerCase() ?? "items"} match "{query.trim()}".</div>
        ) : (
          <div className={styles.itemList}>
            {items.map((item) => {
              const statusLabel =
                statuses.find((s) => s.typeId === item.data.nodeType && s.value === item.data.status)?.label ??
                item.data.status;
              return (
                <button key={item.id} type="button" className={styles.item} onClick={() => handleSelect(item.id)}>
                  <span className={styles.itemTitle}>{labelFor(item)}</span>
                  <span className={styles.itemStatus}>{statusLabel}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
