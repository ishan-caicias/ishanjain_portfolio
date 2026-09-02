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

/** PF-11 D6.2 (GO) — the real Gaia DR3 asteroid elements are heliocentric ECLIPTIC, but the rest
 * of this scene's catalog (stars, DSOs) is EQUATORIAL — leaving the belt in the ecliptic frame
 * put it 23.44 deg off the real zodiac (Astra, science brief; `scripts/lib/asteroid-kepler.mjs`'s
 * header DECLARED #1). `--frame equatorial` now rotates the BAKED real positions/velocities into
 * the scene's equatorial/world frame via that module's `eclipticToEquatorial` + `eclipticToWorld`
 * — ROTATE about world X by `OBLIQUITY_J2000_DEG` FIRST (in AU space), THEN translate by
 * `BELT_CENTER_Z` along world Z (the belt-centre placement is a scene/gameplay choice, not real
 * astrometry, so it stays a plain world-frame offset applied after the real rotation — same
 * order `eclipticToWorld` already uses). `toBeltSpace`/`fromBeltSpace` below are the ROTATION
 * half only — pure, no translation, correct for both points AND vectors (accelerations,
 * velocities, displacements never take a translation). Every belt-model function below handles
 * the `ASTEROID_BELT.center` translation itself, in the right place for what it's converting:
 * subtract center, rotate, run the tuned math (POSITION in); rotate the tuned math's result, add
 * center back (POSITION out); or just rotate with no translation at all (VECTOR either way).
 * Mirrors `eclipticToEquatorial` exactly (same axis, same angle) so real baked equatorial-frame
 * positions round-trip through the tuned geometry correctly; a unit test pins the two constants
 * against each other (the .mjs build script cannot be imported into shipped runtime code, so,
 * like KEPLER_K below, the duplication is structural, not accidental). */
const OBLIQ_D2R = Math.PI / 180;
/** Mirrors `scripts/lib/asteroid-kepler.mjs`'s `OBLIQUITY_J2000_DEG` exactly. */
export const OBLIQUITY_J2000_DEG = 23.439281;
export const BELT_OBLIQ_COS = Math.cos(OBLIQUITY_J2000_DEG * OBLIQ_D2R);
export const BELT_OBLIQ_SIN = Math.sin(OBLIQUITY_J2000_DEG * OBLIQ_D2R);

/** Equatorial (world) -> ecliptic-aligned (the frame every belt-model function below was tuned
 * in) rotation ONLY — no translation. The inverse of `fromBeltSpace`/`eclipticToEquatorial`:
 * rotation about world X by -OBLIQUITY_J2000_DEG. */
export function toBeltSpace(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    x,
    y * BELT_OBLIQ_COS + z * BELT_OBLIQ_SIN,
    -y * BELT_OBLIQ_SIN + z * BELT_OBLIQ_COS,
  ];
}

/** Ecliptic-aligned -> equatorial (world) rotation ONLY — no translation. IDENTICAL rotation to
 * `scripts/lib/asteroid-kepler.mjs`'s `eclipticToEquatorial` (about world X, by
 * +OBLIQUITY_J2000_DEG) — kept as its own copy rather than importing a build script into
 * shipped runtime code, same reasoning as KEPLER_K's duplication below. */
export function fromBeltSpace(
  x: number,
  y: number,
  z: number,
): [number, number, number] {
  return [
    x,
    y * BELT_OBLIQ_COS - z * BELT_OBLIQ_SIN,
    y * BELT_OBLIQ_SIN + z * BELT_OBLIQ_COS,
  ];
}

