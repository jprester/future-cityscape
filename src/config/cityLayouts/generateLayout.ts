import {
  createPerlin,
  clamp,
  mapRange,
  pickFromNoise,
  getRotationFromNoise,
} from "../../utils";
import {
  NEW_TOWER_SERIES,
  SKYSCRAPER_SERIES,
  getEmbeddedMaterialKeys,
} from "../buildingRegistry";
import type { BuildingVariant } from "../buildingRegistry";
import { CITY_BLOCK_SIZE, ROAD_WIDTH } from "../world";
import { HUMAN_EYE_HEIGHT_UNITS } from "../scale";
import type {
  FiniteCityLayout,
  FiniteBuildingPlacement,
  FiniteStorefrontPlacement,
} from "./types";

function fixNoise(noise: number): number {
  return clamp(mapRange(noise, 0.2, 0.75, 0, 0.9999), 0, 0.9999);
}

// Small-building models that ship with embedded GLB materials (e.g. the nicer
// s_03_04–07 industrial buildings). These must use their "__embedded_{key}"
// material — the shared OBJ texture material would render them wrong.
const EMBEDDED_MODEL_KEYS = getEmbeddedMaterialKeys();

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
//   T  = tower — assigns the next UNUSED tower model (each placed once, no repeats)
//   A-L = specific tower variant (A=tower_01, B=tower_02, ... L=tower_12)
//   S  = skyscraper — assigns the next UNUSED skyscraper model (each placed once)
//   1-N = specific skyscraper from the de-duplicated pool (1-indexed)
//   X  = rooftop vantage building (the player spawns on its roof, dead center)
//
// Grid reads top-to-bottom = north-to-south (gj 0..16).
//
// Layout intent ("rooftop view"): a mid-sized vantage tower sits dead center.
// Heights rise with distance to create depth — the player spawns on the roof
// and looks out over a low foreground of commercial blocks (c), then a belt of
// mid-rise skyscrapers (S), and finally a tall ring of towers (T) forming the
// distant, fog-shrouded skyline on every side.

// The center vantage the player stands on. It is NOT a GLB building anymore:
// detailed skyscraper roofs taper and have uneven tops, which made the
// edge-blocking unreliable (the player kept walking off the roof). Instead the
// vantage is a simple flat-topped box tower built procedurally (see the
// FiniteCityVantage component) — a guaranteed-flat roof with an exact footprint
// so the player is stopped cleanly at the ledge. The player only ever sees the
// roof, so the shaft below stays a plain rectangle.
//
//   roofY = top/roof surface height (world units); ~128 m at 1.6 u/m.
const VANTAGE_ROOF_Y = 254;
const VANTAGE_WIDTH = 56; // X footprint (~35 m)
const VANTAGE_DEPTH = 52; // Z footprint (~32.5 m)

// One entry per distinct model file (the registry has a few skyscraper variants
// pointing at the same GLB). Towers and skyscrapers are placed at most once each
// — no repeats — so the "T"/"S" template cells draw from these de-duplicated
// pools in order and never wrap. The vantage model is excluded from the
// skyscraper pool so it never appears a second time elsewhere in the city.
function dedupeByModel(variants: BuildingVariant[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const v of variants) {
    const id = v.source?.format === "glb" ? v.source.path : v.key;
    if (seen.has(id)) continue;
    seen.add(id);
    keys.push(v.key);
  }
  return keys;
}

// Kept out of the skyscraper pool so the skyline keeps its authored 11-model
// spread (the pool was sized to the 11 "S" template cells). It used to be the
// GLB vantage building; the vantage is now a procedural box, so this model is
// simply unused — reserved here to avoid disturbing the existing skyline.
const RESERVED_SKYSCRAPER = "skyscraper_06";

const TOWER_POOL = dedupeByModel(NEW_TOWER_SERIES.variants);
const SKYSCRAPER_POOL = dedupeByModel(SKYSCRAPER_SERIES.variants).filter(
  (key) => key !== RESERVED_SKYSCRAPER,
);

