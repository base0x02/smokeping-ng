import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { buildImportPlan } from "../smokeping/config.js";
import { applyImportPlan, importRrdHistory } from "../smokeping/importer.js";

const planInput = z.object({
  /** Contents of SmokePing's Targets file (or a whole config). */
  config: z.string().min(1),
  /** Relative paths of the RRD files the user selected, e.g. "data/USA/MIT.rrd". */
  rrdFiles: z.array(z.string()).optional(),
});

// A SmokePing RRD is ~3 MB with default RRAs; leave room for longer retention.
const RRD_BODY_LIMIT = 256 * 1024 * 1024;

export async function smokepingImportRoutes(app: FastifyInstance) {
  app.addContentTypeParser("application/octet-stream", { parseAs: "buffer", bodyLimit: RRD_BODY_LIMIT }, (_req, body, done) =>
    done(null, body),
  );

  // Dry run: what would be created and which RRD feeds which target.
  app.post("/api/import/smokeping/plan", async (req) => {
    const body = planInput.parse(req.body);
    return buildImportPlan(body.config, body.rrdFiles);
  });

  app.post("/api/import/smokeping/apply", async (req) => {
    const body = planInput.parse(req.body);
    const plan = buildImportPlan(body.config, body.rrdFiles);
    return applyImportPlan(plan);
  });

  // Body is the raw .rrd file. One request per file keeps uploads small and lets the UI show progress.
  app.post("/api/import/smokeping/history/:targetId", { bodyLimit: RRD_BODY_LIMIT }, async (req, reply) => {
    const targetId = Number((req.params as { targetId: string }).targetId);
    const { adoptSettings } = req.query as { adoptSettings?: string };
    if (!Buffer.isBuffer(req.body)) {
      return reply.code(400).send({ error: "Send the .rrd file as application/octet-stream" });
    }
    try {
      return await importRrdHistory(targetId, req.body, { adoptSettings: adoptSettings === "1" });
    } catch (err) {
      return reply.code(400).send({ error: (err as Error).message });
    }
  });
}
