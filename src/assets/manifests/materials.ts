import {
  MeshPhongMaterial,
  MeshStandardMaterial,
  MeshPhysicalMaterial,
  Color,
  AdditiveBlending,
  DoubleSide,
  Vector2,
} from "three";
import type { Texture, Material } from "three";
import type { MaterialContext } from "../types";
import { ADS_META, adTextureKey, adMatKey } from "../../config/ads";
import {
  SMALL_ADS_META,
  smallAdMatKey,
  smallAdTextureKey,
} from "../../config/smallAds";
import {
  COMMERCIAL_ATLAS_MATERIAL_KEY,
  COMMERCIAL_ATLAS_TEXTURE_KEYS,
  COMMERCIAL_INDUSTRIAL_MATERIAL_KEY,
  COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS,
} from "../../config/commercialBuildingKit";

type GetTexture = (key: string) => Texture | undefined;

// Window emissive uses a controlled TWO-TONE split: most `building_NN`
// materials glow a cool neon-blue, a portion glow warm amber. The warm windows
// popping out of the cool purple fog are the signature cyberpunk-skyline look
// (see the Gemini reference). This is deliberately *not* the old 4-color random
// palette (teal/white/amber/magenta), which looked stylistically incoherent — a
// tight blue↔amber two-tone keeps the skyline unified while adding depth and
// contrast. Tune the fraction / hues below to retint everything in one place.
const WARM_WINDOW_FRACTION = 0.38;

function coolWindowEmissive(): Color {
  return new Color(`hsl(${190 + Math.random() * 20}, 70%, 76%)`);
}

function warmWindowEmissive(): Color {
  return new Color(`hsl(${32 + Math.random() * 12}, 85%, 70%)`);
}

function pickWindowEmissive(): Color {
  return Math.random() < WARM_WINDOW_FRACTION
    ? warmWindowEmissive()
    : coolWindowEmissive();
}

/**
 * Material definitions using factory functions
 * This allows textures to be resolved at creation time
 */
export type MaterialFactoryMap = Record<
  string,
  (getTexture: GetTexture, ctx: MaterialContext) => Material
>;

/**
 * Creates all material factory functions
 * Materials are created lazily when first requested
 */
