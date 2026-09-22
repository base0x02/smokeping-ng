import { spawn } from "node:child_process";
import { db } from "../db/client.js";
import { targets, measurements } from "../db/schema.js";
import { eq } from "drizzle-orm";
import { computeRoundStats } from "../lib/stats.js";

interface Target {
  id: number;
  host: string;
  pingCount: number;
}

/**
 * Runs `fping -C <count> -q -p 200 host1 host2 ...` for a batch of targets that
 * share the same ping count, and parses the per-host RTT lists from stderr
 * (fping writes its -C results there even in quiet mode).
 */
function runFpingBatch(hosts: string[], count: number): Promise<Map<string, (number | null)[]>> {
  return new Promise((resolve) => {
    const results = new Map<string, (number | null)[]>();
    if (hosts.length === 0) {
      resolve(results);
      return;
    }

    const args = ["-C", String(count), "-q", "-p", "200", "-t", "1000", ...hosts];
    const child = spawn("fping", args);

    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", (err) => {
      console.error("fping failed to start:", err);
      resolve(results);
    });
    child.on("close", () => {
      for (const line of stderr.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.includes(":")) continue;
        const [hostPart, valuesPart] = trimmed.split(":");
        const host = hostPart.trim();
        const values = valuesPart
          .trim()
          .split(/\s+/)
          .map((v) => (v === "-" ? null : parseFloat(v)))
          .map((v) => (v !== null && Number.isNaN(v) ? null : v));
        if (host) {
          results.set(host, values);
        }
      }
      resolve(results);
    });
  });
}

export async function runProbeRound(): Promise<void> {
  const startedAt = new Date();
  const enabledTargets = await db
    .select({ id: targets.id, host: targets.host, pingCount: targets.pingCount })
    .from(targets)
    .where(eq(targets.enabled, true));

  if (enabledTargets.length === 0) return;

  // Batch targets by shared ping count so one fping invocation covers each group.
  const batches = new Map<number, Target[]>();
  for (const t of enabledTargets) {
    const list = batches.get(t.pingCount) ?? [];
    list.push(t);
    batches.set(t.pingCount, list);
  }

  const rows: (typeof measurements.$inferInsert)[] = [];

  for (const [count, batchTargets] of batches) {
    const hostList = batchTargets.map((t) => t.host);
    let resultsByHost: Map<string, (number | null)[]>;
    try {
      resultsByHost = await runFpingBatch(hostList, count);
    } catch (err) {
      console.error("Probe batch failed:", err);
      continue;
    }

    for (const target of batchTargets) {
      const rtts = resultsByHost.get(target.host) ?? Array(count).fill(null);
      const stats = computeRoundStats(rtts);
      rows.push({
        targetId: target.id,
        ts: startedAt,
        sent: stats.sent,
        received: stats.received,
        avgRttMs: stats.avgRttMs,
        stddevRttMs: stats.stddevRttMs,
        lossPct: stats.lossPct,
        rawRtts: rtts,
      });
    }
  }

  if (rows.length > 0) {
    await db.insert(measurements).values(rows);
    console.log(`Probe round complete: ${rows.length} targets measured at ${startedAt.toISOString()}`);
  }
}
