#!/usr/bin/env node
/* build-planet-textures.mjs — PF-10 C4: real planetary surface / elevation maps -> shipped assets.
 *
 * WHY THIS PHASE IS NOT WHAT THE PLAN SAID. PF-10's C4 section describes applying topography "to
 * the existing Mars mesh" and calls itself "the lowest-risk phase — enhances existing meshes."
 * There is no Mars mesh. There is no planet mesh at all: every one of the 267 photographic bodies
 * renders as a BILLBOARD QUAD sampling a 128x128 cell of the shared 4096x4096 `atlas.jpg`
 * (celestial-bodies.ts, GAP-02). C4 therefore requires building planetary surface rendering from
 * scratch, which makes it the largest rendering feature in PF-10 rather than the smallest. Owner
 * informed and re-scoped 2026-07-21; see the corrected C4 section of the delivery plan.
 *
 * ALL EQUIRECTANGULAR SOURCES DROP STRAIGHT ONTO A SPHERE. Babylon's `CreateSphereVertexData`
 * emits exactly the mapping these maps use (u = longitude/2pi, v = pole-to-pole) — the same
 * convention `milky-way.ts` already relies on and documents. The one exception is Earth, whose
 * surface ships as a CUBEMAP and is re-projected here; see `lib/cubemap-equirect.mjs`.
 *
 * WHAT THIS SCRIPT DOES: resizes each source map into shipped tiers, writes them to
 * `public/assets/planets/`, and emits the manifest the engine reads. Generated assets are never
 * hand-edited (CLAUDE.md non-negotiable #22).
 *
 * THREE MODES (following `build-craft-assets.mjs --verify`, this repo's established shape):
 *
 *   (no flag)     full rebuild. Requires the source pack.
 *   --if-stale    rebuild only what is missing or older than its source; NO-OP with a clear
 *                 message when the source pack is absent. This is what `predev`/`prepreview` run,
 *                 and the no-op branch is why it is safe in CI, where `resources/` is gitignored
 *                 and can never exist.
 *   --verify      SOURCE-FREE. Checks the committed assets against this file's own declarations:
 *                 every declared body/tier/map present and non-empty, the manifest agreeing with
 *                 the plan, no orphans, no NEVER_SPHERE body sphered. This is the CI gate.
 *
 * A REAL SOURCE-DATA ODDITY, and a correction to this file's own first draft: the pack ships BOTH
 * `satrun-high.jpg` (a typo) and `saturn-high.jpg`. They are different files, not aliases —
 * 1800x900 and 4096x2048 respectively, both genuine 2:1 equirectangular Saturn maps. The first
 * draft of this script assumed the typo was the only spelling and would have shipped the
 * 1800x900 version; checking the real files rather than the filename listing caught it. The
 * correctly-spelled, higher-resolution map is the one used.
 *
 * Run: node scripts/build-planet-textures.mjs [--verify|--if-stale] [--only mars,moon]
 */
