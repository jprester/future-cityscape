import type { BufferGeometry } from "three";
import type { FiniteCityLayout } from "../../config/cityLayouts";
import { ADS_META, adMatKey } from "../../config/ads";
import {
  SMALL_ADS_BY_BUCKET,
  smallAdMatKey,
  type SmallAdBucket,
  type SmallAdMeta,
} from "../../config/smallAds";
import { computeFacadeSlots, type FacadeSlot } from "./facadeSlots";
import { getRoadFacingDirs } from "./resolveProcedural";
import {
  PROC_NEON_VERTICAL,
  PROC_NEON_HORIZONTAL,
  PROC_NEON_FLICKER,
  type ProceduralAdMeta,
} from "./proceduralNeon";
import type { WallAd } from "./types";

// ── Slot-based procedural ads on residential/commercial walls ───────────────
//
// The signage density pass: fills the facade slots found by the scanner
// (facadeSlots.ts) with signs from the existing catalogs. Each road-facing
// slot is subdivided into stacked horizontal bands and each band rolls for
// its own sign, so one facade stacks several signs like a HK street wall.
// Covers the wall ABOVE the street level that resolveProcedural's
// small-signs pass already handles.
//
// Towers/skyscrapers are deliberately excluded: they're unique and prominent,
// so their ads AND company logos are calibrated by hand in WALL_ADS_MANUAL
// (generated logo textures are placed there via `pneonKey`). Procedural
// blocks benefit from quantity; hero buildings benefit from taste. (Earlier
// slot-based tower-ad and tower-logo passes were both removed for exactly
// this reason.)
//
// No per-ad material overrides are used, so every ad stays on the instanced
// render path (one draw call per distinct ad image).

type AssetGetter = {
  getModel: (key: string) => BufferGeometry | undefined;
  loaded: boolean;
};

// Slot→model scan results, cached per model key (geometry never changes).
const slotCache = new Map<string, FacadeSlot[]>();

function getSlots(modelKey: string, assets: AssetGetter): FacadeSlot[] {
  let slots = slotCache.get(modelKey);
  if (!slots) {
    const geometry = assets.getModel(modelKey);
    slots = geometry ? computeFacadeSlots(geometry) : [];
    slotCache.set(modelKey, slots);
  }
  return slots;
}

// Per-category spawn chance, rolled once PER BAND (not per building).
const SMALL_SPAWN: Record<string, number> = {
  residential: 0.4,
  commercial: 0.65,
};
// Vertical band height (world units) a slot is subdivided into — roughly one
// sign per couple of floors, the stacked-signs rhythm of a HK street wall.
const SMALL_BAND_HEIGHT = 38;
// Bands whose center falls below this stay empty: the street-level small-signs
// pass (resolveProcedural) already owns that zone.
const SMALL_MIN_BAND_Y = 24;
const SMALL_MAX_ADS_PER_BUILDING = 4;
// Slightly more clearance than the street pass (0.4) so a procedural sign
// overlapping a street sign never z-fights with it.
const SMALL_CLEARANCE = 0.7;
// Distance falloff from the vantage — far outskirt walls are fog-dimmed
// specks, so don't spend ads there.
const SMALL_FALLOFF_NEAR = 900;
const SMALL_FALLOFF_FAR = 1500;
// Chance a band gets big-catalog billboard art instead of a small sign
// (commercial walls carrying movie-poster-scale ads).
const SMALL_BIG_AD_CHANCE = 0.15;
// Share of neon-bucket picks (1-4 / 4-1) drawn from the code-generated
// catalog (proceduralNeon.ts) instead of the PNG set — unlimited variety.
const PROC_NEON_CHANCE = 0.65;
// Flicker signs are rationed to a few placements near the vantage so the
// dying-tube effect stays special instead of strobing the whole city.
const FLICKER_RADIUS = 320;
const FLICKER_MAX_PLACEMENTS = 8;
const FLICKER_CHANCE = 0.35;

// Bucket mix for band signs, with per-bucket max world heights. Wide formats
// get smaller caps so they read as strips, not banners.
const SMALL_BUCKET_WEIGHTS: Array<{
  bucket: SmallAdBucket;
  weight: number;
  maxHeight: number;
  fill: number;
}> = [
  { bucket: "1-4", weight: 2.5, maxHeight: 34, fill: 0.9 },
  { bucket: "4-1", weight: 2, maxHeight: 10, fill: 0.45 },
  { bucket: "2-3", weight: 1.5, maxHeight: 24, fill: 0.75 },
  { bucket: "3-2", weight: 1.5, maxHeight: 18, fill: 0.6 },
];

/** Smallest rendered sign worth placing (world units tall). */
const SMALL_MIN_AD_HEIGHT = 6;

function angleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

