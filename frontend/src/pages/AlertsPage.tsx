import { useNavigate } from "react-router-dom";
import { usePageChrome } from "../hooks/usePageChrome.js";
import { useQueries } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { GraphCard } from "../components/GraphCard.js";
import { GraphGrid } from "../components/GraphGrid.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { ALERT_COLORS, useAlerts } from "../hooks/useAlerts.js";
import { useTimeRange } from "../hooks/useTimeRange.js";

function sinceLabel(iso: string): string {
  const mins = Math.max(1, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `${mins} min`;
  const hours = Math.floor(mins / 60);
  return hours < 48 ? `${hours} h ${mins % 60} min` : `${Math.floor(hours / 24)} days`;
}

/** Just the graphs of endpoints currently flagged by the alert check. */
export function AlertsPage() {
  const navigate = useNavigate();
  const [range, setRange] = useTimeRange();
  const { alerts, windowMinutes, isLoading } = useAlerts();
  usePageChrome({
    title: "Problems",
    subtitle: `Endpoints whose last ${windowMinutes} minutes were mostly down, lossy or much slower than their usual week.`,
    hasGraphs: true,
  });

  const measurementQueries = useQueries({
    queries: alerts.map((a) => ({
      queryKey: ["measurements", a.targetId, range.from.toISOString(), range.to.toISOString()],
      queryFn: () => api.getMeasurements(a.targetId, range.from, range.to),
      refetchInterval: 60_000,
    })),
  });

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex justify-end">
        <TimeRangePicker range={range} onChange={setRange} />
      </div>

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

      {!isLoading && alerts.length === 0 && (
        <div className="rounded-2xl border border-dashed border-line-hairline p-10 text-center">
          <p className="text-sm text-ink-secondary">No problems right now. Everything looks normal.</p>
        </div>
      )}

      {alerts.length > 0 && (
        <>
          <ul className="flex flex-col gap-1 text-sm">
            {alerts.map((a) => (
              <li key={a.targetId} className="flex flex-wrap items-baseline gap-x-2">
                <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: ALERT_COLORS[a.severity] }} />
                <span className="font-medium text-ink-primary">{a.name}</span>
                <span className="text-ink-muted">{a.host}</span>
                <span className="text-ink-secondary">{a.reason}</span>
                <span className="text-xs text-ink-muted">for {sinceLabel(a.since)}</span>
              </li>
            ))}
          </ul>
          <GraphGrid
            targetIds={alerts.map((a) => a.targetId)}
            sections={[]}
            flat
            renderGraph={(id, height) => {
              const i = alerts.findIndex((a) => a.targetId === id);
              const a = alerts[i];
              return (
                <GraphCard
                  key={id}
                  title={`${a.name} (${a.host})`}
                  points={measurementQueries[i]?.data?.points ?? []}
                  range={range}
                  height={height}
                  compact
                  alert={a}
                  onClick={() => navigate(`/target/${id}`)}
                />
              );
            }}
          />
        </>
      )}
    </div>
  );
}
