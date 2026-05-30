/**
 * UI labels and text constants
 * Centralized strings for UI elements
 */

// ============================================================================
// Control Instructions
// ============================================================================

export const CONTROLS_TEXT = {
  drive: [
    "use mouse to look around/steer",
    "use mouse wheel to zoom",
    "press <space> to toggle autopilot",
    "hold <w> to boost, <s> to brake",
    "use <+> and <-> to adjust volume",
    "press <]> to skip current song",
    "press <p> to pause current song",
    "press <esc> to open terminal",
  ],
  freeroam: [
    "use <w,a,s,d> to move camera",
    "use mouse wheel to zoom",
    "use <r> and <f> to adjust height",
    "hold <shift> to increase speed",
    "use <+> and <-> to adjust volume",
    "press <]> to skip current song",
    "press <p> to pause current song",
    "press <esc> to open terminal",
  ],
} as const;

// ============================================================================
// Mode Labels
// ============================================================================

export const MODE_LABELS = {
  drive: "Drive",
  freeroam: "Freeroam",
  walk: "Walk",
} as const;

// ============================================================================
// Quality Labels
// ============================================================================

export const QUALITY_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
} as const;

// ============================================================================
// Terminal Messages
// ============================================================================

export const TERMINAL_MESSAGES = {
  bootComplete: ">> boot sequence complete",
  loading: "loading...",
  ready: "ready",
} as const;

// ============================================================================
// Visibility Toggle Labels
// ============================================================================

export const VISIBILITY_LABELS: Record<string, string> = {
  buildings: "Buildings",
  megaBuildings: "Mega Buildings",
  ads: "Ads",
  smoke: "Smoke",
  spotlights: "Spotlights",
  toppers: "Toppers",
  trafficCars: "Traffic Cars",
  playerCar: "Player Car",
  ground: "Ground",
  storefronts: "Storefronts",
  cityLights: "City Lights",
  streetLights: "Street Lights",
} as const;

export type GameMode = keyof typeof CONTROLS_TEXT;
