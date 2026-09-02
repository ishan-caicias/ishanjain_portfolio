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
 *   [12]    u8 magnitude byte      (shader: mag = 21.5 - 32*t + 9*t^2, t = m/255 — PF-11 P2b)
 *   [13]    u8 colour index        (shader: Planckian O->M ramp)
 *   [14]    u8 object type         (0 = star; 1..7 = deep-layer classes)
 *
 * PF-11 P2b MAGNITUDE RESCALE (2026-09-02): the byte->magnitude formula was `12.5 - t*14`, a
 * 14-mag range floored at 12.5 — every white dwarf in the shipped eDR3 catalog (real G mag
 * 8.5-21.0, median 19.8) saturated to that one floor byte, indistinguishable by brightness. The
 * new quadratic keeps the BRIGHT anchor and its slope exactly fixed (byte 255 -> mag -1.5,
 * d(mag)/dt = -14 at t=1, matching the old formula's constant slope there) while extending the
 * FAINT anchor from mag 12.5 to mag 21.5 (byte 0), so the real white-dwarf population now
 * spreads across bytes ~0-83 instead of collapsing to 0. Chosen quadratic (not piecewise, not a
 * cubic) specifically because it has a closed-form inverse (one sqrt) — the safest shape to keep
 * byte-identical across every consumer that duplicates this literal (both shader twins here and
 * in the archived space-engine.js, the JS mirrors, and ~6 scripts/*-pngpack.mjs encoders).
 * REINTERPRETATION COST: `stars-hip.png`/`deep.png` have no in-repo generator script (hand-ported
 * from the PF-07 prototype), so their already-baked bytes are reinterpreted under the new
 * formula rather than regenerated — bright stars (byte 200+) are visually unchanged
 * (matching slope at the bright anchor), mid-brightness stars (byte ~60-150, old mag ~4-9) dim
 * by up to ~4 real magnitudes, and near-floor bytes (already at both the shader's alpha and
 * quad-size floors) are unaffected in practice.
 *
 * OBJECT-TYPE BYTE LEGEND (PF-10 C0/C1, TR-065/066 — the ONLY place this is documented; none of
 * this was written down anywhere in the codebase before, only implicit in the shader's branch
 * conditions in babylon-engine.ts's ijStarFragmentShader, both GLSL and WGSL twins):
 *   0       ordinary point source — falls through to the default branch: stellar PSF + bloom.
 *           Used by every Hipparcos/deep-layer star AND, deliberately, by white dwarfs (eDR3,
 *           TR-065 Astra audit) and CNS5 nearby stars (PF-10 C1) — both are real point sources,
 *           not extended objects, even though they ship via a "deep-layer"-shaped bonus PNG.
 *   1       cluster — soft gaussian glow, no PSF core (`ty > 0.5 && ty < 1.5` branch). NOT
 *           currently used by any shipped background-layer asset (the curated cluster dossier
 *           tier, celestial-clusters.js, renders via the SEPARATE celestial-bodies.ts billboard
 *           path, not this one — see that file's PROCEDURAL_TYPE table for its own, independent
 *           4/5 globular/open split). Reserved for a future bulk (non-dossier) cluster layer.
 *   CORRECTION (2026-07-20, PF-10 C3): the "2, 4, 5, 6 UNDOCUMENTED/UNUSED" entry below was
 *           true when written but is now stale — later PF-10 work gave all four real vertex-stage
 *           branches in both shader twins (2 = white dwarf px*0.8, 4 = GD-1 px*0.95 + cyan tint,
 *           5 = exoplanet host warm tint, 6 = DR3 asteroid px*0.85). Kept as originally written
 *           per this repo's corrections-are-additive convention rather than edited away.
 *   6       DR3 asteroid — a real vertex branch (`ty < 6.5`, px *= 0.85) plus, as of PF-10 C3, a
 *           tight bloom-free fragment branch (`ty > 5.5 && ty < 6.5`, exp(-d*d*9.0)*0.70) so
 *           154,662 additive specks read as rock dust rather than a second star field. Used by
 *           the real Gaia DR3 asteroid belt (scripts/gaia-asteroids-pngpack.mjs), wired live via
 *           babylon-engine.ts's `_loadAsteroidVisualLayer`. NOTE: this layer's positions are in
 *           the BELT's own world-unit frame (1 AU = 63 units, ecliptic mapped onto the scene's
 *           X-Y plane), NOT this file's linear-light-year convention — which is exactly why it
 *           gets its own mesh, the same reason SDSS type 3 does.
 *   2, 4, 5, 6   UNDOCUMENTED/UNUSED — no shader branch currently distinguishes these from type
 *           0; they fall through to the same default stellar-PSF treatment. Reserved, not
 *           assigned to anything yet. Do not assume a specific visual meaning without adding
 *           and shader-verifying a real branch first (the white-dwarf type-byte mistake TR-064/
 *           065 caught — assigning a byte value with no verified shader meaning — is exactly
 *           the failure mode this note exists to prevent repeating).
 *   3       galaxy — softer, wider gaussian smudge (`ty > 2.5 && ty < 3.5` branch,
 *           exp(-d*d*4.0)*0.85). Used by the SDSS DR18 background-layer pipeline (PF-10 C2,
 *           scripts/gaia-sdss18-pngpack.mjs) — NOT yet wired into any live render path (that
 *           layer needs its own mesh/VertexBuffer, log-depth-scaled distances incompatible with
 *           this file's linear-ly convention; see that script's header for the full reasoning).
 *   7       Oort dust grain — a third distinct branch (`ty > 6.5`, exp(-d*d*3.2)*0.55). Used by
 *           the Oort cloud background-layer pipeline (PF-10 C1, scripts/gaia-oortcloud-
 *           pngpack.mjs) — wired live as of TR-066 via babylon-engine.ts's `_loadBonusStarLayers`.
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

/** PF-11 D5.3 — nearest field-catalog member of a given object-type byte to a world
 * position, by real 3D distance (not screen-space, unlike `_pickField`'s cone test). A
 * typed-array scan with no per-iteration allocation; extracted here (rather than left inline
 * in babylon-engine.ts) so it unit-tests off-GPU, the same reasoning TR-097 used for
 * `raySphereDist`/`cursorRayDir`. Returns -1 if the field has no member of that type. Camera
 * position epoch caching (this scan is expensive enough that a caller shouldn't run it every
 * frame) is the caller's concern, not this pure function's.
 *
 * CORRECTION (2026-07-29 code review, finding 2): the "no per-iteration allocation" claim above
 * was FALSE as originally shipped — the loop called `unpackTypeAndColour`, which returns a fresh
 * `{ type, colour }` object every record. Over the loaded field (~200k+ records) × one call per
 * class row that is millions of short-lived objects per cold camera epoch. The type byte is just
 * the integer part of the packed float (see `packTypeAndColour`), so `Math.floor` reads it
 * directly and the colour half — which this function never uses — is never computed. The claim
 * is now true. `unpackTypeAndColour` stays the tested round-trip helper for callers that need
 * both halves; it is its use inside a hot scan that was wrong. */
export function nearestOfType(
  field: StarField,
  typeByte: number,
  cam: readonly [number, number, number],
): number {
  const [cx, cy, cz] = cam;
  let best = -1;
  let bestDist2 = Infinity;
  for (let i = 0; i < field.count; i++) {
    // Integer part only — the allocation-free half of `unpackTypeAndColour`. A unit test pins
    // the two against each other so this can never silently diverge from the packer.
    if (Math.floor(field.meta[i * 2 + 1]) !== typeByte) continue;
    const dx = field.positions[i * 3] - cx;
    const dy = field.positions[i * 3 + 1] - cy;
    const dz = field.positions[i * 3 + 2] - cz;
    const d2 = dx * dx + dy * dy + dz * dz;
    if (d2 < bestDist2) {
      bestDist2 = d2;
      best = i;
    }
  }
  return best;
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

/** PF-11 D7.3: reads packed records directly out of the RGBA pixel buffer the canvas API always
 * hands back (`ImageData.data`/`getImageData(...).data`), rather than requiring a caller to have
 * already copied it down to a stripped, alpha-free RGB buffer first. `decodeStarCatalog` above
 * needs that strip pass because `DataView.getFloat32` requires 4 CONTIGUOUS bytes, and RGBA's
 * alpha byte breaks contiguity every 3rd byte; this version gathers each record's 15 bytes one
 * at a time via the pixel/channel mapping instead, at the cost of per-byte indexing rather than
 * one contiguous read.
 *
 * The trade only pays off because it removes a whole extra full-size buffer from the peak — the
 * SDSS chunk alone is ~47 MB of RGB, ~63 MB as RGBA, and the strip pass briefly holds both at
 * once. This version holds only the RGBA source and the (much smaller) decoded output.
 *
 * RECORD_BYTES=15 is exactly 5 RGB pixels (15 / 3), so pixel `p` within a record supplies bytes
 * `[3p, 3p+2]` from its R,G,B channels (alpha is skipped, never part of the packed format). */
export function decodeStarCatalogFromRGBA(
  chunks: readonly { rgba: Uint8Array | Uint8ClampedArray }[],
): StarCatalog {
  const counts = chunks.map((c) =>
    Math.floor(c.rgba.length / 4 / (RECORD_BYTES / 3)),
  );
  const count = counts.reduce((a, b) => a + b, 0);
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 2);
  // Reused scratch for the three float32 fields — 4 gathered bytes reinterpreted as one f32.
  const scratch = new Uint8Array(4);
  const scratchDv = new DataView(scratch.buffer);

  let w = 0;
  for (let ci = 0; ci < chunks.length; ci++) {
    const rgba = chunks[ci].rgba;
    const readByte = (recordByteIndex: number): number => {
      const pixel = (recordByteIndex / 3) | 0;
      const channel = recordByteIndex - pixel * 3; // 0=R, 1=G, 2=B — alpha never packed
      return rgba[pixel * 4 + channel];
    };
    for (let i = 0; i < counts[ci]; i++, w++) {
      const o = i * RECORD_BYTES;
      scratch[0] = readByte(o);
      scratch[1] = readByte(o + 1);
      scratch[2] = readByte(o + 2);
      scratch[3] = readByte(o + 3);
      positions[w * 3] = scratchDv.getFloat32(0, true);
      scratch[0] = readByte(o + 4);
      scratch[1] = readByte(o + 5);
      scratch[2] = readByte(o + 6);
      scratch[3] = readByte(o + 7);
      positions[w * 3 + 1] = scratchDv.getFloat32(0, true);
      scratch[0] = readByte(o + 8);
      scratch[1] = readByte(o + 9);
      scratch[2] = readByte(o + 10);
      scratch[3] = readByte(o + 11);
      positions[w * 3 + 2] = scratchDv.getFloat32(0, true);
      meta[w * 2] = readByte(o + 12) / 255;
      meta[w * 2 + 1] = packTypeAndColour(readByte(o + 14), readByte(o + 13));
    }
  }
  return { positions, meta, count, deepStart: counts[0] ?? 0 };
}
