import type { EmissiveMultipliers, ModelManifestEntry } from "../assets/types";

// ============================================================================
// Types
// ============================================================================

type BuildingModelSource =
  | { format: "obj"; path?: string }
  | {
      format: "glb";
      path: string;
      scale?: number;
      emissiveBase?: number;
    };

export type BuildingVariant = {
  key: string;
  /** Relative selection weight (normalized per-series) */
  weight: number;
  /** Model source. Defaults to OBJ at "models/{key}.obj" if omitted. */
  source?: BuildingModelSource;
  /** Default rotation offset in radians applied to every instance of this model */
  rotation?: { x?: number; y?: number; z?: number };
};

export type BuildingSeries = {
  id: string;
  ads: string[];
  variants: BuildingVariant[];
};

// ============================================================================
// Registry Data
// ============================================================================

// Small buildings — used for asset pipeline derivation ONLY.
// Runtime placement is driven by the city template in generateLayout.ts.
const SMALL_SERIES: BuildingSeries[] = [
  {
    // Residential series
    id: "01",
    ads: ["ads_s_01_01", "ads_s_01_02"],
    variants: [
      {
        key: "s_01_01",
        weight: 1,
        source: {
          format: "obj",
          path: "models/buildings/residential/s_01_01.obj",
        },
      },
      {
        key: "s_01_02",
        weight: 1,
        source: {
          format: "obj",
          path: "models/buildings/residential/s_01_02.obj",
        },
      },
      {
        key: "s_01_03",
        weight: 1,
        source: {
          format: "obj",
          path: "models/buildings/residential/s_01_03.obj",
        },
      },
    ],
  },
  {
    // Commercial series — the old OBJ-with-external-texture models
    // (s_02_01–03) were replaced by 10 GLB commercial buildings the user
    // added under models/buildings/commercial. Each carries embedded
    // materials, sits at ground level (yMin≈0) and is ~32–65 u wide /
    // ~100–220 u tall — the same size class as the s_03_04–08 GLBs, so they
    // drop into the small-building instanced path at scale 1, no rotation.
    id: "02",
    ads: ["ads_s_02_01", "ads_s_02_02"],
    variants: [
      {
        key: "s_02_04",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-1.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_05",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-2.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_06",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-3.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_07",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-4.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_08",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-5.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_09",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-6.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_10",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-7.glb",
          emissiveBase: 0.7,
        },
      },
      {
        key: "s_02_11",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-8.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_02_12",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-9.glb",
          emissiveBase: 1,
        },
      },
      {
        key: "s_02_13",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-10.glb",
          emissiveBase: 0.9,
        },
      },
    ],
  },
  {
    // Industrial series — the old OBJ-with-external-texture models
    // (s_03_01–03) were dropped per the user's request to stop using the
    // textured-OBJ buildings. The s_03_04–08 GLBs (embedded materials) are
    // kept and still appear in industrial blocks alongside the new
    // commercial GLBs (see selectSmallBuilding in generateLayout.ts).
    id: "03",
    ads: ["ads_s_03_01", "ads_s_03_02"],
    variants: [
      {
        key: "s_03_04",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-7.glb",
          emissiveBase: 0.7,
        },
      },
      {
        key: "s_03_05",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-6.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_03_06",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-10.glb",
          emissiveBase: 0.9,
        },
      },
      {
        key: "s_03_07",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-8.glb",
          emissiveBase: 0.9,
        },
      },
      {
        // New commercial-look GLB the user added. Named to follow the GLB
        // small-building slot convention (s_03_NN); it's offered in COMMERCIAL
        // blocks via selectSmallBuilding (see generateLayout.ts).
        key: "s_03_08",
        weight: 1,
        source: {
          format: "glb",
          path: "models/buildings/commercial/2026-commercial-building-9.glb",
          emissiveBase: 1,
        },
      },
    ],
  },
];

