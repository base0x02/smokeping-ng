import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { sql, and, eq, gte, lte, asc, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { measurements, targets } from "../db/schema.js";

const RAW_POINT_BUDGET = 1500;
const RAW_INTERVAL_SECONDS = 300;

const rangeQuery = z.object({
  from: z.string().datetime(),
  to: z.string().datetime(),
});

export interface MeasurementPoint {
  ts: string;
  avgRttMs: number | null;
  stddevRttMs: number | null;
  lossPct: number;
  sent: number;
  received: number;
  rawRtts?: (number | null)[] | null;
}

async function queryRange(
  targetId: number,
  from: Date,
  to: Date,
): Promise<{ points: MeasurementPoint[]; bucketed: boolean }> {
  const rangeSeconds = Math.max(1, (to.getTime() - from.getTime()) / 1000);
  const rawPointCount = rangeSeconds / RAW_INTERVAL_SECONDS;

  if (rawPointCount <= RAW_POINT_BUDGET) {
    const rows = await db
      .select()
      .from(measurements)
      .where(and(eq(measurements.targetId, targetId), gte(measurements.ts, from), lte(measurements.ts, to)))
      .orderBy(asc(measurements.ts));

    return {
      bucketed: false,
      points: rows.map((r) => ({
        ts: r.ts.toISOString(),
        avgRttMs: r.avgRttMs,
        stddevRttMs: r.stddevRttMs,
        lossPct: r.lossPct,
        sent: r.sent,
        received: r.received,
        rawRtts: r.rawRtts,
      })),
    };
  }

  const bucketSeconds = Math.max(
    RAW_INTERVAL_SECONDS,
    Math.ceil(rangeSeconds / RAW_POINT_BUDGET / RAW_INTERVAL_SECONDS) * RAW_INTERVAL_SECONDS,
  );
  const bucketInterval = `${bucketSeconds} seconds`;

  const rows = await db.execute<{
    bucket_ts: string;
    avg_rtt_ms: number | null;
    stddev_rtt_ms: number | null;
    loss_pct: number;
    sent: number;
    received: number;
  }>(sql`
    select
      date_bin(${bucketInterval}::interval, ts, timestamptz '2000-01-01') as bucket_ts,
      avg(avg_rtt_ms) as avg_rtt_ms,
      sqrt(avg(power(coalesce(stddev_rtt_ms, 0), 2))) as stddev_rtt_ms,
      max(loss_pct) as loss_pct,
      sum(sent)::int as sent,
      sum(received)::int as received
    from measurements
    where target_id = ${targetId} and ts >= ${from.toISOString()} and ts <= ${to.toISOString()}
    group by bucket_ts
    order by bucket_ts
  `);

  return {
    bucketed: true,
    points: rows.rows.map((r) => ({
      ts: new Date(r.bucket_ts).toISOString(),
      avgRttMs: r.avg_rtt_ms === null ? null : Number(r.avg_rtt_ms),
      stddevRttMs: r.stddev_rtt_ms === null ? null : Number(r.stddev_rtt_ms),
      lossPct: Number(r.loss_pct),
      sent: Number(r.sent),
      received: Number(r.received),
    })),
  };
}

export async function measurementRoutes(app: FastifyInstance) {
  app.get("/api/targets/:id/measurements", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const parsed = rangeQuery.safeParse(req.query);
    if (!parsed.success) {
      return reply.code(400).send({ error: "from and to (ISO datetime) are required" });
    }
    const from = new Date(parsed.data.from);
    const to = new Date(parsed.data.to);
    const result = await queryRange(id, from, to);
    return result;
  });

  app.delete("/api/targets/:id/measurements", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await db.delete(measurements).where(eq(measurements.targetId, id));
    return reply.code(204).send();
  });

  // Default dashboard view: last ~3h for every enabled target
  app.get("/api/dashboard/sample", async () => {
    const enabledTargets = await db
      .select({ id: targets.id, name: targets.name, host: targets.host })
      .from(targets)
      .where(eq(targets.enabled, true));

    if (enabledTargets.length === 0) return { targets: [] };

    const to = new Date();
    const from = new Date(to.getTime() - 3 * 60 * 60 * 1000);
    const ids = enabledTargets.map((t) => t.id);

    const rows = await db
      .select()
      .from(measurements)
      .where(and(inArray(measurements.targetId, ids), gte(measurements.ts, from), lte(measurements.ts, to)))
      .orderBy(asc(measurements.ts));

    const byTarget = new Map<number, MeasurementPoint[]>();
    for (const r of rows) {
      const list = byTarget.get(r.targetId) ?? [];
      list.push({
        ts: r.ts.toISOString(),
        avgRttMs: r.avgRttMs,
        stddevRttMs: r.stddevRttMs,
        lossPct: r.lossPct,
        sent: r.sent,
        received: r.received,
      });
      byTarget.set(r.targetId, list);
    }

    return {
      targets: enabledTargets.map((t) => ({
        id: t.id,
        name: t.name,
        host: t.host,
        points: byTarget.get(t.id) ?? [],
      })),
    };
  });
}