export function resolveSmallSlotAdsProcedural(
  layout: FiniteCityLayout,
  worldSeed: number,
  assets: AssetGetter,
): WallAd[] {
  if (!assets.loaded) return [];

  const ads: WallAd[] = [];

  // Own LCG branch — independent of the street-signs and large-ads layouts.
  let seed = (worldSeed ^ 0x51a7ad) >>> 0;
  const rand = () => {
    seed = (seed * 48271) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  const vantageX = layout.vantage?.x ?? layout.spawn.x;
  const vantageZ = layout.vantage?.z ?? layout.spawn.z;

  const totalBucketWeight = SMALL_BUCKET_WEIGHTS.reduce(
    (s, e) => s + e.weight,
    0,
  );

  let flickerPlaced = 0;

  for (const b of layout.buildings) {
    const category = b.modelKey.startsWith("residential_")
      ? "residential"
      : b.modelKey.startsWith("commercial_")
        ? "commercial"
        : null;
    if (!category) continue;

    const slots = getSlots(b.modelKey, assets);
    if (slots.length === 0) continue;

    const dist = Math.hypot(b.x - vantageX, b.z - vantageZ);
    const distMul =
      dist > SMALL_FALLOFF_FAR ? 0.3 : dist > SMALL_FALLOFF_NEAR ? 0.6 : 1;
    const spawn = SMALL_SPAWN[category] * distMul;

    // Only the two sides facing open road — the other two walls face the
    // block's interior, buried behind the neighboring buildings.
    const roadDirs = getRoadFacingDirs(b.x, b.z);

    let placed = 0;
    for (const slot of slots) {
      if (placed >= SMALL_MAX_ADS_PER_BUILDING) break;

      const angle = b.rotationY + (slot.face * Math.PI) / 2;
      if (!roadDirs.some((d) => angleDiff(angle, d) < 0.26)) continue;

      const lateralScale = slot.face % 2 === 0 ? b.scaleX : b.scaleZ;
      const depthScale = slot.face % 2 === 0 ? b.scaleZ : b.scaleX;
      const slotW = slot.width * lateralScale;
      const slotH = slot.height * b.scaleY;
      const slotYw = slot.centerY * b.scaleY;
      const slotSide = slot.centerSide * lateralScale;
      const offsetOut = slot.depth * depthScale + SMALL_CLEARANCE;

      const tangentX = Math.cos(angle);
      const tangentZ = -Math.sin(angle);
      const outX = Math.sin(angle);
      const outZ = Math.cos(angle);

      // Subdivide the slot into stacked bands; each band is its own roll.
      const bands = Math.max(1, Math.round(slotH / SMALL_BAND_HEIGHT));
      const bandH = slotH / bands;

      for (let i = 0; i < bands; i++) {
        if (placed >= SMALL_MAX_ADS_PER_BUILDING) break;
        const bandY = slotYw - slotH / 2 + (i + 0.5) * bandH;
        if (bandY < SMALL_MIN_BAND_Y) continue;
        if (rand() > spawn) continue;

        // Pick content: occasional big-catalog poster, else a small sign.
        let matKey: string;
        let aspect: number;
        let height: number;
        if (rand() < SMALL_BIG_AD_CHANCE && bandH >= 24) {
          const meta = ADS_META[Math.floor(rand() * ADS_META.length)];
          matKey = adMatKey(meta.id, "billboard");
          aspect = meta.aspect;
          height = Math.min(bandH * 0.8, 30);
        } else {
          // Weighted bucket pick.
          let roll = rand() * totalBucketWeight;
          let entry = SMALL_BUCKET_WEIGHTS[0];
          for (const e of SMALL_BUCKET_WEIGHTS) {
            roll -= e.weight;
            if (roll <= 0) {
              entry = e;
              break;
            }
          }
          // Neon buckets draw from the code-generated catalog part of the
          // time; near the vantage a few of those become flicker signs.
          const isVertical = entry.bucket === "1-4";
          const isNeonBucket = isVertical || entry.bucket === "4-1";
          if (isNeonBucket && rand() < PROC_NEON_CHANCE) {
            let meta: ProceduralAdMeta;
            if (
              isVertical &&
              dist < FLICKER_RADIUS &&
              flickerPlaced < FLICKER_MAX_PLACEMENTS &&
              rand() < FLICKER_CHANCE
            ) {
              meta =
                PROC_NEON_FLICKER[flickerPlaced % PROC_NEON_FLICKER.length];
              flickerPlaced++;
            } else {
              const pool = isVertical
                ? PROC_NEON_VERTICAL
                : PROC_NEON_HORIZONTAL;
              meta = pool[Math.floor(rand() * pool.length)];
            }
            matKey = meta.key;
            aspect = meta.aspect;
          } else {
            const pool = SMALL_ADS_BY_BUCKET[entry.bucket];
            if (pool.length === 0) continue;
            const meta: SmallAdMeta = pool[Math.floor(rand() * pool.length)];
            matKey = smallAdMatKey(meta.id);
            aspect = meta.aspect;
          }
          height = Math.min(bandH * entry.fill, entry.maxHeight);
        }

        // Fit width to the slot, shrinking proportionally if needed.
        let width = height * aspect;
        const maxW = slotW * 0.85;
        if (width > maxW) {
          height *= maxW / width;
          width = maxW;
        }
        if (height < SMALL_MIN_AD_HEIGHT) continue;

        const sideRoom = Math.max(0, slotW * 0.85 - width);
        const offsetSide = slotSide + (rand() - 0.5) * sideRoom;
        const y = bandY + (rand() - 0.5) * Math.max(0, bandH - height) * 0.5;

        ads.push({
          matKey,
          aspect,
          x: b.x + outX * offsetOut + tangentX * offsetSide,
          y,
          z: b.z + outZ * offsetOut + tangentZ * offsetSide,
          width,
          height,
          rotationY: angle,
          rotationX: 0,
        });
        placed++;
      }
    }
  }

  if (import.meta.env.DEV) {
    // eslint-disable-next-line no-console
    console.log(`[wallAds] procedural small-building wall ads: ${ads.length}`);
  }

  return ads;
}
