import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { groups, targets } from "../db/schema.js";
import { eq } from "drizzle-orm";

const groupInput = z.object({
  name: z.string().min(1),
  parentId: z.number().int().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

interface GroupNode {
  id: number;
  name: string;
  parentId: number | null;
  sortOrder: number;
  children: GroupNode[];
  targets: { id: number; name: string; host: string; enabled: boolean }[];
}

export async function groupRoutes(app: FastifyInstance) {
  // Nested group + target tree for the sidebar
  app.get("/api/groups", async () => {
    const allGroups = await db.select().from(groups).orderBy(groups.sortOrder, groups.name);
    const allTargets = await db
      .select({
        id: targets.id,
        name: targets.name,
        host: targets.host,
        enabled: targets.enabled,
        groupId: targets.groupId,
        sortOrder: targets.sortOrder,
      })
      .from(targets)
      .orderBy(targets.sortOrder, targets.name);

    const nodeById = new Map<number, GroupNode>();
    for (const g of allGroups) {
      nodeById.set(g.id, {
        id: g.id,
        name: g.name,
        parentId: g.parentId,
        sortOrder: g.sortOrder,
        children: [],
        targets: [],
      });
    }

    const roots: GroupNode[] = [];
    for (const node of nodeById.values()) {
      if (node.parentId !== null && nodeById.has(node.parentId)) {
        nodeById.get(node.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    }

    const ungrouped: GroupNode["targets"] = [];
    for (const t of allTargets) {
      if (t.groupId !== null && nodeById.has(t.groupId)) {
        nodeById.get(t.groupId)!.targets.push(t);
      } else {
        ungrouped.push(t);
      }
    }

    return { groups: roots, ungroupedTargets: ungrouped };
  });

  app.post("/api/groups", async (req, reply) => {
    const body = groupInput.parse(req.body);
    const [created] = await db.insert(groups).values(body).returning();
    return reply.code(201).send(created);
  });

  app.put("/api/groups/:id", async (req) => {
    const id = Number((req.params as { id: string }).id);
    const body = groupInput.partial().parse(req.body);
    const [updated] = await db.update(groups).set(body).where(eq(groups.id, id)).returning();
    return updated;
  });

  app.delete("/api/groups/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    // Ungroup children groups/targets rather than cascade-deleting their data.
    await db.update(groups).set({ parentId: null }).where(eq(groups.parentId, id));
    await db.update(targets).set({ groupId: null }).where(eq(targets.groupId, id));
    await db.delete(groups).where(eq(groups.id, id));
    return reply.code(204).send();
  });
}
