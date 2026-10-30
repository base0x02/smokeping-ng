import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  api,
  type SmokepingApplyResult,
  type SmokepingPlan,
  type SmokepingPlanGroup,
  type SmokepingPlanTarget,
} from "../api/client.js";

type HistoryStatus =
  | { state: "pending" }
  | { state: "running" }
  | { state: "done"; inserted: number; from: string | null; to: string | null }
  | { state: "error"; message: string };

// Must match the backend's normalization so plan paths can be mapped back to the picked files.
const normalizePath = (p: string) => p.replace(/\\/g, "/").replace(/^\.?\/+/, "");

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function countTargets(groups: SmokepingPlanGroup[]): { targets: number; withHistory: number; groups: number } {
  let targets = 0;
  let withHistory = 0;
  let count = 0;
  const walk = (g: SmokepingPlanGroup) => {
    count++;
    targets += g.targets.length;
    withHistory += g.targets.filter((t) => t.rrdFile).length;
    g.groups.forEach(walk);
  };
  groups.forEach(walk);
  return { targets, withHistory, groups: count };
}

function TargetLine({ t, status }: { t: SmokepingPlanTarget; status?: HistoryStatus }) {
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-0.5">
      <span className="text-ink-primary">{t.name}</span>
      <span className="text-xs text-ink-muted">{t.host}</span>
      {t.rrdFile ? (
        <span className="text-xs text-ink-secondary">history: {t.rrdFile}</span>
      ) : (
        <span className="text-xs text-ink-muted">no history</span>
      )}
      {status?.state === "running" && <span className="text-xs text-accent">importing…</span>}
      {status?.state === "done" && (
        <span className="text-xs text-[#0ca30c]">
          {status.inserted.toLocaleString()} samples
          {status.from && ` (${status.from.slice(0, 10)} – ${status.to!.slice(0, 10)})`}
        </span>
      )}
      {status?.state === "error" && <span className="text-xs text-[#d03b3b]">{status.message}</span>}
    </li>
  );
}

function GroupTree({
  group,
  statusByPath,
}: {
  group: SmokepingPlanGroup;
  statusByPath: Record<string, HistoryStatus>;
}) {
  return (
    <li className="py-1">
      <span className="font-medium text-ink-primary">{group.name}</span>
      <ul className="ml-4 border-l border-line-hairline pl-3">
        {group.targets.map((t) => (
          <TargetLine key={t.path} t={t} status={statusByPath[t.path]} />
        ))}
        {group.groups.map((g) => (
          <GroupTree key={g.path} group={g} statusByPath={statusByPath} />
        ))}
      </ul>
    </li>
  );
}

