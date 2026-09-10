/**
 * src/controllers/alertsController.ts
 * Read + acknowledge + dismiss alerts.
 * Alerts are created by the AI pipeline (via redisSubscriber), not by the client.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseQuery } from "../utils/validate.js";
import { query } from "../services/db.js";
import { NotFoundError, ForbiddenError } from "../utils/errors.js";
import { paginated } from "../models/index.js";
import type { Alert } from "../models/index.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

const ListQuerySchema = z.object({
  page:      z.coerce.number().int().min(1).default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  level:     z.enum(["HIGH", "MEDIUM", "LOW", "INFO"]).optional(),
  status:    z.enum(["open", "acknowledged", "dismissed"]).optional(),
  camera_id: z.string().uuid().optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function listAlerts(c: Context): Promise<Response> {
  const { page, limit, level, status, camera_id } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  // Build dynamic WHERE conditions
  const conditions: string[] = [];
  const values: unknown[]    = [];

  if (level)     { conditions.push(`level = $${values.push(level)}`); }
  if (status)    { conditions.push(`status = $${values.push(status)}`); }
  if (camera_id) { conditions.push(`camera_id = $${values.push(camera_id)}`); }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: data } = await query<Alert>(
    `SELECT * FROM alerts ${where} ORDER BY created_at DESC LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}`,
    values,
  );

  const countValues = values.slice(0, -2); // exclude LIMIT/OFFSET
  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM alerts ${where}`,
    countValues,
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getAlert(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<Alert>(
    "SELECT * FROM alerts WHERE id = $1",
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Alert", id);
  return c.json({ data: rows[0] });
}

export async function acknowledgeAlert(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const user = c.get("user");

  const { rows: existing } = await query<Alert>(
    "SELECT id, status FROM alerts WHERE id = $1",
    [id],
  );

  if (!existing[0]) throw new NotFoundError("Alert", id);

  if (existing[0].status === "dismissed") {
    throw new ForbiddenError("Cannot acknowledge a dismissed alert");
  }

  const { rows } = await query<Alert>(
    `UPDATE alerts
     SET status = 'acknowledged', acknowledged_by = $2, updated_at = NOW()
     WHERE id = $1
     RETURNING *`,
    [id, user.sub],
  );

  return c.json({ data: rows[0] });
}

export async function dismissAlert(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const user = c.get("user");

  // Only admins and operators can dismiss
  if (user.role === "viewer") {
    throw new ForbiddenError("Viewers cannot dismiss alerts");
  }

  const { rowCount } = await query(
    `UPDATE alerts SET status = 'dismissed', updated_at = NOW() WHERE id = $1`,
    [id],
  );

  if (!rowCount) throw new NotFoundError("Alert", id);
  return c.json({ message: `Alert ${id} dismissed` });
}
