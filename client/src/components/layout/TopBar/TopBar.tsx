import { ThemeToggle } from "./ThemeToggle";
import styles from "./TopBar.module.css";

export function TopBar() {
  return (
    <header className={styles.bar}>
      <div className={styles.brand}>
        <span className={styles.brandAccent}>in</span>depend<span className={styles.brandAccent}>ance</span>
      </div>
      <div className={styles.spacer} />
      <ThemeToggle />
    </header>
  );
}
