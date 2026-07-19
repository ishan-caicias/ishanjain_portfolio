/* star-catalog.ts — PF-09 B2 step 2: the real Gaia/Hipparcos catalog.
 *
 * Replaces `buildStarField`'s seeded-LCG placeholder, which drew 168,959 stars
 * at uniform size and full brightness and therefore read as ~6x denser than the
 * live engine (TR-037). The density gap is not a count problem — both engines
 * draw the same number of sprites — it is that the live engine is *photometric*:
 * a real magnitude distribution collapses the large majority of stars to ~1 px
 * at alpha 0.10, so the eye resolves a few thousand rather than all 168,959.
 *
 * The catalog ships as two PNG-packed binary chunks (the same files the live
 * engine streams, byte-for-byte — this is a decode port, not a new asset):
 *
 *   assets/stars-hip.png  117,964 records  Hipparcos field, all type 0
 *   assets/deep.png        50,995 records  Gaia deep layer, types 0..7
 *                         ------- 168,959 = LIVE_STAR_COUNT (exactly)
 *
 * Record layout, 15 bytes, little-endian — fixed by the existing assets:
 *   [0..3]  f32 x   [4..7] f32 y   [8..11] f32 z
 *   [12]    u8 magnitude byte      (shader: mag = 12.5 - m/255*14)
 *   [13]    u8 colour index        (shader: Planckian O->M ramp)
 *   [14]    u8 object type         (0 = star; 1..7 = deep-layer classes)
 *
 * Everything here is pure: the DOM-bound part (fetch -> ImageBitmap -> canvas
 * -> RGB) lives in babylon-engine.ts, so the decode itself stays unit-testable
 * off-GPU and off-DOM.
 */
import type { StarField } from "./star-field";

/** Bytes per packed star record. Fixed by the shipped assets. */
export const RECORD_BYTES = 15;

/** Catalog chunks in draw order. Order matters: it fixes the index range each
 * layer occupies, which `deepStart` reports. */
export const CATALOG_CHUNKS = [
  "assets/stars-hip.png",
  "assets/deep.png",
] as const;

/* --- (type, colour index) packing into a single float ---------------------
 *
 * B2 step 1 cut the per-vertex `meta` buffer to two floats and that saving is
 * load-bearing (-5.2 MiB); adding a third for the object type would hand back
 * ~2.7 MiB of it. Type is a small integer (0..7) and colour index is a byte, so
 * both fit in one f32 with room to spare: store `type + ci/256`, recover with
 * `floor()` / `fract()`.
 *
 * Divide by 256, not 255. ci = 255 would otherwise pack to exactly `type + 1.0`
 * and `floor()` would report the wrong object class for every reddest star in
 * the catalog — an off-by-one that only bites at one end of the range and would
 * be invisible in a spot check. The unpack scale below restores full 0..1.
 *
 * f32 has 24 mantissa bits; at type 7 the ULP is ~1e-6, against a colour
 * quantum of 1/255 ~ 4e-3. Three orders of headroom.
 */
export const CI_PACK_DIV = 256;
export const CI_UNPACK_SCALE = 256 / 255;

/** Pack an object type (0..7) and a colour-index byte (0..255) into one float.
 * Mirrored in both shader twins as `floor(v)` / `fract(v) * CI_UNPACK_SCALE`. */
export function packTypeAndColour(type: number, ciByte: number): number {
  return type + ciByte / CI_PACK_DIV;
}

/** The shader-side unpack, in JS, so the round trip is testable off-GPU. */
export function unpackTypeAndColour(packed: number): {
  type: number;
  colour: number;
} {
  return {
    type: Math.floor(packed),
    colour: (packed % 1) * CI_UNPACK_SCALE,
  };
}

export interface StarCatalog extends StarField {
  /** Index at which the Gaia deep layer begins (= Hipparcos record count). */
  deepStart: number;
}

/** Decode packed RGB byte chunks into the renderer's StarField layout.
 *
 * `chunks` are raw RGB triples (3 bytes/pixel, alpha already stripped) in
 * CATALOG_CHUNKS order. Trailing bytes that do not complete a 15-byte record
 * are dropped — the packer pads to a whole image, so the last row is partial by
 * design; the live engine floors identically.
 */
export function decodeStarCatalog(chunks: Uint8Array[]): StarCatalog {
  const counts = chunks.map((c) => Math.floor(c.length / RECORD_BYTES));
  const count = counts.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 2);

  let w = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const raw = chunks[ci];
    // byteOffset matters: a Uint8Array may be a view into a larger buffer.
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let i = 0; i < counts[ci]; i++, w++) {
      const o = i * RECORD_BYTES;
      positions[w * 3] = dv.getFloat32(o, true);
      positions[w * 3 + 1] = dv.getFloat32(o + 4, true);
      positions[w * 3 + 2] = dv.getFloat32(o + 8, true);
      // x = magnitude byte normalised; the shader applies Pogson's law to it.
      meta[w * 2] = raw[o + 12] / 255;
      meta[w * 2 + 1] = packTypeAndColour(raw[o + 14], raw[o + 13]);
    }
  }
  return { positions, meta, count, deepStart: counts[0] ?? 0 };
}
