/**
 * PF-10 C4.2 — virtual-texture tile selection.
 *
 * The assertion this file exists for is the one about LEVEL 5: the source pack ships it, it is
 * the bulk of 105 MB, and the fixed arrival camera cannot resolve a single texel of it. That is a
 * measurement, and a measurement that saves ~75% of an asset's weight deserves a test rather than
 * a comment, because "why don't we ship the highest level we have?" is a question someone will
 * reasonably ask again later.
 */
import { describe, expect, it } from "vitest";
import {
  VT_BODIES,
  VT_MAX_LEVEL,
  VT_TILE_PX,
  levelForViewport,
  levelWidthPx,
  subCameraUV,
  tileAt,
  tileGrid,
  tilesForPatch,
} from "@/lib/planet-vt";
import { PLANET_SPHERE_RADIUS } from "@/lib/planet-sphere";
import { ARRIVE_STANDOFF } from "@/lib/ship-dynamics";

/** The visible surface patch, recomputed here from the real camera geometry rather than
 * hardcoded, so the tests break if either constant moves. */
function visiblePatchDegrees(R: number, d: number, fov: number) {
  const halfFov = fov / 2;
  let lo = 0;
  let hi = Math.PI / 2;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if ((R * Math.sin(m)) / (d - R * Math.cos(m)) < Math.tan(halfFov)) lo = m;
    else hi = m;
  }
  return ((lo * 180) / Math.PI) * 2;
}

describe("the level-5 decision (the point of this module)", () => {
  const patch = visiblePatchDegrees(PLANET_SPHERE_RADIUS, ARRIVE_STANDOFF, 0.8);

  it("derives a visible patch of ~23.5 degrees from the real fixed camera geometry", () => {
    // The camera parks at ARRIVE_STANDOFF from a PLANET_SPHERE_RADIUS sphere and cannot zoom,
    // so this number is a property of the scene, not a tuning choice.
    expect(patch).toBeGreaterThan(20);
    expect(patch).toBeLessThan(27);
  });

  it("confirms the planet OVERFLOWS the screen at arrival", () => {
    // 12 world units above the surface: the sphere subtends far more than the 45.8 degree FOV,
    // which is why surface texel density matters so much here.
    const angularDiameter =
      (2 * Math.asin(PLANET_SPHERE_RADIUS / ARRIVE_STANDOFF) * 180) / Math.PI;
    expect(angularDiameter).toBeGreaterThan(0.8 * (180 / Math.PI));
  });

  it("shows the shipped 4096 surface map is genuinely insufficient", () => {
    // 268 texels across a patch that fills a 1080-px viewport — a 4x magnification. This is the
    // measurement that justified the ultra tier and this whole module.
    const texels = (patch * 4096) / 360;
    expect(texels).toBeLessThan(400);
    expect(texels / 1080).toBeLessThan(0.35);
  });

  it("caps the pyramid at level 4, because level 5 is unreachable", () => {
    expect(VT_MAX_LEVEL).toBe(4);
    // Level 4 delivers 2,143 texels across the patch. Stated precisely, because the first draft
    // of this module's header claimed it "satisfies 4K" and it is actually 0.8% SHORT of a
    // 2160-px viewport — comfortably past 1080p and 1440p, and at effective parity with 4K.
    const l4 = (patch * levelWidthPx(4)) / 360;
    expect(l4).toBeGreaterThan(2100);
    expect(l4).toBeLessThan(2160);
    // Level 5 would supply 4,286 — roughly double what even a 4K viewport can show, so every
    // one of its 2,048 tiles would only ever be downsampled by the GPU. That is the whole case
    // for not shipping it.
    expect((patch * levelWidthPx(5)) / 360).toBeGreaterThan(2 * 2160 * 0.9);
    // Each level doubles, and BOTH land ~1% under their nominal target: level 3 gives 1,070
    // against 1080p's 1,080, level 4 gives 2,143 against 4K's 2,160. So the selector honestly
    // steps UP a level rather than claiming a marginal miss is good enough — 1080p resolves at
    // level 4, and 4K clamps there too because level 5 is not shipped.
    const l3 = (patch * levelWidthPx(3)) / 360;
    expect(l3).toBeGreaterThan(1050);
    expect(l3).toBeLessThan(1080);
    expect(levelForViewport(patch, 1080)).toBe(4);
    expect(levelForViewport(patch, 720)).toBe(3); // 720p is genuinely satisfied by level 3
    expect(levelForViewport(patch, 2160)).toBe(VT_MAX_LEVEL); // clamped, not level 5
  });

  it("returns the deepest shipped level rather than an unbuildable one when asked for more", () => {
    expect(levelForViewport(patch, 100000)).toBe(VT_MAX_LEVEL);
  });
});

