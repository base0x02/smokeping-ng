import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { groupRoutes } from "./api/groups.js";
import { targetRoutes } from "./api/targets.js";
import { measurementRoutes } from "./api/measurements.js";
import { jobRoutes } from "./api/jobs.js";
import { startScheduler } from "./scheduler/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT ?? 4000);

async function main() {
  const app = Fastify({ logger: true });

  await app.register(cors, { origin: true });
  await app.register(groupRoutes);
  await app.register(targetRoutes);
  await app.register(measurementRoutes);
  await app.register(jobRoutes);

  const publicDir = path.join(__dirname, "public");
  await app.register(fastifyStatic, {
    root: publicDir,
    wildcard: false,
  });

  // SPA fallback for client-side routing (skip API routes and static asset misses)
  app.setNotFoundHandler(async (req, reply) => {
    if (req.raw.url?.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html", publicDir);
  });

  startScheduler();

  await app.listen({ port: PORT, host: "0.0.0.0" });
  console.log(`smokeping-ng listening on :${PORT}`);
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
