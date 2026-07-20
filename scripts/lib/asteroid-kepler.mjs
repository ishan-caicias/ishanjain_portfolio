/* asteroid-kepler.mjs — PF-10 C3: real Keplerian elements -> real scene positions & velocities.
 *
 * Shares its solver lineage with `scripts/gaia-minorplanet-position.mjs` (PF-10 C1, TR-065),
 * which computed real snapshot positions for the four base-pack minor planets. This module
 * generalizes that work in two ways C3 needs and C1 did not:
 *
 *   1. It returns the full orbital STATE (position AND velocity), not just a position — the
 *      physics layer's rigid bodies need a real initial velocity vector, not a synthetic
 *      tangential drift.
 *   2. It maps heliocentric ecliptic AU into the scene's existing belt frame, which is what
 *      lets 154,635 real objects land where `babylon-asteroids.ts`'s already-tuned belt
 *      geometry (density falloff, warp slowdown, the m42 showcase-route crossing) expects them.
 *
 * ---------------------------------------------------------------------------------------------
 * DECLARED LICENCES (stated here rather than buried, per this repo's accuracy convention — the
 * REAL parts and the DECLARED parts must be separable by a reader):
 *
 * REAL, per object, straight from the Gaia DR3 catalog: semi-major axis, eccentricity,
 * inclination, longitude of ascending node, argument of pericenter, mean anomaly, epoch, period.
 * Every position below is the two-body Kepler solution for those real elements, propagated from
 * each object's OWN real epoch (the catalog carries 959 distinct ones) to a stated snapshot date.
 * The belt's radial structure — including the Kirkwood resonance gaps — is therefore real
 * emergent structure, not drawn.
 *
 * DECLARED #1 — the scene's X-Y plane IS the ecliptic plane. Gaia Sky's own dataset applies
 * `transformFunction: eclipticToEquatorial`; this pipeline by default deliberately does NOT.
 *
 *   ASTRA FLAGGED THIS AS THE ONE REAL DEFECT IN C3 (science brief, 2026-07-20), and the flag is
 *   recorded rather than argued away: the rest of the scene's catalog (stars, DSOs) is in
 *   EQUATORIAL RA/Dec, so leaving the belt in the ecliptic frame puts it 23.44° off the real
 *   zodiac — about 47 full-Moon diameters at the solstitial points. Visible to anyone who knows
 *   where the ecliptic actually runs through the constellations; invisible otherwise.
 *
 *   It is NOT fixed by default because the fix is not the nine multiplies below — those are
 *   trivial. It is that `babylon-asteroids.ts`'s entire belt model (spine circle, herding pull,
 *   gaussian density, warp slowdown, passage deflection, and the deliberately-chosen m42
 *   showcase-route crossing documented in ASTEROID_BELT's ORIENTATION note) is defined in the
 *   X-Y plane about world Z. Rotating only the data tilts the real belt out of the frame those
 *   act in: the spine circle would then intersect the belt at two nodes instead of ringing it,
 *   the density falloff would register almost nowhere, and the physics bodies would be herded
 *   steadily out of their own real orbital plane. Doing it properly means re-expressing the belt
 *   model itself in an inclined basis — a real, bounded piece of work, and an owner call between
 *   goal 1 (realism) and an already-tuned, E2E-guarded interaction, not a silent default.
 *
 *   `--frame equatorial` performs the rotation today, so the choice is one flag and a
 *   regeneration away rather than a rewrite.
 *
 * DECLARED #2 — 1 AU = AU_TO_WORLD world units. The main belt's 2.7 AU spine maps onto the
 * existing 170-unit belt radius. Object SIZES are not on this scale (a real 1 km asteroid would
 * be ~4e-10 world units and invisible); render size is exaggerated, as it must be.
 *
 * DECLARED #3 — TIME_ACCEL. Real main-belt orbital speed is ~18 km/s, which at DECLARED #2's
 * scale is 7.6e-6 world units/s — motionless. One uniform acceleration factor is applied to
 * every velocity, chosen so a circular 2.7 AU orbit moves at ~3 world units/s (the midpoint of
 * the belt's existing tuned drift range). Because the factor is UNIFORM, relative speeds stay
 * exactly real: inner asteroids genuinely outrun outer ones by the real vis-viva ratio.
 */

/** Kilometres per astronomical unit (IAU 2012 definition — exact). */
export const KM_PER_AU = 149597870.7;
/** Heliocentric gravitational constant GM_sun, km^3/s^2 (IAU nominal). */
export const GM_SUN_KM3_S2 = 1.32712440018e11;
const D2R = Math.PI / 180;

/** DECLARED #2: world units per AU. 2.7 AU (main-belt spine) -> 170.1, matching
 * `ASTEROID_BELT.radius` = 170. Mirrored by a unit test against that constant. */
export const AU_TO_WORLD = 63;
/** Mirrors `ASTEROID_BELT.center[2]` — the belt plane's world-Z offset. */
export const BELT_CENTER_Z = -13;
/** Mirrors `ASTEROID_BELT.radius` — the spine circle the physics subset is selected against. */
export const BELT_RADIUS = 170;
/** DECLARED #3: uniform time acceleration (~4.6 real days per wall-clock second). See header. */
export const TIME_ACCEL = 4e5;
/** Seconds per day — velocity unit conversion. */
const SECONDS_PER_DAY = 86400;

/** Julian Date for a UTC instant (proleptic Gregorian). Same construction as
 * gaia-minorplanet-position.mjs, kept identical so both snapshots share one time scale. */
export function julianDate(dateUtc) {
  return dateUtc.getTime() / 86400000 + 2440587.5;
}

