export type QualityLevel = "low" | "medium" | "high";

export type FrameRateLimit = 0 | 30 | 60 | 120; // 0 = unlimited

/**
 * Debug visibility toggles for different object types.
 */
export type VisibilitySettings = {
  buildings: boolean;
  megaBuildings: boolean;
  ads: boolean;
  smoke: boolean;
  spotlights: boolean;
  toppers: boolean;
  trafficCars: boolean;
  ground: boolean;
  storefronts: boolean;
};

export type GameSettings = {
  /** Filename in public/layouts/ to load instead of generating. e.g. "my_city.json" */
  finiteLayout?: string;
  worldSeed: number;
  music: boolean;
  soundFx: boolean;
  renderScaling: number;
  visualPreset: string;
  qualityLevel: QualityLevel;
  frameRateLimit: FrameRateLimit;
  visibility: VisibilitySettings;
};

