/**
 * PF-11 D4.2 — the `fs-<i>` travel-target parse/stride contract.
 *
 * Pure enough to unit test off-GPU despite living in babylon-engine.ts, same rationale as
 * babylon-engine-freelook.test.ts (the module's import-time side effects are ShaderStore
 * string registration and customElements.define, both inert without a connected element).
 *
 * These tests exist for one specific reason: the implementation plan prescribed porting
 * space-engine.js:1482-1497 verbatim, and that source indexes its field at **4 floats per
 * star** while Babylon's `_field.positions` is **3**. A verbatim port doesn't crash and
 * doesn't fail a render — it silently flies the ship to a neighbouring star. The stride
 * assertions below are the thing that stops that regressing back.
 */
import { describe, expect, it } from "vitest";
import { fieldStarTarget } from "@/lib/babylon-engine";

/** Three stars at unambiguous, easily-checked coordinates: index 0 on +X, index 1 on +Y,
 * index 2 on +Z — chosen so a 4-stride misread produces obviously wrong values rather than
 * something that could coincidentally pass. */
const STARS: [number, number, number][] = [
  [10, 0, 0], // star 0
  [0, 20, 0], // star 1
  [0, 0, 30], // star 2
];
const POSITIONS = new Float32Array(STARS.flat());
const COUNT = STARS.length;

describe("fieldStarTarget — id parsing and bounds", () => {
  it("resolves a valid fs- id to its index", () => {
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.index).toBe(1);
  });

  it("returns null for a non-field id (catalog bodies and stations are looked up elsewhere)", () => {
    expect(fieldStarTarget("sirius", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("st-about", POSITIONS, COUNT)).toBeNull();
  });

  it("returns null for an unparseable index rather than flying to NaN", () => {
    expect(fieldStarTarget("fs-", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("fs-abc", POSITIONS, COUNT)).toBeNull();
  });

  it("returns null for out-of-range indices at both ends", () => {
    expect(fieldStarTarget("fs--1", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("fs-3", POSITIONS, COUNT)).toBeNull(); // count is 3 → max index 2
    expect(fieldStarTarget("fs-999999", POSITIONS, COUNT)).toBeNull();
  });

  it("accepts the last valid index (the boundary is inclusive below count)", () => {
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.index).toBe(2);
  });

  it("returns null when the field is empty", () => {
    expect(fieldStarTarget("fs-0", new Float32Array(0), 0)).toBeNull();
  });
});

describe("fieldStarTarget — position stride (the 3-vs-4 float regression guard)", () => {
  it("reads index 0 at positions[0..2]", () => {
    expect(fieldStarTarget("fs-0", POSITIONS, COUNT)?.pos).toEqual([10, 0, 0]);
  });

  it("reads index 1 at positions[3..5] — a 4-stride port would read [20,0,0] here", () => {
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.pos).toEqual([0, 20, 0]);
  });

  it("reads index 2 at positions[6..8]", () => {
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.pos).toEqual([0, 0, 30]);
  });
});

describe("fieldStarTarget — direction", () => {
  it("is the unit vector toward the star", () => {
    expect(fieldStarTarget("fs-0", POSITIONS, COUNT)?.dir).toEqual([1, 0, 0]);
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.dir).toEqual([0, 1, 0]);
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.dir).toEqual([0, 0, 1]);
  });

  it("is a unit vector for an off-axis star", () => {
    const p = new Float32Array([3, 4, 12]); // |p| = 13
    const dir = fieldStarTarget("fs-0", p, 1)!.dir;
    expect(Math.hypot(dir[0], dir[1], dir[2])).toBeCloseTo(1, 12);
    expect(dir[0]).toBeCloseTo(3 / 13, 12);
    expect(dir[2]).toBeCloseTo(12 / 13, 12);
  });

  it("emits a finite (zero) direction rather than NaN for a star at the origin", () => {
    const dir = fieldStarTarget("fs-0", new Float32Array([0, 0, 0]), 1)!.dir;
    expect(dir.every((c) => Number.isFinite(c))).toBe(true);
  });
});
