#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
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
const TEXTURE_PROFILES = {
  "commercial-v1": {
    atlas: path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-diffuse.png"),
    emissive: path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-emissive.png"),
    roughness: path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-roughness.png"),
    normal: path.join(SOURCE_ROOT, "atlas/commercial-atlas-v1-normal.png"),
    regions: path.join(SOURCE_ROOT, "atlas/regions.json"),
  },
  "legacy-building-05": {
    // This profile intentionally points at the already-published shared
    // building_05 maps. Runtime GLBs therefore add geometry only and do not
    // duplicate the legacy texture family in startup payload.
    atlas: path.join(ROOT, "public/assets/textures/buildings/building_05.jpg"),
    emissive: path.join(ROOT, "public/assets/textures/buildings/building_05_em.jpg"),
    roughness: path.join(ROOT, "public/assets/textures/buildings/building_05_spec.jpg"),
    normal: path.join(SOURCE_ROOT, "legacy-building-05/building-05-normal.png"),
    regions: path.join(SOURCE_ROOT, "legacy-building-05/regions.json"),
  },
  "commercial-industrial-v2": {
    atlas: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas/commercial-industrial-v2-diffuse.png",
    ),
    emissive: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas/commercial-industrial-v2-emissive.png",
    ),
    roughness: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas/commercial-industrial-v2-roughness.png",
    ),
    normal: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas/commercial-industrial-v2-normal.png",
    ),
    regions: path.join(
      ROOT,
      "art-source/buildings/commercial-industrial-v2/atlas/regions.json",
    ),
  },
};

for (const specArgument of specArguments) {
  const spec = path.isAbsolute(specArgument)
    ? specArgument
    : path.join(SOURCE_ROOT, specArgument);
  const specDefinition = JSON.parse(readFileSync(spec, "utf8"));
  const profileName = specDefinition.textureProfile ?? "commercial-v1";
  const profile = TEXTURE_PROFILES[profileName];
  if (!profile) {
    throw new Error(
      `Unknown texture profile '${profileName}' in ${path.basename(spec)}`,
    );
  }
  const textureArgs = [
    "--atlas",
    profile.atlas,
    "--emissive",
    profile.emissive,
    "--roughness",
    profile.roughness,
    "--normal",
    profile.normal,
    "--regions",
    profile.regions,
    "--output-dir",
    path.join(SOURCE_ROOT, outputFolder),
  ];
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
