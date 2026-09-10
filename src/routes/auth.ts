/**
 * src/routes/auth.ts
 * Authentication routes — login, token refresh.
 */

import { Hono } from "hono";
import { login, refreshToken } from "../controllers/authController.js";

const router = new Hono();

router.post("/login", login);
router.post("/refresh", refreshToken);

export default router;