/** Belt geometry (world units, in belt-LOCAL space — see `toBeltSpace`/`fromBeltSpace` above).
 *
 * ORIENTATION: the ring lies in the belt-local X–Y plane (local axis = the obliquity-inclined
 * pole, PF-11 D6.2). Originally (PF-09 B4) this WAS world Z directly — a deliberate choice
 * (`raDecToDir` maps declination onto Z, and a Y-axis ring is crossed by almost no catalog
 * route, since routes' Y components are cd·sin(ra), large for most bodies) but an ASTRONOMICALLY
 * WRONG one: the real Gaia DR3 belt is heliocentric ECLIPTIC, not equatorial, so an unrotated
 * ring sat 23.44° off the true zodiac (Astra, science brief). D6.2 re-expressed this same ring
 * — same center/radius/spread, only the frame it's embedded in moved — in the real ecliptic
 * plane, rotated into the scene's equatorial world frame by `OBLIQUITY_J2000_DEG`.
 *
 * SHOWCASE ROUTE, re-measured after the move (numerically, not assumed): m42 (Orion Nebula)'s
 * old dead-centre crossing (dir ≈ (0.107, 0.990, −0.094), peak density ~0.98 at the old,
 * unrotated plane) fell to 0.0002 once the belt moved to its real orientation — m42 simply
 * isn't near the ecliptic. Aldebaran (α Tauri, dir from ra 68.980°/dec 16.509°) is: Taurus is a
 * zodiac constellation, and its real position threads the newly-honest tube at peak density
 * 0.964 (at r ≈ 165 along the origin ray) — as good a crossing as m42's ever was, and for the
 * physically real reason this move exists. `tests/e2e/engine-select.spec.ts`'s
 * belt-proximity-slowdown assertion travels there.
 *
 * The two figures above are RE-MEASURED (2026-07-29 code review, finding 9): D6.2 recorded
 * "~0.97" here and in the E2E comment but "~0.96" in TR-109 and the delivery plan — one
 * measured number with two values. Re-swept along each destination's origin ray at 0.05-unit
 * steps: Aldebaran 0.9639, m42 0.0002. The docs' 0.96 was the correct one; a regression test
 * (`asteroid-dr3-belt.test.ts`) now pins both so this can't drift again. */
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
 * drift, random spin, cubic-scaled mass.
 *
 * PF-11 D6.2: the torus itself is still generated in belt-LOCAL space (the tuned
 * center/radius/spread constants below are unchanged), then each position and velocity is
 * rotated into world space via `fromBeltSpace` before being stored — the procedural fallback
 * used by the kinematic (no-Havok) tier must sit in the same inclined ring the real Gaia DR3
 * field and `beltPullAccel`/`beltDensityAt` now expect, or a device without SIMD would see its
 * fallback rocks floating in the old (wrong) unrotated plane while everything else moved. */
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
    // Ring in the belt-LOCAL X–Y plane, relative to the centre (added back after rotating —
    // position out: rotate, then translate, same order `beltOrbitPosition` uses); local Z is
    // the tube's vertical axis (see ASTEROID_BELT).
    const lz = (rnd() * 2 - 1) * b.verticalSpread;
    const lx = Math.cos(theta) * r;
    const ly = Math.sin(theta) * r;
    const [wx, wy, wz] = fromBeltSpace(lx, ly, lz);
    positions[i * 3] = wx + b.center[0];
    positions[i * 3 + 1] = wy + b.center[1];
    positions[i * 3 + 2] = wz + b.center[2];

    const scale = b.scaleMin + rnd() * (b.scaleMax - b.scaleMin);
    scales[i] = scale;
    baseIndex[i] = Math.floor(rnd() * ROCK_BASE_COUNT) % ROCK_BASE_COUNT;
    masses[i] = scale * scale * scale;

    // tangential-biased drift: mostly along the ring, some radial/vertical (belt-local, then
    // rotated to world with the position above — a velocity is a vector, so the same rotation
    // applies with no translation term).
    const speed = b.speedMin + rnd() * (b.speedMax - b.speedMin);
    const tx = -Math.sin(theta);
    const ty = Math.cos(theta);
    const dirSign = rnd() < 0.5 ? -1 : 1;
    const jx = (rnd() * 2 - 1) * 0.35;
    const jy = (rnd() * 2 - 1) * 0.35;
    const jz = (rnd() * 2 - 1) * 0.35;
    const lvx = tx * dirSign + jx;
    const lvy = ty * dirSign + jy;
    const lvz = jz;
    const [vx, vy, vz] = fromBeltSpace(lvx, lvy, lvz);
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

