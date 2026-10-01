import { Router } from "express";
import { createVisit } from "../controllers/visit.controller.js";

const router = Router();

router.post("/", createVisit);

export default router;