import {
  mkdirSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
  existsSync,
  copyFileSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { cubemapToEquirect } from "./lib/cubemap-equirect.mjs";

const SRC = "resources/gaia_datasets/hi-res-textures/default-data/tex/base";
const SRC_CUBE =
  "resources/gaia_datasets/hi-res-textures/default-data/tex/cubemap";
const OUT_DEFAULT = "public/assets/planets";

/** Shipped tiers. `base` is what every device gets; `high` is fetched only when a body is the
 * actual travel destination, so it never sits in front of the startup budget. 2:1 aspect
 * throughout — equirectangular maps are always 2:1 and a non-2:1 resize would shear the map. */
export const TIERS = {
  base: { width: 2048, quality: 78 },
  high: { width: 4096, quality: 82 },
  /** MEASURED, not chosen for roundness (PF-10 C4.2). The camera parks at a FIXED
   * `ARRIVE_STANDOFF` of 38 world units from a sphere of radius 26 — 12 units above the surface,
   * with no zoom or dolly anywhere in the engine. That geometry is therefore constant and
   * computable: the planet subtends 86.3° against a 45.8° FOV (it overflows the screen), and the
   * visible surface patch is 23.5° across.
   *
   * At `high` (4096) that patch carries just **268 texels stretched across a 1080-px viewport** —
   * a 4x magnification, which is why C4.1's surface reads soft. 8192 doubles it to 536. The
   * source maps are 8192x4096, so this tier costs nothing but disk and is the single largest
   * visible improvement available to this phase. Only bodies with an 8192-wide source get it. */
  ultra: { width: 8192, quality: 84 },
};

/** Bodies whose source pack has an 8192-wide map. Everything else tops out at `high`. */
export const ULTRA_SOURCES = new Set([
  "mars",
  "moon",
  "mercury",
  "venus",
  "io",
  "europa",
  "titan",
  "pluto",
  "rhea",
  "earth",
]);

/** Bodies that must NEVER be rendered as a sphere, however much texture data exists for them.
 *
 * MIRRORS `NEVER_SPHERE` in src/lib/planet-sphere.ts — the owner's standing rule (2026-07-21, on
 * Astra's advice) that Phobos and Deimos stay billboards permanently, because they are the most
 * famously irregular bodies in the pack and a sphere there is broken physics in the most literal
 * sense: the shape IS the science.
 *
 * Duplicated here rather than imported because this is a build script (.mjs) and that is a
 * TypeScript module. `tests/unit/planet-sphere.test.ts` asserts the two sets are identical, so
 * the duplication cannot drift — the same twin discipline CLAUDE.md #4 applies to shaders. */
export const NEVER_SPHERE = new Set(["phobos", "deimos"]);

/** Real bodies with real local surface data.
 *
 * `height` = an 8-bit greyscale elevation map the shader DIFFERENTIATES into slopes.
 * `normal`  = a pre-baked tangent-space normal map the shader consumes DIRECTLY.
 *
 * The two are mutually exclusive across this entire pack, which is a genuine property of the
 * source data rather than a convention imposed here: every body ships one or the other, never
 * both. That is why the shader can gate them against each other with a single `uHasNormal`
 * rather than needing a precedence rule.
 *
 * PREFERRING A NORMAL MAP OVER A HEIGHT MAP IS NOT A TASTE CALL. It is the same finding
 * `build-planet-vt.mjs` rests on: 8-bit height quantization is catastrophic under
 * differentiation and benign under direct consumption. Where the pack ships a baked normal, it
 * is strictly better information than the height map it was derived from. */
export const PLANET_SOURCES = [
  // --- real surface + real ELEVATION (differentiated height maps) ---
  { id: "mars", surface: "mars-ultra", height: "mars-height-ultra" },
  { id: "moon", surface: "moon-ultra", height: "moon-height-ultra" },
  { id: "mercury", surface: "mercury-ultra", height: "mercury-height-ultra" },

  // --- real surface + real RELIEF (pre-baked normal maps) ---
  // C4 CLOSEOUT (2026-07-21): these nine normal maps sat unused in the pack through TR-076/078,
  // because the first pass read "ships a height map" as the test for "has real elevation". It is
  // not — a normal map is elevation data in the exact form the shader wants, and skipping them
  // left nine bodies rendering as smooth spheres with real relief data sitting on disk.
  { id: "io", surface: "io-ultra", normal: "io-normal-high" },
  { id: "europa", surface: "europa-ultra", normal: "europa-normal-ultra" },
  { id: "titan", surface: "titan-ultra", normal: "titan-normal-ultra" },
  { id: "pluto", surface: "pluto-ultra", normal: "pluto-normal-ultra" },
  { id: "ganymede", surface: "ganymede-high", normal: "ganymede-normal-high" },
  { id: "ceres", surface: "ceres-high", normal: "ceres-normal-high" },
  // C4 CLOSEOUT: three real bodies the first pass skipped outright. Nothing ruled them out —
  // they were simply not in the list, which is exactly the omission a written reckoning prevents.
  // `dossier: true` — these three became CATALOG DESTINATIONS in the same change that gave them
  // textures, so they need the per-body dossier image the catalog's `img:` field points at.
  // The twelve older bodies already have theirs from the ported catalog; see DOSSIER_PX.
  {
    id: "rhea",
    surface: "rhea-ultra",
    normal: "rhea-normal-ultra",
    dossier: true,
  },
  {
    id: "dione",
    surface: "dione-high",
    normal: "dione-normal-high",
    dossier: true,
  },
  {
    id: "tethys",
    surface: "tethys-high",
    normal: "tethys-normal-high",
    dossier: true,
  },

  // --- real surface only (no elevation data of any kind in the pack) ---
  { id: "venus", surface: "venus-ultra" },
  { id: "jupiter", surface: "jupiter-high" },
  // NOT "satrun-high" — see the source-data note in the header.
  { id: "saturn", surface: "saturn-high" },

  // --- Earth: the one body whose surface is a CUBEMAP, not an equirect map ---
  // C4 CLOSEOUT (2026-07-21). The record said "Earth has height-but-no-surface". That was wrong,
  // and the reason it was wrong is instructive: the pipeline only ever globbed `tex/base/`, and
  // Earth's surface lives in `tex/cubemap/` — 6 faces at 8192x8192, plus night lights and a
  // cloud deck. Re-projected to this pipeline's equirect convention by lib/cubemap-equirect.mjs.
  // PF-11 D6.4 (2026-07-23): the `night` map SHIPS now. Its own PACK_RECKONING entry named the
  // precondition — "Ship it if the arrival geometry ever changes" — and D6.4 is that change:
  // Earth is revealed by `goHome` at the origin, parked at ra 160 / dec 0, which is phase angle
  // 90.0000° rather than the 0.000° every `travelTo` arrival is pinned to. At that vantage the
  // night hemisphere is ~50% of the frame instead of 100% occluded. Base + high only —
  // MAP_TIER_CAP explains why. See the superseding note in PACK_RECKONING.
  {
    id: "earth",
    cubemap: "earth-day-ultra/earth-day",
    normal: "earth-normal-high",
    // Face prefix is `earth_night`, not `earth-night` — the pack is inconsistent between the day
    // cubemap (`earth-day_rt.jpg`) and the night one (`earth_night_rt.jpg`). Verified against the
    // real directory listing rather than assumed from the folder name, which is what the first
    // attempt did and why it failed loudly on a missing face.
    night: "earth-night-ultra/earth_night",
    cloud: "earth-cloud-high/earth-cloud",
    specular: "earth-specular-high",
    dossier: true,
    atmosphere: true,
  },
];

/* PF-11 D6.3.4 — `atmosphere` is a REAL per-body declaration, replacing the cloud-map-presence
 * proxy the engine used to infer it from (`uAtmosphere = entry.cloud ? 1 : 0`). The old proxy was
 * correct only by the accident that Earth is the one body in the pack shipping a cloud map; the
 * call site's own comment said so and asked for this flag.
 *
 * WHAT THE FLAG ACTUALLY MEANS, stated narrowly because a wider reading would be wrong: "the
 * shader's Rayleigh + aerosol term describes this body's atmosphere." That term is parameterised
 * with EARTH's sea-level optical depths (RAYLEIGH_TAU_RGB, Bodhaine et al. 1999) and Earth's
 * maritime aerosol. Venus, Titan, Mars, Jupiter and Saturn all have atmospheres and NONE of them
 * may set this flag until it carries their own tau — a CO2 atmosphere at 92 bar is not a thin N2/O2
 * one scaled down. So the honest value set today is exactly {earth}, and the flag exists to make
 * that a decision on the record rather than a side effect of which maps happen to ship. */

/** Assets copied VERBATIM into the planets directory from a source pack, rather than resized
 * into tiers.
 *
 * WHY THIS EXISTS, AND IT IS THE EXACT HAZARD THIS SESSION SET OUT TO CLOSE. `venus-cloud.jpg`
 * shipped with TR-078's Venus descent as a hand-copied file: nothing declared it, nothing
 * verified it, and nothing could regenerate it. This pipeline's first orphan-pruner then DELETED
 * it, because it was a .jpg in the pipeline's output directory that no declared body produced.
 * The real-GPU E2E caught it as a 404 within the hour.
 *
 * Two things are worth keeping from that. First, an undeclared asset is not merely
 * undocumented — it is unprotected, and the tooling that makes declared assets safe is exactly
 * what makes undeclared ones fragile. Second, it came from a DIFFERENT source pack
 * (`gaia_datasets/default-data`, not `hi-res-textures`), which is why the reckoning above never
 * saw it: the reckoning covers the pack it enumerates, and enumerating one pack is not the same
 * as enumerating the assets.
 *
 * Copied rather than processed on purpose: the UV-contrast flattening Astra mandated happens in
 * the shader (`CLOUD_CONTRAST_SCALE`), not in the bytes, so baking it here would apply it twice. */
export const PASSTHROUGH_ASSETS = [
  {
    out: "venus-cloud.jpg",
    src: "resources/gaia_datasets/default-data/tex/base/venus-cloud.jpg",
    note:
      "1024x512 Venus cloud deck for the C4.2 descent (TR-078). A single-band UV image " +
      "(R=G=B, 20.5% contrast against a real visible-light 1-3%) — shipped unmodified because " +
      "venus-descent.ts flattens it at render time.",
  },
];

/** THE RECKONING — every file in the source pack, accounted for.
 *
 * WHY THIS EXISTS AS CODE RATHER THAN PROSE. PF-10 C4 shipped 12 of the pack's bodies and skipped
 * the rest by judgement that was never written down, so "76 objects -> 12 bodies" read as an
 * omission rather than a decision. Every skip below was defensible; none was recorded. Putting the
 * reckoning in the pipeline itself means it is checked (`--verify` asserts it accounts for 100% of
 * the real pack) rather than merely asserted, and a future pack update that adds a file fails the
 * gate instead of being silently ignored.
 *
 * Keys are source basenames relative to `tex/`. Values are the reason a file is NOT shipped as-is;
 * files consumed by PLANET_SOURCES above are accounted for automatically and need no entry.
 */
export const PACK_RECKONING = {
  // -- irregular bodies: owner's standing NEVER_SPHERE rule, not a deferral --
  "base/phobos-high": "NEVER_SPHERE — ~27x22x18 km; the shape IS the science",
  "base/phobos-normal-high": "NEVER_SPHERE (see phobos-high)",
  "base/deimos-high": "NEVER_SPHERE — most irregular bodies in the pack",
  "base/deimos-normal-high": "NEVER_SPHERE (see deimos-high)",

  // -- lower-resolution duplicates of a map already sourced at its largest size --
  "base/mars-high": "superseded by mars-ultra (8192)",
  "base/mars-height-high": "superseded by mars-height-ultra (8192)",
  "base/moon-high": "superseded by moon-ultra (8192)",
  "base/moon-height-high": "superseded by moon-height-ultra (8192)",
  "base/mercury-high": "superseded by mercury-ultra (8192)",
  "base/mercury-height-high": "superseded by mercury-height-ultra (8192)",
  "base/venus-high": "superseded by venus-ultra (8192)",
  "base/io-high": "superseded by io-ultra (8192)",
  "base/europa-high": "superseded by europa-ultra (8192)",
  "base/europa-normal-high": "superseded by europa-normal-ultra (8192)",
  "base/titan-high": "superseded by titan-ultra (8192)",
  "base/titan-normal-high": "superseded by titan-normal-ultra (8192)",
  "base/pluto-high": "superseded by pluto-ultra (8192)",
  "base/pluto-normal-high": "superseded by pluto-normal-ultra (8192)",
  "base/rhea-high": "superseded by rhea-ultra (8192)",
  "base/rhea-normal-high": "superseded by rhea-normal-ultra (8192)",
  "base/earth-height-high": "superseded by earth-height-ultra (21600)",
  "base/satrun-high":
    "upstream FILENAME TYPO, and a distinct 1800x900 file rather than an alias — " +
    "the correctly-spelled saturn-high.jpg is 4096x2048 and is the one shipped",

  // -- superseded by strictly better data already in the pipeline --
  "base/moon-normal-high":
    "4096 static normals, against the C4.2 VT streamer's baked MOLA/LOLA normals at " +
    "level 4 (2,143 texels across the visible patch, ~8x). Shipping both would cost " +
    "bytes to supply worse information for the patch the camera can actually see.",
  "base/earth-height-ultra":
    "21600x10800 heights, against earth-normal-high's pre-baked normals of the same " +
    "relief. Height quantization is catastrophic under differentiation and benign " +
    "under direct consumption (build-planet-vt.mjs's founding finding), so the normal " +
    "map is strictly better information at a fifth of the source bytes.",

  // -- not a planetary surface at all --
  "base/lensdirt-high":
    "post-process lens-dirt overlay for Gaia Sky's own bloom, not a body",
  "base/star-tex-01-high":
    "Gaia Sky's star billboard sprite; this engine derives star appearance " +
    "photometrically from real magnitude (Pogson -> flux -> size/alpha)",
  "base/star-tex-05-high": "see star-tex-01-high",

  // -- real data, real feature, deliberately OUT of C4's scope --
  "skybox/milkyway-high":
    "background skybox, not a surface. milky-way.ts already renders the band from a " +
    "CPU-procedural equirect texture; replacing it with photographic plates is a " +
    "separate visual decision with its own ADR, not a rider on C4.",
  "skybox/milkyway-ultra": "see milkyway-high",
  "skybox/cmwb-planck-high":
    "real Planck CMB all-sky map — a genuine and attractive future background layer, " +
    "but a new scene element rather than a planetary surface. Out of C4 by scope, " +
    "recorded here so it is a deferral rather than an oversight.",

  // -- Earth variants superseded by the ultra cubemaps actually used --
  "cubemap/earth-day-high": "superseded by earth-day-ultra (8192 faces)",

  // -- real data that CANNOT BE SEEN at this scene's arrival geometry --
  //
  // SUPERSEDED 2026-07-23 (PF-11 D6.4), and left in place rather than rewritten because the
  // reasoning below is still exactly right about `travelTo` — it was never wrong, its
  // PRECONDITION changed, which is the condition its own last sentence names. Earth is now
  // revealed by `goHome` at the world origin, parked at ra 160 / dec 0 = phase angle 90.0000°,
  // where the night hemisphere is ~50% of the frame. The map is real data and the view is now
  // real too, so the broken-physics ranking no longer applies to the shipped geometry. The
  // `night` entry moved into PLANET_SOURCES above; base + high only (MAP_TIER_CAP).
  "cubemap/earth-night-ultra":
    "Earth's real city lights, and the single most beautiful asset in this pack — NOT SHIPPED, " +
    "because Astra measured that this scene's arrival phase angle is exactly ZERO for every " +
    "body, every time: travelTo parks the camera at bodyPos - dir*ARRIVE_STANDOFF, i.e. on the " +
    "Sun-body line, and free-look changes orientation only. The terminator is 90 degrees from " +
    "the sub-camera point and the night hemisphere is 100% occluded, so N.L across the entire " +
    "visible cap runs 0.684-1.000 and no exposure, threshold or soft mask can put a city light " +
    "on that screen. The only ways to show them are to lie about the Sun direction, lie about " +
    "N.L, or add the map unconditionally — and the third is the one that would ship, because it " +
    "would look wonderful. Ranked BROKEN PHYSICS #1: the map is real data, the VIEW would be " +
    "invented. Exactly the Venus failure mode. Ship it if the arrival geometry ever changes.",
  "cubemap/earth-night-high": "see earth-night-ultra",
};

/* ---------- source plan -------------------------------------------------- */

/** The complete set of output files a body is expected to produce, derived from the same
 * declarations the builder uses. Shared by build and --verify so the gate cannot drift from the
 * pipeline: there is exactly one definition of "correct". */
/** Per-map tier ceilings, `"<bodyId>:<map>"` -> highest tier that map ships.
 *
 * PF-11 D6.4 (owner decision, 2026-07-23). Earth's night lights ship **base + high only**, not
 * ultra. The reason is specific to what the map IS rather than a general economy: it is a mostly
 * black frame carrying isolated point sources, composited under a declared ~14-stop exposure lift
 * (Astra §2.3). Resolution buys far less on that than on a daylit surface, while the ultra tier
 * alone would cost 4.89 MB against 0.19 MB of remaining `assets/planets` headroom — an ADR-0009
 * ceiling decision that is the owner's, not this script's. The `full` tier is also the only
 * quality tier that would ever fetch it after D6.3.2's ladder gating.
 *
 * Applied in ONE place used by both the builder and `--verify`, so the gate cannot disagree with
 * what is emitted — the same single-definition discipline `plannedFiles` already exists for. */
export const MAP_TIER_CAP = {
  "earth:night": "high",
};

/** The tiers one map of one body actually ships, after both the ULTRA_SOURCES rule and any
 * per-map ceiling above. */
export function tiersForMap(body, map, tierNames) {
  const cap = MAP_TIER_CAP[`${body.id}:${map}`];
  if (!cap) return tierNames;
  const order = Object.keys(TIERS);
  const maxIdx = order.indexOf(cap);
  return tierNames.filter((t) => order.indexOf(t) <= maxIdx);
}

export function plannedFiles(body) {
  const tierNames = Object.keys(TIERS).filter(
    (n) => n !== "ultra" || ULTRA_SOURCES.has(body.id),
  );
  const files = [];
  for (const t of tiersForMap(body, "surface", tierNames))
    files.push(`${body.id}-surface-${t}.jpg`);
  for (const map of ["height", "normal", "night", "cloud", "specular"]) {
    if (!body[map]) continue;
    for (const t of tiersForMap(body, map, tierNames))
      files.push(`${body.id}-${map}-${t}.jpg`);
  }
  // The catalog's per-body dossier image, `<id>.jpg` — see DOSSIER_PX.
  if (body.dossier) files.push(`${body.id}.jpg`);
  return { tierNames, files };
}

/** Size of the catalog's per-body dossier image, matched to the 18 that already ship.
 *
 * Those 18 (`mars.jpg`, `titan.jpg`, ...) arrived with the ported catalog and range 640x320 to
 * 1200x600, clustering at 1024x512 — a plain 2:1 equirect thumbnail for the dossier panel, and
 * the fallback the billboard uses for a body with no `atlas.jpg` cell.
 *
 * Bodies added to the catalog after this pipeline existed generate theirs HERE rather than having
 * one hand-placed, which is the whole point of the C4 closeout: a hand-placed asset is an
 * unprotected, unreproducible one, and `venus-cloud.jpg` proved what that costs. */
export const DOSSIER_PX = 1024;

/** Which source file backs a given body/map, and whether it is a cubemap. */
function sourceFor(body, map) {
  if (map === "surface") {
    return body.cubemap
      ? { cube: join(SRC_CUBE, body.cubemap) }
      : { flat: join(SRC, `${body.surface}.jpg`) };
  }
  const name = body[map];
  return name.includes("/")
    ? { cube: join(SRC_CUBE, name) }
    : { flat: join(SRC, `${name}.jpg`) };
}

/* ---------- emit --------------------------------------------------------- */

/** Maps that carry ONE channel of real information. Storing three identical channels triples the
 * byte cost for nothing — and for `specular` it would also invite a reader to treat a mask as a
 * colour. Normal maps are emphatically NOT in this list: their three channels are a vector. */
const GREYSCALE_MAPS = new Set(["height", "specular"]);

/** Resize one equirectangular map to a tier.
 *
 * `fit: "fill"` is deliberate: the source is already 2:1 so this is a pure downscale, and "fill"
 * guarantees the exact target dimensions rather than letting rounding shift the aspect and slide
 * the whole map relative to its own UV grid. */
async function emit(src, outPath, tier, map) {
  let img;
  if (src.cube) {
    // Earth only. Re-project the 6 cube faces into this pipeline's equirect convention at the
    // tier's own resolution — resampling once, at the target size, rather than baking a maximal
    // equirect and downscaling it twice.
    const raw = await cubemapToEquirect(src.cube, tier.width, tier.width / 2);
    img = sharp(raw.data, {
      raw: { width: raw.width, height: raw.height, channels: 3 },
    });
  } else {
    img = sharp(src.flat).resize(tier.width, tier.width / 2, { fit: "fill" });
  }
  if (GREYSCALE_MAPS.has(map)) img = img.greyscale();
  await img.jpeg({ quality: tier.quality, mozjpeg: true }).toFile(outPath);
  return statSync(outPath).size;
}

/* ---------- modes -------------------------------------------------------- */

function parseArgs(argv) {
  const args = {
    out: OUT_DEFAULT,
    only: null,
    verify: false,
    ifStale: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--only") args.only = argv[++i].split(",");
    else if (argv[i] === "--verify") args.verify = true;
    else if (argv[i] === "--if-stale") args.ifStale = true;
  }
  return args;
}

const fail = (msg) => {
  console.error(`planet-textures: ${msg}`);
  process.exitCode = 1;
};

/** SOURCE-FREE verification of the committed assets against this file's declarations.
 *
 * This is the gate that closes PF-10 C4's real regeneration hazard. `resources/` is gitignored, so
 * CI can never rebuild these assets and the committed bytes ARE the deliverable — which means the
 * only thing CI can usefully assert is that the committed bytes still match what the pipeline
 * says it produces. A body added to PLANET_SOURCES without a rebuild fails here, loudly, instead
 * of shipping a manifest entry pointing at a file that does not exist. */
export function verify(outDir) {
  let errors = 0;
  const err = (m) => {
    errors++;
    fail(m);
  };

  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) {
    err(`${manifestPath} missing — run \`npm run assets:planets\``);
    return errors;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));

  const onDisk = new Set(readdirSync(outDir).filter((f) => f.endsWith(".jpg")));
  const expected = new Set();

  // Verbatim-copied assets are as much a shipped dependency as a generated one — and the reason
  // they are checked here is that one of them (venus-cloud.jpg) was destroyed by this pipeline's
  // own pruner precisely because nothing declared it. See PASSTHROUGH_ASSETS.
  for (const a of PASSTHROUGH_ASSETS) {
    expected.add(a.out);
    const p = join(outDir, a.out);
    if (!existsSync(p))
      err(`passthrough asset ${a.out} is missing from ${outDir}`);
    else if (statSync(p).size === 0)
      err(`passthrough asset ${a.out} is zero bytes`);
  }

  for (const body of PLANET_SOURCES) {
    if (NEVER_SPHERE.has(body.id)) {
      err(
        `${body.id} is in NEVER_SPHERE but also in PLANET_SOURCES — the pipeline is ` +
          `data-driven, so this WOULD sphere it (planet-sphere.ts sphereIdFor)`,
      );
      continue;
    }
    const { files } = plannedFiles(body);
    for (const f of files) {
      expected.add(f);
      if (!onDisk.has(f)) {
        err(`${body.id}: declared output ${f} is missing from ${outDir}`);
        continue;
      }
      if (statSync(join(outDir, f)).size === 0)
        err(`${body.id}: ${f} is zero bytes`);
    }
    if (!manifest.bodies?.[body.id])
      err(
        `${body.id}: declared in PLANET_SOURCES but absent from manifest.json`,
      );
  }

  for (const id of Object.keys(manifest.bodies ?? {})) {
    if (NEVER_SPHERE.has(id))
      err(`manifest.json contains ${id}, which is in NEVER_SPHERE`);
    if (!PLANET_SOURCES.some((b) => b.id === id))
      err(
        `manifest.json contains ${id}, which no longer exists in PLANET_SOURCES`,
      );
  }

  // Orphans are a real hazard here, not tidiness: a body renamed or dropped from the pipeline
  // leaves megabytes of unreferenced JPEG in the shipped payload, which the asset budget then
  // charges against a feature that no longer exists.
  //
  // SCOPED BY OWNERSHIP, exactly as the pruner is. This directory is shared: alongside this
  // pipeline's tiered maps it holds the 18 per-body dossier images the celestial catalogs
  // reference (`mars.jpg`, `moon-topo.jpg`, ...) and the passthrough assets. Those are not this
  // pipeline's to judge, and calling them "orphans" would be the same category error that made
  // the first pruner delete them.
  for (const f of onDisk) {
    if (expected.has(f)) continue;
    if (GENERATED_NAME.test(f))
      err(`orphan asset ${f} — not produced by any declared body`);
  }

  if (errors === 0)
    console.log(
      `planet-textures: verified ${PLANET_SOURCES.length} bodies, ` +
        `${expected.size} files, manifest consistent.`,
    );
  return errors;
}

