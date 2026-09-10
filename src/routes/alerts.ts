import { Hono } from "hono";
import { listAlerts, getAlert, acknowledgeAlert, dismissAlert } from "../controllers/alertsController.js";

const router = new Hono();

router.get("/", listAlerts);
router.get("/:id", getAlert);
router.patch("/:id/acknowledge", acknowledgeAlert);
router.patch("/:id/dismiss", dismissAlert);

export default router;
