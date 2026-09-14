/**
 * src/routes/aiEvent.ts
 *
 * POST /api/ai-event
 *
 * Receives detection payloads from the Python AI runtime (no Redis).
 * Immediately fans out over Socket.IO to all connected dashboard clients.
 * Also pushes high-severity events into demoStore.alerts for the REST feed.
 *
 * Payload shape (from python runtime):
 * {
 *   pipeline:    "human" | "vehicle" | "alert"
 *   camera_id:   string
 *   camera_name: string
 *   frame_index: number
 *   frame_width: number
 *   frame_height: number
 *   detections:  Array<{ bbox: [x1,y1,x2,y2], confidence: number, label: string, tactical_type?: string }>
 *   verified:    boolean
 *   entity_id:   string
 *   message:     string
 *   // alert-only
 *   level?:      "HIGH" | "MEDIUM" | "LOW"
 *   module?:     "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE"
 * }
 */

import { Hono } from "hono";
import { getIO } from "../websocket/index.js";
import { demoStore } from "../services/demoMode.js";
import { logger } from "../utils/logger.js";

const router = new Hono();

router.post("/", async (c) => {
  let payload: Record<string, unknown>;

  try {
    payload = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const pipeline = payload["pipeline"] as string | undefined;

  if (!pipeline) {
    return c.json({ error: "Missing pipeline field" }, 400);
  }

  try {
    const io = getIO();

    switch (pipeline) {
      case "human":
        io.emit("event:human", payload);
        logger.debug(
          { cameraId: payload["camera_id"], frameIndex: payload["frame_index"] },
          "Human event forwarded to dashboard"
        );
        break;

      case "vehicle":
        io.emit("event:vehicle", payload);
        logger.debug(
          { cameraId: payload["camera_id"], entityId: payload["entity_id"] },
          "Vehicle event forwarded to dashboard"
        );
        break;

      case "alert": {
        // Forward over WebSocket
        io.emit("alert", payload);

        // Also persist into demoStore so REST /api/demo/summary includes it
        const alertEntry = {
          id:          `ai-${Date.now().toString().slice(-6)}`,
          level:       (payload["level"] as "HIGH" | "MEDIUM" | "LOW") ?? "MEDIUM",
          module:      (payload["module"] as "HUMAN" | "VEHICLE" | "VIRTUAL_FENCE") ??
                       (pipeline === "human" ? "HUMAN" : "VEHICLE"),
          message:     String(payload["message"] ?? "AI detection alert"),
          cameraName:  String(payload["camera_name"] ?? "Unknown Camera"),
          zoneName:    undefined,
          entityId:    String(payload["entity_id"] ?? ""),
          status:      "open" as const,
          timestamp:   new Date().toLocaleTimeString(),
        };

        demoStore.alerts.unshift(alertEntry);
        // Keep alert list bounded to last 50 AI events
        if (demoStore.alerts.length > 50) demoStore.alerts.length = 50;

        // Update intrusion counter for HIGH-level events
        if (alertEntry.level === "HIGH") {
          demoStore.stats.intrusionsBlocked += 1;
        }

        logger.warn(
          { level: alertEntry.level, cameraId: payload["camera_id"] },
          "AI alert received and forwarded"
        );
        break;
      }

      default:
        logger.warn({ pipeline }, "Unknown pipeline type in ai-event — ignored");
        return c.json({ error: `Unknown pipeline: ${pipeline}` }, 400);
    }
  } catch (err) {
    // WebSocket not yet initialised — still OK to accept the payload
    logger.warn({ err }, "WebSocket unavailable — ai-event accepted but not forwarded");
  }

  return c.json({ ok: true, pipeline });
});

export default router;
