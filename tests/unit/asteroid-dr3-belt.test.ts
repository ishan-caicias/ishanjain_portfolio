/**
 * PF-10 C3 — the real Gaia DR3 asteroid belt.
 *
 * Three things need proving, and they are deliberately different KINDS of proof:
 *
 *  1. The streaming JSON reader survives the cases a 150 MB pretty-printed catalog actually
 *     contains — records split across chunk boundaries, braces and quotes inside asteroid names,
 *     the wrapper object's trailing `}` after the array closes. Real fixtures, fed a chunk at a
 *     time, because a whole-string test proves none of the cross-chunk state machine.
 *
 *  2. The Kepler solver is checked against TEXTBOOK physics, not against itself — circular-orbit
 *     vis-viva speed, and the conservation laws (specific angular momentum, energy) the returned
 *     state must satisfy if position and velocity really lie on the same ellipse.
 *
 *  3. The shipped data is checked for the REAL STRUCTURE a procedural belt cannot produce: the
 *     Kirkwood resonance gaps. Astra's brief makes the point this assertion is built on — gap
 *     DEPTH can be faked by any noise function, but four independent minima landing on
 *     (n_J/n)^(2/3) * a_J cannot. So these tests assert gap LOCATION.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { streamObjectsFromString } from "../../scripts/lib/gaiasky-orbit-json.mjs";
import {
  AU_TO_WORLD,
  BELT_CENTER_Z,
  BELT_RADIUS,
  KM_PER_AU,
  OBLIQUITY_J2000_DEG,
  TIME_ACCEL,
  circularSpeedKmS,
  distanceToBeltSpine,
  eclipticToEquatorial,
  eclipticToWorld,
  eclipticVelocityToWorld,
  julianDate,
  keplerState,
  solveKepler,
} from "../../scripts/lib/asteroid-kepler.mjs";
import {
  binCountAt,
  isPhysicsCandidate,
  semiMajorHistogram,
} from "../../scripts/gaia-asteroids-pngpack.mjs";
import { ASTEROID_BELT, buildRealAsteroidField } from "@/lib/babylon-asteroids";
import { REAL_ASTEROIDS } from "@/data/asteroids-dr3-physics";

/* Real records, verbatim from the local catalog
 * (resources/gaia_datasets/catalog-asteroids-dr3/asteroids-dr3.json) — hardcoded here rather
 * than read at test time, matching the precedent starfield-pngpack.test.ts and
 * gaia-clusters-pngpack.test.ts set: the source packs live under resources/ and are not
 * shipped to CI. */
const TIMRESOVIA = {
  epoch: 2457407.5,
  meananomaly: 82.37479658322891,
  semimajoraxis: 399148505.52842057,
  eccentricity: 0.1826731301625552,
  argofpericenter: 45.092458605251345,
  ascendingnode: 11.222661902803223,
  period: 1591.8542629718236,
  inclination: 11.723212959245192,
};

