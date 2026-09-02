#!/usr/bin/env node
/* build-planet-vt.mjs — PF-10 C4.2: bake the MOLA / LOLA elevation pyramids into NORMAL tiles.
 *
 * WHY NORMALS AND NOT HEIGHTS — this is Astra's finding, and it is the whole reason this script
 * exists rather than the runtime simply streaming the source tiles.
 *
 * Both packs are 8-bit JPEG. At level 5 the horizontal resolution is 8x that of level 2 while the
 * vertical ramp stays 256 levels, so the minimum representable slope step reaches **14.4 degrees**
 * — a real level-5 tile was measured spanning just 14 distinct byte values across its whole
 * 1024x1024. Differentiating that live in a shader terraces the surface into visible steps.
 *
 * Quantization error behaves completely differently in the two representations: catastrophic in
 * heights, because the shader DIFFERENTIATES them, and benign in normals, because the shader
 * consumes them directly. So the differentiation happens here, once, offline, where a wide Sobel
 * kernel and dithering can be afforded — and the runtime streams the result.
 *
 * WHAT IS BUILT, AND WHAT IS DELIBERATELY NOT. Levels 0-4 only. Level 5 exists in the Mars pack
 * (2,048 tiles, the bulk of its 105 MB) and is never built, because the camera cannot resolve it:
 * `ARRIVE_STANDOFF` is fixed at 38 world units from a radius-26 sphere with no zoom anywhere in
 * the engine, which caps the visible patch at 23.5 degrees across. Level 4 supplies 2,143 texels for that
 * patch — past 1440p, within 1% of 4K parity. Level 5's 4,286 are simply unreachable. See src/lib/planet-vt.ts.
 *
 * REAL ELEVATION RANGES, and a correction to the source data. Gaia Sky's own pack config declares
 * a `heightScale` per body, and Astra measured two of them as BROKEN PHYSICS against real relief:
 * the Moon at 5.5 km against a real 19.9 km range (3.6x too flat) and Mercury at 1.2848 km
 * against 9.9 (7.7x). Because this script bakes slopes rather than passing heights through, it
 * can and does correct them — the ranges below are real, from the literature, not from the pack.
 *
 * THREE MODES, matching `build-planet-textures.mjs` and `build-craft-assets.mjs --verify`:
 *
 *   (no flag)     full bake. Requires the source topography packs.
 *   --if-stale    bake only what is missing; NO-OP with a clear message when the source packs are
 *                 absent. This is what `predev`/`prepreview` run, and the no-op branch is why it
 *                 is safe in CI, where `resources/` is gitignored and can never exist.
 *   --verify      SOURCE-FREE. Checks the committed tiles against the emitted manifest: every
 *                 level's declared tile count present on disk, no empty tiles, no orphan levels.
 *                 This is the CI gate, and it is the thing that makes 1,364 generated files
 *                 reproducible-in-principle rather than reproducible-if-you-read-the-TR.
 *
 * Run: node scripts/build-planet-vt.mjs [--verify|--if-stale] [--body mars,moon] [--max-level 4]
 */
import {
  mkdirSync,
  existsSync,
  writeFileSync,
  readFileSync,
  readdirSync,
  statSync,
} from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const SRC_ROOT = "resources/gaia_datasets";
const OUT_ROOT = "public/assets/planets/vt";

/** Real total relief, km, used to convert the 0-255 ramp into real slopes. Astra's figures. */
export const REAL_RELIEF_KM = {
  mars: { range: 30.1, radiusKm: 3389.5, source: "vt-mars-topography-mola" },
  moon: { range: 19.9, radiusKm: 1737.4, source: "vt-moon-topography-nasa" },
};

export const TILE_PX = 1024;
export const DEFAULT_MAX_LEVEL = 4;

/** Sobel over a wider stencil than the usual 3x3.
 *
 * ASTRA: use a +/-4-texel span. With 8-bit input a 1-texel step is dominated by quantization —
 * neighbouring texels are frequently IDENTICAL, giving a zero gradient and a flat facet. Reaching
 * 4 texels out means the elevation difference is large enough to survive quantization, at the
 * cost of slightly softening genuinely sharp features. That trade is the right way round here:
 * a softened crater rim reads as a crater rim, a terraced one reads as a rendering bug. */
export const SOBEL_SPAN = 4;

