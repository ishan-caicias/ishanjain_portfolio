/**
 * PF-11 D6.6a — patch-atlas.mjs pure geometry (the image-compositing/file-IO parts are exercised
 * by actually running the script, not unit-tested; see its own --verify mode).
 */
import { describe, expect, it } from "vitest";
import {
  PATCHES,
  slotToPixel,
  slotToUv,
  stalePatches,
} from "../../scripts/patch-atlas.mjs";

describe("patch-atlas geometry", () => {
  it("maps the four 2x2 sub-slots to distinct, non-overlapping pixel regions", () => {
    const seen = new Set<string>();
    for (const [col, row] of [
      [0, 0],
      [1, 0],
      [0, 1],
      [1, 1],
    ]) {
      const { x, y } = slotToPixel([col, row]);
      const key = `${x},${y}`;
      expect(seen.has(key)).toBe(false);
      seen.add(key);
    }
  });

  it("keeps every configured patch's cell inside the free macro-cell's pixel bounds", () => {
    // The free macro-cell is [512, 768) x [512+256, 768+256) = [512,768) horiz, [768,1024) vert.
    for (const p of PATCHES) {
      const slot = p.slot as [number, number];
      const { x, y } = slotToPixel(slot);
      expect(x).toBeGreaterThanOrEqual(512);
      expect(x + 128).toBeLessThanOrEqual(768);
      expect(y).toBeGreaterThanOrEqual(768);
      expect(y + 128).toBeLessThanOrEqual(1024);
    }
  });

  it("slotToUv matches slotToPixel divided by the atlas size (4096)", () => {
    for (const p of PATCHES) {
      const slot = p.slot as [number, number];
      const px = slotToPixel(slot);
      const uv = slotToUv(slot);
      expect(uv[0]).toBeCloseTo(px.x / 4096, 9);
      expect(uv[1]).toBeCloseTo(px.y / 4096, 9);
      expect(uv[2]).toBeCloseTo(128 / 4096, 9);
      expect(uv[3]).toBeCloseTo(128 / 4096, 9);
    }
  });

  it("configures exactly the three D6.6a bodies, each with a distinct slot", () => {
    const ids = PATCHES.map((p) => p.id);
    expect(ids.sort()).toEqual(["dione", "rhea", "tethys"]);
    const slots = new Set(PATCHES.map((p) => p.slot.join(",")));
    expect(slots.size).toBe(PATCHES.length);
  });
});

/**
 * 2026-07-29 code review, finding 5: default mode re-encoded the whole 4096x4096 atlas
 * unconditionally, so a second `npm run assets:atlas` generation-lossed every one of the ~260
 * already-shipped cells. Default mode now applies only what genuinely changed; this pins that
 * decision without touching any image file.
 */
describe("stalePatches — default mode is a no-op when nothing changed", () => {
  // `patch-atlas.mjs` is plain JS with no type declarations (like the other `scripts/` modules
  // this suite imports), so the shape is declared here rather than inferred from it.
  interface Patch {
    id: string;
    source: string;
    slot: number[];
  }
  const ids = (ps: Patch[]) => ps.map((p) => p.id);
  const P: Patch[] = [
    { id: "tethys", source: "a.jpg", slot: [0, 0] },
    { id: "dione", source: "b.jpg", slot: [1, 0] },
  ];
  const present = { tethys: [0, 0, 0, 0], dione: [0, 0, 0, 0] };
  const ATLAS_T = 1000;
  const olderSources = () => 500;

  it("returns NOTHING when every cell is present and no source is newer than the atlas", () => {
    expect(stalePatches(P, present, ATLAS_T, olderSources)).toEqual([]);
  });

  it("returns only the patch whose atlas-map entry is missing", () => {
    const partial = { tethys: [0, 0, 0, 0] };
    expect(ids(stalePatches(P, partial, ATLAS_T, olderSources))).toEqual([
      "dione",
    ]);
  });

  it("returns a present patch again once its SOURCE image is newer than the atlas", () => {
    const newerB = (s: string) => (s === "b.jpg" ? 2000 : 500);
    expect(ids(stalePatches(P, present, ATLAS_T, newerB))).toEqual(["dione"]);
  });

  it("treats a missing atlas or unreadable source as 'not newer', never as stale-by-accident", () => {
    // mtimeMs returns null on a missing file; a null must not read as "newer than", which
    // would silently reinstate the unconditional re-encode this fix removes.
    expect(stalePatches(P, present, null, olderSources)).toEqual([]);
    expect(stalePatches(P, present, ATLAS_T, () => null)).toEqual([]);
  });
});
