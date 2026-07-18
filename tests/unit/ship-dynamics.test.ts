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
  CHASE_ELEVATION,
  CHASE_OFFSET_REST,
  chaseOffsetAt,
  dampAngle,
  type Ember,
  engineGlowIntensity,
  ndcToView,
  PLUME_CORE,
  PLUME_SHEATH,
  plumeThrottle,
  stepEmber,
  travelFrame,
  viewToNdc,
  quatDamp,
  quatFromUnitVectors,
  quatToMat4,
  restPoseQuat,
  type Quat,
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

describe("PF-08 F1 quaternion flight state", () => {
  const apply = (q: readonly number[], v: readonly number[]) => {
    const m = quatToMat4(q as Quat);
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  };

  it("quatFromUnitVectors rotates a onto b (including the antipodal case)", () => {
    const cases: [number[], number[]][] = [
      [
        [0, 0, -1],
        [1, 0, 0],
      ],
      [
        [0, 0, -1],
        [0, 1, 0],
      ],
      [
        [0, 0, -1],
        [0, 0, 1],
      ], // 180° flip
    ];
    for (const [a, b] of cases) {
      const out = apply(quatFromUnitVectors(a, b), a);
      for (let i = 0; i < 3; i++) expect(out[i]).toBeCloseTo(b[i], 5);
    }
  });

  it("quatDamp converges the nose onto the target direction", () => {
    let q = restPoseQuat();
    const target = quatFromUnitVectors([0, 0, -1], [1, 0, 0]);
    for (let i = 0; i < 200; i++) q = quatDamp(q, target, 4.5, 1 / 60);
    const nose = apply(q, [0, 0, -1]);
    expect(nose[0]).toBeCloseTo(1, 3);
    expect(Math.abs(nose[1])).toBeLessThan(1e-3);
  });

  it("restPoseQuat matches the engine's rotX(pitch) convention", () => {
    const m = quatToMat4(restPoseQuat(-0.42));
    const cP = Math.cos(-0.42),
      sP = Math.sin(-0.42);
    // engine rx (column-major): [1,0,0,0, 0,cP,sP,0, 0,-sP,cP,0, ...]
    expect(m[5]).toBeCloseTo(cP, 10);
    expect(m[6]).toBeCloseTo(sP, 10);
    expect(m[9]).toBeCloseTo(-sP, 10);
  });

  it("engine glow follows the plume phase ordering", () => {
    const base = {
      burning: false,
      coasting: false,
      parked: false,
      reduced: false,
      t: 0,
    };
    expect(engineGlowIntensity({ ...base, burning: true })).toBeGreaterThan(
      engineGlowIntensity(base),
    );
    expect(engineGlowIntensity(base)).toBeGreaterThan(
      engineGlowIntensity({ ...base, parked: true }),
    );
    expect(engineGlowIntensity({ ...base, parked: true })).toBeGreaterThan(
      engineGlowIntensity({ ...base, coasting: true }),
    );
  });
});