/** Assert the reckoning accounts for every real file in the pack. Only runs when the source pack
 * is present — its whole purpose is to catch a pack file that nobody classified. */
function verifyReckoning() {
  const packRoot = join(SRC, "..");
  if (!existsSync(SRC)) return 0;
  let errors = 0;
  const consumed = new Set();
  for (const body of PLANET_SOURCES) {
    for (const map of [
      "surface",
      "height",
      "normal",
      "night",
      "cloud",
      "specular",
    ]) {
      const name =
        map === "surface" ? (body.cubemap ?? body.surface) : body[map];
      if (!name) continue;
      consumed.add(
        name.includes("/") ? `cubemap/${name.split("/")[0]}` : `base/${name}`,
      );
    }
  }
  const seen = new Set();
  for (const sub of ["base", "cubemap", "skybox"]) {
    const dir = join(packRoot, sub);
    if (!existsSync(dir)) continue;
    for (const entry of readdirSync(dir)) {
      const key =
        sub === "base"
          ? `base/${entry.replace(/\.jpg$/, "")}`
          : `${sub}/${entry}`;
      seen.add(key);
      if (consumed.has(key) || PACK_RECKONING[key]) continue;
      errors++;
      fail(
        `pack file ${key} is neither consumed nor accounted for in PACK_RECKONING — ` +
          `classify it (ship it, or record why not)`,
      );
    }
  }
  for (const key of Object.keys(PACK_RECKONING))
    if (!seen.has(key))
      console.log(
        `  NOTE  PACK_RECKONING mentions ${key}, which is not in the local pack`,
      );
  if (errors === 0)
    console.log(
      `planet-textures: reckoning accounts for all ${seen.size} pack entries ` +
        `(${consumed.size} shipped, ${Object.keys(PACK_RECKONING).length} recorded as skipped).`,
    );
  return errors;
}

