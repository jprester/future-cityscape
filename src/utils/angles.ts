/**
 * Angle utility functions
 * Common angle/rotation operations
 */

const TWO_PI = Math.PI * 2;

/**
 * Normalize angle to be between 0 and 2π (radians)
 */
export function normalizeAngle(angle: number): number {
  return angle - TWO_PI * Math.floor(angle / TWO_PI);
}

/**
 * Alias for normalizeAngle (legacy compatibility)
 */
export const fixAngle = normalizeAngle;

/**
 * Calculate the shortest signed distance between two angles (radians)
 * Returns positive for clockwise, negative for counter-clockwise
 */
export function angleDist(a: number, b: number): number {
  const normalA = normalizeAngle(a);
  const normalB = normalizeAngle(b);

  let posDist: number;
  let negDist: number;

  if (normalB > normalA) {
    posDist = normalB - normalA;
    negDist = normalA + (TWO_PI - normalB);
  } else {
    posDist = normalB + (TWO_PI - normalA);
    negDist = normalA - normalB;
  }

  return posDist < negDist ? posDist : -negDist;
}

/**
 * Convert degrees to radians
 */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Convert radians to degrees
 */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/**
 * Get rotation value from discrete options based on noise
 * @param noise Noise value 0-1
 * @returns Rotation in degrees (0, 90, 180, or 270)
 */
export function getRotationFromNoise(noise: number): number {
  if (noise < 0.25) return 0;
  if (noise < 0.5) return 90;
  if (noise < 0.75) return 180;
  return 270;
}
