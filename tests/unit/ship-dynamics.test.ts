/**
 * PF-07 ship-v2 P2 — unit tests for the world-space flight math.
 *
 * Pure-module tests: spring behaviour (convergence, mass-like overshoot,
 * critical damping) and the NDC↔view-space conversion, verified by projecting
 * the result back through the engine's perspective convention.
 */
import { describe, expect, it } from "vitest";
import {
  buildPlumeVertices,
  ndcToView,
  plumeAlpha,
  plumeFlareLength,
  rimColorAt,
  shipScaleFactor,
  springStep,
  PLUME_ENGINES,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
  RIM_ARRIVED,
  RIM_COOL,
  SHIP_BASE_FOV,
  SHIP_NDC_Y_OFFSET,
  SHIP_VIEW_DEPTH,
  type PlumeParams,
  type SpringState,
} from "@/lib/ship-dynamics";

function runSpring(zeta: number, target = 1, steps = 600, dt = 1 / 120) {
  const s: SpringState = { p: 0, v: 0 };
  let maxP = -Infinity;
  for (let i = 0; i < steps; i++) {
    springStep(s, target, dt, 3.2, zeta);
    maxP = Math.max(maxP, s.p);
  }
  return { s, maxP };
}

describe("springStep", () => {
  it("converges to the target and comes to rest", () => {
    const { s } = runSpring(0.72);
    expect(s.p).toBeCloseTo(1, 3);
    expect(Math.abs(s.v)).toBeLessThan(1e-3);
  });

  it("under-damped (zeta<1) overshoots — the mass cue", () => {
    const { maxP } = runSpring(0.72);
    expect(maxP).toBeGreaterThan(1.01);
  });

  it("critically damped (zeta=1) does not meaningfully overshoot", () => {
    const { maxP } = runSpring(1.0);
    expect(maxP).toBeLessThan(1.005);
  });

  it("is stable under the clamped worst-case dt", () => {
    const s: SpringState = { p: 0, v: 0 };
    for (let i = 0; i < 200; i++) springStep(s, 1, 0.05, 3.2, 0.72);
    expect(s.p).toBeCloseTo(1, 2);
  });
});

describe("ndcToView", () => {
  // The engine's persp(): ndc.x = (f/aspect·x)/(−z), ndc.y = (f·y)/(−z), f = 1/tan(fov/2)
  function projectBack(
    v: [number, number, number],
    fovY: number,
    aspect: number,
  ) {
    const f = 1 / Math.tan(fovY / 2);
    return [((f / aspect) * v[0]) / -v[2], (f * v[1]) / -v[2]];
  }

  it("round-trips through the engine's perspective projection", () => {
    for (const [nx, ny, aspect] of [
      [0, 0.539, 16 / 9],
      [0.72, -0.801, 16 / 9],
      [-0.4, 0.2, 9 / 16],
    ] as const) {
      const v = ndcToView(nx, ny, SHIP_VIEW_DEPTH, SHIP_BASE_FOV, aspect);
      const [rx, ry] = projectBack(v, SHIP_BASE_FOV, aspect);
      expect(rx).toBeCloseTo(nx, 6);
      expect(ry).toBeCloseTo(ny, 6);
    }
  });

  it("places the ship at the configured depth in front of the camera", () => {
    const v = ndcToView(0, 0, SHIP_VIEW_DEPTH, SHIP_BASE_FOV, 1.6);
    expect(v[2]).toBe(-SHIP_VIEW_DEPTH);
  });
});

describe("legacy screen-composition parity", () => {
  it("shipScaleFactor preserves the P1 apparent size", () => {
    // P1 chain: half-size NDC = 0.5·s / (2.6·tan15°).
    // P2 chain: half-size NDC = 0.5·s·K / (depth·tan(SHIP_BASE_FOV/2)).
    const legacy = 0.5 / (2.6 * Math.tan((15 * Math.PI) / 180));
    const now =
      (0.5 * shipScaleFactor()) /
      (SHIP_VIEW_DEPTH * Math.tan(SHIP_BASE_FOV / 2));
    expect(now).toBeCloseTo(legacy, 10);
  });

  it("reproduces the P1 vertical model offset in NDC", () => {
    expect(SHIP_NDC_Y_OFFSET).toBeCloseTo(-0.201, 3);
  });
});

describe("P3 exhaust plume", () => {
  const base: PlumeParams = {
    burning: false,
    coasting: false,
    parked: false,
    reduced: false,
    t: 1.234,
  };

  it("orders flare length by phase: burn > idle > parked > coast", () => {
    const burn = plumeFlareLength({ ...base, burning: true });
    const idle = plumeFlareLength(base);
    const parked = plumeFlareLength({ ...base, parked: true });
    const coast = plumeFlareLength({ ...base, coasting: true });
    expect(burn).toBeGreaterThan(idle);
    expect(idle).toBeGreaterThan(parked);
    expect(parked).toBeGreaterThan(coast);
  });

  it("burn jitters over time; reduced motion is time-invariant", () => {
    const a = plumeFlareLength({ ...base, burning: true, t: 0.1 });
    const b = plumeFlareLength({ ...base, burning: true, t: 0.14 });
    expect(a).not.toBe(b);
    const ra = plumeFlareLength({
      ...base,
      burning: true,
      reduced: true,
      t: 0.1,
    });
    const rb = plumeFlareLength({
      ...base,
      burning: true,
      reduced: true,
      t: 9.9,
    });
    expect(ra).toBe(rb);
  });

  it("brightness follows the same phase ordering", () => {
    expect(plumeAlpha({ ...base, burning: true })).toBeGreaterThan(
      plumeAlpha(base),
    );
    expect(plumeAlpha(base)).toBeGreaterThan(
      plumeAlpha({ ...base, parked: true }),
    );
    expect(plumeAlpha({ ...base, parked: true })).toBeGreaterThan(
      plumeAlpha({ ...base, coasting: true }),
    );
  });

  it("builds the expected geometry: hot nozzles, transparent tips at nozzle+flare", () => {
    const flare = 0.4;
    const v = buildPlumeVertices(flare);
    expect(v).toHaveLength(PLUME_VERTEX_COUNT * PLUME_VERTEX_FLOATS);
    // Float32Array storage rounds to f32 — compare via Math.fround.
    const nozzleZs = new Set(PLUME_ENGINES.map(([, , z]) => Math.fround(z)));
    for (let i = 0; i < v.length; i += PLUME_VERTEX_FLOATS) {
      const z = v[i + 2];
      const a = v[i + 3];
      if (a === 1) {
        expect(nozzleZs.has(z)).toBe(true); // hot verts sit exactly at a nozzle
      } else {
        expect(a).toBe(0);
        const tipMatches = PLUME_ENGINES.some(
          ([, , ez]) => Math.abs(z - Math.fround(ez + flare)) < 1e-6,
        );
        expect(tipMatches).toBe(true); // cold verts sit exactly at nozzle+flare
      }
    }
  });
});

describe("P3 arrival rim tint", () => {
  it("interpolates cool → arrived and clamps outside [0,1]", () => {
    expect(rimColorAt(0)).toEqual([...RIM_COOL]);
    expect(rimColorAt(1)).toEqual([...RIM_ARRIVED]);
    expect(rimColorAt(-5)).toEqual([...RIM_COOL]);
    expect(rimColorAt(9)).toEqual([...RIM_ARRIVED]);
    const mid = rimColorAt(0.5);
    expect(mid[0]).toBeCloseTo((RIM_COOL[0] + RIM_ARRIVED[0]) / 2, 10);
  });
});
