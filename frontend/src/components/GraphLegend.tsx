export function GraphLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-secondary">
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-[3px] w-3 rounded-sm bg-ink-secondary" />
        Average RTT
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-3.5 w-5 rounded-sm"
          style={{
            background:
              "linear-gradient(180deg, rgb(var(--color-smoke) / 0.03), rgb(var(--color-smoke) / 0.6), rgb(var(--color-smoke) / 0.03))",
          }}
        />
        Jitter (spread of RTT std. dev.)
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className="inline-block h-2.5 w-2.5 rounded-full"
          style={{ background: "linear-gradient(90deg, #0ca30c, #fab219, #d03b3b)" }}
        />
        Packet loss %
      </div>
      <div className="flex items-center gap-1.5">
        <span className="inline-block h-3 w-4 rounded-sm" style={{ background: "rgba(208, 59, 59, 0.4)" }} />
        No response
      </div>
    </div>
  );
}
