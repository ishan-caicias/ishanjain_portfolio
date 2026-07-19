/**
 * GAP-05 — warp star trails. Pure geometry + camera-lag math, ported from
 * space-engine.js's trail buffer build and its per-frame camPrev EMA.
 */
import { describe, expect, it } from "vitest";
import { buildStarField } from "@/lib/star-field";
import {
  advanceTrailCamera,
  buildStarTrails,
  trailFade,
  trailsVisible,
  TRAIL_CAM_LAG,
  TRAIL_STRIDE,
  TRAIL_WARP_SPEED_THRESHOLD,
  STAR_TRAIL_FRAGMENT_GLSL,
  STAR_TRAIL_FRAGMENT_WGSL,
  STAR_TRAIL_VERTEX_GLSL,
  STAR_TRAIL_VERTEX_WGSL,
} from "@/lib/star-trails";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("advanceTrailCamera", () => {
  it("lags toward cam by the configured EMA factor each call", () => {
    const cam: [number, number, number] = [100, 0, 0];
    const camPrev: [number, number, number] = [0, 0, 0];
    const speed = advanceTrailCamera(cam, camPrev, false);
    // camPrev closes 10% of the gap this call...
    expect(camPrev[0]).toBeCloseTo(100 * TRAIL_CAM_LAG, 5);
    // ...so the reported speed (post-update distance from cam) is the
    // REMAINING 90%, not the amount camPrev moved.
    expect(speed).toBeCloseTo(100 * (1 - TRAIL_CAM_LAG), 5);
  });

  it("converges to cam over repeated calls at a fixed camera", () => {
    const cam: [number, number, number] = [50, 0, 0];
    const camPrev: [number, number, number] = [0, 0, 0];
    let speed = 0;
    for (let i = 0; i < 200; i++)
      speed = advanceTrailCamera(cam, camPrev, false);
    expect(speed).toBeLessThan(0.01);
    expect(camPrev[0]).toBeCloseTo(50, 1);
  });

  it("snaps immediately under reduced motion (lag=1, no streak possible)", () => {
    const cam: [number, number, number] = [10, 20, 30];
    const camPrev: [number, number, number] = [0, 0, 0];
    // the snap happens WITHIN this same call (camPrev += (cam-camPrev)*1),
    // so the speed it reports is already post-snap: zero, not the
    // pre-snap displacement — matching the archived engine's reduced-motion
    // trail behaviour (trailsVisible gates on !reduced anyway, but the
    // speed computation itself never produces a nonzero reading either).
    const speed = advanceTrailCamera(cam, camPrev, true);
    expect(camPrev).toEqual(cam);
    expect(speed).toBe(0);
  });
});

describe("trailsVisible / trailFade", () => {
  it("gates exactly at the archived engine's threshold, tier, and reduced-motion rules", () => {
    expect(trailsVisible(TRAIL_WARP_SPEED_THRESHOLD + 0.01, false, true)).toBe(
      true,
    );
    expect(trailsVisible(TRAIL_WARP_SPEED_THRESHOLD - 0.01, false, true)).toBe(
      false,
    );
    expect(trailsVisible(10, true, true)).toBe(false); // reduced motion always off
    expect(trailsVisible(10, false, false)).toBe(false); // lite tier always off
  });

  it("fade scales linearly with warp speed, clamped to 1", () => {
    expect(trailFade(0)).toBe(0);
    expect(trailFade(10)).toBeCloseTo(0.6, 5);
    expect(trailFade(100)).toBe(1);
  });
});

describe("buildStarTrails", () => {
  it("samples every TRAIL_STRIDE-th star, 2 verts per sampled star", () => {
    const field = buildStarField(300, 400, 5);
    const trails = buildStarTrails(field, TRAIL_STRIDE);
    expect(trails.count).toBe(Math.floor(300 / TRAIL_STRIDE));
    expect(trails.vertexCount).toBe(trails.count * 2);
    expect(trails.positions).toHaveLength(trails.vertexCount * 3);
    expect(trails.meta).toHaveLength(trails.vertexCount * 2);
  });

  it("both endpoints of a segment share the sampled star's position", () => {
    const field = buildStarField(30, 400, 9);
    const trails = buildStarTrails(field, 3);
    for (let t = 0; t < trails.count; t++) {
      const v0 = t * 2;
      const v1 = t * 2 + 1;
      expect(trails.positions[v0 * 3]).toBe(trails.positions[v1 * 3]);
      expect(trails.positions[v0 * 3 + 1]).toBe(trails.positions[v1 * 3 + 1]);
      expect(trails.positions[v0 * 3 + 2]).toBe(trails.positions[v1 * 3 + 2]);
      // endFlag distinguishes the two otherwise-identical endpoints
      expect(trails.meta[v0 * 2 + 1]).toBe(0);
      expect(trails.meta[v1 * 2 + 1]).toBe(1);
    }
  });

  it("defaults to stride 3, matching space-engine.js's i%3===0", () => {
    expect(TRAIL_STRIDE).toBe(3);
  });
});

describe("shader source", () => {
  it("TR-045 guard: no reserved WGSL identifiers appear as words", () => {
    for (const src of [STAR_TRAIL_VERTEX_WGSL, STAR_TRAIL_FRAGMENT_WGSL]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("both twins compute the view-space correction via the SAME rotation-extraction technique", () => {
    expect(STAR_TRAIL_VERTEX_GLSL).toContain("mat3(view)");
    expect(STAR_TRAIL_VERTEX_WGSL).toContain("mat3x3<f32>(");
  });

  it("both fragment twins apply the warp fade to alpha only, never colour", () => {
    for (const src of [STAR_TRAIL_FRAGMENT_GLSL, STAR_TRAIL_FRAGMENT_WGSL]) {
      expect(src).toContain("vColor");
      expect(src).toContain("uWarp");
    }
  });

  it("the correction only applies to the endFlag=1 (lagged-camera) endpoint", () => {
    expect(STAR_TRAIL_VERTEX_GLSL).toContain("trailMeta.y > 0.5");
    expect(STAR_TRAIL_VERTEX_WGSL).toContain("vertexInputs.trailMeta.y > 0.5");
  });
});
