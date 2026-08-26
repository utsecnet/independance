import { useEffect, useRef, useState } from "react";
import {
  ALWAYS_ON_TILE_FIELDS,
  DEFAULT_TILE_FIELDS,
  MAX_EXTRA_TILE_FIELDS,
  RETRO_COLOR_PALETTE,
  TILE_FIELD_DEFS,
  type FullBackup,
  type TileFieldId,
} from "@independance/shared";
import { backupApi, type RestoreResult } from "../../../api/backup";
import { useConfigStore } from "../../../state/configStore";
import { useGraphStore } from "../../../state/store";
import { ColorPicker } from "./ColorPicker";
import styles from "./SettingsBlade.module.css";

const TABS = ["Types & Statuses", "Appearance", "Backup"];

// Title is unconditionally rendered on every tile (see ALWAYS_ON_TILE_FIELDS)
// rather than being part of the toggleable TILE_FIELD_DEFS list — listed
// here purely so Appearance's field picker can show it, checked and locked,
// alongside each type's actual selectable fields (Type and Status included)
// for a complete picture of what's on the tile.
const ALWAYS_ON_FIELD_LABELS: Record<(typeof ALWAYS_ON_TILE_FIELDS)[number], string> = {
  title: "Title",
};

function slugify(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .replace(/^[^a-z]+/, "");
}

