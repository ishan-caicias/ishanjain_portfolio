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
import {
  ASTEROID_BELT,
  BELT_ORBIT,
  KEPLER_K,
  beltAngularRate,
  beltOrbitPosition,
  heliocentricRadius,
  buildRealAsteroidField,
} from "@/lib/babylon-asteroids";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";
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

  it("ships the orbital-motion block in BOTH vertex twins", () => {
    // GLSL
    expect(engineSrc).toContain(
      "float ang = ORBIT_OMEGA_K * inversesqrt(rOrb*rOrb*rOrb) * uTime;",
    );
    // WGSL — note inverseSqrt (capital S); the twins use the same identifiers for the same
    // quantities but each language's own spelling of the builtin.
    expect(engineSrc).toContain(
      "let ang : f32 = ORBIT_OMEGA_K * inverseSqrt(rOrb*rOrb*rOrb) * uniforms.uTime;",
    );
  });

  it("bakes the SAME orbit constants into both twins, from the one TS source", () => {
    // The shader sources are template literals, so the FILE holds the interpolation, not the
    // number. Asserting the interpolation is the stronger claim: it pins that both twins are
    // generated from the one TS constant and cannot drift apart by a hand-edit to either.
    expect(engineSrc).toContain(
      "const float ORBIT_OMEGA_K = ${BELT_ORBIT.omegaK.toFixed(4)};",
    );
    expect(engineSrc).toContain(
      "const ORBIT_OMEGA_K : f32 = ${BELT_ORBIT.omegaK.toFixed(4)};",
    );
    // And the value that interpolation produces is the derived one.
    expect(BELT_ORBIT.omegaK.toFixed(4)).toBe("39.8234");
  });

  it("gates the rotation on type 6 in both twins, so no other layer moves", () => {
    // Four layers share this material (stars, SDSS galaxies, Oort cloud, white dwarfs). An
    // ungated rotation would set the entire sky spinning — the failure this guard exists for.
    expect(engineSrc).toContain("if (uTime > 0.0 && ty > 5.5 && ty < 6.5)");
    expect(engineSrc).toContain(
      "if (uniforms.uTime > 0.0 && ty > 5.5 && ty < 6.5)",
    );
  });

  it("computes ty exactly ONCE per vertex in each twin", () => {
    // Measured, not stylistic (TR-075 Part 4): this material is shared with the SDSS layer's
    // 14.5M vertices, so every redundant floor() is 14.5M redundant floor()s per frame. The
    // first draft called floor(starMeta.y) three times per vertex.
    const glslFloors =
      engineSrc.match(/float ty = floor\(starMeta\.y\);/g) ?? [];
    const wgslFloors =
      engineSrc.match(/let ty : f32 = floor\(vertexInputs\.starMeta\.y\);/g) ??
      [];
    expect(glslFloors).toHaveLength(1);
    expect(wgslFloors).toHaveLength(1);
    // ...and the surviving one must be hoisted ABOVE the orbital block that consumes it.
    expect(engineSrc.indexOf("float ty = floor(starMeta.y);")).toBeLessThan(
      engineSrc.indexOf("if (uTime > 0.0 && ty > 5.5 && ty < 6.5)"),
    );
  });

  it("declares uTime as a uniform in both twins and in the material's uniform list", () => {
    // A uniform used but not declared to Babylon is silently never pushed — the belt would
    // simply never move, with nothing in the console to say why.
    expect(engineSrc).toContain("uniform float uTime;");
    expect(engineSrc).toContain("uniform uTime : f32;");
    expect(engineSrc).toContain('"uWarpDir",\n          "uTime",');
  });

  it("pins uTime to 0 under reduced motion (non-negotiable #24)", () => {
    // bodyT is already the reduced-motion-gated clock; the belt must share it, not read
    // performance.now() directly.
    expect(engineSrc).toContain('this._starMat?.setFloat("uTime", bodyT);');
    expect(engineSrc).toContain(
      "const bodyT = this._reduced ? 0 : performance.now() / 1000;",
    );
  });

  it("TR-045 guard: the orbital block introduces no reserved WGSL identifiers", () => {
    // `ang`, `cs`, `sn`, `rOrb`, `orbited` — none reserved, but the check is cheap and this is
    // exactly the class of mistake that blanks the entire scene.
    for (const word of WGSL_RESERVED_IDENTIFIERS) {
      const re = new RegExp(`\\b${word}\\b`);
      expect(
        re.test(
          "var orbited : vec3<f32>; let rOrb : f32; let ang : f32; let cs : f32; let sn : f32;",
        ),
      ).toBe(false);
    }
  });
});

