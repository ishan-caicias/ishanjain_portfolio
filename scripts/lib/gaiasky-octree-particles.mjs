/* gaiasky-octree-particles.mjs — PF-11 D8.2: Gaia Sky's OctreeLoader format.
 *
 * SIXTH local binary serialization found in this repo's Gaia Sky datasets (after plain JSON,
 * VOTable BINARY2, VOTable TABLEDATA, raw FITS binary tables, and the "simple" BinaryDataProvider
 * particle-catalog format `gaiasky-binary-particles.mjs` already reads for SDSS). This module
 * reads the OCTREE-STREAMED star-catalog variant: a `metadata.bin` octree node table plus
 * per-node `particles_NNNNNN.bin` star-record files, used by `catalog-gaia-dr3-tiny`
 * (2,552,302 stars, 2 octants/nodes — see ADR-0012).
 *
 * Confirmed against Gaia Sky's own source (codeberg.org/gaiasky/gaiasky, MPL-2.0 — read for
 * format reference only, no code copied), NOT the public docs page (LOD-catalogs.html), which
 * only documents particle-record versions 0-2; this dataset's `particles_*.bin` files declare
 * version 3 in their own header, undocumented on the public docs site as of 2026-07-29:
 *   - metadata.bin: MetadataBinaryIO, version 1 (page ids as int64, introduced Gaia Sky 3.0.4)
 *   - particles_*.bin: BinaryDataProvider + BinaryVersion3 ("includes the effective temperature,
 *     t_eff, and does not have the hip number as a floating point number, as it is already in
 *     the names array" — the class's own doc comment)
 *
 * BYTE-VERIFIED against the real local file, not assumed: decoding `metadata.bin` (236 bytes, 2
 * octants) lands `cumulativeStars`/`starsInNode` on exactly 2,552,302 / 2,200,000 — the catgen
 * log's own reported totals, to the integer, not approximately. Decoding `particles_000000.bin`
 * consumes exactly 178,178,964 of 178,178,964 bytes with zero remainder.
 *
 * COORDINATE CONVENTION — also undocumented anywhere, empirically derived and verified against
 * SIMBAD (see ADR-0012 for the full derivation and two independent verification stars):
 *   - axis mapping (no sign flips, a cyclic permutation): RA = atan2(x, z) normalized to
 *     [0, 360), Dec = asin(y / r) where r = sqrt(x²+y²+z²)
 *   - distance unit: 1 raw unit = 1 gigametre (1e6 km). Verified against Sirius's precisely known
 *     parallax distance (2.6371 pc) to 5-6 significant figures.
 *
 * metadata.bin (version 1) layout, all big-endian:
 *   Header (12 bytes): i32 token(-1) · i32 version(1) · i32 octantCount
 *   Per octant (112 bytes × octantCount):
 *     i64 pageId · f32 x,y,z (centre, raw units) · f32 sizeX,sizeY,sizeZ (half-size per axis) ·
 *     i64 children[8] (-1 = no child) · i32 level · i32 cumulativeStars (subtree total) ·
 *     i32 starsInNode (this node's own particle-file count) · i32 numChildren
 *
 * particles_NNNNNN.bin (version 3) layout, all big-endian:
 *   Header (12 bytes): i32 token(-1) · i32 version(3) · i32 starCount
 *   Per star (80 bytes + nameLength*2):
 *     f64 x,y,z (raw units, gigametres) · f32 vx,vy,vz,muAlpha,muDelta,radVel,appMag,absMag,
 *     color,size,tEff (11 floats) · i64 id (Gaia source_id, or the bare HIP number for
 *     Hipparcos-origin records) · i32 nameLength · UTF-16BE name chars ×nameLength
 */
import { readFileSync } from "node:fs";

const RAW_UNITS_PER_KM = 1e6; // 1 raw unit = 1 gigametre
const KM_PER_PC = 3.0856775814913673e13;
const RAW_UNITS_PER_PC = KM_PER_PC / RAW_UNITS_PER_KM;

/** @typedef {{pageId: bigint, x: number, y: number, z: number, sizeX: number, sizeY: number, sizeZ: number, children: bigint[], level: number, cumulativeStars: number, starsInNode: number, numChildren: number}} Octant */

/** Reads and fully validates metadata.bin (version 1 only — throws on any other version rather
 * than guessing an unverified layout). @param {Buffer} buf @returns {{version: number, octants: Octant[]}} */
export function readOctreeMetadata(buf) {
  let o = 0;
  const token = buf.readInt32BE(o);
  o += 4;
  if (token !== -1) {
    throw new Error(
      `gaiasky-octree-particles: metadata.bin expected version token -1, got ${token} — version 0 (untokenized, 32-bit page ids) metadata is not implemented, add deliberately if a dataset needs it`,
    );
  }
  const version = buf.readInt32BE(o);
  o += 4;
  if (version !== 1) {
    throw new Error(
      `gaiasky-octree-particles: metadata.bin version ${version} is not implemented (only version 1 is byte-verified against real data)`,
    );
  }
  const octantCount = buf.readInt32BE(o);
  o += 4;
  const octants = [];
  for (let i = 0; i < octantCount; i++) {
    const pageId = buf.readBigInt64BE(o);
    o += 8;
    const x = buf.readFloatBE(o);
    o += 4;
    const y = buf.readFloatBE(o);
    o += 4;
    const z = buf.readFloatBE(o);
    o += 4;
    const sizeX = buf.readFloatBE(o);
    o += 4;
    const sizeY = buf.readFloatBE(o);
    o += 4;
    const sizeZ = buf.readFloatBE(o);
    o += 4;
    const children = [];
    for (let c = 0; c < 8; c++) {
      children.push(buf.readBigInt64BE(o));
      o += 8;
    }
    const level = buf.readInt32BE(o);
    o += 4;
    const cumulativeStars = buf.readInt32BE(o);
    o += 4;
    const starsInNode = buf.readInt32BE(o);
    o += 4;
    const numChildren = buf.readInt32BE(o);
    o += 4;
    octants.push({
      pageId,
      x,
      y,
      z,
      sizeX,
      sizeY,
      sizeZ,
      children,
      level,
      cumulativeStars,
      starsInNode,
      numChildren,
    });
  }
  if (o !== buf.length) {
    throw new Error(
      `gaiasky-octree-particles: decoded ${octantCount} octants but ended at byte ${o}, metadata.bin is ${buf.length} bytes — a real length mismatch, not a rounding artifact`,
    );
  }
  return { version, octants };
}

