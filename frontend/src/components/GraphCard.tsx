import { useCallback, useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { CustomChart } from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type { CustomSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import type { MeasurementPoint } from "../api/client.js";
import { lossToColor, lossLabel } from "../lib/lossColor.js";
import { formatAxisTime, formatMs, formatPct, formatTooltipTime } from "../lib/format.js";
import { subscribeToThemeChange } from "../lib/theme.js";

interface Props {
  title: string;
  points: MeasurementPoint[];
  /** Time window to draw; the x-axis spans all of it even where there's no data. */
  range?: { from: Date; to: Date };
  height?: number;
  onClick?: () => void;
  compact?: boolean;
}

echarts.use([CustomChart, GridComponent, TitleComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

type EChartsOption = ComposeOption<
  CustomSeriesOption | GridComponentOption | TitleComponentOption | TooltipComponentOption | DataZoomComponentOption
>;

const READINGS_SERIES_ID = "readings";
const X_ZOOM_IDS = ["x-inside", "x-slider"];
const Y_ZOOM_ID = "y-slider";
const OUTAGE_SERIES_ID = "outage";

// "Smoke": several translucent bands at increasing multiples of stddev, all the
// same flat neutral (grayscale) color, drawn as nested rects spanning each
// point's full column. Overlapping bands compound their alpha through normal
// canvas compositing, so the region near the line (covered by every layer)
// reads dense while the outer edge (covered by only the widest layer) fades to
// a faint haze - a soft cloud instead of one flat wash.
const SMOKE_LEVELS = [2.2, 1.6, 1.1, 0.7, 0.35];
const SMOKE_ALPHA = 0.16;

// The RTT axis always reaches at least this high, so quiet endpoints are drawn at a
// comparable scale; above it ECharts picks a round maximum that fits the data.
const MIN_Y_MAX_MS = 75;

function cssVar(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "0 0 0";
}

function buildPalette() {
  const ink = cssVar("--color-ink-primary");
  return {
    axisLine: `rgb(${cssVar("--color-line-baseline")})`,
    axisLabel: `rgb(${cssVar("--color-ink-muted")})`,
    splitLine: `rgb(${cssVar("--color-line-hairline")})`,
    titleText: `rgb(${cssVar("--color-ink-primary")})`,
    tooltipBg: `rgb(${cssVar("--color-surface-raised")})`,
    tooltipBorder: `rgb(${cssVar("--color-line-baseline")})`,
    tooltipText: `rgb(${cssVar("--color-ink-primary")})`,
    tooltipSecondary: `rgb(${cssVar("--color-ink-secondary")})`,
    tooltipMuted: `rgb(${cssVar("--color-ink-muted")})`,
    accent: `rgb(${cssVar("--color-accent")})`,
    accentFiller: `rgb(${cssVar("--color-accent")} / 0.15)`,
    // Grayscale, theme-following: near-black smoke on a light surface, white
    // smoke on a dark surface - just the ink color at low, layerable alpha.
    smoke: (alpha: number) => `rgb(${ink} / ${alpha})`,
    // Fixed (mode-invariant) outage red, same status hue used elsewhere for loss.
    outageBg: "rgba(208, 59, 59, 0.22)",
  };
}

/** Typical spacing between samples, in ms - robust to the occasional gap via median. */
function computeSlotMs(points: MeasurementPoint[]): number {
  if (points.length < 2) return 5 * 60 * 1000;
  const diffs: number[] = [];
  for (let i = 1; i < points.length; i++) {
    diffs.push(new Date(points[i].ts).getTime() - new Date(points[i - 1].ts).getTime());
  }
  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)] || 5 * 60 * 1000;
}

export function GraphCard({ title, points, range, height = 260, onClick, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);
  const stateRef = useRef({ title, points, range, compact, onClick });
  // User zoom positions by dataZoom id, re-applied on every redraw (data refresh,
  // theme change) so they don't snap back. X zoom resets when the time range changes.
  const zoomRef = useRef<Record<string, { start: number; end: number }>>({});
  const zoomRangeRef = useRef(range);
  stateRef.current = { title, points, range, compact, onClick };

  const renderChart = useCallback(() => {
    const chart = chartRef.current;
    if (!chart) return;
    const { title, points, range, compact } = stateRef.current;
    if (zoomRangeRef.current !== range) {
      zoomRangeRef.current = range;
      for (const id of X_ZOOM_IDS) delete zoomRef.current[id];
    }
    const zoom = zoomRef.current;
    const palette = buildPalette();
    const slotMs = computeSlotMs(points);
    const dashPxHeight = compact ? 3 : 4;

    const rangeMs = range
      ? range.to.getTime() - range.from.getTime()
      : points.length > 1
        ? new Date(points[points.length - 1].ts).getTime() - new Date(points[0].ts).getTime()
        : 0;

    const peakRttMs = Math.max(0, ...points.map((p) => p.avgRttMs ?? 0));
    const yMax = peakRttMs <= MIN_Y_MAX_MS ? MIN_Y_MAX_MS : undefined;

    const seriesData = points.map((p) => ({
      value: [new Date(p.ts).getTime(), p.avgRttMs],
      _raw: p,
    }));

    const readingsSeries: CustomSeriesOption = {
      id: READINGS_SERIES_ID,
      type: "custom",
      clip: true,
      data: seriesData,
      encode: { x: 0, y: 1 },
      z: 2,
      renderItem: (params, api) => {
        const raw = points[params.dataIndex as number];
        if (!raw || raw.avgRttMs === null) return { type: "group", children: [] };

        const ts = new Date(raw.ts).getTime();
        const sd = raw.stddevRttMs ?? 0;
        const centerPx = api.coord([ts, raw.avgRttMs]) as number[];
        const slotWidthPx = Math.max(1, (api.size as any)([slotMs, 0])[0]);
        const x0 = centerPx[0] - slotWidthPx / 2;
        const rectWidth = slotWidthPx;

        const children: any[] = [];
        for (const mult of SMOKE_LEVELS) {
          const yTopPx = (api.coord([ts, raw.avgRttMs + mult * sd]) as number[])[1];
          const yBotPx = (api.coord([ts, raw.avgRttMs - mult * sd]) as number[])[1];
          children.push({
            type: "rect",
            shape: { x: x0, y: yTopPx, width: rectWidth, height: Math.max(0, yBotPx - yTopPx) },
            style: { fill: palette.smoke(SMOKE_ALPHA), stroke: "none" },
            silent: true,
          });
        }
        children.push({
          type: "rect",
          shape: {
            x: x0,
            y: centerPx[1] - dashPxHeight / 2,
            width: rectWidth,
            height: dashPxHeight,
          },
          style: { fill: lossToColor(raw.lossPct), stroke: "none" },
        });

        return { type: "group", children };
      },
    };

    const outageSeries: CustomSeriesOption = {
      id: OUTAGE_SERIES_ID,
      type: "custom",
      clip: true,
      silent: true,
      data: seriesData,
      encode: { x: 0, y: 1 },
      z: 0,
      renderItem: (params, api) => {
        const raw = points[params.dataIndex as number];
        if (!raw || raw.avgRttMs !== null) return { type: "group", children: [] };

        const ts = new Date(raw.ts).getTime();
        const centerPx = api.coord([ts, 0]) as number[];
        const slotWidthPx = Math.max(1, (api.size as any)([slotMs, 0])[0]);
        const x0 = centerPx[0] - slotWidthPx / 2;
        const rect = (params as any).coordSys as { y: number; height: number };

        return {
          type: "rect",
          shape: { x: x0, y: rect.y, width: slotWidthPx, height: rect.height },
          style: { fill: palette.outageBg, stroke: "none" },
        };
      },
    };

    const option: EChartsOption = {
      backgroundColor: "transparent",
      grid: {
        left: compact ? 44 : 84, // full size leaves room for the y-axis slider
        right: compact ? 12 : 24,
        top: compact ? 40 : 36,
        bottom: compact ? 28 : 44,
      },
      title: title
        ? {
            text: title,
            left: 12,
            top: 6,
            textStyle: { color: palette.titleText, fontSize: compact ? 13 : 15, fontWeight: 600 },
          }
        : undefined,
      xAxis: {
        type: "time",
        min: range?.from.getTime(),
        max: range?.to.getTime(),
        axisLine: { lineStyle: { color: palette.axisLine } },
        axisLabel: {
          color: palette.axisLabel,
          fontSize: 10,
          formatter: (value: number) => formatAxisTime(value, rangeMs),
          hideOverlap: true,
        },
        splitLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: compact ? undefined : "RTT (ms)",
        nameTextStyle: { color: palette.axisLabel, fontSize: 10 },
        min: 0,
        max: yMax,
        axisLabel: { color: palette.axisLabel, fontSize: 10, formatter: (v: number) => `${v}` },
        splitLine: { lineStyle: { color: palette.splitLine, type: "solid" } },
        axisLine: { show: false },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: palette.tooltipBg,
        borderColor: palette.tooltipBorder,
        borderWidth: 1,
        textStyle: { color: palette.tooltipText, fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: palette.tooltipSecondary } },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const p = arr.find((p) => p.seriesId === READINGS_SERIES_ID);
          if (!p) return "";
          const raw = (p.data as any)._raw as MeasurementPoint | undefined;
          const ts = (p.value as number[])[0];
          if (!raw) return "";
          const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${lossToColor(raw.lossPct)};margin-right:6px;"></span>`;
          return [
            `<div style="color:${palette.tooltipMuted};margin-bottom:4px;">${formatTooltipTime(ts)}</div>`,
            `<div style="font-weight:600;font-size:13px;">${formatMs(raw.avgRttMs)}</div>`,
            `<div style="color:${palette.tooltipSecondary};">jitter (σ): ${formatMs(raw.stddevRttMs)}</div>`,
            `<div style="color:${palette.tooltipSecondary};">${swatch}loss: ${formatPct(raw.lossPct)} (${lossLabel(raw.lossPct)}) · ${raw.received}/${raw.sent} received</div>`,
          ].join("");
        },
      },
      dataZoom: compact
        ? [{ type: "inside", disabled: true }]
        : [
            { id: "x-inside", type: "inside", xAxisIndex: 0, ...zoom["x-inside"] },
            {
              id: "x-slider",
              type: "slider",
              xAxisIndex: 0,
              height: 18,
              bottom: 6,
              borderColor: palette.splitLine,
              fillerColor: palette.accentFiller,
              handleStyle: { color: palette.accent },
              textStyle: { color: palette.axisLabel, fontSize: 10 },
              ...zoom["x-slider"],
            },
            {
              // Y-axis scale: drag the handles to zoom the RTT range.
              id: Y_ZOOM_ID,
              type: "slider",
              yAxisIndex: 0,
              orient: "vertical",
              left: 10,
              width: 14,
              top: 36,
              bottom: 44,
              filterMode: "none",
              borderColor: palette.splitLine,
              fillerColor: palette.accentFiller,
              handleStyle: { color: palette.accent },
              moveHandleSize: 0,
              showDataShadow: false,
              textStyle: { color: palette.axisLabel, fontSize: 10 },
              labelFormatter: (v: number) => formatMs(v),
              ...zoom[Y_ZOOM_ID],
            },
          ],
      series: [outageSeries, readingsSeries],
    };

    chart.setOption(option, true);
  }, []);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;

    const onResize = () => chart.resize();
    window.addEventListener("resize", onResize);

    chart.on("click", () => stateRef.current.onClick?.());
    chart.on("datazoom", () => {
      const dataZoom = (chart.getOption().dataZoom ?? []) as { id: string; start: number; end: number }[];
      for (const dz of dataZoom) zoomRef.current[dz.id] = { start: dz.start, end: dz.end };
    });

    renderChart();
    const unsubscribeTheme = subscribeToThemeChange(renderChart);

    return () => {
      window.removeEventListener("resize", onResize);
      unsubscribeTheme();
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    renderChart();
  }, [points, range, title, compact, renderChart]);

  return (
    <div
      className={`rounded-lg border border-line-hairline bg-surface-raised ${onClick ? "cursor-pointer transition hover:border-accent/60" : ""}`}
      style={{ height }}
    >
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
