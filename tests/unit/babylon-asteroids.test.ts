/**
 * PF-09 B4 step 1 — asteroid field pure math: tiered counts, deterministic
 * belt construction, rock displacement, belt-pull herding, SIMD probe shape.
 */
import { describe, expect, it } from "vitest";
import {
  advanceWarpProgress,
  ASTEROID_BELT,
  beltDensityAt,
  beltPullAccel,
  buildAsteroidField,
  displaceRockVertices,
  IMPACT_SHAKE,
  impactShakeAmplitude,
  passageDeflectForce,
  ROCK_BASE_COUNT,
  ROCK_DISPLACEMENT,
  shakeOffset,
  visualDriftStep,
  WARP_FIELD,
  minSlowAlongSegment,
  warpSlowFactor,
  wasmSimdSupported,
} from "@/lib/babylon-asteroids";

// Body-count tiering moved to the unified B5 quality budget — see
// babylon-tiers.test.ts (the interim per-signal policy tested here was
// superseded and removed, TR-051).

describe("buildAsteroidField", () => {
  it("is deterministic per seed and varies across seeds", () => {
    const a = buildAsteroidField(24, 7);
    const b = buildAsteroidField(24, 7);
    const c = buildAsteroidField(24, 8);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.positions)).not.toEqual(Array.from(c.positions));
  });

  it("spawns every body inside the belt torus bounds (ring in X–Y, tube axis Z)", () => {
    const f = buildAsteroidField(64, 3);
    const b = ASTEROID_BELT;
    for (let i = 0; i < f.count; i++) {
      const dx = f.positions[i * 3] - b.center[0];
      const dy = f.positions[i * 3 + 1] - b.center[1];
      const dz = f.positions[i * 3 + 2] - b.center[2];
      const planar = Math.hypot(dx, dy);
      expect(planar).toBeGreaterThanOrEqual(b.radius - b.radialSpread - 1e-6);
      expect(planar).toBeLessThanOrEqual(b.radius + b.radialSpread + 1e-6);
      expect(Math.abs(dz)).toBeLessThanOrEqual(b.verticalSpread + 1e-6);
    }
  });

  it("keeps scales, speeds, spins, and masses in their declared ranges", () => {
    const f = buildAsteroidField(64, 5);
    const b = ASTEROID_BELT;
    for (let i = 0; i < f.count; i++) {
      expect(f.scales[i]).toBeGreaterThanOrEqual(b.scaleMin);
      expect(f.scales[i]).toBeLessThanOrEqual(b.scaleMax);
      expect(f.baseIndex[i]).toBeLessThan(ROCK_BASE_COUNT);
      const sp = Math.hypot(
        f.linVel[i * 3],
        f.linVel[i * 3 + 1],
        f.linVel[i * 3 + 2],
      );
      expect(sp).toBeGreaterThanOrEqual(b.speedMin - 1e-6);
      expect(sp).toBeLessThanOrEqual(b.speedMax + 1e-6);
      for (let k = 0; k < 3; k++) {
        expect(Math.abs(f.angVel[i * 3 + k])).toBeLessThanOrEqual(b.spinMax);
      }
      // mass ∝ scale³ — bigger rocks shove smaller ones. Float32Array
      // storage rounds both fields, so compare at single precision.
      expect(f.masses[i]).toBeCloseTo(f.scales[i] ** 3, 3);
    }
  });
});

describe("displaceRockVertices", () => {
  it("displaces radially within the amplitude bound and is deterministic", () => {
    const n = 60;
    const pos = new Float32Array(n * 3);
    // points on a unit sphere
    for (let i = 0; i < n; i++) {
      const u = (i / n) * 2 - 1;
      const th = i * 2.399963; // golden-angle spiral
      const r = Math.sqrt(Math.max(0, 1 - u * u));
      pos[i * 3] = Math.cos(th) * r;
      pos[i * 3 + 1] = Math.sin(th) * r;
      pos[i * 3 + 2] = u;
    }
    const a = displaceRockVertices(pos.slice(), 11);
    const b = displaceRockVertices(pos.slice(), 11);
    const c = displaceRockVertices(pos.slice(), 12);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
    for (let i = 0; i < n; i++) {
      const l = Math.hypot(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]);
      expect(l).toBeGreaterThanOrEqual(1 - ROCK_DISPLACEMENT - 1e-5);
      expect(l).toBeLessThanOrEqual(1 + ROCK_DISPLACEMENT + 1e-5);
      expect(Number.isFinite(l)).toBe(true);
    }
  });

  it("welded vertices (identical directions) displace identically", () => {
    // the same direction listed twice must stay the same point — watertight
    const pos = new Float32Array([0.6, 0.8, 0, 0.6, 0.8, 0]);
    displaceRockVertices(pos, 4);
    expect(pos[0]).toBe(pos[3]);
    expect(pos[1]).toBe(pos[4]);
    expect(pos[2]).toBe(pos[5]);
  });
});

