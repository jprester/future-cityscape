import {
  EquirectangularReflectionMapping,
  LinearFilter,
  SRGBColorSpace,
  RepeatWrapping,
} from "three";
import type { TextureManifest } from "../types";
import { ADS_META, adTextureKey } from "../../config/ads";
import { SMALL_ADS_META, smallAdTextureKey } from "../../config/smallAds";

/**
 * Texture manifest - defines all textures to be loaded
 * Format: { [key]: { path, options? } }
 */
export function createTextureManifest(anisotropy: number): TextureManifest {
  const manifest: TextureManifest = {
    // Sky textures
    sky_night: {
      path: "textures/environment/sky_night.jpg",
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
    env_night_windshield: {
      path: "textures/environment/environment_night_windshield.jpg",
      options: {
        mapping: EquirectangularReflectionMapping,
        magFilter: LinearFilter,
      },
    },

    // Ground
    ground: { path: "textures/ground/ground.jpg" },
    ground_em: { path: "textures/ground/ground_em.jpg" },

    // Spinner (player car)
    spinner_interior: {
      path: "textures/cars/0QuazDeckardCarLowpoly_interior_BaseColor.png",
    },
    spinner_interior_norm: {
      path: "textures/cars/0QuazDeckardCarLowpoly_interior_Normal.png",
    },
    spinner_interior_em: {
      path: "textures/cars/0QuazDeckardCarLowpoly_interior_Emissive.png",
    },
    spinner_interior_ao: {
      path: "textures/cars/0QuazDeckardCarLowpoly_interior_AmbientOcclusion.png",
    },
    spinner_exterior: {
      path: "textures/cars/0QuazDeckardCarLowpoly_car_BaseColor.png",
    },
    spinner_windows_norm: {
      path: "textures/cars/rain_normal_1024.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        repeatX: 2.5,
        repeatY: 2.5,
      },
    },
    spinner_windows_rough: {
      path: "textures/cars/smudges2_1024.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        repeatX: 2.5,
        repeatY: 2.5,
      },
    },
    spinner_windows_trans: {
      path: "textures/cars/smudges_inverted_1024.jpg",
      options: {
        wrapS: RepeatWrapping,
        wrapT: RepeatWrapping,
        repeatX: 2.5,
        repeatY: 2.5,
      },
    },

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

  // Ad textures — high-res posters at native aspect ratio. Each image is
  // loaded once and reused by every style variant (holo / billboard / …).
  // Add a new one by dropping ad_NN.jpg into textures/ads/ and registering
  // the metadata in src/config/ads.ts — no edit here required.
  for (const ad of ADS_META) {
    const key = adTextureKey(ad.id);
    manifest[key] = { path: `textures/ads/${key}.jpg` };
  }

  // Small ads / neon signs — PNGs with (mostly) transparent backgrounds.
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
