import { useSyncExternalStore } from "react";

/**
 * Graph zoom levels for the multi-graph pages (dashboard, groups), smallest
 * first. Cards fill the row at no less than `minWidth`, so smaller levels fit
 * more graphs across and down the screen.
 */
export const GRAPH_SIZES = [
  { minWidth: 190, height: 140 },
  { minWidth: 240, height: 170 },
  { minWidth: 300, height: 200 },
  { minWidth: 380, height: 240 },
  { minWidth: 480, height: 280 },
  { minWidth: 640, height: 340 },
  { minWidth: 900, height: 420 },
] as const;

const STORAGE_KEY = "smokeping-ng-graph-size-v2";
// Before the smallest size was added; its levels are one lower than today's.
const LEGACY_KEY = "smokeping-ng-graph-size";
const DEFAULT_LEVEL = 3;

function readStored(): number {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const legacy = localStorage.getItem(LEGACY_KEY);
    const v = stored !== null ? Number(stored) : legacy !== null ? Number(legacy) + 1 : NaN;
    return Number.isInteger(v) && v >= 0 && v < GRAPH_SIZES.length ? v : DEFAULT_LEVEL;
  } catch {
    return DEFAULT_LEVEL;
  }
}

let level = readStored();
const listeners = new Set<() => void>();

function setLevel(next: number) {
  level = Math.max(0, Math.min(GRAPH_SIZES.length - 1, next));
  try {
    localStorage.setItem(STORAGE_KEY, String(level));
  } catch {
    // localStorage unavailable - size just won't persist.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useGraphSize() {
  const current = useSyncExternalStore(subscribe, () => level);
  return {
    level: current,
    size: GRAPH_SIZES[current],
    canZoomIn: current < GRAPH_SIZES.length - 1,
    canZoomOut: current > 0,
    zoomIn: () => setLevel(level + 1),
    zoomOut: () => setLevel(level - 1),
    reset: () => setLevel(DEFAULT_LEVEL),
  };
}