/** Converts a raw octree Cartesian position to RA (deg, [0,360)), Dec (deg), distance (pc) —
 * see this module's header for the axis-mapping and distance-unit derivation.
 * @param {number} x @param {number} y @param {number} z */
export function octreeXyzToRaDecDistance(x, y, z) {
  const r = Math.sqrt(x * x + y * y + z * z);
  const dec = Math.asin(y / r) * (180 / Math.PI);
  let ra = Math.atan2(x, z) * (180 / Math.PI);
  if (ra < 0) ra += 360;
  return { ra, dec, distancePc: r / RAW_UNITS_PER_PC };
}

/**
 * @typedef {{x: number, y: number, z: number, appMag: number, absMag: number, color: number,
 *   tEff: number, id: bigint, name: string}} OctreeStar
 */

/** Streams every star in a version-3 particles_NNNNNN.bin file, calling `onStar(star, index)`
 * once per record. Throws on any other version and on any byte-count mismatch at the end (the
 * same "does the byte count come out even" discipline `gaiasky-binary-particles.mjs` uses).
 * @param {Buffer} buf @param {(star: OctreeStar, index: number) => void} onStar
 * @returns {{version: number, count: number}} */
export function forEachOctreeParticle(buf, onStar) {
  let o = 0;
  const token = buf.readInt32BE(o);
  o += 4;
  if (token !== -1) {
    throw new Error(
      `gaiasky-octree-particles: particles file expected version token -1, got ${token} — untokenized (version 0/1) particle records are not implemented`,
    );
  }
  const version = buf.readInt32BE(o);
  o += 4;
  if (version !== 3) {
    throw new Error(
      `gaiasky-octree-particles: particles file version ${version} is not implemented (only version 3 is byte-verified against real data — versions 0-2 have a different, DOCUMENTED layout at gaia.ari.uni-heidelberg.de/gaiasky/docs, add deliberately if a dataset needs them)`,
    );
  }
  const count = buf.readInt32BE(o);
  o += 4;
  for (let i = 0; i < count; i++) {
    const x = buf.readDoubleBE(o);
    o += 8;
    const y = buf.readDoubleBE(o);
    o += 8;
    const z = buf.readDoubleBE(o);
    o += 8;
    o += 4 * 6; // vx, vy, vz, muAlpha, muDelta, radVel — unused by this pipeline, skipped
    const appMag = buf.readFloatBE(o);
    o += 4;
    const absMag = buf.readFloatBE(o);
    o += 4;
    const color = buf.readFloatBE(o);
    o += 4;
    o += 4; // size — unused by this pipeline, skipped
    const tEff = buf.readFloatBE(o);
    o += 4;
    const id = buf.readBigInt64BE(o);
    o += 8;
    const nameLength = buf.readInt32BE(o);
    o += 4;
    let name = "";
    if (nameLength > 0) {
      const chars = new Array(nameLength);
      for (let c = 0; c < nameLength; c++) {
        chars[c] = buf.readUInt16BE(o);
        o += 2;
      }
      name = String.fromCharCode(...chars);
    }
    onStar({ x, y, z, appMag, absMag, color, tEff, id, name }, i);
  }
  if (o !== buf.length) {
    throw new Error(
      `gaiasky-octree-particles: decoded ${count} stars but ended at byte ${o}, file is ${buf.length} bytes — a real length mismatch, not a rounding artifact`,
    );
  }
  return { version, count };
}

/** Convenience wrapper: reads a metadata.bin file path. @param {string} path */
export function readOctreeMetadataFile(path) {
  return readOctreeMetadata(readFileSync(path));
}

/** Convenience wrapper: reads a particles_NNNNNN.bin file path and streams it.
 * @param {string} path @param {(star: OctreeStar, index: number) => void} onStar */
export function forEachOctreeParticleInFile(path, onStar) {
  return forEachOctreeParticle(readFileSync(path), onStar);
}

/** Extracts the HIP catalog number from a star's name, if present — version 3's own convention
 * for carrying Hipparcos identity (no dedicated field, see this module's header). Names are
 * pipe-delimited multi-designation strings (e.g. "mu. Sgr|13 Sgr|HIP 89341"); returns null if no
 * "HIP <n>" designation is present. @param {string} name @returns {number | null} */
export function extractHipNumber(name) {
  const m = /(?:^|\|)HIP\s+(\d+)(?:\||$)/.exec(name);
  return m ? Number(m[1]) : null;
}
