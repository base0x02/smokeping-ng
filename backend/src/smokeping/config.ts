/**
 * Parser for SmokePing's Targets config (the `*** Targets ***` section, or a
 * file holding just that section), plus planning of how its tree maps onto our
 * groups and targets.
 *
 * SmokePing nodes are `+`/`++`/`+++` sections with `key = value` variables. A
 * node with `host` is a target; a node with children becomes a group. `probe`
 * is inherited down the tree, and only fping-based probes are importable since
 * that is the only probe we run.
 */

export interface ConfigNode {
  id: string;
  level: number;
  vars: Record<string, string>;
  children: ConfigNode[];
}

export interface ParsedConfig {
  root: ConfigNode;
  /** Defaults from a `*** Database ***` section when a full config was given. */
  pings: number | null;
  step: number | null;
  warnings: string[];
}

const SECTION_RE = /^\*\*\*\s*(\w+)\s*\*\*\*$/;
const NODE_RE = /^(\++)\s*(\S+)$/;
const VAR_RE = /^([\w-]+)\s*=\s*(.*)$/;

export function parseSmokepingConfig(text: string): ParsedConfig {
  const warnings: string[] = [];
  const root: ConfigNode = { id: "", level: 0, vars: {}, children: [] };
  const stack: ConfigNode[] = [root];
  const database: Record<string, string> = {};

  // Join backslash continuations, then walk logical lines.
  const lines = text.replace(/\r\n?/g, "\n").replace(/\\\n\s*/g, " ").split("\n");
  const hasSections = lines.some((l) => SECTION_RE.test(l.trim()));
  let section = hasSections ? "" : "Targets";

  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line || line.startsWith("#")) return;

    const sectionMatch = SECTION_RE.exec(line);
    if (sectionMatch) {
      section = sectionMatch[1];
      return;
    }
    if (line.startsWith("@include")) {
      if (section === "Targets") warnings.push(`Line ${i + 1}: @include is not supported, paste the included file's contents instead`);
      return;
    }

    if (section === "Database") {
      const m = VAR_RE.exec(line);
      if (m) database[m[1]] = m[2].trim();
      return;
    }
    if (section !== "Targets") return;

    const nodeMatch = NODE_RE.exec(line);
    if (nodeMatch) {
      const level = nodeMatch[1].length;
      while (stack.length > level) stack.pop();
      if (stack.length < level) {
        warnings.push(`Line ${i + 1}: "${line}" skips a nesting level; attached to the nearest parent`);
      }
      const node: ConfigNode = { id: nodeMatch[2], level, vars: {}, children: [] };
      stack[stack.length - 1].children.push(node);
      stack.push(node);
      return;
    }

    const varMatch = VAR_RE.exec(line);
    if (varMatch) {
      stack[stack.length - 1].vars[varMatch[1]] = varMatch[2].trim();
      return;
    }
    warnings.push(`Line ${i + 1}: could not parse "${line}"`);
  });

  const num = (v: string | undefined) => (v && /^\d+$/.test(v) ? Number(v) : null);
  return { root, pings: num(database.pings), step: num(database.step), warnings };
}

export interface PlanTarget {
  /** SmokePing node path, e.g. "Region/Country/Example_Site" - also its RRD path. */
  path: string;
  name: string;
  host: string;
  /** Matching file from the supplied RRD list, if any. */
  rrdFile: string | null;
}

export interface PlanGroup {
  path: string;
  name: string;
  groups: PlanGroup[];
  targets: PlanTarget[];
}

export interface ImportPlan {
  groups: PlanGroup[];
  /** Top-level nodes that are targets themselves. */
  targets: PlanTarget[];
  skipped: { path: string; reason: string }[];
  unmatchedRrdFiles: string[];
  defaults: { pingCount: number; intervalSeconds: number };
  warnings: string[];
}

const DEFAULT_PINGS = 20;
const DEFAULT_STEP = 300;

function isPingProbe(probe: string): boolean {
  return /^FPing/i.test(probe);
}

/** Normalize an uploaded path (browser folder pick or CLI walk) to forward slashes. */
function normalizePath(p: string): string {
  return p.replace(/\\/g, "/").replace(/^\.?\/+/, "");
}

export function buildImportPlan(text: string, rrdFiles: string[] = []): ImportPlan {
  const config = parseSmokepingConfig(text);
  const skipped: ImportPlan["skipped"] = [];
  const files = rrdFiles.map(normalizePath).filter((f) => f.toLowerCase().endsWith(".rrd"));
  const used = new Set<string>();

  // Match "a/b/c" to "a/b/c.rrd", allowing any prefix directory (e.g. "data/").
  const findRrd = (path: string): string | null => {
    const want = `${path}.rrd`;
    const hits = files.filter((f) => f === want || f.endsWith(`/${want}`));
    if (hits.length === 0) return null;
    const best = hits.sort((a, b) => a.length - b.length)[0];
    used.add(best);
    return best;
  };

  const walk = (node: ConfigNode, parentPath: string, probe: string): PlanGroup | PlanTarget | null => {
    const path = parentPath ? `${parentPath}/${node.id}` : node.id;
    const nodeProbe = node.vars.probe ?? probe;
    if (!isPingProbe(nodeProbe)) {
      skipped.push({ path, reason: `uses the ${nodeProbe} probe; only ping (FPing) targets can be imported` });
      return null;
    }
    const name = (node.vars.menu || node.vars.title || node.id).trim();
    const host = node.vars.host?.trim();

    if (host?.startsWith("/")) {
      skipped.push({ path, reason: "multi-host graph (host = /path ...), not a probed target" });
      return null;
    }
    const target: PlanTarget | null = host ? { path, name, host, rrdFile: findRrd(path) } : null;

    if (node.children.length === 0) {
      if (!target) skipped.push({ path, reason: "has no host and no children" });
      return target;
    }

    const group: PlanGroup = { path, name, groups: [], targets: target ? [target] : [] };
    for (const child of node.children) {
      const res = walk(child, path, nodeProbe);
      if (res && "host" in res) group.targets.push(res);
      else if (res) group.groups.push(res);
    }
    return group;
  };

  const groups: PlanGroup[] = [];
  const targets: PlanTarget[] = [];
  const rootProbe = config.root.vars.probe ?? "FPing";
  for (const child of config.root.children) {
    const res = walk(child, "", rootProbe);
    if (res && "host" in res) targets.push(res);
    else if (res) groups.push(res);
  }

  return {
    groups,
    targets,
    skipped,
    unmatchedRrdFiles: files.filter((f) => !used.has(f)),
    defaults: {
      pingCount: config.pings ?? DEFAULT_PINGS,
      intervalSeconds: config.step ?? DEFAULT_STEP,
    },
    warnings: config.warnings,
  };
}
