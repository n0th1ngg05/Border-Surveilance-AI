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
import type { Server } from "node:http";
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
import aiEventRoutes  from "./src/routes/aiEvent.js";

import demoRoutes     from "./src/routes/demo.js";
import { bootstrapDemoDatabase, startDemoSimulation } from "./src/services/demoMode.js";
import { spawn } from "node:child_process";

// ── App ─────────────────────────────────────────────────────────────────────
const app = new Hono();

// ── Global middleware ────────────────────────────────────────────────────────
app.use("*", requestId());       // X-Request-Id on every response
app.use("*", secureHeaders());   // security headers (CSP, HSTS, etc.)
app.use("*", honoLogger());
app.use("*", cors({ origin: config.NODE_ENV === "production" ? [] : "*" }));
app.use("*", prettyJSON());

// ── Static frontend ──────────────────────────────────────────────────────────
app.use("/",         serveStatic({ root: "./frontend" }));
app.use("/css/*",    serveStatic({ root: "./frontend" }));
app.use("/js/*",     serveStatic({ root: "./frontend" }));
app.use("/assets/*", serveStatic({ root: "./frontend" }));
// Serve the video files from app/videos
app.use("/videos/*", serveStatic({ root: "./videos", rewriteRequestPath: (p) => p.replace(/^\/videos/, "") }));

// ── RTSP → MJPEG proxy for IP camera (cam-06) ───────────────────────────────
// Browsers cannot play rtsp:// natively, so we use FFmpeg to transcode the
// RTSP stream into an MJPEG multipart stream that any <img> tag can consume.
const RTSP_URL  = "rtsp://user:user@192.168.1.110:554/cam/realmonitor";
const BOUNDARY  = "viewframe";

app.get("/stream/cam-06", (c) => {
  c.header("Content-Type", `multipart/x-mixed-replace; boundary=${BOUNDARY}`);
  c.header("Cache-Control", "no-cache, no-store");
  c.header("Connection", "keep-alive");

  const ffmpeg = spawn("ffmpeg", [
    "-rtsp_transport", "tcp",
    "-i",              RTSP_URL,
    "-vf",             "scale=960:540",          // downscale for bandwidth
    "-q:v",            "5",                       // JPEG quality 1=best 31=worst
    "-f",              "mpjpeg",
    "-boundary_tag",   BOUNDARY,
    "-an",                                        // no audio
    "pipe:1",
  ], { stdio: ["ignore", "pipe", "ignore"] });

  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  ffmpeg.stdout.on("data", (chunk: Buffer) => {
    writer.write(chunk).catch(() => ffmpeg.kill());
  });
  ffmpeg.on("close", () => writer.close().catch(() => {}));

  // Kill FFmpeg when the client disconnects
  c.req.raw.signal?.addEventListener("abort", () => { ffmpeg.kill(); });

  return new Response(readable as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": `multipart/x-mixed-replace; boundary=${BOUNDARY}`,
      "Cache-Control": "no-cache, no-store",
      "Connection":    "keep-alive",
    },
  });
});

// ── Public routes ────────────────────────────────────────────────────────────
app.route("/api/auth",     authRoutes);
app.route("/api/health",   healthRoutes);
app.route("/api/demo",     demoRoutes);
app.route("/api/ai-event", aiEventRoutes);  // Python AI runtime → no auth needed

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

  // ── Demo / Prototype Mode Initialization ─────────────────────────────────
  if (config.DEMO_MODE) {
    logger.info("🎯 DEMO_MODE=true: Bootstrapping prototype data & live event simulation...");
    await bootstrapDemoDatabase();
    startDemoSimulation();
  }

  // BUG FIX: attachWebSocket(httpServer) was previously called on a bare
  // createServer() instance that was never listen()'d — @hono/node-server's
  // serve() spins up its OWN separate http.Server under the hood and that
  // second, unrelated server is the one actually bound to config.PORT.
  // Socket.IO was therefore live but unreachable: no client could ever
  // connect, and /socket.io/socket.io.js 404'd through Hono's static/404
  // handler (returned as JSON, hence the MIME-type console error).
  // Fix: serve() returns the real underlying http.Server — attach
  // Socket.IO to THAT instance instead of creating a second one.
  httpServer = serve({ fetch: app.fetch, port: config.PORT, serverOptions: {} }, () => {
    logger.info(`\n🚀 Server running → http://localhost:${config.PORT}`);
    logger.info(`📺 Dashboard      → http://localhost:${config.PORT}/`);
    logger.info(`📡 API            → http://localhost:${config.PORT}/api`);
    logger.info(`🔌 WebSocket      → ws://localhost:${config.PORT}\n`);
  }) as unknown as Server;

  attachWebSocket(httpServer);
  logger.info("[5/5] ✅ WebSocket server attached");
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