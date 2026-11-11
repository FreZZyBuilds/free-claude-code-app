/* Per-browser conveniences. Every access is guarded: storage can be blocked. */

const PREFIX = "fcc-studio-";

export function readPref<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

export function writePref(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable — preference stays in memory only */
  }
}

export type Theme = "light" | "dark" | "system";

export function applyTheme(theme: Theme) {
  const dark = theme === "dark" || (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.classList.toggle("dark", dark);
  try {
    localStorage.setItem(PREFIX + "theme", theme);
  } catch {
    /* ignore */
  }
}

export function currentTheme(): Theme {
  try {
    const t = localStorage.getItem(PREFIX + "theme");
    if (t === "light" || t === "dark") return t;
  } catch {
    /* ignore */
  }
  return "system";
}