/** True when `body`'s outputs are missing, or older than any of its sources. */
function isStale(body, outDir) {
  const { files } = plannedFiles(body);
  let newestSrc = 0;
  for (const map of [
    "surface",
    "height",
    "normal",
    "night",
    "cloud",
    "specular",
  ]) {
    if (map !== "surface" && !body[map]) continue;
    const src = sourceFor(body, map);
    const p = src.flat ?? src.cube;
    if (!existsSync(p)) continue;
    const st = statSync(p);
    const mt = st.isDirectory()
      ? Math.max(...readdirSync(p).map((f) => statSync(join(p, f)).mtimeMs))
      : st.mtimeMs;
    newestSrc = Math.max(newestSrc, mt);
  }
  for (const f of files) {
    const out = join(outDir, f);
    if (!existsSync(out)) return true;
    if (statSync(out).mtimeMs < newestSrc) return true;
  }
  return false;
}

/** Declaration-derived manifest fields that describe a body rather than name a file.
 *
 * Kept as ONE list with one writer so the full-build path and the metadata-only reconcile path
 * below cannot drift — the class of bug where `--if-stale` and a full rebuild produce different
 * manifests is exactly what this pipeline's three-mode convention exists to prevent. Emitted only
 * when truthy, so the manifest records what a body HAS rather than a wall of `false`. */
