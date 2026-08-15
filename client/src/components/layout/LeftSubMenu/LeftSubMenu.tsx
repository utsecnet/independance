import styles from "./LeftSubMenu.module.css";

export interface LeftSubMenuProps {
  heading: string;
  items: string[];
  activeItem: string;
  onSelectItem: (item: string) => void;
}

export function LeftSubMenu({ heading, items, activeItem, onSelectItem }: LeftSubMenuProps) {
  return (
    <nav className={styles.menu}>
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
    </nav>
  );
}
