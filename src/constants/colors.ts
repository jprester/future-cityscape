/**
 * Centralized color constants
 * All hex colors used throughout the application
 */

// ============================================================================
// Environment Colors
// ============================================================================

export const COLORS = {
  // Night environment
  // Fog is a deep indigo/purple-blue so distant towers dissolve into a hazy
  // glow (rather than the old dark teal void). This is the atmospheric-depth
  // tint that makes the skyline read as a vast cyberpunk megacity.
  night: {
    fog: 0x1b1838,
    // Street-level haze tint (height fog): the same indigo family, lifted and
    // pushed warm/plum — light pollution glowing in the thick low air.
    fogGround: 0x3b2544,
    sun: 0x8b79ff,
    ambient: 0x1c384a,
  },

  // Day environment
  day: {
    fog: 0xaf6a3b,
    sun: 0xffa25e,
    ambient: 0x825233,
  },

  // ============================================================================
  // Material Colors
  // ============================================================================

  materials: {
    white: 0xffffff,
    black: 0x000000,
    gray: 0x808080,
    darkGray: 0x444444,
    specularGray: 0x777777,

    // Ground emissive
    groundEmissive: 0x0090ff,

    // Smoke emissive (atmospheric blue)
    smokeEmissive: 0x4488aa,
  },

  // ============================================================================
  // UI / Debug Colors
  // ============================================================================

  debug: {
    wireframe: 0x444444,
    collision: 0xff0000,
    highlight: 0x00ff00,
  },

  // ============================================================================
  // Light Colors
  // ============================================================================

  lights: {
    streetLight: "#ffd9aa", // Warm white for street lights
    streetLightDebug: "#00ffff", // Cyan for debugging
  },
} as const;

// Type for accessing nested color values
export type ColorKey = keyof typeof COLORS;
