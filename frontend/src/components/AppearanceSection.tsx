import { useEffect, useState } from "react";
import { useTheme } from "../hooks/useTheme.js";
import { useLegendPosition, useLegendVisible } from "../hooks/useLegendPrefs.js";
import {
  PALETTES,
  getPalette,
  setPalette,
  setThemePreference,
  subscribeToThemeChange,
  type PaletteId,
  type ResolvedTheme,
} from "../lib/theme.js";

// Fixed bar heights for the mini smoke graph in each preview.
const PREVIEW_BARS = [5, 7, 6, 9, 6, 5, 8, 6, 7, 5, 6, 8];

/** A tiny page mock rendered with the palette's own tokens for one mode. */
function PalettePreview({ palette, mode }: { palette: PaletteId; mode: ResolvedTheme }) {
  return (
    <div data-palette={palette} data-theme={mode} className="flex-1 bg-surface-page p-2">
      <div className="rounded-md border border-line-hairline bg-surface-raised p-1.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="h-1 w-6 rounded-full bg-ink-primary" />
          <span className="h-1.5 w-3 rounded-full bg-accent" />
        </div>
        <div className="flex h-7 items-center gap-px">
          {PREVIEW_BARS.map((h, i) => (
            <span key={i} className="relative flex-1" style={{ height: h * 3 }}>
              <span className="absolute inset-0 rounded-sm" style={{ background: "rgb(var(--color-smoke) / 0.25)" }} />
              <span className="absolute inset-x-0 top-1/2 h-px bg-[#0ca30c]" />
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AppearanceSection() {
  const { resolved } = useTheme();
  const [palette, setPaletteState] = useState<PaletteId>(getPalette);
  const [legendVisible, setLegendVisible] = useLegendVisible();
  const [legendPosition, setLegendPosition] = useLegendPosition();

  useEffect(() => subscribeToThemeChange(() => setPaletteState(getPalette())), []);

  const segment = (active: boolean, label: string, onClick: () => void, disabled = false) => (
    <button
      key={label}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={`rounded-md px-3 py-1 text-sm disabled:opacity-40 ${
        active ? "bg-accent text-white" : "text-ink-secondary hover:bg-ink-primary/5"
      }`}
    >
      {label}
    </button>
  );
  const modeButton = (mode: ResolvedTheme, label: string) => segment(resolved === mode, label, () => setThemePreference(mode));

  return (
    <section>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-ink-primary">Appearance</h2>
          <p className="mt-1 text-xs text-ink-muted">Color palette, light/dark mode and graph legend. Saved in this browser.</p>
        </div>
        <div className="flex rounded-lg border border-line-hairline p-0.5">
          {modeButton("light", "Light")}
          {modeButton("dark", "Dark")}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {PALETTES.map((p) => {
          const active = p.id === palette;
          return (
            <button
              key={p.id}
              onClick={() => setPalette(p.id)}
              aria-pressed={active}
              className={`overflow-hidden rounded-xl border text-left transition ${
                active ? "border-accent ring-2 ring-accent/40" : "border-line-hairline hover:border-line-baseline"
              }`}
            >
              <div className="flex">
                <PalettePreview palette={p.id} mode="light" />
                <PalettePreview palette={p.id} mode="dark" />
              </div>
              <div className="flex items-center justify-between bg-surface px-3 py-2 text-sm">
                <span className="text-ink-primary">{p.label}</span>
                {active && <span className="text-xs text-accent">Active</span>}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
        <span className="text-ink-secondary">Graph legend</span>
        <div className="flex rounded-lg border border-line-hairline p-0.5">
          {segment(legendVisible, "Show", () => setLegendVisible(true))}
          {segment(!legendVisible, "Hide", () => setLegendVisible(false))}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-ink-muted">Position</span>
          <div className="flex rounded-lg border border-line-hairline p-0.5">
            {segment(legendPosition === "top", "Top", () => setLegendPosition("top"), !legendVisible)}
            {segment(legendPosition === "bottom", "Bottom", () => setLegendPosition("bottom"), !legendVisible)}
          </div>
        </div>
      </div>
    </section>
  );
}
