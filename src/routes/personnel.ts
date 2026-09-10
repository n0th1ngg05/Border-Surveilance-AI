import { Hono } from "hono";
import { listPersonnel, getPersonnel, addPersonnel, updatePersonnel, deletePersonnel } from "../controllers/personnelController.js";

const router = new Hono();

router.get("/", listPersonnel);
router.get("/:id", getPersonnel);
router.post("/", addPersonnel);
router.put("/:id", updatePersonnel);
router.delete("/:id", deletePersonnel);

export default router;
