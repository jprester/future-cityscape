/**
 * Parse game settings from URL query parameters.
 *
 * Quickstart is the default (auto-launch into the city). To see the boot
 * terminal/splash, append `?setup` or `?quickstart=0`.
 *
 * Supported params:
 *   setup          - show the boot terminal/splash (disables quickstart)
 *   quickstart     - "0" disables quickstart; any other value (or absent) keeps it on
 *   mode           - "drive" | "freeroam"
 *   layout         - filename from public/layouts/ (e.g. "my_city.json") to load
 *                    instead of generating from the built-in template
 *   seed           - world seed number
 *   quality        - "low" | "medium" | "high"
 *   fps            - 0 | 30 | 60 | 120
 *   resolution     - 0.5 | 0.75 | 1 | 1.5
 *   preset         - visual preset name (e.g. "Blade Runner")
 *   windshield     - "simple" | "advanced"
 *   music          - "0" or "1"
 *   sfx            - "0" or "1"
 *
 * Example:
 *   ?setup&mode=drive   (show splash, drive through the city)
 */

import { DEFAULT_GAME_SETTINGS } from "./settings";
import type { GameSettings, QualityLevel, FrameRateLimit } from "../types/settings";

const VALID_MODES = new Set(["drive", "freeroam"]);
const VALID_QUALITY: Set<string> = new Set(["low", "medium", "high"]);
const VALID_FPS = new Set([0, 30, 60, 120]);
const VALID_RESOLUTIONS = new Set([0.5, 0.75, 1, 1.5]);

export type QueryConfig = {
  quickstart: boolean;
  settings: Partial<GameSettings>;
};

export function parseQuerySettings(search: string = window.location.search): QueryConfig {
  const params = new URLSearchParams(search);
  const settings: Partial<GameSettings> = {};

  // Quickstart defaults to true; ?setup or ?quickstart=0 opts out.
  const quickstart =
    !params.has("setup") && params.get("quickstart") !== "0";

  const mode = params.get("mode");
  if (mode && VALID_MODES.has(mode)) {
    settings.mode = mode;
  }

  const layout = params.get("layout");
  if (layout) {
    settings.finiteLayout = layout;
  }

  const seed = params.get("seed");
  if (seed !== null) {
    const n = Number(seed);
    if (!Number.isNaN(n) && Number.isFinite(n)) {
      settings.worldSeed = Math.round(n);
    }
  }

  const quality = params.get("quality");
  if (quality && VALID_QUALITY.has(quality)) {
    settings.qualityLevel = quality as QualityLevel;
  }

  const fps = params.get("fps");
  if (fps !== null) {
    const n = Number(fps);
    if (VALID_FPS.has(n)) {
      settings.frameRateLimit = n as FrameRateLimit;
    }
  }

  const resolution = params.get("resolution");
  if (resolution !== null) {
    const n = Number(resolution);
    if (VALID_RESOLUTIONS.has(n)) {
      settings.renderScaling = n;
    }
  }

  const preset = params.get("preset");
  if (preset) {
    settings.visualPreset = preset;
  }

  const windshield = params.get("windshield");
  if (windshield === "simple" || windshield === "advanced") {
    settings.windshieldShader = windshield;
  }

  const music = params.get("music");
  if (music === "0" || music === "1") {
    settings.music = music === "1";
  }

  const sfx = params.get("sfx");
  if (sfx === "0" || sfx === "1") {
    settings.soundFx = sfx === "1";
  }

  return { quickstart, settings };
}

/** Merge query overrides onto defaults */
export function getInitialSettings(): GameSettings {
  const { settings: overrides } = parseQuerySettings();
  return { ...DEFAULT_GAME_SETTINGS, ...overrides };
}
