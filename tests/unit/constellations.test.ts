/**
 * GAP-04 — constellation figures. Geometry only; reuses ship-dynamics.ts's
 * raDecToDir directly rather than a local copy, so there is nothing new to
 * pin about the projection itself.
 */
import { describe, expect, it } from "vitest";
import {
  buildConstellationLines,
  CONSTELLATION_RADIUS,
  CONSTELLATION_FRAGMENT_GLSL,
  CONSTELLATION_FRAGMENT_WGSL,
  CONSTELLATION_VERTEX_GLSL,
  CONSTELLATION_VERTEX_WGSL,
  type ConstellationSource,
} from "@/lib/constellations";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("buildConstellationLines", () => {
  it("skips bodies with no fig data", () => {
    const bodies: ConstellationSource[] = [{}, { fig: undefined }];
    const lines = buildConstellationLines(bodies);
    expect(lines.count).toBe(0);
    expect(lines.positions).toHaveLength(0);
  });

  it("emits one 6-float segment per fig.l entry, at the configured radius", () => {
    const bodies: ConstellationSource[] = [
      {
        fig: {
          s: [
            [0, 0],
            [90, 0],
            [0, 90],
          ],
          l: [
            [0, 1],
            [1, 2],
          ],
        },
      },
    ];
    const lines = buildConstellationLines(bodies, 100);
    expect(lines.count).toBe(2);
    expect(lines.positions).toHaveLength(12);
    // every endpoint should sit exactly at the radius from the origin
    for (let seg = 0; seg < lines.count; seg++) {
      for (let end = 0; end < 2; end++) {
        const o = seg * 6 + end * 3;
        const d = Math.hypot(
          lines.positions[o],
          lines.positions[o + 1],
          lines.positions[o + 2],
        );
        expect(d).toBeCloseTo(100, 5);
      }
    }
  });

  it("defaults to radius 720, matching space-engine.js", () => {
    expect(CONSTELLATION_RADIUS).toBe(720);
  });

  it("aggregates across multiple bodies and skips malformed index pairs", () => {
    const bodies: ConstellationSource[] = [
      { fig: { s: [[10, 20]], l: [[0, 5]] } }, // index 5 doesn't exist -> skipped
      {
        fig: {
          s: [
            [10, 20],
            [30, 40],
          ],
          l: [[0, 1]],
        },
      },
    ];
    const lines = buildConstellationLines(bodies);
    expect(lines.count).toBe(1);
  });
});

describe("shader source", () => {
  it("TR-045 guard: no reserved WGSL identifiers appear as words", () => {
    for (const src of [
      CONSTELLATION_VERTEX_WGSL,
      CONSTELLATION_FRAGMENT_WGSL,
    ]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("both twins are flat-colour, no lighting or texture sampling", () => {
    for (const src of [
      CONSTELLATION_FRAGMENT_GLSL,
      CONSTELLATION_FRAGMENT_WGSL,
    ]) {
      expect(src).not.toContain("texture");
    }
  });

  it("vertex twins apply the standard view/projection transform", () => {
    expect(CONSTELLATION_VERTEX_GLSL).toContain("projection * view");
    expect(CONSTELLATION_VERTEX_WGSL).toContain(
      "uniforms.projection * uniforms.view",
    );
  });
});
