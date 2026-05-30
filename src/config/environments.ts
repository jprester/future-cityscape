/**
 * Environment configurations
 * Defines the visual settings for different time-of-day environments
 */

import { COLORS } from "../constants/colors";

export type EnvironmentConfig = {
  name: string;
  sky: string;
  environmentMap: string;
  cityLights: boolean;
  windowLights: boolean;
  spotLights: boolean;
  streetLights: boolean;
  /**
   * Whether the directional (sun) light casts real-time shadows. At night the
   * shadow is imperceptible against the dark, emissive-driven scene, so we skip
   * the entire shadow render pass — a significant frame-time saving.
   */
  shadows: boolean;
  /**
   * Attenuates `scene.environment` (image-based lighting) via
   * `Scene.environmentIntensity` (three r162+). PBR building materials carry
   * their own explicit `envMap`, so this only affects the MeshPhong materials
   * (ads, OBJ buildings, smoke, spotlights) that fall back to scene.environment.
   * three ≤0.159 did not light Phong/Lambert from scene.environment at all, so
   * 0 reproduces the original look; raise it to let the env map tint them.
   */
  environmentIntensity: number;
  fog: {
    color: number;
    density: number;
  };
  sun: {
    color: number;
    intensity: number;
    x: number;
    y: number;
    z: number;
  };
  ambient: {
    color: number;
    intensity: number;
  };
};

export const ENVIRONMENT_NIGHT: EnvironmentConfig = {
  name: "night",
  sky: "sky_night",
  environmentMap: "env_night",
  cityLights: true,
  windowLights: true,
  spotLights: true,
  streetLights: true,
  shadows: false,
  environmentIntensity: 0,
  fog: {
    color: COLORS.night.fog,
    density: 0.0011,
  },
  sun: {
    color: COLORS.night.sun,
    intensity: 0.6,
    x: 1,
    y: 0.5,
    z: 0.25,
  },
  ambient: {
    color: COLORS.night.ambient,
    intensity: 0.4,
  },
};

export const ENVIRONMENT_DAY: EnvironmentConfig = {
  name: "day",
  sky: "sky_day",
  environmentMap: "env_day",
  cityLights: false,
  windowLights: false,
  spotLights: false,
  streetLights: false,
  shadows: true,
  environmentIntensity: 0,
  fog: {
    color: COLORS.day.fog,
    density: 0.00035,
  },
  sun: {
    color: COLORS.day.sun,
    intensity: 2,
    x: 1,
    y: 0.2,
    z: 0.65,
  },
  ambient: {
    color: COLORS.day.ambient,
    intensity: 0.5,
  },
};

export const ENVIRONMENTS: Record<string, EnvironmentConfig> = {
  night: ENVIRONMENT_NIGHT,
  day: ENVIRONMENT_DAY,
};

export type EnvironmentId = keyof typeof ENVIRONMENTS;

/**
 * Get environment config by ID with fallback to night
 */
export function getEnvironment(id: string): EnvironmentConfig {
  return ENVIRONMENTS[id] ?? ENVIRONMENT_NIGHT;
}
