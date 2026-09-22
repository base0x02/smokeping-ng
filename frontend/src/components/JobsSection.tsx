import { useQuery } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { lossToColor, lossLabel } from "../lib/lossColor.js";
import { formatMs, formatPct } from "../lib/format.js";

function formatRunTime(ts: string): string {
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function RawPings({ rtts }: { rtts: (number | null)[] | null }) {
  if (!rtts || rtts.length === 0) return null;
  return (
    <details className="mt-1">
      <summary className="cursor-pointer text-xs text-accent hover:underline">
        {rtts.length} raw probes
      </summary>
      <p className="mt-1 max-w-md break-words font-mono text-xs text-ink-muted">
        {rtts.map((v) => (v === null ? "×" : v.toFixed(0))).join(", ")}
      </p>
    </details>
  );
}

export function JobsSection() {
  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: api.getJobs,
    refetchInterval: 60_000,
  });

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-white">Recent probe runs</h2>
        <p className="mt-1 text-xs text-ink-muted">
          The last 5 probe rounds saved for each endpoint, most recent first.
        </p>
      </div>

      {isLoading && <p className="text-sm text-ink-muted">Loading…</p>}

      <div className="flex flex-col gap-4">
        {data?.targets.map((t) => (
          <div key={t.targetId} className="overflow-hidden rounded-lg border border-line-hairline">
            <div className="flex items-center justify-between bg-surface-raised px-3 py-2">
              <span className="text-sm font-medium text-white">{t.targetName}</span>
              <span className="text-xs text-ink-muted">{t.host}</span>
            </div>
            {t.runs.length === 0 ? (
              <p className="px-3 py-3 text-sm text-ink-muted">No runs recorded yet.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-xs uppercase text-ink-muted">
                  <tr>
                    <th className="px-3 py-2">Run time</th>
                    <th className="px-3 py-2">Sent / Received</th>
                    <th className="px-3 py-2">Avg RTT</th>
                    <th className="px-3 py-2">Jitter (σ)</th>
                    <th className="px-3 py-2">Loss</th>
                  </tr>
                </thead>
                <tbody>
                  {t.runs.map((run) => (
                    <tr key={run.ts} className="border-t border-line-hairline align-top">
                      <td className="px-3 py-2 text-ink-secondary">{formatRunTime(run.ts)}</td>
                      <td className="px-3 py-2 text-ink-secondary">
                        {run.sent} / {run.received}
                      </td>
                      <td className="px-3 py-2 text-white">{formatMs(run.avgRttMs)}</td>
                      <td className="px-3 py-2 text-ink-secondary">{formatMs(run.stddevRttMs)}</td>
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 shrink-0 rounded-full"
                            style={{ background: lossToColor(run.lossPct) }}
                          />
                          <span className="text-ink-secondary">
                            {formatPct(run.lossPct)} ({lossLabel(run.lossPct)})
                          </span>
                        </div>
                        <RawPings rtts={run.rawRtts} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
        {data && data.targets.length === 0 && (
          <p className="text-sm text-ink-muted">No endpoints configured yet.</p>
        )}
      </div>
    </section>
  );
}
