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
    gi: 9,
    gj: 4,
    adId: 17,
    face: 0,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — N
  {
    gi: 9,
    gj: 4,
    adId: 17,
    face: 1,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — E
  {
    gi: 9,
    gj: 4,
    adId: 17,
    face: 2,
    height: 42,
    offsetOut: 74,
    y: 645,
    style: "billboard",
    emissiveIntensity: 1.2,
  }, // energy drink — S
  {
    gi: 9,
    gj: 4,
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
    gj: 10,
    adId: 1,
    face: 2,
    height: 80,
    offsetOut: 25,
    offsetSide: -70,
    y: 100,
    cutBackground: true,
    emissiveIntensity: 1,
  }, // ninja

  // Cyberdine tower (7, 4) — hero billboard on the west face, visible from spawn
  { gi: 4, gj: 4, adId: 16, face: 2, height: 100, offsetOut: 80, y: 220 }, // holographic letters

  // Middle-left commercial area — tall neon banner
  { gi: 13, gj: 5, adId: 12, face: 2, height: 70 }, // neon Japanese banner

  // Mid-upper skyscraper row — portrait ads tucked partially into the building
  // for an embedded look (not floating).
  {
    gi: 8,
    gj: 11,
    adId: 4,
    face: 0,
    height: 135,
    offsetOut: 40,
    offsetSide: 0,
    y: 150,
    // emissiveIntensity: 4,
    cutBackground: false,
  }, // calligraphy
  { gi: 3, gj: 12, adId: 11, face: 3, height: 80, y: 180 }, // square: image-1812

  // Center towers (gj=7)
  {
    gi: 12,
    gj: 6,
    adId: 5,
    face: 2,
    height: 62,
    offsetOut: 30,
    y: 180,
    style: "billboard",
    emissiveIntensity: 0.7,
  }, // cdbj
  {
    gi: 8,
    gj: 5,
    adId: 7,
    face: 3,
    height: 45,
    offsetOut: 34,
    y: 150,
    style: "billboard",
    emissiveIntensity: 0.6,
  }, // cyberpunk girl

  // Lower buildings in the dead center
  { gi: 6, gj: 7, adId: 8, face: 2, height: 50, y: 150 }, // retrowave
  { gi: 12, gj: 10, adId: 3, face: 1, height: 100, y: 160 }, // pixel koi

  // Southern skyscrapers / tower row
  { gi: 4, gj: 12, adId: 15, face: 3, height: 55, offsetOut: 25, y: 170 }, // R&B
  { gi: 10, gj: 12, adId: 9, face: 1, height: 140, offsetOut: 76, y: 150 }, // ramen
  { gi: 7, gj: 10, adId: 14, face: 2, height: 55, offsetOut: 0, y: 150 }, // 0_1 landscape
  {
    gi: 5,
    gj: 9,
    adId: 13,
    face: 2,
    height: 80,
    offsetOut: 20,
    offsetSide: 0,
    y: 160,
    emissiveIntensity: 0.6,
  }, // Geisha

  // Bottom tower row
  // { gi: 9, gj: 5, adId: 6, face: 2, height: 55, offsetOut: 50, y: 250 }, // teal gradient
  {
    gi: 11,
    gj: 5,
    adId: 2,
    face: 2,
    height: 80,
    offsetOut: 0,
    y: 220,
    cutBackground: true,
    emissiveIntensity: 4,
  }, // Sengoku icon
];

// Defaults applied when an entry leaves a field unset.
export const WALL_AD_DEFAULTS = {
  face: 2 as 0 | 1 | 2 | 3, // south face — usually visible from spawn
  offsetOut: 36,
  y: 100,
  height: 70,
};
