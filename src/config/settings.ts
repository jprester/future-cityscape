/**
 * Default game settings
 * Centralized configuration for initial game state
 */

import { CURATED_WORLD_SEEDS } from "./world";
import type {
  GameSettings,
  QualityLevel,
  FrameRateLimit,
  VisibilitySettings,
} from "../types/settings";

/**
 * Default visibility settings for all scene objects
 */
export const DEFAULT_VISIBILITY: VisibilitySettings = {
  buildings: true,
  megaBuildings: true,
  ads: true,
  smoke: true,
  spotlights: true,
  toppers: true,
  trafficCars: true,
  playerCar: true,
  ground: true,
  storefronts: true,
};

/**
 * Default game settings used on initial load
 */
export const DEFAULT_GAME_SETTINGS: GameSettings = {
  mode: "freeroam",
  worldSeed: CURATED_WORLD_SEEDS[0],
  music: false,
  soundFx: true,
  windshieldShader: "simple",
  renderScaling: 1.0,
  visualPreset: "default",
  qualityLevel: "medium" as QualityLevel,
  frameRateLimit: 30 as FrameRateLimit,
  visibility: DEFAULT_VISIBILITY,
};
