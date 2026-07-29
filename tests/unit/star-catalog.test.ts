/**
 * PF-09 B2 step 2 — real catalog decoder (pure).
 *
 * The decode is a byte-layout contract with two shipped binary assets and the
 * (type, colour) packing is a contract with two shader languages that no
 * compiler checks. Both are pinned here.
 */
import { describe, expect, it } from "vitest";
import {
  CATALOG_CHUNKS,
  CI_UNPACK_SCALE,
  decodeStarCatalog,
  decodeStarCatalogFromRGBA,
  nearestOfType,
  packTypeAndColour,
  RECORD_BYTES,
  unpackTypeAndColour,
} from "@/lib/star-catalog";
import type { StarField } from "@/lib/star-field";

/** Build a chunk of `n` records with per-index values, matching the packer's
 * 15-byte little-endian layout. */
function makeChunk(
  n: number,
  f: (i: number) => {
    x: number;
    y: number;
    z: number;
    mag: number;
    ci: number;
    type: number;
  },
  padBytes = 0,
): Uint8Array {
  const raw = new Uint8Array(n * RECORD_BYTES + padBytes);
  const dv = new DataView(raw.buffer);
  for (let i = 0; i < n; i++) {
    const r = f(i);
    const o = i * RECORD_BYTES;
    dv.setFloat32(o, r.x, true);
    dv.setFloat32(o + 4, r.y, true);
    dv.setFloat32(o + 8, r.z, true);
    raw[o + 12] = r.mag;
    raw[o + 13] = r.ci;
    raw[o + 14] = r.type;
  }
  return raw;
}

const rec = (i: number) => ({
  x: i * 10,
  y: -i,
  z: i + 0.5,
  mag: (i * 7) % 256,
  ci: (i * 29) % 256,
  type: i % 8,
});

describe("type + colour packing", () => {
  it("round-trips every (type, colour byte) pair in the catalog's range", () => {
    for (let type = 0; type <= 7; type++) {
      for (let ci = 0; ci <= 255; ci++) {
        const { type: t, colour } = unpackTypeAndColour(
          packTypeAndColour(type, ci),
        );
        expect(t).toBe(type);
        expect(colour).toBeCloseTo(ci / 255, 5);
      }
    }
  });

  // The reason for dividing by 256 rather than 255: ci=255 would otherwise pack
  // to exactly type+1.0 and floor() would report the next object class. It only
  // bites at one end of the range, so a spot check would miss it.
  it("keeps the brightest-red colour byte inside its own type bucket", () => {
    for (let type = 0; type <= 7; type++) {
      expect(Math.floor(packTypeAndColour(type, 255))).toBe(type);
    }
  });

  it("unpack scale restores a full 0..1 colour range", () => {
    expect((255 / 256) * CI_UNPACK_SCALE).toBeCloseTo(1, 10);
  });
});

describe("decodeStarCatalog", () => {
  it("decodes positions and meta from the 15-byte record layout", () => {
    const f = decodeStarCatalog([makeChunk(4, rec)]);
    expect(f.count).toBe(4);
    expect(f.positions).toHaveLength(12);
    expect(f.meta).toHaveLength(8);
    for (let i = 0; i < 4; i++) {
      const r = rec(i);
      expect(f.positions[i * 3]).toBeCloseTo(r.x, 4);
      expect(f.positions[i * 3 + 1]).toBeCloseTo(r.y, 4);
      expect(f.positions[i * 3 + 2]).toBeCloseTo(r.z, 4);
      expect(f.meta[i * 2]).toBeCloseTo(r.mag / 255, 6);
      const { type, colour } = unpackTypeAndColour(f.meta[i * 2 + 1]);
      expect(type).toBe(r.type);
      expect(colour).toBeCloseTo(r.ci / 255, 5);
    }
  });

  it("concatenates chunks in order and reports where the deep layer starts", () => {
    const f = decodeStarCatalog([makeChunk(3, rec), makeChunk(2, rec)]);
    expect(f.count).toBe(5);
    expect(f.deepStart).toBe(3);
    // record 3 is the deep chunk's record 0, so it repeats the first values
    expect(f.positions[3 * 3]).toBeCloseTo(rec(0).x, 4);
  });

  it("drops the packer's trailing partial record rather than misreading it", () => {
    // The assets pad to a whole image, so the tail is partial by design.
    const f = decodeStarCatalog([makeChunk(3, rec, RECORD_BYTES - 1)]);
    expect(f.count).toBe(3);
  });

  it("tolerates a missing optional chunk", () => {
    const f = decodeStarCatalog([makeChunk(2, rec), new Uint8Array(0)]);
    expect(f.count).toBe(2);
    expect(f.deepStart).toBe(2);
  });

  it("reads correctly from a Uint8Array that is a view into a larger buffer", () => {
    // createImageBitmap/getImageData paths hand back views; ignoring byteOffset
    // would silently decode the wrong bytes.
    const backing = new Uint8Array(8 + 2 * RECORD_BYTES);
    backing.set(makeChunk(2, rec), 8);
    const view = backing.subarray(8);
    const f = decodeStarCatalog([view]);
    expect(f.count).toBe(2);
    expect(f.positions[3]).toBeCloseTo(rec(1).x, 4);
  });

  it("names the two shipped catalog chunks in draw order", () => {
    expect(CATALOG_CHUNKS).toEqual(["assets/stars-hip.png", "assets/deep.png"]);
  });
});

