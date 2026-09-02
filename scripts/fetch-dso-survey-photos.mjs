#!/usr/bin/env node
/* fetch-dso-survey-photos.mjs — PF-11 defect P1: real per-object photos for the curated NGC2000
 * nebula pack + star-cluster hall of fame that still have no image after the duplicate-id borrow
 * overlay (celestial-image-borrow-overlay.js) runs.
 *
 * SCOPE (owner can override — both deviations from the literal 3-file brief are argued below):
 *   - celestial-ngc2000.js  (41 ids) — IN SCOPE
 *   - celestial-clusters.js (35 ids) — IN SCOPE
 *   - celestial-minorplanets.js (4 ids) — read for completeness, then EXCLUDED. See "WHY MINOR
 *     PLANETS ARE EXCLUDED" below.
 *   - celestial-nbg.js (856 background galaxies) / celestial-gd1.js (1,365 stream stars) — NEVER
 *     read here. Statistical/survey bulk layers, not individually notable named objects; they get
 *     the procedural class-aware fallback (src/lib/spaceHelpers.ts resolveCardVisual) instead.
 *
 * SOURCE: CDS hips2fits (https://alasky.cds.unistra.fr/hips-image-services/hips2fits),
 * hips=CDS/P/DSS2/color — a DSS2 colour composite cutout centred on each object's real ra/dec.
 *
 * LICENSE — FLAGGED, not clean. See docs/research/texture-sources-public-domain.md §14 for the
 * verification this header cites (fetched live 2026-09-02, not carried forward from a prior
 * summary, per the task brief's explicit instruction to check before use): DSS plates are
 * copyrighted by their originating surveys (AAO/Caltech/AURA/PPARC) and distributed "by
 * agreement" — no explicit third-party redistribution grant was found on the hips2fits docs, the
 * DSS copyright/acknowledgment pages, CDS's VizieR usage rules, or Aladin's terms. Used here
 * under the SAME owner-flagged-risk posture this repo already applies to Gaia DR3 data (§6 of the
 * same doc): a personal, no-revenue portfolio, every image credited "Digitized Sky Survey
 * (STScI/CDS)" on its collector card, and the decision recorded rather than assumed. Revisit if
 * this portfolio ever gains a commercial dimension.
 *
 * WHY MINOR PLANETS ARE EXCLUDED FROM THE FETCH, even though the task brief listed
 * celestial-minorplanets.js as in scope: minor planets MOVE. That file's ra/dec is a real
 * Keplerian position for one specific snapshot date (2026-07-20, see its own header) — a DSS2
 * archival plate at that ra/dec shows whatever background stars were there when the plate was
 * exposed (1950s-90s), not the asteroid, which is an unresolved point source long since moved off
 * that field. Worse: feeding that field image into `img` makes the body isGlobe-eligible in
 * `resolveCardVisual` (t:"dwarf" + img != null), sphere-mapping a random star field onto a
 * "planet" via `drawGlobe` — a visibly MORE broken result than the honest procedural
 * asteroid-silhouette fallback (src/lib/spaceHelpers.ts) it would replace. The 4 minor planets
 * keep that procedural fallback. Real per-body mission imagery (NASA Dawn frames for Vesta/Ceres)
 * would be a defensible future upgrade, but is a different, per-body sourcing job, not this
 * script's generic ra/dec sweep.
 *
 * FIELD OF VIEW: derived from each object's own real physical Size/Distance stats where
 * available (NGC2000 entries carry both, in parsecs — angular_deg = size_pc / distance_pc *
 * (180/pi), a small-angle approximation, framed with headroom rather than filling the crop) so
 * compact planetary nebulae and the Tarantula Nebula don't share one guessed constant. Clusters
 * carry no physical-size stat in this catalog, so they use a flat, literature-typical default,
 * split only on open-vs-globular (globulars are visually smaller at a given distance).
 *
 * MODES (matching this repo's --if-stale/--verify pipeline convention, e.g.
 * build-planet-textures.mjs):
 *   (no flag)     fetch every target whose output webp is missing, then (re)write the overlay
 *                 data module from whatever is on disk.
 *   --if-stale    identical behaviour to the default here — there is no local source pack to go
 *                 stale against (the "source" is a live network fetch each run), so this flag
 *                 just documents intent at call sites (predev/prepreview-style) and is a safe,
 *                 idempotent re-run: existing webp files are never re-fetched or overwritten.
 *   --verify      SOURCE-FREE, no network. Checks the committed assets + overlay module against
 *                 this file's own target list: every target has a non-empty webp on disk and a
 *                 matching entry in celestial-dso4-imgmap.js, and the overlay has no orphans.
 *
 * Run: node scripts/fetch-dso-survey-photos.mjs
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const OUT_DIR = "public/assets/dso4";
const OVERLAY_PATH = "src/data/celestial/celestial-dso4-imgmap.js";
const HIPS2FITS = "https://alasky.cds.unistra.fr/hips-image-services/hips2fits";
const CREDIT = "Digitized Sky Survey (STScI/CDS)";

const REQUEST_PX = 768; // over-fetch a little; sharp resamples down, softening plate grain
const OUTPUT_PX = 560; // within the requested 480-640px range
const WEBP_QUALITY = 82; // TR-008 precedent recipe

const MIN_FOV_DEG = 0.12;
const MAX_FOV_DEG = 2.0;
const NEBULA_FRAMING = 3.5; // headroom multiplier around the real angular size

const CLUSTER_FOV_DEG = { open: 0.6, globular: 0.35 };

const FETCH_TIMEOUT_MS = 20000;
const REQUEST_DELAY_MS = 200; // polite pacing against a free shared service

/* ---------- load the real catalog data by running the real production pipeline ------------
 * Rather than re-parsing celestial-*.js with a second, parallel bit of JSON-ish parsing logic
 * that could drift from what the app actually does, this boots the SAME modules SpaceScene.tsx
 * loads, in the same relative order, inside a minimal `window === globalThis` shim (these files
 * touch no browser API besides `window`, confirmed by grep). That means the duplicate-id borrow
 * overlay runs for real here too — so the ids this script decides to fetch are exactly the ones
 * still missing an image AFTER that fix, not a second guess at it. */
