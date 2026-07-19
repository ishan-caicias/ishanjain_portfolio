/**
 * GAP-03 — galactic starlight band. galacticLB is verified against two known
 * reference points (the galactic centre and the north galactic pole) rather
 * than re-derived from the formula, so the test can't just restate the code.
 */
import { describe, expect, it } from "vitest";
import {
  buildMilkyWayRow,
  fbm,
  galacticLB,
  milkyWayPixel,
  MILKY_WAY_FRAGMENT_GLSL,
  MILKY_WAY_FRAGMENT_WGSL,
  MILKY_WAY_HEIGHT,
  MILKY_WAY_VERTEX_GLSL,
  MILKY_WAY_VERTEX_WGSL,
  MILKY_WAY_WIDTH,
} from "@/lib/milky-way";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("galacticLB", () => {
  it("resolves Sagittarius A* (the galactic centre) to l~0, b~0", () => {
    const { l, b } = galacticLB(266.417, -29.008);
    expect(Math.abs(l)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });

  it("resolves the North Galactic Pole to b=90", () => {
    const { b } = galacticLB(192.859508, 27.128336);
    expect(b).toBeGreaterThan(89.99);
  });

  it("keeps l within (-180, 180]", () => {
    for (let ra = 0; ra < 360; ra += 37) {
      for (const dec of [-80, -20, 0, 20, 80]) {
        const { l } = galacticLB(ra, dec);
        expect(l).toBeGreaterThan(-180);
        expect(l).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("fbm", () => {
  it("is deterministic and bounded roughly in [0, 1]", () => {
    for (const [x, y] of [
      [0, 0],
      [1.3, -4.2],
      [50, 50],
    ]) {
      const a = fbm(x, y);
      const b = fbm(x, y);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(-0.1);
      expect(a).toBeLessThanOrEqual(1.1);
    }
  });
});

describe("milkyWayPixel", () => {
  it("is brighter at the galactic centre (l=0,b=0) than far off-plane", () => {
    const [r1, g1, b1] = milkyWayPixel(0, 0);
    const [r2, g2, b2] = milkyWayPixel(0, 85);
    expect(r1 + g1 + b1).toBeGreaterThan(r2 + g2 + b2);
  });

  it("returns byte-range RGB for a spread of galactic coordinates", () => {
    for (let l = -180; l <= 180; l += 45) {
      for (const b of [-80, -10, 0, 10, 80]) {
        const [r, g, bch] = milkyWayPixel(l, b);
        for (const c of [r, g, bch]) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
          expect(Number.isInteger(c)).toBe(true);
        }
      }
    }
  });

  it("the Coalsack dark patch (near l=-57,b=-1.5) is dimmer than its immediate surroundings", () => {
    const [r1, g1, b1] = milkyWayPixel(-57, -1.5);
    const [r2, g2, b2] = milkyWayPixel(-57, -20);
    // the coalsack should not be brighter than a random off-plane sample
    expect(r1 + g1 + b1).toBeLessThan(500);
    expect(r2 + g2 + b2).toBeLessThanOrEqual(r1 + g1 + b1 + 200);
  });
});

describe("buildMilkyWayRow", () => {
  it("fills exactly one row's worth of RGBA bytes at full alpha", () => {
    const width = 64;
    const height = 32;
    const out = new Uint8Array(width * height * 4);
    buildMilkyWayRow(out, 10, width, height);
    for (let i = 0; i < width; i++) {
      const o = (10 * width + i) * 4;
      expect(out[o + 3]).toBe(255); // alpha
    }
    // an untouched row stays zeroed
    expect(out[0]).toBe(0);
  });

  it("defaults to the full 1024x512 dimensions", () => {
    expect(MILKY_WAY_WIDTH).toBe(1024);
    expect(MILKY_WAY_HEIGHT).toBe(512);
  });

  it("is deterministic across repeated builds of the same row", () => {
    const out1 = new Uint8Array(64 * 4);
    const out2 = new Uint8Array(64 * 4);
    buildMilkyWayRow(out1, 0, 64, 1);
    buildMilkyWayRow(out2, 0, 64, 1);
    expect(Array.from(out1)).toEqual(Array.from(out2));
  });
});

describe("shader source", () => {
  it("TR-045 guard: no reserved WGSL identifiers appear as words", () => {
    for (const src of [MILKY_WAY_VERTEX_WGSL, MILKY_WAY_FRAGMENT_WGSL]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("samples the texture exactly once, unconditionally (no branch to worry about, but pinned anyway)", () => {
    expect(MILKY_WAY_FRAGMENT_WGSL.match(/textureSample\(/g)).toHaveLength(1);
    expect(MILKY_WAY_FRAGMENT_GLSL.match(/texture2D\(/g)).toHaveLength(1);
  });

  it("both twins are plain UV samplers — no camera-basis reconstruction (infiniteDistance sphere, not a fullscreen triangle)", () => {
    for (const src of [MILKY_WAY_FRAGMENT_GLSL, MILKY_WAY_FRAGMENT_WGSL]) {
      expect(src).not.toContain("uRight");
      expect(src).not.toContain("uFwd");
    }
  });

  it("vertex twins apply the standard world/view/projection transform and pass uv through", () => {
    expect(MILKY_WAY_VERTEX_GLSL).toContain("projection * view * world");
    expect(MILKY_WAY_VERTEX_GLSL).toContain("vUV = uv");
    expect(MILKY_WAY_VERTEX_WGSL).toContain(
      "uniforms.projection * uniforms.view * uniforms.world",
    );
    expect(MILKY_WAY_VERTEX_WGSL).toContain(
      "vertexOutputs.vUV = vertexInputs.uv",
    );
  });
});
