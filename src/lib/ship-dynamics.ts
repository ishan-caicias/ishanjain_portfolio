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
  /** PF-11 D3.2 (optional, additive): eased main-drive envelope, 1 = full
   * burn … 0 = engines cut. Present only on the warp path once D3.2's
   * cutoff/relight shoulders are driving it; ABSENT means "use the boolean
   * phases exactly as before", which is what every other caller (idle,
   * parked, reduced motion, the legacy tests) relies on. When present it
   * blends the burning values toward the coasting ones, so flare, alpha and
   * throttle all fade together off one scalar. */
  env?: number;
}

/** Blend a burning-phase value toward its coasting value by the D3.2 drive
 * envelope. `env` absent (or 1) leaves the burning value untouched. */
function byEnv(p: PlumeParams, burnVal: number, coastVal: number): number {
  const e = p.env;
  if (e == null || e >= 1) return burnVal;
  return coastVal + (burnVal - coastVal) * Math.max(0, e);
}

/** Phase-dependent flare length (unit-ship space, extends along +Z). */
export function plumeFlareLength(p: PlumeParams): number {
  if (p.burning)
    return byEnv(p, p.reduced ? 0.55 : 0.55 + Math.sin(p.t * 47) * 0.06, 0.07);
  if (p.coasting) return 0.07;
  if (p.parked) return p.reduced ? 0.1 : 0.1 + Math.sin(p.t * 2.1) * 0.015;
  return p.reduced ? 0.16 : 0.16 + Math.sin(p.t * 2.1) * 0.03;
}

/** Plume brightness per phase (multiplied by ship fade at draw time). */
export function plumeAlpha(p: PlumeParams): number {
  if (p.burning) return byEnv(p, 0.9, 0.15);
  if (p.coasting) return 0.15;
  if (p.parked) return 0.3;
  return 0.42;
}

const PLUME_W_NOZZLE = 0.028;
const PLUME_W_TIP = 0.06;
/** Floats per plume vertex: x, y, z, axial (1 nozzle → 0 tip), side (−1..+1).
 * PF-08 F3 added `side` so the fragment shader can sample scrolling noise
 * across the plume for a turbulent, layered flame instead of a flat cone. */
export const PLUME_VERTEX_FLOATS = 5;
/** 3 engines × 2 crossed quads × 2 triangles × 3 vertices. */
export const PLUME_VERTEX_COUNT = PLUME_ENGINES.length * 2 * 2 * 3;

/**
 * Cone-ish exhaust geometry: per engine, two quads crossed at 90° (X-plane and
 * Y-plane), tapering from PLUME_W_NOZZLE (axial 1) at the nozzle to
 * PLUME_W_TIP (axial 0) at nozzle.z + flare. Interleaved [x,y,z,axial,side]
 * where `side` ∈ {−1,+1} is the across-axis coordinate (F3 noise UV).
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
  const put = (x: number, y: number, z: number, a: number, side: number) => {
    out[o++] = x;
    out[o++] = y;
    out[o++] = z;
    out[o++] = a;
    out[o++] = side;
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
      put(ex - nx, ey - ny, ez, 1, -1);
      put(ex + nx, ey + ny, ez, 1, 1);
      put(ex + txw, ey + tyw, tip, 0, 1);
      // tri 2: nozzle-left, tip-right, tip-left
      put(ex - nx, ey - ny, ez, 1, -1);
      put(ex + txw, ey + tyw, tip, 0, 1);
      put(ex - txw, ey - tyw, tip, 0, -1);
    }
  }
  return out;
}

/* ---------- PF-08 F3: layered noise plume + ember particles ---------- */

/** Inner white-hot core and outer diesel-orange sheath. Exported for shader
 * parity (the fragment shader hardcodes the same two colors). */
export const PLUME_CORE: readonly [number, number, number] = [1.0, 0.95, 0.85];
export const PLUME_SHEATH: readonly [number, number, number] = [
  1.0, 0.42, 0.12,
];

/**
 * Flame intensity 0..1 driving turbulence + brightness in the plume shader
 * (distinct from `plumeAlpha`, which is the phase base-opacity). Burn flickers
 * over time for a live flame; reduced motion is steady. Ordering mirrors the
 * other plume phase functions: burn > idle > parked > coast.
 */
export function plumeThrottle(p: PlumeParams): number {
  if (p.burning)
    return byEnv(p, p.reduced ? 0.85 : 0.85 + Math.sin(p.t * 41) * 0.15, 0.06);
  if (p.coasting) return 0.06;
  if (p.parked) return p.reduced ? 0.18 : 0.18 + Math.sin(p.t * 2.0) * 0.04;
  return p.reduced ? 0.3 : 0.3 + Math.sin(p.t * 1.7) * 0.05;
}

/** A single ember spark: unit-ship space position, velocity, and 1→0 life. */
export interface Ember {
  x: number;
  y: number;
  z: number;
  vx: number;
  vy: number;
  vz: number;
  life: number;
}

/** Ember life decay per second (≈0.6–1.2 s visible lifespan). */
export const EMBER_DECAY = 1.6;

