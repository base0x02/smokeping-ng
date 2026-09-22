// Packet-loss status scale (good -> warning -> serious -> critical), matching the
// dataviz skill's fixed, reserved status palette rather than an arbitrary hand-picked
// green->red ramp. Interpolated piecewise across the 4 anchor points.
const STOPS: { pct: number; rgb: [number, number, number] }[] = [
  { pct: 0, rgb: [12, 163, 12] }, // good #0ca30c
  { pct: 33, rgb: [250, 178, 25] }, // warning #fab219
  { pct: 66, rgb: [236, 131, 90] }, // serious #ec835a
  { pct: 100, rgb: [208, 59, 59] }, // critical #d03b3b
];

export function lossToColor(lossPct: number): string {
  const p = Math.max(0, Math.min(100, lossPct));
  for (let i = 0; i < STOPS.length - 1; i++) {
    const a = STOPS[i];
    const b = STOPS[i + 1];
    if (p >= a.pct && p <= b.pct) {
      const t = b.pct === a.pct ? 0 : (p - a.pct) / (b.pct - a.pct);
      const r = Math.round(a.rgb[0] + (b.rgb[0] - a.rgb[0]) * t);
      const g = Math.round(a.rgb[1] + (b.rgb[1] - a.rgb[1]) * t);
      const bl = Math.round(a.rgb[2] + (b.rgb[2] - a.rgb[2]) * t);
      return `rgb(${r}, ${g}, ${bl})`;
    }
  }
  return `rgb(${STOPS[STOPS.length - 1].rgb.join(", ")})`;
}

export function lossLabel(lossPct: number): string {
  if (lossPct <= 0) return "good";
  if (lossPct < 33) return "warning";
  if (lossPct < 66) return "serious";
  return "critical";
}