async function loadCatalog() {
  globalThis.window = globalThis;
  const mods = [
    "../src/data/celestial/celestial-catalog.js",
    "../src/data/celestial/celestial-extra.js",
    "../src/data/celestial/celestial-imgmap.js",
    "../src/data/celestial/celestial-extra2.js",
    "../src/data/celestial/celestial-clusters.js",
    "../src/data/celestial/celestial-ngc2000.js",
    "../src/data/celestial/celestial-minorplanets.js",
    "../src/data/celestial/celestial-image-borrow-overlay.js",
  ];
  for (const m of mods) await import(m);
  return window.CELESTIAL || [];
}

/** Parse a "<number> pc" style stat value out of an entry's `st` rows. Returns null if the
 * label isn't present or doesn't parse — callers fall back to a flat default rather than guess. */
function statPc(entry, label) {
  const row = (entry.st || []).find((r) => r[0] === label);
  if (!row) return null;
  const m = /([\d.]+)\s*pc/.exec(String(row[1]));
  return m ? Number.parseFloat(m[1]) : null;
}

function fovForTarget(entry) {
  if (entry.id.startsWith("ngc2000-")) {
    const sizePc = statPc(entry, "Size");
    const distPc = statPc(entry, "Distance");
    if (sizePc && distPc && distPc > 0) {
      const angularDeg = ((sizePc / distPc) * 180) / Math.PI;
      return Math.max(
        MIN_FOV_DEG,
        Math.min(MAX_FOV_DEG, angularDeg * NEBULA_FRAMING),
      );
    }
    return 0.4; // no parseable Size/Distance pair — mid-range default among the 41 shipped
  }
  if (entry.id.startsWith("cluster-")) {
    const isGlobular = /globular/i.test(entry.sp || "");
    return isGlobular ? CLUSTER_FOV_DEG.globular : CLUSTER_FOV_DEG.open;
  }
  return 0.5;
}

/* ---------- target selection ---------------------------------------------------------------- */

