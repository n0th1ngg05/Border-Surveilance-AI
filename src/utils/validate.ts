/**
 * src/utils/validate.ts
 * Zod request-body validation helper for Hono controllers.
 * Throws ValidationError (400) on failure so the error handler catches it cleanly.
 *
 * Usage:
 *   const body = await parseBody(c, MySchema);
 */

import type { Context } from "hono";
import type { ZodSchema, z } from "zod";
import { ValidationError } from "./errors.js";

export async function parseBody<T extends ZodSchema>(
  c: Context,
  schema: T,
): Promise<z.infer<T>> {
  let raw: unknown;

  try {
    raw = await c.req.json();
  } catch {
    throw new ValidationError("Request body must be valid JSON");
  }

  const result = schema.safeParse(raw);

  if (!result.success) {
    // Flatten Zod errors into a readable format
    const details = result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    throw new ValidationError("Request body validation failed", details);
  }

  return result.data;
}

export function parseQuery<T extends ZodSchema>(
  c: Context,
  schema: T,
): z.infer<T> {
  const raw = c.req.query();
  const result = schema.safeParse(raw);

  if (!result.success) {
    const details = result.error.errors.map((e) => ({
      path: e.path.join("."),
      message: e.message,
    }));
    throw new ValidationError("Query parameter validation failed", details);
  }

  return result.data;
}
