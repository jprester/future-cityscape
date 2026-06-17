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
//
// The scene has exactly FOUR building categories, all GLB models with embedded
// materials, each living in its own subfolder under models/buildings/:
//
//   • residential — 4 per city block, noise-picked   (models/buildings/residential)
//   • commercial  — 4 per city block, noise-picked   (models/buildings/commercial)
//   • skyscraper  — 1 per block, each variant placed AT MOST ONCE in the scene
//   • tower       — 1 per block, each variant placed AT MOST ONCE in the scene
//
// Placement logic lives in cityLayouts/generateLayout.ts. The old number-based
// series (s_01/s_02/s_03 small, s_04 large, s_05 tower, s_06 slim, landmarks)
// were retired — keys are now named by category. Runtime classification
// elsewhere (smoke, wall ads, asset viewer) keys off the category PREFIX of the
// model key (`residential_`, `commercial_`, `skyscraper_`, `tower_`), so keep
// that prefix when adding variants.

// ── Residential ─────────────────────────────────────────────────────────────
// Low-rise GLB homes (~50–62 u wide, ~90–120 u tall). 4 per residential block.
export const RESIDENTIAL_SERIES: BuildingSeries = {
  id: "residential",
  ads: ["ads_s_01_01", "ads_s_01_02"],
  variants: [
    {
      key: "residential_01",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-1.glb",
        emissiveBase: 0.8,
      },
    },
    {
      key: "residential_02",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-2.glb",
        emissiveBase: 0.8,
      },
    },
    {
      key: "residential_03",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-3.glb",
        emissiveBase: 0.8,
      },
    },
    {
      key: "residential_04",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-4.glb",
        emissiveBase: 0.8,
      },
    },
    {
      key: "residential_05",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-5.glb",
        emissiveBase: 0.6,
        // scale: 0.85,
      },
    },
    {
      key: "residential_06",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/residential/2026-residential-building-6.glb",
        emissiveBase: 1,
        // scale: 0.85,
      },
    },
  ],
};

// ── Commercial ────────────────────────────────────────────────────────────────
// Mid-rise GLB blocks (~32–65 u wide, ~100–220 u tall). 4 per commercial block.
export const COMMERCIAL_SERIES: BuildingSeries = {
  id: "commercial",
  ads: ["ads_s_02_01", "ads_s_02_02"],
  variants: [
    {
      key: "commercial_01",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-1.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_02",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-2.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_03",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-3.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_04",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-4.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_05",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-5.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_06",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-6.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_07",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-7.glb",
        emissiveBase: 0.7,
      },
    },
    {
      key: "commercial_08",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-8.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_09",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-9.glb",
        emissiveBase: 1,
      },
    },
    {
      key: "commercial_10",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-10.glb",
        emissiveBase: 0.9,
      },
    },
  ],
};

// ── Skyscrapers ───────────────────────────────────────────────────────────────
// Mid-to-tall financial/business towers. One variant per block, placed at most
// once each (the generator draws from a de-duplicated pool). Some variants point
// at the same GLB on purpose — the dedupe keeps only the first.
export const SKYSCRAPER_SERIES: BuildingSeries = {
  id: "skyscraper",
  ads: [],
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

// ── Towers ────────────────────────────────────────────────────────────────────
// The biggest downtown structures. One variant per block, placed at most once
// each (de-duplicated pool, like skyscrapers).
export const TOWER_SERIES: BuildingSeries = {
  id: "tower",
  ads: [],
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

// All four categories, in one place for the asset-pipeline helpers.
const ALL_SERIES: BuildingSeries[] = [
  RESIDENTIAL_SERIES,
  COMMERCIAL_SERIES,
  SKYSCRAPER_SERIES,
  TOWER_SERIES,
];

// ============================================================================
// Asset Pipeline Helpers
// ============================================================================

function getAllVariants(): BuildingVariant[] {
  return ALL_SERIES.flatMap((s) => s.variants);
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

/** All ad model keys across all series */
export function getAllAdModelKeys(): string[] {
  return ALL_SERIES.flatMap((s) => s.ads);
}
