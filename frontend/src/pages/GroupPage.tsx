import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueries } from "@tanstack/react-query";
import { api, type GroupNode, type TargetSummary } from "../api/client.js";
import { GraphCard } from "../components/GraphCard.js";
import { GraphGrid } from "../components/GraphGrid.js";
import { sectionsFromTree } from "../lib/groupTree.js";
import { useGroupSections } from "../hooks/useGroupSections.js";
import { GraphLegend } from "../components/GraphLegend.js";
import { TimeRangePicker } from "../components/TimeRangePicker.js";
import { useTimeRange } from "../hooks/useTimeRange.js";

function findGroup(nodes: GroupNode[], id: number): GroupNode | null {
  for (const n of nodes) {
    if (n.id === id) return n;
    const found = findGroup(n.children, id);
    if (found) return found;
  }
  return null;
}

function collectTargets(node: GroupNode): TargetSummary[] {
  return [...node.targets, ...node.children.flatMap(collectTargets)];
}

export function GroupPage() {
  const { depth } = useGroupSections();
  const { groupId } = useParams();
  const id = Number(groupId);
  const navigate = useNavigate();
  const [range, setRange] = useTimeRange();

  const treeQuery = useQuery({ queryKey: ["group-tree"], queryFn: api.getGroupTree });
  const group = treeQuery.data ? findGroup(treeQuery.data.groups, id) : null;
  const targets = group ? collectTargets(group) : [];

  const measurementQueries = useQueries({
    queries: targets.map((t) => ({
      queryKey: ["measurements", t.id, range.from.toISOString(), range.to.toISOString()],
      queryFn: () => api.getMeasurements(t.id, range.from, range.to),
      enabled: !!group,
    })),
  });

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink-primary">{group?.name ?? (treeQuery.isLoading ? "Loading…" : "Group not found")}</h1>
          <p className="mt-1 text-sm text-ink-muted">{targets.length} endpoint{targets.length === 1 ? "" : "s"}</p>
        </div>
        <TimeRangePicker range={range} onChange={setRange} />
      </div>

      <GraphLegend />

      {targets.length === 0 && group && (
        <p className="text-sm text-ink-muted">This group has no endpoints yet.</p>
      )}

      <GraphGrid
        targetIds={targets.map((t) => t.id)}
        sections={group ? sectionsFromTree([group], depth) : []}
        renderGraph={(id, height) => {
          const i = targets.findIndex((t) => t.id === id);
          const t = targets[i];
          return (
            <GraphCard
              key={t.id}
              title={`${t.name} (${t.host})`}
              points={measurementQueries[i]?.data?.points ?? []}
              range={range}
              height={height}
              compact
              onClick={() => navigate(`/target/${t.id}`)}
            />
          );
        }}
      />
    </div>
  );
}