export function createMaterialFactories(): MaterialFactoryMap {
  const factories: MaterialFactoryMap = {};

  // Ground
  factories["ground"] = (getTexture, ctx) =>
    new MeshPhongMaterial({
      map: getTexture("ground"),
      emissive: 0x0090ff,
      emissiveMap: getTexture("ground_em"),
      emissiveIntensity: ctx.environmentName === "night" ? 0.2 : 0, // Legacy: overwritten by preset
      shininess: 0,
    });

  // Traffic cars
  factories["cars"] = (getTexture) =>
    new MeshPhongMaterial({
      map: getTexture("cars"),
      emissive: 0xffffff,
      emissiveMap: getTexture("cars_em"),
      emissiveIntensity: 1.0, // Legacy: overwritten by preset
      side: DoubleSide,
    });

  // Storefronts
  factories["storefronts"] = (getTexture, ctx) =>
    new MeshPhongMaterial({
      map: getTexture("storefronts"),
      emissive: 0xffffff,
      emissiveMap: getTexture("storefronts_em"),
      emissiveIntensity: ctx.windowLightsEnabled ? 1.5 : 0, // Legacy: overwritten by preset
      shininess: 0,
    });

  // Mega building - boosted emissive for enhanced glow
  factories["mega_building_01"] = (getTexture, ctx) =>
    new MeshPhongMaterial({
      map: getTexture("mega_building_01"),
      specular: 0x777777,
      shininess: 1,
      emissive: 0xffffff,
      emissiveMap: getTexture("mega_building_01_em"),
      emissiveIntensity: ctx.windowLightsEnabled ? 2.0 : 0, // Legacy: overwritten by preset
      bumpMap: getTexture("mega_building_01"),
      bumpScale: 10,
    });

  // Commercial kit v1 — three geometry-only GLBs share these four maps. This
  // keeps the atlas in GPU memory once instead of embedding it in every model.
  factories[COMMERCIAL_ATLAS_MATERIAL_KEY] = (getTexture, ctx) =>
    new MeshStandardMaterial({
      map: getTexture(COMMERCIAL_ATLAS_TEXTURE_KEYS.diffuse),
      emissive: 0xffffff,
      emissiveMap: getTexture(COMMERCIAL_ATLAS_TEXTURE_KEYS.emissive),
      emissiveIntensity: ctx.windowLightsEnabled ? 1.25 : 0,
      roughnessMap: getTexture(COMMERCIAL_ATLAS_TEXTURE_KEYS.roughness),
      roughness: 1,
      metalness: 0.12,
      normalMap: getTexture(COMMERCIAL_ATLAS_TEXTURE_KEYS.normal),
      normalScale: new Vector2(0.5, 0.5),
      envMap: getTexture("env_night"),
      envMapIntensity: 0.45,
    });

  // Industrial commercial v2 — a darker louver/service-spine family evolved
  // from the legacy SynthCity buildings but authored as a modular PBR atlas.
  factories[COMMERCIAL_INDUSTRIAL_MATERIAL_KEY] = (getTexture, ctx) =>
    new MeshStandardMaterial({
      map: getTexture(COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS.diffuse),
      emissive: 0xffffff,
      emissiveMap: getTexture(COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS.emissive),
      emissiveIntensity: ctx.windowLightsEnabled ? 1.45 : 0,
      roughnessMap: getTexture(COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS.roughness),
      roughness: 1,
      metalness: 0.16,
      normalMap: getTexture(COMMERCIAL_INDUSTRIAL_TEXTURE_KEYS.normal),
      normalScale: new Vector2(0.42, 0.42),
      envMap: getTexture("env_night"),
      envMapIntensity: 0.42,
    });

  // Building materials (10 variants with weighted-palette emissive colors)
  for (let i = 1; i <= 10; i++) {
    const id = i.toString().padStart(2, "0");
    const key = `building_${id}`;
    factories[key] = (getTexture, ctx) =>
      new MeshPhongMaterial({
        map: getTexture(key),
        specular: 0xffffff,
        specularMap: getTexture(`${key}_rough`),
        envMap: getTexture("env_night"),
        emissive: pickWindowEmissive(),
        emissiveMap: getTexture(`${key}_em`),
        emissiveIntensity: ctx.windowLightsEnabled ? 2.0 : 0, // Legacy: overwritten by preset
        bumpMap: getTexture(key),
        bumpScale: 5,
      });
  }

  // Ads — one texture per id (ADS_META), two material variants per id:
  //
  //   • ad_holo_NN      — semi-transparent additive hologram. depthWrite
  //                       off so it doesn't mask buildings behind it.
  //   • ad_billboard_NN — opaque self-illuminated LED panel. Writes depth
  //                       so it acts like a real surface.
  //
  // Both variants reuse the same `ad_NN` texture; only the material setup
  // changes. Adding a new ad → just add it to ADS_META.
  for (const ad of ADS_META) {
    const texKey = adTextureKey(ad.id);

    factories[adMatKey(ad.id, "holo")] = (getTexture) =>
      new MeshPhongMaterial({
        color: 0x000000,
        emissive: 0xddf6ff,
        emissiveMap: getTexture(texKey),
        emissiveIntensity: 0.25, // Overwritten by BASE_EMISSIVE_INTENSITIES × preset
        blending: AdditiveBlending,
        transparent: true,
        opacity: 0.82,
        depthWrite: false,
        fog: false,
        side: DoubleSide,
      });

    factories[adMatKey(ad.id, "billboard")] = (getTexture) =>
      new MeshPhongMaterial({
        // The panel itself must stay black: with MeshPhong's default light
        // base, dark texture pixels turn into a flat gray rectangle. The
        // emissive map is the LED content and should be the only visible light.
        color: 0x000000,
        specular: 0x000000,
        shininess: 0,
        emissive: 0xffffff,
        emissiveMap: getTexture(texKey),
        emissiveIntensity: 0.7, // Overwritten by BASE_EMISSIVE_INTENSITIES × preset
        side: DoubleSide,
      });
  }

  // Small ads / neon signs — one billboard-style material per WebP. The images
  // are alpha-cut posters with neon foreground on transparent (or near-
  // transparent) backgrounds, so we want:
  //   • transparent: true + alphaTest      — discard transparent pixels
  //   • DoubleSide                          — vertical signs hanging out from
  //                                           walls render the same on both sides
  //   • map + emissiveMap                   — sign reads in daylight, glows at night
  for (const ad of SMALL_ADS_META) {
    const texKey = smallAdTextureKey(ad.id);
    factories[smallAdMatKey(ad.id)] = (getTexture) =>
      new MeshPhongMaterial({
        map: getTexture(texKey),
        emissive: 0xffffff,
        emissiveMap: getTexture(texKey),
        emissiveIntensity: 0.9, // Overwritten by BASE_EMISSIVE_INTENSITIES × preset
        transparent: true,
        alphaTest: 0.1,
        side: DoubleSide,
        depthWrite: true,
        fog: true,
      });
  }

  // Smoke (3 variants)
  for (let i = 1; i <= 3; i++) {
    const id = i.toString().padStart(2, "0");
    factories[`smoke_${id}`] = (getTexture) =>
      new MeshPhongMaterial({
        alphaMap: getTexture(`smoke_${id}`),
        color: 0xffffff,
        emissive: 0x4488aa,
        emissiveIntensity: 0.3,
        shininess: 0,
        specular: 0x000000,
        blending: AdditiveBlending,
        depthWrite: false,
        transparent: false,
      });
  }

  // Spotlights (4 variants). Violet-family searchlight beams to match the
  // cyberpunk reference — previously flat white, which bloomed to a harsh
  // lime-white core. A reduced opacity softens each beam into a volumetric glow
  // instead of a hard line, and four slightly different violets give the
  // skyline variety. The alphaMap (a soft cone gradient) shapes the falloff.
  const SPOTLIGHT_BEAM_COLORS = [0x8a5cff, 0xb060ff, 0x6a7cff, 0xa070ff];
  for (let i = 1; i <= 4; i++) {
    const id = i.toString().padStart(2, "0");
    factories[`spotlight_${id}`] = (getTexture) =>
      new MeshPhongMaterial({
        alphaMap: getTexture(`spotlight_${id}`),
        color: SPOTLIGHT_BEAM_COLORS[i - 1],
        shininess: 0,
        specular: 0x000000,
        blending: AdditiveBlending,
        // Render in the transparent pass with depth testing so opaque buildings
        // occlude the part of the beam behind them (additive is order-
        // independent, so no depth WRITE — beams don't occlude each other).
        depthWrite: false,
        depthTest: true,
        transparent: true,
        opacity: 0.55,
      });
  }

  return factories;
}
