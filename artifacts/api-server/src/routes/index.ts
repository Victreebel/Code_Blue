import { Router, type IRouter } from "express";
import healthRouter from "./health";
import preferencesRouter from "./preferences";
import historyRouter from "./history";

const router: IRouter = Router();

router.use(healthRouter);
router.use(preferencesRouter);
router.use(historyRouter);

export default router;
