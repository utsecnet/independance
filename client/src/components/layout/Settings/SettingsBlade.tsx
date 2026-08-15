import { useEffect, useState } from "react";
import { MAX_EXTRA_TILE_FIELDS, TILE_FIELD_DEFS, type TileFieldGroup, type TileFieldId } from "@independance/shared";
import { useConfigStore } from "../../../state/configStore";
import styles from "./SettingsBlade.module.css";

const TABS = ["Types & Statuses", "Appearance", "Data"];

const FIELD_GROUP_ORDER: TileFieldGroup[] = ["task", "project", "poam"];
const FIELD_GROUP_FALLBACK_LABELS: Record<TileFieldGroup, string> = {
  task: "Task",
  project: "Project",
  poam: "POA&M",
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
  const [newColor, setNewColor] = useState("#4dd8d0");
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
    setNewColor("#4dd8d0");
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
                <input
                  type="color"
                  className={styles.colorInput}
                  value={type.color}
                  onChange={(e) => updateNodeType(type.id, { color: e.target.value })}
                  title="Tile color"
                />
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
          <input
            type="color"
            className={styles.colorInput}
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            title="Tile color"
          />
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
  const tileFields = useConfigStore((s) => s.tileFields);
  const nodeTypes = useConfigStore((s) => s.nodeTypes);
  const error = useConfigStore((s) => s.error);
  const clearError = useConfigStore((s) => s.clearError);
  const updateAppSettings = useConfigStore((s) => s.updateAppSettings);

  const [expandedGroup, setExpandedGroup] = useState<TileFieldGroup | null>(null);

  function toggleField(fieldId: TileFieldId) {
    const isSelected = tileFields.includes(fieldId);
    if (isSelected) {
      updateAppSettings({ tileFields: tileFields.filter((f) => f !== fieldId) });
    } else {
      if (tileFields.length >= MAX_EXTRA_TILE_FIELDS) return;
      updateAppSettings({ tileFields: [...tileFields, fieldId] });
    }
  }

  // "task"/"project"/"poam" group keys match those built-in types' ids, so
  // the heading follows whatever the user has renamed that type to (e.g.
  // Settings > Types & Statuses) instead of a hardcoded label going stale.
  function groupLabel(group: TileFieldGroup): string {
    return nodeTypes.find((t) => t.id === group)?.label ?? FIELD_GROUP_FALLBACK_LABELS[group];
  }

  return (
    <div className={styles.section}>
      <h2 className={styles.sectionTitle}>Tile</h2>
      <p className={styles.hint}>
        Type, Title, and Status always show on every tile. Choose up to {MAX_EXTRA_TILE_FIELDS} additional fields (
        {tileFields.length}/{MAX_EXTRA_TILE_FIELDS} selected), grouped by which item type they apply to.
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
        {FIELD_GROUP_ORDER.map((group) => {
          const fields = TILE_FIELD_DEFS.filter((field) =>
            (field.groups as readonly TileFieldGroup[]).includes(group)
          );
          if (fields.length === 0) return null;
          const selectedCount = fields.filter((field) => tileFields.includes(field.id)).length;
          const expanded = expandedGroup === group;
          return (
            <div key={group} className={styles.typeCard}>
              <div className={styles.typeRow}>
                <span className={styles.groupLabel}>{groupLabel(group)}</span>
                <button
                  type="button"
                  className={styles.linkButton}
                  onClick={() => setExpandedGroup(expanded ? null : group)}
                >
                  {expanded ? "Hide" : "Fields"} ({selectedCount}/{fields.length})
                </button>
              </div>

              {expanded && (
                <div className={styles.statusList}>
                  <div className={styles.fieldGrid}>
                    {fields.map((field) => {
                      const checked = tileFields.includes(field.id);
                      const disabled = !checked && tileFields.length >= MAX_EXTRA_TILE_FIELDS;
                      return (
                        <label
                          key={field.id}
                          className={`${styles.fieldOption} ${disabled ? styles.fieldOptionDisabled : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled}
                            onChange={() => toggleField(field.id)}
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
        {activeTab === "Data" && (
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>{activeTab}</h2>
            <p className={styles.hint}>Nothing configurable here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
}
