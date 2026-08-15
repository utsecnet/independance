import { useTheme } from "../../../theme/useTheme";
import styles from "./TopBar.module.css";

function SunIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="4.5" />
      <path
        strokeLinecap="round"
        d="M12 2.5v2.5M12 19v2.5M4.6 4.6l1.8 1.8M17.6 17.6l1.8 1.8M2.5 12h2.5M19 12h2.5M4.6 19.4l1.8-1.8M17.6 6.4l1.8-1.8"
      />
    </svg>
  );
}

function BlackHoleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <ellipse cx="12" cy="12" rx="10.5" ry="4.2" transform="rotate(-18 12 12)" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <ellipse cx="12" cy="12" rx="7.2" ry="2.8" transform="rotate(-18 12 12)" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.6" fill="var(--bg)" stroke="currentColor" strokeWidth="1" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={styles.themeToggle}
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle theme"
    >
      {theme === "dark" ? <BlackHoleIcon /> : <SunIcon />}
    </button>
  );
}
