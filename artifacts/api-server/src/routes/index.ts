import { Router, type IRouter } from "express";
import {
  ensureDatabaseReady,
  hasDatabaseUrl,
  seedMvpDatabase,
} from "@workspace/db";
import healthRouter from "./health";
import farmRouter from "./farm";
import poultryRouter from "./poultry";
import feedingRouter from "./feeding";
import {
  authRouter,
  requireAuthMiddleware,
  supabaseRestRouter,
  sbFetch,
  SUPABASE_URL,
} from "./supabase-rest";

const router: IRouter = Router();
const dbRouter: IRouter = Router();

dbRouter.use(farmRouter);
dbRouter.use(poultryRouter);
dbRouter.use(feedingRouter);

router.use(healthRouter);
router.use(authRouter);

router.get("/system/status", async (_req, res) => {
  try {
    await sbFetch("farm_products?select=id&limit=1");
    res.json({
      mode: "supabase",
      connected: true,
      provider: `Supabase PostgreSQL (${SUPABASE_URL.replace("https://", "")})`,
      hasDatabaseUrl: true,
      error: null,
    });
  } catch (err) {
    res.json({
      mode: "supabase",
      connected: false,
      provider: "Supabase PostgreSQL",
      hasDatabaseUrl: hasDatabaseUrl(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

// Protect all farm data routes with login authentication
router.use(requireAuthMiddleware);

router.post("/system/seed", async (_req, res) => {
  if (hasDatabaseUrl() && (await ensureDatabaseReady())) {
    await seedMvpDatabase(true);
    res.json({
      status: "ok",
      mode: "supabase",
      message: "Dados do MVP restaurados no banco Supabase PostgreSQL.",
    });
    return;
  }
  res.json({
    status: "ok",
    mode: "supabase",
    message: "Conectado ao banco principal da Granja Suenaga no Supabase.",
  });
});

router.use(async (req, res, next) => {
  if (hasDatabaseUrl() && (await ensureDatabaseReady())) {
    dbRouter(req, res, next);
  } else {
    supabaseRestRouter(req, res, next);
  }
});

export default router;
