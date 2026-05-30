import {
  createPerlin,
  clamp,
  mapRange,
  pickFromNoise,
  getRotationFromNoise,
} from "../../utils";
import { NEW_TOWER_SERIES } from "../buildingRegistry";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../world";
import type {
  FiniteCityLayout,
  FiniteBuildingPlacement,
  FiniteStorefrontPlacement,
} from "./types";

function fixNoise(noise: number): number {
  return clamp(mapRange(noise, 0.2, 0.75, 0, 0.9999), 0, 0.9999);
}

function getBuildingMatKey(noise: number): string {
  const mats = [
    // "building_01", // temporarily removed
    "building_02",
    "building_03",
    // "building_04",
    "building_05",
  ];
  return pickFromNoise(mats, noise);
}

const NOISEFACTOR = 0.0017;
const CELL_SIZE = CITY_BLOCK_SIZE + ROAD_WIDTH;

// Residential (s_01) and commercial (s_02) windows read slightly small at human
// scale, so enlarge those buildings uniformly a touch. Windows are baked into
// the model UVs, so a uniform scale enlarges the windows proportionally.
const SMALL_BUILDING_WINDOW_SCALE = 1.08;

// ── City template ────────────────────────────────────────────────────────────
//
// Each character defines what occupies a city block:
//
//   .  = empty (no buildings)
//   r  = residential (s_01 series)
//   c  = commercial  (s_02 series)
//   i  = industrial  (s_03 series)
//   m  = mixed — noise picks residential/commercial/industrial
//   T  = tower — auto-assigns next tower variant from registry
//   A-L = specific tower variant (A=tower_01, B=tower_02, ... L=tower_12)
//   S  = unique skyscraper — auto-assigns from the list below
//   1-4 = specific skyscraper (1=skyscraper_06, 2=skyscraper_09, 3=skyscraper_10, 4=skyscraper_11)
//
// Grid reads top-to-bottom = north-to-south (gj 0..16).
// Player spawns facing north from bottom-center.

// Skyscrapers placed as unique buildings (like towers but mid-rise)
const UNIQUE_SKYSCRAPERS = [
  "skyscraper_06",
  "skyscraper_09",
  "skyscraper_10",
  "skyscraper_11",
  "skyscraper_08",
];

const CITY_TEMPLATE = `
. . . . . . . . . . . . . . . . .
. r r r r r r r r r r r r r r r .
. r r r m m m m m m m m m r r r .
. r r m m m m S m m S m m m r r .
. r m m m m m T m m m T m m m r .
. r m m m T m m m m m m m T m r .
. r m m S m m m m m m m m S m r .
. r m m T m m m m m m m T m m r .
. r m m m m m m m m m m m m m r .
. r m m m T m m m m m T m m m r .
. r m m S m m m m m m m m S m r .
. r m m m T m m m m m m m T m r .
. r m m m m m T m m m T m m m r .
. r r m m m m m m m m m m m r r .
. r r r m m m m m m m m m r r r .
. r r r r r r r r r r r r r r r .
. . . . . . . . . . . . . . . . .
`;

// ── Template parser ──────────────────────────────────────────────────────────

type BlockType =
  | "empty"
  | "residential"
  | "commercial"
  | "industrial"
  | "mixed"
  | "tower";

type ParsedBlock = {
  type: BlockType;
  towerKey?: string; // set for tower blocks
};

