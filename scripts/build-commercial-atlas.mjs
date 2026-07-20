#!/usr/bin/env node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, "..");
const SOURCE_ROOT = path.join(
  ROOT,
  "art-source/buildings/commercial-v1",
);
const OUTPUT_DIR = path.join(SOURCE_ROOT, "atlas");
const ATLAS_SIZE = 4096;
const PADDING = 16;
const BACKGROUND = "#111820";
const FACADE_SOURCE_FLOORS = [21, 22, 22, 20, 20, 22, 18, 20];
// The generated glass facade has slightly cropped outer rows/columns. These
// cuts follow the centers of its structural mullions so UV slices can end on a
// complete bay instead of cutting through windows. Coordinates are measured
// in the 1024 x 1536 source image, with a top-left origin.
const FACADE_GRID_OVERRIDES = {
  facade_01: {
    columns: [108, 227, 335, 439, 539, 644, 749, 853, 954],
    rows: [
      67, 137, 207, 277, 349, 420, 492, 564, 637, 709, 781, 854, 927,
      999, 1072, 1146, 1219, 1292, 1365, 1439, 1512,
    ],
  },
  facade_03: {
    columns: [
      16, 55, 104, 159, 212, 269, 324, 371, 427, 482, 541, 592, 647,
      691, 745, 806, 853, 910, 963, 1008,
    ],
    rows: [
      83, 155, 226, 297, 369, 440, 511, 582, 653, 724, 795, 866, 937,
      1009, 1079, 1152, 1224, 1296, 1368, 1441, 1513,
    ],
  },
  facade_08: {
    columns: [
      16, 69, 123, 177, 228, 284, 338, 394, 445, 505, 563, 618, 673,
      728, 782, 835, 890, 944, 997,
    ],
    rows: [
      18, 87, 159, 233, 308, 384, 459, 533, 608, 683, 758, 835, 909,
      984, 1059, 1135, 1212, 1289, 1366, 1443, 1517,
    ],
  },
};

const facadeSources = Array.from({ length: 8 }, (_, index) => ({
  id: `facade_${String(index + 1).padStart(2, "0")}`,
  type: "facade",
  source: `facades/facade-${String(index + 1).padStart(2, "0")}-diffuse-source.png`,
  x: (index % 4) * 1024,
  y: Math.floor(index / 4) * 1536,
  width: 1024,
  height: 1536,
  sourceFloors: FACADE_SOURCE_FLOORS[index],
  sourceGrid: FACADE_GRID_OVERRIDES[
    `facade_${String(index + 1).padStart(2, "0")}`
  ],
}));

const ancillarySources = [
  {
    id: "roof_dark_metal",
    type: "roof",
    source: "mechanical/roof-dark-metal-source.png",
    x: 0,
    y: 3072,
    width: 1024,
    height: 1024,
  },
  {
    id: "roof_weathered_concrete",
    type: "roof",
    source: "mechanical/roof-weathered-concrete-source.png",
    x: 1024,
    y: 3072,
    width: 1024,
    height: 1024,
  },
  {
    id: "hvac_fan_array",
    type: "mechanical",
    source: "mechanical/hvac-fan-array-source.png",
    x: 2048,
    y: 3072,
    width: 512,
    height: 512,
  },
  {
    id: "hvac_louver_bank",
    type: "mechanical",
    source: "mechanical/hvac-louver-bank-source.png",
    x: 2560,
    y: 3072,
    width: 512,
    height: 512,
  },
  {
    id: "service_wall",
    type: "mechanical",
    source: "mechanical/service-wall-source.png",
    x: 2048,
    y: 3584,
    width: 512,
    height: 512,
  },
  {
    id: "mechanical_panels",
    type: "mechanical",
    source: "mechanical/mechanical-panels-source.png",
    x: 2560,
    y: 3584,
    width: 512,
    height: 512,
  },
  {
    id: "trim_cyan_sheet",
    type: "trim",
    source: "mechanical/trim-cyan-source.png",
    x: 3072,
    y: 3072,
    width: 512,
    height: 1024,
  },
  {
    id: "trim_magenta_sheet",
    type: "trim",
    source: "mechanical/trim-magenta-source.png",
    x: 3584,
    y: 3072,
    width: 512,
    height: 1024,
  },
];

