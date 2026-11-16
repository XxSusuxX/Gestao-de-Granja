import fs from "node:fs";
import path from "node:path";

const src = path.resolve("artifacts/gestao-granja/dist/public");

const destinations = [
  path.resolve("public"),
  path.resolve("dist"),
  path.resolve("artifacts/gestao-granja/public"),
  path.resolve("artifacts/gestao-granja/dist"),
];

if (fs.existsSync(src)) {
  for (const dest of destinations) {
    if (dest !== src) {
      fs.mkdirSync(dest, { recursive: true });
      fs.cpSync(src, dest, { recursive: true });
    }
  }
  console.log("Successfully copied static build assets to all target directories!");
} else {
  console.warn("Source directory not found:", src);
}

// Ensure api directory is also present in artifacts/gestao-granja for safety
const apiSrc = path.resolve("api");
const apiDest = path.resolve("artifacts/gestao-granja/api");
if (fs.existsSync(apiSrc) && apiDest !== apiSrc) {
  fs.mkdirSync(apiDest, { recursive: true });
  fs.cpSync(apiSrc, apiDest, { recursive: true });
}
