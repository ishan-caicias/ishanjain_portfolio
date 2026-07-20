/* babylon-asteroids.ts — PF-09 B4 step 1: the Havok asteroid/debris field.
 *
 * Pure math half of the physics showcase (the Havok/Babylon wiring lives in
 * babylon-engine.ts): deterministic field construction, tier-gated body
 * counts, procedural rock displacement, and the weak belt-pull acceleration
 * that keeps the field coherent (and colliding) forever in zero-g.
 *
 * DESIGN. A ring-shaped belt near the home viewpoint: bodies spawn on a torus
 * with small tangential drift and spin, so the idle scene shows slow rocks
 * that actually collide (B4's "idle random asteroid collisions" item). With
 * no gravity, free bodies would disperse over minutes — a WEAK pull toward
 * the nearest point on the belt's spine circle (not its centre — preserving
 * the ring shape) keeps them loosely herded and guarantees future encounters.
 * The pull is deliberately gentle (BELT_PULL ≪ collision impulses) so physics
 * stays visibly Newtonian.
 *
 * TIERING (B4: "tier-gated body counts — desktop full, mobile reduced")
 * reuses craft-tier.ts's audited device signals rather than inventing a
 * second policy. WASM-SIMD gating (Havok's floor) is detected in the engine;
 * below it the same field renders visually with kinematic drift and no live
 * physics, exactly as the plan specifies.
 *
 * PF-10 C3 (2026-07-20): the procedural field is superseded on the shipping path by
 * `buildRealAsteroidField` below, which draws real positions and real Keplerian velocities from
 * the Gaia DR3 catalog. Everything else in this file — the belt geometry, the herding pull, the
 * density/slowdown/deflection model, the impact shake — is unchanged and now acts on real
 * bodies. `buildAsteroidField` is kept as the fallback and as the procedural path's test
 * subject; it is not dead code.
 */
import type { RealAsteroidCatalog } from "../data/asteroids-dr3-physics";

/** Belt geometry (world units, same space as the star shell / bodies).
 *
 * ORIENTATION: the ring lies in the X–Y plane (axis = world Z). This is a
 * deliberate choice, not aesthetics: `raDecToDir` maps declination onto Z,
 * and the m42 (Orion Nebula) showcase route — dir ≈ (0.107, 0.990, −0.094) —
 * crosses this ring's tube almost dead-centre (z ≈ −16 at planar radius 170
 * vs tube centre −13), so the B4 proximity-slowdown has a guaranteed,
 * E2E-assertable crossing on the same journey the nebula-reveal test flies.
 * A Y-axis ring (the first draft) is crossed by almost no catalog route,
 * because routes' Y components are cd·sin(ra) — large for most bodies. */
export const ASTEROID_BELT = {
  center: [0, 0, -13] as readonly [number, number, number],
  /** Spine-circle radius. */
  radius: 170,
  /** Radial spawn spread around the spine. */
  radialSpread: 26,
  /** Vertical spawn spread. */
  verticalSpread: 14,
  /** Weak herding acceleration (units/s² per unit displacement — a spring
   * constant toward the spine; ~0.02 ⇒ minutes-scale orbits, not snapping). */
  pull: 0.02,
  /** Linear drift speed range (units/s). */
  speedMin: 1.5,
  speedMax: 4.5,
  /** Angular speed range (rad/s per axis). */
  spinMax: 0.4,
  /** Rock scale range (world units — asteroid "radius"). */
  scaleMin: 0.9,
  scaleMax: 3.2,
  /** Rigid-body restitution (bouncy rocks read better than dead ones). */
  restitution: 0.7,
} as const;

/** Distinct base rock geometries (each seeded-displaced differently). */
export const ROCK_BASE_COUNT = 4;
/** Max radial displacement of rock vertices as a fraction of radius. */
export const ROCK_DISPLACEMENT = 0.35;

/* Body counts are tier-gated by the B5 quality budget (babylon-tiers.ts —
 * 48 full / 32 balanced / 20 lite). The interim B4 per-signal policy that
 * lived here was superseded when the unified tier system landed (TR-051). */

