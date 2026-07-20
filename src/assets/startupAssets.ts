import type { FiniteCityLayout } from "../config/cityLayouts";
import { ADS_META, adMatKey, adTextureKey } from "../config/ads";
import {
  COMMERCIAL_SERIES,
  getModelMaterialKeys,
  RESIDENTIAL_SERIES,
} from "../config/buildingRegistry";
import {
  COMMERCIAL_ATLAS_MATERIAL_KEY,
  COMMERCIAL_ATLAS_TEXTURE_KEY_LIST,
  COMMERCIAL_INDUSTRIAL_MATERIAL_KEY,
  COMMERCIAL_INDUSTRIAL_TEXTURE_KEY_LIST,
} from "../config/commercialBuildingKit";
import {
  SMALL_ADS_META,
  smallAdMatKey,
  smallAdTextureKey,
} from "../config/smallAds";

export type StartupAssetSelection = {
  modelKeys: string[];
  textureKeys: string[];
  materialKeys: string[];
};

type CityStartupAssetOptions = {
  /**
   * Include every seed-selected building variant. Generated cities can change
   * seed in the setup UI after loading starts; fixed JSON layouts cannot.
   */
  includeSeedVariants?: boolean;
};

const CORE_MODEL_KEYS = [
  "smoke",
  "spotlight",
  "vantage_rooftop",
  "vent_01",
  "vent_02",
  "vent_03",
];

const TRAFFIC_MODEL_KEYS = Array.from(
  { length: 8 },
  (_, index) => `car_${(index + 1).toString().padStart(2, "0")}`,
);

const CORE_TEXTURE_KEYS = [
  "sky_night",
  "env_night",
  "ground",
  "ground_em",
  "ground_rough",
  "cars",
  "cars_em",
  "smoke_01",
  "smoke_02",
  "smoke_03",
  "spotlight_01",
  "spotlight_02",
  "spotlight_03",
  "spotlight_04",
];
const MODEL_MATERIAL_KEYS = getModelMaterialKeys();

/**
 * Select the assets required by the playable finite city.
 *
 * The full manifests intentionally remain available to `?mode=assets`, but the
 * game no longer blocks startup on retired OBJ materials, unused toppers/mega
 * buildings, or building variants absent from a fixed JSON layout. Generated
 * layouts include all residential/commercial variants because their seed may
 * change in the setup UI while loading is in progress. Ad textures stay in the
 * startup set because procedural facade-slot
 * resolution happens after model geometry has loaded and may select any entry
 * in the registered catalogs.
 */
export function getCityStartupAssets(
  layout: FiniteCityLayout,
  options: CityStartupAssetOptions = {},
): StartupAssetSelection {
  const modelKeys = new Set(CORE_MODEL_KEYS);
  const textureKeys = new Set(CORE_TEXTURE_KEYS);
  const materialKeys = new Set([
    "cars",
    "smoke_01",
    "smoke_02",
    "smoke_03",
    "spotlight_01",
    "spotlight_02",
    "spotlight_03",
    "spotlight_04",
  ]);

  for (const building of layout.buildings) {
    modelKeys.add(building.modelKey);
  }
  if (options.includeSeedVariants) {
    for (const variant of RESIDENTIAL_SERIES.variants) {
      modelKeys.add(variant.key);
    }
    for (const variant of COMMERCIAL_SERIES.variants.filter(
      (candidate) => candidate.placeable !== false,
    )) {
      modelKeys.add(variant.key);
    }
  }
  for (const megaBuilding of layout.megaBuildings ?? []) {
    modelKeys.add(megaBuilding.modelKey);
  }
  if (layout.spawn.roofModelKey) {
    modelKeys.add(layout.spawn.roofModelKey);
  }
  if (layout.storefronts.length > 0) {
    modelKeys.add("storefronts");
    textureKeys.add("storefronts");
    textureKeys.add("storefronts_em");
    materialKeys.add("storefronts");
  }

  for (const modelKey of modelKeys) {
    const materialKey = MODEL_MATERIAL_KEYS.get(modelKey);
    if (!materialKey) continue;
    materialKeys.add(materialKey);
    if (materialKey === COMMERCIAL_ATLAS_MATERIAL_KEY) {
      for (const textureKey of COMMERCIAL_ATLAS_TEXTURE_KEY_LIST) {
        textureKeys.add(textureKey);
      }
    }
    if (materialKey === COMMERCIAL_INDUSTRIAL_MATERIAL_KEY) {
      for (const textureKey of COMMERCIAL_INDUSTRIAL_TEXTURE_KEY_LIST) {
        textureKeys.add(textureKey);
      }
    }
  }

  for (const key of TRAFFIC_MODEL_KEYS) modelKeys.add(key);
  for (const ad of ADS_META) {
    textureKeys.add(adTextureKey(ad.id));
    materialKeys.add(adMatKey(ad.id, "holo"));
    materialKeys.add(adMatKey(ad.id, "billboard"));
  }
  for (const ad of SMALL_ADS_META) {
    textureKeys.add(smallAdTextureKey(ad.id));
    materialKeys.add(smallAdMatKey(ad.id));
  }

  return {
    modelKeys: [...modelKeys],
    textureKeys: [...textureKeys],
    materialKeys: [...materialKeys],
  };
}