/** Advance one ember by dt (drift + decay). Returns whether it is still alive. */
export function stepEmber(e: Ember, dt: number): boolean {
  e.x += e.vx * dt;
  e.y += e.vy * dt;
  e.z += e.vz * dt;
  e.life -= EMBER_DECAY * dt;
  return e.life > 0;
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

/** Unit quaternion for a rotation of `angle` radians around a unit `axis`. */
export function quatFromAxisAngle(
  axis: readonly number[],
  angle: number,
): Quat {
  const s = Math.sin(angle / 2);
  return [axis[0] * s, axis[1] * s, axis[2] * s, Math.cos(angle / 2)];
}

/** Hamilton product `a * b` — composes rotations so `b` is applied first,
 * then `a` (standard quaternion composition order). */
export function quatMultiply(a: Quat, b: Quat): Quat {
  const [ax, ay, az, aw] = a;
  const [bx, by, bz, bw] = b;
  return [
    aw * bx + ax * bw + ay * bz - az * by,
    aw * by - ax * bz + ay * bw + az * bx,
    aw * bz + ax * by - ay * bx + az * bw,
    aw * bw - ax * bx - ay * by - az * bz,
  ];
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

/* ---------- PF-08 F2: chase camera + 360° travel choreography ---------- */

/**
 * Orthonormal basis perpendicular to a unit travel direction: `right` and
 * `up`, with `up` biased toward celestial north (+Z) like the engine's
 * viewFrom(). Near-polar routes fall back to +X as the reference up.
 */
export function travelFrame(dir: readonly number[]): {
  right: [number, number, number];
  up: [number, number, number];
} {
  const ref = Math.abs(dir[2]) > 0.999 ? [1, 0, 0] : [0, 0, 1];
  let rx = dir[1] * ref[2] - dir[2] * ref[1];
  let ry = dir[2] * ref[0] - dir[0] * ref[2];
  let rz = dir[0] * ref[1] - dir[1] * ref[0];
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  return {
    right: [rx, ry, rz],
    up: [
      ry * dir[2] - rz * dir[1],
      rz * dir[0] - rx * dir[2],
      rx * dir[1] - ry * dir[0],
    ],
  };
}

/** Chase offset expressed in the travel frame: [right, up, back]. */
export type ChaseOffset = [number, number, number];

/** Rest/reduced-motion chase offset: straight astern at ship depth. */
export const CHASE_OFFSET_REST: ChaseOffset = [0, 0, SHIP_VIEW_DEPTH];

/** Chase elevation above the thrust axis (owner-directed, 2026-07-18). */
export const CHASE_ELEVATION = Math.PI / 6; // 30°

/* Camera height that puts the view exactly CHASE_ELEVATION above the thrust
 * axis at chase distance b (negative u = camera above the ship). */
const elev = (b: number) => -Math.tan(CHASE_ELEVATION) * b;

/* Waypoints [k, right, up, back] for the journey choreography. Both ends sit
 * exactly astern so cam(0) = warp.from and cam(1) = warp.to — every post-warp
 * invariant (arrival framing, parked look direction) is preserved. Owner
 * retune (2026-07-18, replacing the v1 flank-swing table): one consistent
 * behind-the-thruster view elevated 30° above the thrust axis, panning OUT
 * through cruise/flip and closing back in for arrival. Because u = −tan30°·b
 * at every interior waypoint, the interpolated elevation holds 30° exactly
 * across k ∈ [0.10, 0.92]. A whisper of lateral offset at the flip keeps a
 * depth cue without reading as a side view.
 *
 * PF-11 D3.1 (Vega SHOT-BRIEF 2026-07-24 — deceleration legibility): the decel
 * segment (k > 0.55) previously CLOSED the camera 5.3 → 3.5 → 2.2, driving the
 * ship LARGER than its arrival size (back < SHIP_VIEW_DEPTH) while it braked —
 * the CONTRADICTS cue behind owner complaint R6 ("decel doesn't slow"). It now
 * OPENS to a braking pull-back (5.8 at k≈0.72 — the ship recedes as the retro
 * burn lights) then MONOTONE-settles to the arrival framing, never dropping
 * below SHIP_VIEW_DEPTH before k=1, so the ship never looms mid-brake. The
 * settle waypoint sits at k=0.92 on the elevation locus so the 30° hold still
 * runs to 0.92 (Vega's brief said 0.9; 0.92 is perceptually identical and
 * keeps the hold-window invariant intact). */
const CHASE_WAYPOINTS: readonly [number, number, number, number][] = [
  [0.0, 0, 0, SHIP_VIEW_DEPTH],
  [0.1, 0, elev(2.6), 2.6],
  [0.35, 0, elev(4.5), 4.5],
  [0.55, 0.6, elev(5.3), 5.3],
  [0.72, 0.25, elev(5.8), 5.8],
  [0.92, 0, elev(3.4), 3.4],
  [1.0, 0, 0, SHIP_VIEW_DEPTH],
];

/** Smoothstep-interpolated chase offset at journey progress k ∈ [0,1]. */
export function chaseOffsetAt(k: number): ChaseOffset {
  const c = Math.max(0, Math.min(1, k));
  let i = 0;
  while (i < CHASE_WAYPOINTS.length - 2 && c > CHASE_WAYPOINTS[i + 1][0]) i++;
  const a = CHASE_WAYPOINTS[i];
  const b = CHASE_WAYPOINTS[i + 1];
  const t = Math.max(0, Math.min(1, (c - a[0]) / (b[0] - a[0])));
  const s = t * t * (3 - 2 * t);
  return [
    a[1] + (b[1] - a[1]) * s,
    a[2] + (b[2] - a[2]) * s,
    a[3] + (b[3] - a[3]) * s,
  ];
}

/** Chase-look damping rate (rad/s-ish) and look-ahead distance along the
 * travel vector (view units) — the camera aims slightly past the ship. */
export const CHASE_LOOK_LAMBDA = 3.0;
export const CHASE_LOOK_AHEAD = 1.1;

/** PF-11 D3.1 — warp FOV breathing (the legacy speed cue, never ported to
 * Babylon until now; Vega SHOT-BRIEF 2026-07-24). The lens widens with
 * apparent speed and relaxes to base as the ship brakes, so a viewer reads
 * "slowing" from the field of view itself — one more cue driven off the SAME
 * `dsdk` triangle every other cue uses, so they cannot disagree. Peak dsdk = 2
 * at k=0.5 → peak multiplier 1.06 (+6%); base at both journey ends. The MAX
 * clamp is a safety rail above the formula's own peak. Applied to the camera's
 * RUNTIME base FOV (Babylon default ~0.8 rad), NOT SHIP_BASE_FOV (a ship-scale
 * constant) — see babylon-engine `_baseFov`. Reduced motion passes base (no
 * breathing), per non-negotiable #24. */
export const WARP_FOV_GAIN = 0.06;
export const WARP_FOV_MAX_MULT = 1.08;

/** FOV multiplier for the warp lens cue at apparent speed `dsdk`
 * (= |d warpEase/dk|, the triangle 4k / 4(1−k)). `base × warpFovMult(dsdk)` is
 * the breathing camera FOV. */
export function warpFovMult(dsdk: number): number {
  return Math.min(1 + (WARP_FOV_GAIN * dsdk) / 2, WARP_FOV_MAX_MULT);
}

/** Ship scale/alpha station targets while the chase camera is active. */
export const SHIP_WARP_SCALE = 0.9;
export const SHIP_WARP_ALPHA = 0.62;

/**
 * Frame-rate-independent damp of an angle toward `target`, always along the
 * shortest arc (wrap-aware — 3.1 → −3.1 goes through π, not through 0).
 */
export function dampAngle(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  let d = (target - current) % (2 * Math.PI);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Inverse of ndcToView: view-space position → [ndcX, ndcY] under the same
 * perspective convention. vz must be negative (in front of the camera). */
export function viewToNdc(
  v: readonly number[],
  fovY: number,
  aspect: number,
): [number, number] {
  const tanHalf = Math.tan(fovY / 2);
  const depth = Math.max(1e-6, -v[2]);
  return [v[0] / (depth * tanHalf * aspect), v[1] / (depth * tanHalf)];
}

/* ---------- PF-09 B2 step 3: shared body-position math ---------- */

/** Ra/Dec (degrees) -> unit direction vector. Matches space-engine.js's private
 * `raDecToDir` exactly (same sky-to-xyz convention the star catalog assets were
 * baked with — see star-catalog.ts), so a body placed here sits in the same
 * coordinate space as the star field either engine draws. Not re-exported from
 * space-engine.js (a plain script, not a module) — duplicated deliberately
 * rather than refactoring the live/default-path engine for this. */
export function raDecToDir(ra: number, dec: number): [number, number, number] {
  const d2r = Math.PI / 180;
  const cd = Math.cos(dec * d2r);
  return [
    cd * Math.cos(ra * d2r),
    cd * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
}

/** Logarithmic world-space depth for a body at distance `ly`. Matches
 * space-engine.js's `_buildBodies` exactly, so a body's travel distance reads
 * the same across engines. */
export function bodyDepth(ly: number | null | undefined): number {
  return 150 + 128 * Math.log10((ly || 0.001) + 1.5);
}

export interface BodyPlacement {
  dir: [number, number, number];
  pos: [number, number, number];
  depth: number;
}

/** Places a catalog body (ra, dec, ly) in world space. */
export function bodyWorldPosition(
  ra: number,
  dec: number,
  ly: number | null | undefined,
): BodyPlacement {
  const dir = raDecToDir(ra, dec);
  const depth = bodyDepth(ly);
  return {
    dir,
    pos: [dir[0] * depth, dir[1] * depth, dir[2] * depth],
    depth,
  };
}

/* ---------- PF-11 D6.4 bug fix: planet-sphere pick occlusion ---------------
 *
 * The hover/click picker (`_pick`/`_pickField` in babylon-engine.ts) is a screen-space
 * nearest-projected-point search over `this.bodies` and a cone-angle sweep over the star
 * field — neither ever consulted real scene depth, because before the D6.4 home reveal
 * nothing solid was ever on screen to occlude anything (an arrival's planet sphere fills
 * most of the frame and the camera is pinned to look at it; nobody could drag away to
 * expose something "behind" it). D6.4 put a 26-world-unit-radius opaque sphere at a fixed
 * point the visitor can now freely look past — and the picker kept working exactly as
 * before, screen-space-nearest, oblivious to the sphere sitting in front of whatever it
 * found. Reported by the owner as: hover cards for background DSOs while looking AT
 * Earth's rendered surface, and (via `_click`'s reliance on the same hover pick) a click
 * there could travel to a body the sphere visibly hides.
 *
 * The fix is a simple ray/sphere test along the SAME cursor ray the picker already
 * computes, reused rather than duplicated. */

/** World-space unit ray direction for a screen-space point, given the camera's own
 * right/up/forward basis and FOV/aspect. This is the exact NDC→world construction
 * `_pickField` already builds inline — factored out so `_pick`'s new occlusion check uses
 * the identical ray rather than a second, silently-driftable copy of the same math. */
export function cursorRayDir(
  x: number,
  y: number,
  rectW: number,
  rectH: number,
  right: readonly [number, number, number],
  up: readonly [number, number, number],
  fwd: readonly [number, number, number],
  tanFov: number,
  aspect: number,
): [number, number, number] {
  const ndcX = ((x / rectW) * 2 - 1) * tanFov * aspect;
  const ndcY = -((y / rectH) * 2 - 1) * tanFov;
  const ux = right[0] * ndcX + up[0] * ndcY + fwd[0];
  const uy = right[1] * ndcX + up[1] * ndcY + fwd[1];
  const uz = right[2] * ndcX + up[2] * ndcY + fwd[2];
  const rl = Math.hypot(ux, uy, uz) || 1;
  return [ux / rl, uy / rl, uz / rl];
}

/** Nearest ray/sphere intersection distance along `dir` from `camPos`, or `Infinity` if the
 * ray misses the sphere (or the sphere is entirely behind the camera). A camera already
 * inside the sphere returns 0 — everything ahead is occluded, which cannot arise for the
 * planet sphere in practice (the camera never enters it) but is the mathematically correct
 * answer and costs nothing extra to handle. */
export function raySphereDist(
  camPos: readonly [number, number, number],
  dir: readonly [number, number, number],
  center: readonly [number, number, number],
  radius: number,
): number {
  const cx = center[0] - camPos[0];
  const cy = center[1] - camPos[1];
  const cz = center[2] - camPos[2];
  const tca = cx * dir[0] + cy * dir[1] + cz * dir[2];
  if (tca < 0) return Infinity; // sphere centre is behind the camera
  const d2 = cx * cx + cy * cy + cz * cz - tca * tca;
  const r2 = radius * radius;
  if (d2 > r2) return Infinity; // ray misses the sphere entirely
  const thc = Math.sqrt(r2 - d2);
  const near = tca - thc;
  return near < 0 ? 0 : near;
}

/* ---------- PF-11 D2: the frame ladder (sky honesty by destination) --------
 *
 * Astra's frame-ladder brief (2026-07-22, §1-2): the visible sky is a set of
 * nested backdrops, each of which only changes when you move a distance
 * comparable to its own depth. Two backdrop layers must therefore fade by the
 * DESTINATION's distance, or they are BROKEN PHYSICS:
 *
 *  - solar-system furniture (the asteroid belt, its Havok stepping, sun glare
 *    and planet billboards): gone by ~10 AU-equivalent departure. Astra §2:
 *    the whole 6.6-AU belt subtends 16 milli-arcsec from M42 — rendering any
 *    belt pixel at a DSO arrival is wrong by ~7 orders of magnitude.
 *  - the entire LOCAL Milky Way (the 360° band, the 168,959-star field, the
 *    constellation figures): at an extragalactic arrival it collapses into ONE
 *    small external galaxy (Astra §1: a 100,000-ly disc subtends ~10' from
 *    32.6 Mly). Keeping a 360° band at an SDSS/NBG galaxy is BROKEN PHYSICS.
 *
 * These are pure schedulers; the engine owns the per-frame live state and the
 * material clones/uniforms that consume the result. Fades tie to warp progress
 * `k` so the transition is part of the cinematic (the brief's own design
 * recommendation), front-loaded over the acceleration phase when a layer
 * leaves the frame and back-loaded over deceleration when it returns. */

/** Furniture (belt/glare/planets) fully present below this destination ly,
 * fading out above it. 0.001 ly ≈ 63 AU — past Neptune (~30 AU ≈ 4.7e-4 ly),
 * before the nearest star (Proxima, 4.25 ly). */
export const FURNITURE_FADE_START_LY = 0.001;
/** Furniture fully gone at/above this destination ly (0.1 ly ≈ 6,300 AU). */
export const FURNITURE_GONE_LY = 0.1;
/** Destination ly at/above which the whole local galaxy collapses to an
 * external impostor. Astra §1: nothing travelable sits between ~2,400 ly (the
 * star field's linear reach) and the nearest SDSS/NBG galaxy at 32.6 Mly, so
 * this threshold is effectively binary — 1e6 ly sits comfortably in that void. */
export const EXTRAGALACTIC_LY = 1e6;
/** Constellation figures start dissolving above this destination ly (PF-11
 * D2.3, Astra brief §1: the figures are parallax accidents of nearby stars —
 * real only from near Earth's own vantage). Figure stars actually span ~43 ly
 * (Capella) to ~2,600 ly (Deneb), so no single constant is right per-figure;
 * at 50 ly of displacement the NEAREST figures are already parallax-shifted
 * by tens of degrees (Δθ ≈ x/d), which is why the dissolve starts here — a
 * declared scene-wide window, not a derived threshold (ledger L17). */
export const FIGURE_FADE_START_LY = 50;
/** Figures fully gone at/above this destination ly — comfortably inside the
 * ~2,400 ly linear reach of the star field itself and far short of
 * EXTRAGALACTIC_LY, so the figure dissolve completes before the separate
 * local-field collapse could ever re-trigger it. */
export const FIGURE_GONE_LY = 500;

/** Hermite smoothstep (0 below a, 1 above b), clamped. */
function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Solar-system-furniture visibility (1 present … 0 gone) for a destination at
 * `ly` light-years. Smooth 1→0 across [FURNITURE_FADE_START_LY,
 * FURNITURE_GONE_LY]; 1 for every solar-system body, 0 for any star or beyond. */
export function furnitureVisibility(ly: number): number {
  return 1 - smoothstep(FURNITURE_FADE_START_LY, FURNITURE_GONE_LY, ly);
}

/** Local-galaxy (band + star field + constellation figures) visibility for a
 * destination at `ly`. 1 everywhere inside the galaxy, 0 at extragalactic
 * arrivals — the discrete collapse Astra §1 describes (there is no travelable
 * destination in between at which a partial value would ever be observed). */
export function localFieldVisibility(ly: number): number {
  return ly >= EXTRAGALACTIC_LY ? 0 : 1;
}

/** Constellation-figure visibility (1 present … 0 gone) for a destination at
 * `ly`. Smooth 1→0 across [FIGURE_FADE_START_LY, FIGURE_GONE_LY] — a SEPARATE,
 * much nearer threshold than `localFieldVisibility`'s extragalactic collapse
 * (which also zeroes the figures, but only past EXTRAGALACTIC_LY). This is
 * the dissolve the figures need for ordinary in-galaxy DSO travel (Astra §1,
 * PF-11 D2.3): a figure drawn from stars within ~1 kly is nonsense once the
 * destination is itself hundreds of ly away. */
export function figureVisibility(ly: number): number {
  return 1 - smoothstep(FIGURE_FADE_START_LY, FIGURE_GONE_LY, ly);
}

/** Schedules a layer fade from `from`→`to` across warp progress `k` ∈ [0,1]. A
 * layer LEAVING the frame (to < from) fades out early, over the acceleration
 * phase (before the k≈0.5 flip); a layer RETURNING (to > from) fades in late,
 * over deceleration — so in both directions the change reads as part of the
 * journey rather than a pop at either endpoint. Reduced motion holds `from` and
 * swaps to `to` only at arrival — no animated ramp (non-negotiable #24). */
export function frameLadderFade(
  from: number,
  to: number,
  k: number,
  reduced: boolean,
): number {
  if (reduced) return k >= 1 ? to : from;
  const kk = Math.max(0, Math.min(1, k));
  const tt = to < from ? smoothstep(0, 0.35, kk) : smoothstep(0.6, 1, kk);
  return from + (to - from) * tt;
}

/** How far short of a body's exact position the camera parks — matches
 * space-engine.js's travelTo (arriving exactly at the point sprite would clip
 * through it). */
export const ARRIVE_STANDOFF = 38;

/** Planet-class arrival standoff (Vega SHOT-BRIEF, 2026-07-25 — owner-reported "camera
 * pointing away from Mars on arrival, zoom out a little so the star field is also
 * partially visible"). Deliberately DECOUPLED from `ARRIVE_STANDOFF`, which stays
 * untouched — it's also the ascent-cinematic end distance and the home-orbit radius
 * (both asserted exactly equal to it elsewhere), and retuning it would silently retune
 * two unrelated shots. At the old 38-unit distance a `PLANET_SPHERE_RADIUS`=26 sphere
 * subtends `2*asin(26/38) ≈ 86.3°` — wider than the 70° base FOV, i.e. edge-to-edge
 * with zero sky visible, not a reveal. 80 units targets `2*asin(26/80) ≈ 37.7°`,
 * roughly half the FOV — the classic reveal ratio: the sphere reads as dominant
 * without touching the frame edges. Every planet/moon/dwarf body renders at the same
 * normalized sphere radius (see planet-sphere.ts), so one shared distance is correct
 * for all of them, not a per-body formula. */
export const PLANET_ARRIVE_STANDOFF = 80;

/** Volumetric-nebula arrival standoff, as a MULTIPLE of that nebula's own rendered volume
 * radius (`NEBULA_VOLUMES[i].radius` = `depth * NEBULA_RADIUS_FACTOR`, i.e. 71-91 units for the
 * 11 shipped volumes) rather than an absolute distance — unlike planets, whose sphere radius is
 * normalized to one shared 26, every nebula volume is a different size, so one shared distance
 * cannot be right for all of them.
 *
 * WHY THIS EXISTS (owner-reported P0, 2026-07-29): at the previous universal `ARRIVE_STANDOFF`
 * of 38 the camera parked 38 units from the CORE of a ~77-unit-radius cloud — i.e. through the
 * near wall and roughly half-way in, inside the full-density shell (`shellInner: 0.55`). The
 * raymarcher handles origin-inside, so the gas rendered all around and behind the camera while
 * the target's own billboard sat ahead clamped to =<130px. Owner's words: "the ship travels past
 * it and then stops way past it... this happens with almost all travellable DSOs."
 *
 * WHY 3.5, from BOTH sisters, and why it is forced rather than chosen:
 *   - Astra SCIENCE-BRIEF (docs/analysis/2026-07-29-dso-arrival-science-brief.md) signed off a
 *     physics band of 2.5-4.0 R, hard floor 1.5 R. Her key correction to the working assumption:
 *     a close-range nebula is NOT invisible — surface brightness is conserved along a ray, and
 *     from inside M42 every sight-line still crosses ~12.7 ly of the same cloud, so it glows at
 *     ~0.75 mag below the Earth view. Inside you lose STRUCTURE, not light. The arrival premise
 *     is real, not a declared license.
 *   - Vega SHOT-BRIEF (docs/experience-design/2026-07-29-dso-arrival-framing-shot-spec.md)
 *     showed the lower bound is an ENGINEERING constraint, not taste: `clampZoomDistance`'s
 *     floor for a non-planet target is `restDist * ZOOM_MIN_MULT` (0.3), so any factor below
 *     `1/0.3 = 3.33` lets the visitor zoom straight back INSIDE the gas by hand. 3.5 clears that
 *     by 5% (0.3x -> 1.05 R, just outside the near wall) and needs NO new zoom-floor policy —
 *     the existing multiplicative floor moves with the standoff for free.
 * 3.5 is the only value in Astra's band that also satisfies Vega's floor. Framing at 3.5: the
 * rim subtends 33.2 deg = 0.71 of frame height — deliberately more sky around it than the
 * planet precedent's 3.08x, because a soft-edged emission cloud loses objecthood at the frame
 * boundary and the surrounding starfield ring is this shot's only scale reference (PF-11 is
 * "scale honesty").
 *
 * NOT applied by object TYPE. The branch that consumes this keys on whether the body actually
 * HAS a shipped volume (`NEBULA_VOLUMES.find`), because the catalogs carry far more nebula-typed
 * entries than the 11 rendered volumes — a type check would push dozens of billboard-only
 * objects to a standoff derived from a volume that does not exist. */
export const NEBULA_ARRIVE_STANDOFF_FACTOR = 3.5;

/** Literal duplicate of planet-sphere.ts's `PLANET_SPHERE_RADIUS` — same reasoning as
 * this file's other duplicated constants (kept import-free/pure for unit-testability);
 * a unit test asserts the two agree. Zoom's near floor for a planet-class body keeps
 * this margin clear of the rendered surface so the camera's near clip plane can never
 * punch through it. */
export const PLANET_SPHERE_RADIUS_FOR_ZOOM = 26;
export const PLANET_ZOOM_NEAR_MARGIN = 5;

/** Zoom bounds for point-like targets (DSOs, stars, field objects) and the home orbit:
 * no physical surface to collide with, so bounds scale off the resting distance itself
 * rather than an absolute floor (Vega SHOT-BRIEF, 2026-07-25). */
export const ZOOM_MIN_MULT = 0.3;
export const ZOOM_MAX_MULT = 3;

/** Per-tick zoom step, as a fraction of the CURRENT distance (multiplicative, not
 * additive, so one wheel notch/keypress feels proportionally similar whether parked
 * close to a moon or far from a nebula). One mouse-wheel notch (`deltaY` ≈ ±100 in
 * most browsers) or one keypress both apply one step. */
export const ZOOM_STEP = 0.12;

/** Damping rate for the eased approach to a new zoom target (Vega SHOT-BRIEF:
 * "responsive utility control... on the order of 150-250ms per step, not an ambient
 * cinematic move"). `dampScalar` is exponential, so this is a rate constant, not a
 * literal duration — lambda=8 reaches ~80% of the way to target in 200ms. */
export const ZOOM_LAMBDA = 8;

/** Clamps a candidate zoom distance to this target's bounds. `restDist` is the
 * distance the camera actually arrived at (== `PLANET_ARRIVE_STANDOFF` for a
 * planet-class body, `ARRIVE_STANDOFF`/`HOME_ORBIT_RADIUS` otherwise) — the ceiling is
 * always relative to it; the floor is an absolute near-clip-safe margin for a
 * planet-class body (which has a real surface to avoid punching through) or a
 * fraction of `restDist` otherwise (nothing physical to collide with). */
export function clampZoomDistance(
  dist: number,
  isPlanetClass: boolean,
  restDist: number,
): number {
  const min = isPlanetClass
    ? PLANET_SPHERE_RADIUS_FOR_ZOOM + PLANET_ZOOM_NEAR_MARGIN
    : restDist * ZOOM_MIN_MULT;
  const max = restDist * ZOOM_MAX_MULT;
  return Math.max(min, Math.min(max, dist));
}

/** Frame-rate-independent exponential damp of a plain scalar toward `target` — the
 * non-wrap-aware sibling of `dampAngle` below, for values with no periodicity (a zoom
 * distance, never an angle). */
export function dampScalar(
  current: number,
  target: number,
  lambda: number,
  dt: number,
): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

/** Warp-path easing (ease-in-out quad) — the live engine's accel/decel curve
 * for the ship's world-space position along a warp (space-engine.js's private
 * `ease`, not importable). Distinct from any UI/CSS easing; this specifically
 * shapes the brachistochrone-style burn-flip-burn profile the chase-camera
 * choreography and the accel/flip/decel HUD readout are both keyed off. */
export function warpEase(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

/* ---------- PF-11 D3.2: warp velocity profile v4 (ADR-0011) --------------
 *
 * `warpEase` above is a pure TRIANGLE in velocity (ds/dk = 4k then 4(1−k)) —
 * it has no cruise, so speed PEAKS for one instant at k=0.5 and falls away on
 * both sides. That contradicts the choreography Astra §3.2 specifies and D3.2
 * builds: main drive CUTS at k=0.44, the ship COASTS at constant velocity
 * while it rotates 180°, then the drive RELIGHTS retrograde at k=0.56. A
 * coasting ship with no forces on it does not slow down — but under the
 * triangle every speed cue sags through exactly that window.
 *
 * v4 is a TRAPEZOID: quadratic burn-in, a genuine constant-velocity plateau
 * across the flip window, quadratic brake-out. Two functions come out of it —
 * `warpEaseV4` (position) and `warpSpeedNorm` (the normalized speed every cue
 * reads) — so position and cues can never disagree about what the ship is
 * doing.
 *
 * THE FLOOR. The flip must occupy >= FLIP_MIN_MS of SCREEN time or it reads as
 * a cut, not a manoeuvre (TR-081 measured ~195 ms today, and a single frame
 * longer than that skips the phase entirely). The floor is delivered by slowing
 * k's advance INSIDE the window by `r = warpFlipRate(warpDur)`, which makes the
 * window last `max(0.12·warpDur, FLIP_MIN_MS)` exactly.
 *
 * The subtlety that makes this honest rather than a lurch: the coast slope is
 * `m/r`, so ds/dk rises by 1/r at precisely the k where dk/dt drops by r. World
 * velocity `ds/dk · dk/dt` is therefore CONTINUOUS across both window edges —
 * the ship burns a little more gently, coasts longer at that same speed, and
 * still covers exactly 1.0 of the path. (Naively dilating k without this
 * compensation drops world velocity ~4× the instant the window opens — an
 * engines-off coast that visibly brakes, which is the cue contradiction D3
 * exists to remove. ADR-0011 rejected option 2.) */

/** Minimum SCREEN time for the flip window, ms (Vega: below ~1 s a 180°
 * rotation reads as a cut rather than a manoeuvre). */
export const FLIP_MIN_MS = 1500;

/** k-advance multiplier applied INSIDE the flip window so the window lasts
 * `max(windowFraction · warpDur, FLIP_MIN_MS)`. 1 when the journey is already
 * long enough to clear the floor unaided (no current destination is). */
export function warpFlipRate(
  warpDurMs: number,
  accelEnd: number,
  decelStart: number,
): number {
  const windowMs = (decelStart - accelEnd) * Math.max(1, warpDurMs);
  return Math.min(1, windowMs / FLIP_MIN_MS);
}

/** Peak normalized ds/dk of the v4 profile — the burn segments' top speed.
 * Chosen so the three segments' areas sum to exactly 1. */
function v4PeakSlope(accelEnd: number, decelStart: number, r: number): number {
  // area = accelEnd/2·m + (decelStart−accelEnd)·(m/r) + (1−decelStart)/2·m = 1
  const w = decelStart - accelEnd;
  return 1 / (accelEnd / 2 + w / Math.max(r, 1e-6) + (1 - decelStart) / 2);
}

/** v4 position along the path at progress k, given the in-window rate `r`.
 * Quadratic burn → constant-velocity coast → quadratic brake. Endpoints exact
 * (0 at k=0, 1 at k=1) and symmetric about k=0.5 for the symmetric window this
 * scene uses, so `warpEaseV4(0.5, r) === 0.5` for every r. */
export function warpEaseV4(
  k: number,
  r: number,
  accelEnd: number,
  decelStart: number,
): number {
  const c = Math.max(0, Math.min(1, k));
  const m = v4PeakSlope(accelEnd, decelStart, r);
  if (c <= accelEnd) return (m * c * c) / (2 * accelEnd);
  const sAccel = (m * accelEnd) / 2;
  if (c <= decelStart) return sAccel + (m / r) * (c - accelEnd);
  const d = 1 - c;
  return 1 - (m * d * d) / (2 * (1 - decelStart));
}

/** One integration step of v4 warp progress with the in-window rate applied
 * PIECEWISE at the window boundaries (PF-11 D3.2 REVIEW fix, TR-094).
 *
 * The naive form — pick the rate from k at frame start, advance the whole
 * step at it — has a single-frame hole: a frame starting just below the
 * window at the 0.5 s dt cap advances dk ≈ 0.13 at rate 1, which is wider
 * than the 0.12 window. ONE capped frame could jump the entire flip, which is
 * precisely the TR-081 skip class the floor exists to kill. This integrator
 * splits the step where it crosses `accelEnd`/`decelStart` and spends the
 * remaining wall-clock at the far side's rate, so the window consumes its
 * full floored time no matter how the frame boundaries land. Time-exact:
 * integrating any dt sequence yields the same total journey duration. */
export function advanceWarpV4(
  prog: number,
  dtS: number,
  warpDurMs: number,
  slowFactor: number,
  flipRate: number,
  accelEnd: number,
  decelStart: number,
): number {
  const dur = Math.max(1, warpDurMs) / 1000;
  let k = prog;
  let budget = (dtS / dur) * slowFactor; // k-distance at rate 1
  for (let guard = 0; guard < 4 && budget > 0 && k < 1; guard++) {
    const inWindow = k >= accelEnd && k < decelStart;
    const rate = inWindow ? flipRate : 1;
    const boundary = k < accelEnd ? accelEnd : inWindow ? decelStart : 1;
    const maxDk = boundary - k;
    const dk = budget * rate;
    if (dk <= maxDk) {
      k += dk;
      budget = 0;
    } else {
      k = boundary;
      budget -= maxDk / rate;
    }
  }
  return Math.min(1, k);
}

/** Normalized world speed (0..1) at progress k — the ONE source every speed
 * cue reads (aberration β, the D3.1 FOV breath, the HUD velocity). Ramps in
 * over the burn, HOLDS 1 across the coast/flip window (engines cut, no forces),
 * ramps out over the brake. Replaces the old inline `dsdk` triangle. */
export function warpSpeedNorm(
  k: number,
  accelEnd: number,
  decelStart: number,
): number {
  const c = Math.max(0, Math.min(1, k));
  if (c <= accelEnd) return c / accelEnd;
  if (c <= decelStart) return 1;
  return (1 - c) / (1 - decelStart);
}

/* ---------- PF-09 B2 step 5: distance-scaled travel ----------------------
 *
 * NOT a port — the live engine hardcodes warpDur at a fixed 2400 ms
 * (900 ms reduced) regardless of target distance; there is no existing
 * formula to carry over. This is new pure math designed for Babylon, keyed
 * off `ly` per the delivery plan ("near hops are quick; multi-hundred-ly
 * journeys spend longer at cruise ... so speed communicates distance").
 *
 * The SAME `warpEase` accel-flip-decel curve is kept — not replaced with a
 * literal constant-velocity plateau — and simply stretched over a longer
 * duration for far targets. An ease-in-out-quad's velocity already peaks
 * near its midpoint and decays toward both ends; stretched over more
 * wall-clock time, that near-peak middle region reads as a longer cruise
 * without inventing a new curve shape or touching the existing accel/flip/
 * decel phase thresholds (which key off the fraction `k`, not the duration).
 *
 * Log-scaled, not linear: `ly` spans from ~0 (solar system) to 13+ billion
 * (the catalog's most distant SDSS galaxies, confirmed against the shipped
 * data) — a linear mapping would make a single deep-catalog click take
 * either an absurd wait or force every near hop to be instant. Log10 keeps
 * the whole practical range (Sirius at 8.6 ly through Orion Nebula at
 * 1,344 ly) spread across most of the duration band, then clamps everything
 * beyond ~10,000 ly to the same ceiling — distance keeps communicating
 * "far", it just stops linearly extending the wait past a reasonable cap.
 */

/** Fastest a warp can complete — the floor for `ly` -> 0 and for goHome. */
export const WARP_MIN_MS = 1400;
/** Slowest a warp can complete, regardless of how distant the target is. */
export const WARP_MAX_MS = 4200;
/** log10(ly+1) range the duration is linearly interpolated across before
 * clamping — 0 (ly=0) to 4 (ly=10,000), covering every named catalog body
 * (Orion Nebula at 1,344 ly is inside this range) before the ceiling takes over. */
const WARP_LOG_LY_MIN = 0;
const WARP_LOG_LY_MAX = 4;

/** Warp duration (ms) for a journey of `ly` light-years. Monotonically
 * increasing, bounded to [WARP_MIN_MS, WARP_MAX_MS]. `ly <= 0` (home, solar
 * system bodies) returns the floor. */
export function warpDurationForLy(ly: number): number {
  if (!(ly > 0)) return WARP_MIN_MS;
  const logLy = Math.log10(ly + 1);
  const frac = Math.min(
    1,
    Math.max(
      0,
      (logLy - WARP_LOG_LY_MIN) / (WARP_LOG_LY_MAX - WARP_LOG_LY_MIN),
    ),
  );
  return WARP_MIN_MS + (WARP_MAX_MS - WARP_MIN_MS) * frac;
}

/* ---------- PF-11 D3.3: mid-journey input policy (ADR-0010) ---------- */

/** The engine's warp modes, restated here as a plain union so the policy stays a
 * pure module (`babylon-engine.ts` cannot be imported off-GPU, and this decision
 * has to be unit-testable — it is the one place three surfaces must agree). */
export type FlightMode = "idle" | "aim" | "warp" | "ascent";

/** What the visitor asked for: `travel` = pick a destination (`travelTo`,
 * `randomBody`, a canvas click, the Where-To console); `home` = the home key /
 * HOME control (`goHome`). */
export type FlightRequest = "travel" | "home";

/** What the engine does about it.
 * - `proceed` — start the journey now (the idle case).
 * - `queue`   — remember it and launch on arrival (mid-journey retarget).
 * - `abort`   — abandon the current journey and fly home instead.
 * - `ignore`  — genuinely nothing (the launch cinematic owns the camera). */
export type FlightInputPolicy = "proceed" | "queue" | "abort" | "ignore";

/** PF-11 D3.3 — what a navigation input does given the flight state it lands in.
 *
 * Before this, `travelTo`/`goHome` both early-returned mid-journey: a press
 * during a warp was a **silent no-op**, which is how it survived unnoticed until
 * TR-080's dead-code reset. Owner decision (ADR-0010): `goHome` mid-journey is
 * an ABORT (fly home from wherever the ship is), a destination pick mid-journey
 * QUEUES a retarget that launches on arrival (last selection wins), and neither
 * is ever silent — both have HUD feedback.
 *
 * The one exception is `ascent`: the launch-from-Earth cinematic (D1.3) is a
 * rails climb that owns the camera and the console isn't even revealed yet, so
 * there is no input to honour and nothing to say about it. It stays a no-op —
 * deliberately, and named `ignore` so the distinction is legible at the call
 * site rather than hidden in a mode list. */
export function flightInputPolicy(
  mode: FlightMode,
  request: FlightRequest,
): FlightInputPolicy {
  if (mode === "ascent") return "ignore";
  if (mode === "idle") return "proceed";
  // "aim" and "warp" — a journey is under way, in its turn or in its burn.
  return request === "home" ? "abort" : "queue";
}

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
