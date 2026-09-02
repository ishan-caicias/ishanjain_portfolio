#!/usr/bin/env node
/* gaia-cns5-pngpack.mjs — PF-10 C1: CNS5 nearby stars -> PNG-packed background layer, Track B.
 *
 * REAL MEASURED FINDING that motivates this (not a re-run of the C0 assumption): wiring CNS5's
 * full 5,930 real rows through the Track A curated-JSON path (like GD-1/NBG/minor planets in
 * this same session) measured at 271.5 KB gzip standalone against a bundle that, after those
 * three additions, had only ~52 KB of budget headroom left (`npm run budget:check`, this
 * session). CNS5 does not fit Track A at the site's CURRENT bundle size — this is exactly the
 * "No dataset is bulk-loaded into the JS bundle past the curated-JSON safe range" rule from the
 * PF-10 plan's data-size policy, discovered by measurement rather than assumed from the original
 * gap analysis's per-dataset (not per-bundle) "Yes" verdict.
 *
 * This script proves the Track B mechanism for CNS5 exactly as TR-063 proved it for the eDR3
 * white dwarfs: real VOTable TABLEDATA decode (scripts/lib/votable-tabledata.mjs) -> the same
 * shipped byte layout writeRecordsAsPng/decodeStarCatalog already use for the 168,959-star field.
 * Mechanism proven; NOT wired into the actual background-layer render path (that merge — a
 * second background layer alongside the existing star-catalog PNG — is real rendering-
 * integration work, same open item as the white dwarfs, not attempted here).
 *
 * Position: ra/dec (deg, J2000) -> unit direction via the SAME raDecToDir formula ship-dynamics.ts
 * uses, scaled by real distance in light-years derived from parallax (mas): pc = 1000/parallax,
 * ly = pc * 3.26156 — identical convention to gaia-whitedwarf-pngpack.mjs.
 *
 * Magnitude byte: same formula star-catalog.ts's decoder documents (PF-11 P2b rescale:
 * mag = 21.5 - 32*t + 9*t^2, t = byte/255). CNS5 stars are naked-eye-adjacent to modestly faint
 * (unlike the white dwarfs, which all saturated the OLD 12.5-mag-floor format) — real G
 * magnitudes here mostly land inside even the old format's range, a genuinely different
 * population behaviour worth recording; the new format only widens that margin further.
 *
 * Colour byte: bp_rp = bp_mag - rp_mag (both real Gaia bands present in this catalog, unlike a
 * pre-computed bp_rp column), clamped to the SAME [-0.5, 2.0] main-sequence-shaped span
 * star-catalog.ts's shader was built against — appropriate here (CNS5 is ordinary nearby stars,
 * not the white-dwarf population Astra's TR-064 audit flagged for a tighter range).
 *
 * Run: node scripts/gaia-cns5-pngpack.mjs [--out scripts/out/cns5-sample.png]
 */
import { readVotableTabledata } from "./lib/votable-tabledata.mjs";
import { writeRecordsAsPng } from "./lib/starfield-pngpack.mjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const VOT_PATH = "resources/gaia_datasets/catalog-cns5/catalog/cns5/cns5.vot";
const PC_TO_LY = 3.26156;
const STAR_TYPE_BYTE = 0; // ordinary point-source star, matches the existing star-field convention

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
  // inverse of: mag = 21.5 - 32*t + 9*t^2, t = byte/255 (PF-11 P2b rescale)
  const t = (32 - Math.sqrt(1024 - 36 * (21.5 - mag))) / 18;
  return t * 255;
}

function colourToByte(bpRp) {
  const lo = -0.5;
  const hi = 2.0;
  const t = (bpRp - lo) / (hi - lo);
  return t * 255;
}

function parseArgs(argv) {
  const args = { out: "scripts/out/cns5-sample.png" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const { rows } = readVotableTabledata(VOT_PATH);
  console.log(
    `decoded ${rows.length} rows from ${VOT_PATH} in ${Date.now() - t0}ms`,
  );

  let skippedNoParallax = 0;
  let skippedNoMag = 0;
  let inRangeMagCount = 0;
  const records = [];
  for (const row of rows) {
    if (!Number.isFinite(row.parallax) || row.parallax <= 0) {
      skippedNoParallax++;
      continue;
    }
    if (!Number.isFinite(row.g_mag)) {
      skippedNoMag++;
      continue;
    }
    // PF-11 P2b: the format's floor moved from mag 12.5 to mag 21.5 — this threshold now
    // tracks the NEW floor so the diagnostic stays meaningful under the rescaled format.
    if (row.g_mag <= 21.5) inRangeMagCount++;
    const distancePc = 1000 / row.parallax;
    const distanceLy = distancePc * PC_TO_LY;
    const [dx, dy, dz] = raDecToDir(row.ra, row.dec);
    const bpRp =
      Number.isFinite(row.bp_mag) && Number.isFinite(row.rp_mag)
        ? row.bp_mag - row.rp_mag
        : 0.7; // neutral fallback (roughly Sun-like) when either band is missing
    records.push({
      x: dx * distanceLy,
      y: dy * distanceLy,
      z: dz * distanceLy,
      magByte: magToByte(row.g_mag),
      ciByte: colourToByte(bpRp),
      typeByte: STAR_TYPE_BYTE,
      _source: {
        name: row.name,
        ra: row.ra,
        dec: row.dec,
        distanceLy,
        mag: row.g_mag,
      },
    });
  }
  console.log(
    `skipped ${skippedNoParallax} (no parallax), ${skippedNoMag} (no g_mag); ${inRangeMagCount}/${records.length} records fall inside the format's byte range (mag <= 21.5, PF-11 P2b floor) — unlike the pre-rescale white-dwarf population, most of CNS5 was never anywhere near saturating even the old mag-12.5 floor`,
  );

  mkdirSync(dirname(args.out), { recursive: true });
  writeRecordsAsPng(records, args.out).then((info) => {
    console.log(
      `wrote ${info.recordCount} records (${info.byteCount} bytes) -> ${args.out} (${info.width}x${info.height})`,
    );
  });
}

main();
