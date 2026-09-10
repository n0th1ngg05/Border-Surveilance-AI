/**
 * boot.ts — Central entry point for SIH-26187 backend.
 *
 * Startup sequence:
 *  1. Load + validate environment variables
 *  2. Initialise logger
 *  3. Connect to PostgreSQL (with retry)
 *  4. Connect to Redis
 *  5. Connect to MQTT broker
 *  6. Start Redis subscriber (AI event bridge)
 *  7. Boot Hono HTTP server + mount all routes
 *  8. Attach Socket.IO WebSocket server
 *  9. Register graceful shutdown handlers
 */

import "dotenv/config";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createServer, type Server } from "node:http";
import { Hono } from "hono";
import { logger as honoLogger } from "hono/logger";
import { cors } from "hono/cors";
import { prettyJSON } from "hono/pretty-json";
import { requestId } from "hono/request-id";
import { secureHeaders } from "hono/secure-headers";

import { logger } from "./src/utils/logger.js";
import { config } from "./src/config/index.js";
import { connectDB, closeDB } from "./src/services/db.js";
import { connectRedis, closeRedis } from "./src/services/redis.js";
import { connectMQTT, closeMQTT } from "./src/services/mqtt.js";
import { startRedisSubscriber } from "./src/services/redisSubscriber.js";
import { attachWebSocket } from "./src/websocket/index.js";

import { errorHandler } from "./src/middleware/errorHandler.js";
import { authMiddleware } from "./src/middleware/auth.js";

import cameraRoutes   from "./src/routes/cameras.js";
import alertRoutes    from "./src/routes/alerts.js";
import eventRoutes    from "./src/routes/events.js";
import personnelRoutes from "./src/routes/personnel.js";
import vehicleRoutes  from "./src/routes/vehicles.js";
import zoneRoutes     from "./src/routes/zones.js";
import authRoutes     from "./src/routes/auth.js";
import healthRoutes   from "./src/routes/health.js";

import demoRoutes     from "./src/routes/demo.js";
import { bootstrapDemoDatabase, startDemoSimulation } from "./src/services/demoMode.js";

// ── App ─────────────────────────────────────────────────────────────────────
const app = new Hono();

// ── Global middleware ────────────────────────────────────────────────────────
app.use("*", requestId());       // X-Request-Id on every response
app.use("*", secureHeaders());   // security headers (CSP, HSTS, etc.)
app.use("*", honoLogger());
app.use("*", cors({ origin: config.NODE_ENV === "production" ? [] : "*" }));
app.use("*", prettyJSON());

// ── Static frontend ──────────────────────────────────────────────────────────
app.use("/",      serveStatic({ root: "./frontend" }));
app.use("/css/*", serveStatic({ root: "./frontend" }));
app.use("/js/*",  serveStatic({ root: "./frontend" }));

// ── Public routes ────────────────────────────────────────────────────────────
app.route("/api/auth",   authRoutes);
app.route("/api/health", healthRoutes);
app.route("/api/demo",   demoRoutes);

// ── Protected routes ─────────────────────────────────────────────────────────
app.use("/api/*", authMiddleware);
app.route("/api/cameras",   cameraRoutes);
app.route("/api/alerts",    alertRoutes);
app.route("/api/events",    eventRoutes);
app.route("/api/personnel", personnelRoutes);
app.route("/api/vehicles",  vehicleRoutes);
app.route("/api/zones",     zoneRoutes);

// ── Error + 404 ──────────────────────────────────────────────────────────────
app.onError(errorHandler);
app.notFound((c) =>
  c.json({ error: "Route not found", code: "NOT_FOUND", path: c.req.path }, 404),
);

// ── Bootstrap ────────────────────────────────────────────────────────────────
let httpServer: Server | null = null;

async function boot(): Promise<void> {
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  logger.info(" SIH-26187 | RootError | Border Surveillance System");
  logger.info(`  ENV: ${config.NODE_ENV}  |  PORT: ${config.PORT}`);
  logger.info("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  try {
    await connectDB(2, 500);
    logger.info("[1/5] ✅ PostgreSQL connected");
  } catch {
    logger.warn("[1/5] ⚠️ PostgreSQL connection failed — database features will be offline until DB is configured");
  }

  try {
    await connectRedis();
    logger.info("[2/5] ✅ Redis connected");
    await startRedisSubscriber();
    logger.info("[3/5] ✅ Redis subscriber active");
  } catch {
    logger.warn("[2/5] ⚠️ Redis offline — real-time AI Pub/Sub disabled");
  }

  try {
    await connectMQTT();
    logger.info("[4/5] ✅ MQTT broker connected");
  } catch {
    logger.warn("[4/5] ⚠️ MQTT offline — physical edge alerts disabled");
  }

  httpServer = createServer();
  attachWebSocket(httpServer);
  logger.info("[5/5] ✅ WebSocket server attached");

  // ── Demo / Prototype Mode Initialization ─────────────────────────────────
  if (config.DEMO_MODE) {
    logger.info("🎯 DEMO_MODE=true: Bootstrapping prototype data & live event simulation...");
    await bootstrapDemoDatabase();
    startDemoSimulation();
  }

  serve({ fetch: app.fetch, port: config.PORT, serverOptions: {} }, () => {
    logger.info(`\n🚀 Server running → http://localhost:${config.PORT}`);
    logger.info(`📺 Dashboard      → http://localhost:${config.PORT}/`);
    logger.info(`📡 API            → http://localhost:${config.PORT}/api`);
    logger.info(`🔌 WebSocket      → ws://localhost:${config.PORT}\n`);
  });
}

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info(`\n${signal} received — shutting down gracefully...`);

  if (httpServer) {
    httpServer.close(() => logger.info("HTTP server closed"));
  }

  await Promise.allSettled([
    closeDB().then(() => logger.info("PostgreSQL closed")),
    closeRedis().then(() => logger.info("Redis closed")),
    closeMQTT().then(() => logger.info("MQTT closed")),
  ]);

  logger.info("Shutdown complete. Goodbye.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));

process.on("uncaughtException", (err) => {
  logger.fatal({ err }, "Uncaught exception — shutting down");
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.fatal({ reason }, "Unhandled promise rejection — shutting down");
  process.exit(1);
});

boot().catch((err) => {
  logger.fatal({ err }, "❌ Boot failed");
  process.exit(1);
});
