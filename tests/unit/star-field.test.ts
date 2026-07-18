/**
 * PF-09 B1 — procedural star-field generator (pure, deterministic).
 */
import { describe, expect, it } from "vitest";
import {
  buildStarBillboards,
  buildStarField,
  LIVE_STAR_COUNT,
} from "@/lib/star-field";

describe("buildStarField", () => {
  it("produces the requested count with matching buffer lengths", () => {
    const f = buildStarField(1000, 400, 7);
    expect(f.count).toBe(1000);
    expect(f.positions).toHaveLength(3000);
    expect(f.meta).toHaveLength(2000);
  });

  it("defaults to the live catalog count", () => {
    expect(buildStarField().count).toBe(LIVE_STAR_COUNT);
  });

  it("is deterministic for a given seed and varies across seeds", () => {
    const a = buildStarField(500, 400, 42);
    const b = buildStarField(500, 400, 42);
    const c = buildStarField(500, 400, 43);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.positions)).not.toEqual(Array.from(c.positions));
  });

  it("billboard geometry: 4 verts + 6 indices per star, centre repeated", () => {
    const f = buildStarField(50, 400, 9);
    const b = buildStarBillboards(f);
    expect(b.count).toBe(50);
    expect(b.vertexCount).toBe(200);
    expect(b.positions).toHaveLength(600);
    expect(b.corners).toHaveLength(800);
    expect(b.indices).toHaveLength(300);

    for (let i = 0; i < f.count; i++) {
      const size = f.meta[i * 2];
      const colT = f.meta[i * 2 + 1];
      for (let c = 0; c < 4; c++) {
        const v = i * 4 + c;
        // every corner of a star shares its centre, size and colour
        expect(b.positions[v * 3]).toBe(f.positions[i * 3]);
        expect(b.positions[v * 3 + 2]).toBe(f.positions[i * 3 + 2]);
        expect(Math.abs(b.corners[v * 4])).toBe(1); // cornerX ∈ {-1,1}
        expect(Math.abs(b.corners[v * 4 + 1])).toBe(1); // cornerY ∈ {-1,1}
        expect(b.corners[v * 4 + 2]).toBe(size);
        expect(b.corners[v * 4 + 3]).toBe(colT);
      }
      // two triangles, indices confined to this star's own 4 verts
      for (let k = 0; k < 6; k++) {
        const idx = b.indices[i * 6 + k];
        expect(idx).toBeGreaterThanOrEqual(i * 4);
        expect(idx).toBeLessThan(i * 4 + 4);
      }
    }
  });

  it("indices exceed 16-bit range at full catalog size (needs 32-bit)", () => {
    const b = buildStarBillboards(buildStarField(20000, 400, 1));
    expect(b.indices).toBeInstanceOf(Uint32Array);
    expect(Math.max(...Array.from(b.indices.slice(-6)))).toBeGreaterThan(65535);
  });

  it("keeps points within the shell radius and meta in range", () => {
    const radius = 400;
    const f = buildStarField(2000, radius, 3);
    for (let i = 0; i < f.count; i++) {
      const d = Math.hypot(
        f.positions[i * 3],
        f.positions[i * 3 + 1],
        f.positions[i * 3 + 2],
      );
      expect(d).toBeLessThanOrEqual(radius + 1e-3);
      expect(d).toBeGreaterThan(0);
      const size = f.meta[i * 2];
      const colorT = f.meta[i * 2 + 1];
      expect(size).toBeGreaterThanOrEqual(0.3);
      expect(size).toBeLessThanOrEqual(1.0);
      expect(colorT).toBeGreaterThanOrEqual(0);
      expect(colorT).toBeLessThanOrEqual(1);
    }
  });
});
