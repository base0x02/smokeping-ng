import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { LineChart } from "echarts/charts";
import {
  GridComponent,
  TitleComponent,
  TooltipComponent,
  DataZoomComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { ComposeOption } from "echarts/core";
import type { LineSeriesOption } from "echarts/charts";
import type {
  GridComponentOption,
  TitleComponentOption,
  TooltipComponentOption,
  DataZoomComponentOption,
} from "echarts/components";
import type { MeasurementPoint } from "../api/client.js";
import { lossToColor, lossLabel } from "../lib/lossColor.js";
import { formatAxisTime, formatMs, formatPct, formatTooltipTime } from "../lib/format.js";

interface Props {
  title: string;
  subtitle?: string;
  points: MeasurementPoint[];
  height?: number;
  onClick?: () => void;
  compact?: boolean;
}

echarts.use([LineChart, GridComponent, TitleComponent, TooltipComponent, DataZoomComponent, CanvasRenderer]);

type EChartsOption = ComposeOption<
  LineSeriesOption | GridComponentOption | TitleComponentOption | TooltipComponentOption | DataZoomComponentOption
>;

const BLUE = { r: 57, g: 135, b: 229 }; // accent / sequential blue

export function GraphCard({ title, subtitle, points, height = 260, onClick, compact = false }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current, undefined, { renderer: "canvas" });
    chartRef.current = chart;
    const resize = () => chart.resize();
    window.addEventListener("resize", resize);
    if (onClick) {
      chart.on("click", () => onClick());
    }
    return () => {
      window.removeEventListener("resize", resize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;

    const rangeMs =
      points.length > 1
        ? new Date(points[points.length - 1].ts).getTime() - new Date(points[0].ts).getTime()
        : 0;

    const lowerBand = points.map((p) => [
      new Date(p.ts).getTime(),
      p.avgRttMs === null ? null : p.avgRttMs - (p.stddevRttMs ?? 0),
    ]);
    const upperDelta = points.map((p) => [
      new Date(p.ts).getTime(),
      p.avgRttMs === null || p.stddevRttMs === null ? 0 : p.stddevRttMs * 2,
    ]);
    const avgLine = points.map((p) => ({
      value: [new Date(p.ts).getTime(), p.avgRttMs],
      itemStyle: { color: p.avgRttMs === null ? "transparent" : lossToColor(p.lossPct) },
      _raw: p,
    }));

    const showSymbols = points.length <= 400;

    const option: EChartsOption = {
      backgroundColor: "transparent",
      grid: {
        left: compact ? 44 : 56,
        right: compact ? 12 : 24,
        top: compact ? 28 : 36,
        bottom: compact ? 28 : 44,
      },
      title: title
        ? {
            text: title,
            subtext: subtitle,
            left: 12,
            top: 6,
            textStyle: { color: "#ffffff", fontSize: compact ? 13 : 15, fontWeight: 600 },
            subtextStyle: { color: "#898781", fontSize: 11 },
          }
        : undefined,
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: "#383835" } },
        axisLabel: {
          color: "#898781",
          fontSize: 10,
          formatter: (value: number) => formatAxisTime(value, rangeMs),
        },
        splitLine: { show: false },
        axisTick: { show: false },
      },
      yAxis: {
        type: "value",
        name: compact ? undefined : "RTT (ms)",
        nameTextStyle: { color: "#898781", fontSize: 10 },
        min: 0,
        axisLabel: { color: "#898781", fontSize: 10, formatter: (v: number) => `${v}` },
        splitLine: { lineStyle: { color: "#2c2c2a", type: "solid" } },
        axisLine: { show: false },
      },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#212120",
        borderColor: "#383835",
        borderWidth: 1,
        textStyle: { color: "#ffffff", fontSize: 12 },
        axisPointer: { type: "line", lineStyle: { color: "#52514e" } },
        formatter: (params: any) => {
          const arr = Array.isArray(params) ? params : [params];
          const lineParam = arr.find((p) => p.seriesName === "avg");
          if (!lineParam) return "";
          const raw = (lineParam.data as any)._raw as MeasurementPoint | undefined;
          const ts = (lineParam.value as number[])[0];
          if (!raw) return "";
          const swatch = `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${lossToColor(raw.lossPct)};margin-right:6px;"></span>`;
          return [
            `<div style="color:#898781;margin-bottom:4px;">${formatTooltipTime(ts)}</div>`,
            `<div style="font-weight:600;font-size:13px;">${formatMs(raw.avgRttMs)}</div>`,
            `<div style="color:#c3c2b7;">jitter (σ): ${formatMs(raw.stddevRttMs)}</div>`,
            `<div style="color:#c3c2b7;">${swatch}loss: ${formatPct(raw.lossPct)} (${lossLabel(raw.lossPct)}) · ${raw.received}/${raw.sent} received</div>`,
          ].join("");
        },
      },
      dataZoom: compact
        ? [{ type: "inside", disabled: true }]
        : [
            { type: "inside" },
            { type: "slider", height: 18, bottom: 6, borderColor: "#2c2c2a", fillerColor: "rgba(57,135,229,0.15)", handleStyle: { color: "#3987e5" }, textStyle: { color: "#898781", fontSize: 10 } },
          ],
      series: [
        {
          name: "band-lower",
          type: "line",
          data: lowerBand,
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          areaStyle: { opacity: 0 },
          silent: true,
          z: 1,
        },
        {
          name: "band-upper",
          type: "line",
          data: upperDelta,
          stack: "band",
          symbol: "none",
          lineStyle: { opacity: 0 },
          // avg sits at the exact vertical midpoint of this band's own bounding box
          // (avg-stddev .. avg+stddev), so a symmetric top/mid/bottom gradient reads
          // as fading outward from the RTT line in both directions.
          areaStyle: {
            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: `rgba(${BLUE.r},${BLUE.g},${BLUE.b},0.03)` },
              { offset: 0.5, color: `rgba(${BLUE.r},${BLUE.g},${BLUE.b},0.38)` },
              { offset: 1, color: `rgba(${BLUE.r},${BLUE.g},${BLUE.b},0.03)` },
            ]),
          },
          silent: true,
          z: 1,
        },
        {
          name: "avg",
          type: "line",
          data: avgLine,
          symbol: showSymbols ? "circle" : "none",
          symbolSize: 8,
          showSymbol: showSymbols,
          connectNulls: false,
          lineStyle: { width: 2, color: `rgba(${BLUE.r},${BLUE.g},${BLUE.b},0.85)` },
          itemStyle: { borderColor: "#1a1a19", borderWidth: 2 },
          emphasis: { focus: "series", scale: 1.3 },
          z: 3,
        },
      ],
    };

    chart.setOption(option, true);
  }, [points, title, subtitle, compact]);

  return (
    <div
      className={`rounded-lg border border-line-hairline bg-surface-raised ${onClick ? "cursor-pointer transition hover:border-accent/60" : ""}`}
      style={{ height }}
    >
      <div ref={ref} style={{ width: "100%", height: "100%" }} />
    </div>
  );
}
