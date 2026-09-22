import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router-dom";

export interface TimeRangePreset {
  key: string;
  label: string;
  ms: number;
}

export const PRESETS: TimeRangePreset[] = [
  { key: "1h", label: "Last hour", ms: 60 * 60 * 1000 },
  { key: "6h", label: "Last 6 hours", ms: 6 * 60 * 60 * 1000 },
  { key: "24h", label: "Last 24 hours", ms: 24 * 60 * 60 * 1000 },
  { key: "7d", label: "Last 7 days", ms: 7 * 24 * 60 * 60 * 1000 },
  { key: "30d", label: "Last 30 days", ms: 30 * 24 * 60 * 60 * 1000 },
  { key: "90d", label: "Last 90 days", ms: 90 * 24 * 60 * 60 * 1000 },
];

export interface TimeRange {
  from: Date;
  to: Date;
  presetKey: string | null;
}

export function useTimeRange(): [TimeRange, (r: { presetKey?: string; from?: Date; to?: Date }) => void] {
  const [params, setParams] = useSearchParams();

  const range = useMemo<TimeRange>(() => {
    const presetKey = params.get("range") ?? "24h";
    const fromParam = params.get("from");
    const toParam = params.get("to");

    if (presetKey === "custom" && fromParam && toParam) {
      return { from: new Date(fromParam), to: new Date(toParam), presetKey: "custom" };
    }

    const preset = PRESETS.find((p) => p.key === presetKey) ?? PRESETS[2];
    const to = new Date();
    const from = new Date(to.getTime() - preset.ms);
    return { from, to, presetKey: preset.key };
  }, [params]);

  const setRange = useCallback(
    (r: { presetKey?: string; from?: Date; to?: Date }) => {
      const next = new URLSearchParams(params);
      if (r.presetKey && r.presetKey !== "custom") {
        next.set("range", r.presetKey);
        next.delete("from");
        next.delete("to");
      } else if (r.from && r.to) {
        next.set("range", "custom");
        next.set("from", r.from.toISOString());
        next.set("to", r.to.toISOString());
      }
      setParams(next, { replace: true });
    },
    [params, setParams],
  );

  return [range, setRange];
}