const placements = [...facadeSources, ...ancillarySources];
const SOURCE_TILE_SIZE = 1254;
const subregionDefinitions = [
  {
    id: "roof_metal_tile_a",
    parent: "roof_dark_metal",
    type: "roof-tile",
    rect: { x: 20, y: 410, width: 410, height: 390 },
  },
  {
    id: "roof_metal_tile_b",
    parent: "roof_dark_metal",
    type: "roof-tile",
    rect: { x: 455, y: 410, width: 410, height: 390 },
  },
  {
    id: "roof_concrete_tile_a",
    parent: "roof_weathered_concrete",
    type: "roof-tile",
    rect: { x: 20, y: 20, width: 400, height: 350 },
  },
  {
    id: "roof_concrete_tile_b",
    parent: "roof_weathered_concrete",
    type: "roof-tile",
    rect: { x: 440, y: 20, width: 400, height: 350 },
  },
  {
    id: "hvac_fan_quad",
    parent: "hvac_fan_array",
    type: "mechanical-module",
    rect: { x: 15, y: 12, width: 370, height: 365 },
  },
  {
    id: "hvac_louver_wide",
    parent: "hvac_louver_bank",
    type: "mechanical-module",
    rect: { x: 55, y: 25, width: 1140, height: 300 },
  },
  {
    id: "hvac_access_panel",
    parent: "hvac_louver_bank",
    type: "mechanical-module",
    rect: { x: 70, y: 700, width: 790, height: 430 },
  },
  {
    id: "service_wall_clean",
    parent: "service_wall",
    type: "mechanical-module",
    rect: { x: 300, y: 25, width: 700, height: 330 },
  },
];
const generatedSwatches = [
  {
    id: "structural_dark",
    type: "metal-swatch",
    color: "#202a34",
    pixel: { x: 3804, y: 4048, width: 36, height: 36 },
  },
  {
    id: "structural_light",
    type: "metal-swatch",
    color: "#8c9aaa",
    pixel: { x: 3852, y: 4048, width: 36, height: 36 },
  },
  {
    id: "neon_cyan",
    type: "emissive",
    color: "#16dff5",
    pixel: { x: 3900, y: 4048, width: 36, height: 36 },
  },
  {
    id: "neon_magenta",
    type: "emissive",
    color: "#ff43d1",
    pixel: { x: 3948, y: 4048, width: 36, height: 36 },
  },
  {
    id: "beacon_rod_dark",
    type: "metal-swatch",
    color: "#151a1f",
    pixel: { x: 3996, y: 4048, width: 36, height: 36 },
  },
  {
    id: "beacon_red",
    type: "emissive",
    color: "#ff1018",
    pixel: { x: 4044, y: 4048, width: 36, height: 36 },
  },
];

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

function normalizedUv(pixel) {
  return {
    u0: Number((pixel.x / ATLAS_SIZE).toFixed(8)),
    v0: Number((1 - (pixel.y + pixel.height) / ATLAS_SIZE).toFixed(8)),
    u1: Number(((pixel.x + pixel.width) / ATLAS_SIZE).toFixed(8)),
    v1: Number((1 - pixel.y / ATLAS_SIZE).toFixed(8)),
  };
}

function paddedRegion(placement) {
  const inset = Math.min(PADDING, placement.width / 4, placement.height / 4);
  const pixel = {
    x: placement.x + inset,
    y: placement.y + inset,
    width: placement.width - inset * 2,
    height: placement.height - inset * 2,
  };
  const facadeGrid = placement.sourceGrid
    ? {
        floors: placement.sourceGrid.rows.length - 1,
        columnBoundaries: placement.sourceGrid.columns.map((x) =>
          Number(((x - inset) / pixel.width).toFixed(8)),
        ),
        rowBoundaries: placement.sourceGrid.rows
          .map((y) => (placement.height - inset - y) / pixel.height)
          .reverse()
          .map((value) => Number(value.toFixed(8))),
      }
    : placement.sourceFloors
      ? { floors: placement.sourceFloors }
      : undefined;
  return {
    type: placement.type,
    source: placement.source,
    ...(facadeGrid ? { facadeGrid } : {}),
    pixel,
    uv: normalizedUv(pixel),
  };
}

