export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 rounded-md border border-line-hairline bg-surface-raised px-3 py-2 text-xs text-ink-secondary">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-0.5 w-4 rounded bg-accent" />
        average RTT
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-3 w-4 rounded-sm"
          style={{ background: "linear-gradient(180deg, rgba(57,135,229,0.05), rgba(57,135,229,0.4), rgba(57,135,229,0.05))" }}
        />
        jitter (±1 std. dev.)
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: "linear-gradient(90deg, #0ca30c, #fab219, #d03b3b)" }}
        />
        dot color = packet loss
      </div>
    </div>
  );
}
