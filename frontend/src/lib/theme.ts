export type ResolvedTheme = "light" | "dark";
export type ThemePreference = "light" | "dark";

export const THEME_STORAGE_KEY = "smokeping-ng-theme";

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

/** Calls `cb` whenever the resolved theme could have changed (OS preference flip or data-theme mutation). */
export function subscribeToThemeChange(cb: () => void): () => void {
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  const observer = new MutationObserver(cb);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => {
    mq.removeEventListener("change", cb);
    observer.disconnect();
  };
}
