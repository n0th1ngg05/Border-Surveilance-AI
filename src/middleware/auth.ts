/**
 * src/middleware/auth.ts
 * JWT Bearer token authentication middleware for Hono.
 * Uses jose for verification — ESM-native, no crypto shims needed.
 *
 * Sets `c.set("user", payload)` so downstream handlers can access the JWT claims.
 */

import type { Context, Next } from "hono";
import { verifyToken, type TokenPayload } from "../utils/jwt.js";
import { UnauthorizedError } from "../utils/errors.js";

// Extend Hono's context variable map so TypeScript knows about "user"
declare module "hono" {
  interface ContextVariableMap {
    user: TokenPayload;
  }
}

export async function authMiddleware(c: Context, next: Next): Promise<void | Response> {
  const authHeader = c.req.header("Authorization");

  if (!authHeader) {
    throw new UnauthorizedError("Missing Authorization header");
  }

  if (!authHeader.startsWith("Bearer ")) {
    throw new UnauthorizedError("Authorization header must use Bearer scheme");
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    throw new UnauthorizedError("Bearer token is empty");
  }

  // verifyToken throws UnauthorizedError on failure — caught by errorHandler
  const payload = await verifyToken(token);
  c.set("user", payload);

  await next();
}

/** Role guard — wrap route handlers that require a specific role */
export function requireRole(...roles: TokenPayload["role"][]) {
  return async (c: Context, next: Next): Promise<void | Response> => {
    const user = c.get("user");
    if (!roles.includes(user.role)) {
      throw new UnauthorizedError(`Role '${user.role}' is not permitted for this action`);
    }
    await next();
  };
}
