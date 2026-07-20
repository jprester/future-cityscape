#!/usr/bin/env node

import { mkdirSync, renameSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIR = path.join(
  ROOT,
  "art-source/buildings/commercial-industrial-v2/source",
);
const ATLAS_PATH = path.join(
  ROOT,
  "art-source/buildings/commercial-industrial-v2/atlas/commercial-industrial-v2-diffuse.png",
);
const DIFFUSE_TILE = path.join(
  SOURCE_DIR,
  "industrial-facade-01-authored-diffuse.png",
);
const EMISSIVE_TILE = path.join(
  SOURCE_DIR,
  "industrial-facade-01-authored-emissive.png",
);
const TEMP_ATLAS = `${ATLAS_PATH}.tmp.png`;

const WIDTH = 960;
const HEIGHT = 1328;
const FLOOR_COUNT = 36;
const FLOOR_PITCH = 36;
const TOP = 16;
const PANE_START_X = 24;
const PANE_PITCH = 14;
const PANE_WIDTH = 10;
const PANE_COUNT = 65;

function runMagick(args) {
  const result = spawnSync("magick", args, { encoding: "utf8" });
  if (result.error?.code === "ENOENT") {
    throw new Error("ImageMagick is required to build the industrial facade.");
  }
  if (result.status !== 0) {
    throw new Error(result.stderr || `magick exited with ${result.status}`);
  }
}

function rect(x0, y0, x1, y1) {
  return `rectangle ${x0},${y0} ${x1},${y1}`;
}

function mulberry32(seed) {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function buildDrawCommands() {
  const diffuse = [];
  const emissive = [];
  const random = mulberry32(250719);

  // A real floor rhythm: every light is one of these panes, never a painted
  // stroke floating over the metal louver below it.
  for (let floor = 0; floor < FLOOR_COUNT; floor += 1) {
    const floorY = TOP + floor * FLOOR_PITCH;
    const windowTop = floorY + 2;
    const windowBottom = floorY + 14;
    const louverTop = floorY + 18;
    const louverBottom = floorY + 33;

    diffuse.push("fill #050a0e", rect(18, windowTop, 941, windowBottom));
    for (let pane = 0; pane < PANE_COUNT; pane += 1) {
      const x0 = PANE_START_X + pane * PANE_PITCH;
      const shade = (pane + floor) % 3 === 0 ? "#09151c" : "#071117";
      diffuse.push("fill", shade, rect(x0, windowTop + 2, x0 + PANE_WIDTH, windowBottom - 1));
    }

    diffuse.push(
      "fill #24292c",
      rect(18, louverTop, 941, louverBottom),
      "fill #394044",
      rect(18, louverTop, 941, louverTop + 1),
      "fill #0a0d0f",
      rect(18, louverBottom - 2, 941, louverBottom),
    );

    if ((floor + 1) % 6 === 0) {
      diffuse.push("fill #4a5052", rect(18, louverTop - 2, 941, louverTop));
    }

    if (random() < 0.46) continue;
    const groupCount = random() > 0.82 ? 2 : 1;
    for (let group = 0; group < groupCount; group += 1) {
      const length = 2 + Math.floor(random() * 5);
      const start = 2 + Math.floor(random() * (PANE_COUNT - length - 4));
      for (let pane = start; pane < start + length; pane += 1) {
        const x0 = PANE_START_X + pane * PANE_PITCH;
        const paneRect = rect(x0 + 1, windowTop + 3, x0 + PANE_WIDTH - 1, windowBottom - 2);
        diffuse.push("fill #3989a3", paneRect);
        emissive.push("fill #78dcf5", paneRect);
      }
    }
  }

  // Structural frame and subtle vertical service seams.
  diffuse.push(
    "fill #20262a",
    rect(0, 0, 17, HEIGHT - 1),
    rect(942, 0, WIDTH - 1, HEIGHT - 1),
    "fill #4a5052",
    rect(3, 0, 5, HEIGHT - 1),
    rect(954, 0, 956, HEIGHT - 1),
    "fill #11171b",
    rect(316, 0, 319, HEIGHT - 1),
    rect(640, 0, 643, HEIGHT - 1),
    "fill #0a0d0f",
    rect(0, 0, WIDTH - 1, 10),
    rect(0, HEIGHT - 11, WIDTH - 1, HEIGHT - 1),
  );

  return { diffuse, emissive };
}

function main() {
  mkdirSync(SOURCE_DIR, { recursive: true });
  const commands = buildDrawCommands();

  runMagick([
    "-size",
    `${WIDTH}x${HEIGHT}`,
    "xc:#14191c",
    "-seed",
    "250719",
    "-attenuate",
    "0.015",
    "+noise",
    "Gaussian",
    "-draw",
    commands.diffuse.join(" "),
    // Keep this generated tile consistent with the atlas-wide night-scene
    // grade applied to commercial-industrial-v2.
    "-gamma",
    "1.12",
    DIFFUSE_TILE,
  ]);
  runMagick([
    "-size",
    `${WIDTH}x${HEIGHT}`,
    "xc:black",
    "-draw",
    commands.emissive.join(" "),
    EMISSIVE_TILE,
  ]);
  runMagick([
    ATLAS_PATH,
    DIFFUSE_TILE,
    "-geometry",
    "+32+32",
    "-composite",
    TEMP_ATLAS,
  ]);
  renameSync(TEMP_ATLAS, ATLAS_PATH);

  console.log(DIFFUSE_TILE);
  console.log(EMISSIVE_TILE);
  console.log(ATLAS_PATH);
}

main();