function TypesStatusesSettings() {
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const statuses = useConfigStore((s) => s.statuses);
  const error = useConfigStore((s) => s.error);
  const loadConfig = useConfigStore((s) => s.loadConfig);
  const clearError = useConfigStore((s) => s.clearError);
  const createNodeType = useConfigStore((s) => s.createNodeType);
  const updateNodeType = useConfigStore((s) => s.updateNodeType);
  const deleteNodeType = useConfigStore((s) => s.deleteNodeType);
  const createStatus = useConfigStore((s) => s.createStatus);
  const updateStatus = useConfigStore((s) => s.updateStatus);
  const deleteStatus = useConfigStore((s) => s.deleteStatus);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [newColor, setNewColor] = useState<string>(RETRO_COLOR_PALETTE[0]);
  const [slugEdited, setSlugEdited] = useState(false);
  const [newStatusLabel, setNewStatusLabel] = useState("");

  function handleLabelChange(value: string) {
    setNewLabel(value);
    if (!slugEdited) setNewSlug(slugify(value));
  }

  function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    if (!newLabel.trim() || !newSlug.trim()) return;
    createNodeType({ id: newSlug, label: newLabel.trim(), color: newColor });
    setNewLabel("");
    setNewSlug("");
    setSlugEdited(false);
    setNewColor(RETRO_COLOR_PALETTE[0]);
  }

  function handleAddStatus(typeId: string) {
    if (!newStatusLabel.trim()) return;
    createStatus({ typeId, value: slugify(newStatusLabel), label: newStatusLabel.trim() });
    setNewStatusLabel("");
  }

  function moveStatus(typeId: string, statusId: string, direction: -1 | 1) {
    const ordered = statuses.filter((s) => s.typeId === typeId).sort((a, b) => a.sortOrder - b.sortOrder);
    const idx = ordered.findIndex((s) => s.id === statusId);
    const swapIdx = idx + direction;
    if (idx < 0 || swapIdx < 0 || swapIdx >= ordered.length) return;
    const a = ordered[idx];
    const b = ordered[swapIdx];
    updateStatus(a.id, { sortOrder: b.sortOrder });
    updateStatus(b.id, { sortOrder: a.sortOrder });
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Types &amp; Statuses</h2>
      <p className={styles.hint}>
        Manage the item types available from the + button, their tile color, and the statuses each type can use.
      </p>

      {error && (
        <div className={styles.error}>
          {error}
          <button type="button" className={styles.dismiss} onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.typeList}>
        {nodeTypes.map((type) => {
          const typeStatuses = statuses
            .filter((s) => s.typeId === type.id)
            .sort((a, b) => a.sortOrder - b.sortOrder);
          const expanded = expandedTypeId === type.id;
          return (
            <div key={type.id} className={styles.typeCard}>
              <div className={styles.typeRow}>
                <ColorPicker value={type.color} onChange={(color) => updateNodeType(type.id, { color })} />
                <input
                  className={styles.labelInput}
                  value={type.label}
                  onChange={(e) => updateNodeType(type.id, { label: e.target.value })}
                />
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setExpandedTypeId(expanded ? null : type.id)}
                >
                  {expanded ? "Hide" : "Statuses"} ({typeStatuses.length})
                </button>
                <button type="button" className={styles.dangerButton} onClick={() => deleteNodeType(type.id)}>
                  Delete
                </button>
              </div>

              {expanded && (
                <div className={styles.statusList}>
                  {typeStatuses.map((status, i) => (
                    <div key={status.id} className={styles.statusRow}>
                      <div className={styles.reorderButtons}>
                        <button
                          type="button"
                          disabled={i === 0}
                          onClick={() => moveStatus(type.id, status.id, -1)}
                          aria-label="Move up"
                        >
                          ▲
                        </button>
                        <button
                          type="button"
                          disabled={i === typeStatuses.length - 1}
                          onClick={() => moveStatus(type.id, status.id, 1)}
                          aria-label="Move down"
                        >
                          ▼
                        </button>
                      </div>
                      <input
                        className={styles.labelInput}
                        value={status.label}
                        onChange={(e) => updateStatus(status.id, { label: e.target.value })}
                      />
                      <label className={styles.defaultToggle}>
                        <input
                          type="radio"
                          name={`default-${type.id}`}
                          checked={status.isDefault}
                          onChange={() => updateStatus(status.id, { isDefault: true })}
                        />
                        Default
                      </label>
                      <button
                        type="button"
                        className={styles.dangerButton}
                        onClick={() => deleteStatus(status.id)}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                  <div className={styles.addStatusRow}>
                    <input
                      className={styles.labelInput}
                      placeholder="New status label"
                      value={newStatusLabel}
                      onChange={(e) => setNewStatusLabel(e.target.value)}
                    />
                    <button type="button" className={styles.linkButton} onClick={() => handleAddStatus(type.id)}>
                      Add status
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <form className={styles.addTypeForm} onSubmit={handleAddType}>
        <h3 className={styles.subheading}>Add a new type</h3>
        <div className={styles.addTypeRow}>
          <ColorPicker value={newColor} onChange={setNewColor} />
          <input
            className={styles.labelInput}
            placeholder="Label (e.g. Risk)"
            value={newLabel}
            onChange={(e) => handleLabelChange(e.target.value)}
          />
          <input
            className={styles.labelInput}
            placeholder="slug"
            value={newSlug}
            onChange={(e) => {
              setSlugEdited(true);
              setNewSlug(slugify(e.target.value));
            }}
          />
          <button type="submit" className={styles.linkButton}>
            Add type
          </button>
        </div>
      </form>
    </div>
  );
}

function AppearanceSettings() {
  const tileFieldsByType = useConfigStore((s) => s.tileFields);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const error = useConfigStore((s) => s.error);
  const clearError = useConfigStore((s) => s.clearError);
  const updateAppSettings = useConfigStore((s) => s.updateAppSettings);

  const [expandedTypeId, setExpandedTypeId] = useState<string | null>(null);

  // Each type's selection lives under its own key, so toggling a field for
  // one type only ever rewrites that type's entry — every other type's
  // list in the record is passed through untouched.
  function toggleField(typeId: string, fieldId: TileFieldId) {
    const current = tileFieldsByType[typeId] ?? DEFAULT_TILE_FIELDS;
    const isSelected = current.includes(fieldId);
    if (isSelected) {
      updateAppSettings({ tileFields: { ...tileFieldsByType, [typeId]: current.filter((f) => f !== fieldId) } });
    } else {
      if (current.length >= MAX_EXTRA_TILE_FIELDS) return;
      updateAppSettings({ tileFields: { ...tileFieldsByType, [typeId]: [...current, fieldId] } });
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tile</h2>
      <p className={styles.hint}>Select fields you want visible on each tile</p>

      {error && (
        <div className={styles.error}>
          {error}
          <button type="button" className={styles.dismiss} onClick={clearError}>
            Dismiss
          </button>
        </div>
      )}

      <div className={styles.typeList}>
        {nodeTypes.map((type) => {
          const selected = tileFieldsByType[type.id] ?? DEFAULT_TILE_FIELDS;
          // Type and Status apply the same way to every node type, so
          // they're always offered; the rest are specific to task/project/
          // poam's own metadata shape (a user-created type has none of its
          // own, so it only ever gets to pick from the first two).
          const fields = TILE_FIELD_DEFS.filter(
            (field) =>
              field.id === "type" || field.id === "status" || (field.groups as readonly string[]).includes(type.id)
          );
          const selectedCount = fields.filter((field) => selected.includes(field.id)).length;
          const expanded = expandedTypeId === type.id;
          return (
            <div key={type.id} className={styles.typeCard}>
              <div className={styles.typeRow}>
                <span className={styles.groupLabel}>{type.label}</span>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setExpandedTypeId(expanded ? null : type.id)}
                >
                  {expanded ? "Hide" : "Fields"} ({selectedCount}/{fields.length})
                </button>
              </div>

              {expanded && (
                <div className={styles.statusList}>
                  <div className={styles.fieldGrid}>
                    {ALWAYS_ON_TILE_FIELDS.map((fieldId) => (
                      <label key={fieldId} className={styles.fieldOption} title="Always shown on every tile">
                        <input type="checkbox" checked disabled />
                        {ALWAYS_ON_FIELD_LABELS[fieldId]}
                      </label>
                    ))}
                    {fields.map((field) => {
                      const checked = selected.includes(field.id);
                      const disabled = !checked && selected.length >= MAX_EXTRA_TILE_FIELDS;
                      return (
                        <label
                          key={field.id}
                          className={`${styles.fieldOption} ${disabled ? styles.fieldOptionDisabled : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleField(type.id, field.id)}
                          />
                          {field.label}
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function formatDateForFilename(iso: string): string {
  return iso.slice(0, 10);
}

function triggerJsonDownload(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function isLikelyBackup(value: unknown): value is FullBackup {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    "nodeTypes" in value &&
    "statuses" in value &&
    "nodes" in value &&
    "edges" in value
  );
}

function BackupSettings() {
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const [pendingBackup, setPendingBackup] = useState<FullBackup | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<RestoreResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleExport() {
    setExporting(true);
    setExportError(null);
    try {
      const backup = await backupApi.export();
      triggerJsonDownload(backup, `independance-backup-${formatDateForFilename(backup.exportedAt)}.json`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Failed to export backup");
    } finally {
      setExporting(false);
    }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileError(null);
    setRestoreError(null);
    setRestoreResult(null);
    try {
      const text = await file.text();
      const parsed: unknown = JSON.parse(text);
      if (!isLikelyBackup(parsed)) {
        throw new Error("This doesn't look like an independance backup file.");
      }
      setPendingBackup(parsed);
    } catch (err) {
      setPendingBackup(null);
      setFileError(err instanceof Error ? err.message : "Failed to read this file.");
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRestore() {
    if (!pendingBackup) return;
    setRestoring(true);
    setRestoreError(null);
    try {
      const result = await backupApi.restore(pendingBackup);
      // A restore can replace node types/statuses/appearance settings, not
      // just the graph — refresh both stores so every piece of client state
      // a restore can touch matches what's actually in the database now.
      await Promise.all([useConfigStore.getState().loadConfig(), useGraphStore.getState().loadGraph()]);
      setRestoreResult(result);
      setPendingBackup(null);
    } catch (err) {
      setRestoreError(err instanceof Error ? err.message : "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Backup</h2>
      <p className={styles.hint}>
        Export everything in this graph — tiles, links, custom types/statuses, and appearance settings — to a single
        JSON file, or restore from one.
      </p>

      <h3 className={styles.subheading}>Export</h3>
      <button type="button" className={styles.linkButton} onClick={handleExport} disabled={exporting}>
        {exporting ? "Exporting…" : "Download backup"}
      </button>
      {exportError && <div className={styles.error}>{exportError}</div>}

      <h3 className={styles.subheading}>Restore</h3>
      <p className={styles.hint}>Restoring replaces everything currently in this graph with the backup's contents.</p>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        onChange={handleFileChange}
        className={styles.hiddenFileInput}
        id="backup-restore-file"
      />
      <label htmlFor="backup-restore-file" className={styles.fileButton}>
        Choose backup file
      </label>
      {fileError && <div className={styles.error}>{fileError}</div>}

      {pendingBackup && (
        <div className={styles.summaryBox}>
          <p>
            Backup from {new Date(pendingBackup.exportedAt).toLocaleString()}: {pendingBackup.nodeTypes.length} types,{" "}
            {pendingBackup.statuses.length} statuses, {pendingBackup.nodes.length} tiles, {pendingBackup.edges.length}{" "}
            links.
          </p>
          <p className={styles.warningText}>
            This permanently replaces everything currently in this graph. This can&apos;t be undone.
          </p>
          <div className={styles.typeRow}>
            <button type="button" className={styles.dangerButton} onClick={handleRestore} disabled={restoring}>
              {restoring ? "Restoring…" : "Restore this backup"}
            </button>
            <button type="button" className={styles.linkButton} onClick={() => setPendingBackup(null)} disabled={restoring}>
              Cancel
            </button>
          </div>
        </div>
      )}
      {restoreError && <div className={styles.error}>{restoreError}</div>}
      {restoreResult && (
        <div className={styles.successBanner}>
          Restored {restoreResult.nodeTypeCount} types, {restoreResult.statusCount} statuses,{" "}
          {restoreResult.nodeCount} tiles, {restoreResult.edgeCount} links.
        </div>
      )}
    </div>
  );
}

interface SettingsBladeProps {
  open: boolean;
  onClose: () => void;
}

export function SettingsBlade({ open, onClose }: SettingsBladeProps) {
  const [activeTab, setActiveTab] = useState(TABS[0]);

  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  return (
    <div className={`${styles.blade} ${open ? styles.bladeOpen : ""}`} aria-hidden={!open}>
      <div className={styles.header}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
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
        <button type="button" className={styles.closeButton} onClick={onClose} aria-label="Close settings">
          ×
        </button>
      </div>
      <div className={styles.content}>
        {activeTab === "Types & Statuses" && <TypesStatusesSettings />}
        {activeTab === "Appearance" && <AppearanceSettings />}
        {activeTab === "Backup" && <BackupSettings />}
      </div>
    </div>
  );
}