const METADATA_FIELDS = ["atmosphere"];

function applyMetadata(body, entry) {
  for (const f of METADATA_FIELDS) {
    if (body[f]) entry[f] = body[f];
    else delete entry[f];
  }
}

/** Reconcile metadata on an existing manifest without re-emitting a single image. */
function syncManifestMetadata(bodies, outDir) {
  const manifestPath = join(outDir, "manifest.json");
  if (!existsSync(manifestPath)) return;
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let changed = 0;
  for (const body of bodies) {
    const entry = manifest.bodies?.[body.id];
    if (!entry) continue;
    const before = JSON.stringify(METADATA_FIELDS.map((f) => entry[f] ?? null));
    applyMetadata(body, entry);
    if (JSON.stringify(METADATA_FIELDS.map((f) => entry[f] ?? null)) !== before)
      changed++;
  }
  if (changed) {
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    console.log(
      `planet-textures: reconciled manifest metadata on ${changed} bod${changed === 1 ? "y" : "ies"}.`,
    );
  }
}

async function build(bodies, outDir) {
  mkdirSync(outDir, { recursive: true });
  const manifestPath = join(outDir, "manifest.json");
  // Merge rather than replace, so `--only` and `--if-stale` cannot silently truncate the manifest
  // to the subset they happened to rebuild.
  const manifest = existsSync(manifestPath)
    ? JSON.parse(readFileSync(manifestPath, "utf8"))
    : {};
  manifest.generated = "PF-10 C4";
  manifest.tiers = TIERS;
  manifest.bodies ??= {};
  let total = 0;

  for (const body of bodies) {
    const { tierNames } = plannedFiles(body);
    const entry = { surface: {}, height: null, normal: null };
    for (const map of [
      "surface",
      "height",
      "normal",
      "night",
      "cloud",
      "specular",
    ]) {
      if (map !== "surface" && !body[map]) continue;
      const src = sourceFor(body, map);
      entry[map] = {};
      for (const t of tiersForMap(body, map, tierNames)) {
        const file = `${body.id}-${map}-${t}.jpg`;
        const bytes = await emit(src, join(outDir, file), TIERS[t], map);
        entry[map][t] = file;
        total += bytes;
        console.log(
          `  ${file.padEnd(32)} ${TIERS[t].width}x${TIERS[t].width / 2}  ` +
            `${(bytes / 1048576).toFixed(2)} MB${src.cube ? "  (cubemap -> equirect)" : ""}`,
        );
      }
    }
    if (body.dossier) {
      const file = `${body.id}.jpg`;
      const bytes = await emit(
        sourceFor(body, "surface"),
        join(outDir, file),
        { width: DOSSIER_PX, quality: 80 },
        "surface",
      );
      total += bytes;
      console.log(
        `  ${file.padEnd(32)} ${DOSSIER_PX}x${DOSSIER_PX / 2}  ` +
          `${(bytes / 1048576).toFixed(2)} MB  (catalog dossier)`,
      );
    }
    applyMetadata(body, entry);
    manifest.bodies[body.id] = entry;
  }

  // Drop manifest entries for bodies no longer declared, so a removal is a real removal.
  for (const id of Object.keys(manifest.bodies))
    if (!PLANET_SOURCES.some((b) => b.id === id)) delete manifest.bodies[id];

  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
  console.log(
    `\n${bodies.length} bodies rebuilt -> ${outDir}  (${(total / 1048576).toFixed(1)} MB written)`,
  );
}

