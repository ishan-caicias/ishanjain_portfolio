#!/usr/bin/env node
/* gaia-clusters-pngpack.mjs — PF-10 C1: MWSC + Hunt-Reffert 2023 + OCDR2 star-cluster background
 * layer -> PNG-packed background layer, Track B.
 *
 * The plan's C1 table lists "Star clusters (Hunt-Reffert 2023 + OCDR2 + MWSC): 12,190 combined"
 * with 35 hand-curated named clusters already wired live as travelable dossier bodies
 * (src/data/celestial/celestial-clusters.js, TR-064) and the remaining ~12,155 flagged as a
 * separate "instanced background layer (real MWSC coordinates, no per-object dossier)" — not yet
 * started as of TR-066. This script builds that layer, generalized to all 3 source catalogs (not
 * just MWSC) since Hunt-Reffert 2023 and OCDR2 are real, decodable, and were never a reason to
 * leave 9,184 of the 12,190 combined real clusters unrendered.
 *
 * All 3 sources are real VOTable 1.3 BINARY2 files (confirmed this session — MWSC was already
 * known from TR-061; Hunt-Reffert 2023 and OCDR2 were assumed but unverified, both checked here
 * and confirmed BINARY2, not the TABLEDATA variant CNS5/GD-1 turned out to be).
 *
 * Position: ra/dec (deg, J2000) -> unit direction via the SAME raDecToDir formula every other
 * PF-10 pack script uses, scaled by real distance in light-years. Distance field differs per
 * source (MWSC: `distance`, Hunt-Reffert: `dist50` — the median of a 3-quantile distance
 * estimate, Ndist>=1 for every row per TR checks above — OCDR2: `dist`), all in parsecs,
 * confirmed by cross-checking MWSC's Pleiades/Praesepe/M38 distances against TR-061's already-
 * verified real-world sanity check (same conversion, same source field, unchanged here).
 *
 * Photometry: none of the 3 source VOTables carry a per-object apparent-magnitude field (checked
 * the real FIELD schema of each, not assumed) — the same "no real photometry in the source" case
 * the Oort cloud script documented, which explicitly named this cluster layer as sharing that
 * honest treatment ("the same honest label already accepted for the bulk MWSC background cluster
 * layer" — gaia-oortcloud-pngpack.mjs's header, written before this script existed). A uniform
 * magnitude/colour byte pair is used rather than fabricating brightness/colour the data doesn't
 * contain.
 *
 * Object-type byte: 1 ("cluster: soft glow, no PSF core") — a real shader branch in both GLSL/WGSL
 * twins of ijStarFragmentShader, reserved since TR-066's type-byte legend audit but never used by
 * any shipped asset until now.
 *
 * Dedup against the 35 already-curated named clusters (celestial-clusters.js): those are
 * hand-verified against modern literature, not raw pipeline pulls (see that file's header), so
 * their ra/dec/ly won't byte-match any raw catalog row exactly. Excluded by angular separation
 * (<1.0 deg great-circle) combined with a generous distance-consistency check (<30% relative
 * difference) rather than name matching — cross-catalog name matching is unreliable here (MWSC
 * uses underscore names, Hunt-Reffert ships pipe-delimited cross-match compounds, OCDR2 uses yet
 * another convention) and irrelevant to a background layer with no per-object dossier anyway.
 *
 * Run: node scripts/gaia-clusters-pngpack.mjs [--out public/assets/clusters-bg.png]
 */
import { readVotableBinary2 } from "./lib/votable-binary2.mjs";
import { writeRecordsAsPng } from "./lib/starfield-pngpack.mjs";
import { isDuplicateOfCurated } from "./lib/cluster-dedup.mjs";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const PC_TO_LY = 3.26156;
const CLUSTER_TYPE_BYTE = 1; // "cluster: soft glow, no PSF core" — see header note
// PF-11 P2b: recomputed to preserve the ORIGINAL intended "moderate-dim" real magnitude (~8.66)
// under the rescaled decode formula (mag = 21.5 - 32*t + 9*t^2, t = byte/255) — byte 70 meant
// mag 8.66 under the old 12.5-floor formula; see gaia-oortcloud-pngpack.mjs's sibling note for
// why leaving the byte unchanged would silently shift the intended brightness.
const UNIFORM_MAG_BYTE = 118; // moderate-dim (~mag 8.66, unchanged intent — no real photometry in any of the 3 sources)
const UNIFORM_COLOUR_BYTE = 140; // warm-neutral mid-ramp, distinct from the Oort cloud's cool-grey
const DEDUP_ANGLE_DEG = 1.0;
const DEDUP_DISTANCE_FRAC = 0.3;
const CURATED_CLUSTERS_PATH = "scripts/out/curated-clusters-radec.json";

