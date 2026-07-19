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
  if (p.burning) return p.reduced ? 0.85 : 0.85 + Math.sin(p.t * 41) * 0.15;
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
 * depth cue without reading as a side view. */
const CHASE_WAYPOINTS: readonly [number, number, number, number][] = [
  [0.0, 0, 0, SHIP_VIEW_DEPTH],
  [0.1, 0, elev(2.6), 2.6],
  [0.35, 0, elev(4.5), 4.5],
  [0.55, 0.6, elev(5.3), 5.3],
  [0.8, 0.3, elev(3.5), 3.5],
  [0.92, 0, elev(2.2), 2.2],
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

/** How far short of a body's exact position the camera parks — matches
 * space-engine.js's travelTo (arriving exactly at the point sprite would clip
 * through it). */
export const ARRIVE_STANDOFF = 38;

/** Warp-path easing (ease-in-out quad) — the live engine's accel/decel curve
 * for the ship's world-space position along a warp (space-engine.js's private
 * `ease`, not importable). Distinct from any UI/CSS easing; this specifically
 * shapes the brachistochrone-style burn-flip-burn profile the chase-camera
 * choreography and the accel/flip/decel HUD readout are both keyed off. */
export function warpEase(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
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