/** Filenames this pipeline is capable of GENERATING: `<body>-<map>-<tier>.jpg`, nothing else.
 * The pruner deletes files, so it must be able to prove it owns one first. This is that proof. */
export const GENERATED_NAME =
  /^[a-z0-9]+-(surface|height|normal|cloud|specular)-(base|high|ultra)\.jpg$/;

/** Report files in the output directory that no longer correspond to a declared body.
 *
 * THIS FUNCTION DELETES NOTHING, AND THAT IS A DELIBERATE, OWNER-DIRECTED REMOVAL OF CAPABILITY
 * (2026-07-21) RATHER THAN AN OVERSIGHT.
 *
 * Its first version deleted every unexpected `.jpg` here. That silently destroyed 19 real shipped
 * assets — the 18 per-body dossier images the celestial catalogs reference, and `venus-cloud.jpg`,
 * which was untracked by git and therefore unrecoverable from it. Nothing in the build, typecheck,
 * lint or unit suites failed; it surfaced only as a 404 in a real-browser E2E.
 *
 * A second version narrowed the deletion to filenames matching `GENERATED_NAME`, which would have
 * been safe. It was still removed, on the owner's call, for a better reason than safety: **the
 * approved design said "no orphans — fails loud on drift", and "fails loud" is a report, not an
 * `rm`.** The destructive step was never requested, and it solved a problem (a body dropped from
 * the pipeline leaving megabytes behind) that has occurred zero times, at the cost of a failure
 * mode that destroys work.
 *
 * So the rule this file now embodies: **the pipeline writes what it declares and reports what it
 * does not recognise. Removing a file is a human decision.** `--verify` fails on a true orphan, so
 * the drift is still caught — it is just caught by a person rather than by a filesystem call. */
