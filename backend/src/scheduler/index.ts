import cron from "node-cron";
import { runProbeRound } from "./prober.js";

let running = false;

async function safeRun() {
  if (running) {
    console.warn("Previous probe round still running, skipping this tick");
    return;
  }
  running = true;
  try {
    await runProbeRound();
  } catch (err) {
    console.error("Probe round failed:", err);
  } finally {
    running = false;
  }
}

export function startScheduler() {
  // Run once immediately so a fresh deployment shows data right away.
  void safeRun();
  cron.schedule("*/5 * * * *", () => {
    void safeRun();
  });
  console.log("Scheduler started: probing every 5 minutes");
}