/** `getImageData(...).data` shape: 4 bytes/pixel, alpha always opaque for these packed assets
 * (the pipeline never encodes transparency into the catalog PNGs). */
function rgbToRgba(rgb: Uint8Array): Uint8Array {
  const nPx = Math.ceil(rgb.length / 3);
  const out = new Uint8Array(nPx * 4);
  for (let p = 0; p < nPx; p++) {
    out[p * 4] = rgb[p * 3] ?? 0;
    out[p * 4 + 1] = rgb[p * 3 + 1] ?? 0;
    out[p * 4 + 2] = rgb[p * 3 + 2] ?? 0;
    out[p * 4 + 3] = 255;
  }
  return out;
}

describe("decodeStarCatalogFromRGBA (PF-11 D7.3 — stride-aware reader, no strip-pass copy)", () => {
  it("matches decodeStarCatalog byte-for-byte on a single chunk", () => {
    const rgb = makeChunk(37, rec);
    const viaRgb = decodeStarCatalog([rgb]);
    const viaRgba = decodeStarCatalogFromRGBA([{ rgba: rgbToRgba(rgb) }]);
    expect(viaRgba.count).toBe(viaRgb.count);
    expect(viaRgba.deepStart).toBe(viaRgb.deepStart);
    expect(Array.from(viaRgba.positions)).toEqual(Array.from(viaRgb.positions));
    expect(Array.from(viaRgba.meta)).toEqual(Array.from(viaRgb.meta));
  });

  it("matches decodeStarCatalog across multiple chunks, deepStart included", () => {
    const c1 = makeChunk(11, rec);
    const c2 = makeChunk(23, rec);
    const viaRgb = decodeStarCatalog([c1, c2]);
    const viaRgba = decodeStarCatalogFromRGBA([
      { rgba: rgbToRgba(c1) },
      { rgba: rgbToRgba(c2) },
    ]);
    expect(viaRgba.deepStart).toBe(viaRgb.deepStart);
    expect(Array.from(viaRgba.positions)).toEqual(Array.from(viaRgb.positions));
    expect(Array.from(viaRgba.meta)).toEqual(Array.from(viaRgb.meta));
  });

  it("drops a trailing partial record exactly like decodeStarCatalog", () => {
    // 12 extra bytes = 4 whole extra RGB pixels (a real canvas's last row can only pad in
    // whole-pixel units) — 4 of the 5 pixels a 6th record would need, so it must be dropped.
    const rgb = makeChunk(5, rec, 12);
    const viaRgb = decodeStarCatalog([rgb]);
    const viaRgba = decodeStarCatalogFromRGBA([{ rgba: rgbToRgba(rgb) }]);
    expect(viaRgba.count).toBe(viaRgb.count);
    expect(viaRgba.count).toBe(5);
  });

  it("tolerates a missing optional chunk", () => {
    const f = decodeStarCatalogFromRGBA([
      { rgba: rgbToRgba(makeChunk(6, rec)) },
      { rgba: new Uint8Array(0) },
    ]);
    expect(f.count).toBe(6);
    expect(f.deepStart).toBe(6);
  });

  it("accepts a Uint8ClampedArray (getImageData's real return type)", () => {
    const rgb = makeChunk(9, rec);
    const rgba = new Uint8ClampedArray(rgbToRgba(rgb));
    const f = decodeStarCatalogFromRGBA([{ rgba }]);
    expect(f.count).toBe(9);
    expect(f.positions[3 * 3]).toBeCloseTo(rec(3).x, 4);
  });
});