export function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Solve Kepler's equation M = E - e sin E for the eccentric anomaly (radians), Newton-Raphson.
 * Identical to the C1 minor-planet solver; converges in a handful of iterations for every
 * eccentricity in this catalog (all bound orbits, e < 1). */
export function solveKepler(mRad, e) {
  let E = mRad;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - mRad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Real Gaia Sky orbital elements -> heliocentric ECLIPTIC state at Julian Date `jd`.
 *
 * Returns `{ pos: [x, y, z] AU, vel: [vx, vy, vz] AU/day, aAu, meanAnomalyDeg }`.
 *
 * The velocity is the analytic derivative of the same perifocal solution, not a finite
 * difference: with Edot = n / (1 - e cos E), the perifocal rates are
 *   xdot = -a sin(E) Edot,  ydot = a sqrt(1 - e^2) cos(E) Edot
 * rotated into the ecliptic by the identical (w, i, Omega) matrix used for the position. That
 * makes the returned state exactly self-consistent — a body's velocity is tangent to the very
 * ellipse its position sits on, which is what keeps the Havok subset from visibly drifting off
 * its own orbit in the first seconds. */
export function keplerState(el, jd) {
  const aAu = el.semimajoraxis / KM_PER_AU;
  const e = el.eccentricity;
  const meanMotionDegPerDay = 360 / el.period;
  const mDeg = norm360(el.meananomaly + meanMotionDegPerDay * (jd - el.epoch));
  const M = mDeg * D2R;
  const E = solveKepler(M, e);
  const n = meanMotionDegPerDay * D2R; // rad/day
  const cosE = Math.cos(E);
  const sinE = Math.sin(E);
  const sqrt1me2 = Math.sqrt(1 - e * e);

  // Perifocal position and its time derivative
  const xOrb = aAu * (cosE - e);
  const yOrb = aAu * sqrt1me2 * sinE;
  const eDot = n / (1 - e * cosE); // rad/day
  const xOrbDot = -aAu * sinE * eDot;
  const yOrbDot = aAu * sqrt1me2 * cosE * eDot;

  const w = el.argofpericenter * D2R;
  const i = el.inclination * D2R;
  const Om = el.ascendingnode * D2R;
  const cosW = Math.cos(w),
    sinW = Math.sin(w);
  const cosI = Math.cos(i),
    sinI = Math.sin(i);
  const cosOm = Math.cos(Om),
    sinOm = Math.sin(Om);

  const rot = (px, py) => {
    const xw = px * cosW - py * sinW;
    const yw = px * sinW + py * cosW;
    return [
      xw * cosOm - yw * cosI * sinOm,
      xw * sinOm + yw * cosI * cosOm,
      yw * sinI,
    ];
  };

  return {
    pos: rot(xOrb, yOrb),
    vel: rot(xOrbDot, yOrbDot),
    aAu,
    meanAnomalyDeg: mDeg,
  };
}

/** Mean obliquity of the ecliptic at J2000, degrees — the rotation Gaia Sky's own
 * `transformFunction: eclipticToEquatorial` applies. Astra's brief pins cos/sin at
 * 0.9174821 / 0.3977772, which this reproduces to 7 decimal places. */
export const OBLIQUITY_J2000_DEG = 23.439281;

/** Rotate a heliocentric ecliptic vector into the equatorial frame. Applies to positions and
 * velocities alike — it is a pure rotation, so no translation term is involved either way. */
export function eclipticToEquatorial([x, y, z]) {
  const eps = OBLIQUITY_J2000_DEG * D2R;
  const c = Math.cos(eps),
    s = Math.sin(eps);
  return [x, y * c - z * s, y * s + z * c];
}

/** DECLARED #1 + #2: heliocentric ecliptic AU -> scene world units. `frame` selects DECLARED #1:
 * "ecliptic" (default) maps the ecliptic plane onto the scene's tuned belt plane; "equatorial"
 * applies the real obliquity first, matching the rest of the catalog's frame at the cost
 * documented in this module's header. */
export function eclipticToWorld(v, frame = "ecliptic") {
  const [x, y, z] = frame === "equatorial" ? eclipticToEquatorial(v) : v;
  return [x * AU_TO_WORLD, y * AU_TO_WORLD, BELT_CENTER_Z + z * AU_TO_WORLD];
}

/** DECLARED #2 + #3: heliocentric ecliptic AU/day -> scene world units/second. No belt-centre
 * offset here — an offset is a translation, and translations do not affect velocities. */
export function eclipticVelocityToWorld(v, frame = "ecliptic") {
  const [vx, vy, vz] = frame === "equatorial" ? eclipticToEquatorial(v) : v;
  const k = (AU_TO_WORLD / SECONDS_PER_DAY) * TIME_ACCEL;
  return [vx * k, vy * k, vz * k];
}

/** Real circular-orbit speed at radius `aAu` (vis-viva with e = 0), km/s. Used by the unit
 * tests to check the returned velocities against textbook values rather than against
 * themselves. */
export function circularSpeedKmS(aAu) {
  return Math.sqrt(GM_SUN_KM3_S2 / (aAu * KM_PER_AU));
}

/** Distance from a world-space point to the belt's SPINE CIRCLE (radius BELT_RADIUS in the
 * X-Y plane at z = BELT_CENTER_Z) — the real, data-derived ranking used to choose which real
 * asteroids become physics bodies. Mirrors `beltPullAccel`'s own geometry so the selected
 * bodies are exactly the ones the herding force is best behaved for. */
export function distanceToBeltSpine([x, y, z]) {
  const planar = Math.hypot(x, y) - BELT_RADIUS;
  const dz = z - BELT_CENTER_Z;
  return Math.hypot(planar, dz);
}
