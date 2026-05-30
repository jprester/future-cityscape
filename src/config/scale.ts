/**
 * World scale — single source of truth mapping world units ↔ real meters.
 *
 * The city geometry was authored in arbitrary units. We anchor the scale to a
 * realistic city block so that human-facing values (camera eye height, walk
 * speed, etc.) can be expressed in real meters and the first-person
 * perspective matches that of a real person.
 *
 * Anchor: CITY_BLOCK_SIZE (128u) ≈ 80 m — a typical dense-city block.
 * Derived: 1 m = 1.6 u, so ROAD_WIDTH (24u) ≈ 15 m and CELL_SIZE (152u) ≈ 95 m.
 *
 * NOTE: building *models* are authored at arbitrary heights, so a realistic
 * camera does not by itself guarantee realistic building proportions — that
 * depends on each model's authored size relative to this scale. Set
 * VITE-dev logging is available to audit measured building heights in meters.
 */
import { CITY_BLOCK_SIZE } from "./world";

/** Real-world length we treat one city block as, in meters. */
export const CITY_BLOCK_METERS = 80;

/** World units per real-world meter. */
export const UNITS_PER_METER = CITY_BLOCK_SIZE / CITY_BLOCK_METERS; // 1.6

/** Convert real meters → world units. */
export function meters(m: number): number {
  return m * UNITS_PER_METER;
}

/** Convert world units → real meters. */
export function unitsToMeters(u: number): number {
  return u / UNITS_PER_METER;
}

/**
 * Eye height of an average ~180 cm adult. The eyes sit ~1.70 m above the
 * ground (≈ 0.94 × stature), so this is the realistic first-person camera
 * height for a standing person.
 */
export const HUMAN_EYE_HEIGHT_METERS = 1.7;
export const HUMAN_EYE_HEIGHT_UNITS = meters(HUMAN_EYE_HEIGHT_METERS);

/** Lowest the eye can drop (crouch / near-ground) and flight ceiling, in meters. */
export const MIN_EYE_HEIGHT_METERS = 0.9;
export const MAX_EYE_HEIGHT_METERS = 500;
