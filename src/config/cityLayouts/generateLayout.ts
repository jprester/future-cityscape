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
//   X  = rooftop vantage building (the player spawns on its roof, dead center)
//
// Grid reads top-to-bottom = north-to-south (gj 0..16).
//
// Layout intent ("rooftop view"): a mid-sized vantage tower sits dead center.
// The player spawns on its roof and looks out over a dense, radial forest of
// towers (T) that rings the vantage on all sides, fading through a skyscraper
// belt (S) into lower commercial (c) and residential (r) blocks toward the
// fog-shrouded edges — an impressive skyline in every direction.

// Skyscrapers placed as unique buildings (like towers but mid-rise)
const UNIQUE_SKYSCRAPERS = [
  "skyscraper_06",
  "skyscraper_09",
  "skyscraper_10",
  "skyscraper_11",
  "skyscraper_08",
];

// The center vantage building the player stands on. A flat-topped, mid-sized
// skyscraper so the surrounding towers read as taller and the player can see
// out over the cardinal-facing skyscrapers into the tower forest beyond.
const VANTAGE_MODEL = "skyscraper_06";

const CITY_TEMPLATE = `
. . . . . . . . . . . . . . . . .
. r r r r r r r r r r r r r r r .
. r c c c c c c c c c c c c c r .
. r c S S S S S S S S S S S c r .
. r c S T T T T T T T T T S c r .
. r c S T T T T T T T T T S c r .
. r c S T T T T T T T T T S c r .
. r c S T T T T S T T T T S c r .
. r c S T T T S X S T T T S c r .
. r c S T T T T S T T T T S c r .
. r c S T T T T T T T T T S c r .
. r c S T T T T T T T T T S c r .
. r c S T T T T T T T T T S c r .
. r c S S S S S S S S S S S c r .
. r c c c c c c c c c c c c c r .
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
  | "tower"
  | "vantage";

type ParsedBlock = {
  type: BlockType;
  towerKey?: string; // set for tower / vantage blocks
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
        case "X":
          return { type: "vantage", towerKey: VANTAGE_MODEL };
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

  // Captured when the vantage ("X") block is placed, so the player can spawn on
  // its roof. The roof height is resolved at runtime from the model's bounding
  // box (see FiniteCitySystem), so we only need its position + Y scale here.
  let vantage: { x: number; z: number; modelKey: string; scaleY: number } | null =
    null;

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

      if (
        (block.type === "tower" || block.type === "vantage") &&
        block.towerKey
      ) {
        // ── Tower / vantage ──────────────────────────────────────────────
        const wx = blockX + CITY_BLOCK_SIZE / 2;
        const wz = blockZ + CITY_BLOCK_SIZE / 2;

        // The vantage building keeps a fixed (unrotated) orientation so the
        // player spawns on a predictable, axis-aligned roof; towers jitter.
        const rotate =
          block.type === "vantage"
            ? 0
            : getRotationFromNoise(fixNoise(noise.noise(wx * 4, wz * 4)));

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

        if (block.type === "vantage") {
          vantage = { x: wx, z: wz, modelKey: block.towerKey, scaleY: 1 };
        }
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

  // Spawn on the vantage building's roof when the template defines one ("X").
  // The roof Y is resolved from the model bounding box at runtime; here we pass
  // the model key + Y scale so FiniteCitySystem can compute it. Falls back to a
  // street-level spawn at the south edge for layouts without a vantage block.
  const spawn = vantage
    ? {
        x: vantage.x,
        z: vantage.z,
        rotationY: Math.PI,
        roofModelKey: vantage.modelKey,
        roofScaleY: vantage.scaleY,
      }
    : {
        x: -ROAD_WIDTH / 2,
        z: -(halfGrid * CELL_SIZE) + ROAD_WIDTH / 2,
        rotationY: Math.PI,
      };

  return {
    name: `Generated City (seed: ${seed}, ${gridSize}x${gridSize})`,
    bounds: {
      minX: -worldExtent,
      maxX: worldExtent,
      minZ: -worldExtent,
      maxZ: worldExtent,
    },
    spawn,
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
