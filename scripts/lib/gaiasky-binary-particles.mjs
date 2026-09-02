/* gaiasky-binary-particles.mjs — PF-10 C0/C2: Gaia Sky's own native binary particle format.
 *
 * A FOURTH local data format found in this repo's datasets (after plain JSON, VOTable BINARY2,
 * VOTable TABLEDATA, and raw FITS binary tables) — `sdss/sdss_dr18.bin` and its siblings
 * (`catalog-sdss-12/14/17`) are written by Gaia Sky's own `BinaryPointDataProvider`, a real,
 * documented Java binary serialization, NOT reverse-engineered blindly: confirmed against the
 * official spec (https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Particle-catalogs.html)
 * and byte-verified against the real 130,962,101-byte DR18 file — the header's particle count
 * decoded to exactly 3,637,836 (the dataset's own stated `nobjects`), and per-record RA/Dec/
 * distance decoded to physically sane values (RA/Dec in real sky-coordinate ranges, distances of
 * ~2 billion parsecs matching "high-redshift galaxies" real cosmological distances).
 *
 * FORMAT (from the official spec, "simple"/non-extended variant — this is the variant every
 * local dataset in this repo actually uses, confirmed by the header's extended-flag byte = 0):
 *   Header (5 bytes):
 *     [0..3]  i32 BE   particle count
 *     [4]     u8       extended-particle flag (0 = simple, 1 = extended; extended adds proper
 *                       motion / radial velocity / apparent magnitude / packed colour / size —
 *                       NOT implemented here, no local dataset needs it)
 *   Per-record (simple variant), all big-endian, VARIABLE LENGTH per record:
 *     [+0..7]   i64  particle id
 *     [+8..11]  i32  name length (UTF-16 char count; 0 for every local SDSS record — these are
 *                     anonymous catalog points, not named bodies)
 *     [+12..]   UTF-16BE name characters, 2 bytes each, `namelen` of them
 *     [+..+7]   f64  right ascension (deg)
 *     [+..+7]   f64  declination (deg)
 *     [+..+7]   f64  distance (pc) — REAL, already comoving-distance-corrected per the SDSS DR18
 *                     dataset's own description, not a raw redshift needing separate cosmology
 *
 * STREAMING BY DESIGN (closes the C0 "Honest limits" gap: "a 3.6M-row file needs a streaming
 * decode, not the whole-file-in-memory approach that was sufficient... at MWSC's 3,006-row
 * scale"). `forEachParticle` takes a callback and never materializes a JS object, array entry,
 * or string per record — it hands back primitive numbers (id as BigInt, ra, dec, distanceParsecs)
 * directly from the buffer. The 131 MB input file IS read as one Buffer (a single ~131 MB
 * allocation is unremarkable on any real machine and is not the memory-safety concern this
 * module addresses); what this module avoids is the OTHER, actually-dangerous allocation
 * pattern — 3.6 million individual JS row objects, which is what blew up a naive
 * `.map(row => ({...}))` conversion at this scale in earlier profiling for this session.
 */
import { readFileSync } from "node:fs";

/**
 * @typedef {{count: number, extended: boolean}} BinaryParticleHeader
 */

/** @param {Buffer} buf @returns {BinaryParticleHeader} */
export function readGaiaSkyBinaryHeader(buf) {
  if (buf.length < 5) {
    throw new Error(
      "gaiasky-binary-particles: file shorter than the 5-byte header",
    );
  }
  const count = buf.readInt32BE(0);
  const extendedByte = buf.readUInt8(4);
  if (extendedByte !== 0 && extendedByte !== 1) {
    throw new Error(
      `gaiasky-binary-particles: header extended-flag byte is ${extendedByte}, expected 0 or 1 — not this format`,
    );
  }
  return { count, extended: extendedByte === 1 };
}

/**
 * Streams every particle in a Gaia Sky simple (non-extended) binary particle file, calling
 * `onParticle(id, ra, dec, distancePc, index)` once per record with primitive values — no
 * intermediate object is ever allocated. Throws if the header declares `extended: true` (no
 * local dataset needs that variant; add support deliberately if one ever does, don't guess).
 * @param {Buffer} buf
 * @param {(id: bigint, ra: number, dec: number, distancePc: number, index: number) => void} onParticle
 * @returns {BinaryParticleHeader}
 */
export function forEachGaiaSkyParticle(buf, onParticle) {
  const header = readGaiaSkyBinaryHeader(buf);
  if (header.extended) {
    throw new Error(
      "gaiasky-binary-particles: extended-particle records are not implemented (no local dataset uses them) — add support deliberately, don't guess the extra field layout",
    );
  }
  let o = 5;
  for (let i = 0; i < header.count; i++) {
    const id = buf.readBigInt64BE(o);
    o += 8;
    const namelen = buf.readInt32BE(o);
    o += 4;
    o += namelen * 2; // UTF-16BE name characters, skipped (unused for anonymous catalog points)
    const ra = buf.readDoubleBE(o);
    o += 8;
    const dec = buf.readDoubleBE(o);
    o += 8;
    const distancePc = buf.readDoubleBE(o);
    o += 8;
    onParticle(id, ra, dec, distancePc, i);
  }
  if (o !== buf.length) {
    throw new Error(
      `gaiasky-binary-particles: decoded ${header.count} records but ended at byte ${o}, file is ${buf.length} bytes — a real length mismatch, not a rounding artifact`,
    );
  }
  return header;
}

/** Convenience wrapper: reads a file path and streams it. @param {string} path */
export function forEachGaiaSkyParticleInFile(path, onParticle) {
  const buf = readFileSync(path);
  return forEachGaiaSkyParticle(buf, onParticle);
}
