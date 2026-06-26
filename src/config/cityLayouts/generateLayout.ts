import {
  createPerlin,
  clamp,
  mapRange,
  pickFromNoise,
  getRotationFromNoise,
} from "../../utils";
import {
  RESIDENTIAL_SERIES,
  COMMERCIAL_SERIES,
  SKYSCRAPER_SERIES,
  TOWER_SERIES,
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

const NOISEFACTOR = 0.0017;
const CELL_SIZE = CITY_BLOCK_SIZE + ROAD_WIDTH;

// Residential & commercial blocks each place 4 noise-picked GLB models per
// block. The candidate keys are derived straight from the registry so adding a
// model there is the only edit needed. All four categories are GLB with
// embedded materials, so placed buildings always use their "__embedded_{key}".
const RESIDENTIAL_KEYS = RESIDENTIAL_SERIES.variants.map((v) => v.key);
const COMMERCIAL_KEYS = COMMERCIAL_SERIES.variants.map((v) => v.key);

// ── City template ────────────────────────────────────────────────────────────
//
// Each character defines what occupies a city block:
//
//   .  = empty (no buildings)
//   r  = residential block (4 noise-picked residential GLBs)
//   c  = commercial block  (4 noise-picked commercial GLBs)
//   m  = mixed — noise picks residential OR commercial per sub-building
//   T   = tower — auto-assigns the next UNUSED tower model (each placed once)
//   T07 = a SPECIFIC tower, by registry number      (T07 -> tower_07)
//   S   = skyscraper — auto-assigns the next UNUSED skyscraper (each placed once)
//   S03 = a SPECIFIC skyscraper, by registry number (S03 -> skyscraper_03)
//   X  = rooftop vantage building (the player spawns on its roof, dead center)
//
// Cells are whitespace-separated, so the multi-char T##/S## tokens just work.
// The number is the registry key suffix (see buildingRegistry.ts), 1- or
// 2-digit, so `T7` and `T07` are equivalent. Auto `T`/`S` cells skip any model
// you placed explicitly, so every tower/skyscraper still appears at most once.
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

const TOWER_POOL = dedupeByModel(TOWER_SERIES.variants);
const SKYSCRAPER_POOL = dedupeByModel(SKYSCRAPER_SERIES.variants).filter(
  (key) => key !== RESERVED_SKYSCRAPER,
);

// Tight, dense downtown so the skyline reads full from the roof: a mixed (m)
// core fills the city — residential/commercial picked by noise — interleaved
// with a close ring of unique skyscrapers (S) and unique towers (T) as the
// dominant skyline. Residential (r) sits only on the outer rings — the
// fog-edge outskirts. Each S/T is a distinct model, placed at most once.
// Fixed-width grid: every cell is padded to a 3-char field (the widest token,
// e.g. "T07"/"S03"), so columns stay aligned as a readable map even when some
// cells are multi-char specific-model tokens. Cells are whitespace-separated,
// so the exact padding is cosmetic — keep them lined up when hand-editing.
const CITY_TEMPLATE = `
.   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
.   r   r   r   r   r   r   r   r   r   r   r   r   r   r   r   .
.   r   r   r   r   r   r   r   r   r   r   r   r   r   r   r   .
.   r   r   c   c   c   c   m   m   m   m   c   c   c   r   r   .
.   r   r   m   T01 c   T02 c   c   T03 c   m   T04 m   r   r   .
.   r   r   m   c   S01 c   S02 m   c   S03 m   m   m   r   r   .
.   r   r   m   c   r   c   c   c   r   c   S04 T05 m   r   r   .
.   r   r   m   T06 S05 c   c   c   c   r   m   m   m   r   r   .
.   r   r   m   c   c   c   c   X   c   c   S06 m   m   r   r   .
.   r   r   m   c   S08 c   r   c   c   s12   m   T07 m   r   r   .
.   r   r   m   T08 c   r   c   c   c   c   S16 m   m   r   r   .
.   r   r   m   c   T04 c   c   S11 c   S10 m   m   m   r   r   .
.   r   r   m   T09 c   c   T10 m   c   T11 m   T12 m   r   r   .
.   r   r   c   c   r   c   c   r   S09 c   c   c   c   r   r   .
.   r   r   r   r   r   r   r   r   r   r   r   r   r   r   r   .
.   r   r   r   r   r   r   r   r   r   r   r   r   r   r   r   .
.   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .   .
`;

// ── Template parser ──────────────────────────────────────────────────────────

type BlockType =
  | "empty"
  | "residential"
  | "commercial"
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

// Every key the registry actually defines, so explicit T##/S## tokens can be
// validated. Explicit placement allows ANY registry key — including ones the
// auto pool excludes (the reserved vantage skyscraper, or variants that dedupe
// to a shared GLB) — since picking those on purpose is the whole point.
const TOWER_KEYS = new Set(TOWER_SERIES.variants.map((v) => v.key));
const SKYSCRAPER_KEYS = new Set(SKYSCRAPER_SERIES.variants.map((v) => v.key));

// `T07` -> "tower_07", `S3` -> "skyscraper_03". Returns null for any non-token
// cell. The numeric suffix is the registry key number, padded to 2 digits.
function parseSpecificToken(
  cell: string,
): { kind: "tower" | "skyscraper"; key: string } | null {
  const m = /^([TS])(\d{1,2})$/.exec(cell);
  if (!m) return null;
  const kind = m[1] === "T" ? "tower" : "skyscraper";
  const key = `${kind}_${m[2].padStart(2, "0")}`;
  return { kind, key };
}

function warnUnknownToken(cell: string): void {
  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.warn(
      `CITY_TEMPLATE: '${cell}' names a building model that doesn't exist in ` +
        `the registry; that block was left empty.`,
    );
  }
}

