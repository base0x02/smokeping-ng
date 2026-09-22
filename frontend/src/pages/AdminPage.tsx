import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Target } from "../api/client.js";
import { flattenGroups } from "../lib/groupTree.js";
import { GroupForm, type GroupFormValues } from "../components/GroupForm.js";
import { TargetForm, type TargetFormValues } from "../components/TargetForm.js";
import { JobsSection } from "../components/JobsSection.js";

export function AdminPage() {
  const [params, setParams] = useSearchParams();
  const queryClient = useQueryClient();

  const treeQuery = useQuery({ queryKey: ["group-tree"], queryFn: api.getGroupTree });
  const targetsQuery = useQuery({ queryKey: ["targets"], queryFn: api.getTargets });

  const [groupModal, setGroupModal] = useState<{ id: number | null; values?: GroupFormValues } | null>(null);
  const [targetModal, setTargetModal] = useState<{ id: number | null; values?: TargetFormValues } | null>(null);

  const flatGroups = treeQuery.data ? flattenGroups(treeQuery.data.groups) : [];

  useEffect(() => {
    const editKind = params.get("edit");
    const editId = params.get("id");
    if (editKind === "target" && editId) {
      api.getTarget(Number(editId)).then((t: Target) => {
        setTargetModal({
          id: t.id,
          values: {
            name: t.name,
            host: t.host,
            groupId: t.groupId,
            enabled: t.enabled,
            pingCount: t.pingCount,
            intervalSeconds: t.intervalSeconds,
          },
        });
        const next = new URLSearchParams(params);
        next.delete("edit");
        next.delete("id");
        setParams(next, { replace: true });
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["group-tree"] });
    queryClient.invalidateQueries({ queryKey: ["targets"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-sample"] });
  };

  const saveGroup = useMutation({
    mutationFn: (v: GroupFormValues) =>
      groupModal?.id ? api.updateGroup(groupModal.id, v) : api.createGroup(v),
    onSuccess: () => {
      invalidateAll();
      setGroupModal(null);
    },
  });

  const deleteGroup = useMutation({
    mutationFn: (id: number) => api.deleteGroup(id),
    onSuccess: invalidateAll,
  });

  const saveTarget = useMutation({
    mutationFn: (v: TargetFormValues) =>
      targetModal?.id ? api.updateTarget(targetModal.id, v) : api.createTarget(v),
    onSuccess: () => {
      invalidateAll();
      setTargetModal(null);
    },
  });

  const deleteTarget = useMutation({
    mutationFn: (id: number) => api.deleteTarget(id),
    onSuccess: invalidateAll,
  });

  return (
    <div className="flex flex-1 flex-col gap-8 overflow-y-auto p-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Admin</h1>
        <p className="mt-1 text-sm text-ink-muted">Manage groups and monitored endpoints.</p>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Groups</h2>
          <button
            onClick={() => setGroupModal({ id: null })}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft"
          >
            + New group
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-line-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Parent</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {flatGroups.map((g) => {
                const parent = flatGroups.find((p) => p.id === g.parentId);
                return (
                  <tr key={g.id} className="border-t border-line-hairline">
                    <td className="px-3 py-2 text-white">
                      <span style={{ paddingLeft: g.depth * 14 }}>{g.name}</span>
                    </td>
                    <td className="px-3 py-2 text-ink-muted">{parent?.name ?? "—"}</td>
                    <td className="px-3 py-2 text-right">
                      <button
                        onClick={() => setGroupModal({ id: g.id, values: { name: g.name, parentId: g.parentId } })}
                        className="mr-3 text-accent hover:underline"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete group "${g.name}"? Its endpoints will become ungrouped.`)) {
                            deleteGroup.mutate(g.id);
                          }
                        }}
                        className="text-[#d03b3b] hover:underline"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
              {flatGroups.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-3 py-4 text-center text-ink-muted">
                    No groups yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-white">Endpoints</h2>
          <button
            onClick={() => setTargetModal({ id: null })}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft"
          >
            + New endpoint
          </button>
        </div>
        <div className="overflow-hidden rounded-lg border border-line-hairline">
          <table className="w-full text-sm">
            <thead className="bg-surface-raised text-left text-xs uppercase text-ink-muted">
              <tr>
                <th className="px-3 py-2">Name</th>
                <th className="px-3 py-2">Host</th>
                <th className="px-3 py-2">Group</th>
                <th className="px-3 py-2">Pings</th>
                <th className="px-3 py-2">Interval</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {targetsQuery.data?.map((t) => (
                <tr key={t.id} className="border-t border-line-hairline">
                  <td className="px-3 py-2 text-white">{t.name}</td>
                  <td className="px-3 py-2 text-ink-secondary">{t.host}</td>
                  <td className="px-3 py-2 text-ink-muted">
                    {flatGroups.find((g) => g.id === t.groupId)?.name ?? "Ungrouped"}
                  </td>
                  <td className="px-3 py-2 text-ink-muted">{t.pingCount}</td>
                  <td className="px-3 py-2 text-ink-muted">{t.intervalSeconds}s</td>
                  <td className="px-3 py-2">
                    <span className={t.enabled ? "text-[#0ca30c]" : "text-ink-muted"}>
                      {t.enabled ? "Enabled" : "Disabled"}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      onClick={() =>
                        setTargetModal({
                          id: t.id,
                          values: {
                            name: t.name,
                            host: t.host,
                            groupId: t.groupId,
                            enabled: t.enabled,
                            pingCount: t.pingCount,
                            intervalSeconds: t.intervalSeconds,
                          },
                        })
                      }
                      className="mr-3 text-accent hover:underline"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => {
                        if (confirm(`Delete endpoint "${t.name}" and all its history? This can't be undone.`)) {
                          deleteTarget.mutate(t.id);
                        }
                      }}
                      className="text-[#d03b3b] hover:underline"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {targetsQuery.data?.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-4 text-center text-ink-muted">
                    No endpoints yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <JobsSection />

      {groupModal && (
        <GroupForm
          initial={groupModal.values}
          flatGroups={flatGroups}
          excludeId={groupModal.id ?? undefined}
          onCancel={() => setGroupModal(null)}
          onSubmit={(v) => saveGroup.mutate(v)}
          submitting={saveGroup.isPending}
        />
      )}
      {targetModal && (
        <TargetForm
          initial={targetModal.values}
          flatGroups={flatGroups}
          onCancel={() => setTargetModal(null)}
          onSubmit={(v) => saveTarget.mutate(v)}
          submitting={saveTarget.isPending}
        />
      )}
    </div>
  );
}
