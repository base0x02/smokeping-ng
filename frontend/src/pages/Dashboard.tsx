import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";
import { GraphCard } from "../components/GraphCard.js";
import { GraphLegend } from "../components/GraphLegend.js";

export function Dashboard() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard-sample"],
    queryFn: api.getDashboardSample,
    refetchInterval: 60_000,
  });
  const range = useMemo(
    () => (data ? { from: new Date(data.from), to: new Date(data.to) } : undefined),
    [data],
  );

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div>
        <h1 className="text-xl font-semibold text-ink-primary">All endpoints</h1>
        <p className="mt-1 text-sm text-ink-muted">
          Showing the last 3 hours for every target. Select a group or endpoint from the ☰ menu to
          focus in, or click a graph to open its full page.
        </p>
      </div>
      <GraphLegend />

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

      {data && data.targets.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-hairline p-10 text-center">
          <p className="text-sm text-ink-secondary">No targets configured yet.</p>
          <button
            onClick={() => navigate("/admin")}
            className="mt-3 rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft"
          >
            Add your first target
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data?.targets.map((t) => (
          <GraphCard
            key={t.id}
            title={`${t.name} (${t.host})`}
            points={t.points}
            range={range}
            height={240}
            compact
            onClick={() => navigate(`/target/${t.id}`)}
          />
        ))}
      </div>
    </div>
  );
}