/** Orbital motion for the 154,662-object VISUAL layer (PF-10 C3 follow-up).
 *
 * THE PROBLEM. TR-074 shipped the visual belt as a static snapshot while only the 20-48 Havok
 * bodies moved, and named that a known limitation. Animating the rest means the shared `ijStar`
 * vertex shader needs to know each speck's angular rate — but that shader carries only
 * `position: vec3` and `starMeta: vec2` per vertex, and four other layers share it. A per-vertex
 * rate float would cost ~2.5 MB of GPU memory for this layer alone, against a billboard-memory
 * budget ADR-0003 already flags as the open Babylon adoption condition.
 *
 * THE RESOLUTION — derive the rate instead of storing it, from real physics. Kepler's third law
 * fixes mean motion from orbital radius alone: n = sqrt(GM / a^3), i.e. n ∝ a^(-3/2). The shader
 * already knows each speck's distance from the Sun (it is the position it is drawing), so the
 * rate costs zero bytes:
 *
 *     omega(r) = ORBIT_OMEGA_K * r^(-3/2)
 *
 * This is not a stand-in for the real thing — it IS Kepler's third law, the same law the offline
 * pipeline's full state solution obeys. What is DECLARED is the substitution of the instantaneous
 * planar radius r for the semi-major axis a, which are equal for a circular orbit and differ by
 * up to (1 ± e) otherwise.
 *
 * WHAT THIS BUYS, in real astronomy: differential (Keplerian) shear. Inner asteroids genuinely
 * outrun outer ones, by the real 3/2-power ratio — the single most recognisable behaviour of a
 * real belt, and something the static snapshot could not show at all. The Kirkwood gaps are
 * RADIAL structure and this motion is purely azimuthal, so they survive rotation untouched: the
 * belt turns without the gaps smearing.
 *
 * Rotation is about world Z, the declared ecliptic pole (see asteroid-kepler.mjs's DECLARED #1),
 * and prograde — which matches every real asteroid in this catalog, whose maximum inclination is
 * 72.16° and so contains no retrograde orbits.
 */
/* The three physical/declared constants the rate derives from. Mirrored from
 * `scripts/lib/asteroid-kepler.mjs`, which owns them for the offline pipeline — a build script
 * cannot be imported into shipped runtime code, so the duplication is structural. A unit test
 * asserts the two copies agree; without it, a scale change in the pipeline would silently leave
 * the visual layer orbiting at the old rate. */
const GM_SUN_KM3_S2 = 1.32712440018e11;
const KM_PER_AU = 149597870.7;
const AU_TO_WORLD = 63;
const TIME_ACCEL = 4e5;

/** Kepler constant in scene units: omega = KEPLER_K * r^(-3/2), r in world units, omega in
 * rad/s of wall clock (the declared TIME_ACCEL is folded in).
 *
 * DERIVED, NOT TUNED — and derived here rather than pasted as a literal, on Astra's explicit
 * recommendation (orbital-motion brief, 2026-07-20): three separate places already encode the
 * AU→world scale and the time acceleration, and a hard-coded 39.8234 would silently desynchronise
 * from them the moment any one changed. Substituting GM into n = sqrt(GM/a^3), with a in world
 * units, gives **39.823416** — identical at every radius, exactly as Kepler's third law requires
 * (checked at r = 100, 170, 250, 328). A first draft used 39.807, back-solved from the science
 * brief's *rounded* 3.053 world-units/s figure; Astra measured that as 0.041% off. */
export const KEPLER_K =
  TIME_ACCEL * Math.sqrt(GM_SUN_KM3_S2 / (KM_PER_AU / AU_TO_WORLD) ** 3);

export const BELT_ORBIT = {
  /** See KEPLER_K. Exposed on this object too so the shader constants and the tuning knobs read
   * from one place. */
  omegaK: KEPLER_K,
  /** Below this radius the r^(-3/2) rate diverges; specks this close to the Sun are not belt
   * objects and are left unrotated rather than spun into a blur. */
  minRadius: 1,
} as const;

