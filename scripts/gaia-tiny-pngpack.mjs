#!/usr/bin/env node
/* gaia-tiny-pngpack.mjs — PF-11 D8.2: Gaia DR3 Tiny (2,552,302 stars) -> chunked PNG-packed D9
 * layer. See ADR-0012 for the full design rationale; this header covers what THIS script does
 * mechanically.
 *
 * Source: resources/gaia_datasets/catalog-gaia-dr3-tiny (Gaia Sky OctreeLoader binary format,
 * scripts/lib/gaiasky-octree-particles.mjs — metadata.bin v1 + particles_NNNNNN.bin v3, both
 * byte-verified, neither documented on the public Gaia Sky docs site).
 *
 * REAL FINDING while building this (not assumed from the format docs): the v3 particle record's
 * "color" field is a 100%-sentinel value (~-1.5e38, a Java "unset" sentinel, not physically
 * meaningful) across every sampled record in this dataset — the source CSV's bpmag/rpmag columns
 * evidently didn't survive into the octree export's color column. `tEff` (effective temperature)
 * IS reliably populated and physically sane (checked: 3465-5634K in a 352,302-record sample,
 * squarely inside real main-sequence K/M range). Colour is therefore derived from `tEff` via the
 * Ballesteros (2012, EPL 97 34008) blackbody T<->B-V relation — the SAME algorithm Gaia Sky's own
 * renderer uses for this exact purpose (`gaiasky.util.color.BVToTeff_ballesteros`) — inverted
 * numerically (bisection on the monotonic forward formula, not an algebraic solve, so a mistake
 * in expanding the quadratic can't silently ship). SIMPLIFIED verdict, TR-064-style: calibrates
 * exactly against the Sun (5778K -> B-V 0.650, textbook value) and Vega/Sirius A to within 0.02-
 * 0.045 mag; Betelgeuse/Rigel (evolved super/giants, where the pure-blackbody assumption is known
 * to break down) are directionally correct but off by ~0.1-0.2 mag — an honest limitation of a
 * blackbody approximation applied to non-blackbody atmospheres, not a bug. Full Astra
 * REALISM-AUDIT of this choice is a recorded follow-up (TR-114), not attempted this pass.
 *
 * Position: RA/Dec/distance recovered from the octree's raw Cartesian per
 * gaiasky-octree-particles.mjs's verified axis mapping and distance unit, then converted to
 * world-space light-years via the SAME raDecToDir + PC_TO_LY convention every other bulk-layer
 * script in this repo uses (gaia-whitedwarf-pngpack.mjs, gaia-cns5-pngpack.mjs, …) — duplicated
 * here deliberately, matching those scripts' own stated rationale for not importing from the
 * live-engine module graph into a build script.
 *
 * Dedup: POSITION-ONLY crossmatch against the shipped base field's Hipparcos-origin records
 * ONLY (assets/stars-hip.png, type-0 records only — deep.png's deep-sky objects can't be
 * Hipparcos stars). Scoped to gaia-tiny's ~118K NAMED (HIP-tagged) records — the base field is
 * Hipparcos-only, so gaia-tiny's ~2.43M unnamed pure-DR3 records cannot possibly overlap it and
 * are never checked. REAL MEASURED FINDING that overrode the original magnitude-gated design: a
 * 300-star calibration sample found 300/300 (100%) sub-arcsecond position matches (median 0.1",
 * max well under 1") — the same Hipparcos astrometric solution in both catalogs, as expected —
 * but the magnitude delta between the two datasets ranged 0.07 to 4.19 mag, NOT a tight cluster
 * near 0. The base field's brightness byte does not follow a Gaia-G-band-compatible calibration
 * (undocumented, vendored pre-existing asset — see ADR-0012 §3), so a tight magnitude gate was
 * silently rejecting genuine matches. Match is therefore angular separation < 5 arcsec alone,
 * with a generous |Δmag| < 6 kept only as a sanity backstop against a coincidental line-of-sight
 * pairing, not a real filter (see ADR-0012 §3 for why a true source-id crossmatch isn't possible
 * against this base field at all).
 *
 * Magnitude byte / clamp: identical formula and clamp every other pipeline script in this repo
 * uses (star-catalog.ts's decoder: mag = 12.5 - byte/255*14).
 *
 * Colour byte range: [-0.5, 2.0] B-V, matching gaia-cns5-pngpack.mjs's "ordinary nearby stars"
 * range (gaia-tiny is a general mixed population, the same case CNS5 already covers — NOT the
 * narrow white-dwarf-only range TR-064 chose for that different population).
 *
 * Chunking: magnitude-sorted ascending (brightest first), split into N roughly-equal chunks
 * (default 8 — ADR-0012 §4, a round reviewable number, not a measured optimum). TWO-PASS,
 * TYPED-ARRAY streaming — this dataset is ~20x the scale gaia-cns5-pngpack.mjs's small
 * array-of-objects approach was ever asked to hold; per this repo's own C0 "wrong tool past
 * roughly a million records" finding (the reason packStreamToBytes exists at all), no per-star
 * JS object is ever allocated. Pass 1 computes each candidate's sort key (appMag) and dedup
 * decision into flat typed arrays; Pass 2 re-reads the source files in the same order and writes
 * directly into one pre-sized output byte buffer at each record's final sorted position.
 *
 * Run: node scripts/gaia-tiny-pngpack.mjs [--chunks 8] [--out-dir public/assets]
 *      [--sample N]  (dev/testing: only process the first N records of EACH source file)
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";
import {
  readOctreeMetadataFile,
  forEachOctreeParticleInFile,
  octreeXyzToRaDecDistance,
  extractHipNumber,
} from "./lib/gaiasky-octree-particles.mjs";
import {
  RECORD_BYTES,
  bytesToPixelBuffer,
  readPngAsRgbBytes,
} from "./lib/starfield-pngpack.mjs";

const OCTREE_DIR =
  "resources/gaia_datasets/catalog-gaia-dr3-tiny/catalog/gaia-dr3-tiny";
const PARTICLE_FILES = [
  "particles/particles_000000.bin",
  "particles/particles_000010.bin",
];
const BASE_FIELD_PNG = "public/assets/stars-hip.png";
const PC_TO_LY = 3.26156;
const STAR_TYPE_BYTE = 0; // ordinary point source — matches every other star population here
const CI_LO = -0.5;
const CI_HI = 2.0; // B-V span; matches gaia-cns5-pngpack.mjs's "ordinary nearby stars" range
const MATCH_RADIUS_ARCSEC = 5;
// Sanity backstop only, not a real filter — see this file's header for the calibration finding
// (300/300 real matches spanned Δmag 0.07-4.19; the base field's brightness byte isn't on a
// Gaia-G-band-compatible scale). Rejects only a coincidental line-of-sight pairing, never a real
// match at this dataset's actual magnitude range.
const MATCH_MAG_DELTA = 6.0;
const GRID_BIN_DEG = 0.1; // >> match radius (5" = 0.00139deg); 3x3 neighbourhood always covers it

function raDecToDir(ra, dec) {
  const d2r = Math.PI / 180;
  const cd = Math.cos(dec * d2r);
  return [
    cd * Math.cos(ra * d2r),
    cd * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
}

function magToByte(mag) {
  return ((12.5 - mag) / 14) * 255;
}

function clampByte(n) {
  return Math.max(0, Math.min(255, Math.round(n)));
}

/** Forward Ballesteros (2012) T(B-V), the formula this dataset's own ecosystem (Gaia Sky's
 * BVToTeff_ballesteros) uses. Wikipedia "Color index": T = 4600K*(1/(0.92*bv+1.7) + 1/(0.92*bv+0.62)). */