// Tight, dense downtown so the skyline reads full from the roof: a mixed (m)
// core fills the city — residential/commercial/industrial picked by noise, so
// every small-building series (incl. the nicer s_03_04–07 GLBs) shows up — with
// a close ring of 11 unique skyscrapers (S, ring 3) and 12 unique towers
// (T, ring 4) as the dominant skyline. Residential (r) sits only on the outer
// rings — the fog-edge outskirts. Each S/T is a distinct model, placed once.
const CITY_TEMPLATE = `
. . . . . . . . . . . . . . . . .
. r r r r r r r r r r r r r r r .
. r r r r r r r r r r r r r r r .
. r r m m m m m m m m m m m r r .
. r r m T m T m m T m m T m r r .
. r r m m S m S m m S m m m r r .
. r r m m m m m m m m S T m r r .
. r r m T S m m m m m m m m r r .
. r r m m m m m X m m S m m r r .
. r r m m S m m m m m m T m r r .
. r r m T m m m m m m S m m r r .
. r r m m S m m S m S m m m r r .
. r r m T m m T m m T m T m r r .
. r r m m m m m m m m m m m r r .
. r r r r r r r r r r r r r r r .
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
  towerKey?: string; // set for tower blocks (the vantage is procedural — no key)
};

function warnExhausted(kind: string, ch: string): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `CITY_TEMPLATE: more '${ch}' cells than unique ${kind} models; ` +
        `extra ${kind} blocks left empty (each model is placed at most once).`,
    );
  }
}

function parseTemplate(template: string): ParsedBlock[][] {
  // Map A-L to specific tower models
  const specificTowerMap = new Map<string, string>();
  for (let i = 0; i < TOWER_POOL.length && i < 12; i++) {
    specificTowerMap.set(String.fromCharCode(65 + i), TOWER_POOL[i]);
  }
  // Map 1-N to specific skyscraper models
  const specificSkyscraperMap = new Map<string, string>();
  for (let i = 0; i < SKYSCRAPER_POOL.length; i++) {
    specificSkyscraperMap.set(String(i + 1), SKYSCRAPER_POOL[i]);
  }

  // Each model is placed at most once — these indices never wrap.
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
          return { type: "vantage" };
        case "r":
          return { type: "residential" };
        case "c":
          return { type: "commercial" };
        case "i":
          return { type: "industrial" };
        case "m":
          return { type: "mixed" };
        case "T": {
          if (autoTowerIndex >= TOWER_POOL.length) {
            warnExhausted("tower", "T");
            return { type: "empty" };
          }
          return { type: "tower", towerKey: TOWER_POOL[autoTowerIndex++] };
        }
        case "S": {
          if (autoSkyscraperIndex >= SKYSCRAPER_POOL.length) {
            warnExhausted("skyscraper", "S");
            return { type: "empty" };
          }
          return {
            type: "tower",
            towerKey: SKYSCRAPER_POOL[autoSkyscraperIndex++],
          };
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

// ── Procedural outskirts ─────────────────────────────────────────────────────
//
// The hand-authored CITY_TEMPLATE is wrapped in a belt of procedurally-typed
// outskirt blocks — low-rise residential/commercial that thins out toward the
// edge so the city dissolves into a fog-shrouded sprawl instead of ending
// abruptly. These feed the exact same instanced-building path as the core
// (placeSmallBuildings), so they cost only a handful of extra draw calls. Bump
// OUTSKIRT_RINGS for a deeper sprawl (watch the camera far-plane at 2800 — rings
// beyond that from the centre vantage are clipped).
const OUTSKIRT_RINGS = 3;
// Base probability a given outskirt cell is empty; grows with each ring out, so
// the sprawl gets sparser the further it is from the core.
const OUTSKIRT_EMPTY_BASE = 0.38;
const OUTSKIRT_EMPTY_PER_RING = 0.13;

function makeOutskirtBlock(
  gi: number,
  gj: number,
  ring: number,
  noise: NoiseGen,
): ParsedBlock {
  // Sparser the further out (fog-edge outskirts).
  const emptyProb = OUTSKIRT_EMPTY_BASE + OUTSKIRT_EMPTY_PER_RING * (ring - 1);
  const emptyNoise = fixNoise(noise.noise(gi * 0.9 + 13.1, gj * 0.9 - 7.3));
  if (emptyNoise < emptyProb) {
    return { type: "empty" };
  }
  // Mostly residential out here, a fair amount of commercial, a little mixed.
  const typeNoise = fixNoise(noise.noise(gi * 0.35, gj * 0.35));
  if (typeNoise < 0.55) return { type: "residential" };
  if (typeNoise < 0.85) return { type: "commercial" };
  return { type: "mixed" };
}

// Wrap the authored core grid in OUTSKIRT_RINGS of procedural blocks, keeping
// the core centered (so the vantage stays at world origin).
function expandWithOutskirts(
  core: ParsedBlock[][],
  noise: NoiseGen,
): ParsedBlock[][] {
  const R = OUTSKIRT_RINGS;
  if (R <= 0) return core;
  const coreSize = core.length;
  const newSize = coreSize + 2 * R;
  const grid: ParsedBlock[][] = [];
  for (let gj = 0; gj < newSize; gj++) {
    const row: ParsedBlock[] = [];
    for (let gi = 0; gi < newSize; gi++) {
      const ci = gi - R;
      const cj = gj - R;
      if (ci >= 0 && ci < coreSize && cj >= 0 && cj < coreSize) {
        // Inside the authored core — copy verbatim.
        row.push(core[cj][ci]);
        continue;
      }
      // How many rings outside the core is this cell (1..R)?
      const outX = ci < 0 ? -ci : ci >= coreSize ? ci - coreSize + 1 : 0;
      const outY = cj < 0 ? -cj : cj >= coreSize ? cj - coreSize + 1 : 0;
      const ring = Math.max(outX, outY);
      row.push(makeOutskirtBlock(gi, gj, ring, noise));
    }
    grid.push(row);
  }
  return grid;
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
  const noise = createPerlin(seed);
  noise.noiseDetail(8, 0.5);

  // Authored core wrapped in a procedural low-rise outskirt belt (fog-edge
  // sprawl). The core stays centered, so the vantage remains at world origin.
  const grid = expandWithOutskirts(parseTemplate(CITY_TEMPLATE), noise);
  const gridSize = grid.length;

  const buildings: FiniteBuildingPlacement[] = [];
  const groundTiles: { x: number; z: number }[] = [];
  const storefronts: FiniteStorefrontPlacement[] = [];

  const halfGrid = Math.floor(gridSize / 2);

  // Captured when the vantage ("X") block is placed, so the player can spawn on
  // its roof. The vantage is a procedural box tower (no GLB), so we just record
  // its center + fixed dimensions; FiniteCitySystem builds + collides it.
  let vantage: { x: number; z: number } | null = null;

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

      if (block.type === "vantage") {
        // ── Vantage ──────────────────────────────────────────────────────
        // No GLB building: the perch is a procedural flat-topped box tower
        // (built + collided in FiniteCitySystem). Just record its center.
        vantage = {
          x: blockX + CITY_BLOCK_SIZE / 2,
          z: blockZ + CITY_BLOCK_SIZE / 2,
        };
      } else if (block.type === "tower" && block.towerKey) {
        // ── Tower ────────────────────────────────────────────────────────
        const wx = blockX + CITY_BLOCK_SIZE / 2;
        const wz = blockZ + CITY_BLOCK_SIZE / 2;

        const rotate = getRotationFromNoise(
          fixNoise(noise.noise(wx * 4, wz * 4)),
        );

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
        placeSmallBuildings(
          block.type,
          blockX,
          blockZ,
          gi,
          gj,
          noise,
          buildings,
        );
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

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(
      `[generateLayout] ${gridSize}x${gridSize} grid → ${buildings.length} buildings ` +
        `(${OUTSKIRT_RINGS} outskirt rings)`,
    );
  }

  // Spawn on the procedural vantage roof when the template defines one ("X").
  // The roof Y is a fixed constant (the box's flat top), so eye height is known
  // here — no runtime model lookup. Falls back to a street-level spawn at the
  // south edge for layouts without a vantage block.
  const spawn = vantage
    ? {
        x: vantage.x,
        z: vantage.z,
        rotationY: Math.PI,
        y: VANTAGE_ROOF_Y + HUMAN_EYE_HEIGHT_UNITS,
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
    vantage: vantage
      ? {
          x: vantage.x,
          z: vantage.z,
          width: VANTAGE_WIDTH,
          depth: VANTAGE_DEPTH,
          roofY: VANTAGE_ROOF_Y,
        }
      : undefined,
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

      // GLB small buildings carry embedded materials; OBJ ones share a texture
      // material picked by noise.
      const matNoise = fixNoise(noise.noise(wx * -3, wz * -3));
      const matKey = EMBEDDED_MODEL_KEYS.has(type)
        ? `__embedded_${type}`
        : getBuildingMatKey(matNoise);

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