/** True heliocentric distance of a WORLD-space point — the Sun sits at the FIXED world position
 * (0, 0, ASTEROID_BELT.center[2]). PF-11 D6.2: still needs NO rotation, and deliberately does
 * none — `ASTEROID_BELT.center` is a plain world-frame translation applied AFTER the obliquity
 * rotation (mirroring `eclipticToWorld`'s translate-after-rotate order exactly), so the Sun's
 * own world position never moves when the belt's plane tilts; only its surrounding ring does.
 * Distance to a fixed point is unaffected by how the axes around it are oriented, so this
 * function is identical before and after D6.2 — recorded here so a future reader doesn't "fix"
 * it into calling `toBeltSpace` the way `beltPullAccel`/`beltDensityAt`/`beltOrbitPosition`
 * below do (which need the rotation because a SPINE POINT, unlike the Sun, moves with the tilt).
 *
 * ASTRA REFINEMENT (orbital-motion brief, 2026-07-20): the first draft fed the rate law the
 * PLANAR radius `hypot(x, y)`, which is the right answer only for an asteroid sitting exactly in
 * the ecliptic. Measured against the real catalog, that overstates the rate by a median 0.47% —
 * but **11,074 objects exceed 5%, 471 exceed 20%, and the worst is +189%** (the 94 real objects
 * inclined past 40°, which spend most of their orbit far above or below the plane). One extra
 * addition in the shader fixes all of them. */
export function heliocentricRadius(x: number, y: number, z: number): number {
  return Math.hypot(x, y, z - ASTEROID_BELT.center[2]);
}

/** Angular rate (rad/s) at true heliocentric distance `r`, from Kepler's third law. JS mirror of
 * the shader expression — the twins have no compiler to check them, so the arithmetic is pinned
 * here. */
export function beltAngularRate(r: number): number {
  if (r < BELT_ORBIT.minRadius) return 0;
  return BELT_ORBIT.omegaK * r ** -1.5;
}

/** One speck's position after `tS` seconds of orbital motion: a prograde rotation about the
 * belt's own (obliquity-inclined, PF-11 D6.2) pole at the rate its true heliocentric distance
 * implies. POSITION in: subtract the world-frame centre translation, THEN rotate into belt-local
 * space (this order matters — translation and rotation don't commute, and `eclipticToWorld`
 * always rotates first when going the other way, so undoing it correctly means translating
 * first here). Applies the ORIGINAL rotation about local Z unchanged (preserving planar radius
 * and height exactly, so the belt's radial structure — the Kirkwood gaps, the Hilda island, the
 * 4.05-5.00 AU void — is invariant frame to frame). POSITION out: rotate back to world, then
 * re-apply the centre translation. JS mirror of the shader's rotation, same identifiers/
 * structure either side of the basis change. */
export function beltOrbitPosition(
  x: number,
  y: number,
  z: number,
  tS: number,
): [number, number, number] {
  const b = ASTEROID_BELT;
  const [lx, ly, lz] = toBeltSpace(
    x - b.center[0],
    y - b.center[1],
    z - b.center[2],
  );
  const r = Math.hypot(lx, ly, lz); // == heliocentricRadius(x, y, z)
  const ang = beltAngularRate(r) * tS;
  if (ang === 0) return [x, y, z];
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  const [wx, wy, wz] = fromBeltSpace(lx * c - ly * s, lx * s + ly * c, lz);
  return [wx + b.center[0], wy + b.center[1], wz + b.center[2]];
}

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

/** Weak herding acceleration toward the nearest point on the belt's SPINE CIRCLE (radius R in
 * the belt-LOCAL X–Y plane at local z = 0, i.e. AT the centre once the input below has already
 * had `ASTEROID_BELT.center` subtracted) — preserves the ring shape, unlike a pull to the centre
 * point. Takes a WORLD-space POSITION, returns a WORLD-space acceleration VECTOR (PF-11 D6.2):
 * position in — subtract the centre translation, THEN rotate into belt-local space (translation
 * before rotation, undoing `eclipticToWorld`'s rotate-then-translate order); runs the ORIGINAL
 * unchanged math there; vector out — rotate the resulting acceleration back to world space with
 * NO translation (a delta/acceleration is a vector, not a point — translations never apply).
 *
 * ALLOCATION (2026-07-29 code review, finding 3): this runs once per rock per frame from
 * `visualDriftStep` and from the engine's Havok force loop, so it must not allocate. D6.2's
 * first cut called `toBeltSpace`/`fromBeltSpace`, which return fresh tuples — two arrays per
 * rock per frame where there had been one. The rotation is six multiply-adds; it is inlined
 * below and the result is written into a caller-owned `out`, so the hot loops allocate NOTHING.
 * `beltPullAccel` keeps its original tuple-returning signature as the pure, tested API for
 * callers outside the render loop — it just delegates. A unit test pins the two against each
 * other, and both against `toBeltSpace`/`fromBeltSpace`, so the inlined copy cannot drift. */
