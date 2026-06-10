import type { FiniteCityLayout } from "../../config/cityLayouts";
import {
  SMALL_ADS_BY_BUCKET,
  smallAdMatKey,
  type SmallAdBucket,
  type SmallAdMeta,
} from "../../config/smallAds";
import { CITY_BLOCK_SIZE, CELL_SIZE } from "../../config/world";
import type { WallAd } from "./types";

/**
 * Procedural wall ads on small buildings (s_01 / s_02 / s_03). Currently
 * just the small-signs pass; the older ADS_META holo-on-small pass was
 * removed because it reused tower-billboard art at miniature scale on
 * inner walls, which read as "tiny copies of the big ads."
 */
export function resolveProceduralWallAds(
  layout: FiniteCityLayout,
  worldSeed: number,
): WallAd[] {
  return resolveSmallSignsProcedural(layout, worldSeed);
}

// ── Small-signs procedural pass ─────────────────────────────────────────────
//
// Places PNG neon signs / posters from SMALL_ADS_META on the lower floors
// of small buildings (s_01 / s_02 / s_03). Each small building sits in a
// quadrant of its block, so it has exactly two world-cardinal sides that
// face a road — those are the only sides we use, so signs stay visible
// from the street rather than getting buried between buildings.
//
// Bucket-specific placement rules:
//   • 1-4 tall vertical neon  → near a wall edge, sometimes hanging out
//                               past the wall (DoubleSide handles back face)
//   • 4-1 wide horizontal     → centered on the wall, low signage band or
//                               occasionally near the top like a logo strip
//   • 3-2 / 2-3 posters       → mid-low, near edge or centered

type SignTier = {
  spawn: number;
  bucketWeights: Record<SmallAdBucket, number>;
};

const SIGN_TIERS: Record<string, SignTier> = {
  residential: {
    spawn: 0.5,
    bucketWeights: { "1-4": 3, "2-3": 2, "3-2": 1, "4-1": 1 },
  },
  commercial: {
    spawn: 0.7,
    bucketWeights: { "1-4": 3, "2-3": 1.5, "3-2": 1.5, "4-1": 2 },
  },
};

// Procedural small-signs only go on the 4-per-block residential/commercial
// GLBs. Skyscrapers and towers (1-per-block) carry manual ads instead, so they
// return null here.
function classifySignTier(modelKey: string): SignTier | null {
  if (modelKey.startsWith("residential_")) return SIGN_TIERS.residential;
  if (modelKey.startsWith("commercial_")) return SIGN_TIERS.commercial;
  return null;
}

/**
 * Each small building lives in one of four 64×64 quadrants of its 128×128
 * city block. Derived from world position so we don't need extra metadata
 * on the placement; works whether `gi`/`gj` are present or not.
 *
 * Returns the two cardinal world directions that face open road:
 *   • i=0 → west road (-X)        i=1 → east road (+X)
 *   • j=0 → north road (-Z)       j=1 → south road (+Z)
 *
 * Each direction is the world Y rotation that orients a plane's +Z normal
 * outward toward that road.
 */
export function getRoadFacingDirs(x: number, z: number): number[] {
  const localX = ((x % CELL_SIZE) + CELL_SIZE) % CELL_SIZE;
  const localZ = ((z % CELL_SIZE) + CELL_SIZE) % CELL_SIZE;
  const half = CITY_BLOCK_SIZE / 2;
  const dirs: number[] = [];
  // X side: i=0 (west) → rotationY = -π/2  ;  i=1 (east) → rotationY = π/2
  dirs.push(localX < half ? -Math.PI / 2 : Math.PI / 2);
  // Z side: j=0 (north) → rotationY = π    ;  j=1 (south) → rotationY = 0
  dirs.push(localZ < half ? Math.PI : 0);
  return dirs;
}

/**
 * Per-model half-extents of small buildings (model-local space). A single
 * global wall radius makes signs float on narrow buildings or clip into wide
 * ones, so models with a measured footprint can override it here. The current
 * residential/commercial GLBs are all ~50–62 u wide (half ≈ 25–31), close
 * enough to the fallback that none need an entry yet — add one if a sign
 * visibly floats or clips. Building runtime rotation (0/90/180/270°) swaps
 * which axis maps to world x vs z — see signWallRadius below.
 */
const SMALL_BUILDING_HALF_EXTENTS: Record<
  string,
  { halfX: number; halfZ: number }
> = {};