describe("beltPullAccel", () => {
  const b = ASTEROID_BELT;

  it("is ~zero on the spine circle itself", () => {
    const [ax, ay, az] = beltPullAccel(
      b.center[0] + b.radius,
      b.center[1],
      b.center[2],
    );
    expect(Math.hypot(ax, ay, az)).toBeLessThan(1e-9);
  });

  it("pulls outward-drifted bodies back toward the spine (not the centre)", () => {
    // body far outside the ring on +X: pull should point in −X (inward)
    const far = beltPullAccel(
      b.center[0] + b.radius * 2,
      b.center[1],
      b.center[2],
    );
    expect(far[0]).toBeLessThan(0);
    // body INSIDE the ring near the centre: pull points OUTWARD toward the
    // spine — this is what preserves the ring shape
    const inner = beltPullAccel(b.center[0] + 5, b.center[1], b.center[2]);
    expect(inner[0]).toBeGreaterThan(0);
  });

  it("levels vertical (Z-axis) drift back to the belt plane", () => {
    const [, , az] = beltPullAccel(
      b.center[0] + b.radius,
      b.center[1],
      b.center[2] + 40,
    );
    expect(az).toBeLessThan(0);
  });

  it("handles the degenerate on-axis position without NaN", () => {
    const a = beltPullAccel(b.center[0], b.center[1], b.center[2]);
    for (const v of a) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("visualDriftStep", () => {
  it("moves bodies by v·dt and applies the pull to velocity", () => {
    const b = ASTEROID_BELT;
    const pos = new Float32Array([
      b.center[0] + b.radius,
      b.center[1],
      b.center[2],
    ]);
    const vel = new Float32Array([0, 0, 2]);
    visualDriftStep(pos, vel, 1, 0.5);
    expect(pos[2]).toBeCloseTo(b.center[2] + 1, 6); // z += 2 * 0.5
    // on-spine start: pull ~0, velocity unchanged
    expect(vel[2]).toBeCloseTo(2, 6);
  });

  it("zero velocity + on-spine position stays put (the reduced-motion case)", () => {
    const b = ASTEROID_BELT;
    const pos = new Float32Array([
      b.center[0] + b.radius,
      b.center[1],
      b.center[2],
    ]);
    const vel = new Float32Array(3);
    visualDriftStep(pos, vel, 1, 1 / 60);
    expect(pos[0]).toBeCloseTo(b.center[0] + b.radius, 6);
  });
});

describe("beltDensityAt (B4 step 2)", () => {
  const b = ASTEROID_BELT;

  it("is 1 on the spine and falls off smoothly to ~0 far away", () => {
    expect(
      beltDensityAt(b.center[0] + b.radius, b.center[1], b.center[2]),
    ).toBeCloseTo(1, 6);
    expect(
      beltDensityAt(b.center[0], b.center[1], b.center[2] + 400),
    ).toBeLessThan(1e-6);
    expect(beltDensityAt(b.center[0], b.center[1], b.center[2])).toBeLessThan(
      1e-6,
    ); // ring centre is OUTSIDE the tube
  });

  it("decreases monotonically moving radially away from the spine", () => {
    let prev = 2;
    for (let off = 0; off <= 120; off += 10) {
      const d = beltDensityAt(
        b.center[0] + b.radius + off,
        b.center[1],
        b.center[2],
      );
      expect(d).toBeLessThanOrEqual(prev + 1e-12);
      prev = d;
    }
  });
});

describe("minSlowAlongSegment (PF-11 D3.2 — frame-rate-independent slowdown record)", () => {
  const b = ASTEROID_BELT;

  it("catches the belt core even when both segment endpoints are far outside the tube", () => {
    // THE defect this function exists to fix: at ~2 fps (measured SwiftShader
    // load) a single frame steps ~140 world units and a point sample straddles
    // the whole tube. A radial segment through the spine, endpoints ±150 wu
    // (density ~0 at both), must still report the spine's full slowdown.
    const min = minSlowAlongSegment(
      b.center[0] + b.radius - 150,
      b.center[1],
      b.center[2],
      b.center[0] + b.radius + 150,
      b.center[1],
      b.center[2],
    );
    expect(min).toBeLessThan(1 - WARP_FIELD.maxSlow + 0.02); // ≈ 0.45
  });

  it("degenerates to the point sample for a zero-length segment", () => {
    const x = b.center[0] + b.radius + 40;
    const point = warpSlowFactor(beltDensityAt(x, b.center[1], b.center[2]));
    expect(
      minSlowAlongSegment(
        x,
        b.center[1],
        b.center[2],
        x,
        b.center[1],
        b.center[2],
      ),
    ).toBeCloseTo(point, 9);
  });

  it("is ~1 for a segment that stays far from the tube", () => {
    expect(minSlowAlongSegment(0, 0, 400, 50, 50, 500)).toBeGreaterThan(0.999);
  });

  it("never reports below the physical floor (1 - maxSlow)", () => {
    const min = minSlowAlongSegment(
      b.center[0] + b.radius,
      b.center[1],
      b.center[2] - 50,
      b.center[0] + b.radius,
      b.center[1],
      b.center[2] + 50,
    );
    expect(min).toBeGreaterThanOrEqual(1 - WARP_FIELD.maxSlow - 1e-9);
  });
});

describe("warpSlowFactor / advanceWarpProgress (B4 step 2)", () => {
  it("is 1 in clear space and (1 - maxSlow) at peak density, clamped", () => {
    expect(warpSlowFactor(0)).toBe(1);
    expect(warpSlowFactor(1)).toBeCloseTo(1 - WARP_FIELD.maxSlow, 9);
    expect(warpSlowFactor(-1)).toBe(1);
    expect(warpSlowFactor(2)).toBeCloseTo(1 - WARP_FIELD.maxSlow, 9);
  });

  it("integrates to 1 in exactly warpDur of clear-space time", () => {
    let prog = 0;
    for (let i = 0; i < 100; i++)
      prog = advanceWarpProgress(prog, 0.024, 2400, 1);
    expect(prog).toBeCloseTo(1, 6);
  });

  it("advances slower under density and never exceeds 1", () => {
    const clear = advanceWarpProgress(0.4, 1 / 60, 2400, 1);
    const dense = advanceWarpProgress(0.4, 1 / 60, 2400, warpSlowFactor(1));
    expect(dense).toBeGreaterThan(0.4);
    expect(dense).toBeLessThan(clear);
    expect(advanceWarpProgress(0.999999, 10, 2400, 1)).toBe(1);
  });
});

describe("passageDeflectForce (B4 step 2)", () => {
  it("points away from the ship and scales with mass", () => {
    const f1 = passageDeflectForce(0, 0, 0, 10, 0, 0, 1);
    expect(f1[0]).toBeGreaterThan(0);
    expect(f1[1]).toBe(0);
    const f8 = passageDeflectForce(0, 0, 0, 10, 0, 0, 8);
    expect(f8[0]).toBeCloseTo(f1[0] * 8, 6);
  });

  it("decays with distance and is exactly zero beyond the cutoff", () => {
    const near = Math.hypot(...passageDeflectForce(0, 0, 0, 5, 0, 0, 1));
    const far = Math.hypot(...passageDeflectForce(0, 0, 0, 25, 0, 0, 1));
    expect(far).toBeLessThan(near);
    expect(
      passageDeflectForce(0, 0, 0, WARP_FIELD.deflectRadius * 2.5 + 1, 0, 0, 1),
    ).toEqual([0, 0, 0]);
  });

  it("stays finite for a body exactly at the ship position", () => {
    const f = passageDeflectForce(1, 2, 3, 1, 2, 3, 5);
    for (const v of f) expect(Number.isFinite(v)).toBe(true);
  });
});

describe("impactShakeAmplitude / shakeOffset (B4 step 3)", () => {
  it("ignores grazing contacts below the impulse threshold", () => {
    expect(impactShakeAmplitude(IMPACT_SHAKE.minImpulse - 0.01, 10)).toBe(0);
  });

  it("scales with impulse, falls off with distance, and caps at maxAmp", () => {
    const near = impactShakeAmplitude(50, IMPACT_SHAKE.referenceDist);
    const far = impactShakeAmplitude(50, IMPACT_SHAKE.referenceDist * 4);
    expect(near).toBeGreaterThan(far);
    expect(far).toBeCloseTo(near / 16, 6); // inverse-square
    expect(impactShakeAmplitude(1e9, 1)).toBe(IMPACT_SHAKE.maxAmp);
    // inside the reference distance the falloff clamps to 1, no boost
    expect(impactShakeAmplitude(50, 1)).toBeCloseTo(near, 6);
  });

  it("shakeOffset is deterministic, bounded by amp, and zero at zero amp", () => {
    expect(shakeOffset(0, 5)).toEqual([0, 0]);
    const a = shakeOffset(0.5, 1.234);
    const b = shakeOffset(0.5, 1.234);
    expect(a).toEqual(b);
    for (let t = 0; t < 2; t += 0.01) {
      const [ox, oy] = shakeOffset(0.5, t);
      expect(Math.abs(ox)).toBeLessThanOrEqual(0.5 + 1e-9);
      expect(Math.abs(oy)).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });
});

describe("wasmSimdSupported", () => {
  it("returns a boolean and does not throw (Node ≥ 16 supports SIMD → true here)", () => {
    const v = wasmSimdSupported();
    expect(typeof v).toBe("boolean");
    expect(v).toBe(true); // vitest runs on modern Node, which validates SIMD
  });
});
