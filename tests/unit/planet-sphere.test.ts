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
  CLOUD_QUAD_DEFICIT,
  ELEV_SAMPLE_STEP,
  NEVER_SPHERE,
  OCEAN_F0,
  OCEAN_SIGMA2,
  PLANET_LUNAR_L,
  RAYLEIGH_TAU_RGB,
  ROTATION_PERIOD_S,
  PLANET_FRAGMENT_GLSL,
  PLANET_FRAGMENT_WGSL,
  PLANET_VERTEX_GLSL,
  PLANET_VERTEX_WGSL,
  PLANET_ALBEDO,
  PLANET_ELEV_SCALE,
  PLANET_PHYSICAL,
  PLANET_SPHERE_RADIUS,
  SPHERE_SEGMENTS,
  SUN_FLAT_LEVEL,
  SUN_FLAT_TINT_RGB,
  TERMINATOR_SOFTEN,
  UV_LONGITUDE_OFFSET,
  reliefFraction,
  sphereIdFor,
  sunDirectionFrom,
  tangentFrame,
  PLANET_SURGE,
  exposureTermsFor,
  homeOrbitPosition,
  HOME_ORBIT_RADIUS,
  HOME_ORBIT_PERIOD_S,
  HOME_VANTAGE_RA_DEG,
  HOME_VANTAGE_DEC_DEG,
  SUN_RA_DEG,
  SUN_DEC_DEG,
} from "@/lib/planet-sphere";
import {
  ARRIVE_STANDOFF,
  PLANET_ARRIVE_STANDOFF,
  PLANET_SPHERE_RADIUS_FOR_ZOOM,
} from "@/lib/ship-dynamics";
import { QUALITY_BUDGETS } from "@/lib/babylon-tiers";
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

  it("ships the pre-baked relief path in BOTH twins (PF-10 C4 closeout)", () => {
    // Nine bodies carry a NORMAL map rather than a height map. The twins must agree on the
    // decode, the tangent-frame rotation and the gate, or the nine bodies look right on one
    // backend and wrong on the other — with no compiler to notice.
    expect(src).toContain(
      "vec3 nrm = texture2D(normalTex, tUV).rgb * 2.0 - 1.0;",
    );
    expect(src).toContain(
      "textureSample(normalTex, normalTexSampler, tUV).rgb * 2.0 - 1.0;",
    );
    expect(src).toContain(
      "vec3 nrmWorld = normalize(east * nrm.x + north * nrm.y + N * max(nrm.z, 0.05));",
    );
    expect(src).toContain(
      "normalize(east * nrm.x + north * nrm.y + N * max(nrm.z, 0.05));",
    );
    expect(src).toContain("mix(perturbed, nrmWorld, uHasNormal)");
    expect(src).toContain("mix(perturbed, nrmWorld, uniforms.uHasNormal)");
  });

  it("takes the normal sample UNCONDITIONALLY too (TR-047)", () => {
    // Same rule as the height samples: a branch around textureSample is rejected on WebGPU and
    // accepted on WebGL2. The gate is the mix() factor, never an `if`.
    expect(src).not.toMatch(/if\s*\([^)]*uHasNormal[^)]*\)\s*\{/);
  });

  it("declares normalTex in both twins", () => {
    expect(src).toContain("uniform sampler2D normalTex;");
    expect(src).toContain("var normalTex : texture_2d<f32>;");
    expect(src).toContain("var normalTexSampler : sampler;");
  });

  it("ships all three Earth terms in BOTH twins", () => {
    // Ocean glint (Cox-Munk), Rayleigh+aerosol, and the cloud composite. Each has a named
    // mechanism and each is mandatory per Astra's brief — omitting the Rayleigh term in
    // particular is BROKEN PHYSICS, not a simplification, because 74-87% of Earth's ocean colour
    // from space is scattered air.
    for (const frag of [PLANET_FRAGMENT_GLSL, PLANET_FRAGMENT_WGSL]) {
      expect(frag).toContain("OCEAN_SIGMA2");
      expect(frag).toContain("OCEAN_F0");
      expect(frag).toContain("RAYLEIGH_TAU");
      expect(frag).toContain("AEROSOL_TAU");
      expect(frag).toContain("CLOUD_L");
      // The divergence guards Astra called out explicitly — the single-scattering forms blow up
      // at the terminator, where they are invalid anyway.
      expect(frag).toContain("max(mu0 * mu, 0.02)");
      expect(frag).toContain("max(mu * mu0, 0.05)");
    }
  });

  it("keeps the glint tied to the real mirror condition, never an always-on sheen", () => {
    // Astra's broken-physics #10: a rim-lit shiny ocean is a familiar, attractive game-art look
    // and is decoration wearing physics' clothes. The glint must derive from H = normalize(L + V).
    expect(src).toContain("vec3 Hv = normalize(normalize(uSunDir) + viewDir);");
    expect(src).toContain(
      "let Hv : vec3<f32> = normalize(normalize(uniforms.uSunDir) + viewDir);",
    );
  });

  it("bakes Astra's real Earth constants, not round numbers", () => {
    // Every one of these is a cited measurement; a "tidied" value is a silent physics change.
    expect(RAYLEIGH_TAU_RGB).toEqual([0.0491, 0.0973, 0.2211]); // Bodhaine 1999, lambda^-4.09
    expect(OCEAN_SIGMA2).toBeCloseTo(0.003 + 0.00512 * 7.0, 5); // Cox-Munk at 7.0 m/s
    expect(OCEAN_F0).toBeCloseTo(((1.339 - 1) / (1.339 + 1)) ** 2, 5); // seawater n=1.339
    // Blue must scatter hardest — the entire reason Earth's ocean reads blue from orbit.
    expect(RAYLEIGH_TAU_RGB[2]).toBeGreaterThan(RAYLEIGH_TAU_RGB[0] * 4);
  });

  it("gives Earth the CLEAR-SKY albedo, not its famous composite geometric albedo", () => {
    // Astra's broken-physics #6, and the subtlest one: 0.434 is the correct, citable NASA
    // geometric albedo — and it is the right number in the wrong place, because it already
    // includes the clouds this renderer draws as a second layer. Using it double-counts them.
    expect(PLANET_ALBEDO.earth).toBeCloseTo(0.213, 3);
    expect(PLANET_ALBEDO.earth).not.toBeCloseTo(0.434, 2);
    // Pure Lambert: Lommel-Seeliger models shadow hiding in regolith, and an ocean has none.
    expect(PLANET_LUNAR_L.earth).toBe(0);
  });

  it("keeps the icy satellites' real albedos above 1 rather than clamping them", () => {
    // These exceed 1 because the inner Saturnian moons genuinely beat a Lambertian disc at zero
    // phase (E-ring resurfacing + coherent-backscatter opposition surge). Clamping would flatten
    // the most distinctive true fact about them: they are conspicuously brighter than the Moon
    // sitting beside them in the same scene.
    expect(PLANET_ALBEDO.tethys).toBeGreaterThan(1);
    expect(PLANET_ALBEDO.dione).toBeCloseTo(0.998, 3);
    expect(PLANET_ALBEDO.rhea).toBeCloseTo(0.949, 3);
    // Airless regolith, exactly like the Moon and Mercury. The 0.55 fallback they would
    // otherwise get is MARS's coefficient, and Mars has an atmosphere — Astra calls that
    // broken physics rather than imprecision.
    for (const id of ["dione", "rhea", "tethys"])
      expect(PLANET_LUNAR_L[id], id).toBe(1.0);
  });

  it("keeps each tidally-locked period consistent with the days it cites", () => {
    // REGRESSION: dione was first entered as 236429 s against the 2.736915 d its own comment
    // cited — a 40.5 s slip. Caught by checking a number against its stated source rather than
    // against a second source, which is the cheaper habit and the one that found it.
    const DAY = 86400;
    for (const [id, days] of [
      ["dione", 2.736915],
      ["rhea", 4.518212],
      ["tethys", 1.887802],
    ] as const)
      expect(ROTATION_PERIOD_S[id], id).toBeCloseTo(days * DAY, 0);
    // Earth is sidereal, not the 86400 s solar day — a 0.273% difference that is deliberate.
    expect(ROTATION_PERIOD_S.earth).toBeCloseTo(86164.0905, 3);
    expect(ROTATION_PERIOD_S.earth).not.toBe(86400);
  });

  it("uses no BACKTICK inside either shader source (TR-078 Part 5's trap)", () => {
    // The shader twins are template literals. A backtick in a comment inside them terminates the
    // literal and turns the rest of the shader into TypeScript — which is exactly what happened
    // while writing the block above, caught by typecheck. Prose in these strings must use plain
    // words, not code quoting.
    for (const [name, shader] of [
      ["GLSL vertex", PLANET_VERTEX_GLSL],
      ["GLSL fragment", PLANET_FRAGMENT_GLSL],
      ["WGSL vertex", PLANET_VERTEX_WGSL],
      ["WGSL fragment", PLANET_FRAGMENT_WGSL],
    ] as const)
      expect(shader.includes("`"), `${name} contains a backtick`).toBe(false);
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

/* ---------------------------------------------------------------------------------------------
 * PF-11 D6.1 / D6.3 — exposure: surge relocation, Reinhard, sRGB decode, self-shadow, tiers.
 * ------------------------------------------------------------------------------------------- */

describe("PF-11 D6.1 opposition surge relocation", () => {
  it("reconstructs each body's real GEOMETRIC albedo exactly at zero phase", () => {
    // THE assertion of this slice. base * surge(0) == base * (1 + B0) must equal the published
    // geometric albedo, or the surge has been re-graded rather than relocated. Astra's own
    // construction is B0 = p/A_B - 1, so this identity is what makes the change lossless at the
    // one geometry where a geometric albedo is defined at all.
    const published: Record<string, number> = {
      tethys: 1.229,
      dione: 0.998,
      rhea: 0.949,
      moon: 0.136,
    };
    for (const [id, p] of Object.entries(published)) {
      const { base, b0 } = PLANET_SURGE[id];
      expect(base * (1 + b0), `${id} zero-phase reconstruction`).toBeCloseTo(
        p,
        2,
      );
    }
  });

  it("every surge base is energy-bounded (< 1), which the geometric albedos were not", () => {
    // The whole reason the surge had to move: three published geometric albedos exceed 1, which
    // no [0,1] display can show and no energy-conserving BRDF should apply disc-wide.
    for (const [id, s] of Object.entries(PLANET_SURGE))
      expect(s.base, `${id} base albedo`).toBeLessThan(1);
  });

  it("leaves Mars out — its surge coefficient would be NEGATIVE", () => {
    // Astra, explicitly: Mars's dusty forward-scattering atmosphere makes A_B (0.25) exceed
    // p (0.17), so B0 = p/A_B - 1 < 0. Adding Mars here would DARKEN it at opposition, the
    // opposite of what a surge does. "Leave Mars alone."
    expect(PLANET_SURGE.mars).toBeUndefined();
    expect(exposureTermsFor("mars", 0.17)).toEqual({
      baseAlbedo: 0.17,
      surgeB0: 0,
    });
  });

  it("passes non-surge bodies through unchanged, so nothing about them moves", () => {
    expect(exposureTermsFor("europa", 0.67)).toEqual({
      baseAlbedo: 0.67,
      surgeB0: 0,
    });
    expect(exposureTermsFor("no-such-body", 0.3)).toEqual({
      baseAlbedo: 0.3,
      surgeB0: 0,
    });
  });

  it("splits a surge body into base + coefficient rather than its geometric albedo", () => {
    expect(exposureTermsFor("tethys", 1.229)).toEqual({
      baseAlbedo: 0.8,
      surgeB0: 0.536,
    });
  });
});

describe("PF-11 D6.1/D6.3 shader twins carry the exposure pipeline", () => {
  const twins = [
    ["GLSL", PLANET_FRAGMENT_GLSL],
    ["WGSL", PLANET_FRAGMENT_WGSL],
  ] as const;

  it("decodes the surface sampler to linear in BOTH twins (CLAUDE.md #10)", () => {
    for (const [name, src] of twins)
      expect(src, `${name} decodes surfaceTex`).toMatch(
        /srgbToLinear\(\s*texture/,
      );
  });

  it("does NOT decode the coverage/vector samplers in either twin", () => {
    // These exclusions are load-bearing, not omissions: cloudTex and specularTex are coverage
    // fractions (Astra validated the cloud map's RAW byte against Earth's real geometric albedo),
    // and heightTex/normalTex/detailTex carry elevation and vectors. Decoding any of them would
    // corrupt data that was never a colour.
    const notColour = [
      "cloudTex",
      "specularTex",
      "heightTex",
      "normalTex",
      "detailTex",
    ];
    for (const [name, src] of twins)
      for (const sampler of notColour)
        expect(
          new RegExp(`srgbToLinear\\([^)]*${sampler}`).test(src),
          `${name} must not decode ${sampler}`,
        ).toBe(false);
  });

  it("tone-maps with Reinhard and encodes once, in that order, in BOTH twins", () => {
    for (const [name, src] of twins) {
      const reinhard = src.indexOf("(1.0 + outLin)");
      const encode = src.indexOf("linearToSrgb(outLin)");
      expect(reinhard, `${name} applies Reinhard`).toBeGreaterThan(-1);
      expect(encode, `${name} encodes to sRGB`).toBeGreaterThan(-1);
      expect(encode, `${name} encodes AFTER tone mapping`).toBeGreaterThan(
        reinhard,
      );
    }
  });

  it("applies the surge to refl, not to the albedo, in BOTH twins", () => {
    for (const [name, src] of twins) {
      expect(src, `${name} computes a phase angle`).toContain("alphaDeg");
      expect(src, `${name} folds the surge into refl`).toContain("uSurgeB0");
    }
  });

  it("gates relief self-shadowing on a body actually shipping relief, in BOTH twins", () => {
    for (const [name, src] of twins)
      expect(src, `${name} gates self-shadow on reliefAmt`).toMatch(
        /reliefAmt[\s\S]{0,240}SELF_SHADOW_ELEV/,
      );
  });

  it("uses the named exposure constants rather than the old 3.6 literal", () => {
    for (const [name, src] of twins) {
      expect(src, `${name} still contains a bare 3.6 gain`).not.toContain(
        "* 3.6",
      );
      expect(src, `${name} uses EXPOSURE`).toContain("EXPOSURE");
    }
  });

  it("keeps every identifier this slice introduced off the reserved WGSL list (#5)", () => {
    // TR-045: a reserved WGSL identifier blanks the ENTIRE scene with no compiler error to point
    // at. Checked rather than eyeballed.
    // WGSL_RESERVED_IDENTIFIERS is a narrow literal tuple, so widen it here rather than at its
    // definition — the narrow type is what makes the reserved list self-documenting elsewhere.
    const reserved: readonly string[] = WGSL_RESERVED_IDENTIFIERS;
    for (const id of [
      "srgbToLinear",
      "linearToSrgb",
      "outLin",
      "alphaDeg",
      "cosAlpha",
      "reliefAmt",
      "uSurgeB0",
    ])
      expect(reserved.includes(id), `${id} is reserved`).toBe(false);
  });
});

describe("PF-11 D6.3.2 tier-aware planet texture ladder", () => {
  it("gives every tier a ladder ceiling, with lite finally consuming the base tier", () => {
    expect(QUALITY_BUDGETS.lite.planetTexture).toBe("base");
    expect(QUALITY_BUDGETS.balanced.planetTexture).toBe("high");
    expect(QUALITY_BUDGETS.full.planetTexture).toBe("ultra-progressive");
  });

  it("only the top tier fetches ultra at all — the 4-6 MB upgrade was unconditional before", () => {
    const fetchesUltra = (t: "lite" | "balanced" | "full") =>
      QUALITY_BUDGETS[t].planetTexture === "ultra-progressive";
    expect(fetchesUltra("lite")).toBe(false);
    expect(fetchesUltra("balanced")).toBe(false);
    expect(fetchesUltra("full")).toBe(true);
  });
});

describe("PF-11 D6.4 the home vantage and its orbit", () => {
  const d2r = Math.PI / 180;
  const dir = (ra: number, dec: number): [number, number, number] => [
    Math.cos(dec * d2r) * Math.cos(ra * d2r),
    Math.cos(dec * d2r) * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
  const sun = dir(SUN_RA_DEG, SUN_DEC_DEG);
  const phaseDegAt = (p: [number, number, number]) => {
    const r = Math.hypot(...p);
    const d = (p[0] * sun[0] + p[1] * sun[1] + p[2] * sun[2]) / r;
    return (Math.acos(Math.max(-1, Math.min(1, d))) * 180) / Math.PI;
  };

  it("parks at exactly 90° phase — the number the whole reveal rests on", () => {
    // Every travelTo arrival is pinned to 0.000° phase (V = L, forced), which is why no other
    // body in this scene can show a terminator. This is the one vantage that escapes it, and the
    // escape is worth nothing if the number is wrong — so it is computed from the Sun's own
    // catalog entry rather than quoted.
    expect(phaseDegAt(homeOrbitPosition(0))).toBeCloseTo(90, 4);
  });

  it("HOLDS 90° all the way around the orbit — the invariant, not just the start", () => {
    // This is why the orbit axis is the Sun direction rather than anything more obvious. Orbiting
    // about any other axis would sweep the lighting through full and new phases and lose the
    // terminator, the twilight band and the city lights partway round.
    for (let i = 0; i < 24; i++) {
      const phase = (i / 24) * 2 * Math.PI;
      expect(phaseDegAt(homeOrbitPosition(phase)), `phase ${i}/24`).toBeCloseTo(
        90,
        4,
      );
    }
  });

  it("keeps the standoff constant and equal to every other arrival's", () => {
    // The sphere must read at the same size at home as everywhere else — nothing about the home
    // framing is special-cased.
    for (let i = 0; i < 8; i++) {
      const p = homeOrbitPosition((i / 8) * 2 * Math.PI);
      expect(Math.hypot(...p)).toBeCloseTo(HOME_ORBIT_RADIUS, 6);
    }
    expect(HOME_ORBIT_RADIUS).toBe(ARRIVE_STANDOFF);
  });

  it("TR-103: ship-dynamics.ts's duplicated PLANET_SPHERE_RADIUS_FOR_ZOOM agrees with this module's own PLANET_SPHERE_RADIUS", () => {
    // Same reasoning as HOME_ORBIT_RADIUS above — kept as a literal in ship-dynamics.ts
    // to stay import-free/pure, so a live test is what actually enforces agreement.
    expect(PLANET_SPHERE_RADIUS_FOR_ZOOM).toBe(PLANET_SPHERE_RADIUS);
  });

  it("TR-103: the new planet-class arrival standoff clears the old one and subtends roughly half the base FOV", () => {
    expect(PLANET_ARRIVE_STANDOFF).toBeGreaterThan(ARRIVE_STANDOFF);
    const angularDiameterDeg =
      (2 * Math.asin(PLANET_SPHERE_RADIUS / PLANET_ARRIVE_STANDOFF) * 180) /
      Math.PI;
    // 70° base FOV (SHIP_BASE_FOV) — the reveal target is roughly half of it, with
    // generous tolerance since this is a design choice, not a derived invariant.
    expect(angularDiameterDeg).toBeGreaterThan(25);
    expect(angularDiameterDeg).toBeLessThan(50);
  });

  it("starts at the spec'd ra 160 / dec 0 bearing, so reduced motion parks on-spec", () => {
    // Reduced motion freezes the phase at 0, so phase 0 has to BE the specified vantage rather
    // than an arbitrary point on the circle.
    const p = homeOrbitPosition(0);
    const want = dir(HOME_VANTAGE_RA_DEG, HOME_VANTAGE_DEC_DEG).map(
      (c) => c * HOME_ORBIT_RADIUS,
    );
    for (let i = 0; i < 3; i++) expect(p[i]).toBeCloseTo(want[i], 6);
    // Astra's brief computes this vantage explicitly as (−35.708, 12.997, 0.000).
    expect(p[0]).toBeCloseTo(-35.708, 2);
    expect(p[1]).toBeCloseTo(12.997, 2);
    expect(p[2]).toBeCloseTo(0, 6);
  });

  it("declares the orbit period, and it is a compression rather than a real LEO period", () => {
    // Recorded as a license: a real 400 km orbit is 92.7 min. If this ever silently became
    // "realistic" the home view would be effectively static.
    expect(HOME_ORBIT_PERIOD_S).toBe(180);
    expect(HOME_ORBIT_PERIOD_S).toBeLessThan(92.7 * 60);
  });
});

describe("PF-11 D6.4 city lights", () => {
  const twins = [
    ["GLSL", PLANET_FRAGMENT_GLSL],
    ["WGSL", PLANET_FRAGMENT_WGSL],
  ] as const;

  it("masks the lights on the TRUE N·L in both twins, never on a proxy", () => {
    // Astra's broken-physics #1 is showing city lights where the Sun can actually reach. The mask
    // must be the exact complement of the term that lights the day side — anything else (a body
    // flag, a camera-facing term, an unconditional composite) is the failure mode.
    for (const [name, src] of twins)
      expect(src, `${name} masks night on (1 - dayside)`).toContain(
        "(1.0 - dayside)",
      );
  });

  it("subtracts the floor BEFORE applying the gain, in both twins", () => {
    // Without the subtraction the map's non-zero background is lifted ~14 stops along with the
    // cities and the night side washes uniformly grey.
    for (const [name, src] of twins)
      expect(src, `${name} floor-subtracts`).toMatch(
        /max\([\s\S]{0,120}NIGHT_FLOOR[\s\S]{0,60}\)/,
      );
  });

  it("composites the lights BEFORE the tone map in both twins", () => {
    // Added after Reinhard they are additive in display space and clip to flat white blobs with
    // no structure. This ordering is why D6.4 had to follow D6.1 rather than precede it.
    for (const [name, src] of twins) {
      const night = src.indexOf("NIGHT_GAIN");
      const tone = src.indexOf("(1.0 + outLin)");
      expect(night, `${name} has the night term`).toBeGreaterThan(-1);
      expect(night, `${name} composites before tone mapping`).toBeLessThan(
        tone,
      );
    }
  });

  it("does NOT sRGB-decode the night map — measured, not assumed", () => {
    // In linear space the 0.06 floor sits above the map's 99.9th percentile and erases it. The
    // floor/gain pair is a declared emissive composite calibrated in the authored space.
    for (const [name, src] of twins)
      expect(
        /srgbToLinear\([^)]*nightTex/.test(src),
        `${name} must not decode nightTex`,
      ).toBe(false);
  });

  it("gates on uHasNight so no other body inherits Earth's cities", () => {
    for (const [name, src] of twins)
      expect(src, `${name} gates on uHasNight`).toContain("uHasNight");
  });
});

describe("PF-11 D1.3 closeout — cloud quadrature deficit (α = 90° photometry)", () => {
  it("pins the solved constant against the Mallama-curve calibration", () => {
    // SOLVED, not tuned (scripts/solve-earth-quadrature.mjs, Earth brief Addendum 3): the
    // shipped composite integrated to Φ(90°) = 0.354 against Earth's measured 0.236 — ×1.50
    // too bright at the only phase Earth is ever shown. 0.539 lands it on the measured curve
    // exactly. A "tidied" value here is a silent photometry change.
    expect(CLOUD_QUAD_DEFICIT).toBe(0.539);
  });

  it("applies the deficit to the cloud term in BOTH twins, clamped at 90°", () => {
    // Line-parallel per #4/#5. The min(α/90, 1) form guarantees factor = 1 at α = 0
    // analytically — every travelTo arrival (all at 0.000°) and Venus are bit-identical;
    // only the goHome reveal / ascent geometry (α = 90) changes. The clamp also stops
    // anyone extrapolating this form past quadrature, where real crescent Earth shows
    // forward-scatter EXCESS instead.
    expect(PLANET_FRAGMENT_GLSL).toContain(
      "* (1.0 - CLOUD_QUAD_DEFICIT * min(alphaDeg / 90.0, 1.0));",
    );
    expect(PLANET_FRAGMENT_WGSL).toContain(
      "* (1.0 - CLOUD_QUAD_DEFICIT * min(alphaDeg / 90.0, 1.0));",
    );
    // And both const blocks carry the same baked value.
    expect(PLANET_FRAGMENT_GLSL).toContain(
      "const float CLOUD_QUAD_DEFICIT = 0.539;",
    );
    expect(PLANET_FRAGMENT_WGSL).toContain(
      "const CLOUD_QUAD_DEFICIT : f32 = 0.539;",
    );
  });

  it("Earth's surface constants stand — the α = 90 fix lands on the cloud term only", () => {
    // Astra's verdicts (Earth brief Addendum 3): L = 0 is mechanism-correct at ALL phases
    // (no regolith on water or vegetated land) and 0.213's α = 0 anchor was independently
    // corroborated. The quadrature deficit belongs to Mie forward scattering, which is a
    // CLOUD property. Moving either surface constant to "fix" brightness would be the wrong
    // knob wearing the right units.
    expect(PLANET_LUNAR_L.earth).toBe(0.0);
    expect(PLANET_ALBEDO.earth).toBe(0.213);
  });
});

describe("PF-11 D6.3.4 per-body atmosphere flag", () => {
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "public/assets/planets/manifest.json"),
      "utf8",
    ),
  ) as { bodies: Record<string, { atmosphere?: boolean; cloud?: unknown }> };

  it("is declared on Earth and on nothing else", () => {
    // Narrow ON PURPOSE. The Rayleigh term carries Earth's sea-level optical depths, so Venus,
    // Titan, Mars, Jupiter and Saturn all have real atmospheres and none may set this flag until
    // it carries their own tau. A body appearing here is a physics decision, not a data tweak.
    const flagged = Object.entries(manifest.bodies)
      .filter(([, b]) => b.atmosphere)
      .map(([id]) => id);
    expect(flagged).toEqual(["earth"]);
  });

  it("is a real declaration rather than the old cloud-map proxy", () => {
    // The proxy and the flag agree today, which is precisely why the proxy survived so long. This
    // asserts the flag exists INDEPENDENTLY, so a future cloud-bearing body cannot silently
    // inherit Earth's atmosphere.
    expect(manifest.bodies.earth.atmosphere).toBe(true);
    expect(manifest.bodies.earth.cloud).toBeTruthy();
  });
});

describe("PF-11 defect P2a — the Sun sphere", () => {
  // The Sun had a real catalog entry (celestial-catalog.js, t:"star") and real
  // sunDirectionFrom() geometry, but no shipped texture — it fell through to the 110px
  // procedural star beacon. These assertions pin the three things that make it a real sphere
  // without silently re-lighting it like a rocky body: it is eligible for one (not
  // NEVER_SPHERE), it has real imagery (manifest, surface-only like Venus/Jupiter/Saturn), and
  // it engages the SAME flat-shadowless-illuminant fork Venus proved out — which the shader
  // twins show fully DISCARDS the Lunar-Lambert reflectance / terminator / self-shadow chain
  // rather than merely dimming it.
  const manifest = JSON.parse(
    readFileSync(
      resolve(process.cwd(), "public/assets/planets/manifest.json"),
      "utf8",
    ),
  ) as {
    bodies: Record<
      string,
      { surface: unknown; height: unknown; normal?: unknown }
    >;
  };
  const engineSrc = readFileSync(
    resolve(process.cwd(), "src/lib/babylon-engine.ts"),
    "utf8",
  );

  it("is eligible for a sphere — confirmed absent from NEVER_SPHERE", () => {
    expect(NEVER_SPHERE.has("sun")).toBe(false);
  });

  it("ships real surface imagery, surface-only like the other flat-lit/no-relief bodies", () => {
    const sun = manifest.bodies.sun;
    expect(sun, "sun must have a manifest entry").toBeDefined();
    expect(sun.surface).toBeTruthy();
    expect(sun.height).toBeNull();
    expect(sun.normal ?? null).toBeNull();
  });

  it("declares a real, brightening flat-light level rather than the fork's neutral default", () => {
    // uFlatLevel's neutral/off value is 1 (see the material's boot-time default and the
    // non-venus/non-sun reset branch in _tickPlanetSphere) — a self-luminous star reading at
    // the SAME level as "the fork is off" would be indistinguishable from a bug that forgot to
    // set it. > 1 is the declared choice that makes it visibly bright post-Reinhard.
    expect(SUN_FLAT_LEVEL).toBeGreaterThan(1);
    expect(Number.isFinite(SUN_FLAT_LEVEL)).toBe(true);
    for (const c of SUN_FLAT_TINT_RGB) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(c).toBeLessThanOrEqual(1);
    }
  });

  it("_tickPlanetSphere sets uFlatLight=1 for the Sun, not the default lit-path 0", () => {
    // Pins the dispatch itself, in the pattern tests/unit/frame-ladder.test.ts already uses for
    // this same private method: the class can't be instantiated without a real GPU context, so
    // the dispatch is asserted as source text rather than by driving the engine.
    expect(engineSrc).toContain('if (key === "sun") {');
    const start = engineSrc.indexOf('if (key === "sun") {');
    const end = engineSrc.indexOf('} else if (key !== "venus") {', start);
    expect(
      end,
      "sun branch must be followed by the venus-reset else-if",
    ).toBeGreaterThan(start);
    const sunBranch = engineSrc.slice(start, end);
    expect(sunBranch).toContain('mat.setFloat("uFlatLight", 1);');
    expect(sunBranch).toContain('mat.setFloat("uFlatLevel", SUN_FLAT_LEVEL);');
    // And NOT the reflectance-path reset ("uFlatLight", 0) that every other non-Venus body gets.
    expect(sunBranch).not.toContain('mat.setFloat("uFlatLight", 0);');
  });

  it("the flat-light branch fully REPLACES lit, not blends a fraction of it in", () => {
    // mix(lit, flatLit, uFlatLight) with uFlatLight = 1 selects flatLit identically — this is
    // what makes it safe to engage on a body (the Sun) whose uSunDir is otherwise meaningless,
    // rather than merely reducing the reflectance term's influence.
    expect(PLANET_FRAGMENT_GLSL).toContain(
      "vec3 outLin = mix(lit, flatLit, uFlatLight);",
    );
    expect(PLANET_FRAGMENT_WGSL).toContain(
      "var outLin : vec3<f32> = mix(lit, flatLit, uniforms.uFlatLight);",
    );
  });

  it("flatLit itself never reads uSunDir, mu0, refl or the self-shadow term", () => {
    // The excluded-from-reflectance claim has to hold at the shader level, not just at the
    // dispatch level: even though _tickPlanetSphere still computes a real uSunDir for the Sun
    // (sunDirectionFrom is well-defined — the Sun sits at a real ra/dec, not the world origin),
    // flatLit must be structurally incapable of using it.
    for (const src of [PLANET_FRAGMENT_GLSL, PLANET_FRAGMENT_WGSL]) {
      const flatLitLine = src
        .split("\n")
        .find((l) => l.includes("flatLit") && l.includes("="))!;
      expect(flatLitLine, "flatLit assignment must exist").toBeTruthy();
      for (const forbidden of ["uSunDir", "mu0", "refl", "SELF_SHADOW"])
        expect(flatLitLine, `${forbidden} leaked into flatLit`).not.toContain(
          forbidden,
        );
    }
  });
});