function parseTemplate(template: string): ParsedBlock[][] {
  const rows = template
    .trim()
    .split("\n")
    .map((line) => line.trim().split(/\s+/));

  // First pass: collect every model placed explicitly (T##/S##) so the auto
  // `T`/`S` cells can skip them and the "each model at most once" guarantee
  // holds even when explicit and auto cells are mixed in the same layout.
  const explicit = new Set<string>();
  for (const row of rows) {
    for (const cell of row) {
      const tok = parseSpecificToken(cell);
      if (!tok) continue;
      const valid =
        tok.kind === "tower"
          ? TOWER_KEYS.has(tok.key)
          : SKYSCRAPER_KEYS.has(tok.key);
      if (valid) explicit.add(tok.key);
    }
  }

  // Auto-fill queues: pool order, minus anything placed explicitly. Each model
  // is placed at most once, so these indices never wrap.
  const autoTowers = TOWER_POOL.filter((k) => !explicit.has(k));
  const autoSkyscrapers = SKYSCRAPER_POOL.filter((k) => !explicit.has(k));
  let autoTowerIndex = 0;
  let autoSkyscraperIndex = 0;

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
        // `i` (legacy "industrial") folds into commercial — the industrial
        // category was retired; kept tolerant for any older layout JSON.
        case "i":
          return { type: "commercial" };
        case "m":
          return { type: "mixed" };
        case "T": {
          if (autoTowerIndex >= autoTowers.length) {
            warnExhausted("tower", "T");
            return { type: "empty" };
          }
          return { type: "tower", towerKey: autoTowers[autoTowerIndex++] };
        }
        case "S": {
          if (autoSkyscraperIndex >= autoSkyscrapers.length) {
            warnExhausted("skyscraper", "S");
            return { type: "empty" };
          }
          return {
            type: "tower",
            towerKey: autoSkyscrapers[autoSkyscraperIndex++],
          };
        }
        default: {
          // Specific model token, e.g. `T07` -> tower_07, `S03` -> skyscraper_03.
          const tok = parseSpecificToken(cell);
          if (tok) {
            const valid =
              tok.kind === "tower"
                ? TOWER_KEYS.has(tok.key)
                : SKYSCRAPER_KEYS.has(tok.key);
            if (valid) return { type: "tower", towerKey: tok.key };
            warnUnknownToken(cell);
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

      // Every small building is a GLB with embedded materials. A light per-
      // instance vertical scale (`scale`) adds height variety across the block.
      buildings.push({
        modelKey: type,
        materialKey: `__embedded_${type}`,
        x: wx,
        z: wz,
        scaleX: 1,
        scaleY: scale,
        scaleZ: 1,
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
  // Explicit blocks use their category directly; "mixed" lets noise choose
  // residential vs commercial per sub-building. subtypeNoise then picks the
  // specific GLB variant from that category's registry list.
  let series: "residential" | "commercial";
  if (blockType === "mixed") {
    series = typeNoise < 0.45 ? "residential" : "commercial";
  } else {
    series = blockType as "residential" | "commercial";
  }

  return series === "residential"
    ? pickFromNoise(RESIDENTIAL_KEYS, subtypeNoise)
    : pickFromNoise(COMMERCIAL_KEYS, subtypeNoise);
}
