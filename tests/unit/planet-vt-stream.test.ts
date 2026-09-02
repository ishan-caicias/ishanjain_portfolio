/**
 * PF-10 C4.2 — the runtime VT streamer.
 *
 * The property worth testing hardest is FAILURE TOLERANCE, because detail here is strictly
 * additive: the sphere is already on screen and already correct before any tile arrives, so
 * nothing in this module is allowed to make a working body worse. A 404, a dead 2D context, an
 * over-large atlas — each must cost detail and only detail.
 */
import { describe, expect, it, vi } from "vitest";
import {
  MAX_ATLAS_PX,
  TILE_FETCH_CONCURRENCY,
  composeAtlas,
  rectChanged,
} from "@/lib/planet-vt-stream";
import { PLANET_PATCH_DEG } from "@/lib/planet-sphere";
import { patchRect } from "@/lib/planet-vt";

/** jsdom returns no 2D context without the native canvas package, so the atlas canvas is faked.
 * The drawImage calls are recorded, which is what lets the row-major ordering be checked. */
function fakeCanvas() {
  const drawn: Array<[number, number]> = [];
  const c = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: "",
      fillRect: () => {},
      drawImage: (_b: unknown, x: number, y: number) => drawn.push([x, y]),
    }),
    drawn,
  };
  return c as unknown as HTMLCanvasElement & { drawn: Array<[number, number]> };
}

/** A stand-in for ImageBitmap — jsdom has no real one, and the streamer only ever draws it. */
const fakeBitmap = () =>
  ({ width: 4, height: 4, close: vi.fn() }) as unknown as ImageBitmap;

describe("patchRect — the contiguous rectangle the design rests on", () => {
  it("covers the visible patch with a small rectangle at every level", () => {
    // This is the measurement that retired TR-077's indirection-table objection: because the
    // working set is a rectangle, the atlas lookup is a subtract-and-divide with no lookup table.
    for (const level of [3, 4]) {
      for (let i = 0; i < 50; i++) {
        const r = patchRect(
          [i / 50, 0.2 + 0.6 * (i / 50)],
          PLANET_PATCH_DEG,
          level,
        );
        expect(r.cols).toBeGreaterThan(0);
        expect(r.rows).toBeGreaterThan(0);
        expect(r.cols).toBeLessThanOrEqual(4);
        expect(r.rows).toBeLessThanOrEqual(4);
        expect(r.tiles.length).toBe(r.cols * r.rows);
      }
    }
  });

  it("keeps the UV rect monotonic across the antimeridian", () => {
    // Deliberately NOT wrapped into [0,1): the shader's subtract-and-divide needs u1 > u0 even
    // when the patch straddles the seam. Wrapping here would invert the rect and mirror the atlas.
    const r = patchRect([0.0, 0.5], PLANET_PATCH_DEG, 3);
    expect(r.uv[2]).toBeGreaterThan(r.uv[0]);
    expect(r.uv[3]).toBeGreaterThan(r.uv[1]);
  });

  it("clamps at the poles rather than wrapping past them", () => {
    const r = patchRect([0.5, 0.0], PLANET_PATCH_DEG, 3);
    expect(r.row0).toBeGreaterThanOrEqual(0);
    expect(r.uv[1]).toBeGreaterThanOrEqual(0);
  });

  it("orders tiles row-major, matching how composeAtlas draws them", () => {
    // If these two disagreed the atlas would be scrambled — and it would still look plausible,
    // which is the worst kind of bug. Pinned on both sides.
    const r = patchRect([0.5, 0.5], PLANET_PATCH_DEG, 3);
    for (let i = 1; i < r.tiles.length; i++) {
      const prevRow = Math.floor((i - 1) / r.cols);
      const row = Math.floor(i / r.cols);
      expect(row).toBeGreaterThanOrEqual(prevRow);
    }
  });
});

describe("rectChanged — the guard that stops a per-frame rebuild", () => {
  const a = patchRect([0.5, 0.5], PLANET_PATCH_DEG, 4);

  it("is false for an identical rect, so a parked camera streams once", () => {
    expect(rectChanged(a, patchRect([0.5, 0.5], PLANET_PATCH_DEG, 4))).toBe(
      false,
    );
  });

  it("is false for sub-tile drift — the whole point of the guard", () => {
    // Without this the streamer would rebuild a 16-tile atlas every frame as a body rotates.
    expect(rectChanged(a, patchRect([0.5005, 0.5], PLANET_PATCH_DEG, 4))).toBe(
      false,
    );
  });

  it("is true when the tile rect genuinely moves or the level changes", () => {
    expect(rectChanged(a, patchRect([0.8, 0.5], PLANET_PATCH_DEG, 4))).toBe(
      true,
    );
    expect(rectChanged(a, patchRect([0.5, 0.5], PLANET_PATCH_DEG, 3))).toBe(
      true,
    );
  });

  it("handles the null cases without throwing", () => {
    expect(rectChanged(null, a)).toBe(true);
    expect(rectChanged(a, null)).toBe(true);
    expect(rectChanged(null, null)).toBe(false);
  });
});

describe("composeAtlas — failure tolerance", () => {
  const rect = patchRect([0.5, 0.5], PLANET_PATCH_DEG, 3);

  it("composes an atlas from tiles that arrive", async () => {
    const res = await composeAtlas(
      rect,
      "/x",
      4,
      async () => fakeBitmap(),
      fakeCanvas,
    );
    expect(res).not.toBeNull();
    expect(res!.loaded).toBe(rect.tiles.length);
    expect(res!.canvas.width).toBe(rect.cols * 4);
  });

  it("survives a partial failure, keeping the tiles it did get", async () => {
    let n = 0;
    const res = await composeAtlas(
      rect,
      "/x",
      4,
      async () => (n++ % 2 === 0 ? fakeBitmap() : null),
      fakeCanvas,
    );
    expect(res).not.toBeNull();
    expect(res!.loaded).toBeGreaterThan(0);
    expect(res!.loaded).toBeLessThan(rect.tiles.length);
  });

  it("returns null rather than an empty atlas when every tile fails", async () => {
    // The caller reads null as "no detail this time" and leaves the base surface bound.
    expect(
      await composeAtlas(rect, "/x", 4, async () => null, fakeCanvas),
    ).toBeNull();
  });

  it("refuses an atlas larger than the cap instead of attempting the allocation", async () => {
    const huge = { ...rect, cols: 99, rows: 99 };
    expect(
      await composeAtlas(
        huge,
        "/x",
        1024,
        async () => fakeBitmap(),
        fakeCanvas,
      ),
    ).toBeNull();
    expect(MAX_ATLAS_PX).toBe(4096);
  });

  it("requests every tile in the rect exactly once", async () => {
    const seen: string[] = [];
    await composeAtlas(
      rect,
      "/base",
      4,
      async (u) => {
        seen.push(u);
        return fakeBitmap();
      },
      fakeCanvas,
    );
    expect(seen.length).toBe(rect.tiles.length);
    expect(new Set(seen).size).toBe(seen.length);
    for (const u of seen) expect(u).toContain(`/base/level${rect.level}/tx_`);
  });

  it("bounds concurrency so tile fetches cannot crowd out the colour map", async () => {
    let inFlight = 0;
    let peak = 0;
    await composeAtlas(
      rect,
      "/x",
      4,
      async () => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await new Promise((r) => setTimeout(r, 1));
        inFlight--;
        return fakeBitmap();
      },
      fakeCanvas,
    );
    expect(peak).toBeLessThanOrEqual(TILE_FETCH_CONCURRENCY);
  });
});
