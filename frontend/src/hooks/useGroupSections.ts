import { useSyncExternalStore } from "react";

/**
 * How multi-graph pages split their graphs into group boxes, persisted per
 * browser: 0 = one flat grid; N = a box per group down to N levels deep, with
 * deeper subgroups' graphs merged into their level-N ancestor's box;
 * Infinity = a box for every group.
 */
export const GROUP_DEPTH_OPTIONS = [
  { depth: 0, label: "Don't group" },
  { depth: 1, label: "Top-level groups" },
  { depth: 2, label: "2 levels deep" },
  { depth: Infinity, label: "Every group" },
] as const;

const STORAGE_KEY = "smokeping-ng-group-depth";
// The earlier on/off toggle; "1" (on) meant every group.
const LEGACY_KEY = "smokeping-ng-group-sections";

function readStored(): number {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "all") return Infinity;
    if (v !== null && /^\d+$/.test(v)) return Number(v);
    return localStorage.getItem(LEGACY_KEY) === "1" ? Infinity : 0;
  } catch {
    return 0;
  }
}

let depth = readStored();
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useGroupSections(): { depth: number; grouped: boolean; setDepth: (d: number) => void } {
  const current = useSyncExternalStore(subscribe, () => depth);
  const setDepth = (d: number) => {
    depth = d;
    try {
      localStorage.setItem(STORAGE_KEY, d === Infinity ? "all" : String(d));
    } catch {
      // localStorage unavailable - choice just won't persist.
    }
    listeners.forEach((l) => l());
  };
  return { depth: current, grouped: current > 0, setDepth };
}