export function beltPullAccelInto(
  px: number,
  py: number,
  pz: number,
  out: Float64Array | number[],
): void {
  const b = ASTEROID_BELT;
  // toBeltSpace(px - cx, py - cy, pz - cz), inlined.
  const rx = px - b.center[0];
  const ry = py - b.center[1];
  const rz = pz - b.center[2];
  const lx = rx;
  const ly = ry * BELT_OBLIQ_COS + rz * BELT_OBLIQ_SIN;
  const lz = -ry * BELT_OBLIQ_SIN + rz * BELT_OBLIQ_COS;
  const planar = Math.hypot(lx, ly);
  let tx: number, ty: number;
  if (planar < 1e-6) {
    // on the axis: nearest spine point is ambiguous — pick +X
    tx = b.radius;
    ty = 0;
  } else {
    tx = (lx / planar) * b.radius;
    ty = (ly / planar) * b.radius;
  }
  const ax = (tx - lx) * b.pull;
  const ay = (ty - ly) * b.pull;
  const az = -lz * b.pull;
  // fromBeltSpace(ax, ay, az), inlined — vector out, no translation term.
  out[0] = ax;
  out[1] = ay * BELT_OBLIQ_COS - az * BELT_OBLIQ_SIN;
  out[2] = ay * BELT_OBLIQ_SIN + az * BELT_OBLIQ_COS;
}

export function beltPullAccel(
  px: number,
  py: number,
  pz: number,
): [number, number, number] {
  const out: [number, number, number] = [0, 0, 0];
  beltPullAccelInto(px, py, pz, out);
  return out;
}

/** Kinematic fallback integrator for the no-SIMD/visual-only tier: Euler
 * drift + the same belt pull, no collisions. Mutates pos/vel in place.
 *
 * Uses the module-scratch `beltPullAccelInto` path (see above) rather than `beltPullAccel` —
 * this loop runs over every rock every frame, and the tuple return was the allocation. */
