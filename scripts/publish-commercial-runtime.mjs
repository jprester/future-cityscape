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
const TEXTURE_PROFILES = [
  {
    source: path.join(SOURCE_ROOT, "atlas"),
    output: path.join(ROOT, "public/assets/textures/buildings/commercial-v1"),
    prefix: "commercial-atlas-v1",
  },
  {
    source: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas",
    ),
    output: path.join(
      ROOT,
      "public/assets/textures/buildings/commercial-industrial-v2",
    ),
    prefix: "commercial-industrial-v2",
    runtimeSuffix: "-v3",
  },
];

const MODEL_NAMES = [
  "commercial-wide-slab-01",
  "commercial-stepped-tower-01",
  "commercial-slim-tower-01",
  "commercial-rounded-glass-02",
  "commercial-tech-fins-02",
  "commercial-concrete-frame-02",
  "commercial-signature-crown-02",
  "commercial-exoskeleton-02",
  "commercial-blue-glass-03",
  "commercial-legacy-louver-01",
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

for (const name of MODEL_NAMES) {
  copyFileSync(
    path.join(SOURCE_ROOT, "runtime", `${name}.glb`),
    path.join(MODEL_OUTPUT, `${name}.glb`),
  );
}

for (const profile of TEXTURE_PROFILES) {
  mkdirSync(profile.output, { recursive: true });
  for (const map of TEXTURE_MAPS) {
    runMagick([
      path.join(profile.source, `${profile.prefix}-${map.name}.png`),
      "-resize",
      "2048x2048!",
      "-define",
      "webp:method=6",
      "-quality",
      String(map.quality),
      path.join(
        profile.output,
        `${profile.prefix}-${map.name}${profile.runtimeSuffix ?? ""}.webp`,
      ),
    ]);
  }
}

console.log(`Published ${MODEL_NAMES.length} GLBs to ${MODEL_OUTPUT}`);
console.log(
  `Published ${TEXTURE_PROFILES.length * TEXTURE_MAPS.length} shared maps across ${TEXTURE_PROFILES.length} atlas profiles`,
);