describe("photometry (the density fix — TR-037)", () => {
  // Mirrors of the shader arithmetic, kept here so the mapping that decides how
  // many stars are actually visible is asserted rather than eyeballed on a phone.
  const magOf = (magNorm: number) => 12.5 - magNorm * 14;
  const fluxOf = (magNorm: number) => Math.pow(10, -0.4 * (magOf(magNorm) - 2));
  const alphaOf = (magNorm: number) =>
    0.1 + 0.9 * Math.sqrt(Math.min(Math.max(fluxOf(magNorm), 0), 1.4));

  it("collapses faint stars to the alpha floor and keeps bright ones opaque", () => {
    // magByte 0 -> mag 12.5: flux is tiny but not zero, so alpha sits just
    // above the 0.10 floor (0.107), not exactly on it.
    expect(alphaOf(0)).toBeGreaterThan(0.1);
    expect(alphaOf(0)).toBeLessThan(0.11);
    expect(alphaOf(1)).toBeGreaterThan(1.0); // magByte 255 -> mag -1.5, blazing
  });

  it("leaves the large majority of a real magnitude distribution near-invisible", () => {
    // Measured shape of stars-hip.png: ~80% of records sit in the lower two
    // octiles of the magnitude byte. Those must land at ~the alpha floor —
    // that is precisely what the B1 placeholder failed to do.
    const faint = decodeStarCatalog([
      makeChunk(64, (i) => ({ ...rec(i), mag: i })), // bytes 0..63
    ]);
    for (let i = 0; i < faint.count; i++) {
      expect(alphaOf(faint.meta[i * 2])).toBeLessThan(0.2);
    }
  });
});

describe("nearestOfType (PF-11 D5.3 — search console class rows)", () => {
  function mkField(
    entries: { pos: [number, number, number]; type: number }[],
  ): StarField {
    const positions = new Float32Array(entries.length * 3);
    const meta = new Float32Array(entries.length * 2);
    entries.forEach((e, i) => {
      positions[i * 3] = e.pos[0];
      positions[i * 3 + 1] = e.pos[1];
      positions[i * 3 + 2] = e.pos[2];
      meta[i * 2] = 0.5; // magnitude byte — irrelevant here
      meta[i * 2 + 1] = packTypeAndColour(e.type, 128);
    });
    return { positions, meta, count: entries.length };
  }

  it("finds the nearest member of the requested type, ignoring closer members of other types", () => {
    const field = mkField([
      { pos: [0, 0, 1], type: 2 }, // WD, distance 1 from origin
      { pos: [0, 0, 5], type: 2 }, // WD, distance 5 — farther, must lose
      { pos: [0, 0, 0.1], type: 3 }, // SDSS, closer overall but wrong type
    ]);
    expect(nearestOfType(field, 2, [0, 0, 0])).toBe(0);
  });

  it("measures real 3D distance from the given camera position, not from the origin", () => {
    const field = mkField([
      { pos: [10, 0, 0], type: 6 },
      { pos: [10, 0, 5], type: 6 },
    ]);
    // Camera sitting right next to index 1 - it must win despite being farther from the origin.
    expect(nearestOfType(field, 6, [10, 0, 4.5])).toBe(1);
  });

  it("returns -1 when the field has no member of the requested type", () => {
    const field = mkField([{ pos: [1, 1, 1], type: 1 }]);
    expect(nearestOfType(field, 7, [0, 0, 0])).toBe(-1);
  });

  it("returns -1 on an empty field", () => {
    const field = mkField([]);
    expect(nearestOfType(field, 2, [0, 0, 0])).toBe(-1);
  });

  it("its allocation-free Math.floor type read agrees with unpackTypeAndColour for every type/colour pair", () => {
    // 2026-07-29 code-review finding 2: the scan now reads the type byte as `Math.floor(packed)`
    // instead of destructuring `unpackTypeAndColour`'s freshly-allocated object. That is only
    // safe while the two agree EXACTLY — including at ciByte 255, the off-by-one boundary
    // `CI_PACK_DIV`'s "divide by 256, not 255" comment exists for. Pinned across the whole
    // domain rather than spot-checked, because a silent divergence here would mis-class every
    // reddest object in the catalog and never throw.
    for (let type = 0; type <= 7; type++) {
      for (let ci = 0; ci <= 255; ci++) {
        const packed = packTypeAndColour(type, ci);
        expect(Math.floor(packed)).toBe(unpackTypeAndColour(packed).type);
        expect(Math.floor(packed)).toBe(type);
      }
    }
  });

  it("finds the right member even at the ciByte-255 packing boundary (end-to-end, through the scan)", () => {
    // The same boundary as above, but exercised through `nearestOfType` itself on a field whose
    // records all carry the extreme colour byte — proof the scan, not just the arithmetic, is
    // correct there.
    const positions = new Float32Array(6);
    const meta = new Float32Array(4);
    positions.set([0, 0, 9], 0); // index 0: type 2, far
    positions.set([0, 0, 1], 3); // index 1: type 2, near
    meta[1] = packTypeAndColour(2, 255);
    meta[3] = packTypeAndColour(2, 255);
    expect(nearestOfType({ positions, meta, count: 2 }, 2, [0, 0, 0])).toBe(1);
    expect(nearestOfType({ positions, meta, count: 2 }, 3, [0, 0, 0])).toBe(-1);
  });
});
