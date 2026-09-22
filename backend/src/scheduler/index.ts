import { db } from "../db/client.js";
import { targets } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { runProbeRound, type ProbeTarget } from "./prober.js";

/**
 * Wall-clock-aligned scheduler. A target with interval N seconds is probed at
 * every instant where (unix seconds % N === 0) - so 300s targets always land on
 * :00, :05, :10, ... regardless of when the process started or restarted.
 * Slots missed while the process was down are simply skipped (never run late
 * or off-cycle), and the measurement is stamped with the slot time itself.
 *
 * Targets are re-read from the DB on every wake, and the loop never sleeps
 * longer than MAX_SLEEP_MS, so new/edited targets are picked up without a
 * restart and get their first sample at their next aligned slot.
 */
const MAX_SLEEP_MS = 60_000;

function nextSlotSec(nowSec: number, intervalSec: number): number {
  return (Math.floor(nowSec / intervalSec) + 1) * intervalSec;
}

async function loadEnabledTargets(): Promise<(ProbeTarget & { intervalSeconds: number })[]> {
  return db
    .select({
      id: targets.id,
      host: targets.host,
      pingCount: targets.pingCount,
      intervalSeconds: targets.intervalSeconds,
    })
    .from(targets)
    .where(eq(targets.enabled, true));
}

function sleepUntil(targetMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, targetMs - Date.now())));
}

async function loop() {
  let lastSlotSec = 0;
  for (;;) {
    let enabled: Awaited<ReturnType<typeof loadEnabledTargets>>;
    try {
      enabled = await loadEnabledTargets();
    } catch (err) {
      console.error("Scheduler failed to load targets:", err);
      await sleepUntil(Date.now() + 5_000);
      continue;
    }

    // max() so a timer firing a hair early can never re-plan the slot we just ran.
    const nowSec = Math.max(Math.floor(Date.now() / 1000), lastSlotSec);
    const slotSec = enabled.length
      ? Math.min(...enabled.map((t) => nextSlotSec(nowSec, t.intervalSeconds)))
      : Infinity;
    const wakeMs = Math.min(slotSec * 1000, Date.now() + MAX_SLEEP_MS);

    await sleepUntil(wakeMs);
    if (wakeMs !== slotSec * 1000) continue; // periodic re-plan, no slot due yet
    lastSlotSec = slotSec;

    // Re-read so a target disabled/edited while we slept isn't probed on stale config.
    let due: ProbeTarget[];
    try {
      due = (await loadEnabledTargets()).filter((t) => slotSec % t.intervalSeconds === 0);
    } catch (err) {
      console.error("Scheduler failed to load targets:", err);
      continue;
    }
    if (due.length === 0) continue;

    // Not awaited: a slow round must not delay or skip the next slot.
    runProbeRound(new Date(slotSec * 1000), due).catch((err) => {
      console.error("Probe round failed:", err);
    });
  }
}

export function startScheduler() {
  void loop();
  console.log("Scheduler started: probing targets on wall-clock-aligned intervals");
}

