import { Router, type IRouter } from "express";
import healthRouter from "./health";
import otpRouter from "./otp";
import aiRouter from "./ai";

const router: IRouter = Router();

router.use(healthRouter);
router.use(otpRouter);
router.use(aiRouter);

export default router;