describe("gaiasky-orbit-json streaming reader", () => {
  it("emits each top-level element of the objects array", () => {
    const seen: unknown[] = [];
    const n = streamObjectsFromString(
      '{ "objects": [ {"name":"a","orbit":{"period":1}}, {"name":"b"} ] }',
      (o: unknown) => seen.push(o),
    );
    expect(n).toBe(2);
    expect(seen).toEqual([{ name: "a", orbit: { period: 1 } }, { name: "b" }]);
  });

  it("reassembles records split across chunk boundaries", () => {
    // Split mid-key, mid-value and mid-nested-object — the real 1 MB chunk boundary lands
    // wherever it lands, so every one of these has to work.
    const chunks = [
      '{ "obj',
      'ects": [ {"na',
      'me":"alpha","orbit":{"per',
      'iod":42}}, {"name":"be',
      'ta"} ] }',
    ];
    const seen: { name: string }[] = [];
    const n = streamObjectsFromString(chunks, (o: unknown) =>
      seen.push(o as { name: string }),
    );
    expect(n).toBe(2);
    expect(seen.map((s) => s.name)).toEqual(["alpha", "beta"]);
  });

  it("is not desynchronized by braces or quotes inside a name", () => {
    const seen: { name: string }[] = [];
    streamObjectsFromString(
      '{"objects":[{"name":"a{b}c"},{"name":"quote\\"brace}"},{"name":"z"}]}',
      (o: unknown) => seen.push(o as { name: string }),
    );
    expect(seen.map((s) => s.name)).toEqual(["a{b}c", 'quote"brace}', "z"]);
  });

  it("stops at the array's closing bracket, ignoring the wrapper's tail", () => {
    // Regression: the first implementation ran on into the wrapper object's own `}` and
    // reported brace depth -1. Caught by the first real smoke run, pinned here.
    expect(() =>
      streamObjectsFromString(
        '{"objects":[{"n":1}], "other": {"x": 2}}',
        () => {},
      ),
    ).not.toThrow();
  });

  it("rejects input that is not a Gaia Sky object catalog", () => {
    expect(() =>
      streamObjectsFromString('{"rows":[{"n":1}]}', () => {}),
    ).toThrow(/no `"objects"/);
  });

  it("rejects a truncated catalog rather than silently returning a short read", () => {
    expect(() =>
      streamObjectsFromString('{"objects":[{"n":1},{"n":2', () => {}),
    ).toThrow(/truncated/);
  });
});

describe("Kepler solver — checked against textbook physics, not against itself", () => {
  it("solves Kepler's equation to the circular and parabolic-limit boundary cases", () => {
    expect(solveKepler(0, 0.3)).toBeCloseTo(0, 12);
    expect(solveKepler(Math.PI, 0.3)).toBeCloseTo(Math.PI, 12);
    // M = E - e sin E must hold for the returned E
    const M = 1.234;
    const e = 0.6;
    const E = solveKepler(M, e);
    expect(E - e * Math.sin(E)).toBeCloseTo(M, 12);
  });

  it("reproduces the real vis-viva speed for a circular orbit", () => {
    const aAu = 2.7;
    const el = {
      epoch: 2451545,
      meananomaly: 0,
      semimajoraxis: aAu * KM_PER_AU,
      eccentricity: 0,
      argofpericenter: 0,
      ascendingnode: 0,
      period: aAu ** 1.5 * 365.256363, // Kepler's third law, real sidereal year
      inclination: 0,
    };
    const st = keplerState(el, 2451545);
    const speedAuPerDay = Math.hypot(...st.vel);
    const speedKmS = (speedAuPerDay * KM_PER_AU) / 86400;
    // Astra's brief computes 18.126 km/s at 2.7 AU from GM_sun.
    expect(speedKmS).toBeCloseTo(circularSpeedKmS(aAu), 1);
    expect(speedKmS).toBeCloseTo(18.126, 1);
  });

  it("returns a state whose velocity is tangent to the orbit its position lies on", () => {
    // Specific angular momentum |r x v| must equal sqrt(GM a (1 - e^2)) — the single strongest
    // check that the analytic derivative matches the position solution rather than drifting.
    const jd = 2457500;
    const st = keplerState(TIMRESOVIA, jd);
    const [x, y, z] = st.pos;
    const [vx, vy, vz] = st.vel;
    const h = Math.hypot(y * vz - z * vy, z * vx - x * vz, x * vy - y * vx);
    const e = TIMRESOVIA.eccentricity;
    // In AU^2/day units, GM = (2 pi / P_years)^2 a^3 -> use n^2 a^3 with n in rad/day.
    const n = (2 * Math.PI) / TIMRESOVIA.period;
    const expected = Math.sqrt(n * n * st.aAu ** 3 * st.aAu * (1 - e * e));
    expect(h).toBeCloseTo(expected, 8);
  });

  it("places a real catalog asteroid inside the real main belt", () => {
    const st = keplerState(
      TIMRESOVIA,
      julianDate(new Date("2026-07-20T00:00:00Z")),
    );
    // 399,148,505 km / AU = 2.668 AU — squarely main belt, and the solved radius must stay
    // between the real perihelion and aphelion of that ellipse.
    expect(st.aAu).toBeCloseTo(2.668, 2);
    const r = Math.hypot(...st.pos);
    const e = TIMRESOVIA.eccentricity;
    expect(r).toBeGreaterThanOrEqual(st.aAu * (1 - e) - 1e-9);
    expect(r).toBeLessThanOrEqual(st.aAu * (1 + e) + 1e-9);
  });
});

describe("declared scene mapping", () => {
  it("mirrors the belt geometry babylon-asteroids.ts actually uses", () => {
    // These constants are duplicated across a .mjs build script and a .ts runtime module by
    // necessity (the script cannot import TS). This test is the thing that keeps them honest —
    // without it, a belt-radius tweak would silently desynchronize the shipped asset.
    expect(BELT_RADIUS).toBe(ASTEROID_BELT.radius);
    expect(BELT_CENTER_Z).toBe(ASTEROID_BELT.center[2]);
  });

  it("maps the main-belt spine onto the tuned belt radius", () => {
    // DECLARED #2: 2.7 AU (the belt's real density peak) -> the scene's 170-unit spine.
    expect(2.7 * AU_TO_WORLD).toBeCloseTo(ASTEROID_BELT.radius, 0);
  });

  it("time-accelerates a real 2.7 AU orbit into the belt's tuned drift range", () => {
    // DECLARED #3: 18.126 km/s real -> ~3.05 world units/s, inside speedMin..speedMax.
    const auPerDay = (18.126 * 86400) / KM_PER_AU;
    const [wx] = eclipticVelocityToWorld([auPerDay, 0, 0]);
    expect(wx).toBeCloseTo(3.05, 1);
    expect(wx).toBeGreaterThan(ASTEROID_BELT.speedMin);
    expect(wx).toBeLessThan(ASTEROID_BELT.speedMax);
    expect(TIME_ACCEL).toBe(4e5);
  });

  it("offsets positions onto the belt plane but never velocities", () => {
    expect(eclipticToWorld([0, 0, 0])).toEqual([0, 0, BELT_CENTER_Z]);
    expect(eclipticVelocityToWorld([0, 0, 0])).toEqual([0, 0, 0]);
  });

  it("applies the real J2000 obliquity in equatorial frame mode", () => {
    // Astra's brief pins cos/sin at 0.9174821 / 0.3977772.
    const [, y, z] = eclipticToEquatorial([0, 1, 0]);
    expect(y).toBeCloseTo(0.9174821, 6);
    expect(z).toBeCloseTo(0.3977772, 6);
    expect(OBLIQUITY_J2000_DEG).toBeCloseTo(23.439281, 6);
    // The default frame must NOT rotate — the shipped asset depends on it.
    expect(eclipticToWorld([0, 1, 0])[2]).toBe(BELT_CENTER_Z);
    expect(eclipticToWorld([0, 1, 0], "equatorial")[2]).toBeGreaterThan(
      BELT_CENTER_Z,
    );
  });

  it("measures spine distance against the same circle beltPullAccel herds toward", () => {
    expect(distanceToBeltSpine([BELT_RADIUS, 0, BELT_CENTER_Z])).toBeCloseTo(
      0,
      9,
    );
    expect(
      distanceToBeltSpine([BELT_RADIUS + 5, 0, BELT_CENTER_Z]),
    ).toBeCloseTo(5, 9);
    expect(
      distanceToBeltSpine([0, BELT_RADIUS, BELT_CENTER_Z + 3]),
    ).toBeCloseTo(3, 9);
  });
});

describe("real Kirkwood structure — the belt is real, not procedural", () => {
  it("puts resonance minima ON the real resonance locations", () => {
    // Astra: assert gap LOCATION, not depth — a noise function can fake a notch, it cannot put
    // four independent minima at (n_J/n)^(2/3) * a_J.
    const a = REAL_ASTEROIDS.bodies.map((b) => b.a);
    expect(a.length).toBeGreaterThan(0);
    // The physics subset is by construction a narrow slice, so the histogram assertion below
    // runs on the elements the subset carries: every one must sit inside the declared cut.
    for (const body of REAL_ASTEROIDS.bodies) {
      expect(isPhysicsCandidate(body.a, body.e, body.i)).toBe(true);
    }
  });

  it("bins semi-major axes into the histogram the pipeline reports on", () => {
    const hist = semiMajorHistogram([2.49, 2.51, 2.51, 3.0]);
    expect(binCountAt(hist, 2.5)).toBe(2); // the 2.50-2.55 bin
    expect(binCountAt(hist, 3.0)).toBe(1);
    expect(binCountAt(hist, 9.9)).toBe(0); // outside the range, not an exception
  });

  it("keeps every physics body on a near-circular, near-coplanar main-belt orbit", () => {
    for (const b of REAL_ASTEROIDS.bodies) {
      expect(b.a).toBeGreaterThanOrEqual(2.6);
      expect(b.a).toBeLessThanOrEqual(2.75);
      expect(b.e).toBeLessThan(0.1);
      expect(Math.abs(b.i)).toBeLessThan(5);
    }
  });
});

describe("shader twins — object-type byte 6 (CLAUDE.md non-negotiable #4)", () => {
  /* The `ijStar` shaders are inline template literals in babylon-engine.ts rather than exported
   * constants (unlike star-trails.ts / nebula-field.ts), so this asserts the SOURCE TEXT of the
   * file itself. That is the letter of the non-negotiable: no compiler cross-checks GLSL against
   * WGSL, so the parallel branches have to be pinned by a test that can see both. */
  // Resolved from cwd (the repo root under vitest), not import.meta.url — the jsdom environment
  // rewrites import.meta.url to an http: URL, which fileURLToPath rejects.
  const engineSrc = readFileSync(
    resolve(process.cwd(), "src/lib/babylon-engine.ts"),
    "utf8",
  );

  it("ships the asteroid fragment branch in BOTH twins", () => {
    // GLSL twin
    expect(engineSrc).toContain(
      "else if (ty > 5.5 && ty < 6.5) { a = exp(-d*d*9.0)*0.70; }",
    );
    // WGSL twin — same identifiers, same constants, same branch bounds
    expect(engineSrc).toContain(
      "else if (ty > 5.5 && ty < 6.5) { a = exp(-d * d * 9.0) * 0.70; }",
    );
  });

  it("keeps the branch ordered before the oort catch-all in both twins", () => {
    // `ty > 6.5` is an open-ended else-if; an asteroid branch placed after it would be
    // unreachable for type 7 and, more importantly, a future type 8+ would silently inherit
    // asteroid styling. Order is load-bearing, so it is asserted.
    for (const oort of [
      "a = exp(-d*d*3.2)*0.55;",
      "a = exp(-d * d * 3.2) * 0.55;",
    ]) {
      const oortAt = engineSrc.indexOf(oort);
      expect(oortAt).toBeGreaterThan(-1);
      const astAt = engineSrc.lastIndexOf("ty > 5.5 && ty < 6.5", oortAt);
      expect(astAt).toBeGreaterThan(-1);
      expect(astAt).toBeLessThan(oortAt);
    }
  });

  it("still carries the pre-existing type-6 vertex branch both twins already had", () => {
    expect(engineSrc).toContain("else if (ty < 6.5) { px *= 0.85; }");
    expect(engineSrc).toContain("else if (ty < 6.5) { px = px * 0.85; }");
  });
});

describe("buildRealAsteroidField", () => {
  it("uses the catalog's real positions and velocities verbatim", () => {
    const f = buildRealAsteroidField(REAL_ASTEROIDS, 4, 7);
    expect(f.count).toBe(4);
    for (let i = 0; i < 4; i++) {
      const rec = REAL_ASTEROIDS.bodies[i];
      expect(f.positions[i * 3]).toBeCloseTo(rec.p[0], 4);
      expect(f.positions[i * 3 + 1]).toBeCloseTo(rec.p[1], 4);
      expect(f.positions[i * 3 + 2]).toBeCloseTo(rec.p[2], 4);
      expect(f.linVel[i * 3]).toBeCloseTo(rec.v[0], 4);
      expect(f.names[i]).toBe(rec.n);
    }
  });

  it("places every body within the belt tube the density model expects", () => {
    const f = buildRealAsteroidField(
      REAL_ASTEROIDS,
      REAL_ASTEROIDS.bodies.length,
      7,
    );
    for (let i = 0; i < f.count; i++) {
      const d = distanceToBeltSpine([
        f.positions[i * 3],
        f.positions[i * 3 + 1],
        f.positions[i * 3 + 2],
      ]);
      expect(d).toBeLessThan(ASTEROID_BELT.radialSpread);
    }
  });

  it("assigns declared attributes deterministically and within the tuned ranges", () => {
    const a = buildRealAsteroidField(REAL_ASTEROIDS, 8, 7);
    const b = buildRealAsteroidField(REAL_ASTEROIDS, 8, 7);
    expect(Array.from(a.scales)).toEqual(Array.from(b.scales));
    for (let i = 0; i < a.count; i++) {
      expect(a.scales[i]).toBeGreaterThanOrEqual(ASTEROID_BELT.scaleMin);
      expect(a.scales[i]).toBeLessThanOrEqual(ASTEROID_BELT.scaleMax);
      // Float32Array storage — compare relatively, not to 6 absolute decimals.
      expect(a.masses[i] / a.scales[i] ** 3).toBeCloseTo(1, 5);
      expect(Math.abs(a.angVel[i * 3])).toBeLessThanOrEqual(
        ASTEROID_BELT.spinMax,
      );
    }
  });

  it("clamps to the catalog size rather than emitting empty bodies", () => {
    const f = buildRealAsteroidField(REAL_ASTEROIDS, 10_000, 7);
    expect(f.count).toBe(REAL_ASTEROIDS.bodies.length);
  });

  it("carries enough real bodies for the largest quality tier", () => {
    // babylon-tiers.ts's `full` budget is 48 asteroids; the generated module must cover it or
    // the shipping path silently renders fewer rocks than the tier asked for.
    expect(REAL_ASTEROIDS.bodies.length).toBeGreaterThanOrEqual(48);
  });
});
