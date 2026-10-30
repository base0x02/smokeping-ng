import type { GroupNode } from "../api/client.js";

export interface FlatGroup {
  id: number;
  name: string;
  depth: number;
  parentId: number | null;
}

export function flattenGroups(nodes: GroupNode[], depth = 0): FlatGroup[] {
  return nodes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((n) => [
      { id: n.id, name: n.name, depth, parentId: n.parentId },
      ...flattenGroups(n.children, depth + 1),
    ]);
}

export interface TargetSection {
  key: string;
  /** Group path, e.g. "Europe / Germany". */
  title: string;
  groupId: number | null;
  targetIds: number[];
}

function allTargetIds(n: GroupNode): number[] {
  return [...n.targets.map((t) => t.id), ...n.children.flatMap(allTargetIds)];
}

/**
 * One section per group that holds targets, depth-first in sidebar order.
 * Groups at `maxDepth` (1 = top level) take in all their descendants' targets,
 * so deeper subgroups don't get sections of their own.
 */
export function sectionsFromTree(nodes: GroupNode[], maxDepth = Infinity, path: string[] = []): TargetSection[] {
  return nodes
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .flatMap((n) => {
      const title = [...path, n.name];
      const atLimit = title.length >= maxDepth;
      const targetIds = atLimit ? allTargetIds(n) : n.targets.map((t) => t.id);
      const own: TargetSection[] = targetIds.length
        ? [{ key: `g${n.id}`, title: title.join(" / "), groupId: n.id, targetIds }]
        : [];
      return atLimit ? own : [...own, ...sectionsFromTree(n.children, maxDepth, title)];
    });
}
