import styles from "./LeftSubMenu.module.css";

export interface LeftSubMenuProps {
  heading: string;
  items: string[];
  activeItem: string;
  onSelectItem: (item: string) => void;
  settingsActive: boolean;
  onToggleSettings: () => void;
}

function SettingsIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function LeftSubMenu({
  heading,
  items,
  activeItem,
  onSelectItem,
  settingsActive,
  onToggleSettings,
}: LeftSubMenuProps) {
  return (
    <nav className={styles.menu}>
      <div className={styles.scroll}>
        <div className={styles.heading}>{heading}</div>
        {items.map((item) => (
          <button
            key={item}
            type="button"
            className={`${styles.item} ${item === activeItem ? styles.itemActive : ""}`}
            onClick={() => onSelectItem(item)}
          >
            {item}
          </button>
        ))}
      </div>
      <div className={styles.footer}>
        <button
          type="button"
          className={`${styles.settingsButton} ${settingsActive ? styles.settingsButtonActive : ""}`}
          onClick={onToggleSettings}
          aria-pressed={settingsActive}
          title="Settings"
        >
          <SettingsIcon />
          Settings
        </button>
      </div>
    </nav>
  );
}
