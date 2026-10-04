import { Router, type IRouter } from "express";
import healthRouter from "./health";
import farmRouter from "./farm";
import poultryRouter from "./poultry";
import feedingRouter from "./feeding";

const router: IRouter = Router();

router.use(healthRouter);
router.use(farmRouter);
router.use(poultryRouter);
router.use(feedingRouter);

export default router;
