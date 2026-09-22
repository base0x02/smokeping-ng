import { useState } from "react";
import { Modal } from "./Modal.js";
import type { FlatGroup } from "../lib/groupTree.js";

export interface TargetFormValues {
  name: string;
  host: string;
  groupId: number | null;
  enabled: boolean;
  pingCount: number;
  intervalSeconds: number;
}

interface Props {
  initial?: TargetFormValues;
  flatGroups: FlatGroup[];
  onCancel: () => void;
  onSubmit: (values: TargetFormValues) => void;
  submitting?: boolean;
}

export function TargetForm({ initial, flatGroups, onCancel, onSubmit, submitting }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [host, setHost] = useState(initial?.host ?? "");
  const [groupId, setGroupId] = useState<number | "">(initial?.groupId ?? "");
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [pingCount, setPingCount] = useState(initial?.pingCount ?? 20);
  const [intervalSeconds, setIntervalSeconds] = useState(initial?.intervalSeconds ?? 300);

  return (
    <Modal title={initial ? "Edit endpoint" : "New endpoint"} onClose={onCancel}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({
            name: name.trim(),
            host: host.trim(),
            groupId: groupId === "" ? null : groupId,
            enabled,
            pingCount,
            intervalSeconds,
          });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-secondary">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-ink-primary"
            placeholder="e.g. Core Router"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-secondary">Host / IP</span>
          <input
            required
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-ink-primary"
            placeholder="e.g. 1.1.1.1 or router.lan"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-secondary">Group</span>
          <select
            value={groupId}
            onChange={(e) => setGroupId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-ink-primary"
          >
            <option value="">Ungrouped</option>
            {flatGroups.map((g) => (
              <option key={g.id} value={g.id}>
                {"—".repeat(g.depth)} {g.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-secondary">Pings per round</span>
            <input
              type="number"
              min={1}
              max={100}
              value={pingCount}
              onChange={(e) => setPingCount(Number(e.target.value))}
              className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-ink-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-ink-secondary">Interval (sec)</span>
            <input
              type="number"
              min={60}
              step={60}
              value={intervalSeconds}
              onChange={(e) => setIntervalSeconds(Number(e.target.value))}
              className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-ink-primary"
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Enabled (actively probed)
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line-hairline px-3 py-1.5 text-sm text-ink-secondary hover:bg-ink-primary/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !host.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