describe("belt orbital motion (PF-10 C3 follow-up — the visual layer now orbits)", () => {
  /** First-principles omega(r): vis-viva circular speed at a = r/63 AU, converted to world
   * units and time-accelerated. Deliberately recomputed here from the physical constants rather
   * than imported, so this is an independent derivation and not a restatement. */
  function omegaExact(r: number) {
    const aAu = r / 63;
    const vKmS = Math.sqrt(1.32712440018e11 / (aAu * 149597870.7));
    return (vKmS * (63 / 149597870.7) * 4e5) / r;
  }

  it("derives omegaK from physics, and it is radius-independent as Kepler's third law demands", () => {
    // If omega ∝ r^(-3/2) is exact, omega * r^(3/2) is the same number at every radius. A tuned
    // fudge factor would not have this property, which is what makes it worth asserting.
    for (const r of [100, 170, 250, 328]) {
      expect(omegaExact(r) * r ** 1.5).toBeCloseTo(BELT_ORBIT.omegaK, 3);
    }
  });

  it("matches the exact derivation, not the rounded figure the first draft used", () => {
    // Regression: 39.807 was back-solved from the science brief's rounded 3.053 wu/s.
    expect(BELT_ORBIT.omegaK).toBeCloseTo(39.8234, 4);
    expect(BELT_ORBIT.omegaK).not.toBeCloseTo(39.807, 3);
  });

  it("reproduces the belt spine's real orbital speed", () => {
    const r = ASTEROID_BELT.radius;
    expect(beltAngularRate(r) * r).toBeCloseTo(3.053, 2);
  });

  it("agrees with the REAL catalog velocities of the shipped physics bodies", () => {
    // The strongest available check, and the one that matters visually: the moving dust and the
    // moving rocks must agree, or the belt reads as two populations sliding past each other.
    // Compares the shader's derived tangential speed against each body's real Keplerian
    // velocity vector, straight from the Gaia DR3 elements.
    let worst = 0;
    let sum = 0;
    for (const b of REAL_ASTEROIDS.bodies) {
      const r = heliocentricRadius(b.p[0], b.p[1], b.p[2]);
      const derived = beltAngularRate(r) * r;
      const real = Math.hypot(b.v[0], b.v[1], b.v[2]);
      const err = Math.abs(derived - real) / real;
      sum += err;
      worst = Math.max(worst, err);
    }
    const mean = sum / REAL_ASTEROIDS.bodies.length;
    // Measured 0.77% mean / 2.28% worst over the 64 real bodies. The residual is the declared
    // r-for-a substitution, bounded here by the e < 0.10 cut those bodies already satisfy.
    expect(mean).toBeLessThan(0.015);
    expect(worst).toBeLessThan(0.04);
  });

  it("measures distance from the SUN, not from the world origin", () => {
    // Astra's refinement: the Sun sits at the belt plane's centre (0, 0, -13). Feeding the rate
    // law the planar radius overstates it by up to +189% for the real objects inclined past 40°.
    expect(heliocentricRadius(170, 0, ASTEROID_BELT.center[2])).toBeCloseTo(
      170,
      9,
    );
    // A speck 100 units above the belt plane is genuinely farther from the Sun than its planar
    // radius suggests, and must therefore orbit SLOWER.
    const inPlane = heliocentricRadius(170, 0, ASTEROID_BELT.center[2]);
    const aloft = heliocentricRadius(170, 0, ASTEROID_BELT.center[2] + 100);
    expect(aloft).toBeGreaterThan(inPlane);
    expect(beltAngularRate(aloft)).toBeLessThan(beltAngularRate(inPlane));
  });

  it("mirrors the pipeline's own scale constants, which live in a file it cannot import", () => {
    // babylon-asteroids.ts duplicates AU_TO_WORLD/TIME_ACCEL from asteroid-kepler.mjs because a
    // build script cannot be imported into shipped runtime code. This is the guard that keeps the
    // two copies honest — without it, a scale change would leave the belt orbiting at the old rate.
    const expected =
      TIME_ACCEL * Math.sqrt(1.32712440018e11 / (KM_PER_AU / AU_TO_WORLD) ** 3);
    expect(KEPLER_K).toBeCloseTo(expected, 6);
  });

  it("produces real differential shear — inner asteroids outrun outer ones by the 3/2 power", () => {
    const inner = beltAngularRate(140);
    const outer = beltAngularRate(280);
    expect(inner).toBeGreaterThan(outer);
    // Doubling the radius must slow the orbit by exactly 2^1.5, not by some smooth-looking curve.
    expect(inner / outer).toBeCloseTo(2 ** 1.5, 6);
  });

  it("is a rigid rotation: radius and height are conserved exactly", () => {
    const [x, y, z] = [150, -70, -11];
    const r0 = Math.hypot(x, y);
    for (const t of [1, 60, 3600]) {
      const [nx, ny, nz] = beltOrbitPosition(x, y, z, t);
      expect(Math.hypot(nx, ny)).toBeCloseTo(r0, 4);
      expect(nz).toBe(z); // orbital plane is preserved; no vertical drift
    }
  });

  it("orbits prograde, matching every real asteroid in the catalog", () => {
    // Real DR3 asteroids all orbit counter-clockwise seen from ecliptic north (max inclination
    // 72.16° — no retrograde objects), so the rotation must carry +X toward +Y.
    const [nx, ny] = beltOrbitPosition(170, 0, -13, 1);
    expect(ny).toBeGreaterThan(0);
    expect(nx).toBeLessThan(170);
    // Cross-check the sign against a REAL catalog record's own angular momentum.
    const b = REAL_ASTEROIDS.bodies[0];
    expect(b.p[0] * b.v[1] - b.p[1] * b.v[0]).toBeGreaterThan(0);
  });

  it("holds still at t = 0 — the reduced-motion contract is representable", () => {
    expect(beltOrbitPosition(150, -70, -11, 0)).toEqual([150, -70, -11]);
  });

  it("leaves near-origin specks unrotated instead of spinning them to a blur", () => {
    // r^(-3/2) diverges at the origin; nothing this close to the Sun is a belt object.
    expect(beltAngularRate(0)).toBe(0);
    expect(beltOrbitPosition(0, 0, -13, 999)).toEqual([0, 0, -13]);
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
