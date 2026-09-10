import { Hono } from "hono";
import { listVehicles, getVehicle, addVehicle, updateVehicle, deleteVehicle } from "../controllers/vehiclesController.js";

const router = new Hono();

router.get("/", listVehicles);
router.get("/:id", getVehicle);
router.post("/", addVehicle);
router.put("/:id", updateVehicle);
router.delete("/:id", deleteVehicle);

export default router;
