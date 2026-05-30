/**
 * Random utility functions
 * Helpers for random selection and shuffling
 */

/**
 * Pick a random element from an array
 */
export function randomFromArray<T>(array: T[]): T {
  return array[Math.floor(Math.random() * array.length)];
}

/**
 * Pick a random element from an array using a noise value (0-1)
 */
export function pickFromNoise<T>(array: T[], noise: number): T {
  const index = Math.floor(noise * array.length);
  return array[Math.min(index, array.length - 1)];
}

/**
 * Shuffle an array in place (Fisher-Yates algorithm)
 */
export function shuffleArray<T>(array: T[]): T[] {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

/**
 * Create a shuffled copy of an array (non-mutating)
 */
export function shuffled<T>(array: T[]): T[] {
  return shuffleArray([...array]);
}

/**
 * Generate a random number in a range
 */
export function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

/**
 * Generate a random integer in a range (inclusive)
 */
export function randomInt(min: number, max: number): number {
  return Math.floor(randomRange(min, max + 1));
}

/**
 * Return true with a given probability (0-1)
 */
export function randomChance(probability: number): boolean {
  return Math.random() < probability;
}
