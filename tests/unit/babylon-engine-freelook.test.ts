/**
 * GAP-08/GAP-10 — free-look direction math. Pure enough to unit test off-GPU
 * despite living in babylon-engine.ts (the module's only side effects at
 * import time are ShaderStore string registration and customElements.define,
 * both inert without a connected <babylon-scene> element — see that file's
 * freeLookDir header for why this isn't a literal port of space-engine.js's
 * yaw/pitch-as-ra/dec convention).
 */
import { describe, expect, it } from "vitest";
import { freeLookDir } from "@/lib/babylon-engine";

function len(v: readonly [number, number, number]): number {
  return Math.hypot(v[0], v[1], v[2]);
}

describe("freeLookDir", () => {
  it("returns BABYLON_FORWARD ([0,0,1]) at yaw=0, pitch=0", () => {
    const [x, y, z] = freeLookDir(0, 0);
    expect(x).toBeCloseTo(0, 10);
    expect(y).toBeCloseTo(0, 10);
    expect(z).toBeCloseTo(1, 10);
  });

  it("is always a unit vector", () => {
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.31) {
      for (let pitch = -1.45; pitch <= 1.45; pitch += 0.29) {
        expect(len(freeLookDir(yaw, pitch))).toBeCloseTo(1, 10);
      }
    }
  });

  it("positive pitch looks up (+Y) — a pull-back-to-climb convention", () => {
    const [, y] = freeLookDir(0, 0.5);
    expect(y).toBeGreaterThan(0);
    const [, yNeg] = freeLookDir(0, -0.5);
    expect(yNeg).toBeLessThan(0);
  });

  it("pitch alone never moves the yaw-plane (x,z) direction out of proportion with cos(pitch)", () => {
    // at pitch = p, the horizontal component's magnitude should scale by
    // cos(p) relative to pitch = 0, for the same yaw
    const yaw = 0.9;
    const flat = freeLookDir(yaw, 0);
    const tilted = freeLookDir(yaw, 0.6);
    const flatHoriz = Math.hypot(flat[0], flat[2]);
    const tiltedHoriz = Math.hypot(tilted[0], tilted[2]);
    expect(tiltedHoriz / flatHoriz).toBeCloseTo(Math.cos(0.6), 10);
  });

  it("wraps continuously across yaw = 2*pi (no discontinuity)", () => {
    const a = freeLookDir(0.1, 0.2);
    const b = freeLookDir(0.1 + Math.PI * 2, 0.2);
    expect(a[0]).toBeCloseTo(b[0], 9);
    expect(a[1]).toBeCloseTo(b[1], 9);
    expect(a[2]).toBeCloseTo(b[2], 9);
  });
});
