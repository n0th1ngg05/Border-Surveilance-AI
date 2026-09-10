/**
 * src/controllers/eventsController.ts
 * Read-only access to the AI event log.
 * Also exports pipeline event handlers used by redisSubscriber.ts.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseQuery } from "../utils/validate.js";
import { query, withTransaction } from "../services/db.js";
import { NotFoundError } from "../utils/errors.js";
import { dispatchAlert } from "../services/alerts.js";
import { paginated } from "../models/index.js";
import type { AIEvent } from "../models/index.js";
import { logger } from "../utils/logger.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  page:    z.coerce.number().int().min(1).default(1),
  limit:   z.coerce.number().int().min(1).max(200).default(50),
  module:  z.enum(["HUMAN", "VEHICLE", "VIRTUAL_FENCE"]).optional(),
  camera:  z.string().optional(),
  level:   z.enum(["HIGH", "MEDIUM", "LOW", "INFO"]).optional(),
  from:    z.string().datetime().optional(),
  to:      z.string().datetime().optional(),
});

// ── REST handlers ─────────────────────────────────────────────────────────────

export async function listEvents(c: Context): Promise<Response> {
  const { page, limit, module: mod, camera, level, from, to } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[]    = [];

  if (mod)    conditions.push(`pipeline_module = $${values.push(mod)}`);
  if (camera) conditions.push(`camera_id = $${values.push(camera)}`);
  if (level)  conditions.push(`alert_level = $${values.push(level)}`);
  if (from)   conditions.push(`timestamp_utc >= $${values.push(from)}`);
  if (to)     conditions.push(`timestamp_utc <= $${values.push(to)}`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: data } = await query<AIEvent>(
    `SELECT * FROM ai_events ${where}
     ORDER BY timestamp_utc DESC
     LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}`,
    values,
  );

  const countValues = values.slice(0, -2);
  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM ai_events ${where}`,
    countValues,
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getEvent(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<AIEvent>(
    "SELECT * FROM ai_events WHERE id = $1",
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Event", id);
  return c.json({ data: rows[0] });
}

// ── AI pipeline event handlers (called by redisSubscriber.ts) ─────────────

/** Validate that a payload from Python has the minimum required fields */
function assertEventPayload(payload: Record<string, unknown>): void {
  const required = ["camera_id", "frame_index", "timestamp_utc", "confidence"];
  for (const key of required) {
    if (payload[key] === undefined) {
      throw new Error(`AI event payload missing required field: '${key}'`);
    }
  }
}

export async function handleHumanEvent(payload: Record<string, unknown>): Promise<void> {
  assertEventPayload(payload);

  await withTransaction(async (client) => {
    const { rows } = await client.query<AIEvent>(
      `INSERT INTO ai_events
         (camera_id, frame_index, timestamp_utc, pipeline_module,
          entity_type, entity_id, confidence, zone_id,
          alert_level, verified, snapshot_path, raw_payload)
       VALUES ($1,$2,$3,'HUMAN','PERSON',$4,$5,$6,$7,$8,$9,$10)
       RETURNING id`,
      [
        payload["camera_id"],
        payload["frame_index"],
        payload["timestamp_utc"],
        payload["entity_id"]  ?? null,
        payload["confidence"],
        payload["zone_id"]    ?? null,
        payload["alert_level"]?? "INFO",
        payload["verified"]   ?? false,
        payload["snapshot_path"] ?? null,
        JSON.stringify(payload),
      ],
    );

    const eventId = rows[0]?.id;
    if (!eventId) throw new Error("Failed to insert human event");

    const isAlert = payload["alert_level"] === "HIGH" || payload["alert_level"] === "MEDIUM";
    if (isAlert) {
      await dispatchAlert({
        alertId:       eventId,
        level:         payload["alert_level"] as "HIGH" | "MEDIUM",
        module:        "HUMAN",
        message:       payload["verified"] === false ? "Unauthorised person detected" : "Person detected",
        cameraId:      String(payload["camera_id"]),
        zoneId:        payload["zone_id"]    ? String(payload["zone_id"])    : undefined,
        entityId:      payload["entity_id"]  ? String(payload["entity_id"])  : undefined,
        snapshotPath:  payload["snapshot_path"] ? String(payload["snapshot_path"]) : undefined,
        timestamp:     String(payload["timestamp_utc"]),
      });
    }
  });

  logger.info({ cameraId: payload["camera_id"], entityId: payload["entity_id"] }, "Human event persisted");
}

