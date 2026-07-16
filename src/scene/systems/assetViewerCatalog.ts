import {
  getAllModelKeys,
  getEmbeddedMaterialKeys,
  getModelMaterialKeys,
} from "../../config/buildingRegistry";
import { ADS_META, adMatKey } from "../../config/ads";
import { SMALL_ADS_META, smallAdMatKey } from "../../config/smallAds";
import {
  PROC_NEON_VERTICAL,
  PROC_NEON_HORIZONTAL,
  PROC_NEON_FLICKER,
  PROC_NEON_PICTORIAL,
  PROC_LOGO_FAMILIES,
} from "../wallAds/proceduralNeon";

// ── Asset-viewer catalog ───────────────────────────────────────────────────
//
// One flat item list per category, shared by AssetViewerScene (rendering)
// and AssetViewerUI (labels / counts). Buildings render as meshes; every
// sign category renders as a correctly-aspected plane with the same
// material the city uses, so what you see here is what FiniteCityWallAds
// will draw — including the procedural neon textures and their flicker
// animation.

export type ViewerCategory = "buildings" | "ads" | "smallAds" | "neon";

export type ViewerItem = {
  /** Building model key, or sign material key (resolvable by the scene). */
  key: string;
  /** Secondary info line shown under the key in single view. */
  detail: string;
  kind: "model" | "plane";
  /** Plane width/height ratio. Unused for models. */
  aspect: number;
};

export const VIEWER_CATEGORIES: { id: ViewerCategory; label: string }[] = [
  { id: "buildings", label: "Buildings" },
  { id: "ads", label: "Ads" },
  { id: "smallAds", label: "Small ads" },
  { id: "neon", label: "Neon (gen)" },
];

const EMBEDDED = getEmbeddedMaterialKeys();
const MODEL_MATERIALS = getModelMaterialKeys();

function getSeriesLabel(key: string): string {
  if (key.startsWith("residential_")) return "Residential";
  if (key.startsWith("commercial_")) return "Commercial";
  if (key.startsWith("skyscraper_")) return "Skyscraper";
  if (key.startsWith("tower_")) return "Tower";
  return "Unknown";
}

function buildItems(category: ViewerCategory): ViewerItem[] {
  switch (category) {
    case "buildings":
      return getAllModelKeys().map((key) => ({
        key,
        detail: `${getSeriesLabel(key)} · ${
          EMBEDDED.has(key)
            ? "GLB · embedded PBR"
            : MODEL_MATERIALS.has(key)
              ? "GLB · shared PBR"
              : "OBJ"
        }`,
        kind: "model",
        aspect: 1,
      }));

    case "ads":
      // Both material styles per image — they look quite different.
      return ADS_META.flatMap((ad) =>
        (["holo", "billboard"] as const).map((style) => ({
          key: adMatKey(ad.id, style),
          detail: `${ad.label} · ${style}`,
          kind: "plane" as const,
          aspect: ad.aspect,
        })),
      );

    case "smallAds":
      return SMALL_ADS_META.map((ad) => ({
        key: smallAdMatKey(ad.id),
        detail: `bucket ${ad.bucket}`,
        kind: "plane",
        aspect: ad.aspect,
      }));

    case "neon": {
      const items: ViewerItem[] = [];
      for (const m of PROC_NEON_VERTICAL)
        items.push({
          key: m.key,
          detail: "generated · vertical sign",
          kind: "plane",
          aspect: m.aspect,
        });
      for (const m of PROC_NEON_HORIZONTAL)
        items.push({
          key: m.key,
          detail: "generated · horizontal sign",
          kind: "plane",
          aspect: m.aspect,
        });
      for (const m of PROC_NEON_FLICKER)
        items.push({
          key: m.key,
          detail: "generated · flicker (animated)",
          kind: "plane",
          aspect: m.aspect,
        });
      for (const m of PROC_NEON_PICTORIAL)
        items.push({
          key: m.key,
          detail: "generated · pictorial sign",
          kind: "plane",
          aspect: m.aspect,
        });
      PROC_LOGO_FAMILIES.forEach((fam, i) => {
        const company = `logo family ${i.toString().padStart(2, "0")}`;
        items.push({
          key: fam.wide.key,
          detail: `generated · ${company} · glyph+name`,
          kind: "plane",
          aspect: fam.wide.aspect,
        });
        items.push({
          key: fam.text.key,
          detail: `generated · ${company} · wordmark`,
          kind: "plane",
          aspect: fam.text.aspect,
        });
        items.push({
          key: fam.vertical.key,
          detail: `generated · ${company} · vertical`,
          kind: "plane",
          aspect: fam.vertical.aspect,
        });
      });
      return items;
    }
  }
}

const cache = new Map<ViewerCategory, ViewerItem[]>();

export function getViewerItems(category: ViewerCategory): ViewerItem[] {
  let items = cache.get(category);
  if (!items) {
    items = buildItems(category);
    cache.set(category, items);
  }
  return items;
}