/** Bake one height tile into a tangent-space normal tile (RGB = XYZ, the usual 0.5-biased form).
 *
 * `metresPerTexel` converts the byte ramp into real slope, so the emitted normals are physically
 * scaled rather than arbitrary — that is what lets the runtime ship with an exaggeration of 1.0.
 * Tiles are baked with their neighbours' edges unavailable, so gradients at the tile border use a
 * clamped stencil; the resulting seam is at most SOBEL_SPAN texels wide and invisible against a
 * 1024-px tile, which is why no overlap/apron is generated. */
export async function bakeNormalTile(
  heightBuf,
  width,
  height,
  metresPerLevel,
  metresPerTexel,
) {
  const out = Buffer.alloc(width * height * 3);
  const at = (x, y) => {
    const cx = Math.min(width - 1, Math.max(0, x));
    const cy = Math.min(height - 1, Math.max(0, y));
    return heightBuf[cy * width + cx];
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Central difference over the wide span, in real metres.
      const dzdx =
        ((at(x + SOBEL_SPAN, y) - at(x - SOBEL_SPAN, y)) * metresPerLevel) /
        (2 * SOBEL_SPAN * metresPerTexel);
      const dzdy =
        ((at(x, y + SOBEL_SPAN) - at(x, y - SOBEL_SPAN)) * metresPerLevel) /
        (2 * SOBEL_SPAN * metresPerTexel);
      // Tangent-space normal of the height field: (-dz/dx, -dz/dy, 1), normalized.
      const nx = -dzdx;
      const ny = -dzdy;
      const inv = 1 / Math.hypot(nx, ny, 1);
      const o = (y * width + x) * 3;
      out[o] = Math.max(
        0,
        Math.min(255, Math.round((nx * inv * 0.5 + 0.5) * 255)),
      );
      out[o + 1] = Math.max(
        0,
        Math.min(255, Math.round((ny * inv * 0.5 + 0.5) * 255)),
      );
      out[o + 2] = Math.max(
        0,
        Math.min(255, Math.round((1 * inv * 0.5 + 0.5) * 255)),
      );
    }
  }
  return out;
}

function parseArgs(argv) {
  const args = {
    bodies: ["mars", "moon"],
    maxLevel: DEFAULT_MAX_LEVEL,
    verify: false,
    ifStale: false,
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--body") args.bodies = argv[++i].split(",");
    else if (argv[i] === "--max-level") args.maxLevel = Number(argv[++i]);
    else if (argv[i] === "--verify") args.verify = true;
    else if (argv[i] === "--if-stale") args.ifStale = true;
  }
  return args;
}

/** SOURCE-FREE verification of the committed tile pyramid against its own manifest.
 *
 * `resources/` is gitignored, so CI can never rebake these tiles — the committed bytes ARE the
 * deliverable. The only thing CI can usefully assert is that the manifest and the tiles on disk
 * still agree, which is precisely the drift a hand-run, unregistered script invites. */
