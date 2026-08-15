import { useId } from "react";
import { useTheme } from "../../../theme/useTheme";
import styles from "./TopBar.module.css";

function SunIcon() {
  const coreId = useId();
  const flareId = useId();

  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
      <defs>
        {/* Same gradient-glow technique as the black hole icon, for visual
            consistency: a warm radial core plus a soft outer flare instead
            of a flat stroke-drawn sun. */}
        <radialGradient id={coreId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffdf0" />
          <stop offset="35%" stopColor="#ffe497" />
          <stop offset="70%" stopColor="#ffab3d" />
          <stop offset="100%" stopColor="#ff8a1f" />
        </radialGradient>
        <radialGradient id={flareId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#ffdd8f" stopOpacity="0.65" />
          <stop offset="60%" stopColor="#ffb84d" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#ffb84d" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="12" cy="12" r="11.5" fill={`url(#${flareId})`} />
      <circle cx="12" cy="12" r="6.4" fill={`url(#${coreId})`} />
    </svg>
  );
}

function BlackHoleIcon() {
  const gradientId = useId();

  return (
    <svg width="34" height="34" viewBox="0 0 24 24">
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
