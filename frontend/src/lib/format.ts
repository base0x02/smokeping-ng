export function formatMs(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value >= 100 ? `${value.toFixed(0)} ms` : `${value.toFixed(1)} ms`;
}

export function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

export function formatAxisTime(ts: number, rangeMs: number): string {
  const d = new Date(ts);
  if (rangeMs <= 26 * 60 * 60 * 1000) {
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
  }
  if (rangeMs <= 32 * 24 * 60 * 60 * 1000) {
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString(undefined, { month: "short", year: "2-digit" });
}

export function formatTooltipTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
