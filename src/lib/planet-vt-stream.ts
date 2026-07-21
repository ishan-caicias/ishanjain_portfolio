/* planet-vt-stream.ts — PF-10 C4.2: the runtime virtual-texture streamer.
 *
 * WHAT TR-077 STOPPED ON, AND WHAT RETIRED IT. That report declined to build this, on the
 * reasoning that correct multi-tile virtual texturing needs a tile atlas PLUS an indirection
 * lookup, and that the half-measures (bind one tile; bind four fixed samplers) look like
 * rendering defects. The first half of that was right and the second half was avoidable:
 * measuring the actual working set showed the visible tiles always form a CONTIGUOUS RECTANGLE
 * in the tile grid — worst case 3x3 at level 3, 4x4 at level 4, checked across 400 sub-camera
 * positions (see planet-vt.ts's `patchRect`).
 *
 * A contiguous rectangle needs no indirection table. Compose those tiles into ONE texture, hand
 * the shader the UV rect that atlas covers, and the lookup collapses to a subtract-and-divide.
 * That is the whole design, and it is why this file is short.
 *
 * EVERYTHING HERE IS FAILURE-TOLERANT BY CONSTRUCTION. The base sphere is already on screen and
 * already correct before any tile is fetched; detail is strictly additive. A failed tile leaves
 * its patch of the atlas transparent-black, which the shader reads as a zero normal perturbation
 * — i.e. exactly the base surface. A failed atlas leaves `uHasDetail` at 0. Nothing here can
 * blank or corrupt a body that was rendering a moment ago, which is the property that lets it
 * run speculatively on arrival.
 */
import type { PatchRect } from "./planet-vt";

/** Concurrent tile fetches. Deliberately modest: the working set is at most 16 tiles and they
 * are only wanted once per arrival, so saturating the connection pool would compete with the
 * ultra colour map (4-6 MB) that is usually in flight at the same moment and matters more. */
export const TILE_FETCH_CONCURRENCY = 4;

/** Composed-atlas edge cap in pixels. A 4x4 rect of 1024-px tiles is 4096 — fine on desktop, and
 * on a device that cannot allocate it the streamer degrades to the base surface rather than
 * failing loudly. */
export const MAX_ATLAS_PX = 4096;

export interface AtlasResult {
  canvas: HTMLCanvasElement;
  /** Tiles that actually arrived; the rest are left as base surface. */
  loaded: number;
  requested: number;
}

/** Fetch one tile as an ImageBitmap, or null if it is missing/undecodable.
 *
 * Never throws: a 404 on one tile of a 16-tile patch must cost that tile's detail and nothing
 * else. The packs are complete today, but a partially-deployed asset directory is exactly the
 * kind of thing that should degrade rather than break. */
export async function fetchTile(url: string): Promise<ImageBitmap | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await createImageBitmap(await res.blob());
  } catch {
    return null;
  }
}

/** Compose a patch rect's tiles into a single atlas canvas.
 *
 * `baseUrl` is the body's tile root; tiles resolve to `<baseUrl>/level<N>/<file>`. Returns null
 * when the atlas would exceed MAX_ATLAS_PX or no tile at all could be fetched — both cases the
 * caller treats as "no detail this time", never as an error. */
export async function composeAtlas(
  rect: PatchRect,
  baseUrl: string,
  tilePx: number,
  fetchFn: (url: string) => Promise<ImageBitmap | null> = fetchTile,
  // Injectable purely so the composition logic is testable: jsdom returns no 2D context without
  // the native `canvas` package, so without this seam every test here would exercise only the
  // null-context early return. Production always uses the default.
  makeCanvas: () => HTMLCanvasElement = () => document.createElement("canvas"),
): Promise<AtlasResult | null> {
  const width = rect.cols * tilePx;
  const height = rect.rows * tilePx;
  if (width > MAX_ATLAS_PX || height > MAX_ATLAS_PX) return null;

  const canvas = makeCanvas();
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  // A device that cannot give a 2D context gets no detail — never an exception. This is a real
  // production path, not only a test one.
  if (!ctx) return null;
  // Neutral tangent-space normal (0,0,1) encodes to (128,128,255). Filling with THIS rather than
  // black matters: a tile that fails to load then reads as "flat", not as a violent normal flip.
  ctx.fillStyle = "rgb(128,128,255)";
  ctx.fillRect(0, 0, width, height);

  let loaded = 0;
  const queue = rect.tiles.map((t, i) => ({ t, i }));
  const workers = Array.from(
    { length: Math.min(TILE_FETCH_CONCURRENCY, queue.length) },
    async () => {
      for (;;) {
        const job = queue.shift();
        if (!job) return;
        const bmp = await fetchFn(
          `${baseUrl}/level${rect.level}/${job.t.file}`,
        );
        if (!bmp) continue;
        const col = job.i % rect.cols;
        const row = Math.floor(job.i / rect.cols);
        ctx.drawImage(bmp, col * tilePx, row * tilePx, tilePx, tilePx);
        bmp.close?.();
        loaded++;
      }
    },
  );
  await Promise.all(workers);
  if (loaded === 0) return null;
  return { canvas, loaded, requested: rect.tiles.length };
}

/** Whether a newly-computed rect differs enough from the bound one to be worth re-streaming.
 *
 * The sub-camera point drifts continuously as a body rotates, so without this the streamer would
 * rebuild a 16-tile atlas every frame. Re-streaming only when the TILE rect actually changes
 * means a rebuild happens on the order of once per tile-width of rotation — for Mars at ~89 s per
 * revolution and 32 columns at level 4, roughly every 2.8 s, and never at all while parked at a
 * tidally-locked or slow body. */
export function rectChanged(a: PatchRect | null, b: PatchRect | null): boolean {
  if (!a || !b) return a !== b;
  return (
    a.level !== b.level ||
    a.col0 !== b.col0 ||
    a.row0 !== b.row0 ||
    a.cols !== b.cols ||
    a.rows !== b.rows
  );
}
