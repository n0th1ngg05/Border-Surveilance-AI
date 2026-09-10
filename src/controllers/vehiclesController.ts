/**
 * src/controllers/vehiclesController.ts
 * Military vehicle registry — plates detected by ANPR are cross-referenced here.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseBody, parseQuery } from "../utils/validate.js";
import { query } from "../services/db.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { paginated } from "../models/index.js";
import type { Vehicle } from "../models/index.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

const VehicleBodySchema = z.object({
  plate_number:   z.string().min(1).max(20).toUpperCase(),
  vehicle_type:   z.enum(["Combat", "Transport", "Patrol"]),
  classification: z.string().min(1).max(100),  // e.g. "Sedan-Patrol"
  unit:           z.string().min(1).max(100),
});

const ListQuerySchema = z.object({
  page:         z.coerce.number().int().min(1).default(1),
  limit:        z.coerce.number().int().min(1).max(100).default(20),
  vehicle_type: z.enum(["Combat", "Transport", "Patrol"]).optional(),
  unit:         z.string().optional(),
  status:       z.enum(["active", "decommissioned"]).optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function listVehicles(c: Context): Promise<Response> {
  const { page, limit, vehicle_type, unit, status } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[]    = [];

  if (vehicle_type) conditions.push(`vehicle_type = $${values.push(vehicle_type)}`);
  if (unit)         conditions.push(`unit ILIKE $${values.push(`%${unit}%`)}`);
  if (status)       conditions.push(`status = $${values.push(status)}`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: data } = await query<Vehicle>(
    `SELECT id, plate_number, vehicle_type, classification, unit, status, created_at
     FROM vehicles ${where}
     ORDER BY plate_number ASC
     LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}`,
    values,
  );

  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM vehicles ${where}`,
    values.slice(0, -2),
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getVehicle(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<Vehicle>(
    "SELECT * FROM vehicles WHERE id = $1",
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Vehicle", id);
  return c.json({ data: rows[0] });
}

export async function addVehicle(c: Context): Promise<Response> {
  const body = await parseBody(c, VehicleBodySchema);

  const { rows: existing } = await query<{ id: string }>(
    "SELECT id FROM vehicles WHERE plate_number = $1 LIMIT 1",
    [body.plate_number],
  );
  if (existing[0]) {
    throw new ConflictError(`Plate number '${body.plate_number}' is already registered`);
  }

  const { rows } = await query<Vehicle>(
    `INSERT INTO vehicles (plate_number, vehicle_type, classification, unit, status)
     VALUES ($1, $2, $3, $4, 'active')
     RETURNING *`,
    [body.plate_number, body.vehicle_type, body.classification, body.unit],
  );

  return c.json({ data: rows[0] }, 201);
}

export async function updateVehicle(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const body = await parseBody(c, VehicleBodySchema.partial());

  const { rows: existing } = await query<{ id: string }>(
    "SELECT id FROM vehicles WHERE id = $1",
    [id],
  );
  if (!existing[0]) throw new NotFoundError("Vehicle", id);

  const { rows } = await query<Vehicle>(
    `UPDATE vehicles
     SET vehicle_type   = COALESCE($1, vehicle_type),
         classification = COALESCE($2, classification),
         unit           = COALESCE($3, unit),
         updated_at     = NOW()
     WHERE id = $4
     RETURNING *`,
    [body.vehicle_type, body.classification, body.unit, id],
  );

  return c.json({ data: rows[0] });
}

export async function deleteVehicle(c: Context): Promise<Response> {
  const id = c.req.param("id");

  // Soft delete
  const { rowCount } = await query(
    "UPDATE vehicles SET status = 'decommissioned', updated_at = NOW() WHERE id = $1 AND status = 'active'",
    [id],
  );

  if (!rowCount) throw new NotFoundError("Vehicle", id);
  return c.json({ message: `Vehicle ${id} decommissioned` });
}
