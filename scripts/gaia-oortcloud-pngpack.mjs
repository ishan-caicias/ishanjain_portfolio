#!/usr/bin/env node
/* gaia-oortcloud-pngpack.mjs — PF-10 C1: Oort cloud -> PNG-packed background layer, Track B.
 *
 * REAL FINDING that changes this sub-item's scope (discovered applying Astra's white-dwarf
 * type-byte recommendation this session, TR-064/TR-065): both shader twins
 * (babylon-engine.ts's ijStarFragmentShader, GLSL and WGSL) ALREADY reserve object-type byte 7
 * for "oort dust grain" (`ty > 6.5` branch — a soft, non-PSF dust-grain treatment, distinct from
 * the ordinary stellar PSF used for type 0). The PF-10 plan assumed Oort cloud would need a new
 * GPU-instanced particle system; it does not — the existing 15-byte star-record format
 * (star-catalog.ts) already has a slot for exactly this population. This is Track B, the SAME
 * PNG-pack technique as the star field / white dwarfs / CNS5, not a new rendering primitive.
 *
 * Source: resources/gaia_datasets/oort-cloud/oortcloud/oort_10000particles.dat — a REAL third
 * local format (plain-text "X Y Z" header + 10,000 rows, no VOTable/FITS wrapper). Per the
 * dataset's own description this is SIMULATED Oort cloud data, not individually-observed real
 * objects — consistent with real astronomy: no actual Oort Cloud object has ever been directly
 * imaged at this distance, so every visualization of the Oort cloud anywhere is a physically-
 * motivated statistical model, not an observational catalog. Astra's own audit vocabulary
 * (TR-064) calls this SIMPLIFIED / declared-license, the same honest label already accepted for
 * the bulk MWSC background cluster layer — appropriate for an ambient population, not a
 * dossier-carrying body.
 *
 * UNITS ASSUMPTION (flagged, not silently asserted): the source file declares no explicit unit.
 * Treated as AU, checked by real-world sanity: the sample's radial distribution (computed this
 * session) spans 1,789-157,267 of the file's raw units, matching real Oort cloud distance
 * estimates almost exactly (inner Hills-cloud boundary ~2,000 AU; outer edge commonly cited at
 * 100,000-200,000 AU) — strong circumstantial confirmation, not a documented guarantee.
 *
 * Colour/magnitude bytes: this population has no per-object photometry in the source file at all
 * (it is a position-only dynamical simulation) — a uniform dim, cool-grey byte pair is used
 * rather than fabricating brightness/colour variation the data doesn't contain.
 *
 * Mechanism proven; NOT wired into any render path. Loading a third background-layer chunk
 * alongside stars-hip.png/deep.png (CATALOG_CHUNKS in star-catalog.ts), generating the real
 * shipped PNG asset, and hooking engine setup in babylon-engine.ts/space-engine.js to fetch and
 * draw it is real rendering-integration work, not attempted here — same open-item class as the
 * white dwarfs' full-scale wiring.
 *
 * Run: node scripts/gaia-oortcloud-pngpack.mjs [--out scripts/out/oortcloud-sample.png]
 */
import { readFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { writeRecordsAsPng } from "./lib/starfield-pngpack.mjs";

const DAT_PATH =
  "resources/gaia_datasets/oort-cloud/oortcloud/oort_10000particles.dat";
const AU_TO_LY = 1 / 63241.077;
const OORT_TYPE_BYTE = 7; // "oort dust grain" — already a real shader branch, see header note
const UNIFORM_MAG_BYTE = 40; // dim (no real photometry in source data — see header note)
const UNIFORM_COLOUR_BYTE = 90; // cool neutral grey-blue, mid-ramp

function parseRows(text) {
  const lines = text.trim().split("\n");
  const header = lines[0];
  if (!/^#?\s*X\s+Y\s+Z\s*$/i.test(header.trim())) {
    throw new Error(
      `gaia-oortcloud-pngpack: unexpected header "${header}" — expected "X Y Z"`,
    );
  }
  return lines.slice(1).map((line) => {
    const [x, y, z] = line.trim().split(/\s+/).map(Number);
    return { x, y, z };
  });
}

function parseArgs(argv) {
  const args = { out: "scripts/out/oortcloud-sample.png" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = parseRows(readFileSync(DAT_PATH, "utf8"));
  console.log(`decoded ${rows.length} rows from ${DAT_PATH}`);

  const records = rows.map(({ x, y, z }) => ({
    x: x * AU_TO_LY,
    y: y * AU_TO_LY,
    z: z * AU_TO_LY,
    magByte: UNIFORM_MAG_BYTE,
    ciByte: UNIFORM_COLOUR_BYTE,
    typeByte: OORT_TYPE_BYTE,
  }));

  mkdirSync(dirname(args.out), { recursive: true });
  writeRecordsAsPng(records, args.out).then((info) => {
    console.log(
      `wrote ${info.recordCount} records (${info.byteCount} bytes) -> ${args.out} (${info.width}x${info.height})`,
    );
  });
}

main();
