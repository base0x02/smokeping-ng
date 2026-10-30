export type ResolvedTheme = "light" | "dark";
export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "smokeping-ng-theme";
export const PALETTE_STORAGE_KEY = "smokeping-ng-palette";

/** Color palettes; each has light and dark variants in index.css. "classic" is the default (no attribute). */
export const PALETTES = [
  { id: "classic", label: "Classic" },
  { id: "slate", label: "Slate" },
  { id: "forest", label: "Forest" },
  { id: "ocean", label: "Ocean" },
  { id: "rose", label: "Rose" },
  { id: "solar", label: "Solar" },
] as const;
export type PaletteId = (typeof PALETTES)[number]["id"];

const isPalette = (v: string | null): v is PaletteId => PALETTES.some((p) => p.id === v);

export function getPalette(): PaletteId {
  const attr = document.documentElement.getAttribute("data-palette");
  return isPalette(attr) ? attr : "classic";
}

/** Persist a palette choice and apply it to the document immediately. */
export function setPalette(palette: PaletteId): void {
  try {
    localStorage.setItem(PALETTE_STORAGE_KEY, palette);
  } catch {
    // localStorage unavailable - palette just won't persist.
  }
  if (palette === "classic") document.documentElement.removeAttribute("data-palette");
  else document.documentElement.setAttribute("data-palette", palette);
}

function systemTheme(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function explicitTheme(): ThemePreference | null {
  const attr = document.documentElement.getAttribute("data-theme");
  return attr === "light" || attr === "dark" ? attr : null;
}

/** The theme actually in effect right now: an explicit choice, or the OS preference. */
export function getResolvedTheme(): ResolvedTheme {
  return explicitTheme() ?? systemTheme();
}

export function readStoredPreference(): ThemePreference | null {
  try {
    const v = localStorage.getItem(THEME_STORAGE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

/** Persist an explicit choice and apply it to the document immediately. */
export function setThemePreference(pref: ThemePreference): void {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // localStorage unavailable (private mode, etc.) - theme just won't persist.
  }
  document.documentElement.setAttribute("data-theme", pref);
}

/** Calls `cb` whenever theme colors could have changed (OS preference flip, data-theme or data-palette mutation). */
export function subscribeToThemeChange(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-palette"] });
  return () => {
    mq.removeEventListener("change", cb);
    observer.disconnect();
  };
}