const _pullScratch = new Float64Array(3);
export function visualDriftStep(
  pos: Float32Array,
  vel: Float32Array,
  count: number,
  dtS: number,
): void {
  for (let i = 0; i < count; i++) {
    const o = i * 3;
    beltPullAccelInto(pos[o], pos[o + 1], pos[o + 2], _pullScratch);
    vel[o] += _pullScratch[0] * dtS;
    vel[o + 1] += _pullScratch[1] * dtS;
    vel[o + 2] += _pullScratch[2] * dtS;
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

/** Smooth belt density 0..1 at a WORLD point: gaussian falloff from the spine circle (radially
 * and vertically, in belt-LOCAL space — PF-11 D6.2: subtracts the centre translation, THEN
 * rotates via `toBeltSpace`, same position-in order `beltPullAccel` uses). 1 on the spine, ~0
 * well outside the tube. Pure — drives the warp slowdown on every tier, physics or not. Returns
 * a scalar, so no conversion back to world space is needed.
 *
 * ALLOCATION (2026-07-29 code review, finding 3): this returned a plain number and allocated
 * NOTHING before D6.2; calling `toBeltSpace` made it allocate one tuple per call, and during
 * warp it runs once per frame for the point sample PLUS up to 25 more times inside
 * `minSlowAlongSegment`. The rotation is inlined below — back to zero allocation, same math,
 * same `toBeltSpace` composition (a unit test pins the inlined copy against the helper). */
export function beltDensityAt(px: number, py: number, pz: number): number {
  const b = ASTEROID_BELT;
  const w = WARP_FIELD;
  // toBeltSpace(px - cx, py - cy, pz - cz), inlined.
  const rx = px - b.center[0];
  const ry = py - b.center[1];
  const rz = pz - b.center[2];
  const lx = rx;
  const ly = ry * BELT_OBLIQ_COS + rz * BELT_OBLIQ_SIN;
  const lz = -ry * BELT_OBLIQ_SIN + rz * BELT_OBLIQ_COS;
  const dr = Math.hypot(lx, ly) - b.radius; // signed radial dist from spine (belt-local)
  const dz = lz; // already relative to centre (see the position-in subtraction above)
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

/** PF-11 D3.2 — the minimum warp-slow factor along a SEGMENT of the flight
 * path, substepped at half the belt's tightest gaussian sigma.
 *
 * Why this exists: `warpSlowMin` was a per-frame POINT sample, and its E2E
 * contract ("captured engine-side … no timing sensitivity") was never actually
 * true — under SwiftShader load a whole m42 journey renders in ~10 frames
 * (~2 fps measured), the per-frame position steps reach ~140 world units, and
 * two consecutive samples can straddle the belt tube entirely (probe: samples
 * at e=0.169 and e=0.442 around a core at e=0.326). The old triangle profile
 * passed that test by geometric accident — one of its sparse samples happened
 * to land on the tube edge — and the v4 profile's slightly gentler burn moved
 * the sample off the edge and exposed the latent fragility.
 *
 * The point sample stays for the per-frame FEEDBACK (flight feel); this
 * segment min makes the RECORD frame-rate-independent: the same journey now
 * reports the same minimum at 2 fps as at 60. Substeps are capped — the belt
 * tube is ~±3σ wide, so even a capped-coarse pass cannot miss the core. */
export function minSlowAlongSegment(
  ax: number,
  ay: number,
  az: number,
  bx: number,
  by: number,
  bz: number,
): number {
  const dist = Math.hypot(bx - ax, by - ay, bz - az);
  const step =
    Math.min(WARP_FIELD.densitySigmaRadial, WARP_FIELD.densitySigmaVertical) /
    2;
  const n = Math.max(1, Math.min(24, Math.ceil(dist / step)));
  let min = 1;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const s = warpSlowFactor(
      beltDensityAt(ax + (bx - ax) * t, ay + (by - ay) * t, az + (bz - az) * t),
    );
    if (s < min) min = s;
  }
  return min;
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

/** PF-11 D7.4: same math as `passageDeflectForce` below, written into a caller-owned `out`
 * instead of returning a fresh tuple. Called once per asteroid Havok body per frame during warp
 * (`_tickAsteroids`'s passage-deflection branch) — the tuple return was one more allocation in
 * that same per-rock loop `beltPullAccelInto` was already extracted for (2026-07-29 code review,
 * finding 3). `passageDeflectForce` keeps its tuple-returning signature as the tested pure API
 * and now just delegates; a unit test pins the two against each other. */
export function passageDeflectForceInto(
  shipX: number,
  shipY: number,
  shipZ: number,
  bodyX: number,
  bodyY: number,
  bodyZ: number,
  mass: number,
  out: Float64Array | number[],
): void {
  const w = WARP_FIELD;
  const dx = bodyX - shipX;
  const dy = bodyY - shipY;
  const dz = bodyZ - shipZ;
  const d = Math.hypot(dx, dy, dz);
  if (d >= w.deflectRadius * 2.5) {
    out[0] = 0;
    out[1] = 0;
    out[2] = 0;
    return;
  }
  const q = d / w.deflectRadius;
  const fall = Math.exp(-q * q);
  // clamp the direction denominator so a body AT the ship still gets a
  // finite, arbitrary-but-stable push instead of NaN
  const inv = 1 / Math.max(d, 0.5);
  const s = w.deflectAccel * mass * fall * inv;
  out[0] = dx * s;
  out[1] = dy * s;
  out[2] = dz * s;
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
  const out: [number, number, number] = [0, 0, 0];
  passageDeflectForceInto(shipX, shipY, shipZ, bodyX, bodyY, bodyZ, mass, out);
  return out;
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
