import { useState } from "react";
import { PRESETS, type TimeRange } from "../hooks/useTimeRange.js";

interface Props {
  range: TimeRange;
  onChange: (r: { presetKey?: string; from?: Date; to?: Date }) => void;
}

function toLocalInputValue(d: Date): string {
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 16);
}

export function TimeRangePicker({ range, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState(toLocalInputValue(range.from));
  const [customTo, setCustomTo] = useState(toLocalInputValue(range.to));

  const activeLabel =
    range.presetKey === "custom"
      ? "Custom range"
      : (PRESETS.find((p) => p.key === range.presetKey)?.label ?? "Last 24 hours");

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-md border border-line-hairline bg-surface-raised px-3 py-1.5 text-sm text-ink-primary hover:bg-white/5"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 3" />
        </svg>
        {activeLabel}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-20 mt-2 w-64 rounded-lg border border-line-hairline bg-surface-raised p-1 shadow-xl">
            {PRESETS.map((p) => {
              const active = range.presetKey === p.key;
              return (
                <button
                  key={p.key}
                  onClick={() => {
                    onChange({ presetKey: p.key });
                    setOpen(false);
                  }}
                  className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-primary hover:bg-white/5"
                >
                  {p.label}
                  {active && (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3987e5" strokeWidth="3">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
            <div className="mt-1 border-t border-line-hairline p-2">
              <p className="mb-1.5 text-xs text-ink-muted">Custom range</p>
              <div className="flex flex-col gap-1.5">
                <input
                  type="datetime-local"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="rounded border border-line-hairline bg-surface px-2 py-1 text-xs text-ink-primary"
                />
                <input
                  type="datetime-local"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="rounded border border-line-hairline bg-surface px-2 py-1 text-xs text-ink-primary"
                />
                <button
                  onClick={() => {
                    const from = new Date(customFrom);
                    const to = new Date(customTo);
                    if (from < to) {
                      onChange({ from, to });
                      setOpen(false);
                    }
                  }}
                  className="mt-1 rounded-md bg-accent px-2 py-1.5 text-xs font-medium text-white hover:bg-accent-soft"
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
