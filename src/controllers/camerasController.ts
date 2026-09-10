/**
 * src/controllers/camerasController.ts
 * CRUD for registered CCTV cameras.
 * Each camera is tied to an RTSP URL and a physical location.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseBody, parseQuery } from "../utils/validate.js";
import { query } from "../services/db.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { paginated } from "../models/index.js";
import type { Camera } from "../models/index.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

const CameraBodySchema = z.object({
  name:     z.string().min(1).max(100),
  rtsp_url: z.string().url("Must be a valid RTSP/HTTP URL"),
  location: z.string().min(1).max(255),
  zone_id:  z.string().uuid().nullable().optional(),
});

const ListQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(["active", "inactive", "error"]).optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function listCameras(c: Context): Promise<Response> {
  const { page, limit, status } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  const whereClause = status ? "WHERE status = $3" : "";
  const values: unknown[] = status
    ? [limit, offset, status]
    : [limit, offset];

  const { rows: data } = await query<Camera>(
    `SELECT id, name, rtsp_url, location, zone_id, status, created_at, updated_at
     FROM cameras
     ${whereClause}
     ORDER BY name ASC
     LIMIT $1 OFFSET $2`,
    values,
  );

  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM cameras ${whereClause}`,
    status ? [status] : [],
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getCamera(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<Camera>(
    `SELECT id, name, rtsp_url, location, zone_id, status, created_at, updated_at
     FROM cameras WHERE id = $1`,
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Camera", id);
  return c.json({ data: rows[0] });
}

export async function addCamera(c: Context): Promise<Response> {
  const body = await parseBody(c, CameraBodySchema);

  // Check for duplicate RTSP URL
  const { rows: existing } = await query<{ id: string }>(
    "SELECT id FROM cameras WHERE rtsp_url = $1 LIMIT 1",
    [body.rtsp_url],
  );
  if (existing[0]) {
    throw new ConflictError(`A camera with this RTSP URL is already registered (id: ${existing[0].id})`);
  }

  const { rows } = await query<Camera>(
    `INSERT INTO cameras (name, rtsp_url, location, zone_id, status)
     VALUES ($1, $2, $3, $4, 'inactive')
     RETURNING *`,
    [body.name, body.rtsp_url, body.location, body.zone_id ?? null],
  );

  return c.json({ data: rows[0] }, 201);
}

export async function updateCamera(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const body = await parseBody(c, CameraBodySchema.partial());

  const { rows: existing } = await query<Camera>(
    "SELECT id FROM cameras WHERE id = $1",
    [id],
  );
  if (!existing[0]) throw new NotFoundError("Camera", id);

  const { rows } = await query<Camera>(
    `UPDATE cameras
     SET name     = COALESCE($1, name),
         rtsp_url = COALESCE($2, rtsp_url),
         location = COALESCE($3, location),
         zone_id  = COALESCE($4, zone_id),
         updated_at = NOW()
     WHERE id = $5
     RETURNING *`,
    [body.name, body.rtsp_url, body.location, body.zone_id, id],
  );

  return c.json({ data: rows[0] });
}

export async function deleteCamera(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rowCount } = await query(
    "DELETE FROM cameras WHERE id = $1",
    [id],
  );

  if (!rowCount) throw new NotFoundError("Camera", id);
  return c.json({ message: `Camera ${id} deleted` });
}
