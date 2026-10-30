import { useState } from "react";
import { GROUP_DEPTH_OPTIONS, useGroupSections } from "../hooks/useGroupSections.js";

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-ink-primary/5 hover:text-ink-primary";

/** Header control: whether, and how many folder levels deep, graphs are boxed by group. */
export function GroupDepthMenu() {
  const { depth, grouped, setDepth } = useGroupSections();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Group graphs"
        title="Group graphs"
        className={`${iconButton} ${grouped ? "bg-ink-primary/5 text-ink-primary" : ""}`}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="7" rx="1.5" />
          <rect x="3" y="14" width="18" height="7" rx="1.5" />
        </svg>
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div role="menu" className="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-line-hairline bg-surface-raised p-1 shadow-xl">
            <p className="px-3 pb-1 pt-2 text-xs text-ink-muted">Group graphs into boxes</p>
            {GROUP_DEPTH_OPTIONS.map((o) => (
              <button
                key={o.label}
                role="menuitemradio"
                aria-checked={depth === o.depth}
                onClick={() => {
                  setDepth(o.depth);
                  setOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm text-ink-primary hover:bg-ink-primary/5"
              >
                {o.label}
                {depth === o.depth && (
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-accent">
                    <path d="M5 12l5 5L20 7" />
                  </svg>
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