/** Deterministic seeded RNG — same LCG construction as star-field.ts /
 * shooting-stars.ts, so the field is unit-testable without Math.random. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

export interface AsteroidField {
  /** World spawn positions (count × 3). */
  positions: Float32Array;
  /** Uniform scale per body. */
  scales: Float32Array;
  /** Base-geometry index per body (0..ROCK_BASE_COUNT-1). */
  baseIndex: Uint8Array;
  /** Initial linear velocity per body (count × 3, units/s). */
  linVel: Float32Array;
  /** Initial angular velocity per body (count × 3, rad/s). */
  angVel: Float32Array;
  /** Mass per body (∝ scale³ — bigger rocks shove smaller ones). */
  masses: Float32Array;
  count: number;
}

/** Builds a deterministic belt: positions on the torus, tangential-biased
 * drift, random spin, cubic-scaled mass. */
export function buildAsteroidField(count: number, seed = 1): AsteroidField {
  const b = ASTEROID_BELT;
  const rnd = makeRng(seed);
  const positions = new Float32Array(count * 3);
  const scales = new Float32Array(count);
  const baseIndex = new Uint8Array(count);
  const linVel = new Float32Array(count * 3);
  const angVel = new Float32Array(count * 3);
  const masses = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const theta = rnd() * Math.PI * 2;
    const r = b.radius + (rnd() * 2 - 1) * b.radialSpread;
    // ring in the X–Y plane; Z is the tube's vertical axis (see ASTEROID_BELT)
    const z = b.center[2] + (rnd() * 2 - 1) * b.verticalSpread;
    positions[i * 3] = b.center[0] + Math.cos(theta) * r;
    positions[i * 3 + 1] = b.center[1] + Math.sin(theta) * r;
    positions[i * 3 + 2] = z;

    const scale = b.scaleMin + rnd() * (b.scaleMax - b.scaleMin);
    scales[i] = scale;
    baseIndex[i] = Math.floor(rnd() * ROCK_BASE_COUNT) % ROCK_BASE_COUNT;
    masses[i] = scale * scale * scale;

    // tangential-biased drift: mostly along the ring, some radial/vertical
    const speed = b.speedMin + rnd() * (b.speedMax - b.speedMin);
    const tx = -Math.sin(theta);
    const ty = Math.cos(theta);
    const dirSign = rnd() < 0.5 ? -1 : 1;
    const jx = (rnd() * 2 - 1) * 0.35;
    const jy = (rnd() * 2 - 1) * 0.35;
    const jz = (rnd() * 2 - 1) * 0.35;
    const vx = tx * dirSign + jx;
    const vy = ty * dirSign + jy;
    const vz = jz;
    const vl = Math.hypot(vx, vy, vz) || 1;
    linVel[i * 3] = (vx / vl) * speed;
    linVel[i * 3 + 1] = (vy / vl) * speed;
    linVel[i * 3 + 2] = (vz / vl) * speed;

    angVel[i * 3] = (rnd() * 2 - 1) * b.spinMax;
    angVel[i * 3 + 1] = (rnd() * 2 - 1) * b.spinMax;
    angVel[i * 3 + 2] = (rnd() * 2 - 1) * b.spinMax;
  }
  return { positions, scales, baseIndex, linVel, angVel, masses, count };
}

/* ---------- PF-10 C3: the REAL Gaia DR3 belt ---------------------------- */