function teffFromBv(bv) {
  return 4600 * (1 / (0.92 * bv + 1.7) + 1 / (0.92 * bv + 0.62));
}

/** Numerical inverse of teffFromBv via bisection (monotonic decreasing over the plausible
 * stellar range) — avoids trusting a hand-expanded quadratic for a physically load-bearing
 * conversion. Verified in this slice's ADR/TR against the Sun (exact), Vega/Sirius (~0.02-0.045
 * mag), Betelgeuse/Rigel (~0.1-0.2 mag, expected for evolved non-blackbody atmospheres). */
function bvFromTeff(teff, lo = -0.4, hi = 3.0) {
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (teffFromBv(mid) > teff) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

function parseArgs(argv) {
  const args = { chunks: 8, outDir: "public/assets", sample: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--chunks") args.chunks = Number.parseInt(argv[++i], 10);
    else if (argv[i] === "--out-dir") args.outDir = argv[++i];
    else if (argv[i] === "--sample")
      args.sample = Number.parseInt(argv[++i], 10);
  }
  return args;
}

/** Decodes the shipped base star field's Hipparcos chunk (type-0 records only — deep.png's
 * deep-sky objects are never Hipparcos stars) and buckets each into a 0.1deg RA/Dec grid for
 * cheap nearest-neighbour dedup lookups. */
async function buildBaseFieldGrid() {
  const rgb = await readPngAsRgbBytes(BASE_FIELD_PNG);
  const view = new DataView(rgb.buffer, rgb.byteOffset, rgb.byteLength);
  const count = Math.floor(rgb.length / RECORD_BYTES);
  const grid = new Map();
  let starCount = 0;
  for (let i = 0; i < count; i++) {
    const o = i * RECORD_BYTES;
    const typeByte = rgb[o + 14];
    if (typeByte !== STAR_TYPE_BYTE) continue;
    const x = view.getFloat32(o, true);
    const y = view.getFloat32(o + 4, true);
    const z = view.getFloat32(o + 8, true);
    const magByte = rgb[o + 12];
    const r = Math.sqrt(x * x + y * y + z * z);
    if (r === 0) continue;
    const dec = Math.asin(z / r) * (180 / Math.PI);
    let ra = Math.atan2(y, x) * (180 / Math.PI);
    if (ra < 0) ra += 360;
    const mag = 12.5 - (magByte / 255) * 14;
    const key = gridKey(ra, dec);
    let bucket = grid.get(key);
    if (!bucket) grid.set(key, (bucket = []));
    bucket.push({ ra, dec, mag });
    starCount++;
  }
  console.log(
    `base field grid: ${starCount} type-0 (star) records from ${BASE_FIELD_PNG} (${count} total records)`,
  );
  return grid;
}

function gridKey(ra, dec) {
  const raBin = Math.floor((((ra % 360) + 360) % 360) / GRID_BIN_DEG);
  const decBin = Math.floor((dec + 90) / GRID_BIN_DEG);
  return `${raBin}:${decBin}`;
}

/** True if (ra, dec, mag) matches any base-field candidate within MATCH_RADIUS_ARCSEC and
 * MATCH_MAG_DELTA, checking the 3x3 neighbourhood of 0.1deg bins around the candidate. */
function matchesBaseField(grid, ra, dec, mag) {
  const raBin = Math.floor((((ra % 360) + 360) % 360) / GRID_BIN_DEG);
  const decBin = Math.floor((dec + 90) / GRID_BIN_DEG);
  const cosDec = Math.cos((dec * Math.PI) / 180);
  const radiusDeg = MATCH_RADIUS_ARCSEC / 3600;
  for (let dr = -1; dr <= 1; dr++) {
    for (let dd = -1; dd <= 1; dd++) {
      const key = `${(raBin + dr + 3600) % 3600}:${decBin + dd}`;
      const bucket = grid.get(key);
      if (!bucket) continue;
      for (const c of bucket) {
        if (Math.abs(c.mag - mag) > MATCH_MAG_DELTA) continue;
        let dRa = Math.abs(c.ra - ra);
        if (dRa > 180) dRa = 360 - dRa;
        const sepDeg = Math.sqrt((dRa * cosDec) ** 2 + (c.dec - dec) ** 2);
        if (sepDeg <= radiusDeg) return true;
      }
    }
  }
  return false;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  const meta = readOctreeMetadataFile(`${OCTREE_DIR}/metadata.bin`);
  const totalDeclared = meta.octants[0]?.cumulativeStars ?? 0;
  console.log(
    `octree metadata: ${meta.octants.length} octants, ${totalDeclared} cumulative stars declared`,
  );

  const grid = await buildBaseFieldGrid();

  // --- Pass 1: sort key + dedup decision into flat typed arrays, no per-star object. Star
  // counts come straight from the already-decoded octree metadata (starsInNode, in file order)
  // rather than a throwaway extra read of each particle file's own header. ---
  const totalCount = meta.octants.reduce((sum, oc) => sum + oc.starsInNode, 0);
  const magKey = new Float32Array(totalCount);
  const dropped = new Uint8Array(totalCount);
  let g = 0;
  let namedCount = 0;
  let droppedCount = 0;
  for (const f of PARTICLE_FILES) {
    const path = `${OCTREE_DIR}/${f}`;
    const limit = args.sample ?? Infinity;
    let localCount = 0;
    forEachOctreeParticleInFile(path, (star) => {
      if (localCount >= limit) {
        // --sample truncation: exclude, don't silently keep at a false magnitude 0.
        dropped[g] = 1;
        g++;
        localCount++;
        return;
      }
      localCount++;
      magKey[g] = star.appMag;
      // Only a true HIP-tagged record can possibly be in the (Hipparcos-only) base field — a
      // named-but-non-HIP record (e.g. a bare variable-star designation) is never checked.
      if (extractHipNumber(star.name) !== null) {
        namedCount++;
        const { ra, dec } = octreeXyzToRaDecDistance(star.x, star.y, star.z);
        if (matchesBaseField(grid, ra, dec, star.appMag)) {
          dropped[g] = 1;
          droppedCount++;
        }
      }
      g++;
    });
    console.log(`pass 1: read ${localCount} stars from ${path}`);
  }
  console.log(
    `pass 1 complete: ${totalCount} total, ${namedCount} HIP-tagged candidates, ${droppedCount} deduped against the base field, ${totalCount - droppedCount} kept (${Date.now() - t0}ms)`,
  );

  // --- Rank kept records by ascending magnitude (brightest first). ---
  const keptIndices = [];
  for (let i = 0; i < totalCount; i++) {
    if (!dropped[i]) keptIndices.push(i);
  }
  keptIndices.sort((a, b) => magKey[a] - magKey[b]);
  const keptCount = keptIndices.length;
  const rankOf = new Int32Array(totalCount).fill(-1);
  for (let rank = 0; rank < keptCount; rank++) rankOf[keptIndices[rank]] = rank;

  const chunkCount = args.chunks;
  const perChunk = Math.ceil(keptCount / chunkCount);
  console.log(
    `${keptCount} records to emit across ${chunkCount} chunks (~${perChunk}/chunk)`,
  );

  // --- Pass 2: re-read in the same order, write each kept record straight into its final
  // sorted-by-magnitude byte position. One buffer for the whole output; sliced into chunk files
  // afterward — 15 bytes * ~2.44M records is ~36.6 MB, an unremarkable single allocation (this
  // is the SAME "one big Buffer is fine, per-record JS objects are not" reasoning
  // gaiasky-binary-particles.mjs's header already applies to a comparable-scale read). ---
  const allBytes = Buffer.alloc(keptCount * RECORD_BYTES);
  let colourSaneCount = 0;
  let colourFallbackCount = 0;
  g = 0;
  for (const f of PARTICLE_FILES) {
    const path = `${OCTREE_DIR}/${f}`;
    forEachOctreeParticleInFile(path, (star) => {
      const rank = rankOf[g];
      g++;
      if (rank === -1) return;
      const { ra, dec, distancePc } = octreeXyzToRaDecDistance(
        star.x,
        star.y,
        star.z,
      );
      const distanceLy = distancePc * PC_TO_LY;
      const [dx, dy, dz] = raDecToDir(ra, dec);
      let bv;
      if (Number.isFinite(star.tEff) && star.tEff > 0 && star.tEff < 200000) {
        bv = bvFromTeff(star.tEff);
        colourSaneCount++;
      } else {
        bv = 0.65; // Sun-like fallback for the rare non-physical/missing tEff record
        colourFallbackCount++;
      }
      const o = rank * RECORD_BYTES;
      allBytes.writeFloatLE(dx * distanceLy, o);
      allBytes.writeFloatLE(dy * distanceLy, o + 4);
      allBytes.writeFloatLE(dz * distanceLy, o + 8);
      allBytes.writeUInt8(clampByte(magToByte(star.appMag)), o + 12);
      allBytes.writeUInt8(
        clampByte(((bv - CI_LO) / (CI_HI - CI_LO)) * 255),
        o + 13,
      );
      allBytes.writeUInt8(STAR_TYPE_BYTE, o + 14);
    });
  }
  console.log(
    `pass 2 complete: wrote ${keptCount} records (${colourSaneCount} real tEff, ${colourFallbackCount} fallback colour) (${Date.now() - t0}ms total)`,
  );

  mkdirSync(args.outDir, { recursive: true });
  const manifest = [];
  for (let c = 0; c < chunkCount; c++) {
    const start = c * perChunk * RECORD_BYTES;
    const end = Math.min(allBytes.length, start + perChunk * RECORD_BYTES);
    if (start >= end) break;
    const chunkBytes = allBytes.subarray(start, end);
    const recordCount = chunkBytes.length / RECORD_BYTES;
    const outPath = `${args.outDir}/gaia-tiny-${String(c).padStart(2, "0")}.png`;
    mkdirSync(dirname(outPath), { recursive: true });
    const { pixels, width, height } = bytesToPixelBuffer(chunkBytes);
    await sharp(pixels, { raw: { width, height, channels: 4 } })
      .png()
      .toFile(outPath);
    manifest.push({ chunk: c, path: outPath, recordCount, width, height });
    console.log(
      `wrote chunk ${c}: ${recordCount} records -> ${outPath} (${width}x${height})`,
    );
  }

  writeFileSync(
    `${args.outDir}/gaia-tiny-manifest.json`,
    JSON.stringify(
      {
        generatedFrom: OCTREE_DIR,
        totalSourceStars: totalCount,
        keptAfterDedup: keptCount,
        droppedAsDuplicate: droppedCount,
        chunkCount: manifest.length,
        chunks: manifest.map((m) => ({
          chunk: m.chunk,
          recordCount: m.recordCount,
        })),
      },
      null,
      2,
    ),
  );
  console.log(`done in ${Date.now() - t0}ms`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
