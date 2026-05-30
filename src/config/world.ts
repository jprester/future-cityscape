/**
 * World configuration constants
 * Core settings for the city grid and generation
 */

// Grid dimensions
export const CITY_BLOCK_SIZE = 128;
export const ROAD_WIDTH = 24;
export const CELL_SIZE = CITY_BLOCK_SIZE + ROAD_WIDTH; // 152

// World seeds
export const DEFAULT_WORLD_SEED = 9746;
export const CURATED_WORLD_SEEDS = [9746, 6362, 4217, 5794];

// Altitude limits
export const MIN_ALTITUDE = 15;
export const MAX_ALTITUDE = 800;
export const DEFAULT_PLAYER_HEIGHT = 250;

// Traffic altitudes (layers)
export const TRAFFIC_ALTITUDES = [20, 40, 60, 80];
export const TRAFFIC_ALT_OFFSETS = [0, 200, 400];

/**
 * Get a random curated seed
 */
export function getRandomCuratedSeed(): number {
  return CURATED_WORLD_SEEDS[
    Math.floor(Math.random() * CURATED_WORLD_SEEDS.length)
  ];
}
