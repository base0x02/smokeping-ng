import { useState } from "react";
import { Modal } from "./Modal.js";
import type { FlatGroup } from "../lib/groupTree.js";

export interface GroupFormValues {
  name: string;
  parentId: number | null;
}

interface Props {
  initial?: GroupFormValues;
  flatGroups: FlatGroup[];
  excludeId?: number;
  onCancel: () => void;
  onSubmit: (values: GroupFormValues) => void;
  submitting?: boolean;
}

export function GroupForm({ initial, flatGroups, excludeId, onCancel, onSubmit, submitting }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [parentId, setParentId] = useState<number | "">(initial?.parentId ?? "");

  return (
    <Modal title={initial ? "Edit group" : "New group"} onClose={onCancel}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), parentId: parentId === "" ? null : parentId });
        }}
      >
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-secondary">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-white"
            placeholder="e.g. Core network"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-ink-secondary">Parent group</span>
          <select
            value={parentId}
            onChange={(e) => setParentId(e.target.value === "" ? "" : Number(e.target.value))}
            className="rounded-md border border-line-hairline bg-surface px-3 py-1.5 text-white"
          >
            <option value="">None (top-level)</option>
            {flatGroups
              .filter((g) => g.id !== excludeId)
              .map((g) => (
                <option key={g.id} value={g.id}>
                  {"—".repeat(g.depth)} {g.name}
                </option>
              ))}
          </select>
        </label>
        <div className="mt-2 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-line-hairline px-3 py-1.5 text-sm text-ink-secondary hover:bg-white/5"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting || !name.trim()}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-soft disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
