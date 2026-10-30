import type { FastifyInstance } from "fastify";
import { sql } from "drizzle-orm";
import { db } from "../db/client.js";

/**
 * Flags endpoints whose recent readings have been out of the norm for a while.
 *
 * Each enabled endpoint's last RECENT_MINUTES are compared with its own
 * baseline (the BASELINE_DAYS before that), and it is flagged only when most
 * recent samples agree, so a single bad probe never raises an alert:
 *  - down:    every recent sample lost all its pings
 *  - loss:    most recent samples lost pings, well above the usual loss rate
 *  - latency: most recent samples were much slower than the usual median RTT
 */
const RECENT_MINUTES = 30;
const BASELINE_DAYS = 7;
const MIN_RECENT_SAMPLES = 3;
const MIN_BASELINE_SAMPLES = 12;
/** Share of recent samples that must be bad. */
const SUSTAINED_SHARE = 0.6;
const LOSS_MIN_PCT = 10;
const LOSS_ABOVE_BASELINE_PCT = 5;
const LATENCY_FACTOR = 1.5;
/** Absolute floor so sub-ms LAN jitter can't trip the latency rule. */
const LATENCY_MIN_EXTRA_MS = 10;

export interface EndpointAlert {
  targetId: number;
  name: string;
  host: string;
  kind: "down" | "loss" | "latency";
  severity: "critical" | "warning";
  /** Human summary, e.g. "RTT 3.1× normal (84 ms vs 27 ms)". */
  reason: string;
  since: string;
}

interface Row {
  target_id: number;
  name: string;
  host: string;
  recent_n: number;
  recent_down: number;
  recent_lossy: number;
  recent_loss: number | null;
  recent_slow: number;
  recent_rtt: number | null;
  first_bad: string | null;
  base_n: number | null;
  base_loss: number | null;
  base_rtt: number | null;
  [key: string]: unknown;
}

export async function findAlerts(): Promise<EndpointAlert[]> {
  const result = await db.execute<Row>(sql`
    with bounds as (
      select now() - make_interval(mins => ${RECENT_MINUTES}) as recent_from,
             now() - make_interval(days => ${BASELINE_DAYS}) as base_from
    ),
    base as (
      select m.target_id,
             count(*)::int as n,
             avg(m.loss_pct) as loss,
             percentile_cont(0.5) within group (order by m.avg_rtt_ms) as rtt
      from measurements m, bounds b
      where m.ts >= b.base_from and m.ts < b.recent_from
      group by m.target_id
    ),
    recent as (
      select m.target_id,
             count(*)::int as n,
             count(*) filter (where m.loss_pct >= 100)::int as down,
             count(*) filter (where m.loss_pct > 0)::int as lossy,
             avg(m.loss_pct) as loss,
             count(*) filter (
               where base.n >= ${MIN_BASELINE_SAMPLES}
                 and m.avg_rtt_ms > greatest(base.rtt * ${LATENCY_FACTOR}, base.rtt + ${LATENCY_MIN_EXTRA_MS})
             )::int as slow,
             percentile_cont(0.5) within group (order by m.avg_rtt_ms) as rtt,
             min(m.ts) filter (
               where m.loss_pct > 0
                  or (base.n >= ${MIN_BASELINE_SAMPLES}
                      and m.avg_rtt_ms > greatest(base.rtt * ${LATENCY_FACTOR}, base.rtt + ${LATENCY_MIN_EXTRA_MS}))
             ) as first_bad
      from measurements m
      cross join bounds b
      left join base on base.target_id = m.target_id
      where m.ts >= b.recent_from
      group by m.target_id
    )
    select t.id as target_id, t.name, t.host,
           r.n as recent_n, r.down as recent_down, r.lossy as recent_lossy, r.loss as recent_loss,
           r.slow as recent_slow, r.rtt as recent_rtt, r.first_bad,
           base.n as base_n, base.loss as base_loss, base.rtt as base_rtt
    from targets t
    join recent r on r.target_id = t.id
    left join base on base.target_id = t.id
    where t.enabled
  `);

  const alerts: EndpointAlert[] = [];
  for (const r of result.rows) {
    const n = Number(r.recent_n);
    if (n < MIN_RECENT_SAMPLES) continue;
    const common = { targetId: r.target_id, name: r.name, host: r.host, since: new Date(r.first_bad ?? Date.now()).toISOString() };
    const recentLoss = Number(r.recent_loss ?? 0);
    const baseLoss = Number(r.base_loss ?? 0);
    const hasBaseline = Number(r.base_n ?? 0) >= MIN_BASELINE_SAMPLES;

    if (Number(r.recent_down) === n) {
      alerts.push({ ...common, kind: "down", severity: "critical", reason: "No response to any ping" });
    } else if (
      Number(r.recent_lossy) >= n * SUSTAINED_SHARE &&
      recentLoss >= LOSS_MIN_PCT &&
      recentLoss >= baseLoss + LOSS_ABOVE_BASELINE_PCT
    ) {
      alerts.push({
        ...common,
        kind: "loss",
        severity: recentLoss >= 50 ? "critical" : "warning",
        reason: `Packet loss ${recentLoss.toFixed(0)}% (usually ${baseLoss.toFixed(1)}%)`,
      });
    } else if (hasBaseline && Number(r.recent_slow) >= n * SUSTAINED_SHARE && r.recent_rtt !== null && r.base_rtt !== null) {
      const now = Number(r.recent_rtt);
      const usual = Number(r.base_rtt);
      alerts.push({
        ...common,
        kind: "latency",
        severity: "warning",
        reason: `RTT ${(now / usual).toFixed(1)}× normal (${now.toFixed(0)} ms vs ${usual.toFixed(0)} ms)`,
      });
    }
  }

  // `since` so far only looks inside the recent window; extend it back to the
  // first sample after the last one that was fine (within the baseline span).
  await Promise.all(
    alerts.map(async (a) => {
      const row = result.rows.find((r) => r.target_id === a.targetId)!;
      const okCondition =
        a.kind === "down"
          ? sql`loss_pct < 100`
          : a.kind === "loss"
            ? sql`loss_pct = 0`
            : sql`avg_rtt_ms <= ${Math.max(Number(row.base_rtt) * LATENCY_FACTOR, Number(row.base_rtt) + LATENCY_MIN_EXTRA_MS)}`;
      const res = await db.execute<{ since: string | null; [key: string]: unknown }>(sql`
        select min(ts) as since from measurements
        where target_id = ${a.targetId}
          and ts > coalesce(
            (select max(ts) from measurements
             where target_id = ${a.targetId} and ts >= now() - make_interval(days => ${BASELINE_DAYS}) and ${okCondition}),
            now() - make_interval(days => ${BASELINE_DAYS}))
      `);
      if (res.rows[0]?.since) a.since = new Date(res.rows[0].since).toISOString();
    }),
  );

  // Critical first, then longest-running.
  return alerts.sort((a, b) =>
    a.severity !== b.severity ? (a.severity === "critical" ? -1 : 1) : a.since.localeCompare(b.since),
  );
}

export async function alertRoutes(app: FastifyInstance) {
  app.get("/api/alerts", async () => ({
    windowMinutes: RECENT_MINUTES,
    alerts: await findAlerts(),
  }));
}
