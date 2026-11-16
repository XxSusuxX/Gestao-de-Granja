import fs from "node:fs";
import path from "node:path";

const src = path.resolve("artifacts/gestao-granja/dist/public");
const destPublic = path.resolve("public");
const destDist = path.resolve("dist");

if (fs.existsSync(src)) {
  fs.mkdirSync(destPublic, { recursive: true });
  fs.cpSync(src, destPublic, { recursive: true });

  fs.mkdirSync(destDist, { recursive: true });
  fs.cpSync(src, destDist, { recursive: true });
  console.log("Successfully copied static build assets to ./public and ./dist!");
} else {
  console.warn("Source directory not found:", src);
}
