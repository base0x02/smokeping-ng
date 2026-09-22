import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

interface JobRun {
  ts: string;
  sent: number;
  received: number;
  avgRttMs: number | null;
  stddevRttMs: number | null;
  lossPct: number;
  rawRtts: (number | null)[] | null;
}

interface JobRow {
  target_id: number;
  target_name: string;
  host: string;
  ts: string | null;
  sent: number | null;
  received: number | null;
  avg_rtt_ms: number | null;
  stddev_rtt_ms: number | null;
  loss_pct: number | null;
  raw_rtts: (number | null)[] | null;
  [key: string]: unknown;
}

const RUNS_PER_TARGET = 5;

export async function jobRoutes(app: FastifyInstance) {
  // Last N probe runs (measurement rows) for every target, most recent first.
  app.get("/api/jobs", async () => {
    const result = await db.execute<JobRow>(sql`
      select target_id, target_name, host, ts, sent, received, avg_rtt_ms, stddev_rtt_ms, loss_pct, raw_rtts
      from (
        select
          t.id as target_id,
          t.name as target_name,
          t.host as host,
          m.ts,
          m.sent,
          m.received,
          m.avg_rtt_ms,
          m.stddev_rtt_ms,
          m.loss_pct,
          m.raw_rtts,
          row_number() over (partition by t.id order by m.ts desc) as rn
        from targets t
        left join measurements m on m.target_id = t.id
      ) ranked
      where rn <= ${RUNS_PER_TARGET}
      order by target_name asc, ts desc
    `);

    const byTarget = new Map<
      number,
      { targetId: number; targetName: string; host: string; runs: JobRun[] }
    >();

    for (const row of result.rows) {
      let entry = byTarget.get(row.target_id);
      if (!entry) {
        entry = { targetId: row.target_id, targetName: row.target_name, host: row.host, runs: [] };
        byTarget.set(row.target_id, entry);
      }
      if (row.ts !== null) {
        entry.runs.push({
          ts: new Date(row.ts).toISOString(),
          sent: row.sent!,
          received: row.received!,
          avgRttMs: row.avg_rtt_ms === null ? null : Number(row.avg_rtt_ms),
          stddevRttMs: row.stddev_rtt_ms === null ? null : Number(row.stddev_rtt_ms),
          lossPct: Number(row.loss_pct),
          rawRtts: row.raw_rtts,
        });
      }
    }

    return { targets: Array.from(byTarget.values()) };
  });
}
