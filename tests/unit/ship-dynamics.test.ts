/**
 * PF-07 ship-v2 P2 — unit tests for the world-space flight math.
 *
 * Pure-module tests: spring behaviour (convergence, mass-like overshoot,
 * critical damping) and the NDC↔view-space conversion, verified by projecting
 * the result back through the engine's perspective convention.
 */
import { describe, expect, it } from "vitest";
import {
  ARRIVE_STANDOFF,
  bodyDepth,
  bodyWorldPosition,
  raDecToDir,
  warpDurationForLy,
  warpEase,
  WARP_MAX_MS,
  WARP_MIN_MS,
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
  quatFromAxisAngle,
  quatFromUnitVectors,
  quatMultiply,
  quatToMat4,
  restPoseQuat,
  QUAT_IDENTITY,
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
  warpFovMult,
  WARP_FOV_GAIN,
  WARP_FOV_MAX_MULT,
  advanceWarpV4,
  warpEaseV4,
  warpSpeedNorm,
  warpFlipRate,
  FLIP_MIN_MS,
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

describe("PF-09 B2 — ambient idle drift (quatFromAxisAngle, quatMultiply)", () => {
  const apply = (q: readonly number[], v: readonly number[]) => {
    const m = quatToMat4(q as Quat);
    return [
      m[0] * v[0] + m[4] * v[1] + m[8] * v[2],
      m[1] * v[0] + m[5] * v[1] + m[9] * v[2],
      m[2] * v[0] + m[6] * v[1] + m[10] * v[2],
    ];
  };

  it("quatFromAxisAngle is the identity at angle 0", () => {
    expect(quatFromAxisAngle([0, 1, 0], 0)).toEqual(QUAT_IDENTITY);
  });

  it("quatFromAxisAngle rotates a perpendicular vector by the given angle around Y", () => {
    const q = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const out = apply(q, [1, 0, 0]);
    // right-hand rotation about +Y takes +X toward -Z
    expect(out[0]).toBeCloseTo(0, 5);
    expect(out[1]).toBeCloseTo(0, 5);
    expect(out[2]).toBeCloseTo(-1, 5);
  });

  it("quatFromAxisAngle always returns a unit quaternion", () => {
    for (const angle of [0.01, 1, 3, -2.5]) {
      const [x, y, z, w] = quatFromAxisAngle([0, 1, 0], angle);
      expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 10);
    }
  });

  it("quatMultiply composes two axis rotations into their sum (commutative for a shared axis)", () => {
    const a = quatFromAxisAngle([0, 1, 0], 0.3);
    const b = quatFromAxisAngle([0, 1, 0], 0.5);
    const composed = quatMultiply(a, b);
    const expected = quatFromAxisAngle([0, 1, 0], 0.8);
    for (let i = 0; i < 4; i++)
      expect(Math.abs(composed[i])).toBeCloseTo(Math.abs(expected[i]), 5);
  });

  it("quatMultiply by identity is a no-op", () => {
    const q = quatFromAxisAngle([0, 1, 0], 1.1);
    const out = quatMultiply(q, QUAT_IDENTITY);
    for (let i = 0; i < 4; i++) expect(out[i]).toBeCloseTo(q[i], 10);
  });

  it("repeated small multiplications accumulate a full rotation without drifting off unit length", () => {
    let q: Quat = QUAT_IDENTITY;
    const step = quatFromAxisAngle([0, 1, 0], (2 * Math.PI) / 360); // 1 deg
    for (let i = 0; i < 360; i++) q = quatMultiply(step, q);
    const [x, y, z, w] = q;
    expect(Math.hypot(x, y, z, w)).toBeCloseTo(1, 6);
    // a full 360° turn returns (approximately) to identity
    expect(Math.abs(w)).toBeCloseTo(1, 3);
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

    // --- PF-11 D3.1: deceleration legibility (the anti-loom invariant). ---
    it("D3.1: OPENS the chase during early braking (camera eases back)", () => {
      // The braking pull-back beat: just past the flip the camera drifts
      // further astern, so the ship recedes rather than looming. The global
      // maximum standoff lives in the braking half, at k≈0.72.
      expect(chaseOffsetAt(0.72)[2]).toBeGreaterThan(chaseOffsetAt(0.55)[2]);
    });

    it("D3.1: the ship NEVER exceeds its arrival size while braking (no loom)", () => {
      // The core fix for owner complaint R6. Through the whole braking phase
      // the back-distance stays ≥ SHIP_VIEW_DEPTH (the arrival framing), so the
      // ship is never larger mid-brake than at the dock — it only reaches
      // arrival size at exactly k=1. The pre-D3.1 table dived to 2.2 here,
      // making the ship 37% larger than arrival while "slowing".
      for (let k = 0.53; k < 1; k += 0.005) {
        expect(chaseOffsetAt(k)[2]).toBeGreaterThanOrEqual(SHIP_VIEW_DEPTH);
      }
    });

    it("D3.1: settles monotonically from the braking peak to arrival framing", () => {
      // After the k≈0.72 pull-back peak the standoff only decreases, so the
      // final approach reads as follow-through into the dock, never a late
      // re-acceleration.
      let prev = chaseOffsetAt(0.72)[2];
      for (let k = 0.72; k <= 1; k += 0.005) {
        const b = chaseOffsetAt(k)[2];
        expect(b).toBeLessThanOrEqual(prev + 1e-9);
        prev = b;
      }
      expect(chaseOffsetAt(1)[2]).toBe(SHIP_VIEW_DEPTH);
    });
  });

  describe("warp profile v4 (D3.2 / ADR-0011 — coast plateau + flip floor)", () => {
    const KA = 0.44;
    const KD = 0.56;

    it("warpFlipRate delivers the screen-time floor, and only when needed", () => {
      // Window = 12% of the journey. Every current destination (1400-4200 ms)
      // is far too short to clear a 1500 ms floor unaided, so r < 1 always.
      expect(warpFlipRate(1400, KA, KD)).toBeCloseTo((0.12 * 1400) / 1500, 9);
      expect(warpFlipRate(4200, KA, KD)).toBeCloseTo((0.12 * 4200) / 1500, 9);
      expect(warpFlipRate(4200, KA, KD)).toBeLessThan(1);
      // A hypothetical journey long enough needs no dilation at all.
      expect(warpFlipRate(FLIP_MIN_MS / 0.12, KA, KD)).toBeCloseTo(1, 9);
      expect(warpFlipRate(60000, KA, KD)).toBe(1);
    });

    it("the floor math is exact: window wall-clock = max(0.12·dur, FLIP_MIN_MS)", () => {
      for (const dur of [1400, 2088, 3246, 3590, 4200]) {
        const r = warpFlipRate(dur, KA, KD);
        const windowMs = ((KD - KA) * dur) / r;
        expect(windowMs).toBeCloseTo(Math.max((KD - KA) * dur, FLIP_MIN_MS), 6);
      }
    });

    it("warpEaseV4 hits its endpoints exactly and stays symmetric for every r", () => {
      // Symmetry is what preserves the arrival invariants and the existing
      // ease-shape expectations regardless of how hard the window is dilated.
      for (const r of [1, 0.5, 0.336, 0.112]) {
        expect(warpEaseV4(0, r, KA, KD)).toBeCloseTo(0, 12);
        expect(warpEaseV4(1, r, KA, KD)).toBeCloseTo(1, 12);
        expect(warpEaseV4(0.5, r, KA, KD)).toBeCloseTo(0.5, 12);
      }
    });

    it("warpEaseV4 is monotonic — the ship never reverses along the path", () => {
      for (const r of [1, 0.336]) {
        let prev = -1;
        for (let k = 0; k <= 1.0001; k += 0.002) {
          const s = warpEaseV4(k, r, KA, KD);
          expect(s).toBeGreaterThanOrEqual(prev - 1e-12);
          prev = s;
        }
      }
    });

    it("has a genuine CONSTANT-VELOCITY coast across the flip window", () => {
      // The whole point of v4 over the triangle: ds/dk is FLAT through the
      // window, so a coasting ship (engines cut) does not slow down.
      const r = 0.336;
      const h = 1e-5;
      const slopeAt = (k: number) =>
        (warpEaseV4(k + h, r, KA, KD) - warpEaseV4(k - h, r, KA, KD)) / (2 * h);
      const mid = slopeAt(0.5);
      for (const k of [0.46, 0.48, 0.5, 0.52, 0.54]) {
        expect(slopeAt(k)).toBeCloseTo(mid, 6);
      }
    });

    it("keeps WORLD velocity continuous across both window edges (the anti-lurch)", () => {
      // World velocity ∝ ds/dk · dk/dt, and dk/dt is multiplied by r inside the
      // window. The coast slope is m/r precisely so this product is continuous
      // — ADR-0011's rejected option 2 is what happens without it.
      const r = 0.336;
      const h = 1e-5;
      const slopeAt = (k: number) =>
        (warpEaseV4(k + h, r, KA, KD) - warpEaseV4(k - h, r, KA, KD)) / (2 * h);
      // Probed algebraically rather than by sampling either side of the join:
      // the burn slopes are LINEAR (m·k/KA and m·(1−k)/(1−KD)), so their
      // mid-segment slope is exactly m/2 — which recovers m without ever
      // evaluating a finite difference across the piecewise boundary.
      const mFromAccel = 2 * slopeAt(KA / 2);
      const mFromBrake = 2 * slopeAt((1 + KD) / 2);
      const coastSlope = slopeAt(0.5); // flat, = m/r
      // World velocity = ds/dk · dk/dt. Inside the window dk/dt carries the
      // extra factor r, so continuity is exactly `coastSlope · r === m`.
      expect(coastSlope * r).toBeCloseTo(mFromAccel, 6);
      expect(coastSlope * r).toBeCloseTo(mFromBrake, 6);
    });

    it("advanceWarpV4: a single dt-capped frame can NEVER jump the flip window", () => {
      // THE review finding (TR-094): with the rate picked once from frame-start
      // k, a 0.5 s capped frame starting just below the window advanced
      // dk ≈ 0.13 > the 0.12 window at rate 1 — one slow frame skipped the
      // whole flip, the exact TR-081 class the floor exists to kill. The
      // piecewise integrator splits the step at the boundary and spends the
      // remainder at rate r, so even the worst frame lands INSIDE the window.
      const dur = 3590; // m42
      const r = warpFlipRate(dur, KA, KD);
      const k = advanceWarpV4(KA - 0.001, 0.5, dur, 1, r, KA, KD);
      expect(k).toBeGreaterThan(KA);
      expect(k).toBeLessThan(KD); // cannot exit the window in one step
    });

    it("advanceWarpV4: the window consumes its floored wall-clock exactly, however frames land", () => {
      // Integrate a journey in deliberately awkward chunks (mixed dt sizes,
      // boundaries straddled) and measure the wall-clock spent with k inside
      // the window — it must equal max(0.12·dur, FLIP_MIN_MS) to sub-frame
      // accuracy, which is the floor's whole contract.
      const dur = 3590;
      const r = warpFlipRate(dur, KA, KD);
      const dts = [0.5, 0.013, 0.23, 0.047, 0.11, 0.5, 0.017];
      let k = 0;
      let t = 0;
      let tIn = 0;
      let i = 0;
      while (k < 1) {
        const dt = dts[i++ % dts.length];
        const k1 = advanceWarpV4(k, dt, dur, 1, r, KA, KD);
        // time attribution: fraction of dt spent in-window, from the k-budget
        // consumed per segment (rate 1 outside, r inside) — reconstruct by
        // splitting the step the same way the integrator does.
        let budget = (dt / (dur / 1000)) * 1;
        let kk = k;
        while (budget > 1e-12 && kk < k1 - 1e-12) {
          const inWin = kk >= KA && kk < KD;
          const rate = inWin ? r : 1;
          const boundary = kk < KA ? KA : inWin ? KD : 1;
          const dk = Math.min(budget * rate, boundary - kk, k1 - kk);
          const dtSeg = (dk / rate) * (dur / 1000);
          if (inWin) tIn += dtSeg;
          kk += dk;
          budget -= dk / rate;
        }
        t += dt;
        k = k1;
        expect(i).toBeLessThan(10000);
      }
      const expectedWindowS = Math.max(0.12 * dur, FLIP_MIN_MS) / 1000;
      expect(tIn).toBeCloseTo(expectedWindowS, 1);
      void t;
    });

    it("advanceWarpV4 degenerates to the plain advance when r = 1", () => {
      for (const [k0, dt] of [
        [0, 0.1],
        [0.3, 0.25],
        [0.5, 0.5],
        [0.9, 0.2],
      ] as const) {
        expect(advanceWarpV4(k0, dt, 2000, 0.8, 1, KA, KD)).toBeCloseTo(
          Math.min(1, k0 + (dt / 2) * 0.8),
          9,
        );
      }
    });

    it("warpSpeedNorm ramps in, HOLDS peak through the coast, ramps out", () => {
      expect(warpSpeedNorm(0, KA, KD)).toBeCloseTo(0, 12);
      expect(warpSpeedNorm(1, KA, KD)).toBeCloseTo(0, 12);
      // The plateau — this is the cue fix. Under the old dsdk triangle these
      // sagged either side of k=0.5, telling the viewer the coasting ship was
      // slowing down.
      for (const k of [KA, 0.47, 0.5, 0.53, KD]) {
        expect(warpSpeedNorm(k, KA, KD)).toBeCloseTo(1, 12);
      }
      expect(warpSpeedNorm(KA / 2, KA, KD)).toBeCloseTo(0.5, 12);
      expect(warpSpeedNorm((1 + KD) / 2, KA, KD)).toBeCloseTo(0.5, 12);
    });
  });

  describe("warpFovMult (D3.1 — the warp lens breathing cue)", () => {
    it("is base (1.0) at the journey ends where dsdk = 0", () => {
      expect(warpFovMult(0)).toBe(1);
    });

    it("peaks at +6% at the mid-journey speed peak (dsdk = 2)", () => {
      // dsdk = 4k / 4(1−k) peaks at 2 (k=0.5). mult = 1 + GAIN·dsdk/2.
      expect(warpFovMult(2)).toBeCloseTo(1 + WARP_FOV_GAIN, 12);
      expect(warpFovMult(2)).toBeCloseTo(1.06, 12);
    });

    it("increases monotonically with apparent speed up to the clamp", () => {
      let prev = warpFovMult(0);
      for (let d = 0; d <= 2; d += 0.05) {
        const m = warpFovMult(d);
        expect(m).toBeGreaterThanOrEqual(prev - 1e-12);
        prev = m;
      }
    });

    it("never exceeds the safety clamp", () => {
      // The formula peaks at 1.06 for the real dsdk∈[0,2]; the clamp is a rail
      // against any future gain/curve change feeding a larger value.
      expect(warpFovMult(100)).toBe(WARP_FOV_MAX_MULT);
      expect(warpFovMult(2)).toBeLessThanOrEqual(WARP_FOV_MAX_MULT);
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

describe("PF-09 B2 step 3 — shared body-position math", () => {
  // Pinned against space-engine.js's private raDecToDir/_buildBodies formulas
  // (not importable — a plain script, not a module) so the Babylon camera
  // travels to the exact same coordinates the live engine's star field and
  // bodies already occupy. A drift here silently sends the Babylon camera to
  // the wrong place while every unit test of the destination math still passes
  // in isolation — that's exactly the failure mode this test exists to catch.
  it("raDecToDir matches the live engine's convention at cardinal points", () => {
    expect(raDecToDir(0, 0)).toEqual([1, 0, 0]);
    const dec90 = raDecToDir(0, 90);
    expect(dec90[0]).toBeCloseTo(0, 10);
    expect(dec90[1]).toBeCloseTo(0, 10);
    expect(dec90[2]).toBeCloseTo(1, 10);
    const ra90 = raDecToDir(90, 0);
    expect(ra90[0]).toBeCloseTo(0, 10);
    expect(ra90[1]).toBeCloseTo(1, 10);
  });

  it("raDecToDir always returns a unit vector", () => {
    for (const [ra, dec] of [
      [37, 19],
      [250, -20.5],
      [8, 14.2],
      [-40, -85],
    ]) {
      const [x, y, z] = raDecToDir(ra, dec);
      expect(Math.hypot(x, y, z)).toBeCloseTo(1, 10);
    }
  });

  it("bodyDepth matches space-engine.js's _buildBodies formula exactly", () => {
    expect(bodyDepth(0)).toBeCloseTo(150 + 128 * Math.log10(0.001 + 1.5), 10);
    expect(bodyDepth(null)).toBe(bodyDepth(0)); // (ly || 0.001) — null/0 fold together
    expect(bodyDepth(8.6)).toBeCloseTo(150 + 128 * Math.log10(8.6 + 1.5), 10);
  });

  it("bodyDepth increases monotonically with distance", () => {
    expect(bodyDepth(1000)).toBeGreaterThan(bodyDepth(100));
    expect(bodyDepth(100)).toBeGreaterThan(bodyDepth(1));
  });

  it("bodyWorldPosition places pos along dir at the computed depth", () => {
    const { dir, pos, depth } = bodyWorldPosition(37.3, 19.2, 444);
    expect(depth).toBeCloseTo(bodyDepth(444), 10);
    expect(pos[0]).toBeCloseTo(dir[0] * depth, 8);
    expect(pos[1]).toBeCloseTo(dir[1] * depth, 8);
    expect(pos[2]).toBeCloseTo(dir[2] * depth, 8);
  });

  it("ARRIVE_STANDOFF matches the live engine's parked distance", () => {
    expect(ARRIVE_STANDOFF).toBe(38);
  });
});

describe("PF-09 B2 step 4 — warpEase", () => {
  it("is 0 at t=0, 1 at t=1, 0.5 at the midpoint", () => {
    expect(warpEase(0)).toBe(0);
    expect(warpEase(1)).toBe(1);
    expect(warpEase(0.5)).toBeCloseTo(0.5, 10);
  });

  it("is monotonically non-decreasing across [0,1]", () => {
    let prev = -Infinity;
    for (let t = 0; t <= 1; t += 0.05) {
      const v = warpEase(t);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("accelerates into the midpoint and decelerates out of it (S-curve)", () => {
    // ease-in-out: the first quarter covers less ground than the second
    // quarter, and by symmetry the same holds mirrored at the far end.
    expect(warpEase(0.25)).toBeLessThan(warpEase(0.5) - warpEase(0.25));
    expect(1 - warpEase(0.75)).toBeLessThan(warpEase(0.75) - warpEase(0.5));
  });
});

describe("PF-09 B2 step 5 — warpDurationForLy (new formula, not a port)", () => {
  it("returns the floor for ly <= 0 (home / solar-system bodies)", () => {
    expect(warpDurationForLy(0)).toBe(WARP_MIN_MS);
    expect(warpDurationForLy(-5)).toBe(WARP_MIN_MS);
    expect(warpDurationForLy(0.0000158)).toBeGreaterThanOrEqual(WARP_MIN_MS);
  });

  it("is monotonically non-decreasing with distance", () => {
    // Real catalog values, ascending: Moon, Sun, Sirius, Aldebaran, Pleiades,
    // Betelgeuse, Orion Nebula, a distant SDSS galaxy, the catalog's max.
    const lys = [
      0.0000158, 8.6, 65, 444, 548, 1344, 237_000_000, 13_000_000_000,
    ];
    let prev = -Infinity;
    for (const ly of lys) {
      const d = warpDurationForLy(ly);
      expect(d).toBeGreaterThanOrEqual(prev);
      prev = d;
    }
  });

  it("stays within [WARP_MIN_MS, WARP_MAX_MS] across the catalog's full range", () => {
    for (const ly of [0, 1, 8.6, 1344, 1e6, 1e9, 13_000_000_000]) {
      const d = warpDurationForLy(ly);
      expect(d).toBeGreaterThanOrEqual(WARP_MIN_MS);
      expect(d).toBeLessThanOrEqual(WARP_MAX_MS);
    }
  });

  it("clamps to the ceiling for ultra-distant catalog entries (confirmed up to 13B ly)", () => {
    expect(warpDurationForLy(13_000_000_000)).toBe(WARP_MAX_MS);
    expect(warpDurationForLy(1e15)).toBe(WARP_MAX_MS); // never exceeds it
  });

  it("spends visibly more time on Orion Nebula (1,344 ly) than on Sirius (8.6 ly)", () => {
    // The delivery plan's own example: "near hops are quick; multi-hundred-ly
    // journeys spend longer at cruise" — checked against real named bodies,
    // not synthetic values.
    const sirius = warpDurationForLy(8.6);
    const orionNebula = warpDurationForLy(1344);
    expect(orionNebula).toBeGreaterThan(sirius + 500);
  });
});