/**
 * Optional per-model override that forces ads onto a specific section of
 * the building (stepped / wedding-cake GLBs where the attachable wall isn't
 * at the base). When present, the ad's y placement and wall radius are taken
 * from here, bypassing the bucket y-rule and the half-extents lookup.
 *
 *   y      — world Y for the ad center (pre-scaleY; gets multiplied by
 *            b.scaleY at runtime)
 *   halfX  — half-extent of the wall at this y, along the model's local X
 *   halfZ  — half-extent at this y, along the model's local Z
 */
const SMALL_BUILDING_AD_ATTACH: Partial<
  Record<string, { y: number; halfX: number; halfZ: number }>
> = {
};

/**
 * Distance from the building's center to the wall whose outward normal
 * points along the given world rotation. Accounts for the building's own
 * Y rotation (0/90/180/270 deg) swapping which local axis aligns with
 * which world axis.
 */
function signWallRadius(
  modelKey: string,
  buildingRotationY: number,
  signRotationY: number,
): number {
  const attach = SMALL_BUILDING_AD_ATTACH[modelKey];
  const ext = attach ?? SMALL_BUILDING_HALF_EXTENTS[modelKey];
  if (!ext) return 29.5; // fallback for unknown models
  // After rotating by buildingRotationY, the local x-axis aligns with world
  // x when rotation is ~0/π and with world z when ~±π/2.
  const swap =
    Math.abs(Math.sin(buildingRotationY)) >
    Math.abs(Math.cos(buildingRotationY));
  const worldHalfX = swap ? ext.halfZ : ext.halfX;
  const worldHalfZ = swap ? ext.halfX : ext.halfZ;
  // Sign plane's outward unit vector = (sin(rotY), cos(rotY)). For axis-
  // aligned faces (±π/2 or 0/π) one of sin/cos is ~1, the other ~0.
  const dx = Math.abs(Math.sin(signRotationY));
  return dx > 0.5 ? worldHalfX : worldHalfZ;
}

function weightedPick<T extends string>(
  weights: Record<T, number>,
  r: number,
): T {
  const entries = Object.entries(weights) as [T, number][];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  const target = r * total;
  for (const [key, w] of entries) {
    acc += w;
    if (target < acc) return key;
  }
  return entries[entries.length - 1][0];
}