function reportUnrecognised(outDir) {
  if (!existsSync(outDir)) return;
  const expected = new Set(
    PLANET_SOURCES.flatMap((b) => plannedFiles(b).files),
  );
  for (const a of PASSTHROUGH_ASSETS) expected.add(a.out);
  const catalogOwned = catalogOwnedAssets();
  const stale = [];
  const foreign = [];
  for (const f of readdirSync(outDir)) {
    if (!f.endsWith(".jpg") || expected.has(f)) continue;
    // Owned by the celestial catalogs. Silent — this is the normal, correct state, and 18 lines
    // of it on every `npm run dev` reads as an alarm rather than as reassurance.
    if (catalogOwned.has(f)) continue;
    (GENERATED_NAME.test(f) ? stale : foreign).push(f);
  }
  // A file shaped like this pipeline's own output but no longer declared: almost certainly left
  // over from a removed body, and the one case where deleting would once have been reasonable.
  if (stale.length)
    console.log(
      `  NOTE  ${stale.length} file(s) match this pipeline's naming but are no longer declared. ` +
        `Delete them yourself if that is right: ${stale.join(", ")}`,
    );
  if (foreign.length)
    console.log(
      `  NOTE  ${foreign.length} file(s) here are owned by neither this pipeline nor the ` +
        `celestial catalogs, and were left alone: ${foreign.join(", ")}`,
    );
}