function parseTemplate(template: string): ParsedBlock[][] {
  const towerVariants = NEW_TOWER_SERIES.variants.map((v) => v.key);
  // Map A-L to specific tower variants
  const specificTowerMap = new Map<string, string>();
  for (let i = 0; i < towerVariants.length && i < 12; i++) {
    specificTowerMap.set(String.fromCharCode(65 + i), towerVariants[i]);
  }
  // Map 1-4 to specific unique skyscrapers
  const specificSkyscraperMap = new Map<string, string>();
  for (let i = 0; i < UNIQUE_SKYSCRAPERS.length; i++) {
    specificSkyscraperMap.set(String(i + 1), UNIQUE_SKYSCRAPERS[i]);
  }

  let autoTowerIndex = 0;
  let autoSkyscraperIndex = 0;

  const rows = template
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/));

  return rows.map((row) =>
    row.map((cell): ParsedBlock => {
      switch (cell) {
        case ".":
          return { type: "empty" };
        case "r":
          return { type: "residential" };
        case "c":
          return { type: "commercial" };
        case "i":
          return { type: "industrial" };
        case "m":
          return { type: "mixed" };
        case "T": {
          const key = towerVariants[autoTowerIndex % towerVariants.length];
          autoTowerIndex++;
          return { type: "tower", towerKey: key };
        }
        case "S": {
          const key =
            UNIQUE_SKYSCRAPERS[autoSkyscraperIndex % UNIQUE_SKYSCRAPERS.length];
          autoSkyscraperIndex++;
          return { type: "tower", towerKey: key };
        }
        default: {
          // Check for specific tower letter (A-L)
          const specific = specificTowerMap.get(cell);
          if (specific) {
            return { type: "tower", towerKey: specific };
          }
          // Check for specific skyscraper digit (1-4)
          const skyscraper = specificSkyscraperMap.get(cell);
          if (skyscraper) {
            return { type: "tower", towerKey: skyscraper };
          }
          return { type: "empty" };
        }
      }
    }),
  );
}

// ── Layout generator ─────────────────────────────────────────────────────────

/**
 * Generate a finite city layout from the template string.
 * The template gives full visual control over every block.
 *
 * @param seed - World seed for noise-based variation within blocks
 * @param gridSize - Ignored when template is provided (derived from template)
 */
export function generateLayout(
  seed: number = 9746,
  _gridSize: number = 17,
): FiniteCityLayout {
  const grid = parseTemplate(CITY_TEMPLATE);
  const gridSize = grid.length;

  const noise = createPerlin(seed);
  noise.noiseDetail(8, 0.5);

  const buildings: FiniteBuildingPlacement[] = [];
  const groundTiles: { x: number; z: number }[] = [];
  const storefronts: FiniteStorefrontPlacement[] = [];

  const halfGrid = Math.floor(gridSize / 2);

  for (let gj = 0; gj < gridSize; gj++) {
    const row = grid[gj];
    if (!row) continue;

    for (let gi = 0; gi < row.length; gi++) {
      const block = row[gi];
      const blockX = (gi - halfGrid) * CELL_SIZE;
      const blockZ = (gj - halfGrid) * CELL_SIZE;

      // Ground tile for every non-empty block
      if (block.type !== "empty") {
        groundTiles.push({
          x: blockX + CITY_BLOCK_SIZE / 2,
          z: blockZ + CITY_BLOCK_SIZE / 2,
        });
      }

      if (block.type === "empty") {
        continue;
      }

      if (block.type === "tower" && block.towerKey) {
        // ── Tower ────────────────────────────────────────────────────────
        const wx = blockX + CITY_BLOCK_SIZE / 2;
        const wz = blockZ + CITY_BLOCK_SIZE / 2;

        const rotateNoise = fixNoise(noise.noise(wx * 4, wz * 4));
        const rotate = getRotationFromNoise(rotateNoise);

        buildings.push({
          modelKey: block.towerKey,
          materialKey: `__embedded_${block.towerKey}`,
          x: wx,
          z: wz,
          scaleX: 1,
          scaleY: 1,
          scaleZ: 1,
          rotationY: (rotate * Math.PI) / 180,
          gi,
          gj,
        });
      } else {
        // ── Small buildings — 2×2 grid per block ─────────────────────────
        placeSmallBuildings(block.type, blockX, blockZ, gi, gj, noise, buildings);
      }

      // Storefronts — temporarily disabled
      // const subtypeNoise = fixNoise(noise.noise(blockX * 5, blockZ * 5));
      // if (blockX % (CELL_SIZE * 2) === 0 && blockZ % (CELL_SIZE * 2) === 0) {
      //   const sfMats = [
      //     "storefronts",
      //     "building_02",
      //     "building_03",
      //     "building_07",
      //   ];
      //   const mat = pickFromNoise(sfMats, subtypeNoise) ?? "storefronts";
      //   storefronts.push({
      //     x: blockX + CITY_BLOCK_SIZE + ROAD_WIDTH / 2,
      //     z: blockZ + CITY_BLOCK_SIZE + ROAD_WIDTH / 2,
      //     materialKey: mat,
      //   });
      // }
    }
  }

  const worldExtent = halfGrid * CELL_SIZE + CELL_SIZE;

  return {
    name: `Generated City (seed: ${seed}, ${gridSize}x${gridSize})`,
    bounds: {
      minX: -worldExtent,
      maxX: worldExtent,
      minZ: -worldExtent,
      maxZ: worldExtent,
    },
    spawn: {
      x: -ROAD_WIDTH / 2,
      z: -(halfGrid * CELL_SIZE) + ROAD_WIDTH / 2,
      rotationY: Math.PI,
    },
    buildings,
    groundTiles,
    storefronts,
  };
}

