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
// Pick the image with `adId` (1..17, see src/config/ads.ts for the catalog)
// and pick the visual treatment with `style` ("holo" default / "billboard").
// Default placement values produce a reasonable ~70-unit-tall ad on the
// south face; override any field to tune.

export const WALL_ADS_MANUAL: WallAdManualEntry[] = [
  // Slim tower at (gi=5, gj=5) — four-sided billboard ring at the top
  {
    gi: 5,
    gj: 5,
    adId: 17,
    face: 0,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — N
  {
    gi: 5,
    gj: 5,
    adId: 17,
    face: 1,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — E
  {
    gi: 5,
    gj: 5,
    adId: 17,
    face: 2,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — S
  {
    gi: 5,
    gj: 5,
    adId: 17,
    face: 3,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — W

  // Skyscraper at (10, 5) — side-mounted ninja portrait
  {
    gi: 10,
    gj: 5,
    adId: 1,
    face: 1,
    height: 80,
    offsetOut: 25,
    offsetSide: -70,
    y: 100,
    cutBackground: true,
    emissiveIntensity: 1,
  }, // ninja

  // Cyberdine tower (7, 4) — hero billboard on the west face, visible from spawn
  { gi: 7, gj: 4, adId: 16, face: 3, height: 125, offsetOut: 80, y: 220 }, // holographic letters

  // Middle-left commercial area — tall neon banner
  { gi: 13, gj: 5, adId: 12, face: 2, height: 70 }, // neon Japanese banner

  // Mid-upper skyscraper row — portrait ads tucked partially into the building
  // for an embedded look (not floating).
  {
    gi: 11,
    gj: 4,
    adId: 4,
    face: 2,
    height: 135,
    offsetOut: 56,
    offsetSide: 10,
    y: 240,
    // emissiveIntensity: 4,
    cutBackground: false,
  }, // calligraphy
  { gi: 11, gj: 7, adId: 11, face: 3, height: 80, y: 180 }, // square: image-1812

  // Center towers (gj=7)
  {
    gi: 4,
    gj: 7,
    adId: 5,
    face: 0,
    height: 62,
    offsetOut: 21,
    y: 140,
    style: "billboard",
    emissiveIntensity: 0.7,
  }, // cdbj
  {
    gi: 12,
    gj: 7,
    adId: 7,
    face: 3,
    height: 85,
    offsetOut: 34,
    y: 150,
    style: "billboard",
    emissiveIntensity: 0.8,
  }, // cyberpunk girl

  // Lower buildings in the dead center
  { gi: 9, gj: 9, adId: 8, face: 2, height: 50, y: 180 }, // retrowave
  { gi: 12, gj: 6, adId: 3, face: 0, height: 200, y: 300 }, // pixel koi

  // Southern skyscrapers / tower row
  { gi: 4, gj: 12, adId: 15, face: 1, height: 65, y: 140 }, // R&B
  { gi: 11, gj: 12, adId: 9, face: 2, height: 140, offsetOut: 76, y: 150 }, // ramen
  { gi: 5, gj: 11, adId: 14, face: 3, height: 125, offsetOut: 27, y: 180 }, // 0_1 landscape
  {
    gi: 13,
    gj: 5,
    adId: 13,
    face: 1,
    height: 130,
    offsetOut: 38,
    offsetSide: 4,
    y: 60,
    // emissiveIntensity: 1.3,
  }, // Geisha

  // Bottom tower row
  { gi: 7, gj: 12, adId: 6, face: 1, height: 75, offsetOut: 50, y: 100 }, // teal gradient
  {
    gi: 7,
    gj: 6,
    adId: 2,
    face: 1,
    height: 80,
    offsetOut: 0,
    y: 240,
    cutBackground: true,
    emissiveIntensity: 10,
  }, // Sengoku icon
];

// Defaults applied when an entry leaves a field unset.
export const WALL_AD_DEFAULTS = {
  face: 2 as 0 | 1 | 2 | 3, // south face — usually visible from spawn
  offsetOut: 36,
  y: 100,
  height: 70,
};
