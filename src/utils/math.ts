/**
 * Math utility functions
 * Common mathematical operations used throughout the application
 */

/**
 * Clamp a number between min and max values
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Linear interpolation between two values
 * @param a Start value
 * @param b End value
 * @param t Interpolation factor (0-1)
 */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Map a value from one range to another
 * @param value Input value
 * @param inMin Input range minimum
 * @param inMax Input range maximum
 * @param outMin Output range minimum
 * @param outMax Output range maximum
 */
export function mapRange(
  value: number,
  inMin: number,
  inMax: number,
  outMin: number,
  outMax: number,
): number {
  return ((value - inMin) * (outMax - outMin)) / (inMax - inMin) + outMin;
}

/**
 * Smooth step interpolation (ease in-out)
 * @param t Interpolation factor (0-1)
 */
export function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

/**
 * Smoother step interpolation (Ken Perlin's improved version)
 * @param t Interpolation factor (0-1)
 */
export function smootherstep(t: number): number {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

/** Reference frame rate the simulation constants were tuned at. */
export const REFERENCE_FPS = 60;

/**
 * Normalized frame factor for frame-rate-independent simulation.
 * Returns 1.0 at REFERENCE_FPS, >1 on slower frames, <1 on faster frames.
 * Clamped so a long pause (e.g. tabbed away) can't teleport the simulation.
 *
 * Multiply linear per-frame increments (acceleration, integration) by this.
 * @param delta Frame time in seconds (from useFrame)
 * @param maxFactor Upper clamp on the factor (default 4 = down to ~15fps)
 */
export function frameFactor(delta: number, maxFactor = 4): number {
  return Math.min(Math.max(delta, 0) * REFERENCE_FPS, maxFactor);
}

/**
 * Frame-rate-correct equivalent of a per-frame exponential smoothing rate.
 * A per-60fps-frame lerp of `x += (target - x) * rate` becomes
 * `x += (target - x) * smoothingFactor(rate, f)`. At f === 1 this returns
 * `rate` exactly, so behavior is unchanged at REFERENCE_FPS.
 * @param rate Per-reference-frame smoothing rate (0-1)
 * @param f Normalized frame factor from frameFactor()
 */
export function smoothingFactor(rate: number, f: number): number {
  return 1 - Math.pow(1 - rate, f);
}
