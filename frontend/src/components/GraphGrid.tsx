import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { useGraphSize } from "../hooks/useGraphSize.js";
import { useGroupSections } from "../hooks/useGroupSections.js";
import type { TargetSection } from "../lib/groupTree.js";

// Grouped layout geometry, in px. Must match the Tailwind classes used below.
const GAP = 16; // gap-4 between boxes (and between graphs in the flat grid)
const BOX_PAD = 12; // p-3 inside a group box
const BOX_HEADER = 28; // h-7 group title row
const INNER_GAP = 12; // gap-3 between graphs inside a box

function FlatGrid({ children }: { children: ReactNode }) {
  const { size } = useGraphSize();
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: `repeat(auto-fill, minmax(min(${size.minWidth}px, 100%), 1fr))` }}
    >
      {children}
    </div>
  );
}

/**
 * Columns a group box of `n` graphs should span out of `cols`: as few empty
 * cells as possible, with a mild preference for wide boxes over tall towers.
 */
function boxSpan(n: number, cols: number): { colSpan: number; rowSpan: number } {
  let best = { colSpan: 1, rowSpan: n, score: Infinity };
  for (let k = Math.min(n, cols); k >= 1; k--) {
    const r = Math.ceil(n / k);
    const score = k * r - n + r * 0.5;
    if (score < best.score) best = { colSpan: k, rowSpan: r, score };
  }
  return best;
}

interface Placement {
  col: number;
  row: number;
  /** Columns the box occupies, >= its graph columns when widened into free space. */
  width: number;
  rows: number;
  /** Graph columns inside the box. */
  innerCols: number;
}

/**
 * Packs boxes into a `cols`-wide grid: each goes at the first row-major spot it
 * fits (like CSS dense flow), then any box with free cells to its right on all
 * of its rows widens into them, so no row ends in dead space beside it.
 */
function packBoxes(sizes: number[], cols: number): Placement[] {
  const taken: boolean[][] = [];
  const free = (r: number, c: number) => !taken[r]?.[c];
  const mark = (p: Placement) => {
    for (let r = p.row; r < p.row + p.rows; r++) {
      taken[r] ??= [];
      for (let c = p.col; c < p.col + p.width; c++) taken[r][c] = true;
    }
  };

  const placements = sizes.map((n) => {
    const { colSpan, rowSpan } = boxSpan(n, cols);
    for (let row = 0; ; row++) {
      for (let col = 0; col + colSpan <= cols; col++) {
        let fits = true;
        for (let r = row; r < row + rowSpan && fits; r++) {
          for (let c = col; c < col + colSpan && fits; c++) fits = free(r, c);
        }
        if (fits) {
          const p = { col, row, width: colSpan, rows: rowSpan, innerCols: colSpan };
          mark(p);
          return p;
        }
      }
    }
  });

  for (const p of placements) {
    const rows = Array.from({ length: p.rows }, (_, i) => p.row + i);
    while (p.col + p.width < cols && rows.every((r) => free(r, p.col + p.width))) {
      rows.forEach((r) => (taken[r] ??= [])[p.col + p.width] = true);
      p.width++;
    }
  }
  return placements;
}

/** Grid columns that fit at `minWidth` each in the measured element (only measured while `active`). */
function useColumnCount(minWidth: number, active: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const [cols, setCols] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setCols(Math.max(1, Math.floor((el.clientWidth + GAP) / (minWidth + GAP))));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [minWidth, active]);
  return { ref, cols };
}

interface Props {
  /** Target ids in flat display order. */
  targetIds: number[];
  /** Group sections, used when the header's group toggle is on. */
  sections: TargetSection[];
  renderGraph: (targetId: number, height: number) => ReactNode;
}

/**
 * The graph grid for multi-graph pages, sized by the header's graph zoom.
 *
 * With the header's group toggle on, each group becomes a box spanning a
 * rectangle of grid cells just big enough for its graphs, and the boxes are
 * packed into one shared grid (see packBoxes), so small groups fill the gaps
 * beside big ones instead of each group taking a full-width row.
 */
export function GraphGrid({ targetIds, sections, renderGraph }: Props) {
  const { grouped } = useGroupSections();
  const { size } = useGraphSize();
  const { ref, cols } = useColumnCount(size.minWidth, grouped);

  if (!grouped) {
    return <FlatGrid>{targetIds.map((id) => renderGraph(id, size.height))}</FlatGrid>;
  }

  // One grid row fits one graph plus a box's fixed chrome, so a one-row box shows graphs at exactly size.height.
  const rowHeight = size.height + BOX_HEADER + 2 * BOX_PAD;
  const shown = new Set(targetIds);
  const boxes = sections
    .map((s) => ({ ...s, ids: s.targetIds.filter((id) => shown.has(id)) }))
    .filter((s) => s.ids.length > 0);
  const placements = packBoxes(
    boxes.map((b) => b.ids.length),
    cols,
  );

  return (
    <div
      ref={ref}
      className="grid gap-4"
      style={{
        gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
        gridAutoRows: rowHeight,
      }}
    >
      {boxes.map((s, i) => {
        const { ids } = s;
        const { col, row, width, rows: rowSpan, innerCols } = placements[i];
        // Taller boxes gain the gaps between grid rows; share that out between their graph rows.
        const boxHeight = rowSpan * rowHeight + (rowSpan - 1) * GAP;
        const graphHeight = Math.floor((boxHeight - BOX_HEADER - 2 * BOX_PAD - (rowSpan - 1) * INNER_GAP) / rowSpan);
        return (
          <section
            key={s.key}
            className="flex min-w-0 flex-col rounded-2xl border border-line-hairline bg-surface p-3"
            style={{ gridColumn: `${col + 1} / span ${width}`, gridRow: `${row + 1} / span ${rowSpan}` }}
          >
            <h2 className="flex h-7 shrink-0 items-start gap-2 truncate text-sm font-semibold text-ink-secondary">
              {s.groupId === null ? (
                s.title
              ) : (
                <Link to={`/group/${s.groupId}`} className="truncate hover:text-accent hover:underline">
                  {s.title}
                </Link>
              )}
              <span className="font-normal text-ink-muted">{ids.length}</span>
            </h2>
            <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${innerCols}, minmax(0, 1fr))` }}>
              {ids.map((id) => renderGraph(id, graphHeight))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
