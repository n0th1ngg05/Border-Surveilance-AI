import { Hono } from "hono";
import { listEvents, getEvent } from "../controllers/eventsController.js";

const router = new Hono();

// GET /api/events?module=HUMAN&camera=cam-01&from=2026-09-09T00:00:00Z
router.get("/", listEvents);
router.get("/:id", getEvent);

export default router;
