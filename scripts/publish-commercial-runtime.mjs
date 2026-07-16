#!/usr/bin/env node

import { copyFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_ROOT = path.join(ROOT, "art-source/buildings/commercial-v1");
const MODEL_OUTPUT = path.join(
  ROOT,
  "public/assets/models/buildings/commercial-v1",
);
const TEXTURE_OUTPUT = path.join(
  ROOT,
  "public/assets/textures/buildings/commercial-v1",
);

const MODEL_NAMES = [
  "commercial-wide-slab-01",
  "commercial-stepped-tower-01",
  "commercial-slim-tower-01",
];

const TEXTURE_MAPS = [
  { name: "diffuse", quality: 88 },
  { name: "emissive", quality: 90 },
  { name: "roughness", quality: 84 },
  { name: "normal", quality: 92 },
];

function runMagick(args) {
  const result = spawnSync("magick", args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    throw new Error("ImageMagick is required to publish the runtime atlas.");
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `magick exited with ${result.status}`);
  }
}

mkdirSync(MODEL_OUTPUT, { recursive: true });
mkdirSync(TEXTURE_OUTPUT, { recursive: true });

for (const name of MODEL_NAMES) {
  copyFileSync(
    path.join(SOURCE_ROOT, "runtime", `${name}.glb`),
    path.join(MODEL_OUTPUT, `${name}.glb`),
  );
}

for (const map of TEXTURE_MAPS) {
  runMagick([
    path.join(SOURCE_ROOT, "atlas", `commercial-atlas-v1-${map.name}.png`),
    "-resize",
    "2048x2048!",
    "-define",
    "webp:method=6",
    "-quality",
    String(map.quality),
    path.join(TEXTURE_OUTPUT, `commercial-atlas-v1-${map.name}.webp`),
  ]);
}

console.log(`Published ${MODEL_NAMES.length} GLBs to ${MODEL_OUTPUT}`);
console.log(`Published ${TEXTURE_MAPS.length} shared maps to ${TEXTURE_OUTPUT}`);
