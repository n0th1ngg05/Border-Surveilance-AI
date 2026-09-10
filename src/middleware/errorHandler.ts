/**
 * src/middleware/errorHandler.ts
 * Global error handler for Hono.
 *
 * Maps AppError subclasses → structured JSON responses.
 * Logs 5xx errors with full stack; 4xx errors with debug level only.
 */

import type { Context } from "hono";
import { AppError } from "../utils/errors.js";
import { logger } from "../utils/logger.js";
import { ZodError } from "zod";

interface ErrorResponse {
  error:      string;
  code:       string;
  requestId?: string;
  details?:   unknown;
}

export function errorHandler(err: Error, c: Context): Response {
  const requestId = c.get("requestId") as string | undefined;

  // ── Zod validation errors (shouldn't normally reach here — caught by parseBody) ──
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({ path: e.path.join("."), message: e.message }));
    logger.debug({ err: details, requestId }, "Zod validation error");
    const body: ErrorResponse = { error: "Validation failed", code: "VALIDATION_ERROR", details, requestId };
    return c.json(body, 400);
  }

  // ── Known application errors ────────────────────────────────────────────────
  if (err instanceof AppError) {
    const isClientError = err.statusCode < 500;

    if (isClientError) {
      logger.debug({ code: err.code, message: err.message, requestId }, "Client error");
    } else {
      logger.error({ err, requestId }, "Application error");
    }

    const body: ErrorResponse = {
      error:     err.message,
      code:      err.code,
      requestId,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };

    return c.json(body, err.statusCode as 400 | 401 | 403 | 404 | 409 | 500 | 501 | 503);
  }

  // ── Unknown / unexpected errors ─────────────────────────────────────────────
  logger.error({ err, stack: err.stack, requestId }, "Unhandled server error");

  const body: ErrorResponse = {
    error:     "Internal server error",
    code:      "INTERNAL_ERROR",
    requestId,
  };

  return c.json(body, 500);
}
