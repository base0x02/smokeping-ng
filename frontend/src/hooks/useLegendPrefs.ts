import { createStoredSetting } from "../lib/storedSetting.js";

export type LegendPosition = "top" | "bottom";

/** Whether the graph legend bar is shown, and whether it is pinned to the top or bottom of the screen. */
export const useLegendVisible = createStoredSetting("smokeping-ng-legend-visible", true, (raw) =>
  raw === "true" ? true : raw === "false" ? false : undefined,
);

export const useLegendPosition = createStoredSetting<LegendPosition>("smokeping-ng-legend-position", "top", (raw) => {
  const v = JSON.parse(raw);
  return v === "top" || v === "bottom" ? v : undefined;
});