// Large buildings — used for both asset derivation AND runtime selection
export const LARGE_SERIES: BuildingSeries = {
  id: "04",
  ads: ["ads_s_04_01", "ads_s_04_02", "ads_s_04_03", "ads_s_04_04"],
  variants: [
    {
      key: "s_04_01",
      weight: 22.5,
      source: { format: "obj", path: "models/buildings/large/s_04_01.obj" },
    },
    {
      key: "s_04_02",
      weight: 22.5,
      source: { format: "obj", path: "models/buildings/large/s_04_02.obj" },
    },
    // { key: "s_04_03", weight: 22.5 },
    {
      key: "s_04_03",
      weight: 22.5,
      source: {
        format: "glb",
        path: "models/buildings/large/sci-fi-corporate-building.glb",
        emissiveBase: 2.0,
      },
    },
    // {
    //   key: "s_04_04",
    //   weight: 5,
    //   source: {
    //     format: "glb",
    //     path: "models/glowing-industrial-building.glb",
    //     emissiveBase: 1.5,
    //   },
    // },
    // {
    //   key: "s_04_07",
    //   weight: 20,
    //   source: {
    //     format: "glb",
    //     path: "models/brutalist-skyscraper-4.glb",
    //     scale: 3.5,
    //     emissiveBase: 2.0,
    //   },
    // },
  ],
};

// Tower buildings — used for both asset derivation AND runtime selection
export const TOWER_SERIES: BuildingSeries = {
  id: "05",
  ads: ["ads_s_05_01", "ads_s_05_02", "ads_s_05_03", "ads_s_05_04"],
  variants: [
    {
      key: "s_05_01",
      weight: 31.7,
      source: { format: "obj", path: "models/buildings/towers/s_05_01.obj" },
    },
    {
      key: "s_05_03",
      weight: 31.6,
      source: { format: "obj", path: "models/buildings/towers/s_05_03.obj" },
    },
    {
      key: "s_05_04",
      weight: 31.7,
      source: {
        format: "glb",
        path: "models/buildings/towers/new-massive-skyscraper.glb",
        scale: 1.7,
        emissiveBase: 2.0,
      },
    },
  ],
};

// Slim tower buildings — tall, narrow footprint (same 2x2 sub-slot as small buildings).
// Downtown-exclusive: only placed in the downtown district by the finite city generator.
// Use embedded GLB materials. Adding a new slim tower = one entry here.
export const SLIM_TOWER_SERIES: BuildingVariant[] = [
  {
    key: "s_06_01",
    weight: 1,
    source: {
      format: "glb",
      path: "models/buildings/slim-towers/brutalist-tower.glb",
      scale: 1,
      emissiveBase: 2.0,
    },
  },
  {
    key: "s_06_02",
    weight: 1,
    source: {
      format: "glb",
      path: "models/buildings/slim-towers/dark_skyscraper_new2.glb",
      scale: 1,
      emissiveBase: 2.0,
    },
  },
  {
    key: "s_06_03",
    weight: 1,
    source: {
      format: "glb",
      // Shares the skyscrapers asset (the old top-level models/ny-office-
      // building.glb never existed → was 404ing; point at the real file).
      path: "models/buildings/skyscrapers/ny-office-building.glb",
      scale: 1,
      emissiveBase: 2.0,
    },
  },
];

// Landmark buildings — unique high-quality assets, one instance per type per city.
// Placed in the downtown zone by the layout generator (guaranteed, noise-driven position).
// Adding a new landmark = one entry here. No other changes needed.
export const LANDMARK_SERIES: BuildingVariant[] = [
  {
    key: "landmark_01",
    weight: 1,
    source: {
      format: "glb",
      path: "models/buildings/landmarks/hero-skyscraper.glb",
      scale: 1.4,
      emissiveBase: 1.0,
    },
  },
  {
    key: "landmark_02",
    weight: 1,
    source: {
      format: "glb",
      path: "models/buildings/landmarks/sci-fi-building-9_1.glb",
      emissiveBase: 2.0,
    },
  },
];

// ── Concentric-city series (finite mode only) ──────────────────────────────