export function SmokepingImport() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<{ name: string; text: string } | null>(null);
  const [rrdFiles, setRrdFiles] = useState<Map<string, File>>(new Map());
  const [plan, setPlan] = useState<SmokepingPlan | null>(null);
  const [applied, setApplied] = useState<SmokepingApplyResult | null>(null);
  const [statusByPath, setStatusByPath] = useState<Record<string, HistoryStatus>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setPlan(null);
    setApplied(null);
    setStatusByPath({});
    setError(null);
  };

  const preview = async (text: string, files: Map<string, File>) => {
    reset();
    setBusy(true);
    try {
      setPlan(await api.planSmokepingImport(text, [...files.keys()]));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onConfigPicked = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    setConfig({ name: file.name, text });
    await preview(text, rrdFiles);
  };

  const onFolderPicked = async (list: FileList | null) => {
    const files = new Map<string, File>();
    for (const f of Array.from(list ?? [])) {
      if (f.name.endsWith(".rrd")) files.set(normalizePath(f.webkitRelativePath || f.name), f);
    }
    setRrdFiles(files);
    if (config) await preview(config.text, files);
  };

  const runImport = async () => {
    if (!config || !plan) return;
    setBusy(true);
    setError(null);
    try {
      const result = await api.applySmokepingImport(config.text, [...rrdFiles.keys()]);
      setApplied(result);
      queryClient.invalidateQueries({ queryKey: ["group-tree"] });
      queryClient.invalidateQueries({ queryKey: ["targets"] });

      const withHistory = result.targets.filter((t) => t.rrdFile && rrdFiles.has(t.rrdFile));
      setStatusByPath(Object.fromEntries(withHistory.map((t) => [t.path, { state: "pending" } as HistoryStatus])));
      // One file at a time: each is a few MB and the server converts it synchronously.
      for (const t of withHistory) {
        setStatusByPath((s) => ({ ...s, [t.path]: { state: "running" } }));
        try {
          const res = await api.importSmokepingHistory(t.targetId, rrdFiles.get(t.rrdFile!)!, t.created);
          setStatusByPath((s) => ({ ...s, [t.path]: { state: "done", inserted: res.inserted, from: res.from, to: res.to } }));
        } catch (err) {
          setStatusByPath((s) => ({ ...s, [t.path]: { state: "error", message: (err as Error).message } }));
        }
      }
      queryClient.invalidateQueries();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const counts = plan ? countTargets(plan.groups) : null;
  const totalTargets = (counts?.targets ?? 0) + (plan?.targets.length ?? 0);
  const totalWithHistory = (counts?.withHistory ?? 0) + (plan?.targets.filter((t) => t.rrdFile).length ?? 0);
  const historyDone = Object.values(statusByPath).filter((s) => s.state === "done" || s.state === "error").length;
  const historyTotal = Object.keys(statusByPath).length;

  return (
    <section>
      <div className="mb-3">
        <h2 className="text-sm font-semibold text-ink-primary">Import from SmokePing</h2>
        <p className="mt-1 text-xs text-ink-muted">
          Pick your SmokePing <code>Targets</code> file (or a full config) to recreate its groups and endpoints. Optionally
          pick its data folder (the directory with the <code>.rrd</code> files) to bring over each endpoint's history.
          Re-running is safe: existing groups and endpoints are reused and history is only added before their first
          sample.
        </p>
      </div>

      <div className="flex flex-col gap-3 rounded-lg border border-line-hairline p-4 text-sm">
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-line-baseline px-3 py-1.5 text-ink-primary hover:bg-surface-raised">
            Choose Targets file…
            <input type="file" className="hidden" disabled={busy} onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = ""; // allow re-picking the same file after editing it
                onConfigPicked(file);
              }}
            />
          </label>
          <span className="text-ink-muted">{config ? config.name : "No file chosen"}</span>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="cursor-pointer rounded-md border border-line-baseline px-3 py-1.5 text-ink-primary hover:bg-surface-raised">
            Choose data folder…
            <input
              type="file"
              className="hidden"
              disabled={busy}
              // Non-standard but supported by all major browsers: pick a whole directory.
              {...({ webkitdirectory: "", directory: "" } as Record<string, string>)}
              multiple
              onChange={(e) => onFolderPicked(e.target.files)}
            />
          </label>
          <span className="text-ink-muted">
            {rrdFiles.size > 0 ? `${rrdFiles.size} RRD files` : "Optional – skip to import endpoints only"}
          </span>
        </div>

        {error && <p className="text-[#d03b3b]">{error}</p>}

        {plan && (
          <div className="flex flex-col gap-3 border-t border-line-hairline pt-3">
            <p className="text-ink-secondary">
              {plural(counts!.groups, "group")}, {plural(totalTargets, "endpoint")}, {totalWithHistory} with history.
              {applied &&
                ` Created ${applied.groupsCreated} groups and ${applied.targets.filter((t) => t.created).length} endpoints; reused ${applied.groupsReused} groups and ${applied.targets.filter((t) => !t.created).length} endpoints.`}
            </p>

            <ul className="max-h-96 overflow-y-auto">
              {plan.groups.map((g) => (
                <GroupTree key={g.path} group={g} statusByPath={statusByPath} />
              ))}
              {plan.targets.map((t) => (
                <TargetLine key={t.path} t={t} status={statusByPath[t.path]} />
              ))}
            </ul>

            {plan.skipped.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-ink-secondary">
                  {plan.skipped.length} SmokePing entries not imported
                </summary>
                <ul className="mt-1 text-xs text-ink-muted">
                  {plan.skipped.map((s) => (
                    <li key={s.path}>
                      {s.path}: {s.reason}
                    </li>
                  ))}
                </ul>
              </details>
            )}
            {plan.unmatchedRrdFiles.length > 0 && (
              <details>
                <summary className="cursor-pointer text-xs text-ink-secondary">
                  {plan.unmatchedRrdFiles.length} RRD files with no matching endpoint in the config (ignored)
                </summary>
                <ul className="mt-1 text-xs text-ink-muted">
                  {plan.unmatchedRrdFiles.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </details>
            )}
            {plan.warnings.map((w) => (
              <p key={w} className="text-xs text-[#c98a00]">
                {w}
              </p>
            ))}

            <div className="flex items-center gap-3">
              <button
                onClick={runImport}
                disabled={busy || totalTargets === 0}
                className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-50"
              >
                {applied ? "Import again" : "Import"}
              </button>
              {historyTotal > 0 && (
                <span className="text-xs text-ink-muted">
                  History {historyDone} / {historyTotal}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
