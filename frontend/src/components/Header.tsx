import { Link, useLocation } from "react-router-dom";
import { ThemeToggle } from "./ThemeToggle.js";
import { GraphZoom } from "./GraphZoom.js";
import { GroupDepthMenu } from "./GroupDepthMenu.js";
import { AlertButton } from "./AlertButton.js";
import { useCurrentPageChrome } from "../hooks/usePageChrome.js";

interface Props {
  menuOpen: boolean;
  onToggleMenu: () => void;
}

const iconButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-ink-primary/5 hover:text-ink-primary";

export function Header({ menuOpen, onToggleMenu }: Props) {
  const location = useLocation();
  const onAdmin = location.pathname.startsWith("/admin");
  const page = useCurrentPageChrome();

  return (
    <header className="grid h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b border-line-hairline bg-surface px-3">
      <div className="flex min-w-0 items-center gap-2">
        <button
          onClick={onToggleMenu}
          aria-label={menuOpen ? "Close endpoint list" : "Open endpoint list"}
          aria-expanded={menuOpen}
          title="Endpoints"
          className={iconButton}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M3 6h18M3 12h18M3 18h18" />}
          </svg>
        </button>
        {page.title && (
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-sm font-semibold text-ink-primary">{page.title}</h1>
            {page.subtitle && <p className="truncate text-xs text-ink-muted">{page.subtitle}</p>}
          </div>
        )}
      </div>

      <Link to="/" className="text-lg font-semibold text-ink-primary">
        <b>smoke</b>ping
      </Link>

      <div className="flex items-center justify-end gap-1">
        <AlertButton />
        <GroupDepthMenu />
        <GraphZoom />
        <span className="mx-1 h-5 w-px bg-line-hairline" />
        <ThemeToggle />
        <Link
          to="/admin"
          aria-label="Admin"
          title="Admin"
          className={`${iconButton} ${onAdmin ? "bg-ink-primary/5 text-ink-primary" : ""}`}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1z" />
          </svg>
        </Link>
      </div>
    </header>
  );
}