// Skyscrapers — mid-to-tall buildings for financial/business zones.
// All use embedded GLB materials. Adding a new skyscraper = one entry here.
export const SKYSCRAPER_SERIES: BuildingSeries = {
  id: "skyscraper",
  ads: ["ads_s_04_01", "ads_s_04_02", "ads_s_04_03", "ads_s_04_04"],
  variants: [
    {
      key: "skyscraper_01",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/2-cali-plaza-skyscraper.glb",
        emissiveBase: 0.8,
      },
    },
    {
      key: "skyscraper_02",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/cylinder-building.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_03",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/dark-skyscraper.glb",
        emissiveBase: 1.0,
        scale: 1,
      },
    },
    {
      key: "skyscraper_04",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/Frankfurt_Eurotheum_LOD0.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_05",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/Frankfurt_Skyper_LOD0.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_06",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/AON_Center-skyscraper.glb",
        emissiveBase: 0.6,
      },
    },
    {
      key: "skyscraper_07",
      weight: 1,
      source: {
        format: "glb",
        // path: "models/buildings/skyscrapers/quality-skyscraper-office.glb",
        path: "models/buildings/skyscrapers/ny-office-building.glb",
        emissiveBase: 1.5,
        scale: 1.2,
      },
    },
    {
      key: "skyscraper_08",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/lz-skyscraper-2.glb",
        emissiveBase: 1.0,
        scale: 1.5,
      },
    },
    {
      key: "skyscraper_09",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/cylinder-building-2.glb",
        emissiveBase: 0.5,
      },
    },
    {
      key: "skyscraper_10",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/quality-skyscraper-dual.glb",
        emissiveBase: 1.0,
        scale: 1.6,
      },
      rotation: { y: Math.PI * 1.5 },
    },
    {
      key: "skyscraper_11",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/quality-skyscraper-thick.glb",
        emissiveBase: 0.7,
      },
    },
    {
      key: "skyscraper_12",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/dark-skyscraper.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_13",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/dark-skyscraper.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_14",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/cylinder-building.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_15",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/triangular-high-rise.glb",
        emissiveBase: 1.0,
      },
    },
    {
      // New user-added skyscraper. Unique GLB path → adds one entry to the
      // de-duplicated SKYSCRAPER_POOL, so the template gains one extra `S` cell
      // to place it (see CITY_TEMPLATE in generateLayout.ts).
      key: "skyscraper_16",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/synth-skyscraper.glb",
        emissiveBase: 1.0,
      },
    },
  ],
};

// New towers — massive downtown-only buildings for the concentric city center.
// All use embedded GLB materials. Adding a new tower = one entry here.
export const NEW_TOWER_SERIES: BuildingSeries = {
  id: "new_tower",
  ads: ["ads_s_05_01", "ads_s_05_02", "ads_s_05_03", "ads_s_05_04"],
  variants: [
    {
      key: "tower_01",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/cyberpunk-hightower-big-with-logo.glb",
        emissiveBase: 3.0,
      },
    },
    {
      key: "tower_02",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/cyberpunk-hightower-small.glb",
        emissiveBase: 2.0,
      },
    },
    {
      key: "tower_03",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/cyberpunk-skyscraper-top-ads.glb",
        emissiveBase: 2.0,
      },
    },
    {
      key: "tower_04",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/cyerpunk-light-show-skyscraper.glb",
        emissiveBase: 2.0,
      },
      rotation: { y: Math.PI / 2 },
    },
    {
      key: "tower_05",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/quality-skyscraper-rectangular-big.glb",
        emissiveBase: 1.0,
        scale: 1,
      },
    },
    {
      key: "tower_06",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/lz-tower-4.glb",
        emissiveBase: 2.0,
      },
      // rotation: { y: Math.PI / 2 },
    },
    {
      key: "tower_07",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/sci-fi-building-9_1.glb",
        scale: 1.4,
        emissiveBase: 1.0,
      },
    },
    {
      key: "tower_08",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/sci-fi-corporate-building.glb",
        emissiveBase: 1,
        scale: 1.7,
      },
    },
    {
      key: "tower_09",
      weight: 1,
      source: {
        format: "glb",
        // path: "models/buildings/towers/rounded-scifi-tower.glb",
        path: "models/buildings/skyscrapers/quality-skyscraper-curved.glb",
        emissiveBase: 2.0,
      },
      rotation: { y: Math.PI / 2 },
    },
    {
      key: "tower_10",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/sci-fi-brutalist-tower-with-ads.glb",
        emissiveBase: 2.0,
      },
    },
    {
      key: "tower_11",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/new-massive-skyscraper.001.glb",
        emissiveBase: 2.0,
      },
    },
    {
      key: "tower_12",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/towers/hero-skyscraper.glb",
        emissiveBase: 1.0,
        scale: 1.2,
      },
    },
  ],
};

