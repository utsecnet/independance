import { useId } from "react";
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
  const gradientId = useId();

  return (
    <svg width="15" height="15" viewBox="0 0 24 24">
      <defs>
        {/* Warm accretion-disk glow: near-white core fading through gold and
            orange to transparent red, matching a gravitationally-lensed
            black hole's look. */}
        <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff8e6" />
          <stop offset="20%" stopColor="#ffe0a0" />
          <stop offset="42%" stopColor="#ff9d3d" />
          <stop offset="70%" stopColor="#e2530f" />
          <stop offset="100%" stopColor="#e2530f" stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* Outer soft glow, tilted to echo the lensed disk's diagonal sweep */}
      <ellipse cx="12" cy="12" rx="11" ry="5.4" transform="rotate(-38 12 12)" fill={`url(#${gradientId})`} opacity="0.85" />
      {/* Inner brighter ring */}
      <ellipse cx="12" cy="12" rx="7.6" ry="3.1" transform="rotate(-38 12 12)" fill={`url(#${gradientId})`} />
      {/* Event horizon void + photon ring */}
      <circle cx="12" cy="12" r="5" fill="#0a0710" />
      <circle cx="12" cy="12" r="5" fill="none" stroke="#ffedc7" strokeWidth="0.6" opacity="0.9" />
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