function subregion(definition) {
  const parent = placements.find((placement) => placement.id === definition.parent);
  if (!parent) throw new Error(`Unknown parent region: ${definition.parent}`);
  const inset = 2;
  const scaleX = parent.width / SOURCE_TILE_SIZE;
  const scaleY = parent.height / SOURCE_TILE_SIZE;
  const pixel = {
    x: parent.x + definition.rect.x * scaleX + inset,
    y: parent.y + definition.rect.y * scaleY + inset,
    width: definition.rect.width * scaleX - inset * 2,
    height: definition.rect.height * scaleY - inset * 2,
  };
  return {
    type: definition.type,
    source: `${parent.source}#${definition.id}`,
    pixel,
    uv: normalizedUv(pixel),
  };
}

function generatedRegion(swatch) {
  const inset = 4;
  const pixel = {
    x: swatch.pixel.x + inset,
    y: swatch.pixel.y + inset,
    width: swatch.pixel.width - inset * 2,
    height: swatch.pixel.height - inset * 2,
  };
  return {
    type: swatch.type,
    source: `generated:${swatch.color}`,
    pixel,
    uv: normalizedUv(pixel),
  };
}

function buildAtlas() {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const temporaryDir = mkdtempSync(path.join(tmpdir(), "commercial-atlas-"));
  const layers = [];

  try {
    for (const [index, placement] of placements.entries()) {
      const input = path.join(SOURCE_ROOT, placement.source);
      const tile = path.join(temporaryDir, `tile-${index}.png`);
      runMagick([
        input,
        "-filter",
        "Lanczos",
        "-resize",
        `${placement.width}x${placement.height}!`,
        tile,
      ]);
      layers.push(tile, "-geometry", `+${placement.x}+${placement.y}`, "-composite");
    }

    const diffuseOutput = path.join(
      OUTPUT_DIR,
      "commercial-atlas-v1-diffuse.png",
    );
    runMagick([
      "-size",
      `${ATLAS_SIZE}x${ATLAS_SIZE}`,
      `xc:${BACKGROUND}`,
      ...layers,
      ...generatedSwatches.flatMap((swatch) => [
        "-fill",
        swatch.color,
        "-draw",
        `rectangle ${swatch.pixel.x},${swatch.pixel.y} ${swatch.pixel.x + swatch.pixel.width - 1},${swatch.pixel.y + swatch.pixel.height - 1}`,
      ]),
      // Slightly lift dark and midtone surfaces for the night renderer while
      // preserving true black recesses and white/emissive endpoints.
      "-gamma",
      "1.08",
      diffuseOutput,
    ]);

    const manifest = {
      version: 1,
      atlas: {
        width: ATLAS_SIZE,
        height: ATLAS_SIZE,
        padding: PADDING,
        pixelOrigin: "top-left",
        uvOrigin: "bottom-left",
        diffuse: path.basename(diffuseOutput),
        emissive: "commercial-atlas-v1-emissive.png",
        roughness: "commercial-atlas-v1-roughness.png",
        normal: "commercial-atlas-v1-normal.png",
      },
      regions: Object.fromEntries(
        [
          ...placements.map((placement) => [
            placement.id,
            paddedRegion(placement),
          ]),
          ...subregionDefinitions.map((definition) => [
            definition.id,
            subregion(definition),
          ]),
          ...generatedSwatches.map((swatch) => [
            swatch.id,
            generatedRegion(swatch),
          ]),
        ],
      ),
    };
    writeFileSync(
      path.join(OUTPUT_DIR, "regions.json"),
      `${JSON.stringify(manifest, null, 2)}\n`,
    );

    console.log(diffuseOutput);
    console.log(path.join(OUTPUT_DIR, "regions.json"));
  } finally {
    rmSync(temporaryDir, { recursive: true, force: true });
  }
}

buildAtlas();
