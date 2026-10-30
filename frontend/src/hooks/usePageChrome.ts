import { useEffect, useSyncExternalStore } from "react";

/** What the current page shows in the app frame: its title/subheading in the header, and whether it has graphs (so the legend applies). */
export interface PageChrome {
  title: string;
  subtitle?: string;
  hasGraphs?: boolean;
}

let current: PageChrome = { title: "" };
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Called by each page to publish its title, subheading and whether it shows graphs. */
export function usePageChrome({ title, subtitle, hasGraphs = false }: PageChrome) {
  useEffect(() => {
    current = { title, subtitle, hasGraphs };
    document.title = title ? `${title} · smokeping` : "smokeping";
    listeners.forEach((l) => l());
  }, [title, subtitle, hasGraphs]);
}

/** Read by the app frame (header, legend bar). */
export function useCurrentPageChrome(): PageChrome {
  return useSyncExternalStore(subscribe, () => current);
}
