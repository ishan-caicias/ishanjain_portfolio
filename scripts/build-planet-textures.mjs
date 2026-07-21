#!/usr/bin/env node
/* build-planet-textures.mjs — PF-10 C4: real planetary surface + elevation maps -> shipped assets.
 *
 * WHY THIS PHASE IS NOT WHAT THE PLAN SAID. PF-10's C4 section describes applying topography "to
 * the existing Mars mesh" and calls itself "the lowest-risk phase — enhances existing meshes."
 * There is no Mars mesh. There is no planet mesh at all: every one of the 267 photographic bodies
 * renders as a BILLBOARD QUAD sampling a 128x128 cell of the shared 4096x4096 `atlas.jpg`
 * (celestial-bodies.ts, GAP-02). C4 therefore requires building planetary surface rendering from
 * scratch, which makes it the largest rendering feature in PF-10 rather than the smallest. Owner
 * informed and re-scoped 2026-07-21; see the corrected C4 section of the delivery plan.
 *
 * WHAT THE LOCAL DATA ACTUALLY OFFERS (measured, not assumed — `hi-res-textures`, 105 files):
 *
 *   Real SURFACE + real ELEVATION (the bodies this phase is really about):
 *     mars     8192x4096 surface + 8192x4096 height
 *     moon     8192x4096 surface + 8192x4096 height + normal
 *     mercury  8192x4096 surface + 8192x4096 height
 *   Real SURFACE only: venus, io, europa, titan, pluto (ultra); ganymede, ceres, phobos, deimos,
 *     dione, rhea, tethys, jupiter, saturn (high)
 *   Height with no surface in this pack: earth (21600x10800 height + normal + specular)
 *
 * All are EQUIRECTANGULAR, which is exactly the UV convention Babylon's `CreateSphereVertexData`
 * produces (u = longitude/2pi, v = pole-to-pole) — the same mapping `milky-way.ts` already relies
 * on and documents. No re-projection is needed anywhere in this pipeline; that is why the source
 * pack drops straight onto a sphere.
 *
 * WHAT THIS SCRIPT DOES: resizes each source map into shipped tiers and writes them to
 * `public/assets/planets/`, plus a manifest the engine reads. Generated assets are never
 * hand-edited (CLAUDE.md non-negotiable #22).
 *
 * A REAL SOURCE-DATA ODDITY, and a correction to this file's own first draft: the pack ships BOTH
 * `satrun-high.jpg` (a typo) and `saturn-high.jpg`. They are different files, not aliases —
 * 1800x900 and 4096x2048 respectively, both genuine 2:1 equirectangular Saturn maps. The first
 * draft of this script assumed the typo was the only spelling and would have shipped the
 * 1800x900 version; checking the real files rather than the filename listing caught it. The
 * correctly-spelled, higher-resolution map is the one used.
 *
 * Run: node scripts/build-planet-textures.mjs [--out public/assets/planets] [--only mars,moon]
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SRC = "resources/gaia_datasets/hi-res-textures/default-data/tex/base";

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
   * visible improvement available to this phase. Only bodies with an `-ultra` source get it. */
  ultra: { width: 8192, quality: 84 },
};

/** Bodies whose source pack has an `-ultra` map. Everything else tops out at `high`. */
export const ULTRA_SOURCES = new Set([
  "mars",
  "moon",
  "mercury",
  "venus",
  "io",
  "europa",
  "titan",
  "pluto",
]);

/** Real bodies with real local surface data. `height` present = this body gets real elevation.
 * `src` is the source basename; `srcOverride` exists only for the upstream Saturn typo. */
export const PLANET_SOURCES = [
  { id: "mars", surface: "mars-ultra", height: "mars-height-ultra" },
  { id: "moon", surface: "moon-ultra", height: "moon-height-ultra" },
  { id: "mercury", surface: "mercury-ultra", height: "mercury-height-ultra" },
  { id: "venus", surface: "venus-ultra" },
  { id: "io", surface: "io-ultra" },
  { id: "europa", surface: "europa-ultra" },
  { id: "titan", surface: "titan-ultra" },
  { id: "pluto", surface: "pluto-ultra" },
  { id: "ganymede", surface: "ganymede-high" },
  { id: "ceres", surface: "ceres-high" },
  { id: "jupiter", surface: "jupiter-high" },
  // NOT "satrun-high" — see the source-data note in the header.
  { id: "saturn", surface: "saturn-high" },
];
// Callisto is deliberately absent: the pack has no callisto map at all, despite shipping the
// other three Galilean moons. Verified against the real directory, not inferred.

function parseArgs(argv) {
  const args = { out: "public/assets/planets", only: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--only") args.only = argv[++i].split(",");
  }
  return args;
}

/** Resize one equirectangular map to a tier. Height maps are written GREYSCALE — they carry one
 * channel of real information and storing three identical ones triples the byte cost for nothing.
 * `fit: "fill"` is deliberate: the source is already 2:1 so this is a pure downscale, and "fill"
 * guarantees the exact target dimensions rather than letting rounding shift the aspect and slide
 * the whole map relative to its own UV grid. */
async function emit(srcName, outPath, tier, greyscale) {
  const src = join(SRC, `${srcName}.jpg`);
  let img = sharp(src).resize(tier.width, tier.width / 2, { fit: "fill" });
  if (greyscale) img = img.greyscale();
  await img.jpeg({ quality: tier.quality, mozjpeg: true }).toFile(outPath);
  return statSync(outPath).size;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const bodies = PLANET_SOURCES.filter(
    (p) => !args.only || args.only.includes(p.id),
  );
  mkdirSync(args.out, { recursive: true });

  const manifest = { generated: "PF-10 C4", tiers: TIERS, bodies: {} };
  let total = 0;

  for (const body of bodies) {
    const entry = { surface: {}, height: null };
    // `ultra` only where a real 8192-wide source exists — upscaling a 4096 map to 8192 would
    // cost the bytes and deliver no extra detail, which is worse than not shipping the tier.
    const tiers = Object.entries(TIERS).filter(
      ([name]) => name !== "ultra" || ULTRA_SOURCES.has(body.id),
    );
    for (const [tierName, tier] of tiers) {
      const file = `${body.id}-surface-${tierName}.jpg`;
      const bytes = await emit(body.surface, join(args.out, file), tier, false);
      entry.surface[tierName] = file;
      total += bytes;
      console.log(
        `  ${file.padEnd(30)} ${tier.width}x${tier.width / 2}  ${(bytes / 1048576).toFixed(2)} MB`,
      );
    }
    if (body.height) {
      entry.height = {};
      for (const [tierName, tier] of tiers) {
        const file = `${body.id}-height-${tierName}.jpg`;
        const bytes = await emit(body.height, join(args.out, file), tier, true);
        entry.height[tierName] = file;
        total += bytes;
        console.log(
          `  ${file.padEnd(30)} ${tier.width}x${tier.width / 2}  ${(bytes / 1048576).toFixed(2)} MB  (greyscale elevation)`,
        );
      }
    }
    manifest.bodies[body.id] = entry;
  }

  writeFileSync(
    join(args.out, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    `\n${bodies.length} bodies (${bodies.filter((b) => b.height).length} with real elevation) -> ${args.out}`,
  );
  console.log(`total shipped: ${(total / 1048576).toFixed(1)} MB`);
}

if (process.argv[1] && process.argv[1].endsWith("build-planet-textures.mjs")) {
  main();
}
