#!/usr/bin/env node

import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_ROOT = path.join(
  ROOT,
  "art-source/buildings/commercial-v1",
);

function findBlender() {
  const candidates = [
    process.env.BLENDER_PATH,
    "blender",
    "/Applications/Blender.app/Contents/MacOS/Blender",
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && !existsSync(candidate)) continue;
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) return candidate;
  }

  throw new Error(
    "Blender was not found. Set BLENDER_PATH or add the `blender` command to PATH.",
  );
}

const rawArguments = process.argv.slice(2);
const geometryOnly = rawArguments.includes("--geometry-only");
const [outputFolder, ...specArguments] = rawArguments.filter(
  (argument) => argument !== "--geometry-only",
);
if (!outputFolder || specArguments.length === 0) {
  console.error(
    "Usage: node scripts/generate-commercial-buildings.mjs [--geometry-only] output-folder spec.json [...]",
  );
  process.exit(1);
}

const blender = findBlender();
const pythonScript = path.join(
  ROOT,
  "tools/blender/generate_commercial_building.py",
);
const textureArgs = [
  "--atlas",
  path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-diffuse.png"),
  "--emissive",
  path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-emissive.png"),
  "--roughness",
  path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-roughness.png"),
  "--normal",
  path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-normal.png"),
  "--regions",
  path.join(SOURCE_ROOT, "atlas/regions.json"),
  "--output-dir",
  path.join(SOURCE_ROOT, outputFolder),
];

for (const specArgument of specArguments) {
  const spec = path.isAbsolute(specArgument)
    ? specArgument
    : path.join(SOURCE_ROOT, specArgument);
  const args = [
    "--background",
    "--factory-startup",
    "--python-exit-code",
    "1",
    "--python",
    pythonScript,
    "--",
    "--spec",
    spec,
    ...(geometryOnly ? ["--geometry-only"] : []),
    ...textureArgs,
  ];
  const result = spawnSync(blender, args, {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
