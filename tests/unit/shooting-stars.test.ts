/**
 * PF-09 B3 — GPU-particle idle shooting stars (pure geometry + lifecycle math).
 */
import { describe, expect, it } from "vitest";
import {
  buildShootingStars,
  cornerIsHead,
  particleAge,
  particleFade,
} from "@/lib/shooting-stars";

describe("buildShootingStars", () => {
  it("produces 4 verts + 6 indices per particle", () => {
    const s = buildShootingStars(10, 200, 7);
    expect(s.count).toBe(10);
    expect(s.vertexCount).toBe(40);
    expect(s.positions).toHaveLength(120);
    expect(s.dirs).toHaveLength(120);
    expect(s.meta).toHaveLength(160);
    expect(s.indices).toHaveLength(60);
  });

  it("is deterministic for a given seed and varies across seeds", () => {
    const a = buildShootingStars(8, 200, 42);
    const b = buildShootingStars(8, 200, 42);
    const c = buildShootingStars(8, 200, 43);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.positions)).not.toEqual(Array.from(c.positions));
  });

  it("every corner of a particle shares the same start/dir/meta", () => {
    const s = buildShootingStars(6, 200, 3);
    for (let i = 0; i < s.count; i++) {
      for (let c = 1; c < 4; c++) {
        const v0 = i * 4;
        const v = v0 + c;
        for (let k = 0; k < 3; k++) {
          expect(s.positions[v * 3 + k]).toBe(s.positions[v0 * 3 + k]);
          expect(s.dirs[v * 3 + k]).toBe(s.dirs[v0 * 3 + k]);
        }
        for (let k = 0; k < 4; k++) {
          expect(s.meta[v * 4 + k]).toBe(s.meta[v0 * 4 + k]);
        }
      }
      // indices stay within this particle's own 4 verts
      for (let k = 0; k < 6; k++) {
        const idx = s.indices[i * 6 + k];
        expect(idx).toBeGreaterThanOrEqual(i * 4);
        expect(idx).toBeLessThan(i * 4 + 4);
      }
    }
  });

  it("spawn points sit exactly on the requested shell radius", () => {
    const radius = 175;
    const s = buildShootingStars(12, radius, 9);
    for (let i = 0; i < s.count; i++) {
      const v0 = i * 4;
      const d = Math.hypot(
        s.positions[v0 * 3],
        s.positions[v0 * 3 + 1],
        s.positions[v0 * 3 + 2],
      );
      // Float32Array storage: single-precision rounding, not double-precision.
      expect(d).toBeCloseTo(radius, 3);
    }
  });

  it("direction is a unit vector, perpendicular to the particle's own radial direction", () => {
    // Tangential motion — a shooting star should streak across the sky, not
    // fly straight at/away from the shell centre where the camera sits.
    const s = buildShootingStars(20, 200, 5);
    for (let i = 0; i < s.count; i++) {
      const v0 = i * 4;
      const pos = [
        s.positions[v0 * 3],
        s.positions[v0 * 3 + 1],
        s.positions[v0 * 3 + 2],
      ];
      const dir = [s.dirs[v0 * 3], s.dirs[v0 * 3 + 1], s.dirs[v0 * 3 + 2]];
      const len = Math.hypot(dir[0], dir[1], dir[2]);
      expect(len).toBeCloseTo(1, 5);
      const dot = pos[0] * dir[0] + pos[1] * dir[1] + pos[2] * dir[2];
      expect(Math.abs(dot)).toBeLessThan(1e-4);
    }
  });

  it("meta fields (speed, length, width, seed) are all positive/in-range", () => {
    const s = buildShootingStars(15, 200, 11);
    for (let i = 0; i < s.count; i++) {
      const v0 = i * 4;
      const speed = s.meta[v0 * 4];
      const length = s.meta[v0 * 4 + 1];
      const width = s.meta[v0 * 4 + 2];
      const seed = s.meta[v0 * 4 + 3];
      expect(speed).toBeGreaterThan(0);
      expect(length).toBeGreaterThan(0);
      expect(width).toBeGreaterThan(0);
      expect(seed).toBeGreaterThanOrEqual(0);
      expect(seed).toBeLessThan(1);
    }
  });
});

describe("cornerIsHead", () => {
  it("marks corners 0 and 1 as head, 2 and 3 as tail, across many particles", () => {
    for (let base = 0; base < 4 * 10; base += 4) {
      expect(cornerIsHead(base)).toBe(true);
      expect(cornerIsHead(base + 1)).toBe(true);
      expect(cornerIsHead(base + 2)).toBe(false);
      expect(cornerIsHead(base + 3)).toBe(false);
    }
  });
});

describe("particleAge", () => {
  it("wraps within [0, cycleS)", () => {
    for (const t of [0, 1.5, 5, 100, -3]) {
      const age = particleAge(t, 0.37, 5);
      expect(age).toBeGreaterThanOrEqual(0);
      expect(age).toBeLessThan(5);
    }
  });

  it("different seeds give different phases at the same time", () => {
    const a = particleAge(2, 0.1, 5);
    const b = particleAge(2, 0.9, 5);
    expect(a).not.toBeCloseTo(b, 3);
  });

  it("is continuous across the wrap boundary (no jump)", () => {
    const cycleS = 5;
    const justBefore = particleAge(cycleS - 0.001, 0, cycleS);
    const justAfter = particleAge(cycleS + 0.001, 0, cycleS);
    expect(justBefore).toBeCloseTo(cycleS - 0.001, 3);
    expect(justAfter).toBeCloseTo(0.001, 3);
  });
});

describe("particleFade", () => {
  it("starts at 0, ends at 0, and is positive in the middle", () => {
    const cycleS = 10;
    expect(particleFade(0, cycleS)).toBeCloseTo(0, 5);
    expect(particleFade(cycleS, cycleS)).toBeCloseTo(0, 5);
    expect(particleFade(cycleS * 0.4, cycleS)).toBeCloseTo(1, 5);
  });

  it("never exceeds 1 or goes negative", () => {
    const cycleS = 8;
    for (let t = 0; t <= cycleS; t += 0.25) {
      const a = particleFade(t, cycleS);
      expect(a).toBeGreaterThanOrEqual(0);
      expect(a).toBeLessThanOrEqual(1);
    }
  });

  it("fades in faster than it fades out (quick appear, slower decay)", () => {
    const cycleS = 10;
    // 4% in: partway through the 8% fade-in window
    const partwayIn = particleFade(cycleS * 0.04, cycleS);
    // 82.5% in: partway through the 65%-100% fade-out window
    const partwayOut = particleFade(cycleS * 0.825, cycleS);
    expect(partwayIn).toBeGreaterThan(0);
    expect(partwayIn).toBeLessThan(1);
    expect(partwayOut).toBeGreaterThan(0);
    expect(partwayOut).toBeLessThan(1);
  });
});
