import { Router, type IRouter } from "express";
import healthRouter from "./health";
import preferencesRouter from "./preferences";

const router: IRouter = Router();

router.use(healthRouter);
router.use(preferencesRouter);

export default router;
