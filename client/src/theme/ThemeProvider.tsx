import { createContext, useEffect, useState, type ReactNode } from "react";
import { useConfigStore } from "../state/configStore";

export type Theme = "dark" | "light";

export interface ThemeContextValue {
  theme: Theme;
  toggleTheme: () => void;
}

export const ThemeContext = createContext<ThemeContextValue | null>(null);

// Theme lives in server-persisted settings (see configStore), not
// localStorage — it has to travel with the portable app's own data, not
// stay pinned to one browser profile. There's nothing to read synchronously
// before that settings fetch resolves, so this falls back to the OS
// preference for the very first paint, same as before whenever nothing had
// ever been explicitly chosen. On this app's own local server that
// reconciliation (see the effect below) is normally imperceptible; the one
// case with a visible flash is opening the same portable data from a
// browser that hasn't loaded it before.
export function getInitialTheme(): Theme {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(getInitialTheme);
  const storedTheme = useConfigStore((s) => s.theme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  // Adopt whatever theme was actually persisted once configStore's settings
  // load — the OS-preference guess above was only ever a same-tick
  // placeholder for first paint.
  useEffect(() => {
    if (storedTheme && storedTheme !== theme) setTheme(storedTheme);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedTheme]);

  function toggleTheme() {
    setTheme((t) => {
      const next: Theme = t === "dark" ? "light" : "dark";
      useConfigStore.getState().updateAppSettings({ theme: next });
      return next;
    });
  }

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
}
