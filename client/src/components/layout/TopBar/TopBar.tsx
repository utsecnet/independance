import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopBar.module.css";

export interface TopBarProps {
  sections: string[];
  activeSection: string;
  onSelectSection: (section: string) => void;
}

export function TopBar({ sections, activeSection, onSelectSection }: TopBarProps) {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        independ<span className={styles.brandAccent}>ance</span>
      </div>
      <nav className={styles.nav}>
        {sections.map((section) => (
          <button
            key={section}
            type="button"
            className={`${styles.navItem} ${section === activeSection ? styles.navItemActive : ""}`}
            onClick={() => onSelectSection(section)}
          >
            {section}
          </button>
        ))}
      </nav>
      <div className={styles.spacer} />
      <ThemeToggle />
    </header>
  );
}
