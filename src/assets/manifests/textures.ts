import {
  EquirectangularReflectionMapping,
  LinearFilter,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import type { TextureManifest } from "../types";
import { ADS_META, adTextureKey } from "../../config/ads";
import { SMALL_ADS_META, smallAdTextureKey } from "../../config/smallAds";
import { COMMERCIAL_ATLAS_TEXTURE_KEYS } from "../../config/commercialBuildingKit";

/**
 * Texture manifest - defines all textures to be loaded
 * Format: { [key]: { path, options? } }
 */
export function createTextureManifest(anisotropy: number): TextureManifest {
  const manifest: TextureManifest = {
    // Sky textures
    // Gemini light-pollution night sky (warm horizon band + soft cloud deck),
    // derived from Gemini_Generated_Image_asb6fp….png in the same folder:
    // watermark sparkle patched out, resized to a clean 2:1, light seam feather.
    // It arrived almost perfectly seamless (edge diff ~2/255) with a uniform
    // zenith, so no ramp/zenith fix was needed. The earlier Midjourney sky
    // (sky_night.png) is kept on disk, unreferenced.
    sky_night: {
      path: "textures/environment/sky_night_gemini.png",
      options: {
        colorSpace: SRGBColorSpace,
        mapping: EquirectangularReflectionMapping,
        magFilter: LinearFilter,
      },
    },
    sky_day: {
      path: "textures/environment/sky_day.jpg",
      options: {
        colorSpace: SRGBColorSpace,
        mapping: EquirectangularReflectionMapping,
        magFilter: LinearFilter,
      },
    },

    // Environment maps
    env_night: {
      path: "textures/environment/environment_night.jpg",
      options: {
        mapping: EquirectangularReflectionMapping,
        magFilter: LinearFilter,
      },
    },

    // Ground — cyberpunk ground-level set (diffuse + emissive + roughness)
    ground: { path: "textures/ground/cyberpunk-ground-level_diffuse.png" },
    ground_em: { path: "textures/ground/cyberpunk-ground-level_emissive.png" },
    ground_rough: { path: "textures/ground/cyberpunk-ground-level_roughness.png" },

    // Traffic cars
    cars: { path: "textures/cars/cars.jpg" },
    cars_em: { path: "textures/cars/cars_em.jpg" },

    // Storefronts
    storefronts: {
      path: "textures/storefronts/storefronts_01.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        anisotropy,
      },
    },
    storefronts_em: {
      path: "textures/storefronts/storefronts_01_em.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        anisotropy,
      },
    },

    // Mega building
    mega_building_01: {
      path: "textures/buildings/mega_building_01.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        anisotropy,
      },
    },
    mega_building_01_em: {
      path: "textures/buildings/mega_building_01_em.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        anisotropy,
      },
    },
  };

  manifest[COMMERCIAL_ATLAS_TEXTURE_KEYS.diffuse] = {
    path: "textures/buildings/commercial-v1/commercial-atlas-v1-diffuse.webp",
    options: { colorSpace: SRGBColorSpace, flipY: false, anisotropy },
  };
  manifest[COMMERCIAL_ATLAS_TEXTURE_KEYS.emissive] = {
    path: "textures/buildings/commercial-v1/commercial-atlas-v1-emissive.webp",
    options: { colorSpace: SRGBColorSpace, flipY: false, anisotropy },
  };
  manifest[COMMERCIAL_ATLAS_TEXTURE_KEYS.roughness] = {
    path: "textures/buildings/commercial-v1/commercial-atlas-v1-roughness.webp",
    options: { flipY: false, anisotropy },
  };
  manifest[COMMERCIAL_ATLAS_TEXTURE_KEYS.normal] = {
    path: "textures/buildings/commercial-v1/commercial-atlas-v1-normal.webp",
    options: { flipY: false, anisotropy },
  };

  // Building textures (10 variants)
  for (let i = 1; i <= 10; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`building_${id}`] = {
      path: `textures/buildings/building_${id}.jpg`,
      options: { wrapS: RepeatWrapping, wrapT: RepeatWrapping, anisotropy },
    };
    manifest[`building_${id}_em`] = {
      path: `textures/buildings/building_${id}_em.jpg`,
      options: { wrapS: RepeatWrapping, wrapT: RepeatWrapping, anisotropy },
    };
    manifest[`building_${id}_rough`] = {
      path: `textures/buildings/building_${id}_spec.jpg`,
      options: { wrapS: RepeatWrapping, wrapT: RepeatWrapping, anisotropy },
    };
  }

  // Ad textures — size-capped WebPs at native aspect ratio. Each image is
  // loaded once and reused by every style variant (holo / billboard / …).
  // sRGB keeps authored colors consistent before emissive bloom is applied.
  // Add new files by registering them in src/config/ads.ts.
  for (const ad of ADS_META) {
    const key = adTextureKey(ad.id);
    manifest[key] = {
      path: `textures/ads-v2/${ad.file}`,
      options: { colorSpace: SRGBColorSpace, anisotropy },
    };
  }

  // Small ads / neon signs — size-capped WebPs with transparent backgrounds.
  // sRGB color space so the colors render the same as the source art.
  // Add new files by registering them in src/config/smallAds.ts.
  for (const ad of SMALL_ADS_META) {
    manifest[smallAdTextureKey(ad.id)] = {
      path: `textures/small-ads/small-ads-${ad.bucket}/${ad.file}`,
      options: { colorSpace: SRGBColorSpace, anisotropy },
    };
  }

  // Smoke (3 variants)
  for (let i = 1; i <= 3; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`smoke_${id}`] = { path: `textures/effects/smoke_${id}.jpg` };
  }

  // Spotlights (4 variants)
  for (let i = 1; i <= 4; i++) {
    const id = i.toString().padStart(2, "0");
    manifest[`spotlight_${id}`] = {
      path: `textures/effects/spotlight_${id}.jpg`,
    };
  }

  return manifest;
}
