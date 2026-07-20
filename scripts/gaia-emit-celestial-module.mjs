#!/usr/bin/env node
/* gaia-emit-celestial-module.mjs — PF-10 C1: wraps a curated-entry JSON array (produced by
 * gaia-bulk-catalog-convert.mjs / gaia-minorplanet-position.mjs) into the exact celestial-*.js
 * module shape celestial-clusters.js / celestial-gaia.js already use: an IIFE that dedupes
 * against window.CELESTIAL by id, concatenates, and records a per-file count global. Kept as a
 * separate mechanical step (not baked into the converters) so a human can review/hand-edit the
 * intermediate JSON before it becomes a shipped module — same two-step discipline the cluster
 * hall-of-fame content review used.
 *
 * Run: node scripts/gaia-emit-celestial-module.mjs --in scripts/out/nbg-full.json \
 *   --out src/data/celestial/celestial-nbg.js --count-var CELESTIAL_NBG_COUNT \
 *   --header "one-line header comment"
 */
import { readFileSync, writeFileSync } from "node:fs";

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--in") args.in = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--count-var") args.countVar = argv[++i];
    else if (argv[i] === "--header") args.header = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!args.in || !args.out || !args.countVar || !args.header) {
    console.error(
      "Usage: node scripts/gaia-emit-celestial-module.mjs --in <json> --out <js> --count-var <NAME> --header <text>",
    );
    process.exit(1);
  }
  const entries = JSON.parse(readFileSync(args.in, "utf8"));
  // Strip any internal-only fields (e.g. minor-planet's _epoch provenance note) before shipping.
  const shipped = entries.map(({ _epoch, ...rest }) => rest);
  const body = JSON.stringify(shipped, null, 1);
  const js = `/* ${args.header} */
(function () {
  var G = ${body};
  var have = {};
  (window.CELESTIAL || []).forEach(function (e) { have[e.id] = 1; });
  window.CELESTIAL = (window.CELESTIAL || []).concat(G.filter(function (e) { return !have[e.id]; }));
  window.${args.countVar} = G.length;
})();

export {};
`;
  writeFileSync(args.out, js);
  console.log(`wrote ${shipped.length} entries -> ${args.out}`);
}

main();
