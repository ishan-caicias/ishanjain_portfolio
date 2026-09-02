/* planet-vt.ts — PF-10 C4.2: virtual-texture tile selection for planetary elevation detail.
 *
 * WHY THIS EXISTS, AS A MEASUREMENT RATHER THAN AN ASPIRATION.
 *
 * The camera parks at a FIXED distance on arrival — `ARRIVE_STANDOFF` = 38 world units from a
 * sphere of radius 26, twelve units above the surface — and the engine has no zoom, dolly or
 * wheel handler anywhere. That makes the worst-case magnification a constant, not a guess, and it
 * can be computed exactly:
 *
 *   sphere angular diameter   86.3°   against a 45.8° FOV  (the planet overflows the screen)
 *   visible surface patch     23.5°   across
 *
 *   surface map      texels across that patch     verdict
 *   4096 (shipped)        268                     4x magnified at 1080p — visibly soft
 *   8192 (source)         536                     2x magnified — better, still short
 *   VT level 3          1,070                     ~1% under 1080p parity
 *   VT level 4          2,143                     ~1% under 4K parity; comfortably past 1440p
 *   VT level 5          4,286                     BEYOND what this camera can ever resolve
 *
 * (Both shipped levels land just under their nominal target rather than just over — the pyramid
 * doubles, and 23.5° does not divide neatly into it. `levelForViewport` therefore steps UP on a
 * marginal miss rather than treating "close enough" as satisfied, so a 1080p viewport resolves
 * at level 4 and only 720p is served by level 3. The first draft of this table claimed level 3
 * "satisfies 1080p" and level 4 "satisfies 4K"; the unit tests caught both.)
 *
 * Two decisions follow, both from that table rather than from taste:
 *
 *   1. Virtual texturing genuinely pays here. The shipped map really is insufficient; this is not
 *      gold-plating.
 *   2. **Level 5 is never shipped.** It is 2,048 tiles and the bulk of the source pack's 105 MB,
 *      and the camera physically cannot get close enough to resolve a single texel of it. Levels
 *      0–4 are the whole useful pyramid.
 *
 * WHAT IS STREAMED IS NORMALS, NOT HEIGHTS — and that is Astra's finding, not a preference.
 * The MOLA pyramid is 8-bit JPEG, and at level 5 the vertical quantization implies a **14.4°
 * minimum representable slope step** (a real level-5 tile was measured spanning just 14 distinct
 * byte values across 1024²). Differentiating that in a shader produces terracing. Quantization
 * error is catastrophic in heights, because they are differentiated, and benign in normals,
 * because they are consumed directly — so the normals are baked offline with a wide Sobel by
 * `scripts/build-planet-vt.mjs`, and the runtime streams those.
 *
 * This module is the pure half: which tiles cover the patch under the camera, at which level.
 * No DOM, no Babylon, fully unit-testable.
 */

/** Tile edge in pixels, fixed by the source packs (both Mars and Moon ship 1024). */
export const VT_TILE_PX = 1024;

/** Deepest level shipped. See the header table: level 5 exists in the source pack and is
 * deliberately not built, because this camera cannot resolve it. */
export const VT_MAX_LEVEL = 4;

/** Tile grid at a level: equirectangular is 2:1, so level n is (2·2^n) × (1·2^n) tiles. */
export function tileGrid(level: number): { cols: number; rows: number } {
  return { cols: 2 << level, rows: 1 << level };
}

/** Full equirectangular width in pixels at a level — level 0 is 2048×1024. */
export function levelWidthPx(level: number): number {
  return tileGrid(level).cols * VT_TILE_PX;
}

/** The shallowest level whose texel density meets `neededTexels` across the visible patch.
 *
 * Clamped to VT_MAX_LEVEL, so a 4K viewport asking for more simply gets the deepest shipped
 * level rather than a request for tiles that do not exist. */
export function levelForViewport(
  patchDegrees: number,
  neededTexels: number,
): number {
  for (let level = 0; level <= VT_MAX_LEVEL; level++) {
    if ((patchDegrees * levelWidthPx(level)) / 360 >= neededTexels)
      return level;
  }
  return VT_MAX_LEVEL;
}

/** A tile's identity and its UV rectangle within the full equirectangular map. */
export interface VtTile {
  level: number;
  col: number;
  row: number;
  /** Filename as both source pack and baked output use: `tx_<col>_<row>.jpg`. */
  file: string;
  /** UV rect [u0, v0, u1, v1] this tile occupies in the whole-map UV space. */
  uv: [number, number, number, number];
}

export function tileAt(level: number, col: number, row: number): VtTile {
  const { cols, rows } = tileGrid(level);
  // Longitude wraps; latitude does not. A tile request past the poles is clamped, past the
  // antimeridian is wrapped — the same asymmetry the sphere's own topology has.
  const c = ((col % cols) + cols) % cols;
  const r = Math.min(rows - 1, Math.max(0, row));
  return {
    level,
    col: c,
    row: r,
    file: `tx_${c}_${r}.jpg`,
    uv: [c / cols, r / rows, (c + 1) / cols, (r + 1) / rows],
  };
}

/** Sub-camera point (the surface point directly beneath the camera) in UV space, given the
 * camera and body positions in world space and the body's current spin about its polar axis.
 *
 * Mirrors the sphere's own equirect convention: u = longitude/2π, v = pole-to-pole. The body's
 * rotation is subtracted, because the tile grid is fixed to the SURFACE — as the planet turns,
 * a stationary camera looks at successively different tiles. */