describe("tile grid", () => {
  it("matches the real source packs' layout", () => {
    // Verified against the real directories: level0 has 2 tiles, level1 8, level2 32, level5 2048.
    expect(tileGrid(0)).toEqual({ cols: 2, rows: 1 });
    expect(tileGrid(1)).toEqual({ cols: 4, rows: 2 });
    expect(tileGrid(2)).toEqual({ cols: 8, rows: 4 });
    expect(tileGrid(5).cols * tileGrid(5).rows).toBe(2048);
  });

  it("keeps every level 2:1, as equirectangular requires", () => {
    for (let l = 0; l <= VT_MAX_LEVEL; l++) {
      const { cols, rows } = tileGrid(l);
      expect(cols).toBe(rows * 2);
      expect(levelWidthPx(l)).toBe(cols * VT_TILE_PX);
    }
  });

  it("puts level 0 at 2048x1024 and level 4 at 32768x16384", () => {
    expect(levelWidthPx(0)).toBe(2048);
    expect(levelWidthPx(4)).toBe(32768);
  });
});

describe("tileAt", () => {
  it("names files the way both the source pack and the bake output do", () => {
    expect(tileAt(2, 3, 1).file).toBe("tx_3_1.jpg");
  });

  it("wraps longitude and clamps latitude — the sphere's own topology", () => {
    // Past the antimeridian the surface continues; past the pole it does not.
    expect(tileAt(1, 4, 0).col).toBe(0);
    expect(tileAt(1, -1, 0).col).toBe(3);
    expect(tileAt(1, 0, 5).row).toBe(1);
    expect(tileAt(1, 0, -3).row).toBe(0);
  });

  it("reports a UV rect that tiles the map exactly", () => {
    const { cols, rows } = tileGrid(2);
    let area = 0;
    for (let c = 0; c < cols; c++)
      for (let r = 0; r < rows; r++) {
        const [u0, v0, u1, v1] = tileAt(2, c, r).uv;
        area += (u1 - u0) * (v1 - v0);
      }
    expect(area).toBeCloseTo(1, 9); // the tiles exactly cover UV space, no gaps or overlap
  });
});

describe("subCameraUV", () => {
  it("puts a camera on +X at the equator", () => {
    const [, v] = subCameraUV([10, 0, 0], [0, 0, 0], 0);
    expect(v).toBeCloseTo(0.5, 6); // equator is halfway pole-to-pole
  });

  it("puts a camera above the north pole at v = 0", () => {
    const [, v] = subCameraUV([0, 10, 0], [0, 0, 0], 0);
    expect(v).toBeCloseTo(0, 6);
  });

  it("tracks the body's spin, because the tile grid is fixed to the SURFACE", () => {
    // A stationary camera over a turning planet looks at successively different tiles.
    const still = subCameraUV([10, 0, 0], [0, 0, 0], 0)[0];
    const spun = subCameraUV([10, 0, 0], [0, 0, 0], Math.PI)[0];
    expect(Math.abs(spun - still)).toBeCloseTo(0.5, 6);
  });

  it("always returns u in [0,1)", () => {
    for (const spin of [-10, -1, 0, 1, 7, 100]) {
      const [u] = subCameraUV([3, -4, 5], [0, 0, 0], spin);
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
    }
  });
});

describe("tilesForPatch", () => {
  it("returns a small working set, not the whole level", () => {
    // The streaming design only pays if the visible patch is a handful of tiles. At level 4 the
    // grid is 32x16 = 512; if this returned dozens the whole approach would be wrong.
    const tiles = tilesForPatch([0.5, 0.5], 23.5, 4);
    expect(tiles.length).toBeGreaterThan(0);
    // At level 4 each tile spans 11.25 degrees, so a 23.5-degree patch covers ~2.1 tiles per
    // axis and straddles 3-4 depending on alignment — 16 is the genuine worst case, not 9 as a
    // first draft of this test assumed. Against a 512-tile level, 16 is still a small working
    // set, which is the property that makes streaming worth doing at all.
    expect(tiles.length).toBeLessThanOrEqual(16);
  });

  it("orders tiles nearest-first so the middle of the view resolves first", () => {
    const tiles = tilesForPatch([0.5, 0.5], 23.5, 4);
    const dist = (t: (typeof tiles)[number]) =>
      ((t.uv[0] + t.uv[2]) / 2 - 0.5) ** 2 +
      ((t.uv[1] + t.uv[3]) / 2 - 0.5) ** 2;
    for (let i = 1; i < tiles.length; i++) {
      expect(dist(tiles[i])).toBeGreaterThanOrEqual(dist(tiles[i - 1]));
    }
  });

  it("never returns duplicates at the antimeridian seam", () => {
    // A patch straddling u=0 wraps to the same tiles from both sides; the seen-set must dedupe.
    const tiles = tilesForPatch([0.0, 0.5], 23.5, 1);
    const ids = tiles.map((t) => `${t.col}_${t.row}`);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("never returns duplicates at a pole", () => {
    const tiles = tilesForPatch([0.5, 0.0], 23.5, 2);
    const ids = tiles.map((t) => `${t.col}_${t.row}`);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("VT_BODIES", () => {
  it("covers exactly the two bodies with a real local elevation pyramid", () => {
    expect(Object.keys(VT_BODIES).sort()).toEqual(["mars", "moon"]);
    for (const b of Object.values(VT_BODIES)) {
      expect(b.maxLevel).toBe(VT_MAX_LEVEL);
    }
  });
});
