import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);
app.use(router);

// In standalone production mode (non-Vercel), also serve built frontend static assets if present
if (!process.env.VERCEL && process.env.NODE_ENV === "production") {
  const staticDir = path.resolve(
    process.cwd(),
    "artifacts/gestao-granja/dist/public",
  );
  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir));
    app.get("/{*splat}", (req, res, next) => {
      if (req.path.startsWith("/api")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }
}

export default app;
