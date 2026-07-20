#!/usr/bin/env node
/* gaia-whitedwarf-pngpack.mjs — PF-10 C0 Track B: eDR3 white dwarfs -> PNG-packed background
 * layer, proving the pipeline's second output track (see gaia-dataset-pipeline.mjs for Track A).
 *
 * Source: resources/gaia_datasets/catalog-whitedwarfs-edr3/catalog/wd/edr3/wd_edr3.fits — a
 * REAL FITS binary table (a third data format found in this repo's local datasets, distinct
 * from plain JSON and VOTable BINARY2; see scripts/lib/fits-bintable.mjs), 359,073 rows,
 * Gentile Fusillo et al. 2021 high-confidence (Pwd > 0.75) white dwarf candidates.
 *
 * Position: ra/dec (deg, J2000) -> unit direction via the SAME raDecToDir formula
 * ship-dynamics.ts uses (duplicated here deliberately, matching that file's own stated
 * rationale for not importing from the live-engine-adjacent module graph into a build script),
 * scaled by real distance in light-years derived from parallax (mas): pc = 1000/parallax,
 * ly = pc * 3.26156. This matches the shipped star field's own convention, confirmed by
 * decoding real bytes from assets/stars-hip.png: position-vector magnitude varies per star
 * (34.8 ly to 2,399.6 ly across an 8-record sample) rather than sitting on a fixed shell radius
 * — i.e. real linear light-year distance, not the logarithmic bodyDepth() scale curated
 * destination bodies use.
 *
 * Magnitude byte: same formula star-catalog.ts's decoder documents (mag = 12.5 - m/255*14),
 * inverted to solve for the byte from a real phot_g_mean_mag value.
 *
 * Colour byte: TR-064 Astra REALISM-AUDIT applied (2026-07-20, this session) — real Gaia bp_rp
 * (BP-RP, standard blue-minus-red colour index) clamped to [-0.6, 1.2], the literature-informed
 * white-dwarf colour span (SIMPLIFIED verdict on the original [-0.5, 2.0] main-sequence-shaped
 * range: right physics, wrong range — a main-sequence span wastes most of the byte's dynamic
 * range on a population that's much bluer and narrower). Since the shared magnitude byte already
 * saturates for this entire population (every sampled G≈18-20 white dwarf floors to the dimmest
 * byte, TR-063), colour is the ONLY surviving differentiator, which is why getting this range
 * right matters more here than for an ordinary star population.
 *
 * Object-type byte: TR-064 Astra REALISM-AUDIT applied — 0 (ordinary point source), not the
 * original provisional 1. Verified against the actual shader legend (babylon-engine.ts's
 * ijStarFragmentShader, both GLSL/WGSL twins) before applying, per TR-064's explicit caveat that
 * Astra had no visibility into what the type byte branches on: type 1 renders as "cluster: soft
 * glow, no PSF core" (a diffuse gaussian blob, `ty > 0.5 && ty < 1.5` branch) — the original
 * choice would have drawn every white dwarf as an extended cluster-glow shape, misrepresenting a
 * population that is physically a point source. Type 0 falls through to the shader's default
 * "stellar PSF + bloom" branch, the physically correct treatment. (Type 7, discovered while
 * verifying this: the shader already reserves an "oort dust grain" render branch — relevant to
 * PF-10 C1's separate Oort cloud sub-item, not applied here.)
 *
 * Run: node scripts/gaia-whitedwarf-pngpack.mjs --sample 2000 --out scripts/out/whitedwarfs-sample.png
 */
import { readFitsBinTable } from "./lib/fits-bintable.mjs";
import { writeRecordsAsPng } from "./lib/starfield-pngpack.mjs";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const FITS_PATH =
  "resources/gaia_datasets/catalog-whitedwarfs-edr3/catalog/wd/edr3/wd_edr3.fits";
const PC_TO_LY = 3.26156;
const WHITE_DWARF_TYPE_BYTE = 0; // ordinary point source — see TR-064 Astra audit note above

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
  // inverse of: mag = 12.5 - byte/255*14
  return ((12.5 - mag) / 14) * 255;
}

function colourToByte(bpRp) {
  const lo = -0.6;
  const hi = 1.2;
  const t = (bpRp - lo) / (hi - lo);
  return t * 255;
}

function parseArgs(argv) {
  const args = { sample: null, out: "scripts/out/whitedwarfs-sample.png" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--sample") args.sample = Number.parseInt(argv[++i], 10);
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();
  const { rows, totalRows } = readFitsBinTable(FITS_PATH, {
    limit: args.sample ?? undefined,
  });
  console.log(
    `decoded ${rows.length}/${totalRows} rows from ${FITS_PATH} in ${Date.now() - t0}ms`,
  );

  let skippedNoParallax = 0;
  const records = [];
  for (const row of rows) {
    if (!Number.isFinite(row.parallax) || row.parallax <= 0) {
      skippedNoParallax++;
      continue;
    }
    const distancePc = 1000 / row.parallax;
    const distanceLy = distancePc * PC_TO_LY;
    const [dx, dy, dz] = raDecToDir(row.ra, row.dec);
    records.push({
      x: dx * distanceLy,
      y: dy * distanceLy,
      z: dz * distanceLy,
      magByte: magToByte(row.phot_g_mean_mag),
      ciByte: colourToByte(row.bp_rp),
      typeByte: WHITE_DWARF_TYPE_BYTE,
      // kept for the round-trip proof's cross-check, not part of the packed bytes
      _source: {
        name: row.name,
        ra: row.ra,
        dec: row.dec,
        distanceLy,
        mag: row.phot_g_mean_mag,
      },
    });
  }
  if (skippedNoParallax > 0) {
    console.log(
      `skipped ${skippedNoParallax} rows with non-positive/missing parallax (can't derive distance)`,
    );
  }

  mkdirSync(dirname(args.out), { recursive: true });
  writeRecordsAsPng(records, args.out).then((info) => {
    console.log(
      `wrote ${info.recordCount} records (${info.byteCount} bytes) -> ${args.out} (${info.width}x${info.height})`,
    );
  });
}

main();
