import type { EmissiveMultipliers, ModelManifestEntry } from "../assets/types";
import {
  COMMERCIAL_ATLAS_MATERIAL_KEY,
  COMMERCIAL_INDUSTRIAL_MATERIAL_KEY,
} from "./commercialBuildingKit";

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
      /** External material used by a geometry-only GLB. Omit for embedded PBR. */
      materialKey?: string;
    };

export type BuildingVariant = {
  key: string;
  /** Relative selection weight (normalized per-series) */
  weight: number;
  /** Model source. Defaults to OBJ at "models/{key}.obj" if omitted. */
  source?: BuildingModelSource;
  /** Default rotation offset in radians applied to every instance of this model */
  rotation?: { x?: number; y?: number; z?: number };
  /**
   * Footprint in city-block SLOTS (a block is an 8×8 slot grid, each slot =
   * CITY_BLOCK_SIZE/8 = 16 u). `w` runs along X, `d` along Z, both at the
   * model's default (0°) rotation. Used by the residential slot-packing placer
   * in generateLayout.ts to reserve space so buildings never overlap. Sized as
   * ceil(naturalDimension / slot) from the GLB's measured bounding box, so the
   * building always fits inside its reserved region with the leftover read as
   * yard/alley/plaza gaps. Only residential variants set this today.
   */
  footprint?: { w: number; d: number };
  /** Keep an asset visible in the viewer without adding it to generated cities. */
  placeable?: boolean;
  /**
   * Optional generated-city art-direction rules. Variants without a policy are
   * normal repeating fillers. Distance is measured from the rooftop vantage,
   * in city-block cells, so signature buildings stay in the authored core.
   */
  placement?: {
    role: "filler" | "accent" | "landmark";
    maxInstances?: number;
    maxDistanceFromVantageBlocks?: number;
  };
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
//   • residential — footprint slot-packed per block  (models/buildings/residential)
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
// The 2026 "cyberpunk residential" set — 8 GLB homes at human-reference scale
// (~12–43 u wide, ~30–90 u tall), i.e. small relative to the 128 u block. So
// residential blocks are packed with a footprint slot system (see
// generateLayout.ts `packResidentialBlock`) that drops MANY of them per block
// instead of the old fixed 2×2-per-block grid. Each variant declares its
// `footprint` in 8×8 block slots (slot = 16 u), sized ceil(naturalDim / 16)
// from the GLB's measured bounding box (W×D, height in comments). These replaced
// the earlier `2026-residential-building-*` models (still on disk, unreferenced).
export const RESIDENTIAL_SERIES: BuildingSeries = {
  id: "residential",
  ads: ["ads_s_01_01", "ads_s_01_02"],
  variants: [
    {
      // W≈35  D≈21  H≈44 — wide low-rise
      key: "residential_01",
      weight: 1,
      footprint: { w: 3, d: 2 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-1.glb",
        emissiveBase: 0.8,
      },
    },
    {
      // W≈23  D≈13  H≈43 — compact block
      key: "residential_02",
      weight: 1,
      footprint: { w: 2, d: 1 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-2.glb",
        emissiveBase: 0.9,
      },
    },
    {
      // W≈26  D≈17  H≈65 — mid-rise block
      key: "residential_03",
      weight: 1,
      footprint: { w: 2, d: 2 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-3.glb",
        emissiveBase: 0.9,
      },
    },
    {
      // W≈18  D≈18  H≈89 — slim high-rise (tallest of the set)
      key: "residential_04",
      weight: 1,
      footprint: { w: 2, d: 2 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-4.glb",
        emissiveBase: 0.8,
      },
    },
    {
      // W≈19  D≈13  H≈30 — small low-rise
      key: "residential_05",
      weight: 1,
      footprint: { w: 2, d: 1 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-5.glb",
        emissiveBase: 0.7,
      },
    },
    {
      // W≈16  D≈8  H≈35 — very narrow low-rise
      key: "residential_06",
      weight: 1,
      footprint: { w: 1, d: 1 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-6.glb",
        emissiveBase: 0.9,
      },
    },
    {
      // W≈43  D≈15  H≈46 — long slab block
      key: "residential_07",
      weight: 1,
      footprint: { w: 3, d: 1 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-7.glb",
        emissiveBase: 0.8,
      },
    },
    {
      // W≈12  D≈10  H≈42 — tiny slim tower
      key: "residential_08",
      weight: 1,
      footprint: { w: 1, d: 1 },
      source: {
        format: "glb",
        path: "models/buildings/residential/cyberpunk-residential-building-8.glb",
        emissiveBase: 0.9,
        // scale: 1.2, // slightly taller than the measured bounding box
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
    // {
    //   key: "commercial_01",
    //   weight: 1,
    //   source: {
    //     format: "glb",
    //     path: "models/buildings/commercial/2026-commercial-building-1.glb",
    //     emissiveBase: 0.9,
    //   },
    // },
    {
      key: "commercial_02",
      weight: 1,
      placeable: false,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-2.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_03",
      weight: 1,
      placeable: false,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-3.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_04",
      weight: 1,
      placeable: false,
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
    // {
    //   key: "commercial_06",
    //   weight: 1,
    //   source: {
    //     format: "glb",
    //     path: "models/buildings/commercial/2026-commercial-building-6.glb",
    //     emissiveBase: 0.9,
    //   },
    // },
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
    {
      key: "commercial_11",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-11.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_12",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-12.glb",
        emissiveBase: 0.9,
      },
    },
    {
      key: "commercial_13",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-13.glb",
        emissiveBase: 0.9,
        scale: 1,
      },
    },
    {
      key: "commercial_14",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-14.glb",
        emissiveBase: 0.9,
        scale: 1,
      },
    },
    {
      key: "commercial_15",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial/2026-commercial-building-15.glb",
        emissiveBase: 0.9,
        scale: 0.8,
      },
    },
    {
      key: "commercial_16",
      // Replaces one retired legacy slot in generated commercial blocks.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-wide-slab-01.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_17",
      // Replaces one retired legacy slot in generated commercial blocks.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-stepped-tower-01.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_18",
      // Replaces one retired legacy slot in generated commercial blocks.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-slim-tower-01.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_19",
      // Batch 2: rounded glass tower.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-rounded-glass-02.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_20",
      // Batch 2: vertical tech-fin tower.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-tech-fins-02.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_21",
      // Batch 2: clean stepped dark office tower.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-concrete-frame-02.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_22",
      // Batch 2: illuminated signature crown.
      weight: 0.35,
      placement: {
        role: "accent",
        maxInstances: 6,
        maxDistanceFromVantageBlocks: 9,
      },
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-signature-crown-02.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_23",
      // Batch 2: cyan-and-magenta emissive exoskeleton.
      weight: 0.28,
      placement: {
        role: "landmark",
        maxInstances: 3,
        maxDistanceFromVantageBlocks: 7,
      },
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-exoskeleton-02.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_24",
      // Batch 3: 20-floor blue-glass shaft on a mechanical podium.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-blue-glass-03.glb",
        materialKey: COMMERCIAL_ATLAS_MATERIAL_KEY,
      },
    },
    {
      key: "commercial_25",
      // Batch 4: simplified louver tower using the industrial commercial v2
      // atlas evolved from the legacy SynthCity material language. It joins
      // the ordinary commercial filler pool rather than behaving as a rare
      // accent: its compact footprint is suitable for the existing 2x2 block
      // cells and the local-repeat rule keeps copies from clustering.
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/commercial-v1/commercial-legacy-louver-01.glb",
        materialKey: COMMERCIAL_INDUSTRIAL_MATERIAL_KEY,
      },
    },
    // {
    //   key: "commercial_26",
    //   // Batch 4: simplified louver tower using the industrial commercial v2
    //   // atlas evolved from the legacy SynthCity material language. It joins
    //   // the ordinary commercial filler pool rather than behaving as a rare
    //   // accent: its compact footprint is suitable for the existing 2x2 block
    //   // cells and the local-repeat rule keeps copies from clustering.
    //   weight: 1,
    //   source: {
    //     format: "glb",
    //     path: "models/buildings/commercial/2026-commercial-building-22.glb",
    //     materialKey: COMMERCIAL_INDUSTRIAL_MATERIAL_KEY,
    //   },
    // },
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
        path: "models/buildings/skyscrapers/dark-skyscraper.glb",
        emissiveBase: 1.0,
        scale: 1,
      },
    },
    {
      key: "skyscraper_03",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/Frankfurt_Eurotheum_LOD0.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_04",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/Frankfurt_Skyper_LOD0.glb",
        emissiveBase: 1.0,
      },
    },
    {
      key: "skyscraper_05",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/AON_Center-skyscraper.glb",
        emissiveBase: 0.6,
      },
    },
    {
      key: "skyscraper_06",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/2026-custom-skyscraper-5.glb",
        emissiveBase: 1,
        scale: 1,
      },
    },
    {
      key: "skyscraper_07",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/ny-office-building.glb",
        emissiveBase: 1.0,
        scale: 1.1,
      },
      rotation: { y: Math.PI / 2 },
    },
    {
      key: "skyscraper_08",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/lz-skyscraper-2.glb",
        emissiveBase: 1.0,
        scale: 1.6,
      },
      // rotation: { y: Math.PI / 1.5 },
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
      },
    },
    {
      key: "skyscraper_11",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/2026-custom-skyscraper-6.glb",
        emissiveBase: 1.0,
        scale: 1.2,
      },
      // rotation: { y: Math.PI / 2 },
    },
    {
      key: "skyscraper_12",
      weight: 1,
      source: {
        format: "glb",
        path: "models/buildings/skyscrapers/2026-custom-skyscraper1-bright.glb",
        emissiveBase: 0.8,
        scale: 1.2,
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
        emissiveBase: 1.0,
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
    if (v.source?.format === "glb" && !v.source.materialKey) set.add(v.key);
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
    if (v.source?.format === "glb" && !v.source.materialKey) {
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
          useEmbeddedMaterial: !v.source.materialKey,
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

/** External material key per geometry-only model. */
export function getModelMaterialKeys(): Map<string, string> {
  const map = new Map<string, string>();
  for (const variant of getAllVariants()) {
    if (variant.source?.format === "glb" && variant.source.materialKey) {
      map.set(variant.key, variant.source.materialKey);
    }
  }
  return map;
}

/** All ad model keys across all series */
export function getAllAdModelKeys(): string[] {
  return ALL_SERIES.flatMap((s) => s.ads);
}
