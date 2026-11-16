import express, { type Express } from "express";
import cors from "cors";
import path from "node:path";
import fs from "node:fs";
import router from "./routes";
import { staticAssets } from "./generated-static";

const app: Express = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));

// 1. API Routes
app.use("/api", router);

// 2. Static Assets from memory
app.get("/favicon.svg", (_req, res) => {
  const asset = staticAssets["/favicon.svg"];
  if (asset) {
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(asset.content);
  } else {
    res.status(404).send("Not found");
  }
});

app.get("/robots.txt", (_req, res) => {
  const asset = staticAssets["/robots.txt"];
  if (asset) {
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(asset.content);
  } else {
    res.status(404).send("Not found");
  }
});

app.get("/assets/:filename", (req, res) => {
  const key = `/assets/${req.params.filename}`;
  const asset = staticAssets[key];
  if (asset) {
    res.setHeader("Content-Type", asset.contentType);
    res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    res.send(asset.content);
  } else {
    res.status(404).send("Asset not found");
  }
});

// Also support legacy/fallback if files are on disk
const staticDir = path.resolve(process.cwd(), "public");
if (fs.existsSync(staticDir)) {
  app.use(express.static(staticDir));
}

// 3. Fallback for SPA routing: return index.html for any GET request that doesn't start with /api
app.get("/{*splat}", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    next();
    return;
  }
  const indexAsset = staticAssets["/index.html"];
  if (indexAsset) {
    res.setHeader("Content-Type", indexAsset.contentType);
    res.setHeader("Cache-Control", "no-cache");
    res.send(indexAsset.content);
  } else {
    res.status(404).send("Granja Suenaga SPA not built yet");
  }
});

export default app;
