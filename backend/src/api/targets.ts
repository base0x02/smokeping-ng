import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { db } from "../db/client.js";
import { targets, measurements } from "../db/schema.js";
import { eq } from "drizzle-orm";

const targetInput = z.object({
  name: z.string().min(1),
  host: z.string().min(1),
  groupId: z.number().int().nullable().optional(),
  enabled: z.boolean().optional(),
  pingCount: z.number().int().min(1).max(100).optional(),
  intervalSeconds: z.number().int().min(60).optional(),
  sortOrder: z.number().int().optional(),
});

export async function targetRoutes(app: FastifyInstance) {
  app.get("/api/targets", async (req) => {
    const query = req.query as { groupId?: string };
    if (query.groupId) {
      return db.select().from(targets).where(eq(targets.groupId, Number(query.groupId)));
    }
    return db.select().from(targets).orderBy(targets.sortOrder, targets.name);
  });

  app.get("/api/targets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const [target] = await db.select().from(targets).where(eq(targets.id, id));
    if (!target) return reply.code(404).send({ error: "Target not found" });
    return target;
  });

  app.post("/api/targets", async (req, reply) => {
    const body = targetInput.parse(req.body);
    const [created] = await db.insert(targets).values(body).returning();
    return reply.code(201).send(created);
  });

  app.put("/api/targets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    const body = targetInput.partial().parse(req.body);
    const [updated] = await db.update(targets).set(body).where(eq(targets.id, id)).returning();
    if (!updated) return reply.code(404).send({ error: "Target not found" });
    return updated;
  });

  app.delete("/api/targets/:id", async (req, reply) => {
    const id = Number((req.params as { id: string }).id);
    await db.delete(measurements).where(eq(measurements.targetId, id));
    await db.delete(targets).where(eq(targets.id, id));
    return reply.code(204).send();
  });
}
