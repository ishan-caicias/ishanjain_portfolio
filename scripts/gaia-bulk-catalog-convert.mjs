#!/usr/bin/env node
/* gaia-bulk-catalog-convert.mjs — PF-10 C1: bulk (whole-catalog, not name-selected) curated-JSON
 * conversion for CNS5 nearby stars, GD-1 stellar stream, and NEARGALCAT (NBG) nearby galaxies.
 *
 * Different shape of work from gaia-dataset-pipeline.mjs (which hand-selects a handful of named
 * clusters via --names): the PF-10 C1 plan calls for these three datasets in FULL — every row
 * becomes a curated entry, mechanically, with the same honesty convention TR-061 established
 * (no fabricated flavour text; "con" left as the existing "-" placeholder; "f"/"lo" carry an
 * explicit [[TODO]] marker rather than invented prose). This is real catalog data end to end:
 * only ra/dec/distance/magnitude actually present in the source file are ever emitted.
 *
 * REAL FORMAT FINDING (corrects the PF-10 plan's C0 assumption that these packs are all VOTable
 * BINARY2): NBG is BINARY2, but CNS5 and GD-1 are plain-text VOTable TABLEDATA — a second local
 * serialization format, read here via scripts/lib/votable-tabledata.mjs (new this session).
 *
 * Run:
 *   node scripts/gaia-bulk-catalog-convert.mjs --dataset cns5 --out scripts/out/cns5-full.json
 *   node scripts/gaia-bulk-catalog-convert.mjs --dataset gd1  --out scripts/out/gd1-full.json
 *   node scripts/gaia-bulk-catalog-convert.mjs --dataset nbg  --out scripts/out/nbg-full.json
 */
import { readVotableBinary2 } from "./lib/votable-binary2.mjs";
import { readVotableTabledata } from "./lib/votable-tabledata.mjs";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const PC_TO_LY = 3.26156;
const TODO_F =
  "[[TODO: content pass — PF-10 C1 bulk dataset, no per-object dossier authored]]";

