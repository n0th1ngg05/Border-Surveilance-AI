/**
 * src/controllers/zonesController.ts
 * Virtual fence zone management.
 * On create/update/delete, the new zone config is pushed to the Python
 * AI runtime via Redis so the virtual fence pipeline picks it up live.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseBody, parseQuery } from "../utils/validate.js";
import { query } from "../services/db.js";
import { NotFoundError, BadRequestError } from "../utils/errors.js";
import { paginated } from "../models/index.js";
import type { Zone } from "../models/index.js";
import { getRedis } from "../services/redis.js";
import { logger } from "../utils/logger.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

/** Polygon must have at least 3 points, each being [x, y] */
const PolygonSchema = z
  .array(z.tuple([z.number(), z.number()]))
  .min(3, "A zone polygon requires at least 3 points");

const ZoneBodySchema = z.object({
  camera_id:                z.string().uuid(),
  name:                     z.string().min(1).max(100),
  type:                     z.enum(["RED", "AMBER", "GREEN", "CORRIDOR"]),
  polygon:                  PolygonSchema,
  dwell_threshold_seconds:  z.coerce.number().int().min(0).default(30),
  active_from:              z.string().datetime().nullable().optional(),
  active_until:             z.string().datetime().nullable().optional(),
});

const ListQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  camera_id: z.string().uuid().optional(),
  type:      z.enum(["RED", "AMBER", "GREEN", "CORRIDOR"]).optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Push the full zone config for a camera to Redis so Python picks it up live */
async function pushZoneConfigToRuntime(cameraId: string): Promise<void> {
  try {
    const { rows } = await query<Zone>(
      "SELECT * FROM zones WHERE camera_id = $1",
      [cameraId],
    );
    const redis = getRedis();
    await redis.publish("config:zones", JSON.stringify({ camera_id: cameraId, zones: rows }));
    logger.info({ cameraId, count: rows.length }, "Zone config pushed to AI runtime");
  } catch (err) {
    // Non-fatal — runtime will pick up the new config on next restart
    logger.error({ err, cameraId }, "Failed to push zone config to AI runtime");
  }
}

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function listZones(c: Context): Promise<Response> {
  const { page, limit, camera_id, type } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[]    = [];

  if (camera_id) conditions.push(`camera_id = $${values.push(camera_id)}`);
  if (type)      conditions.push(`type = $${values.push(type)}`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: data } = await query<Zone>(
    `SELECT * FROM zones ${where}
     ORDER BY type ASC, name ASC
     LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}`,
    values,
  );

  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM zones ${where}`,
    values.slice(0, -2),
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getZone(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<Zone>(
    "SELECT * FROM zones WHERE id = $1",
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Zone", id);
  return c.json({ data: rows[0] });
}

export async function createZone(c: Context): Promise<Response> {
  const body = await parseBody(c, ZoneBodySchema);

  // Verify camera exists
  const { rows: cameras } = await query<{ id: string }>(
    "SELECT id FROM cameras WHERE id = $1",
    [body.camera_id],
  );
  if (!cameras[0]) throw new BadRequestError(`Camera '${body.camera_id}' does not exist`);

  // Validate AMBER zones have time constraints
  if (body.type === "AMBER" && (!body.active_from || !body.active_until)) {
    throw new BadRequestError("AMBER zones require both active_from and active_until");
  }

  const { rows } = await query<Zone>(
    `INSERT INTO zones
       (camera_id, name, type, polygon, dwell_threshold_seconds, active_from, active_until)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      body.camera_id,
      body.name,
      body.type,
      JSON.stringify(body.polygon),
      body.dwell_threshold_seconds,
      body.active_from  ?? null,
      body.active_until ?? null,
    ],
  );

  // Notify Python runtime of the new zone
  await pushZoneConfigToRuntime(body.camera_id);

  return c.json({ data: rows[0] }, 201);
}

export async function updateZone(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const body = await parseBody(c, ZoneBodySchema.partial());

  const { rows: existing } = await query<Zone>(
    "SELECT * FROM zones WHERE id = $1",
    [id],
  );
  if (!existing[0]) throw new NotFoundError("Zone", id);

  const { rows } = await query<Zone>(
    `UPDATE zones
     SET name                    = COALESCE($1, name),
         type                    = COALESCE($2, type),
         polygon                 = COALESCE($3, polygon),
         dwell_threshold_seconds = COALESCE($4, dwell_threshold_seconds),
         active_from             = COALESCE($5, active_from),
         active_until            = COALESCE($6, active_until),
         updated_at              = NOW()
     WHERE id = $7
     RETURNING *`,
    [
      body.name,
      body.type,
      body.polygon ? JSON.stringify(body.polygon) : undefined,
      body.dwell_threshold_seconds,
      body.active_from,
      body.active_until,
      id,
    ],
  );

  await pushZoneConfigToRuntime(rows[0]!.camera_id);
  return c.json({ data: rows[0] });
}

export async function deleteZone(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows: existing } = await query<Zone>(
    "SELECT camera_id FROM zones WHERE id = $1",
    [id],
  );
  if (!existing[0]) throw new NotFoundError("Zone", id);

  await query("DELETE FROM zones WHERE id = $1", [id]);

  // Notify runtime to deregister the polygon
  await pushZoneConfigToRuntime(existing[0].camera_id);

  return c.json({ message: `Zone ${id} deleted and runtime notified` });
}
