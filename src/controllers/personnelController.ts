/**
 * src/controllers/personnelController.ts
 * Military personnel registry — cross-referenced by the Human Detection pipeline.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseBody, parseQuery } from "../utils/validate.js";
import { query } from "../services/db.js";
import { NotFoundError, ConflictError } from "../utils/errors.js";
import { paginated } from "../models/index.js";
import type { Personnel } from "../models/index.js";

// ── Schemas ──────────────────────────────────────────────────────────────────

const PersonnelBodySchema = z.object({
  service_number:   z.string().min(1).max(50),
  name:             z.string().min(1).max(150),
  rank:             z.enum(["JCO", "OR", "NCO", "Officer", "Civilian"]),
  unit:             z.string().min(1).max(100),
  assigned_zone_id: z.string().uuid().nullable().optional(),
});

const ListQuerySchema = z.object({
  page:   z.coerce.number().int().min(1).default(1),
  limit:  z.coerce.number().int().min(1).max(100).default(20),
  rank:   z.string().optional(),
  unit:   z.string().optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// ── Handlers ─────────────────────────────────────────────────────────────────

export async function listPersonnel(c: Context): Promise<Response> {
  const { page, limit, rank, unit, status } = parseQuery(c, ListQuerySchema);
  const offset = (page - 1) * limit;

  const conditions: string[] = [];
  const values: unknown[]    = [];

  if (rank)   conditions.push(`rank = $${values.push(rank)}`);
  if (unit)   conditions.push(`unit ILIKE $${values.push(`%${unit}%`)}`);
  if (status) conditions.push(`status = $${values.push(status)}`);

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";

  const { rows: data } = await query<Personnel>(
    `SELECT id, service_number, name, rank, unit, assigned_zone_id, status, created_at
     FROM personnel ${where}
     ORDER BY name ASC
     LIMIT $${values.push(limit)} OFFSET $${values.push(offset)}`,
    values,
  );

  const { rows: [{ count }] } = await query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM personnel ${where}`,
    values.slice(0, -2),
  );

  return c.json(paginated(data, Number(count), page, limit));
}

export async function getPersonnel(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rows } = await query<Personnel>(
    `SELECT id, service_number, name, rank, unit, assigned_zone_id,
            face_embedding_path, status, created_at, updated_at
     FROM personnel WHERE id = $1`,
    [id],
  );

  if (!rows[0]) throw new NotFoundError("Personnel", id);
  return c.json({ data: rows[0] });
}

export async function addPersonnel(c: Context): Promise<Response> {
  const body = await parseBody(c, PersonnelBodySchema);

  // Enforce unique service number
  const { rows: existing } = await query<{ id: string }>(
    "SELECT id FROM personnel WHERE service_number = $1 LIMIT 1",
    [body.service_number],
  );
  if (existing[0]) {
    throw new ConflictError(`Service number '${body.service_number}' is already registered`);
  }

  const { rows } = await query<Personnel>(
    `INSERT INTO personnel (service_number, name, rank, unit, assigned_zone_id, status)
     VALUES ($1, $2, $3, $4, $5, 'active')
     RETURNING id, service_number, name, rank, unit, assigned_zone_id, status, created_at`,
    [body.service_number, body.name, body.rank, body.unit, body.assigned_zone_id ?? null],
  );

  // TODO: Queue face embedding generation job
  // await enqueueEmbeddingJob(rows[0].id);

  return c.json({ data: rows[0], note: "Face embedding generation will be queued" }, 201);
}

export async function updatePersonnel(c: Context): Promise<Response> {
  const id   = c.req.param("id");
  const body = await parseBody(c, PersonnelBodySchema.partial());

  const { rows: existing } = await query<{ id: string }>(
    "SELECT id FROM personnel WHERE id = $1",
    [id],
  );
  if (!existing[0]) throw new NotFoundError("Personnel", id);

  const { rows } = await query<Personnel>(
    `UPDATE personnel
     SET name             = COALESCE($1, name),
         rank             = COALESCE($2, rank),
         unit             = COALESCE($3, unit),
         assigned_zone_id = COALESCE($4, assigned_zone_id),
         updated_at       = NOW()
     WHERE id = $5
     RETURNING id, service_number, name, rank, unit, assigned_zone_id, status, updated_at`,
    [body.name, body.rank, body.unit, body.assigned_zone_id, id],
  );

  return c.json({ data: rows[0] });
}

export async function deletePersonnel(c: Context): Promise<Response> {
  const id = c.req.param("id");

  const { rowCount } = await query(
    "UPDATE personnel SET status = 'inactive', updated_at = NOW() WHERE id = $1 AND status = 'active'",
    [id],
  );

  // Soft delete — mark inactive rather than destroying audit trail
  if (!rowCount) throw new NotFoundError("Personnel", id);
  return c.json({ message: `Personnel ${id} deactivated` });
}
