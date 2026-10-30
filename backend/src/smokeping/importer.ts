import { and, eq, isNull, min } from "drizzle-orm";
import { db } from "../db/client.js";
import { groups, measurements, targets } from "../db/schema.js";
import { computeRoundStats } from "../lib/stats.js";
import type { ImportPlan, PlanGroup, PlanTarget } from "./config.js";
import { parseRrd } from "./rrd.js";

export interface AppliedTarget {
  path: string;
  targetId: number;
  name: string;
  host: string;
  /** false when an existing target (same host in the same group) was reused. */
  created: boolean;
  rrdFile: string | null;
}

export interface ApplyResult {
  groupsCreated: number;
  groupsReused: number;
  targets: AppliedTarget[];
}

/**
 * Creates the plan's groups and targets. Re-running is safe: groups are matched
 * by name under the same parent and targets by host within the same group, and
 * reused instead of duplicated.
 */
export async function applyImportPlan(plan: ImportPlan): Promise<ApplyResult> {
  return db.transaction(async (tx) => {
    const result: ApplyResult = { groupsCreated: 0, groupsReused: 0, targets: [] };

    const upsertTarget = async (t: PlanTarget, groupId: number | null, sortOrder: number) => {
      const [existing] = await tx
        .select({ id: targets.id })
        .from(targets)
        .where(and(eq(targets.host, t.host), groupId === null ? isNull(targets.groupId) : eq(targets.groupId, groupId)));
      let targetId = existing?.id;
      if (targetId === undefined) {
        const [created] = await tx
          .insert(targets)
          .values({
            name: t.name,
            host: t.host,
            groupId,
            sortOrder,
            pingCount: plan.defaults.pingCount,
            intervalSeconds: plan.defaults.intervalSeconds,
          })
          .returning({ id: targets.id });
        targetId = created.id;
      }
      result.targets.push({
        path: t.path,
        targetId,
        name: t.name,
        host: t.host,
        created: !existing,
        rrdFile: t.rrdFile,
      });
    };

    const upsertGroup = async (g: PlanGroup, parentId: number | null, sortOrder: number) => {
      const [existing] = await tx
        .select({ id: groups.id })
        .from(groups)
        .where(and(eq(groups.name, g.name), parentId === null ? isNull(groups.parentId) : eq(groups.parentId, parentId)));
      let groupId = existing?.id;
      if (groupId === undefined) {
        const [created] = await tx.insert(groups).values({ name: g.name, parentId, sortOrder }).returning({ id: groups.id });
        groupId = created.id;
        result.groupsCreated++;
      } else {
        result.groupsReused++;
      }
      for (const [i, child] of g.groups.entries()) await upsertGroup(child, groupId, i);
      for (const [i, t] of g.targets.entries()) await upsertTarget(t, groupId, i);
    };

    for (const [i, g] of plan.groups.entries()) await upsertGroup(g, null, i);
    for (const [i, t] of plan.targets.entries()) await upsertTarget(t, null, i);
    return result;
  });
}

export interface HistoryResult {
  targetId: number;
  inserted: number;
  from: string | null;
  to: string | null;
  pingCount: number;
  stepSeconds: number;
}

const INSERT_BATCH = 1000;

/**
 * Converts a SmokePing RRD into measurement rows for `targetId`.
 *
 * SmokePing keeps several AVERAGE archives at decreasing resolution (e.g. 5 min
 * for days, 1 h for months, 12 h for a year). Each period is taken from the
 * finest archive that covers it, so recent history keeps full detail and older
 * history is still there at the resolution SmokePing kept it.
 *
 * Only history older than the target's first existing measurement is imported,
 * so imported data never overlaps what this app has measured itself, and
 * re-importing the same file is a no-op.
 *
 * With `adoptSettings`, the target's ping count and interval are set to match the
 * RRD (used for targets the migration just created).
 */
export async function importRrdHistory(
  targetId: number,
  buf: Buffer,
  { adoptSettings = false }: { adoptSettings?: boolean } = {},
): Promise<HistoryResult> {
  const rrd = parseRrd(buf);
  const dsIndex = new Map(rrd.dataSources.map((ds, i) => [ds.name, i]));
  const lossIdx = dsIndex.get("loss");
  const medianIdx = dsIndex.get("median");
  const pingIdxs: number[] = [];
  for (let n = 1; dsIndex.has(`ping${n}`); n++) pingIdxs.push(dsIndex.get(`ping${n}`)!);
  if (lossIdx === undefined || pingIdxs.length === 0) {
    throw new Error("Not a SmokePing ping RRD (missing loss/ping1.. data sources)");
  }
  const pingCount = pingIdxs.length;

  const [target] = await db.select({ id: targets.id }).from(targets).where(eq(targets.id, targetId));
  if (!target) throw new Error(`Target ${targetId} not found`);

  if (adoptSettings) {
    await db
      .update(targets)
      .set({ pingCount: Math.min(pingCount, 100), intervalSeconds: Math.max(rrd.pdpStep, 60) })
      .where(eq(targets.id, targetId));
  }

  const [{ earliest }] = await db
    .select({ earliest: min(measurements.ts) })
    .from(measurements)
    .where(eq(measurements.targetId, targetId));
  // Unix seconds; rows must end at or before this to be imported.
  let coveredFrom = earliest ? Math.floor(new Date(earliest).getTime() / 1000) : Infinity;

  const rows: (typeof measurements.$inferInsert)[] = [];
  const archives = rrd.archives.filter((a) => a.cf === "AVERAGE").sort((a, b) => a.stepSeconds - b.stepSeconds);

  for (const archive of archives) {
    const archiveRows: (typeof measurements.$inferInsert)[] = [];
    archive.rows.forEach((values, k) => {
      const end = archive.rowEndTimes[k];
      if (end > coveredFrom) return;
      const loss = values[lossIdx];
      if (Number.isNaN(loss)) return; // no data recorded for this period

      const rtts = pingIdxs.map((i) => (Number.isNaN(values[i]) ? null : values[i] * 1000));
      const lost = Math.min(pingCount, Math.max(0, Math.round(loss)));
      const received = pingCount - lost;
      const known = rtts.filter((v): v is number => v !== null);
      let { avgRttMs, stddevRttMs } = computeRoundStats(known);
      if (received === 0) {
        avgRttMs = null;
        stddevRttMs = null;
      } else if (avgRttMs === null && medianIdx !== undefined && !Number.isNaN(values[medianIdx])) {
        avgRttMs = values[medianIdx] * 1000;
        stddevRttMs = 0;
      }

      archiveRows.push({
        targetId,
        // Stamp with the interval start, like the prober stamps its slot time.
        ts: new Date((end - archive.stepSeconds) * 1000),
        sent: pingCount,
        received,
        avgRttMs,
        stddevRttMs,
        lossPct: (lost / pingCount) * 100,
        rawRtts: rtts,
      });
    });
    rows.push(...archiveRows);
    const spanStart = archive.rowEndTimes[0] - archive.stepSeconds;
    coveredFrom = Math.min(coveredFrom, spanStart);
  }

  let inserted = 0;
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const res = await db
      .insert(measurements)
      .values(rows.slice(i, i + INSERT_BATCH))
      .onConflictDoNothing()
      .returning({ id: measurements.id });
    inserted += res.length;
  }

  const times = rows.map((r) => (r.ts as Date).getTime());
  return {
    targetId,
    inserted,
    from: times.length ? new Date(Math.min(...times)).toISOString() : null,
    to: times.length ? new Date(Math.max(...times)).toISOString() : null,
    pingCount,
    stepSeconds: rrd.pdpStep,
  };
}