function selectTargets(catalog) {
  const inScope = catalog.filter(
    (e) => e.id.startsWith("ngc2000-") || e.id.startsWith("cluster-"),
  );
  const excludedMinorplanets = catalog.filter((e) =>
    e.id.startsWith("minorplanet-"),
  );
  const stillMissing = inScope.filter((e) => !e.img);
  console.log(
    `fetch-dso-survey-photos: ${inScope.length} in-scope objects (ngc2000-*/cluster-*), ` +
      `${inScope.length - stillMissing.length} already imaged (borrowed or otherwise), ` +
      `${stillMissing.length} need a photo. ${excludedMinorplanets.length} minor planets read ` +
      `and deliberately excluded (see this script's header).`,
  );
  return stillMissing;
}

/* ---------- fetch + convert ------------------------------------------------------------------ */

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPlate(ra, dec, fovDeg) {
  const url =
    `${HIPS2FITS}?hips=${encodeURIComponent("CDS/P/DSS2/color")}` +
    `&ra=${ra}&dec=${dec}&fov=${fovDeg.toFixed(4)}` +
    `&width=${REQUEST_PX}&height=${REQUEST_PX}&format=jpg`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) throw new Error(`zero-byte response for ${url}`);
    return buf;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchOne(entry, outDir) {
  const fovDeg = fovForTarget(entry);
  const outFile = join(outDir, `${entry.id}.webp`);
  let raw;
  try {
    raw = await fetchPlate(entry.ra, entry.dec, fovDeg);
  } catch (e1) {
    console.log(`  retry  ${entry.id}: ${e1.message}`);
    await sleep(1000);
    raw = await fetchPlate(entry.ra, entry.dec, fovDeg); // let a second failure throw
  }
  await sharp(raw)
    .resize(OUTPUT_PX, OUTPUT_PX, { fit: "cover" })
    .webp({ quality: WEBP_QUALITY })
    .toFile(outFile);
  const bytes = statSync(outFile).size;
  console.log(
    `  ${entry.id.padEnd(34)} fov=${fovDeg.toFixed(3)}°  ${(bytes / 1024).toFixed(1)} KB`,
  );
  return { path: `assets/dso4/${entry.id}.webp`, credit: CREDIT, bytes };
}

/* ---------- overlay module -------------------------------------------------------------------- */

function writeOverlay(entries) {
  const lines = entries
    .map(
      ({ id, path, credit }) =>
        `  ${JSON.stringify(id)}: [${JSON.stringify(path)}, ${JSON.stringify(credit)}],`,
    )
    .join("\n");
  const src = `/* celestial-dso4-imgmap.js — GENERATED by scripts/fetch-dso-survey-photos.mjs.
   Do not hand-edit (CLAUDE.md #22) — rerun the script to regenerate. id -> [local image path,
   credit]. Source: CDS hips2fits DSS2 colour survey cutouts; LICENSE FLAGGED, see
   docs/research/texture-sources-public-domain.md §14 (owner-flagged risk, same posture as the
   Gaia DR3 data already shipped in this repo). Self-applying like celestial-missing-moons.js:
   only ever fills an entry whose img is still null, matching every other overlay's OVERRIDE-ONLY
   contract. */
window.CELESTIAL_DSO4_IMGMAP = {
${lines}
};
(function () {
  var MAP = window.CELESTIAL_DSO4_IMGMAP;
  var applied = 0;
  (window.CELESTIAL || []).forEach(function (e) {
    var im = MAP[e.id];
    if (im && !e.img) {
      e.img = im[0];
      e.crd = im[1];
      applied++;
    }
  });
  window.CELESTIAL_DSO4_COUNT = applied;
})();

export {};
`;
  writeFileSync(OVERLAY_PATH, src);
  console.log(
    `fetch-dso-survey-photos: wrote ${OVERLAY_PATH} (${entries.length} entries).`,
  );
}

/** Merge freshly-fetched entries with whatever the overlay module on disk already declares, so
 * `--if-stale` reruns (or a partial run that fetched only some targets) never truncate ids this
 * script already resolved in an earlier run. */
