/**
 * src/utils/errors.ts
 * Typed application error hierarchy.
 * Every thrown error in the app should be one of these —
 * the error handler in middleware/errorHandler.ts maps them to HTTP responses.
 */

export class AppError extends Error {
  constructor(
    public readonly message: string,
    public readonly statusCode: number = 500,
    public readonly code: string = "INTERNAL_ERROR",
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ── 400 ────────────────────────────────────────────────────────────────────
export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string) {
    super(message, 400, "BAD_REQUEST");
  }
}

// ── 401 / 403 ───────────────────────────────────────────────────────────────
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403, "FORBIDDEN");
  }
}

// ── 404 ────────────────────────────────────────────────────────────────────
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super(
      id ? `${resource} '${id}' not found` : `${resource} not found`,
      404,
      "NOT_FOUND",
    );
  }
}

// ── 409 ────────────────────────────────────────────────────────────────────
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, "CONFLICT");
  }
}

// ── 501 ────────────────────────────────────────────────────────────────────
export class NotImplementedError extends AppError {
  constructor(feature: string) {
    super(`Not implemented: ${feature}`, 501, "NOT_IMPLEMENTED");
  }
}

// ── 503 ────────────────────────────────────────────────────────────────────
export class ServiceUnavailableError extends AppError {
  constructor(service: string) {
    super(`Service unavailable: ${service}`, 503, "SERVICE_UNAVAILABLE");
  }
}

/** Narrow an unknown catch value to AppError or a plain Error. */
export function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof Error)
    return new AppError(err.message, 500, "INTERNAL_ERROR");
  return new AppError("An unknown error occurred", 500, "INTERNAL_ERROR");
}
