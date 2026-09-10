/**
 * src/websocket/index.ts
 * Socket.IO WebSocket server.
 * Attached to the Node HTTP server in boot.ts.
 * Pushes real-time AI events to the operator dashboard.
 *
 * Events emitted to clients:
 *  - event:human    → human/troop detection events
 *  - event:vehicle  → vehicle/ANPR events
 *  - event:fence    → virtual fence intrusion events
 *  - alert          → high-priority alerts
 *  - ping           → keep-alive
 */

import { Server, type Socket } from "socket.io";
import type { Server as HTTPServer } from "node:http";
import { logger } from "../utils/logger.js";

let io: Server | null = null;

export function attachWebSocket(httpServer: HTTPServer): Server {
  io = new Server(httpServer, {
    cors: { origin: "*", methods: ["GET", "POST"] },
    transports: ["websocket", "polling"],
  });

  io.on("connection", async (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Dashboard client connected");

    // If in demo mode, immediately emit initial system state to newly connected client
    try {
      const { demoStore } = await import("../services/demoMode.js");
      socket.emit("demo:init", demoStore);
    } catch {
      // ignore
    }

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Dashboard client disconnected");
    });

    // Keep-alive ping
    socket.on("ping", () => socket.emit("pong"));
  });

  return io;
}

export function getIO(): Server {
  if (!io) throw new Error("WebSocket not initialised — call attachWebSocket() first");
  return io;
}
