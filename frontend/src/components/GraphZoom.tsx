import { GRAPH_SIZES, useGraphSize } from "../hooks/useGraphSize.js";

const zoomButton =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-ink-muted hover:bg-ink-primary/5 hover:text-ink-primary disabled:pointer-events-none disabled:opacity-35";

/** Header control: make the graphs on the dashboard and group pages smaller or bigger. */
export function GraphZoom() {
  const { level, canZoomIn, canZoomOut, zoomIn, zoomOut, reset } = useGraphSize();

  return (
    <div className="flex items-center" role="group" aria-label="Graph size">
      <button onClick={zoomOut} disabled={!canZoomOut} aria-label="Smaller graphs" title="Smaller graphs (more per screen)" className={zoomButton}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35M8 11h6" />
        </svg>
      </button>
      <button
        onClick={reset}
        title="Reset graph size"
        aria-label={`Graph size ${level + 1} of ${GRAPH_SIZES.length}, reset`}
        className="flex h-8 items-center gap-0.5 rounded-md px-1 hover:bg-ink-primary/5"
      >
        {GRAPH_SIZES.map((_, i) => (
          <span key={i} className={`h-1.5 w-1.5 rounded-full ${i <= level ? "bg-ink-secondary" : "bg-line-baseline"}`} />
        ))}
      </button>
      <button onClick={zoomIn} disabled={!canZoomIn} aria-label="Bigger graphs" title="Bigger graphs (fewer per screen)" className={zoomButton}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="11" cy="11" r="7" />
          <path d="M21 21l-4.35-4.35M8 11h6M11 8v6" />
        </svg>
      </button>
    </div>
  );
}