/** Builds the physics field from REAL Gaia DR3 catalog records.
 *
 * This is C3's replacement for `buildAsteroidField` on the shipping path. The difference is not
 * cosmetic: every position and every velocity below traces to a real asteroid's real Keplerian
 * elements, solved at a stated snapshot date by `scripts/gaia-asteroids-pngpack.mjs` and baked
 * into `src/data/asteroids-dr3-physics.ts`. The bodies are the real asteroids nearest the belt's
 * spine circle, so they sit exactly where the tuned density falloff, warp slowdown and passage
 * deflection do their work — a real geometric selection, not a convenience sample.
 *
 * WHAT IS STILL DECLARED, and why it stays here rather than in the generated data: the source
 * catalog carries no diameter, no albedo, no magnitude and no rotation data (verified against
 * the real file, see that script's HONEST LIMITS). Rock radii, base geometry and spin are
 * therefore assigned from the SAME seeded LCG the procedural field used — deterministic, never
 * `Math.random`, and confined to attributes the catalog genuinely does not contain. Keeping that
 * split at the module boundary means the generated module is real data only, and this function
 * is the single place declared visual attributes enter the belt.
 *
 * `buildAsteroidField` is retained, not dead: it remains the fallback if the generated module is
 * ever empty, and it is what the belt-geometry unit tests exercise for the procedural path.
 */
export function buildRealAsteroidField(
  catalog: RealAsteroidCatalog,
  count: number,
  seed = 7,
): AsteroidField & { names: string[] } {
  const b = ASTEROID_BELT;
  const n = Math.min(count, catalog.bodies.length);
  const rnd = makeRng(seed);
  const positions = new Float32Array(n * 3);
  const scales = new Float32Array(n);
  const baseIndex = new Uint8Array(n);
  const linVel = new Float32Array(n * 3);
  const angVel = new Float32Array(n * 3);
  const masses = new Float32Array(n);
  const names: string[] = [];

  for (let i = 0; i < n; i++) {
    const rec = catalog.bodies[i];
    names.push(rec.n);
    // REAL: position and velocity, straight from the catalog solution.
    positions[i * 3] = rec.p[0];
    positions[i * 3 + 1] = rec.p[1];
    positions[i * 3 + 2] = rec.p[2];
    linVel[i * 3] = rec.v[0];
    linVel[i * 3 + 1] = rec.v[1];
    linVel[i * 3 + 2] = rec.v[2];

    // DECLARED: no size data exists for these objects anywhere in the source catalog.
    const scale = b.scaleMin + rnd() * (b.scaleMax - b.scaleMin);
    scales[i] = scale;
    masses[i] = scale * scale * scale;
    baseIndex[i] = Math.floor(rnd() * ROCK_BASE_COUNT) % ROCK_BASE_COUNT;
    angVel[i * 3] = (rnd() * 2 - 1) * b.spinMax;
    angVel[i * 3 + 1] = (rnd() * 2 - 1) * b.spinMax;
    angVel[i * 3 + 2] = (rnd() * 2 - 1) * b.spinMax;
  }
  return {
    positions,
    scales,
    baseIndex,
    linVel,
    angVel,
    masses,
    count: n,
    names,
  };
}

/** Same lattice hash as nebula-field.ts — reused so all procedural noise in
 * the Babylon path shares one construction. */
function hash3(x: number, y: number, z: number, seed: number): number {
  const d = x * 127.1 + y * 311.7 + z * 74.7 + seed * 17.0;
  const s = Math.sin(d) * 43758.5453;
  return s - Math.floor(s);
}

/** Displaces a unit-sphere mesh's vertices radially by seeded hash noise —
 * turns an icosphere into a lumpy rock. In place; direction-keyed (not
 * index-keyed) so shared/welded vertices displace identically and the mesh
 * stays watertight. Returns the same array for chaining. */
export function displaceRockVertices(
  positions: Float32Array,
  seed: number,
  amplitude = ROCK_DISPLACEMENT,
): Float32Array {
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i],
      y = positions[i + 1],
      z = positions[i + 2];
    const l = Math.hypot(x, y, z) || 1;
    // quantize direction so float noise in near-identical verts can't split
    const qx = Math.round((x / l) * 64),
      qy = Math.round((y / l) * 64),
      qz = Math.round((z / l) * 64);
    const n = hash3(qx, qy, qz, seed);
    const k = 1 + (n * 2 - 1) * amplitude;
    positions[i] = x * k;
    positions[i + 1] = y * k;
    positions[i + 2] = z * k;
  }
  return positions;
}

