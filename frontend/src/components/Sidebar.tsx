import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { GroupNode, GroupTree, TargetSummary } from "../api/client.js";

interface Props {
  tree: GroupTree | undefined;
  isLoading: boolean;
  open: boolean;
  onClose: () => void;
}

function StatusDot({ enabled }: { enabled: boolean }) {
  return (
    <span
      className={`inline-block h-1.5 w-1.5 rounded-full ${enabled ? "bg-[#0ca30c]" : "bg-ink-muted"}`}
    />
  );
}

function TargetRow({ target }: { target: TargetSummary }) {
  // Rendered outside <Routes>, so match on the pathname rather than useParams().
  const active = useLocation().pathname === `/target/${target.id}`;
  return (
    <Link
      to={`/target/${target.id}`}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
        active ? "bg-accent/15 text-ink-primary" : "text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary"
      }`}
    >
      <StatusDot enabled={target.enabled} />
      <span className="truncate">{target.name}</span>
    </Link>
  );
}

function GroupRow({ node, depth }: { node: GroupNode; depth: number }) {
  const [expanded, setExpanded] = useState(true);
  const active = useLocation().pathname === `/group/${node.id}`;
  const hasChildren = node.children.length > 0 || node.targets.length > 0;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: depth * 12 }}>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="flex h-6 w-6 shrink-0 items-center justify-center text-ink-muted hover:text-ink-primary"
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
            active ? "bg-accent/15 text-ink-primary" : "text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary"
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

/** Endpoint tree in a slide-out drawer, opened from the header's hamburger. */
export function Sidebar({ tree, isLoading, open, onClose }: Props) {
  const location = useLocation();

  // Close after navigating to a page from the list.
  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      <div
        onClick={onClose}
        className={`fixed inset-x-0 bottom-0 top-14 z-30 bg-black/30 transition-opacity ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        aria-hidden
      />
      <aside
        className={`fixed bottom-0 left-0 top-14 z-40 flex w-72 max-w-[85vw] flex-col border-r border-line-hairline bg-surface shadow-lg transition-[transform,visibility] ${
          open ? "visible translate-x-0" : "invisible -translate-x-full"
        }`}
      >
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          <Link
            to="/"
            className={`mb-2 flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium ${
              location.pathname === "/"
                ? "bg-accent/15 text-ink-primary"
                : "text-ink-secondary hover:bg-ink-primary/5 hover:text-ink-primary"
            }`}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
            All Endpoints
          </Link>
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
      </aside>
    </>
  );
}
