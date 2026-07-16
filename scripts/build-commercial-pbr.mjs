#!/usr/bin/env node

import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const ATLAS_DIR = path.join(
  ROOT,
  "art-source/buildings/commercial-v1/atlas",
);
const MANIFEST_PATH = path.join(ATLAS_DIR, "regions.json");
const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
const { width, height } = manifest.atlas;
const diffuse = path.join(ATLAS_DIR, manifest.atlas.diffuse);
const emissiveOutput = path.join(ATLAS_DIR, manifest.atlas.emissive);
const roughnessOutput = path.join(ATLAS_DIR, manifest.atlas.roughness);
const normalOutput = path.join(ATLAS_DIR, manifest.atlas.normal);

function runMagick(args) {
  const result = spawnSync("magick", args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    throw new Error(
      "ImageMagick is required. Install it so the `magick` command is available.",
    );
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `magick exited with status ${result.status}`);
  }
}

function cropGeometry(pixel) {
  return `${pixel.width}x${pixel.height}+${pixel.x}+${pixel.y}`;
}

function createEmissiveMap(temporaryDir) {
  const layers = [];
  let index = 0;

  for (const region of Object.values(manifest.regions)) {
    if (
      region.type !== "facade" &&
      region.type !== "trim" &&
      region.type !== "emissive"
    ) {
      continue;
    }

    const crop = path.join(temporaryDir, `emissive-crop-${index}.png`);
    const saturation = path.join(temporaryDir, `emissive-saturation-${index}.png`);
    const lightness = path.join(temporaryDir, `emissive-lightness-${index}.png`);
    const mask = path.join(temporaryDir, `emissive-mask-${index}.png`);
    const tile = path.join(temporaryDir, `emissive-tile-${index}.png`);
    const saturationThreshold = region.type === "trim" ? "8%" : "12%";
    const lightnessThreshold = region.type === "trim" ? "24%" : "32%";

    runMagick([
      diffuse,
      "-crop",
      cropGeometry(region.pixel),
      "+repage",
      crop,
    ]);
    if (region.type === "emissive") {
      layers.push(
        crop,
        "-geometry",
        `+${region.pixel.x}+${region.pixel.y}`,
        "-composite",
      );
      index += 1;
      continue;
    }
    runMagick([
      crop,
      "-colorspace",
      "HSL",
      "-channel",
      "G",
      "-separate",
      "+channel",
      "-threshold",
      saturationThreshold,
      saturation,
    ]);
    runMagick([
      crop,
      "-colorspace",
      "HSL",
      "-channel",
      "B",
      "-separate",
      "+channel",
      "-threshold",
      lightnessThreshold,
      lightness,
    ]);
    runMagick([
      saturation,
      lightness,
      "-compose",
      "Multiply",
      "-composite",
      "-blur",
      "0x0.45",
      mask,
    ]);
    runMagick([
      crop,
      mask,
      "-compose",
      "Multiply",
      "-composite",
      "-level",
      "2%,92%",
      tile,
    ]);
    layers.push(
      tile,
      "-geometry",
      `+${region.pixel.x}+${region.pixel.y}`,
      "-composite",
    );
    index += 1;
  }

  runMagick([
    "-size",
    `${width}x${height}`,
    "xc:black",
    ...layers,
    emissiveOutput,
  ]);
}

function roughnessLevels(type) {
  switch (type) {
    case "facade":
      return "18%,48%";
    case "roof":
      return "62%,88%";
    case "mechanical":
      return "48%,78%";
    case "trim":
      return "30%,58%";
    default:
      return "42%,68%";
  }
}

function createRoughnessMap(temporaryDir) {
  const layers = [];
  let index = 0;
  for (const region of Object.values(manifest.regions)) {
    const tile = path.join(temporaryDir, `roughness-tile-${index}.png`);
    runMagick([
      diffuse,
      "-crop",
      cropGeometry(region.pixel),
      "+repage",
      "-colorspace",
      "Gray",
      "-contrast-stretch",
      "1%x1%",
      "+level",
      roughnessLevels(region.type),
      tile,
    ]);
    layers.push(
      tile,
      "-geometry",
      `+${region.pixel.x}+${region.pixel.y}`,
      "-composite",
    );
    index += 1;
  }

  runMagick([
    "-size",
    `${width}x${height}`,
    "xc:gray50",
    ...layers,
    roughnessOutput,
  ]);
}

function createNormalMap(temporaryDir) {
  const heightMap = path.join(temporaryDir, "normal-height.png");
  const gradientX = path.join(temporaryDir, "normal-gradient-x.png");
  const gradientY = path.join(temporaryDir, "normal-gradient-y.png");

  runMagick([
    diffuse,
    "-colorspace",
    "Gray",
    "-blur",
    "0x0.7",
    heightMap,
  ]);
  runMagick([
    heightMap,
    "-define",
    "convolve:scale=25%!",
    "-bias",
    "50%",
    "-morphology",
    "Convolve",
    "Sobel:0",
    gradientX,
  ]);
  runMagick([
    heightMap,
    "-define",
    "convolve:scale=25%!",
    "-bias",
    "50%",
    "-morphology",
    "Convolve",
    "Sobel:90",
    "-negate",
    gradientY,
  ]);
  runMagick([
    gradientX,
    gradientY,
    "-size",
    `${width}x${height}`,
    "xc:white",
    "-combine",
    "-colorspace",
    "sRGB",
    normalOutput,
  ]);
}

function main() {
  mkdirSync(ATLAS_DIR, { recursive: true });
  const temporaryDir = mkdtempSync(path.join(tmpdir(), "commercial-pbr-"));
  try {
    createEmissiveMap(temporaryDir);
    createRoughnessMap(temporaryDir);
    createNormalMap(temporaryDir);
    console.log(emissiveOutput);
    console.log(roughnessOutput);
    console.log(normalOutput);
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
}

main();
