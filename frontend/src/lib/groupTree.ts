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