export async function handleVehicleEvent(payload: Record<string, unknown>): Promise<void> {
  assertEventPayload(payload);

  await withTransaction(async (client) => {
    const { rows } = await client.query<AIEvent>(
      `INSERT INTO ai_events
         (camera_id, frame_index, timestamp_utc, pipeline_module,
          entity_type, entity_id, confidence, alert_level, verified, snapshot_path, raw_payload)
       VALUES ($1,$2,$3,'VEHICLE','VEHICLE',$4,$5,$6,$7,$8,$9)
       RETURNING id`,
      [
        payload["camera_id"],
        payload["frame_index"],
        payload["timestamp_utc"],
        payload["entity_id"]     ?? null,
        payload["confidence"],
        payload["alert_level"]   ?? "INFO",
        payload["verified"]      ?? false,
        payload["snapshot_path"] ?? null,
        JSON.stringify(payload),
      ],
    );

    const eventId = rows[0]?.id;
    if (!eventId) throw new Error("Failed to insert vehicle event");

    if (payload["alert_level"] === "HIGH" || payload["alert_level"] === "MEDIUM") {
      await dispatchAlert({
        alertId:  eventId,
        level:    payload["alert_level"] as "HIGH" | "MEDIUM",
        module:   "VEHICLE",
        message:  payload["verified"] === false ? "Unregistered vehicle detected" : "Vehicle detected",
        cameraId: String(payload["camera_id"]),
        entityId: payload["entity_id"] ? String(payload["entity_id"]) : undefined,
        timestamp: String(payload["timestamp_utc"]),
      });
    }
  });

  logger.info({ cameraId: payload["camera_id"], plate: payload["entity_id"] }, "Vehicle event persisted");
}

export async function handleFenceEvent(payload: Record<string, unknown>): Promise<void> {
  assertEventPayload(payload);

  if (!payload["zone_id"]) {
    logger.warn({ payload }, "Fence event missing zone_id — discarding");
    return;
  }

  await withTransaction(async (client) => {
    const { rows } = await client.query<AIEvent>(
      `INSERT INTO ai_events
         (camera_id, frame_index, timestamp_utc, pipeline_module,
          entity_type, entity_id, confidence, zone_id,
          alert_level, verified, snapshot_path, raw_payload)
       VALUES ($1,$2,$3,'VIRTUAL_FENCE',$4,$5,$6,$7,$8,false,$9,$10)
       RETURNING id`,
      [
        payload["camera_id"],
        payload["frame_index"],
        payload["timestamp_utc"],
        payload["entity_type"]   ?? "UNKNOWN",
        payload["entity_id"]     ?? null,
        payload["confidence"],
        payload["zone_id"],
        payload["alert_level"]   ?? "HIGH",
        payload["snapshot_path"] ?? null,
        JSON.stringify(payload),
      ],
    );

    const eventId = rows[0]?.id;
    if (!eventId) throw new Error("Failed to insert fence event");

    // Fence intrusions ALWAYS generate an alert
    await dispatchAlert({
      alertId:      eventId,
      level:        (payload["alert_level"] as "HIGH" | "MEDIUM" | "LOW") ?? "HIGH",
      module:       "VIRTUAL_FENCE",
      message:      `Virtual fence intrusion in zone ${payload["zone_id"]}`,
      cameraId:     String(payload["camera_id"]),
      zoneId:       String(payload["zone_id"]),
      entityId:     payload["entity_id"] ? String(payload["entity_id"]) : undefined,
      snapshotPath: payload["snapshot_path"] ? String(payload["snapshot_path"]) : undefined,
      timestamp:    String(payload["timestamp_utc"]),
    });
  });

  logger.warn({ cameraId: payload["camera_id"], zoneId: payload["zone_id"] }, "Fence event persisted");
}
