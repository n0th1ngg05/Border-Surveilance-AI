import { Hono } from "hono";
import { listZones, getZone, createZone, updateZone, deleteZone } from "../controllers/zonesController.js";

const router = new Hono();

router.get("/", listZones);
router.get("/:id", getZone);
router.post("/", createZone);
router.put("/:id", updateZone);
router.delete("/:id", deleteZone);

export default router;