const SOURCES = [
  {
    label: "MWSC",
    votPath: "resources/gaia_datasets/catalog-mwsc/mwsc/catalog-mwsc.vot",
    distanceField: "distance",
  },
  {
    label: "Hunt-Reffert 2023",
    votPath:
      "resources/gaia_datasets/catalog-clusters-hunt-reffert-2023/data/clusters-hunt-reffert-2023-II.vot",
    distanceField: "dist50",
  },
  {
    label: "OCDR2",
    votPath: "resources/gaia_datasets/catalog-ocdr2/ocdr2/oc-clusters-dr2.vot",
    distanceField: "dist",
  },
];

function raDecToDir(ra, dec) {
  const d2r = Math.PI / 180;
  const cd = Math.cos(dec * d2r);
  return [
    cd * Math.cos(ra * d2r),
    cd * Math.sin(ra * d2r),
    Math.sin(dec * d2r),
  ];
}

function loadCuratedClusters() {
  const raw = JSON.parse(readFileSync(CURATED_CLUSTERS_PATH, "utf8"));
  return raw.filter(
    (c) =>
      Number.isFinite(c.ra) && Number.isFinite(c.dec) && Number.isFinite(c.ly),
  );
}

function parseArgs(argv) {
  const args = { out: "public/assets/clusters-bg.png" };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const curated = loadCuratedClusters();
  console.log(`loaded ${curated.length} curated clusters for dedup`);

  const records = [];
  let totalRaw = 0;
  let skippedBadCoords = 0;
  let skippedDuplicate = 0;

  for (const source of SOURCES) {
    const t0 = Date.now();
    const { rows } = readVotableBinary2(source.votPath);
    console.log(
      `decoded ${rows.length} rows from ${source.label} (${source.votPath}) in ${Date.now() - t0}ms`,
    );
    totalRaw += rows.length;

    for (const row of rows) {
      const ra = row.ra;
      const dec = row.dec;
      const distancePc = row[source.distanceField];
      if (
        !Number.isFinite(ra) ||
        !Number.isFinite(dec) ||
        !Number.isFinite(distancePc) ||
        distancePc <= 0
      ) {
        skippedBadCoords++;
        continue;
      }
      const distanceLy = distancePc * PC_TO_LY;
      if (
        isDuplicateOfCurated(
          ra,
          dec,
          distanceLy,
          curated,
          DEDUP_ANGLE_DEG,
          DEDUP_DISTANCE_FRAC,
        )
      ) {
        skippedDuplicate++;
        continue;
      }
      const [dx, dy, dz] = raDecToDir(ra, dec);
      records.push({
        x: dx * distanceLy,
        y: dy * distanceLy,
        z: dz * distanceLy,
        magByte: UNIFORM_MAG_BYTE,
        ciByte: UNIFORM_COLOUR_BYTE,
        typeByte: CLUSTER_TYPE_BYTE,
      });
    }
  }

  console.log(
    `${totalRaw} raw rows across ${SOURCES.length} sources -> ${skippedBadCoords} skipped (bad/missing coords or distance), ${skippedDuplicate} skipped (duplicate of a curated cluster) -> ${records.length} background records`,
  );

  mkdirSync(dirname(args.out), { recursive: true });
  writeRecordsAsPng(records, args.out).then((info) => {
    console.log(
      `wrote ${info.recordCount} records (${info.byteCount} bytes) -> ${args.out} (${info.width}x${info.height})`,
    );
  });
}

main();
