/**
 * src/utils/jwt.ts
 * JWT sign and verify using the `jose` library (ESM-native, no Node.js crypto hacks).
 */

import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import { config } from "../config/index.js";
import { UnauthorizedError } from "./errors.js";

const SECRET = new TextEncoder().encode(config.JWT_SECRET);

export interface TokenPayload extends JWTPayload {
  sub: string;       // personnel service number / user ID
  role: string;      // "admin" | "operator" | "viewer"
}

export async function signToken(payload: Omit<TokenPayload, "iat" | "exp">): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(config.JWT_EXPIRES_IN)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<TokenPayload> {
  try {
    const { payload } = await jwtVerify(token, SECRET, { algorithms: ["HS256"] });
    return payload as TokenPayload;
  } catch (err) {
    if (err instanceof Error) {
      if (err.message.includes("expired")) throw new UnauthorizedError("Token has expired");
      if (err.message.includes("invalid")) throw new UnauthorizedError("Invalid token");
    }
    throw new UnauthorizedError("Token verification failed");
  }
}
