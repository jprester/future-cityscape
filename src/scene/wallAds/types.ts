import type { AdStyle } from "../../config/ads";

// ── Authoring schema ───────────────────────────────────────────────────────
//
// One entry per ad placement. Target a specific tower / skyscraper by its
// (gi, gj) grid coords from CITY_TEMPLATE (see generateLayout.ts). On layout
// init a console.table prints every tower/skyscraper with its coords, so
// you can copy them from there.
//
// Wall-relative coordinate system — imagine standing outside the building,
// looking at the ad:
//   • offsetOut  → toward/away from wall (depth)
//   • offsetSide → left/right along the wall
//   • y          → world Y (vertical)
//   • tilt       → pitch the ad forward/back around its horizontal axis
//   • rotationOffset → spin the ad around the world Y axis

export type WallAdManualEntry = {
  /** Grid column from CITY_TEMPLATE */
  gi: number;
  /** Grid row from CITY_TEMPLATE */
  gj: number;
  /** Which ad image to display — the id from ADS_META (config/ads.ts). */
  adId: number;
  /** Visual style:
   *   • "holo" (default) — semi-transparent additive hologram
   *   • "billboard"      — opaque self-illuminated LED panel
   *  cutBackground / alphaTest / opacity overrides only apply to holo. */
  style?: AdStyle;
  /** Cardinal face of the building (0=N, 1=E, 2=S, 3=W), pre-rotation. */
  face?: 0 | 1 | 2 | 3;
  /** Distance out from the wall — depth axis. */
  offsetOut?: number;
  /** Slide along the wall surface — positive = right when facing the ad. */
  offsetSide?: number;
  /** Absolute Y position of the plane center (units). */
  y?: number;
  /** Plane height (units). Width auto-derived from the texture's aspect. */
  height?: number;
  /** Optional explicit width override; otherwise height × texture aspect. */
  width?: number;
  /** Pitch in radians — positive tilts the top toward the viewer. */
  tilt?: number;
  /** Extra rotation around Y in radians. */
  rotationOffset?: number;

  // ── Material overrides ────────────────────────────────────────────────
  // When any of these is set, the renderer clones the shared material so
  // the tweak doesn't leak to other ads using the same image+style combo.
  //
  /** Multiplier on the base emissive intensity (1 = default, 2 = double). */
  emissiveIntensity?: number;
  /** Override the emissive tint. Accepts a hex number (0x44ccff) or a CSS
   *  string ("#44ccff", "hsl(...)"). Default is faint cyan (holo) /
   *  white (billboard). */
  emissiveColor?: number | string;
  /** Override the material opacity. (Holo only — billboards are opaque.) */
  opacity?: number;
  /** Cut the dark background out of the texture using its green channel
   *  as alpha. Holo only. */
  cutBackground?: boolean;
  /** Alpha cutoff threshold when cutBackground is on. Default 0.05.
   *  Lower values (0.01–0.03) preserve red/magenta subjects whose green
   *  channel is naturally low. Holo only. */
  alphaTest?: number;
};

// ── Runtime state ──────────────────────────────────────────────────────────
// Resolved form ready for the renderer. The resolver translates each
// `WallAdManualEntry` into one of these.

export type WallAd = {
  /** Resolved material key (e.g. "ad_holo_07" or "ad_billboard_07"). */
  matKey: string;
  /** Native texture aspect ratio — sizing-derived, not used by renderer. */
  aspect: number;
  /** World-space position of the plane center. */
  x: number;
  y: number;
  z: number;
  /** Plane size in world units. */
  width: number;
  height: number;
  /** Y rotation so the plane faces outward from the building. */
  rotationY: number;
  /** X rotation (pitch) applied after Y rotation — uses YXZ Euler order. */
  rotationX: number;
  /** Per-ad material overrides — only set when the entry asks for them. */
  emissiveIntensityMul?: number;
  emissiveColor?: number | string;
  opacity?: number;
  cutBackground?: boolean;
  alphaTestOverride?: number;
  /** Optional per-frame tick (e.g. for texture cycling). */
  update?: () => void;
};
