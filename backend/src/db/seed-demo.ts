import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool } from "./client.js";
import { targets, measurements } from "./schema.js";
import { computeRoundStats } from "../lib/stats.js";

const TARGET_NAME = "Example Endpoint (Demo Data)";
const TARGET_HOST = "demo.example.internal";

const TICK_MS = 5 * 60 * 1000;
const DAYS = 7;
const TICK_COUNT = (DAYS * 24 * 60 * 60 * 1000) / TICK_MS; // 2016 ticks

const PING_COUNT = 20;
const RAMP_TICKS = 2; // ~10 min ramp in/out of a degraded window

interface DegradedWindow {
  startTick: number;
  endTick: number;
  centerRttMs: number;
  jitterSdMs: number;
  lossMinPct: number;
  lossMaxPct: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

// Box-Muller transform for a normally distributed sample.
function gaussian(mean: number, sd: number): number {
  const u1 = Math.random() || 1e-9;
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * sd;
}

function envelope(tick: number, w: DegradedWindow): number {
  if (tick < w.startTick || tick > w.endTick) return 0;
  const distFromEdge = Math.min(tick - w.startTick, w.endTick - tick);
  return clamp((distFromEdge + 1) / RAMP_TICKS, 0, 1);
}

function buildWindows(): DegradedWindow[] {
  const hourTicks = (h: number) => Math.round(h * 12); // 12 ticks/hour at 5-min cadence
  const windows: DegradedWindow[] = [];

  // The one big, clearly-flagged incident: dead center of the dataset,
  // 30 minutes, ~250ms with heavy 25-50% loss and +/-50ms jitter.
  const centerTick = Math.floor(TICK_COUNT / 2);
  windows.push({
    startTick: centerTick - 3,
    endTick: centerTick + 3, // 6 ticks = 30 minutes
    centerRttMs: 250,
    jitterSdMs: 50,
    lossMinPct: 25,
    lossMaxPct: 50,
  });

  // Lesser, scattered degraded periods so the rest of the week oscillates
  // between baseline and degraded rather than being one long flat stretch.
  const lesserHours = [6, 26, 46, 66, 106, 126, 146, 166];
  for (const h of lesserHours) {
    const durationTicks = 3 + Math.floor(Math.random() * 6); // 15-40 minutes
    const start = hourTicks(h) - Math.floor(durationTicks / 2);
    windows.push({
      startTick: start,
      endTick: start + durationTicks,
      centerRttMs: 80 + Math.random() * 100, // 80-180ms
      jitterSdMs: 20 + Math.random() * 20, // 20-40ms
      lossMinPct: 5 + Math.random() * 10, // 5-15%
      lossMaxPct: 15 + Math.random() * 15, // 15-30%
    });
  }

  return windows;
}

async function main() {
  const windows = buildWindows();

  const existing = await db.select().from(targets).where(eq(targets.name, TARGET_NAME));
  let targetId: number;
  if (existing.length > 0) {
    targetId = existing[0].id;
    await db.delete(measurements).where(eq(measurements.targetId, targetId));
    console.log(`Reusing existing demo target #${targetId}, cleared its old measurements.`);
  } else {
    const [created] = await db
      .insert(targets)
      .values({
        name: TARGET_NAME,
        host: TARGET_HOST,
        groupId: null,
        enabled: false, // never actually probed; this is static historical demo data
        pingCount: PING_COUNT,
        intervalSeconds: 300,
      })
      .returning();
    targetId = created.id;
    console.log(`Created demo target #${targetId}.`);
  }

  const now = Date.now();
  // Snap to the same wall-clock grid the live scheduler uses.
  const startTime = Math.floor(now / TICK_MS) * TICK_MS - TICK_COUNT * TICK_MS;

  let walk = 28; // starts mid-baseline-range
  const rows: (typeof measurements.$inferInsert)[] = [];

  for (let tick = 0; tick < TICK_COUNT; tick++) {
    // Slow organic drift within the 15-45ms baseline band.
    walk = clamp(walk + (Math.random() - 0.5) * 3, 15, 45);

    let env = 0;
    let activeWindow: DegradedWindow | null = null;
    for (const w of windows) {
      const e = envelope(tick, w);
      if (e > env) {
        env = e;
        activeWindow = w;
      }
    }

    const baselineSd = 3;
    const centerRtt = activeWindow ? walk + (activeWindow.centerRttMs - walk) * env : walk;
    const jitterSd = activeWindow ? baselineSd + (activeWindow.jitterSdMs - baselineSd) * env : baselineSd;
    const lossRollThisTick = activeWindow
      ? activeWindow.lossMinPct + Math.random() * (activeWindow.lossMaxPct - activeWindow.lossMinPct)
      : 0;
    const lossFrac = (lossRollThisTick / 100) * env;

    const raw: (number | null)[] = [];
    for (let i = 0; i < PING_COUNT; i++) {
      if (Math.random() < lossFrac) {
        raw.push(null);
      } else {
        raw.push(Math.round(Math.max(1, gaussian(centerRtt, jitterSd)) * 10) / 10);
      }
    }

    const stats = computeRoundStats(raw);
    rows.push({
      targetId,
      ts: new Date(startTime + tick * TICK_MS),
      sent: stats.sent,
      received: stats.received,
      avgRttMs: stats.avgRttMs,
      stddevRttMs: stats.stddevRttMs,
      lossPct: stats.lossPct,
      rawRtts: raw,
    });
  }

  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await db.insert(measurements).values(rows.slice(i, i + BATCH_SIZE));
  }

  console.log(`Inserted ${rows.length} synthetic measurements for "${TARGET_NAME}" (target #${targetId}).`);
  await pool.end();
}

main().catch((err) => {
  console.error("Demo seed failed:", err);
  process.exit(1);
});
