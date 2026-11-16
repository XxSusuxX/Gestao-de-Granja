import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build as esbuild } from "esbuild";
import { mkdir, rm } from "node:fs/promises";

globalThis.require = createRequire(import.meta.url);

const artifactDir = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(artifactDir, "../..");

const bannerJs = `import { createRequire as __bannerCrReq } from 'node:module';
import __bannerPath from 'node:path';
import __bannerUrl from 'node:url';

globalThis.require = __bannerCrReq(import.meta.url);
globalThis.__filename = __bannerUrl.fileURLToPath(import.meta.url);
globalThis.__dirname = __bannerPath.dirname(globalThis.__filename);
`;

const externalPackages = [
  "*.node",
  "pg-native",
];

async function buildAll() {
  const distDir = path.resolve(artifactDir, "dist");
  const vercelApiDir = path.resolve(rootDir, "api");

  await rm(distDir, { recursive: true, force: true });
  await mkdir(vercelApiDir, { recursive: true });

  // 1. Standalone server bundle (artifacts/api-server/dist/index.mjs)
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/index.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outdir: distDir,
    outExtension: { ".js": ".mjs" },
    logLevel: "info",
    external: externalPackages,
    sourcemap: "linked",
    banner: { js: bannerJs },
  });

  // 2. Vercel Serverless Function bundle (api/index.mjs and api/index.js)
  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(vercelApiDir, "index.mjs"),
    logLevel: "info",
    external: externalPackages,
    banner: { js: bannerJs },
  });

  await esbuild({
    entryPoints: [path.resolve(artifactDir, "src/app.ts")],
    platform: "node",
    bundle: true,
    format: "esm",
    outfile: path.resolve(vercelApiDir, "index.js"),
    logLevel: "info",
    external: externalPackages,
    banner: { js: bannerJs },
  });
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});
