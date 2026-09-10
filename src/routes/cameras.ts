import { Hono } from "hono";
import { listCameras, getCamera, addCamera, updateCamera, deleteCamera } from "../controllers/camerasController.js";

const router = new Hono();

router.get("/", listCameras);
router.get("/:id", getCamera);
router.post("/", addCamera);
router.put("/:id", updateCamera);
router.delete("/:id", deleteCamera);

export default router;
