import { useState } from "react";
import { Link, useParams, useLocation } from "react-router-dom";
import type { GroupNode, GroupTree, TargetSummary } from "../api/client.js";

interface Props {
  tree: GroupTree | undefined;
  isLoading: boolean;
}

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${enabled ? "bg-[#0ca30c]" : "bg-ink-muted"}`}
    />
  );
}

function TargetRow({ target }: { target: TargetSummary }) {
  const { targetId } = useParams();
  const active = targetId === String(target.id);
  return (
    <Link
      to={`/target/${target.id}`}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
        active ? "bg-accent/15 text-white" : "text-ink-secondary hover:bg-white/5 hover:text-white"
      }`}
    >
      <StatusDot enabled={target.enabled} />
      <span className="truncate">{target.name}</span>
    </Link>
  );
}

function GroupRow({ node, depth }: { node: GroupNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const { groupId } = useParams();
  const location = useLocation();
  const active = location.pathname === `/group/${node.id}` || groupId === String(node.id);
  const hasChildren = node.children.length > 0 || node.targets.length > 0;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-muted hover:text-white"
          aria-label={expanded ? "Collapse group" : "Expand group"}
        >
          {hasChildren ? (
            <svg
              width="10"
              height="10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              style={{ transform: expanded ? "rotate(90deg)" : "none", transition: "transform 120ms" }}
            >
              <path d="M9 6l6 6-6 6" />
            </svg>
          ) : (
            <span className="block h-1 w-1 rounded-full bg-ink-muted" />
          )}
        </button>
        <Link
          to={`/group/${node.id}`}
          className={`flex-1 truncate rounded-md px-1.5 py-1.5 text-sm font-medium ${
            active ? "bg-accent/15 text-white" : "text-ink-secondary hover:bg-white/5 hover:text-white"
          }`}
        >
          {node.name}
        </Link>
      </div>
      {expanded && (
        <div className="ml-3 border-l border-line-hairline pl-1">
          {node.children
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((child) => (
              <GroupRow key={child.id} node={child} depth={depth} />
            ))}
          {node.targets.map((t) => (
            <div key={t.id} style={{ paddingLeft: (depth + 1) * 12 }}>
              <TargetRow target={t} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Sidebar({ tree, isLoading }: Props) {
  return (
    <aside className="flex h-full w-64 shrink-0 flex-col border-r border-line-hairline bg-surface">
      <div className="border-b border-line-hairline px-4 py-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="text-lg font-semibold text-white">smokeping-ng</span>
        </Link>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {isLoading && <p className="px-2 text-xs text-ink-muted">Loading…</p>}
        {tree?.groups
          .slice()
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((g) => <GroupRow key={g.id} node={g} depth={0} />)}
        {tree && tree.ungroupedTargets.length > 0 && (
          <div className="mt-2">
            <p className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-ink-muted">Ungrouped</p>
            {tree.ungroupedTargets.map((t) => (
              <div key={t.id} className="px-0">
                <TargetRow target={t} />
              </div>
            ))}
          </div>
        )}
        {tree && tree.groups.length === 0 && tree.ungroupedTargets.length === 0 && (
          <p className="px-2 text-xs text-ink-muted">No targets yet. Add one from Admin.</p>
        )}
      </nav>
      <div className="border-t border-line-hairline p-3">
        <Link
          to="/admin"
          className="flex items-center justify-center gap-2 rounded-md border border-line-hairline px-3 py-2 text-sm text-ink-secondary hover:bg-white/5 hover:text-white"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
          </svg>
          Admin
        </Link>
      </div>
    </aside>
  );
}
