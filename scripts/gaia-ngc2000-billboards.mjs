#!/usr/bin/env node
/* gaia-ngc2000-billboards.mjs — PF-10 C1: NGC2000 nebula pack, the 41-of-47 sub-part that IS
 * real data-wiring (the delivery plan's original claim, corrected in TR-065 for the OTHER 8).
 *
 * REAL FINDING (this session) that splits NGC2000's scope in two, more precisely than TR-065's
 * blanket "blocked" verdict: the 47-object catalog is NOT one uniform kind of nebula record.
 * `particles-nebulae.json` carries 41 real "Billboard" archetype objects — simple textured
 * quads with real ra/dec/distance, no per-object shader — and `glsl-nebulae.json` carries the
 * OTHER 8 as "Volume" archetype objects, each with its OWN bespoke, hand-authored GLSL shader
 * file (helix-nebula.glsl, crab-nebula.glsl, ...). Only the 8 Volume objects hit the real
 * blocker TR-065 found (nebula-field.ts's reveal uniform hard-caps at 4 volumes) — porting 8
 * fully custom external shaders (GLSL->WGSL twins each, TR-045 reserved-identifier checks each)
 * is real, separate, larger design work, still not attempted. The 41 Billboard objects need
 * NONE of that: `t: "nebula"` is already a fully-handled type in celestial-bodies.ts's existing
 * billboard pipeline (PROCEDURAL_TYPE.nebula = 2) — the exact same zero-new-rendering-code
 * pattern star clusters (TR-064), minor planets, NBG, and GD-1 (TR-065) already used.
 *
 * Notably, none of the 4 EXISTING hardcoded showcase volumes in nebula-field.ts (Orion/M42,
 * Veil, Rosette) are themselves "Volume" objects in this real local catalog — only Helix is.
 * Those 4 were always a hand-picked simplified showcase, not literal NGC2000 volume data; this
 * script does not touch them.
 *
 * Colour: the source JSON's per-object `color` field is a near-uniform placeholder
 * ([1,1,1,0.5] on nearly every real record — not meaningfully distinct per nebula), so rather
 * than inventing per-object colour the data doesn't really contain, every entry gets the SAME
 * representative emission-nebula pink/red (matching nebula-field.ts's own Orion colA convention)
 * — an honest, declared simplification, not fabricated per-object realism.
 *
 * Run: node scripts/gaia-ngc2000-billboards.mjs [--out src/data/celestial/celestial-ngc2000.js]
 */
import { readFileSync, writeFileSync } from "node:fs";

const PARTICLES_PATH =
  "resources/gaia_datasets/catalog-nebulae/particles-nebulae.json";
const NEBULA_COLOR = "#f291a8"; // representative emission-nebula pink, see header note

/** Gaia Sky's JSON ships trailing commas (not strict JSON) — strip them before parsing. */
function lenientParse(text) {
  return JSON.parse(text.replace(/,(\s*[\]}])/g, "$1"));
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

function cleanName(rawName) {
  return rawName.replace(/\s+BB$/, "");
}

function slugId(name) {
  return `ngc2000-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function toCuratedEntry(obj) {
  const [ra, dec, distancePc] = obj.coordinates.equatorial;
  const displayName = cleanName(obj.names[0]);
  const altNames = obj.names
    .slice(1)
    .map(cleanName)
    .filter((n) => n !== displayName);
  return {
    id: slugId(displayName),
    n: displayName,
    d: altNames.length > 0 ? `${altNames[0]} · nebula` : "Nebula",
    t: "nebula",
    r: "rare",
    ra: round(ra, 4),
    dec: round(dec, 4),
    ly: round(distancePc * 3.26156, 2),
    mg: "—",
    sp: "Nebula (NGC2000)",
    img: null,
    c: NEBULA_COLOR,
    con: "—",
    st: [
      [
        "Distance",
        `${round(distancePc, 1)} pc`,
        Math.min(1, distancePc / 5000),
      ],
      obj.sizePc != null
        ? [
            "Size",
            `${obj.sizePc.toPrecision(3)} pc`,
            Math.min(1, obj.sizePc / 40),
          ]
        : null,
    ].filter(Boolean),
    f: "[[TODO: content pass — PF-10 C1 NGC2000 billboard tier, no per-object dossier authored]]",
    lo: null,
  };
}

function main() {
  const outPath = process.argv.includes("--out")
    ? process.argv[process.argv.indexOf("--out") + 1]
    : "src/data/celestial/celestial-ngc2000.js";

  const particles = lenientParse(readFileSync(PARTICLES_PATH, "utf8"));
  const billboards = particles.objects.filter(
    (o) => o.archetype === "Billboard",
  );
  console.log(
    `decoded ${particles.objects.length} total NGC2000 objects, ${billboards.length} real Billboard-archetype (data-wireable now)`,
  );

  const entries = billboards.map(toCuratedEntry);
  const seen = new Set();
  for (const e of entries) {
    if (seen.has(e.id))
      throw new Error(
        `duplicate id ${e.id} — real name collision, needs disambiguation`,
      );
    seen.add(e.id);
  }

  const body = JSON.stringify(entries, null, 1);
  const js = `/* celestial-ngc2000.js — PF-10 C1: NGC2000 nebula pack, the 41 real Billboard-archetype
   objects (of 47 total — the other 8 are custom-shader Volume objects, still blocked, see
   scripts/gaia-ngc2000-billboards.mjs's header and the PF-10 delivery plan). Zero new rendering
   code: "nebula" is already a fully-handled type in celestial-bodies.ts's billboard pipeline.
   Real ra/dec/distance from resources/gaia_datasets/catalog-nebulae/particles-nebulae.json; no
   per-object dossier text authored ([[TODO]] marker), matching the honesty convention TR-061
   established. Generated ${new Date().toISOString().slice(0, 10)} by
   scripts/gaia-ngc2000-billboards.mjs. */
(function () {
  var G = ${body};
  var have = {};
  (window.CELESTIAL || []).forEach(function (e) { have[e.id] = 1; });
  window.CELESTIAL = (window.CELESTIAL || []).concat(G.filter(function (e) { return !have[e.id]; }));
  window.CELESTIAL_NGC2000_COUNT = G.length;
})();

export {};
`;
  writeFileSync(outPath, js);
  console.log(`wrote ${entries.length} curated nebula entries -> ${outPath}`);
}

main();