export function subCameraUV(
  camera: readonly [number, number, number],
  body: readonly [number, number, number],
  spinRad: number,
): [number, number] {
  const dx = camera[0] - body[0];
  const dy = camera[1] - body[1];
  const dz = camera[2] - body[2];
  const len = Math.hypot(dx, dy, dz) || 1;
  const nx = dx / len;
  const ny = dy / len;
  const nz = dz / len;
  // Babylon's CreateSphere maps v from +Y (v=0) to −Y (v=1), and u around the Y axis.
  const v = Math.acos(Math.max(-1, Math.min(1, ny))) / Math.PI;
  let u = Math.atan2(nz, nx) / (2 * Math.PI) - spinRad / (2 * Math.PI);
  u = ((u % 1) + 1) % 1;
  return [u, v];
}

/** Tiles covering a patch of `patchDegrees` centred on `uv`, at `level`.
 *
 * Returns them nearest-first, so a streamer that is still loading shows the middle of the view
 * before the edges — the ordering matters more than it looks when four tiles are in flight and
 * the visitor is looking straight down at one of them. */
export function tilesForPatch(
  uv: readonly [number, number],
  patchDegrees: number,
  level: number,
): VtTile[] {
  const { cols, rows } = tileGrid(level);
  const halfU = patchDegrees / 2 / 360;
  // Latitude spans 180°, so the same angular patch is twice as many v units as u units.
  const halfV = patchDegrees / 2 / 180;

  const c0 = Math.floor((uv[0] - halfU) * cols);
  const c1 = Math.floor((uv[0] + halfU) * cols);
  const r0 = Math.floor((uv[1] - halfV) * rows);
  const r1 = Math.floor((uv[1] + halfV) * rows);

  const seen = new Set<string>();
  const out: VtTile[] = [];
  for (let r = r0; r <= r1; r++) {
    for (let c = c0; c <= c1; c++) {
      const t = tileAt(level, c, r);
      const id = `${t.col}_${t.row}`;
      if (seen.has(id)) continue; // wrapping/clamping can collide at the seam and the poles
      seen.add(id);
      out.push(t);
    }
  }
  const cu = uv[0];
  const cv = uv[1];
  out.sort((a, b) => {
    const da =
      ((a.uv[0] + a.uv[2]) / 2 - cu) ** 2 + ((a.uv[1] + a.uv[3]) / 2 - cv) ** 2;
    const db =
      ((b.uv[0] + b.uv[2]) / 2 - cu) ** 2 + ((b.uv[1] + b.uv[3]) / 2 - cv) ** 2;
    return da - db;
  });
  return out;
}

/** The visible tile set as a RECTANGLE, which is what makes the streamer simple enough to build
 * correctly rather than partially.
 *
 * TR-077 stopped short of a runtime streamer on the reasoning that multi-tile virtual texturing
 * needs a tile atlas plus an indirection lookup. Measuring the actual working set retired half of
 * that: because the camera's visible patch is a single contiguous region of the sphere, the tiles
 * covering it always form a contiguous rectangle in the grid — worst case **3x3 at level 3 and
 * 4x4 at level 4**, checked across 400 sub-camera positions. A contiguous rectangle needs no
 * indirection table at all: compose those tiles into ONE texture and hand the shader the UV rect
 * it occupies, and the lookup is a single subtract-and-divide.
 *
 * Returns the tile rect, the UV rect it covers, and the composed atlas dimensions. */
export interface PatchRect {
  level: number;
  /** Leftmost tile column (may be negative or past `cols` — callers wrap via `tileAt`). */
  col0: number;
  row0: number;
  /** Tile counts, so the atlas is (cols x VT_TILE_PX) by (rows x VT_TILE_PX). */
  cols: number;
  rows: number;
  /** UV rect the composed atlas covers: [u0, v0, u1, v1]. u1 may exceed 1 across the seam. */
  uv: [number, number, number, number];
  /** Tiles in row-major order — the order they must be drawn into the atlas. */
  tiles: VtTile[];
}

export function patchRect(
  uv: readonly [number, number],
  patchDegrees: number,
  level: number,
): PatchRect {
  const grid = tileGrid(level);
  const halfU = patchDegrees / 2 / 360;
  const halfV = patchDegrees / 2 / 180;
  const col0 = Math.floor((uv[0] - halfU) * grid.cols);
  const col1 = Math.floor((uv[0] + halfU) * grid.cols);
  const row0 = Math.max(0, Math.floor((uv[1] - halfV) * grid.rows));
  const row1 = Math.min(grid.rows - 1, Math.floor((uv[1] + halfV) * grid.rows));
  const cols = col1 - col0 + 1;
  const rows = row1 - row0 + 1;

  const tiles: VtTile[] = [];
  for (let r = row0; r <= row1; r++) {
    for (let c = col0; c <= col1; c++) tiles.push(tileAt(level, c, r));
  }
  return {
    level,
    col0,
    row0,
    cols,
    rows,
    // Deliberately NOT wrapped into [0,1): the rect must stay monotonic for the shader's
    // subtract-and-divide to work across the antimeridian. The shader wraps the sample instead.
    uv: [
      col0 / grid.cols,
      row0 / grid.rows,
      (col1 + 1) / grid.cols,
      (row1 + 1) / grid.rows,
    ],
    tiles,
  };
}

/** Bodies with a real elevation virtual texture in the local packs, and the deepest level each
 * actually ships. Mars's pack has 6 levels (0–5) and the Moon's 5 (0–4); both are capped at
 * VT_MAX_LEVEL for the reason in the header, which happens to be the Moon's natural maximum. */
export const VT_BODIES: Record<string, { maxLevel: number; source: string }> = {
  mars: { maxLevel: VT_MAX_LEVEL, source: "vt-mars-topography-mola" },
  moon: { maxLevel: VT_MAX_LEVEL, source: "vt-moon-topography-nasa" },
};
