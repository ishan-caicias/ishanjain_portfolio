/* ship-dynamics.ts — pure math for the ship's world-space flight staging (PF-07 ship-v2 P2).
 *
 * The P1 ship was a clip-space sprite: persp(30°) + an NDC post-shift. P2 places
 * it as a real object in the scene camera's view space (realism audit fix #1)
 * with spring dynamics for perceptible mass (fix #3). This module holds the
 * pure, unit-tested math; space-engine.js owns the per-frame state.
 *
 * Conventions match the engine: column-major mat4s, view space is right-handed
 * with the camera at the origin looking down −Z.
 */

/** Depth (view units, positive) at which the ship rides in front of the camera. */
export const SHIP_VIEW_DEPTH = 3;

/** The scene camera's base vertical FOV (radians) — warp breathing varies the
 * live FOV around this; station conversion uses the base so the ship genuinely
 * breathes with the scene camera instead of being re-anchored every frame. */
export const SHIP_BASE_FOV = (70 * Math.PI) / 180;

/* The P1 clip-space chain placed the unit-box ship at z=−2.6 under a 30° FOV
 * with a −0.14 vertical model offset. These constants reproduce that screen
 * composition exactly, so the station table keeps its historical values. */
const LEGACY_TAN = Math.tan((15 * Math.PI) / 180);
const LEGACY_DEPTH = 2.6;
/** NDC offset the old model-space −0.14 translation contributed. */
export const SHIP_NDC_Y_OFFSET = -0.14 / (LEGACY_DEPTH * LEGACY_TAN);
/** NDC amplitude of the idle bob (was ±0.018 model units pre-projection). */
export const SHIP_BOB_NDC = 0.018 / (LEGACY_DEPTH * LEGACY_TAN);

/** Uniform scale mapping the station `s` values (sized for the legacy chain)
 * to the same apparent size at SHIP_VIEW_DEPTH under the base scene FOV. */
export function shipScaleFactor(depth: number = SHIP_VIEW_DEPTH): number {
  return (depth * Math.tan(SHIP_BASE_FOV / 2)) / (LEGACY_DEPTH * LEGACY_TAN);
}

/** Convert an NDC-space station target into a view-space position at `depth`. */
export function ndcToView(
  ndcX: number,
  ndcY: number,
  depth: number,
  fovY: number,
  aspect: number,
): [number, number, number] {
  const tanHalf = Math.tan(fovY / 2);
  return [ndcX * depth * tanHalf * aspect, ndcY * depth * tanHalf, -depth];
}

export interface SpringState {
  /** Position (same units as the target). */
  p: number;
  /** Velocity (units/second). */
  v: number;
}

/**
 * Semi-implicit Euler step of a damped spring toward `target`.
 * zeta < 1 under-damps (overshoot + settle — the "mass" feel); zeta = 1 is
 * critical. dt must be clamped by the caller (frames can be skipped/throttled).
 */
export function springStep(
  s: SpringState,
  target: number,
  dt: number,
  omega: number,
  zeta: number,
): void {
  const a = omega * omega * (target - s.p) - 2 * zeta * omega * s.v;
  s.v += a * dt;
  s.p += s.v * dt;
}

/** Ship spring tuning: gentle glide, slight overshoot, ~1.5 s settle. */
export const SHIP_SPRING_OMEGA = 3.2;
export const SHIP_SPRING_ZETA = 0.72;

/** Look-lag: how far (NDC units) the ship trails behind view rotation per
 * unit of yaw/pitch velocity. Springs turn this into trail + catch-up. */
export const SHIP_LAG_YAW = 2.4;
export const SHIP_LAG_PITCH = 1.6;

/** Max dt fed into the springs — frames can be skipped (scroll throttle) or
 * the tab can sleep; a clamped step keeps the integration stable. */
export const SHIP_MAX_DT = 0.05;