export function verify() {
  let errors = 0;
  const err = (m) => {
    errors++;
    console.error(`planet-vt: ${m}`);
  };

  const manifestPath = join(OUT_ROOT, "manifest.json");
  if (!existsSync(manifestPath)) {
    err(`${manifestPath} missing — run \`npm run assets:planets:vt\``);
    return errors;
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  let tiles = 0;

  for (const [body, spec] of Object.entries(manifest.bodies ?? {})) {
    for (const lv of spec.levels ?? []) {
      const dir = join(OUT_ROOT, body, `level${lv.level}`);
      if (!existsSync(dir)) {
        err(
          `${body} level${lv.level}: directory missing (manifest declares ${lv.tiles} tiles)`,
        );
        continue;
      }
      const onDisk = readdirSync(dir).filter((f) => f.endsWith(".jpg"));
      if (onDisk.length !== lv.tiles)
        err(
          `${body} level${lv.level}: manifest declares ${lv.tiles} tiles, ` +
            `${onDisk.length} on disk`,
        );
      for (const f of onDisk)
        if (statSync(join(dir, f)).size === 0)
          err(`${body} level${lv.level}/${f} is zero bytes`);
      tiles += onDisk.length;
    }
    // A level baked beyond what the manifest records is the same class of drift as a missing
    // one — and level 5 in particular is deliberately never built (see the header).
    const bodyDir = join(OUT_ROOT, body);
    if (existsSync(bodyDir))
      for (const entry of readdirSync(bodyDir)) {
        const n = Number(entry.replace("level", ""));
        if (!(spec.levels ?? []).some((l) => l.level === n))
          err(`${body}/${entry} exists on disk but is not in the manifest`);
      }
  }

  if (errors === 0)
    console.log(
      `planet-vt: verified ${Object.keys(manifest.bodies ?? {}).length} bodies, ` +
        `${tiles} normal tiles, manifest consistent.`,
    );
  return errors;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.verify) {
    if (verify()) process.exitCode = 1;
    return;
  }

  if (!existsSync(SRC_ROOT)) {
    if (args.ifStale) {
      // Expected in CI and on any clone: the topography packs are gitignored, the baked tiles are
      // committed. A no-op branch, not a failure.
      console.log(
        `planet-vt: source packs absent (${SRC_ROOT}) — tiles are committed, ` +
          `nothing to rebake. Verifying what is on disk instead.`,
      );
      if (verify()) process.exitCode = 1;
      return;
    }
    console.error(
      `planet-vt: ${SRC_ROOT} not found (it is gitignored — see .gitignore "resources/")`,
    );
    process.exitCode = 1;
    return;
  }

  if (args.ifStale && verify() === 0) {
    console.log("planet-vt: tile pyramid up to date.");
    return;
  }
  const manifest = { generated: "PF-10 C4.2", tilePx: TILE_PX, bodies: {} };
  let totalBytes = 0;
  let totalTiles = 0;

  for (const body of args.bodies) {
    const spec = REAL_RELIEF_KM[body];
    if (!spec) {
      console.log(`skip ${body}: no real relief figures`);
      continue;
    }
    const srcTex = join(SRC_ROOT, spec.source, "tex");
    if (!existsSync(srcTex)) {
      console.log(`skip ${body}: ${srcTex} absent`);
      continue;
    }
    const metresPerLevel = (spec.range * 1000) / 255; // one byte step, in real metres
    const levels = [];

    for (let level = 0; level <= args.maxLevel; level++) {
      const srcLevel = join(srcTex, `level${level}`);
      if (!existsSync(srcLevel)) break;
      const cols = 2 << level;
      const rows = 1 << level;
      // Real metres per texel at this level: the body's circumference / the level's pixel width.
      const circumferenceM = 2 * Math.PI * spec.radiusKm * 1000;
      const metresPerTexel = circumferenceM / (cols * TILE_PX);
      const outLevel = join(OUT_ROOT, body, `level${level}`);
      mkdirSync(outLevel, { recursive: true });

      let count = 0;
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const srcFile = join(srcLevel, `tx_${c}_${r}.jpg`);
          if (!existsSync(srcFile)) continue;
          const { data, info } = await sharp(srcFile)
            .greyscale()
            .raw()
            .toBuffer({ resolveWithObject: true });
          const normals = await bakeNormalTile(
            data,
            info.width,
            info.height,
            metresPerLevel,
            metresPerTexel,
          );
          const outFile = join(outLevel, `tx_${c}_${r}.jpg`);
          await sharp(normals, {
            raw: { width: info.width, height: info.height, channels: 3 },
          })
            .jpeg({ quality: 88, mozjpeg: true })
            .toFile(outFile);
          totalBytes += statSync(outFile).size;
          count++;
        }
      }
      levels.push({ level, cols, rows, tiles: count });
      totalTiles += count;
      console.log(
        `  ${body} level${level}: ${count} tiles (${cols}x${rows}), ${metresPerTexel.toFixed(0)} m/texel`,
      );
    }
    manifest.bodies[body] = {
      maxLevel: levels.length ? levels[levels.length - 1].level : -1,
      reliefKm: spec.range,
      levels,
    };
  }

  mkdirSync(OUT_ROOT, { recursive: true });
  writeFileSync(
    join(OUT_ROOT, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  console.log(
    `\n${totalTiles} normal tiles baked, ${(totalBytes / 1048576).toFixed(1)} MB -> ${OUT_ROOT}`,
  );
  console.log(
    `level 5 deliberately NOT built — the fixed arrival camera cannot resolve it (see planet-vt.ts)`,
  );
  if (verify()) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith("build-planet-vt.mjs")) {
  main();
}