function readExistingOverlay() {
  if (!existsSync(OVERLAY_PATH)) return {};
  const src = readFileSync(OVERLAY_PATH, "utf8");
  const m = /window\.CELESTIAL_DSO4_IMGMAP = (\{[\s\S]*?\n\});/.exec(src);
  if (!m) return {};
  try {
    // Keys/values are always written via JSON.stringify (see writeOverlay), so this is already
    // valid JSON except for the one deliberate trailing comma writeOverlay leaves after every
    // entry (including the last) for a clean diff — strip it before parsing.
    return JSON.parse(m[1].replace(/,(\s*\})/g, "$1"));
  } catch {
    return {};
  }
}

/* ---------- verify (source-free) --------------------------------------------------------------- */

function verify() {
  let errors = 0;
  const err = (m) => {
    errors++;
    console.error(`fetch-dso-survey-photos: ${m}`);
  };
  if (!existsSync(OVERLAY_PATH)) {
    err(
      `${OVERLAY_PATH} missing — run \`node scripts/fetch-dso-survey-photos.mjs\``,
    );
    return errors;
  }
  const map = readExistingOverlay();
  const ids = Object.keys(map);
  if (ids.length === 0) err(`${OVERLAY_PATH} declares zero entries`);
  const onDisk = existsSync(OUT_DIR)
    ? new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith(".webp")))
    : new Set();
  for (const id of ids) {
    const [path] = map[id];
    const file = path.split("/").pop();
    if (!onDisk.has(file)) {
      err(`${id}: declared image ${path} is missing from ${OUT_DIR}`);
      continue;
    }
    if (statSync(join(OUT_DIR, file)).size === 0)
      err(`${id}: ${file} is zero bytes`);
  }
  for (const f of onDisk) {
    const id = f.replace(/\.webp$/, "");
    if (!map[id])
      err(`orphan asset ${f} in ${OUT_DIR} — not declared in ${OVERLAY_PATH}`);
  }
  if (errors === 0)
    console.log(
      `fetch-dso-survey-photos: verified ${ids.length} images, overlay consistent.`,
    );
  return errors;
}

/* ---------- main --------------------------------------------------------------------------- */

function parseArgs(argv) {
  const args = { verify: false, ifStale: false, only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--verify") args.verify = true;
    else if (argv[i] === "--if-stale") args.ifStale = true;
    else if (argv[i] === "--only") args.only = argv[++i].split(",");
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.verify) {
    if (verify()) process.exitCode = 1;
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  const catalog = await loadCatalog();
  let targets = selectTargets(catalog);
  if (args.only) targets = targets.filter((e) => args.only.includes(e.id));

  const existingOnDisk = existsSync(OUT_DIR)
    ? new Set(readdirSync(OUT_DIR).filter((f) => f.endsWith(".webp")))
    : new Set();

  const resolved = { ...readExistingOverlay() };
  let fetched = 0;
  let skipped = 0;
  let failed = 0;

  for (const entry of targets) {
    const file = `${entry.id}.webp`;
    if (existingOnDisk.has(file) && statSync(join(OUT_DIR, file)).size > 0) {
      skipped++;
      resolved[entry.id] ??= [`assets/dso4/${file}`, CREDIT];
      continue;
    }
    try {
      const { path, credit } = await fetchOne(entry, OUT_DIR);
      resolved[entry.id] = [path, credit];
      fetched++;
    } catch (e) {
      failed++;
      console.error(`  FAIL   ${entry.id}: ${e.message}`);
    }
    await sleep(REQUEST_DELAY_MS);
  }

  const overlayEntries = Object.entries(resolved)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([id, [path, credit]]) => ({ id, path, credit }));
  writeOverlay(overlayEntries);

  console.log(
    `\nfetch-dso-survey-photos: ${fetched} fetched, ${skipped} already on disk, ` +
      `${failed} failed, ${overlayEntries.length} total in overlay.`,
  );
  if (failed > 0) {
    console.log(
      "  Some targets failed (network/service hiccup, most likely) — rerun the script; " +
        "already-fetched files are skipped, so a rerun only retries what's missing.",
    );
    process.exitCode = 1;
  }
  if (verify()) process.exitCode = 1;
}

main();
