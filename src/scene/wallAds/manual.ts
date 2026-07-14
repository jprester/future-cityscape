import type { WallAdManualEntry } from "./types";

// ── Manual wall-ad placement ───────────────────────────────────────────────
//
// Explicit list of ads mounted on specific tower / skyscraper buildings.
// The city template is finite and each big building is unique, so
// procedural placement isn't worth the lack of control.
//
// Target a building by its grid coords (gi = col, gj = row) from the
// CITY_TEMPLATE in src/config/cityLayouts/generateLayout.ts. On layout init
// a console.table prints every tower/skyscraper with its (gi, gj) so you
// can copy entries from there.
//
// Pick the image with `adId` (18..30, see src/config/ads.ts for the catalog)
// and pick the visual treatment with `style` ("holo" default / "billboard").
// Default placement values produce a reasonable ~70-unit-tall ad on the
// south face; override any field to tune.
//
// COMPANY LOGOS — set `pneonKey` instead of `adId` to place a code-generated
// neon logo (proceduralNeon.ts). 12 generated companies (00–11), three
// matching variants each (same name + colors):
//   • "pneon_logo_t_NN" — channel-letter wordmark, 4:1 (SONY/TRUIST crowns;
//     a height of ~20 reads well at a roofline)
//   • "pneon_logo_w_NN" — glyph + name lockup, 2:1
//   • "pneon_logo_v_NN" — letters stacked vertically, 1:4 (corner edges)
// The generated signs ("pneon_v_NN"/"pneon_h_NN") and pictorial blade signs
// ("pneon_p_NN" — ramen/martini/torii/… icons, 2:3) work here too. `style`
// is ignored for pneon entries. Example — wordmark at a tower's roofline:
//   { gi: 9, gj: 7, pneonKey: "pneon_logo_t_02", face: 2, height: 22, y: 320 },

export const WALL_ADS_MANUAL: WallAdManualEntry[] = [
  // Slim tower at (gi=5, gj=5) — four-sided billboard ring at the top
  {
    gi: 12,
    gj: 7,
    adId: 26,
    face: 0,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // Volt Cola — N
  {
    gi: 12,
    gj: 7,
    adId: 26,
    face: 1,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // Volt Cola — E
  {
    gi: 12,
    gj: 7,
    adId: 26,
    face: 2,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // Volt Cola — S
  {
    gi: 12,
    gj: 7,
    adId: 26,
    face: 3,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // Volt Cola — W

  // Skyscraper at (10, 5) — side-mounted courier portrait
  {
    gi: 15,
    gj: 13,
    adId: 22,
    face: 3,
    height: 80,
    offsetOut: 25,
    offsetSide: -70,
    y: 140,
    cutBackground: true,
    emissiveIntensity: 1.5,
  }, // Neon Runner

  // Cyberdine tower (7, 4) — hero billboard on the west face, visible from spawn
  { gi: 9, gj: 7, adId: 27, face: 0, height: 80, offsetOut: 80, y: 180 }, // Dreamstate FM

  // Middle-left commercial area — tall neon banner
  { gi: 8, gj: 14, adId: 29, face: 2, height: 70, y: 130, offsetOut: 0 }, // Nova vertical

  // Mid-upper skyscraper row — portrait ads tucked partially into the building
  // for an embedded look (not floating).
  {
    gi: 11,
    gj: 14,
    adId: 23,
    face: 0,
    height: 135,
    offsetOut: 40,
    offsetSide: 0,
    y: 220,
    // emissiveIntensity: 4,
    cutBackground: false,
  }, // Luna Tea
  { gi: 11, gj: 8, adId: 18, face: 1, height: 30, y: 160 }, // Kitsune square

  // Center towers (gj=7)
  // Billboard, not holo: the artwork is mostly dark, and the additive holo
  // material can only ADD brightness — dark pixels vanish and the ad reads
  // washed-out. The opaque LED-panel treatment shows the full image.
  {
    gi: 15,
    gj: 9,
    adId: 25,
    face: 2,
    height: 70,
    offsetOut: 30,
    y: 120,
    style: "billboard",
  }, // Nightline
  {
    gi: 8,
    gj: 5,
    adId: 20,
    face: 3,
    height: 45,
    offsetOut: 34,
    y: 150,
    style: "billboard",
    emissiveIntensity: 0.6,
  }, // Aero-9

  // Lower buildings in the dead center
  { gi: 6, gj: 7, adId: 27, face: 2, height: 50, y: 150 }, // Dreamstate FM
  { gi: 12, gj: 9, adId: 30, face: 2, height: 100, y: 190 }, // legacy pixel koi holograph

  // Southern skyscrapers / tower row
  { gi: 15, gj: 11, adId: 28, face: 2, height: 45, offsetOut: 25, y: 200 }, // Sora Motors
  { gi: 8, gj: 12, adId: 19, face: 2, height: 80, offsetOut: 40, y: 150 }, // Orbit Ramen
  { gi: 7, gj: 10, adId: 26, face: 2, height: 55, offsetOut: 0, y: 150 }, // Volt Cola
  {
    gi: 5,
    gj: 9,
    adId: 24,
    face: 2,
    height: 80,
    offsetOut: 20,
    offsetSide: 0,
    y: 160,
    emissiveIntensity: 0.6,
  }, // Kuro Arcade

  // Bottom tower row
  // { gi: 9, gj: 5, adId: 21, face: 2, height: 55, offsetOut: 50, y: 250 }, // Mori Synth
  {
    gi: 9,
    gj: 15,
    adId: 18,
    face: 1,
    height: 80,
    offsetOut: 0,
    y: 200,
    cutBackground: true,
    emissiveIntensity: 5,
  }, // Kitsune icon
];

// Defaults applied when an entry leaves a field unset.
export const WALL_AD_DEFAULTS = {
  face: 2 as 0 | 1 | 2 | 3, // south face — usually visible from spawn
  offsetOut: 36,
  y: 100,
  height: 70,
};
