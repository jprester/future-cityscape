/**
 * Visual effect presets for different aesthetic styles
 */

export type VisualPreset = {
  id: string;
  name: string;
  bloom: {
    intensity: number;
    luminanceThreshold: number;
    luminanceSmoothing: number;
    mipmapBlur?: boolean;
  };
  chromaticAberration: {
    enabled: boolean;
    offset: number;
  };
  vignette: {
    enabled: boolean;
    darkness: number;
    offset: number;
  };
  colorGrading: {
    enabled: boolean;
    saturation: number;
    contrast: number;
    brightness: number;
  };
  scanlines: {
    enabled: boolean;
    density: number;
    opacity: number;
  };
  noise: {
    enabled: boolean;
    opacity: number;
  };
  /**
   * Emissive intensity multipliers for different object categories
   * Base value is 1.0 - values above increase glow, below decrease
   */
  emissive: {
    ads: number; // Ads, toppers, billboards
    buildings: number; // Window lights on buildings
    neons: number; // Storefronts, signs
    ambient: number; // Ground glow, misc ambient
    smoke: number; // Atmospheric smoke/steam effects
  };
};

/**
 * Default/Original preset - clean look with bloom only on bright areas
 */
export const PRESET_DEFAULT: VisualPreset = {
  id: "default",
  name: "Default",
  bloom: {
    intensity: 3.5,
    luminanceThreshold: 0.1,
    luminanceSmoothing: 0.3,
  },
  chromaticAberration: {
    enabled: false,
    offset: 0.002,
  },
  vignette: {
    enabled: false,
    darkness: 0.5,
    offset: 0.5,
  },
  colorGrading: {
    enabled: false,
    saturation: 1.0,
    contrast: 1.0,
    brightness: 0.0,
  },
  scanlines: {
    enabled: false,
    density: 1.5,
    opacity: 0.1,
  },
  noise: {
    enabled: false,
    opacity: 0.02,
  },
  emissive: {
    ads: 1.2,
    buildings: 1.6,
    neons: 1.0,
    ambient: 1.0,
    smoke: 1.0,
  },
};

/**
 * Intense Neon - boosted bloom and saturation for vibrant neons
 */
export const PRESET_INTENSE_NEON: VisualPreset = {
  id: "intense-neon",
  name: "Intense Neon",
  bloom: {
    intensity: 12.0,
    luminanceThreshold: 0.1,
    luminanceSmoothing: 0.3,
    mipmapBlur: true,
  },
  chromaticAberration: {
    enabled: true,
    offset: 0.003,
  },
  vignette: {
    enabled: true,
    darkness: 0.4,
    offset: 0.5,
  },
  colorGrading: {
    enabled: true,
    saturation: 1.3,
    contrast: 1.1,
    brightness: 0.05,
  },
  scanlines: {
    enabled: false,
    density: 1.5,
    opacity: 0.1,
  },
  noise: {
    enabled: false,
    opacity: 0.02,
  },
  emissive: {
    ads: 1.5, // Brighter ads for neon feel
    buildings: 1.2,
    neons: 1.5,
    ambient: 1.0,
    smoke: 1.2,
  },
};

/**
 * Blade Runner - cinematic with film grain and vignette
 */
export const PRESET_BLADE_RUNNER: VisualPreset = {
  id: "blade-runner",
  name: "Blade Runner",
  bloom: {
    intensity: 10.0,
    luminanceThreshold: 0.15,
    luminanceSmoothing: 0.5,
    mipmapBlur: true,
  },
  chromaticAberration: {
    enabled: true,
    offset: 0.002,
  },
  vignette: {
    enabled: true,
    darkness: 0.6,
    offset: 0.4,
  },
  colorGrading: {
    enabled: true,
    saturation: 1.15,
    contrast: 1.15,
    brightness: -0.05,
  },
  scanlines: {
    enabled: false,
    density: 1.5,
    opacity: 0.05,
  },
  noise: {
    enabled: true,
    opacity: 0.03,
  },
  emissive: {
    ads: 1.1, // Slightly brighter for cinematic contrast
    buildings: 0.8, // Dimmer buildings for moody atmosphere
    neons: 1.1,
    ambient: 0.7,
    smoke: 1.5, // More visible smoke for atmospheric effect
  },
};

/**
 * Retro CRT - scanlines and noise for vintage look
 */
export const PRESET_RETRO_CRT: VisualPreset = {
  id: "retro-crt",
  name: "Retro CRT",
  bloom: {
    intensity: 8.0,
    luminanceThreshold: 0.0,
    luminanceSmoothing: 0.2,
  },
  chromaticAberration: {
    enabled: true,
    offset: 0.004,
  },
  vignette: {
    enabled: true,
    darkness: 0.7,
    offset: 0.3,
  },
  colorGrading: {
    enabled: true,
    saturation: 1.2,
    contrast: 1.2,
    brightness: 0.0,
  },
  scanlines: {
    enabled: true,
    density: 2.0,
    opacity: 0.15,
  },
  noise: {
    enabled: true,
    opacity: 0.04,
  },
  emissive: {
    ads: 1.0,
    buildings: 1.0,
    neons: 1.0,
    ambient: 1.2, // Slightly boosted ambient for CRT glow
    smoke: 1.0,
  },
};

/**
 * Hypercolor - extreme saturation and bloom
 */
export const PRESET_HYPERCOLOR: VisualPreset = {
  id: "hypercolor",
  name: "Hypercolor",
  bloom: {
    intensity: 15.0,
    luminanceThreshold: 0.05,
    luminanceSmoothing: 0.2,
    mipmapBlur: true,
  },
  chromaticAberration: {
    enabled: true,
    offset: 0.005,
  },
  vignette: {
    enabled: true,
    darkness: 0.3,
    offset: 0.6,
  },
  colorGrading: {
    enabled: true,
    saturation: 1.5,
    contrast: 1.2,
    brightness: 0.1,
  },
  scanlines: {
    enabled: false,
    density: 1.5,
    opacity: 0.1,
  },
  noise: {
    enabled: false,
    opacity: 0.02,
  },
  emissive: {
    ads: 2.0, // Maximum glow for extreme effect
    buildings: 1.5,
    neons: 2.0,
    ambient: 1.5,
    smoke: 2.0, // Maximum smoke glow
  },
};

/**
 * All available presets - keys match the preset.name for easy lookup
 */
export const VISUAL_PRESETS: Record<string, VisualPreset> = {
  default: PRESET_DEFAULT,
  "intense-neon": PRESET_INTENSE_NEON,
  "blade-runner": PRESET_BLADE_RUNNER,
  "retro-crt": PRESET_RETRO_CRT,
  hypercolor: PRESET_HYPERCOLOR,
};

export const PRESET_IDS = Object.keys(VISUAL_PRESETS);

/** @deprecated Use PRESET_IDS */
export const PRESET_NAMES = PRESET_IDS;

/**
 * Get a preset by ID with fallback to default
 */
export function getPreset(id: string): VisualPreset {
  return VISUAL_PRESETS[id] ?? PRESET_DEFAULT;
}