/** Weak herding acceleration toward the nearest point on the belt's SPINE
 * CIRCLE (radius R in the X–Y plane at z = centerZ) — preserves the ring
 * shape, unlike a pull to the centre point. Returns [ax, ay, az]. */
export function beltPullAccel(
  px: number,
  py: number,
  pz: number,
): [number, number, number] {
  const b = ASTEROID_BELT;
  const dx = px - b.center[0];
  const dy = py - b.center[1];
  const planar = Math.hypot(dx, dy);
  let tx: number, ty: number;
  if (planar < 1e-6) {
    // on the axis: nearest spine point is ambiguous — pick +X
    tx = b.center[0] + b.radius;
    ty = b.center[1];
  } else {
    tx = b.center[0] + (dx / planar) * b.radius;
    ty = b.center[1] + (dy / planar) * b.radius;
  }
  return [(tx - px) * b.pull, (ty - py) * b.pull, (b.center[2] - pz) * b.pull];
}

/** Kinematic fallback integrator for the no-SIMD/visual-only tier: Euler
 * drift + the same belt pull, no collisions. Mutates pos/vel in place. */
export function visualDriftStep(
  pos: Float32Array,
  vel: Float32Array,
  count: number,
  dtS: number,
): void {
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    const [ax, ay, az] = beltPullAccel(pos[o], pos[o + 1], pos[o + 2]);
    vel[o] += ax * dtS;
    vel[o + 1] += ay * dtS;
    vel[o + 2] += az * dtS;
    pos[o] += vel[o] * dtS;
    pos[o + 1] += vel[o + 1] * dtS;
    pos[o + 2] += vel[o + 2] * dtS;
  }
}

/* ---------- B4 step 2: proximity slowdown + passage deflection ---------- */

/** Tuning for the ship's interaction with the field during warp. */
export const WARP_FIELD = {
  /** Max fraction of warp speed removed at peak belt density (0.55 ⇒ the
   * ship eases to 45% through the densest part of the belt). */
  maxSlow: 0.55,
  /** Gaussian sigma for radial distance from the belt spine (world units) —
   * wider than the spawn spread so the slowdown ramps in before the rocks. */
  densitySigmaRadial: 32,
  /** Gaussian sigma for vertical distance from the belt plane. */
  densitySigmaVertical: 20,
  /** Deflection force range (world units) around the passing ship. */
  deflectRadius: 30,
  /** Deflection force scale (units/s² per unit mass at zero distance). */
  deflectAccel: 60,
} as const;

/** Smooth belt density 0..1 at a world point: gaussian falloff from the
 * spine circle (radially and vertically). 1 on the spine, ~0 well outside
 * the tube. Pure — drives the warp slowdown on every tier, physics or not. */
export function beltDensityAt(px: number, py: number, pz: number): number {
  const b = ASTEROID_BELT;
  const w = WARP_FIELD;
  const dx = px - b.center[0];
  const dy = py - b.center[1];
  const dr = Math.hypot(dx, dy) - b.radius; // signed radial dist from spine
  const dz = pz - b.center[2]; // tube axis is world Z (see ASTEROID_BELT)
  const qr = dr / w.densitySigmaRadial;
  const qz = dz / w.densitySigmaVertical;
  return Math.exp(-(qr * qr + qz * qz));
}

/** Warp speed multiplier for a local density: 1 in clear space, down to
 * (1 - maxSlow) at peak density. */
export function warpSlowFactor(density: number): number {
  const d = Math.min(1, Math.max(0, density));
  return 1 - WARP_FIELD.maxSlow * d;
}

/** One integration step of warp progress: dk = (dt / dur) × slow. Replaces
 * the old wall-clock k = t/dur — this is what makes the slowdown FEED the
 * B2 velocity profile rather than merely displaying it. Clamped to 1. */
