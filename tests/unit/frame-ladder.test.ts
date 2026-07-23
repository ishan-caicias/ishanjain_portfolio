/**
 * PF-11 D2 — the frame ladder (sky honesty by destination).
 *
 * Three kinds of proof, deliberately kept separate:
 *
 *  1. The pure fade SCHEDULERS (ship-dynamics.ts) against Astra's brief numbers —
 *     furniture gone by ~0.1 ly, the local galaxy binary at the extragalactic
 *     threshold, and the front-loaded-out / back-loaded-in warp schedule.
 *  2. The procedural impostor PIXEL (milky-way.ts) — a disc, not a quad: bright
 *     core, transparent rim, transparent outside the ellipse.
 *  3. The SHADER SOURCE STRINGS — no compiler cross-checks the GLSL/WGSL twins,
 *     so the `uLayerFade` multiply and the impostor sampler are pinned here, and
 *     the impostor WGSL is guarded against the reserved-identifier class that has
 *     blanked the whole scene before (TR-045).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  EXTRAGALACTIC_LY,
  FURNITURE_GONE_LY,
  frameLadderFade,
  furnitureVisibility,
  localFieldVisibility,
} from "../../src/lib/ship-dynamics";
import {
  buildMilkyWayImpostor,
  MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL,
  MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL,
  MILKY_WAY_IMPOSTOR_SIZE,
  MILKY_WAY_IMPOSTOR_VERTEX_GLSL,
  MILKY_WAY_IMPOSTOR_VERTEX_WGSL,
  milkyWayImpostorPixel,
} from "../../src/lib/milky-way";
import { WGSL_RESERVED_IDENTIFIERS } from "../../src/lib/nebula-field";

describe("furnitureVisibility (D2.1 — belt/glare by destination)", () => {
  it("is fully present across the solar system and gone at any star or DSO", () => {
    expect(furnitureVisibility(0)).toBe(1); // home
    expect(furnitureVisibility(2.4e-5)).toBe(1); // Mars (~1.5 AU)
    expect(furnitureVisibility(4.7e-4)).toBe(1); // Neptune (~30 AU)
    expect(furnitureVisibility(FURNITURE_GONE_LY)).toBe(0); // 0.1 ly
    expect(furnitureVisibility(8.6)).toBe(0); // Sirius
    expect(furnitureVisibility(1344)).toBe(0); // M42
  });

  it("decreases monotonically across the fade window", () => {
    let prev = furnitureVisibility(0);
    for (let ly = 0.001; ly <= 0.1; ly += 0.005) {
      const v = furnitureVisibility(ly);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
});

describe("localFieldVisibility (D2.2 — the extragalactic collapse)", () => {
  it("is 1 everywhere inside the galaxy and 0 at/above the extragalactic threshold", () => {
    expect(localFieldVisibility(0)).toBe(1);
    expect(localFieldVisibility(1344)).toBe(1); // M42, deep but still in-galaxy
    expect(localFieldVisibility(2400)).toBe(1); // the star field's linear reach
    expect(localFieldVisibility(EXTRAGALACTIC_LY)).toBe(0);
    expect(localFieldVisibility(17_938_580)).toBe(0); // nbg-a0554-07
  });
});

describe("frameLadderFade (the k-driven warp schedule)", () => {
  it("hits its endpoints exactly", () => {
    expect(frameLadderFade(1, 0, 0, false)).toBeCloseTo(1, 9);
    expect(frameLadderFade(1, 0, 1, false)).toBeCloseTo(0, 9);
    expect(frameLadderFade(0, 1, 0, false)).toBeCloseTo(0, 9);
    expect(frameLadderFade(0, 1, 1, false)).toBeCloseTo(1, 9);
  });

  it("fades a LEAVING layer out early (over the accel phase, before the flip)", () => {
    // Fully gone by k=0.35 — well before the k≈0.5 flip, so the belt has left
    // the frame by the time the ship turns.
    expect(frameLadderFade(1, 0, 0.35, false)).toBeCloseTo(0, 6);
    expect(frameLadderFade(1, 0, 0.2, false)).toBeLessThan(0.5);
  });

  it("fades a RETURNING layer in late (over the decel phase)", () => {
    // Still gone at k=0.6 (the fade-in hasn't started), full by k=1.
    expect(frameLadderFade(0, 1, 0.6, false)).toBeCloseTo(0, 6);
    expect(frameLadderFade(0, 1, 0.8, false)).toBeLessThan(1);
    expect(frameLadderFade(0, 1, 0.8, false)).toBeGreaterThan(0);
  });

  it("reduced motion holds the start and swaps only at arrival (no ramp)", () => {
    expect(frameLadderFade(1, 0, 0.0, true)).toBe(1);
    expect(frameLadderFade(1, 0, 0.5, true)).toBe(1);
    expect(frameLadderFade(1, 0, 0.99, true)).toBe(1);
    expect(frameLadderFade(1, 0, 1, true)).toBe(0);
  });
});

describe("milkyWayImpostorPixel (D2.2 — a disc, not a quad)", () => {
  const lum = ([r, g, b]: number[]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

  it("is transparent outside the inclined elliptical disc", () => {
    expect(milkyWayImpostorPixel(1.5, 0)).toEqual([0, 0, 0, 0]); // beyond major axis
    expect(milkyWayImpostorPixel(0, 0.9)).toEqual([0, 0, 0, 0]); // beyond the compressed minor axis
  });

  it("has a bright opaque core fading to a transparent rim", () => {
    const core = milkyWayImpostorPixel(0, 0);
    const mid = milkyWayImpostorPixel(0.5, 0);
    const rim = milkyWayImpostorPixel(0.95, 0);
    expect(lum(core)).toBeGreaterThan(lum(mid));
    expect(lum(mid)).toBeGreaterThan(lum(rim));
    expect(core[3]).toBe(255); // opaque core
    expect(core[3]).toBeGreaterThan(rim[3]); // feathered rim
  });

  it("builds a full RGBA buffer with an opaque centre and transparent corners", () => {
    const buf = buildMilkyWayImpostor(MILKY_WAY_IMPOSTOR_SIZE);
    expect(buf.length).toBe(
      MILKY_WAY_IMPOSTOR_SIZE * MILKY_WAY_IMPOSTOR_SIZE * 4,
    );
    const mid = MILKY_WAY_IMPOSTOR_SIZE / 2;
    const centreAlpha = buf[(mid * MILKY_WAY_IMPOSTOR_SIZE + mid) * 4 + 3];
    expect(centreAlpha).toBeGreaterThan(0);
    expect(buf[3]).toBe(0); // top-left corner is outside the disc → transparent
  });
});

describe("ijStar uLayerFade — the shared per-layer fade (both twins)", () => {
  const engineSrc = readFileSync(
    resolve(__dirname, "../../src/lib/babylon-engine.ts"),
    "utf8",
  );

  it("multiplies the star fragment alpha by uLayerFade in GLSL and WGSL", () => {
    expect(engineSrc).toContain("uniform float uLayerFade;");
    expect(engineSrc).toContain(
      "gl_FragColor = vec4(vColor, a*vAlpha*uLayerFade);",
    );
    expect(engineSrc).toContain("uniform uLayerFade : f32;");
    expect(engineSrc).toContain(
      "vec4<f32>(fragmentInputs.vColor, a * fragmentInputs.vAlpha * uniforms.uLayerFade);",
    );
  });

  it("registers uLayerFade in the star material's uniform list", () => {
    // Adjacent to uTime, so the belt orbital-clock test's pinned substring
    // ("uWarpDir",\n ... "uTime",) is left intact — see asteroid-dr3-belt.test.
    expect(engineSrc).toContain('"uTime",\n          "uLayerFade",');
  });
});

describe("impostor shader twins (D2.2)", () => {
  it("sample the disc texture and apply the fade in both GLSL and WGSL", () => {
    expect(MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL).toContain("texture2D(uTex, vUV)");
    expect(MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL).toContain("c.a * uFade");
    expect(MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL).toContain(
      "textureSample(uTex, uTexSampler, fragmentInputs.vUV)",
    );
    expect(MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL).toContain("c.a * uniforms.uFade");
  });

  it("carry no reserved WGSL identifier (TR-045 — a reserved id blanks the scene)", () => {
    const wgsl =
      MILKY_WAY_IMPOSTOR_VERTEX_WGSL + "\n" + MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL;
    for (const word of WGSL_RESERVED_IDENTIFIERS) {
      expect(
        new RegExp(`\\b${word}\\b`).test(wgsl),
        `${word} is reserved`,
      ).toBe(false);
    }
  });

  it("declares matching attributes across the vertex twins", () => {
    for (const src of [
      MILKY_WAY_IMPOSTOR_VERTEX_GLSL,
      MILKY_WAY_IMPOSTOR_VERTEX_WGSL,
    ]) {
      expect(src).toMatch(/position/);
      expect(src).toMatch(/uv/);
      expect(src).toMatch(/worldViewProjection/);
    }
  });
});