describe("PF-08 F2 chase camera", () => {
  const dot = (a: readonly number[], b: readonly number[]) =>
    a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const len = (a: readonly number[]) => Math.hypot(a[0], a[1], a[2]);

  describe("travelFrame", () => {
    const oblique = [0.267, -0.535, 0.802];
    const ol = Math.hypot(...oblique);
    const dirs: number[][] = [
      [1, 0, 0],
      [0, 1, 0],
      oblique.map((c) => c / ol), // travelFrame contracts on a UNIT direction
      [0, 0, 1], // polar — degenerate against the +Z reference up
      [0, 0, -1],
    ];

    it("returns an orthonormal basis perpendicular to the route", () => {
      for (const d of dirs) {
        const { right, up } = travelFrame(d);
        expect(len(right)).toBeCloseTo(1, 6);
        expect(len(up)).toBeCloseTo(1, 6);
        expect(dot(right, d)).toBeCloseTo(0, 6);
        expect(dot(up, d)).toBeCloseTo(0, 6);
        expect(dot(right, up)).toBeCloseTo(0, 6);
      }
    });

    it("biases up toward celestial north for equatorial routes", () => {
      expect(travelFrame([1, 0, 0]).up[2]).toBeCloseTo(1, 6);
      expect(travelFrame([0, 1, 0]).up[2]).toBeCloseTo(1, 6);
    });
  });

  describe("chaseOffsetAt", () => {
    it("sits exactly astern at both journey ends (cam(0)=from, cam(1)=to)", () => {
      for (const k of [0, 1, -0.5, 1.5]) {
        const [r, u, b] = chaseOffsetAt(k);
        expect(r).toBe(0);
        expect(u).toBe(0);
        expect(b).toBe(SHIP_VIEW_DEPTH);
      }
      expect(CHASE_OFFSET_REST).toEqual([0, 0, SHIP_VIEW_DEPTH]);
    });

    it("is continuous — no waypoint kinks the springs would read as a snap", () => {
      let prev = chaseOffsetAt(0);
      for (let k = 0.001; k <= 1; k += 0.001) {
        const cur = chaseOffsetAt(k);
        for (let i = 0; i < 3; i++)
          expect(Math.abs(cur[i] - prev[i])).toBeLessThan(0.05);
        prev = cur;
      }
    });

    it("keeps the camera a safe distance behind the ship for the whole run", () => {
      for (let k = 0; k <= 1; k += 0.01)
        expect(chaseOffsetAt(k)[2]).toBeGreaterThanOrEqual(2);
    });

    // Owner retune 2026-07-18: the v1 flank-swing assertions are replaced —
    // the choreography is now one behind-the-thruster view held at 30°.
    it("holds the camera 30° above the thrust axis through the journey core", () => {
      for (let k = 0.1; k <= 0.92; k += 0.01) {
        const [, u, b] = chaseOffsetAt(k);
        expect(u).toBeLessThan(0); // camera above the ship
        expect(-u / b).toBeCloseTo(Math.tan(CHASE_ELEVATION), 6);
      }
    });

    it("pans out through cruise/flip and closes back in for arrival", () => {
      let maxB = 0;
      for (let k = 0; k <= 1; k += 0.01)
        maxB = Math.max(maxB, chaseOffsetAt(k)[2]);
      expect(maxB).toBeGreaterThanOrEqual(5);
      expect(chaseOffsetAt(0.55)[2]).toBeGreaterThan(chaseOffsetAt(0)[2]);
      expect(chaseOffsetAt(0.55)[2]).toBeGreaterThan(chaseOffsetAt(1)[2]);
    });
  });

  describe("dampAngle", () => {
    it("converges to the target", () => {
      let a = 0;
      for (let i = 0; i < 300; i++) a = dampAngle(a, 1.2, 3.0, 1 / 60);
      expect(a).toBeCloseTo(1.2, 3);
    });

    it("takes the short arc across the ±π wrap", () => {
      // 3.0 → −3.0 is 0.28 rad through π, not 6 rad back through 0
      const step = dampAngle(3.0, -3.0, 5, 1 / 60);
      expect(step).toBeGreaterThan(3.0);
      expect(step).toBeLessThan(3.0 + 0.3);
    });

    it("is frame-rate independent toward a fixed target", () => {
      const one = dampAngle(0, 1, 3.0, 0.1);
      let two = dampAngle(0, 1, 3.0, 0.05);
      two = dampAngle(two, 1, 3.0, 0.05);
      expect(two).toBeCloseTo(one, 10);
    });
  });

  describe("viewToNdc", () => {
    it("inverts ndcToView across FOVs and aspects", () => {
      for (const [nx, ny, aspect] of [
        [0, 0, 16 / 9],
        [0.7, -0.4, 16 / 9],
        [-0.9, 0.85, 9 / 16],
      ] as const) {
        const v = ndcToView(nx, ny, 2.7, SHIP_BASE_FOV, aspect);
        const [rx, ry] = viewToNdc(v, SHIP_BASE_FOV, aspect);
        expect(rx).toBeCloseTo(nx, 6);
        expect(ry).toBeCloseTo(ny, 6);
      }
    });
  });
});

describe("PF-08 F3 exhaust realism", () => {
  const base: PlumeParams = {
    burning: false,
    coasting: false,
    parked: false,
    reduced: false,
    t: 0.5,
  };

  it("throttle orders burn > idle > parked > coast", () => {
    const burn = plumeThrottle({ ...base, burning: true, reduced: true });
    const idle = plumeThrottle({ ...base, reduced: true });
    const parked = plumeThrottle({ ...base, parked: true, reduced: true });
    const coast = plumeThrottle({ ...base, coasting: true, reduced: true });
    expect(burn).toBeGreaterThan(idle);
    expect(idle).toBeGreaterThan(parked);
    expect(parked).toBeGreaterThan(coast);
  });

  it("throttle flickers over time when burning; reduced motion is steady", () => {
    const a = plumeThrottle({ ...base, burning: true, t: 0.1 });
    const b = plumeThrottle({ ...base, burning: true, t: 0.2 });
    expect(a).not.toBe(b);
    const ra = plumeThrottle({ ...base, burning: true, reduced: true, t: 0.1 });
    const rb = plumeThrottle({ ...base, burning: true, reduced: true, t: 9.9 });
    expect(ra).toBe(rb);
  });

  it("core is brighter than the sheath (layered flame)", () => {
    const lum = (c: readonly number[]) => c[0] + c[1] + c[2];
    expect(lum(PLUME_CORE)).toBeGreaterThan(lum(PLUME_SHEATH));
  });

  it("stepEmber drifts by velocity and decays, dying at life 0", () => {
    const e: Ember = { x: 0, y: 0, z: 0, vx: 1, vy: 2, vz: 3, life: 1 };
    expect(stepEmber(e, 0.1)).toBe(true);
    expect(e.x).toBeCloseTo(0.1, 6);
    expect(e.z).toBeCloseTo(0.3, 6);
    expect(e.life).toBeLessThan(1);
    const dead: Ember = { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, life: 0.05 };
    expect(stepEmber(dead, 1)).toBe(false);
  });

  it("plume geometry carries an across-axis side coord in {-1,+1}", () => {
    const v = buildPlumeVertices(0.4);
    expect(v).toHaveLength(PLUME_VERTEX_COUNT * PLUME_VERTEX_FLOATS);
    for (let i = 0; i < v.length; i += PLUME_VERTEX_FLOATS)
      expect(Math.abs(v[i + 4])).toBe(1);
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