// ── Small building placement ─────────────────────────────────────────────────

type NoiseGen = {
  noise: (x: number, y: number) => number;
};

function placeSmallBuildings(
  blockType: BlockType,
  blockX: number,
  blockZ: number,
  gi: number,
  gj: number,
  noise: NoiseGen,
  buildings: FiniteBuildingPlacement[],
): void {
  for (let i = 0; i < 2; i++) {
    for (let j = 0; j < 2; j++) {
      const xOff = i * (CITY_BLOCK_SIZE / 2) + CITY_BLOCK_SIZE / 4;
      const zOff = j * (CITY_BLOCK_SIZE / 2) + CITY_BLOCK_SIZE / 4;
      const wx = blockX + xOff;
      const wz = blockZ + zOff;

      const rotateNoise = fixNoise(noise.noise(wx * 5, wz * 5));
      const rotate = getRotationFromNoise(rotateNoise);
      const scale = 0.75 + rotateNoise * 0.45;

      const typeNoise = fixNoise(
        noise.noise(wx * NOISEFACTOR, wz * NOISEFACTOR),
      );
      const subtypeNoise = fixNoise(noise.noise(wx * 5, wz * 5));

      const type = selectSmallBuilding(blockType, typeNoise, subtypeNoise);

      // Enlarge residential/commercial uniformly so their windows read larger.
      const windowScale =
        type.startsWith("s_01_") || type.startsWith("s_02_")
          ? SMALL_BUILDING_WINDOW_SCALE
          : 1;

      const matNoise = fixNoise(noise.noise(wx * -3, wz * -3));
      const matKey = getBuildingMatKey(matNoise);

      buildings.push({
        modelKey: type,
        materialKey: matKey,
        x: wx,
        z: wz,
        scaleX: windowScale,
        scaleY: scale * windowScale,
        scaleZ: windowScale,
        rotationY: (rotate * Math.PI) / 180,
        gi,
        gj,
      });
    }
  }
}

function selectSmallBuilding(
  blockType: BlockType,
  typeNoise: number,
  subtypeNoise: number,
): string {
  // For explicit types, use that series directly
  // For "mixed", use noise to pick the series
  let series: "residential" | "commercial" | "industrial";

  if (blockType === "mixed") {
    if (typeNoise < 0.4) series = "residential";
    else if (typeNoise < 0.75) series = "commercial";
    else series = "industrial";
  } else {
    series = blockType as "residential" | "commercial" | "industrial";
  }

  switch (series) {
    case "residential":
      if (subtypeNoise < 0.33) return "s_01_01";
      if (subtypeNoise < 0.66) return "s_01_02";
      return "s_01_03";
    case "commercial":
      if (subtypeNoise < 0.33) return "s_02_01";
      if (subtypeNoise < 0.66) return "s_02_02";
      return "s_02_03";
    case "industrial":
      if (subtypeNoise < 0.143) return "s_03_01";
      if (subtypeNoise < 0.286) return "s_03_02";
      if (subtypeNoise < 0.429) return "s_03_03";
      if (subtypeNoise < 0.571) return "s_03_04";
      if (subtypeNoise < 0.714) return "s_03_05";
      if (subtypeNoise < 0.857) return "s_03_06";
      return "s_03_07";
  }
}
