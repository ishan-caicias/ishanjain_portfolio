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

/* ---------- P3: layered thruster exhaust (realism audit fix #2) ---------- */

/** Nozzle anchor points in unit-ship space (nose −Z; matches the legacy glow
 * sprite positions, which read correctly against both ship meshes). */
export const PLUME_ENGINES: readonly [number, number, number][] = [
  [0, -0.09, 0.28],
  [-0.05, -0.07, 0.24],
  [0.05, -0.07, 0.24],
];

export interface PlumeParams {
  /** Acceleration or deceleration burn segment of a warp. */
  burning: boolean;
  /** Mid-warp coast/flip segment (engines cut). */
  coasting: boolean;
  /** Parked at an arrived body, engines idling low. */
  parked: boolean;
  /** prefers-reduced-motion: fixed lengths, no jitter or breathing. */
  reduced: boolean;
  /** Seconds — drives jitter and idle breathing. */
  t: number;
}

/** Phase-dependent flare length (unit-ship space, extends along +Z). */
export function plumeFlareLength(p: PlumeParams): number {
  if (p.burning) return p.reduced ? 0.55 : 0.55 + Math.sin(p.t * 47) * 0.06;
  if (p.coasting) return 0.07;
  if (p.parked) return p.reduced ? 0.1 : 0.1 + Math.sin(p.t * 2.1) * 0.015;
  return p.reduced ? 0.16 : 0.16 + Math.sin(p.t * 2.1) * 0.03;
}

/** Plume brightness per phase (multiplied by ship fade at draw time). */
export function plumeAlpha(p: PlumeParams): number {
  if (p.burning) return 0.9;
  if (p.coasting) return 0.15;
  if (p.parked) return 0.3;
  return 0.42;
}

const PLUME_W_NOZZLE = 0.028;
const PLUME_W_TIP = 0.06;
/** Floats per plume vertex: x, y, z, alpha. */
export const PLUME_VERTEX_FLOATS = 4;
/** 3 engines × 2 crossed quads × 2 triangles × 3 vertices. */
export const PLUME_VERTEX_COUNT = PLUME_ENGINES.length * 2 * 2 * 3;

/**
 * Cone-ish exhaust geometry: per engine, two quads crossed at 90° (X-plane and
 * Y-plane), tapering from PLUME_W_NOZZLE (alpha 1) at the nozzle to
 * PLUME_W_TIP (alpha 0) at nozzle.z + flare. Interleaved [x,y,z,a].
 * Pass `target` to reuse a scratch buffer — this runs every frame, so the
 * engine avoids a per-frame allocation.
 */
export function buildPlumeVertices(
  flare: number,
  target?: Float32Array,
): Float32Array {
  const out =
    target ?? new Float32Array(PLUME_VERTEX_COUNT * PLUME_VERTEX_FLOATS);
  let o = 0;
  const put = (x: number, y: number, z: number, a: number) => {
    out[o++] = x;
    out[o++] = y;
    out[o++] = z;
    out[o++] = a;
  };
  for (const [ex, ey, ez] of PLUME_ENGINES) {
    const tip = ez + flare;
    // quad in the XZ orientation (spans local X), then YZ (spans local Y)
    for (const axis of [0, 1] as const) {
      const nx = axis === 0 ? PLUME_W_NOZZLE : 0;
      const ny = axis === 0 ? 0 : PLUME_W_NOZZLE;
      const txw = axis === 0 ? PLUME_W_TIP : 0;
      const tyw = axis === 0 ? 0 : PLUME_W_TIP;
      // tri 1: nozzle-left, nozzle-right, tip-right
      put(ex - nx, ey - ny, ez, 1);
      put(ex + nx, ey + ny, ez, 1);
      put(ex + txw, ey + tyw, tip, 0);
      // tri 2: nozzle-left, tip-right, tip-left
      put(ex - nx, ey - ny, ez, 1);
      put(ex + txw, ey + tyw, tip, 0);
      put(ex - txw, ey - tyw, tip, 0);
    }
  }
  return out;
}

/* ---------- PF-08 F1: quaternion flight state ---------- */

/** [x, y, z, w] quaternion. */
export type Quat = [number, number, number, number];

export const QUAT_IDENTITY: Quat = [0, 0, 0, 1];