export function resolveSmallSignsProcedural(
  layout: FiniteCityLayout,
  worldSeed: number,
): WallAd[] {
  const ads: WallAd[] = [];

  // Separate LCG branch so this pass doesn't shift the existing holo-ads
  // layout when SMALL_ADS_META grows.
  let seed = (worldSeed ^ 0x5169) >>> 0;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  const pickFrom = <T>(arr: readonly T[]): T =>
    arr[Math.floor(rand() * arr.length)];

  // Tiny clearance to keep the plane just off the wall — avoids z-fighting
  // without leaving a visible gap.
  const WALL_CLEARANCE = 0.4;
  // Max lateral slide along the wall before the plane corner pokes past the
  // building edge. ~24 leaves a small margin even on the narrower models.
  const MAX_SIDE_OFFSET = 24;

  for (const b of layout.buildings) {
    const tier = classifySignTier(b.modelKey);
    if (!tier) continue;
    if (rand() > tier.spawn) continue;

    const bucket = weightedPick(tier.bucketWeights, rand());
    const pool = SMALL_ADS_BY_BUCKET[bucket];
    if (pool.length === 0) continue;
    const meta: SmallAdMeta = pickFrom(pool);

    // Pick one of the two road-facing world directions.
    const roadDirs = getRoadFacingDirs(b.x, b.z);
    const rotationY = roadDirs[Math.floor(rand() * roadDirs.length)];

    // Per-face wall radius — varies by model (some are rectangular) and by
    // building rotation (90°/270° swaps the x/z extents). Plus a tiny
    // clearance to keep the plane just off the wall surface.
    const wallRadius =
      signWallRadius(b.modelKey, b.rotationY, rotationY) + WALL_CLEARANCE;

    // Models with a manual attach point force the ad to a specific y level
    // (e.g. onto a wider mid-building bulge), overriding the bucket's
    // lower-floor rule.
    const attach = SMALL_BUILDING_AD_ATTACH[b.modelKey];

    // Per-bucket sizing + placement.
    let height: number;
    let width: number;
    let y: number;
    let offsetOut = wallRadius;
    let offsetSide = 0;

    switch (bucket) {
      case "1-4": {
        // Tall vertical neon — building edge, sometimes a perpendicular
        // blade. Heights span lower floors; width stays narrow (4-6.5 units).
        height = (18 + rand() * 14) * b.scaleY; // 18-32
        width = height * meta.aspect;
        // Mid-point puts the bottom near street level; cap so top stays
        // within the lower portion of the building (~40 units up).
        y = (4 + rand() * 6) * b.scaleY + height / 2;
        // ~35% chance to mount as a true perpendicular blade sign rather
        // than flush against the wall. Blades use a different rotation +
        // anchoring, so push them as their own ad and skip the shared
        // flush placement below.
        if (rand() < 0.35) {
          // Blade hangs from a wall corner, sign face oriented along the
          // road (90° from the wall normal). Plane's width axis extends
          // outward from the wall surface.
          const sideAnchor = (rand() < 0.5 ? -1 : 1) * MAX_SIDE_OFFSET;
          const outSin = Math.sin(rotationY);
          const outCos = Math.cos(rotationY);
          const alongSin = Math.cos(rotationY);
          const alongCos = -Math.sin(rotationY);
          // Wall point at the corner, then push the plane's center out by
          // width/2 so the inner edge meets the wall.
          const wallPx = b.x + outSin * wallRadius + alongSin * sideAnchor;
          const wallPz = b.z + outCos * wallRadius + alongCos * sideAnchor;
          // Buildings with an attach override pin blades to that y too.
          const bladeY = attach ? attach.y * b.scaleY : y;
          ads.push({
            matKey: smallAdMatKey(meta.id),
            aspect: meta.aspect,
            x: wallPx + outSin * (width / 2),
            y: bladeY,
            z: wallPz + outCos * (width / 2),
            width,
            height,
            // Plane normal points along the wall — face is visible from
            // road traffic on either side (DoubleSide).
            rotationY: rotationY + Math.PI / 2,
            rotationX: 0,
          });
          continue;
        }
        // Flush variant — push toward a wall edge; leave the sign's own
        // half-width as margin so it doesn't poke past the corner.
        const sideRoom = Math.max(0, MAX_SIDE_OFFSET - width / 2);
        offsetSide =
          (rand() < 0.5 ? -1 : 1) * (sideRoom * (0.6 + rand() * 0.4));
        break;
      }
      case "4-1": {
        // Wide horizontal — signage band over the storefront. 2× the size
        // of other buckets — these read as the dominant storefront sign.
        height = (5 + rand() * 3) * b.scaleY; // 4-7
        width = height * meta.aspect;
        // Cap width to wall extent (~58 units). If the picked height makes
        // the sign too wide, shrink it proportionally.
        const maxW = MAX_SIDE_OFFSET * 2 + 4;
        if (width > maxW) {
          const scale = maxW / width;
          width *= scale;
          height *= scale;
        }
        // Most sit at storefront height; small chance of a roof-line band.
        const onTop = rand() < 0.15;
        y = onTop
          ? (38 + rand() * 6) * b.scaleY
          : (6 + rand() * 8) * b.scaleY + height / 2;
        // Roughly centered; small slide for variety.
        offsetSide = (rand() - 0.5) * 8;
        break;
      }
      case "3-2": {
        // Landscape poster — lower-mid, slightly off-center.
        height = (8 + rand() * 5) * b.scaleY; // 8-13
        width = height * meta.aspect;
        const maxW = MAX_SIDE_OFFSET * 2;
        if (width > maxW) {
          const scale = maxW / width;
          width *= scale;
          height *= scale;
        }
        y = (6 + rand() * 8) * b.scaleY + height / 2;
        offsetSide = (rand() - 0.5) * (MAX_SIDE_OFFSET - width / 2) * 0.8;
        break;
      }
      case "2-3": {
        // Portrait poster — near edge or centered, mid-low.
        height = (12 + rand() * 8) * b.scaleY; // 12-20
        width = height * meta.aspect;
        y = (5 + rand() * 8) * b.scaleY + height / 2;
        offsetSide =
          (rand() - 0.5) * Math.max(0, MAX_SIDE_OFFSET - width / 2) * 1.4;
        break;
      }
    }

    // Convert wall-relative offsets to world deltas. sin/cos with rotationY:
    //   forward (out from wall) = (sin, cos)
    //   right (along wall)      = (cos, -sin)
    const sin = Math.sin(rotationY);
    const cos = Math.cos(rotationY);
    const dx = sin * offsetOut + cos * offsetSide;
    const dz = cos * offsetOut - sin * offsetSide;
    // Attach overrides the bucket-driven y for this model.
    const finalY = attach ? attach.y * b.scaleY : y;

    ads.push({
      matKey: smallAdMatKey(meta.id),
      aspect: meta.aspect,
      x: b.x + dx,
      y: finalY,
      z: b.z + dz,
      width,
      height,
      rotationY,
      rotationX: 0,
    });
  }

  return ads;
}
