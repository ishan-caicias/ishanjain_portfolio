#!/usr/bin/env node
/* gaia-dataset-pipeline.mjs — PF-10 C0: Gaia Sky dataset → curated celestial-*.js converter.
 *
 * Reconstructs the conversion step the repo's history refers to as data/build/03-curated.js
 * (that file's executable body doesn't exist anywhere in this repo — only its header comment
 * survives, per the PF-10 gap analysis). This is a fresh implementation, Track A only (curated
 * JSON output, the celestial-gaia.js pattern) — Track B (PNG-packed background layers for
 * bulk populations like SDSS DR18 or the white dwarf catalog) is separate, larger work and is
 * NOT what this script does.
 *
 * Run locally, outside any chat/agent session, once a real target list exists:
 *   node scripts/gaia-dataset-pipeline.mjs --dataset mwsc --names "Melotte_22,NGC_1912,NGC_2632"
 *   node scripts/gaia-dataset-pipeline.mjs --dataset mwsc --sample 5      (inspect, no file written)
 *
 * What this DOES do mechanically, from real catalog data:
 *   id, name, real ra/dec (deg, J2000 — same convention the existing runtime already consumes
 *   via ship-dynamics.ts's raDecToDir/bodyWorldPosition, unchanged here), distance (pc -> ly),
 *   type, and whatever physical stats the source VOTable carries (age, star count, radius...).
 *
 * What this DELIBERATELY DOES NOT fabricate: the constellation field ("con") is left as "-"
 * (the exact placeholder src/data/celestial/celestial-gaia.js already uses for moon-topo /
 * mars-topo when it isn't computed), and the narrative fields ("f" flavour text, "lo" lore
 * entries) are emitted as an explicit [[TODO: ...]] marker, never invented prose dressed up as
 * real content. A human content pass fills those in before the batch ships — see PF-10 C1.
 */
import { readVotableBinary2 } from "./lib/votable-binary2.mjs";
import { writeFileSync } from "node:fs";
import { join } from "node:path";

const PC_TO_LY = 3.26156;

const DATASETS = {
  mwsc: {
    votPath: "resources/gaia_datasets/catalog-mwsc/mwsc/catalog-mwsc.vot",
    idPrefix: "mwsc",
    sourceLabel: "MWSC (Kharchenko et al. 2013)",
  },
  "hunt-reffert-2023": {
    votPath:
      "resources/gaia_datasets/catalog-clusters-hunt-reffert-2023/data/clusters-hunt-reffert-2023-II.vot",
    idPrefix: "hr23",
    sourceLabel: "Hunt & Reffert (2023) Gaia DR3 open clusters",
  },
};

const CLUSTER_TYPE_LABEL = {
  g: "globular cluster",
  m: "moving group",
  n: "nebula-associated cluster",
  r: "remnant cluster",
  s: "cluster remnant candidate",
  a: "association",
  null: "open cluster",
};

function slugId(prefix, name) {
  return `${prefix}-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function toCuratedEntry(row, dataset) {
  const distanceLy =
    typeof row.distance === "number" ? row.distance * PC_TO_LY : null;
  const typeLabel = CLUSTER_TYPE_LABEL[row.type ?? "null"] ?? "star cluster";
  return {
    id: slugId(dataset.idPrefix, row.name),
    n: row.name.replace(/_/g, " "),
    d: `${typeLabel} · ${dataset.sourceLabel}`,
    t: "cluster",
    r: "rare",
    ra: round(row.ra, 4),
    dec: round(row.dec, 4),
    ly: distanceLy === null ? null : round(distanceLy, 2),
    mg: "—",
    sp: typeLabel,
    img: null,
    c: "#c5cae9",
    con: "—",
    st: [
      row.n_stars != null && Number.isFinite(row.n_stars)
        ? ["Member stars", String(row.n_stars), clamp01(row.n_stars / 150)]
        : null,
      row.distance != null && Number.isFinite(row.distance)
        ? [
            "Distance",
            `${Math.round(row.distance)} pc`,
            clamp01(row.distance / 5000),
          ]
        : null,
      row.logt != null && Number.isFinite(row.logt)
        ? ["Age", `10^${row.logt.toFixed(2)} yr`, clamp01((row.logt - 6) / 4)]
        : null,
      row.core_radius != null && Number.isFinite(row.core_radius)
        ? [
            "Core radius",
            `${row.core_radius.toFixed(2)} pc`,
            clamp01(row.core_radius / 5),
          ]
        : null,
    ].filter(Boolean),
    f: "[[TODO: content pass — write real flavour text for this cluster, PF-10 C1]]",
    lo: [
      [
        dataset.sourceLabel,
        "[[TODO: content pass — real citation/lore line, PF-10 C1]]",
      ],
    ],
  };
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

function parseArgs(argv) {
  const args = { dataset: null, names: null, sample: null, out: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dataset") args.dataset = argv[++i];
    else if (argv[i] === "--names")
      args.names = argv[++i].split(",").map((s) => s.trim());
    else if (argv[i] === "--sample")
      args.sample = Number.parseInt(argv[++i], 10);
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.dataset || !DATASETS[args.dataset]) {
    console.error(
      `Usage: node scripts/gaia-dataset-pipeline.mjs --dataset <${Object.keys(DATASETS).join("|")}> (--names "A,B,C" | --sample N) [--out path]`,
    );
    process.exit(1);
  }
  const dataset = DATASETS[args.dataset];
  const t0 = Date.now();
  const { rows } = readVotableBinary2(dataset.votPath);
  console.log(
    `decoded ${rows.length} rows from ${dataset.votPath} in ${Date.now() - t0}ms`,
  );

  if (args.sample) {
    console.log(`--- sample of ${args.sample} rows (no file written) ---`);
    for (const row of rows.slice(0, args.sample)) console.log(row);
    return;
  }

  if (!args.names) {
    console.error(
      'Provide --names "Name1,Name2" (exact catalog names) or --sample N.',
    );
    process.exit(1);
  }

  const byName = new Map(rows.map((r) => [r.name, r]));
  const missing = args.names.filter((n) => !byName.has(n));
  if (missing.length > 0) {
    console.error(`Not found in ${args.dataset}: ${missing.join(", ")}`);
    process.exit(1);
  }

  const entries = args.names.map((n) => toCuratedEntry(byName.get(n), dataset));
  const outPath =
    args.out ?? join("scripts", "out", `${args.dataset}-curated-sample.json`);
  writeFileSync(outPath, JSON.stringify(entries, null, 2) + "\n");
  console.log(`wrote ${entries.length} curated entries -> ${outPath}`);
  for (const e of entries)
    console.log(`  ${e.id} (${e.n}) — ${e.ly} ly, ${e.st.length} stats`);
}

main();
