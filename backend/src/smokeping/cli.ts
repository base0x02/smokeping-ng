/**
 * Command-line SmokePing migration:
 *
 *   npm run import:smokeping -- --config /path/to/Targets [--data /path/to/data] [--dry-run]
 *
 * Creates groups/targets from the Targets config and, with --data, imports each
 * target's RRD as historical measurements. Safe to re-run.
 */
import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import { pool } from "../db/client.js";
import { buildImportPlan, type PlanGroup } from "./config.js";
import { applyImportPlan, importRrdHistory } from "./importer.js";

function parseArgs(argv: string[]) {
  const args: { config?: string; data?: string; dryRun: boolean } = { dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--config" || a === "--targets") args.config = argv[++i];
    else if (a === "--data") args.data = argv[++i];
    else if (a === "--dry-run") args.dryRun = true;
    else throw new Error(`Unknown argument: ${a}`);
  }
  if (!args.config) throw new Error("Usage: import:smokeping --config <Targets file> [--data <rrd dir>] [--dry-run]");
  return args;
}

async function listRrdFiles(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { recursive: true, withFileTypes: true });
  return entries
    .filter((e) => e.isFile() && e.name.endsWith(".rrd"))
    .map((e) => path.relative(dir, path.join(e.parentPath, e.name)));
}

function printGroup(g: PlanGroup, depth: number) {
  const pad = "  ".repeat(depth);
  console.log(`${pad}[${g.name}]`);
  for (const t of g.targets) {
    console.log(`${pad}  ${t.name} (${t.host})${t.rrdFile ? `  <- ${t.rrdFile}` : "  (no history)"}`);
  }
  for (const c of g.groups) printGroup(c, depth + 1);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configText = await fs.readFile(args.config!, "utf8");
  const rrdFiles = args.data ? await listRrdFiles(args.data) : [];
  const plan = buildImportPlan(configText, rrdFiles);

  plan.groups.forEach((g) => printGroup(g, 0));
  for (const t of plan.targets) console.log(`${t.name} (${t.host})${t.rrdFile ? `  <- ${t.rrdFile}` : ""}`);
  for (const s of plan.skipped) console.log(`skip ${s.path}: ${s.reason}`);
  for (const f of plan.unmatchedRrdFiles) console.log(`unused RRD (not in config): ${f}`);
  for (const w of plan.warnings) console.log(`warning: ${w}`);
  if (args.dryRun) return;

  const applied = await applyImportPlan(plan);
  const created = applied.targets.filter((t) => t.created).length;
  console.log(
    `\nGroups: ${applied.groupsCreated} created, ${applied.groupsReused} reused. ` +
      `Targets: ${created} created, ${applied.targets.length - created} reused.`,
  );

  for (const t of applied.targets) {
    if (!t.rrdFile || !args.data) continue;
    try {
      const buf = await fs.readFile(path.join(args.data, t.rrdFile));
      const res = await importRrdHistory(t.targetId, buf, { adoptSettings: t.created });
      const span = res.from ? `${res.from.slice(0, 10)} .. ${res.to!.slice(0, 10)}` : "nothing new";
      console.log(`history ${t.path}: ${res.inserted} rows (${span})`);
    } catch (err) {
      console.error(`history ${t.path}: FAILED - ${(err as Error).message}`);
    }
  }
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
