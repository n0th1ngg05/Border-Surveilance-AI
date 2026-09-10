/**
 * src/routes/health.ts
 * Health check endpoint — no auth required.
 * Checks liveness of all downstream services.
 */

import { Hono } from "hono";
import { getDB } from "../services/db.js";
import { getRedis } from "../services/redis.js";
import { getMQTT } from "../services/mqtt.js";

const router = new Hono();

router.get("/", async (c) => {
  const checks = await Promise.allSettled([
    getDB().query("SELECT 1"),
    getRedis().ping(),
  ]);

  let mqttOk = false;
  try { getMQTT(); mqttOk = true; } catch { /* not connected */ }

  const [dbResult, redisResult] = checks;

  const status = {
    service:   "SIH-26187 Backend",
    timestamp: new Date().toISOString(),
    uptime:    Math.floor(process.uptime()),
    services: {
      postgres: dbResult.status    === "fulfilled" ? "ok" : "error",
      redis:    redisResult.status === "fulfilled" ? "ok" : "error",
      mqtt:     mqttOk ? "ok" : "error",
    },
  };

  const allOk = Object.values(status.services).every((s) => s === "ok");
  return c.json(status, allOk ? 200 : 503);
});

export default router;
