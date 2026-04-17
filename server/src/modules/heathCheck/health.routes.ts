import { Router } from "express";
import { healthCheckController } from "./health.controller";

const router = Router();

router.get("/", healthCheckController);

export default router;