function round(n, dp) {
  if (!Number.isFinite(n)) return null;
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function clamp01(n) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
function slugId(prefix, seedText) {
  return `${prefix}-${String(seedText)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

/** Disambiguates a base slug against IDs already assigned in this run — CNS5's generic
 * "CNS5 NNNN" names are already unique per-row, but this guards any future dataset whose
 * display name collides across rows (first occurrence keeps the bare slug). */
function makeUniqueIdFactory() {
  const seen = new Map();
  return (prefix, seedText) => {
    const base = slugId(prefix, seedText);
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    return n === 1 ? base : `${base}-${n}`;
  };
}

function convertCns5(rows) {
  const nextId = makeUniqueIdFactory();
  const out = [];
  let skippedNoParallax = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.parallax) || row.parallax <= 0) {
      skippedNoParallax++;
      continue;
    }
    const distancePc = 1000 / row.parallax;
    const distanceLy = distancePc * PC_TO_LY;
    const displayName = row.name || `Gaia EDR3 ${row.gaia_edr3_id}`;
    out.push({
      id: nextId("cns5", row.cns5_id ?? displayName),
      n: displayName,
      d: "Nearby star · CNS5 (volume-complete, ~25 pc)",
      t: "star",
      r: "common",
      ra: round(row.ra, 5),
      dec: round(row.dec, 5),
      ly: round(distanceLy, 3),
      mg: Number.isFinite(row.g_mag) ? row.g_mag.toFixed(2) : "—",
      sp: "Nearby star (Gaia EDR3 / Hipparcos)",
      img: null,
      c: "#fff2c8",
      con: "—",
      st: [
        Number.isFinite(row.g_mag)
          ? [
              "Apparent magnitude (G)",
              row.g_mag.toFixed(2),
              clamp01((10 - row.g_mag) / 20),
            ]
          : null,
        ["Distance", `${round(distancePc, 2)} pc`, clamp01(distancePc / 25)],
        Number.isFinite(row.rv)
          ? [
              "Radial velocity",
              `${round(row.rv, 1)} km/s`,
              clamp01((row.rv + 100) / 200),
            ]
          : null,
      ].filter(Boolean),
      f: TODO_F,
      lo: null,
    });
  }
  if (skippedNoParallax > 0) {
    console.log(
      `cns5: skipped ${skippedNoParallax}/${rows.length} rows with non-positive/missing parallax`,
    );
  }
  return out;
}

function convertGd1(rows) {
  const nextId = makeUniqueIdFactory();
  const out = [];
  let skippedNoDistance = 0;
  rows.forEach((row, i) => {
    if (!Number.isFinite(row.distance) || row.distance <= 0) {
      skippedNoDistance++;
      return;
    }
    const distanceLy = row.distance * PC_TO_LY;
    out.push({
      id: nextId("gd1", `member-${i + 1}`),
      n: `GD-1 stream member ${i + 1}`,
      d: "GD-1 tidal stellar stream",
      t: "star",
      r: "common",
      ra: round(row.ra, 5),
      dec: round(row.dec, 5),
      ly: round(distanceLy, 1),
      mg: Number.isFinite(row.phot_g_mean_mag)
        ? row.phot_g_mean_mag.toFixed(2)
        : "—",
      sp: "Tidal stream star (disrupted globular cluster debris)",
      img: null,
      c: "#c9d6ff",
      con: "—",
      st: [
        [
          "Distance",
          `${round(row.distance, 0)} pc`,
          clamp01(row.distance / 12000),
        ],
        Number.isFinite(row.radial_velocity)
          ? [
              "Radial velocity",
              `${round(row.radial_velocity, 1)} km/s`,
              clamp01((row.radial_velocity + 300) / 400),
            ]
          : null,
      ].filter(Boolean),
      f: TODO_F,
      lo: null,
    });
  });
  if (skippedNoDistance > 0) {
    console.log(
      `gd1: skipped ${skippedNoDistance}/${rows.length} rows with missing distance`,
    );
  }
  return out;
}

function convertNbg(rows) {
  const nextId = makeUniqueIdFactory();
  const out = [];
  let skippedNoDistance = 0;
  for (const row of rows) {
    if (!Number.isFinite(row.distance) || row.distance <= 0) {
      skippedNoDistance++;
      continue;
    }
    const distanceLy = row.distance * PC_TO_LY;
    const displayName =
      row.name ||
      `NBG ${round(row.ra, 2)}${row.dec >= 0 ? "+" : ""}${round(row.dec, 2)}`;
    out.push({
      id: nextId("nbg", displayName),
      n: displayName,
      d: "Nearby galaxy · NEARGALCAT (within 11 Mpc)",
      t: "galaxy",
      r: "uncommon",
      ra: round(row.ra, 5),
      dec: round(row.dec, 5),
      ly: round(distanceLy, 0),
      mg: Number.isFinite(row.appmag) ? row.appmag.toFixed(2) : "—",
      sp: "Nearby galaxy",
      img: null,
      c: "#ffd9a0",
      con: "—",
      st: [
        [
          "Distance",
          `${round(row.distance / 1e6, 3)} Mpc`,
          clamp01(row.distance / 1.1e7),
        ],
        Number.isFinite(row.absmag)
          ? [
              "Absolute magnitude",
              row.absmag.toFixed(2),
              clamp01((-10 - row.absmag) / 12),
            ]
          : null,
        Number.isFinite(row.linear_diameter)
          ? [
              "Linear diameter",
              `${round(row.linear_diameter, 2)} kpc`,
              clamp01(row.linear_diameter / 50),
            ]
          : null,
      ].filter(Boolean),
      f: TODO_F,
      lo: null,
    });
  }
  if (skippedNoDistance > 0) {
    console.log(
      `nbg: skipped ${skippedNoDistance}/${rows.length} rows with missing distance`,
    );
  }
  return out;
}

const DATASETS = {
  cns5: {
    read: () =>
      readVotableTabledata(
        "resources/gaia_datasets/catalog-cns5/catalog/cns5/cns5.vot",
      ),
    convert: convertCns5,
  },
  gd1: {
    read: () =>
      readVotableTabledata(
        "resources/gaia_datasets/catalog-gd1/catalog-gd1/catalog/gd1/gd1-bright.vot",
      ),
    convert: convertGd1,
  },
  nbg: {
    read: () =>
      readVotableBinary2("resources/gaia_datasets/catalog-nbg/nbg/nbg.vot"),
    convert: convertNbg,
  },
};

function parseArgs(argv) {
  const args = { dataset: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dataset") args.dataset = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataset || !DATASETS[args.dataset]) {
    console.error(
      `Usage: node scripts/gaia-bulk-catalog-convert.mjs --dataset <${Object.keys(DATASETS).join("|")}> --out path`,
    );
    process.exit(1);
  }
  const cfg = DATASETS[args.dataset];
  const t0 = Date.now();
  const { rows } = cfg.read();
  console.log(
    `decoded ${rows.length} rows for ${args.dataset} in ${Date.now() - t0}ms`,
  );
  const entries = cfg.convert(rows);
  const outPath = args.out ?? `scripts/out/${args.dataset}-full.json`;
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`wrote ${entries.length} curated entries -> ${outPath}`);
}

main();