export function advanceWarpProgress(
  prog: number,
  dtS: number,
  warpDurMs: number,
  slowFactor: number,
): number {
  const dur = Math.max(1, warpDurMs) / 1000;
  return Math.min(1, prog + (dtS / dur) * slowFactor);
}

/** Deflection force the passing ship exerts on one body: radially away from
 * the ship, gaussian falloff over deflectRadius, scaled by body mass so the
 * Havok acceleration is mass-independent (a plough, not a popgun on big
 * rocks). Returns [fx, fy, fz]; ~zero beyond ~2.5 radii. */
export function passageDeflectForce(
  shipX: number,
  shipY: number,
  shipZ: number,
  bodyX: number,
  bodyY: number,
  bodyZ: number,
  mass: number,
): [number, number, number] {
  const w = WARP_FIELD;
  const dx = bodyX - shipX;
  const dy = bodyY - shipY;
  const dz = bodyZ - shipZ;
  const d = Math.hypot(dx, dy, dz);
  if (d >= w.deflectRadius * 2.5) return [0, 0, 0];
  const q = d / w.deflectRadius;
  const fall = Math.exp(-q * q);
  // clamp the direction denominator so a body AT the ship still gets a
  // finite, arbitrary-but-stable push instead of NaN
  const inv = 1 / Math.max(d, 0.5);
  const s = w.deflectAccel * mass * fall * inv;
  return [dx * s, dy * s, dz * s];
}

/* ---------- B4 step 3: impulse-driven camera shake ----------------------- */

/** Impact-shake tuning. Amplitude derives from the SOLVER's own collision
 * impulse (IPhysicsCollisionEvent.impulse) with inverse-square distance
 * falloff to the camera — a heavy nearby crash thumps, a distant graze
 * whispers, and micro-contacts are ignored entirely. */
export const IMPACT_SHAKE = {
  /** Amplitude (world units) per solver-impulse unit at reference distance. */
  impulseScale: 0.004,
  /** Full amplitude at/below this camera distance; inverse-square beyond. */
  referenceDist: 60,
  /** Hard amplitude cap — shake must never disorient. */
  maxAmp: 0.9,
  /** Solver impulses below this are grazing contacts — no shake, no count. */
  minImpulse: 2,
  /** Exponential decay rate of the ring-down (1/s). */
  decayLambda: 2.8,
  /** Base oscillation frequency (Hz). */
  frequency: 13,
} as const;

/** Shake amplitude contributed by one impact. Zero below the grazing
 * threshold; inverse-square distance falloff; capped. */
export function impactShakeAmplitude(
  impulse: number,
  distToCam: number,
): number {
  const t = IMPACT_SHAKE;
  if (impulse < t.minImpulse) return 0;
  const d = Math.max(distToCam, t.referenceDist);
  const falloff = (t.referenceDist / d) ** 2;
  return Math.min(t.maxAmp, impulse * t.impulseScale * falloff);
}

/** Deterministic screen-space shake offsets [right, up] for a given
 * amplitude and time — two incommensurate sine channels per axis read as a
 * chaotic ring while staying fully testable and bounded by amp. */
export function shakeOffset(amp: number, tS: number): [number, number] {
  if (amp <= 0) return [0, 0];
  const w = IMPACT_SHAKE.frequency * Math.PI * 2;
  const ox =
    amp * (0.7 * Math.sin(w * tS) + 0.3 * Math.sin(w * 1.73 * tS + 1.7));
  const oy =
    amp * (0.7 * Math.sin(w * 1.31 * tS + 0.9) + 0.3 * Math.sin(w * 2.11 * tS));
  return [ox, oy];
}

/** WASM SIMD feature probe (Havok's hard floor — iOS ≥ 16.4). The byte
 * sequence is the standard wasm-feature-detect SIMD module: a single
 * function returning v128, valid only where SIMD is supported. */
export function wasmSimdSupported(): boolean {
  try {
    return WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10,
        1, 8, 0, 65, 0, 253, 15, 253, 98, 11,
      ]),
    );
  } catch {
    return false;
  }
}
