import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { GraphCard } from "../components/GraphCard.js";
import { GraphLegend } from "../components/GraphLegend.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { useTimeRange } from "../hooks/useTimeRange.js";

export function TargetPage() {
  const { targetId } = useParams();
  const id = Number(targetId);
  const navigate = useNavigate();
  const [range, setRange] = useTimeRange();

  const targetQuery = useQuery({
    queryKey: ["target", id],
    queryFn: () => api.getTarget(id),
    enabled: Number.isFinite(id),
  });

  const measurementsQuery = useQuery({
    queryKey: ["measurements", id, range.from.toISOString(), range.to.toISOString()],
    queryFn: () => api.getMeasurements(id, range.from, range.to),
    enabled: Number.isFinite(id),
    refetchInterval: 60_000,
  });

  const target = targetQuery.data;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">{target?.name ?? "Loading…"}</h1>
          <p className="mt-1 text-sm text-ink-muted">{target?.host}</p>
        </div>
        <div className="flex items-center gap-2">
          <TimeRangePicker range={range} onChange={setRange} />
          <button
            onClick={() => navigate(`/admin?edit=target&id=${id}`)}
            className="rounded-md border border-line-hairline px-3 py-1.5 text-sm text-ink-secondary hover:bg-ink-primary/5"
          >
            Edit
          </button>
        </div>
      </div>

      <GraphLegend />

      {measurementsQuery.data && (
        <GraphCard
          title=""
          points={measurementsQuery.data.points}
          range={range}
          height={440}
        />
      )}
      {measurementsQuery.data?.bucketed && (
        <p className="text-xs text-ink-muted">
          This range is aggregated into time buckets for performance (each point summarizes multiple
          5-minute probes). Narrow the time range for per-probe detail.
        </p>
      )}
      {measurementsQuery.isLoading && <p className="text-sm text-ink-muted">Loading measurements…</p>}
      {measurementsQuery.data && measurementsQuery.data.points.length === 0 && (
        <p className="text-sm text-ink-muted">No data in this time range yet.</p>
      )}
    </div>
  );
}
