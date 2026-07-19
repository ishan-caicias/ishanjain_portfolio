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
  packTypeAndColour,
  RECORD_BYTES,
  unpackTypeAndColour,
} from "@/lib/star-catalog";

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
