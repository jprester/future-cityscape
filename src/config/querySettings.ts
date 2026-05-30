/**
 * Parse the initial game settings from URL query parameters. These are read
 * once at startup and merged onto the defaults; the panel UI takes over from
 * there (changes stay in-memory and do not rewrite the URL).
 *
 * Supported params:
 *   layout         - filename from public/layouts/ (e.g. "my_city.json") to load
 *                    instead of generating from the built-in template
 *   seed           - world seed number
 *   quality        - "low" | "medium" | "high"
 *   fps            - 0 | 30 | 60 | 120
 *   resolution     - 0.5 | 0.75 | 1 | 1.5
 *   preset         - visual preset name (e.g. "Blade Runner")
 *   music          - "0" or "1"
 *   sfx            - "0" or "1"
 *
 * Example:
 *   ?seed=42&quality=high
 */

import { DEFAULT_GAME_SETTINGS } from "./settings";
import type { GameSettings, QualityLevel, FrameRateLimit } from "../types/settings";

const VALID_QUALITY: Set<string> = new Set(["low", "medium", "high"]);
const VALID_FPS = new Set([0, 30, 60, 120]);
const VALID_RESOLUTIONS = new Set([0.5, 0.75, 1, 1.5]);

export function parseQuerySettings(
  search: string = window.location.search,
): Partial<GameSettings> {
  const params = new URLSearchParams(search);
  const settings: Partial<GameSettings> = {};

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

  const music = params.get("music");
  if (music === "0" || music === "1") {
    settings.music = music === "1";
  }

  const sfx = params.get("sfx");
  if (sfx === "0" || sfx === "1") {
    settings.soundFx = sfx === "1";
  }

  return settings;
}

/** Merge query overrides onto defaults */
export function getInitialSettings(): GameSettings {
  return { ...DEFAULT_GAME_SETTINGS, ...parseQuerySettings() };
}
