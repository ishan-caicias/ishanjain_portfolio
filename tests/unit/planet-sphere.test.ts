/**
 * PF-10 C4 — real planetary spheres.
 *
 * The interesting assertions here are the ones that pin ASTRA'S CORRECTIONS, because each of them
 * replaced a plausible-looking first draft that would have shipped wrong:
 *   - exaggeration 12 -> 1.0 (exaggeration corrupts shading to buy an invisible limb)
 *   - Bond albedos -> geometric albedos
 *   - Lambertian -> Lunar-Lambert, which Astra classed as BROKEN PHYSICS for airless bodies
 * A regression on any of those is silent and invisible in a screenshot, which is exactly why they
 * are worth a test rather than a comment.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ELEV_SAMPLE_STEP,
  PLANET_ALBEDO,
  PLANET_ELEV_SCALE,
  PLANET_PHYSICAL,
  PLANET_SPHERE_RADIUS,
  SPHERE_SEGMENTS,
  TERMINATOR_SOFTEN,
  UV_LONGITUDE_OFFSET,
  reliefFraction,
  sphereIdFor,
  sunDirectionFrom,
  tangentFrame,
} from "@/lib/planet-sphere";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("real physical constants (Astra's brief is authoritative)", () => {
  it("keeps elevation at TRUE scale — exaggeration is not a style choice here", () => {
    // Regression: the first draft used 12. Astra measured that relief is invisible on the
    // silhouette anyway (Mars needs 2,260 px across before the limb bends one pixel) while
    // exaggeration corrupts shading across the whole disc. >= 3.0 is in lie territory.
    expect(PLANET_ELEV_SCALE).toBe(1);
    expect(PLANET_ELEV_SCALE).toBeLessThan(3);
  });

  it("uses GEOMETRIC albedos, not the Bond albedos the first draft had", () => {
    expect(PLANET_PHYSICAL.mars.albedo).toBeCloseTo(0.17, 3);
    expect(PLANET_PHYSICAL.moon.albedo).toBeCloseTo(0.136, 3);
    expect(PLANET_PHYSICAL.mercury.albedo).toBeCloseTo(0.142, 3);
    // The Bond values that were wrong, pinned so they cannot creep back.
    expect(PLANET_PHYSICAL.mars.albedo).not.toBeCloseTo(0.25, 2);
    expect(PLANET_PHYSICAL.moon.albedo).not.toBeCloseTo(0.12, 2);
  });

  it("treats airless bodies as backscattering and Mars as partly Lambertian", () => {
    // Pure Lommel-Seeliger for regolith; Mars's atmosphere pulls it toward Lambert.
    expect(PLANET_PHYSICAL.moon.lunarLambertL).toBe(1);
    expect(PLANET_PHYSICAL.mercury.lunarLambertL).toBe(1);
    expect(PLANET_PHYSICAL.mars.lunarLambertL).toBeCloseTo(0.55, 2);
  });

  it("carries real geometric albedos for the surface-only bodies too", () => {
    expect(PLANET_ALBEDO.europa).toBeCloseTo(0.67, 2); // bright ice
    expect(PLANET_ALBEDO.ceres).toBeCloseTo(0.09, 2); // very dark
    // Real ordering, not just real numbers: icy moons genuinely outshine carbonaceous bodies.
    expect(PLANET_ALBEDO.europa).toBeGreaterThan(PLANET_ALBEDO.ceres);
  });

  it("quantifies why exaggeration is tempting — relief really is a rounding error", () => {
    // Mars's total relief is ~0.9% of its radius; the Moon's ~1.1%. This is the number that
    // makes "just scale it up" feel reasonable, and the reason the brief had to bound it.
    expect(reliefFraction(PLANET_PHYSICAL.mars)).toBeCloseTo(0.0089, 3);
    expect(reliefFraction(PLANET_PHYSICAL.mars)).toBeLessThan(0.01);
    expect(reliefFraction(PLANET_PHYSICAL.moon)).toBeLessThan(0.02);
  });

  it("softens the terminator by a real, small amount", () => {
    // The Sun subtends 0.35 deg at Mars — a real penumbra, ~3 px on a 1000 px disc. Big enough
    // that a hard step reads as fake, small enough that a large value would be its own lie.
    expect(TERMINATOR_SOFTEN).toBeGreaterThan(0);
    expect(TERMINATOR_SOFTEN).toBeLessThan(0.02);
  });
});

describe("sunDirectionFrom", () => {
  it("points from the body back toward Sol at the world origin", () => {
    // Bodies are placed relative to Sol at the origin, so this is real geometry rather than a
    // lighting convenience — the lit hemisphere genuinely faces the Sun.
    // Component-wise: normalizing produces -0 for the zero components, which toEqual
    // distinguishes from 0 even though they are numerically identical.
    const a = sunDirectionFrom([10, 0, 0]);
    expect([a[0], a[1], a[2]]).toEqual([
      -1,
      expect.closeTo(0),
      expect.closeTo(0),
    ]);
    const b = sunDirectionFrom([0, -5, 0]);
    expect([b[0], b[1], b[2]]).toEqual([
      expect.closeTo(0),
      1,
      expect.closeTo(0),
    ]);
  });

  it("returns a unit vector for an arbitrary position", () => {
    const d = sunDirectionFrom([3, -4, 12]);
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
  });

  it("stays finite at the origin instead of dividing by zero", () => {
    const d = sunDirectionFrom([0, 0, 0]);
    expect(d.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...d)).toBeCloseTo(1, 9);
  });
});

describe("tangentFrame — the JS mirror of the shader's basis", () => {
  it("produces an orthonormal basis with the surface normal", () => {
    for (const n of [
      [1, 0, 0],
      [0.3, 0.5, -0.8],
      [-0.6, 0.1, 0.2],
    ] as const) {
      const len = Math.hypot(...n);
      const N = [n[0] / len, n[1] / len, n[2] / len] as const;
      const [east, north] = tangentFrame(n);
      const dot = (a: readonly number[], b: readonly number[]) =>
        a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      expect(Math.hypot(...east)).toBeCloseTo(1, 6);
      expect(Math.hypot(...north)).toBeCloseTo(1, 6);
      expect(dot(east, N)).toBeCloseTo(0, 6);
      expect(dot(north, N)).toBeCloseTo(0, 6);
      expect(dot(east, north)).toBeCloseTo(0, 6);
    }
  });

  it("stays finite at the poles, where the cross product degenerates", () => {
    // cross([0,1,0], [0,1,0]) is the zero vector — the shader and this mirror both fall back.
    for (const pole of [
      [0, 1, 0],
      [0, -1, 0],
    ] as const) {
      const [east, north] = tangentFrame(pole);
      expect(east.every(Number.isFinite)).toBe(true);
      expect(north.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...east)).toBeCloseTo(1, 6);
    }
  });
});

describe("sphereIdFor", () => {
  const manifest = { mars: {}, moon: {}, ceres: {} };

  it("matches a bare catalog id directly", () => {
    expect(sphereIdFor({ id: "mars" }, manifest)).toBe("mars");
  });

  it("strips a catalog prefix so minorplanet-ceres finds ceres", () => {
    expect(sphereIdFor({ id: "minorplanet-ceres" }, manifest)).toBe("ceres");
  });

  it("returns null for bodies with no real imagery, rather than guessing", () => {
    expect(sphereIdFor({ id: "m42" }, manifest)).toBeNull();
    expect(sphereIdFor({ id: "" }, manifest)).toBeNull();
  });
});

describe("shader twins (CLAUDE.md non-negotiable #4)", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/lib/planet-sphere.ts"),
    "utf8",
  );

  it("takes the height samples UNCONDITIONALLY in both twins (TR-047)", () => {
    // WGSL requires textureSample in uniform control flow. Wrapping these in `if (hasHeight)`
    // would compile on WebGL2 and be rejected on WebGPU — a twin divergence with no compiler to
    // catch it. The gate is a multiplication by uHasHeight instead, asserted below.
    expect(src).not.toMatch(/if\s*\([^)]*uHasHeight[^)]*\)\s*\{/);
    expect(src).toContain("* uElevScale * uHasHeight");
    expect(src).toContain("* uniforms.uElevScale * uniforms.uHasHeight");
  });

  it("ships the Lunar-Lambert reflectance in BOTH twins", () => {
    expect(src).toContain(
      "float refl = 2.0 * uLunarL * mu0 / max(mu0 + mu, 1e-4) + (1.0 - uLunarL) * mu0;",
    );
    expect(src).toContain("2.0 * uniforms.uLunarL * mu0 / max(mu0 + mu, 1e-4)");
  });

  it("applies the longitude origin correction in both twins", () => {
    expect(src).toContain("vec2 tUV = vec2(vUV.x + LON_OFFSET, vUV.y);");
    expect(src).toContain(
      "let tUV : vec2<f32> = vec2<f32>(fragmentInputs.vUV.x + LON_OFFSET, fragmentInputs.vUV.y);",
    );
    expect(UV_LONGITUDE_OFFSET).toBe(0.5);
  });

  it("bakes the same constants into both twins from the one TS source", () => {
    expect(src).toContain(
      "const float ELEV_STEP = ${ELEV_SAMPLE_STEP.toFixed(8)};",
    );
    expect(src).toContain(
      "const ELEV_STEP : f32 = ${ELEV_SAMPLE_STEP.toFixed(8)};",
    );
  });

  it("TR-045 guard: no reserved WGSL identifiers among the names this shader introduces", () => {
    for (const word of WGSL_RESERVED_IDENTIFIERS) {
      const re = new RegExp(`\\b${word}\\b`);
      expect(
        re.test(
          "tUV surface hL hR hD hU east north perturbed viewDir mu0 mu refl dayside lit",
        ),
      ).toBe(false);
    }
  });
});

describe("geometry budget", () => {
  it("tessellates enough for a smooth limb without being extravagant", () => {
    expect(SPHERE_SEGMENTS).toBe(64);
    expect(PLANET_SPHERE_RADIUS).toBeGreaterThan(0);
  });

  it("steps the height finite-difference by one texel of the shipped map", () => {
    // The shipped high tier is 4096x2048; the derivative must match its texel size or the
    // derived slopes are silently scaled wrong.
    expect(ELEV_SAMPLE_STEP).toBeCloseTo(1 / 2048, 8);
  });
});
