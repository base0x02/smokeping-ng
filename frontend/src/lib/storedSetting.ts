import { useSyncExternalStore } from "react";

/**
 * A small app-wide setting kept in localStorage: every component using the
 * returned hook re-renders when it changes. Falls back to `initial` when
 * storage is unavailable or holds something `parse` rejects.
 */
export function createStoredSetting<T>(key: string, initial: T, parse: (raw: string) => T | undefined) {
  let value = initial;
  try {
    const raw = localStorage.getItem(key);
    if (raw !== null) value = parse(raw) ?? initial;
  } catch {
    // localStorage unavailable - use the default.
  }
  const listeners = new Set<() => void>();
  const subscribe = (cb: () => void) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  };
  const set = (next: T) => {
    value = next;
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      // localStorage unavailable - setting just won't persist.
    }
    listeners.forEach((l) => l());
  };
  const useSetting = (): [T, (next: T) => void] => [useSyncExternalStore(subscribe, () => value), set];
  return useSetting;
}