/** Copy the verbatim passthrough assets, but only when they are actually missing or stale.
 *
 * Silent on the common path. `predev`/`prepreview` run this on every single start, and a pipeline
 * that narrates itself when nothing happened trains the reader to skim — which is precisely how a
 * genuinely important line gets missed. */
function copyPassthrough(outDir) {
  for (const a of PASSTHROUGH_ASSETS) {
    if (!existsSync(a.src)) {
      console.log(`  skip ${a.out}: source absent (${a.src})`);
      continue;
    }
    const dest = join(outDir, a.out);
    if (existsSync(dest) && statSync(dest).size === statSync(a.src).size)
      continue;
    copyFileSync(a.src, dest);
    console.log(`  ${a.out.padEnd(32)} copied verbatim`);
  }
}

/** Assets in this directory that belong to the CATALOG rather than to this pipeline — the
 * per-body dossier images referenced by `img:` fields in `src/data/celestial/*.js`
 * (`mars.jpg`, `moon-topo.jpg`, ...).
 *
 * DERIVED FROM THE CATALOGS, never listed by hand. A hand-maintained second list is a drift
 * hazard, and drift in this particular list is what deleted 19 files: the pruner's whole failure
 * was not knowing that this directory has more than one legitimate owner.
 *
 * Returns an empty set if the catalogs cannot be read, which makes the pruner MORE conservative
 * rather than less — an unreadable catalog means every unrecognised file is left alone. */
function catalogOwnedAssets() {
  const dir = "src/data/celestial";
  const owned = new Set();
  if (!existsSync(dir)) return owned;
  for (const f of readdirSync(dir)) {
    if (!f.endsWith(".js")) continue;
    const src = readFileSync(join(dir, f), "utf8");
    for (const m of src.matchAll(/assets\/planets\/([A-Za-z0-9_-]+\.jpg)/g))
      owned.add(m[1]);
  }
  return owned;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.verify) {
    const e = verify(args.out) + verifyReckoning();
    if (e) process.exitCode = 1;
    return;
  }

  const havePack = existsSync(SRC);
  if (!havePack) {
    if (args.ifStale) {
      // The expected state in CI and on any clone: `resources/` is gitignored, the generated
      // assets are committed, and there is nothing to regenerate. Verify what is committed and
      // move on — this is a no-op branch, not a failure.
      console.log(
        `planet-textures: source pack absent (${SRC}) — assets are committed, ` +
          `nothing to rebuild. Verifying what is on disk instead.`,
      );
      if (verify(args.out)) process.exitCode = 1;
      return;
    }
    fail(
      `source pack not found at ${SRC} (it is gitignored — see .gitignore "resources/")`,
    );
    return;
  }

  let bodies = PLANET_SOURCES.filter(
    (p) => !args.only || args.only.includes(p.id),
  );
  if (args.ifStale) {
    const stale = bodies.filter((b) => isStale(b, args.out));
    if (stale.length === 0) {
      console.log("planet-textures: all bodies up to date.");
      // PF-11 D6.3.4: reconcile declaration-derived METADATA even when no image is stale.
      // `isStale` compares image mtimes against their sources, so it is structurally blind to a
      // change that adds or removes a manifest field without touching a pixel — exactly what
      // adding `atmosphere: true` to Earth was. Without this the flag would have needed either a
      // full re-emit of all 88 images or a hand-edit of a generated file (CLAUDE.md #22), and the
      // next metadata field would have hit the same wall.
      syncManifestMetadata(bodies, args.out);
      copyPassthrough(args.out);
      reportUnrecognised(args.out);
      if (verify(args.out)) process.exitCode = 1;
      return;
    }
    console.log(
      `planet-textures: rebuilding ${stale.length} stale of ${bodies.length} ` +
        `(${stale.map((b) => b.id).join(", ")})`,
    );
    bodies = stale;
  }

  await build(bodies, args.out);
  copyPassthrough(args.out);
  reportUnrecognised(args.out);
  if (verify(args.out) + verifyReckoning()) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith("build-planet-textures.mjs")) {
  main();
}