/** Shortest-arc rotation taking unit vector `a` onto unit vector `b`. */
export function quatFromUnitVectors(
  a: readonly number[],
  b: readonly number[],
): Quat {
  const d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  if (d > 0.99999) return [0, 0, 0, 1];
  if (d < -0.99999) {
    // opposite: rotate 180° around any axis ⟂ a
    const ax = Math.abs(a[0]) > 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cx = a[1] * ax[2] - a[2] * ax[1];
    const cy = a[2] * ax[0] - a[0] * ax[2];
    const cz = a[0] * ax[1] - a[1] * ax[0];
    const l = Math.hypot(cx, cy, cz);
    return [cx / l, cy / l, cz / l, 0];
  }
  const cx = a[1] * b[2] - a[2] * b[1];
  const cy = a[2] * b[0] - a[0] * b[2];
  const cz = a[0] * b[1] - a[1] * b[0];
  const q: Quat = [cx, cy, cz, 1 + d];
  const l = Math.hypot(q[0], q[1], q[2], q[3]);
  return [q[0] / l, q[1] / l, q[2] / l, q[3] / l];
}

export function quatSlerp(a: Quat, b: Quat, t: number): Quat {
  let d = a[0] * b[0] + a[1] * b[1] + a[2] * b[2] + a[3] * b[3];
  const bb: Quat = d < 0 ? [-b[0], -b[1], -b[2], -b[3]] : [...b];
  if (d < 0) d = -d;
  if (d > 0.9995) {
    const o: Quat = [
      a[0] + (bb[0] - a[0]) * t,
      a[1] + (bb[1] - a[1]) * t,
      a[2] + (bb[2] - a[2]) * t,
      a[3] + (bb[3] - a[3]) * t,
    ];
    const l = Math.hypot(o[0], o[1], o[2], o[3]);
    return [o[0] / l, o[1] / l, o[2] / l, o[3] / l];
  }
  const th = Math.acos(d);
  const s = Math.sin(th);
  const wa = Math.sin((1 - t) * th) / s;
  const wb = Math.sin(t * th) / s;
  return [
    a[0] * wa + bb[0] * wb,
    a[1] * wa + bb[1] * wb,
    a[2] * wa + bb[2] * wb,
    a[3] * wa + bb[3] * wb,
  ];
}

/** Frame-rate-independent slerp damping toward `target` (lambda ≈ turn rate). */
export function quatDamp(
  current: Quat,
  target: Quat,
  lambda: number,
  dt: number,
): Quat {
  return quatSlerp(current, target, 1 - Math.exp(-lambda * dt));
}

/** Column-major mat4 from a unit quaternion (rotation only). */
export function quatToMat4(q: Quat): number[] {
  const [x, y, z, w] = q;
  const x2 = x + x,
    y2 = y + y,
    z2 = z + z;
  const xx = x * x2,
    xy = x * y2,
    xz = x * z2,
    yy = y * y2,
    yz = y * z2,
    zz = z * z2,
    wx = w * x2,
    wy = w * y2,
    wz = w * z2;
  return [
    1 - (yy + zz),
    xy + wz,
    xz - wy,
    0,
    xy - wz,
    1 - (xx + zz),
    yz + wx,
    0,
    xz + wy,
    yz - wx,
    1 - (xx + yy),
    0,
    0,
    0,
    0,
    1,
  ];
}

/** Rest pose: the classic hero attitude (pitch −0.42 about X). */
export function restPoseQuat(pitch = -0.42): Quat {
  return [Math.sin(pitch / 2), 0, 0, Math.cos(pitch / 2)];
}

/** Ship turn rate for orientation damping (rad/s-ish; higher = snappier). */
export const SHIP_TURN_LAMBDA = 4.5;

/** Engine-glow intensity cast onto the rear hull, by plume phase (PF-08 F0). */
export function engineGlowIntensity(p: PlumeParams): number {
  if (p.burning) return 1.3;
  if (p.coasting) return 0.1;
  if (p.parked) return 0.25;
  return 0.4;
}

/* ---------- P3: arrival presence (realism audit fix #4) ---------- */

/** Rim-light colors: cool starlight in flight, warm beacon-gold when parked. */
export const RIM_COOL: readonly [number, number, number] = [0.55, 0.66, 0.92];
export const RIM_ARRIVED: readonly [number, number, number] = [1.0, 0.84, 0.45];

/** Smoothed rim tint for the craft shader: k=0 cool → k=1 arrived. */
export function rimColorAt(k: number): [number, number, number] {
  const c = Math.max(0, Math.min(1, k));
  return [
    RIM_COOL[0] + (RIM_ARRIVED[0] - RIM_COOL[0]) * c,
    RIM_COOL[1] + (RIM_ARRIVED[1] - RIM_COOL[1]) * c,
    RIM_COOL[2] + (RIM_ARRIVED[2] - RIM_COOL[2]) * c,
  ];
}