// ============================================================================
// Asset Pipeline Helpers
// ============================================================================

function getAllVariants(): BuildingVariant[] {
  return [
    ...SMALL_SERIES.flatMap((s) => s.variants),
    ...LARGE_SERIES.variants,
    ...TOWER_SERIES.variants,
    ...SLIM_TOWER_SERIES,
    ...LANDMARK_SERIES,
    ...SKYSCRAPER_SERIES.variants,
    ...NEW_TOWER_SERIES.variants,
  ];
}

/** Default rotation offsets per model key (only includes models with rotation defined) */
export function getModelRotations(): Map<
  string,
  { x: number; y: number; z: number }
> {
  const map = new Map<string, { x: number; y: number; z: number }>();
  for (const v of getAllVariants()) {
    if (v.rotation) {
      map.set(v.key, {
        x: v.rotation.x ?? 0,
        y: v.rotation.y ?? 0,
        z: v.rotation.z ?? 0,
      });
    }
  }
  return map;
}

/** All building model keys (replaces BUILDING_MODEL_KEYS) */
export function getAllModelKeys(): string[] {
  return getAllVariants().map((v) => v.key);
}

/** Set of model keys using embedded GLB materials (replaces MODELS_WITH_EMBEDDED_MATERIALS) */
export function getEmbeddedMaterialKeys(): Set<string> {
  const set = new Set<string>();
  for (const v of getAllVariants()) {
    if (v.source?.format === "glb") set.add(v.key);
  }
  return set;
}

/** Emissive intensity entries for embedded GLB materials */
export function getEmbeddedEmissiveEntries(): Record<
  string,
  { category: keyof EmissiveMultipliers; base: number }
> {
  const entries: Record<
    string,
    { category: keyof EmissiveMultipliers; base: number }
  > = {};
  for (const v of getAllVariants()) {
    if (v.source?.format === "glb") {
      entries[`__embedded_${v.key}`] = {
        category: "buildings",
        base: v.source.emissiveBase ?? 2.0,
      };
    }
  }
  return entries;
}

/** Model manifest entries for all buildings */
export function getBuildingManifestEntries(): Record<
  string,
  ModelManifestEntry
> {
  const entries: Record<string, ModelManifestEntry> = {};
  for (const v of getAllVariants()) {
    if (v.source?.format === "glb") {
      entries[v.key] = {
        path: v.source.path,
        format: "glb",
        options: {
          computeBVH: true,
          useEmbeddedMaterial: true,
          scale: v.source.scale ?? 1,
        },
      };
    } else {
      entries[v.key] = {
        path: v.source?.path ?? `models/${v.key}.obj`,
        options: { computeBVH: true },
      };
    }
  }
  return entries;
}

/** Set of landmark model keys — legacy, kept for procedural mode compat */
export function getLandmarkModelKeys(): Set<string> {
  return new Set(LANDMARK_SERIES.map((v) => v.key));
}

/** Tower model keys for the concentric city — no instance cap */
export function getNewTowerModelKeys(): string[] {
  return NEW_TOWER_SERIES.variants.map((v) => v.key);
}

/** All ad model keys across all series */
export function getAllAdModelKeys(): string[] {
  return [
    ...SMALL_SERIES.flatMap((s) => s.ads),
    ...LARGE_SERIES.ads,
    ...TOWER_SERIES.ads,
  ];
}
