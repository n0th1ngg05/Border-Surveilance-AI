/**
 * src/controllers/authController.ts
 * Login and token refresh.
 * Validates credentials against the users table, issues a signed JWT.
 */

import type { Context } from "hono";
import { z } from "zod";
import { parseBody } from "../utils/validate.js";
import { signToken } from "../utils/jwt.js";
import { UnauthorizedError, NotImplementedError } from "../utils/errors.js";
import { query } from "../services/db.js";
import type { User } from "../models/index.js";
import { logger } from "../utils/logger.js";

const LoginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
});

const RefreshSchema = z.object({
  refreshToken: z.string().min(1, "refreshToken is required"),
});

export async function login(c: Context): Promise<Response> {
  const { username, password } = await parseBody(c, LoginSchema);

  // Fetch user from DB
  const { rows } = await query<User>(
    `SELECT id, username, password_hash, role FROM users WHERE username = $1 AND status = 'active' LIMIT 1`,
    [username],
  );

  const user = rows[0];

  if (!user) {
    // Use the same error for "user not found" and "wrong password"
    // to avoid user enumeration attacks
    throw new UnauthorizedError("Invalid username or password");
  }

  // TODO: Compare password with bcrypt
  // const valid = await bcrypt.compare(password, user.password_hash);
  // if (!valid) throw new UnauthorizedError("Invalid username or password");

  // Placeholder: reject until password comparison is implemented
  void password;
  throw new NotImplementedError("Password verification (bcrypt not yet wired up)");

  // When implemented, issue token:
  // const token = await signToken({ sub: user.id, role: user.role });
  // logger.info({ userId: user.id, role: user.role }, "User logged in");
  // return c.json({ token, role: user.role, expiresIn: config.JWT_EXPIRES_IN });
}

export async function refreshToken(c: Context): Promise<Response> {
  const { refreshToken } = await parseBody(c, RefreshSchema);
  void refreshToken;
  // TODO: validate refresh token from DB, issue new access token
  throw new NotImplementedError("Token refresh");
}
