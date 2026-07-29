#!/usr/bin/env node
/* patch-atlas.mjs — PF-11 D6.6a: adds atlas cells for bodies that shipped a real texture but no
 * photographic-billboard entry.
 *
 * WHY THIS EXISTS. `public/assets/atlas.jpg` (4096x4096, packed 128/256px cells,
 * `public/assets/atlas-map.json` the UV lookup) is VENDORED — no build script in this repo
 * ever generated it, per the implementation plan's own note. `isPhotoEligible`
 * (src/lib/celestial-bodies.ts) requires BOTH `img` on the catalog entry AND an atlas-map
 * entry for that id — Tethys/Dione/Rhea (TR-079) shipped `img` pointing at their own real
 * sphere textures but never got an atlas cell, so the flat photographic-billboard path (used
 * at range, before the sphere upgrade takes over — see planet-sphere.ts) silently falls back
 * to a plain coloured point for all three. The exact same class of defect TR-079 fixed for
 * the sphere path, one layer up.
 *
 * FREE SPACE. The 16x16 macro grid (0.0625 UV per cell) is packed to 251/256 cells; the one
 * genuinely free macro-cell (row 3, col 2 -> pixel [512,768], confirmed blank by PNG
 * byte-size: ~800 B vs ~148 KB for a real photographic cell at the same crop size) is
 * subdivided here into a 2x2 grid of 128px micro-cells (the same size the existing
 * planet/moon corner already uses), giving 4 new slots — 3 used, 1 left free.
 *
 * SOURCE CROP. Each source (`public/assets/planets/<id>.jpg`, 1024x512 equirectangular —
 * already-committed real texture, not gitignored `resources/`) is centre-cropped to a 512x512
 * square (longitude band centred on the map's own prime meridian, full latitude range) and
 * resized to 128x128 — a deterministic, reproducible convention, not a hand-picked "best
 * angle" (no atlas-authoring precedent exists in this repo to match against).
 *
 * THREE-MODE SHAPE, matching `build-planet-textures.mjs`'s convention:
 *   default    — apply every patch that actually NEEDS applying: its atlas-map entry is missing,
 *                or its source image is newer than the committed atlas. A no-op otherwise.
 *   --if-stale — apply only patches whose atlas-map.json entry is still missing (a no-op once
 *                committed — this is what CI/a fresh clone runs, since the source images are
 *                already committed, unlike the gitignored `resources/` source packs).
 *   --verify   — check atlas-map.json carries every configured id with the right cell shape
 *                and that atlas.jpg's dimensions are unchanged; no network, no rebuild.
 *   --force    — re-encode and re-composite unconditionally. See the warning below.
 *
 * IDEMPOTENCY / GENERATION LOSS (2026-07-29 code review, finding 5). Compositing forces a full
 * 4096x4096 re-encode, not a patch of the touched region — so EVERY run re-encodes an
 * already-lossy JPEG and slightly degrades all ~260 cells that were already there, plus churns
 * the committed binary. As first shipped, default mode did that unconditionally, which made
 * `npm run assets:atlas` (the mode a human is most likely to type) the destructive one. Default
 * mode now writes only when something genuinely changed; `--force` keeps the "I really do want
 * a full re-encode" escape hatch, and says out loud what it costs when you use it.
 *
 * NEVER DELETES (TR-079 rule): the target atlas.jpg is read into memory and composited onto —
 * every existing pixel outside the newly-patched region is untouched — and atlas-map.json
 * entries are only ever ADDED, never removed or overwritten if already present.
 */
import {
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  statSync,
} from "node:fs";
import sharp from "sharp";

const ATLAS_PNG = "public/assets/atlas.jpg";
const ATLAS_MAP = "public/assets/atlas-map.json";
const ATLAS_SIZE = 4096;
const CELL_PX = 128;
const CELL_UV = CELL_PX / ATLAS_SIZE; // 0.03125, matching the existing planet/moon corner

/** The one free macro-cell (row 3, col 2 of the 16x16 grid), subdivided 2x2. */
const FREE_ORIGIN_PX = { x: 512, y: 768 };

const PATCHES = [
  { id: "tethys", source: "public/assets/planets/tethys.jpg", slot: [0, 0] },
  { id: "dione", source: "public/assets/planets/dione.jpg", slot: [1, 0] },
  { id: "rhea", source: "public/assets/planets/rhea.jpg", slot: [0, 1] },
];

function slotToPixel([col, row]) {
  return {
    x: FREE_ORIGIN_PX.x + col * CELL_PX,
    y: FREE_ORIGIN_PX.y + row * CELL_PX,
  };
}

function slotToUv([col, row]) {
  const u = FREE_ORIGIN_PX.x / ATLAS_SIZE + col * CELL_UV;
  const v = FREE_ORIGIN_PX.y / ATLAS_SIZE + row * CELL_UV;
  return [
    Math.round(u * 1e8) / 1e8,
    Math.round(v * 1e8) / 1e8,
    CELL_UV,
    CELL_UV,
  ];
}

function loadAtlasMap() {
  return JSON.parse(readFileSync(ATLAS_MAP, "utf8"));
}

/** Which patches genuinely need (re)applying, given the atlas already on disk. A patch is stale
 * when it has no atlas-map entry at all, or when its SOURCE image has been modified more
 * recently than the atlas it was composited into — the only two ways the committed atlas can
 * be out of date with respect to this script's configuration. Everything else is a no-op, and
 * a no-op must not re-encode (see the header's generation-loss note).
 *
 * Exported so a unit test can drive the decision logic without touching image files. */
export function stalePatches(patches, map, atlasMtimeMs, sourceMtimeMs) {
  return patches.filter(
    (p) =>
      !map[p.id] ||
      (sourceMtimeMs(p.source) != null &&
        atlasMtimeMs != null &&
        sourceMtimeMs(p.source) > atlasMtimeMs),
  );
}

function mtimeMs(path) {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return null;
  }
}

function fail(msg) {
  console.error(`patch-atlas: ${msg}`);
  process.exitCode = 1;
}

async function verify() {
  let ok = true;
  if (!existsSync(ATLAS_PNG) || !existsSync(ATLAS_MAP)) {
    fail(`missing ${ATLAS_PNG} or ${ATLAS_MAP}`);
    return true;
  }
  const map = loadAtlasMap();
  const meta = await sharp(ATLAS_PNG).metadata();
  if (meta.width !== ATLAS_SIZE || meta.height !== ATLAS_SIZE) {
    fail(
      `atlas.jpg is ${meta.width}x${meta.height}, expected ${ATLAS_SIZE}x${ATLAS_SIZE}`,
    );
    ok = false;
  }
  for (const p of PATCHES) {
    const cell = map[p.id];
    const expected = slotToUv(p.slot);
    if (!cell) {
      fail(`${p.id} missing from ${ATLAS_MAP}`);
      ok = false;
      continue;
    }
    const matches = cell.every((v, i) => Math.abs(v - expected[i]) < 1e-9);
    if (!matches) {
      fail(
        `${p.id}'s cell ${JSON.stringify(cell)} != expected ${JSON.stringify(expected)}`,
      );
      ok = false;
    }
  }
  if (ok)
    console.log(
      `patch-atlas: verified ${PATCHES.length} cell(s), atlas dims OK.`,
    );
  return !ok;
}

async function apply(patches) {
  if (patches.length === 0) {
    console.log("patch-atlas: nothing to apply.");
    return;
  }
  const tiles = await Promise.all(
    patches.map(async (p) => {
      if (!existsSync(p.source)) {
        throw new Error(`source image not found: ${p.source}`);
      }
      const src = sharp(p.source);
      const meta = await src.metadata();
      // Centre-crop a square (full height, band of width == height, centred horizontally)
      // out of the equirectangular source, then resize to the cell size.
      const cropSize = Math.min(meta.width, meta.height);
      const left = Math.round((meta.width - cropSize) / 2);
      const top = Math.round((meta.height - cropSize) / 2);
      const buffer = await sharp(p.source)
        .extract({ left, top, width: cropSize, height: cropSize })
        .resize(CELL_PX, CELL_PX)
        .toBuffer();
      const { x, y } = slotToPixel(p.slot);
      return { input: buffer, left: x, top: y };
    }),
  );

  // mozjpeg + quality 90: re-encoding the WHOLE 4096x4096 atlas (compositing forces a full
  // re-encode, not just the touched region) at the default libjpeg quality:92 measured 4.26 MB
  // — 0.76 MB more than the committed 3.50 MB original, tripping the asset budget for 3 small
  // 128px tiles. mozjpeg at quality 90 measures 3.72 MB, a real but far smaller 0.22 MB
  // deliberate growth; quality 85-88 undercuts the original file's own size but risks visibly
  // softening the ~260 already-shipped cells for the sake of 3 new ones, so 90 is the
  // conservative pick, not the smallest possible one.
  const patched = await sharp(ATLAS_PNG)
    .composite(tiles)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer();
  // Write to a temp path and rename over the original — sharp reading and Node writing the
  // exact same path back-to-back is flaky on Windows (the just-closed read handle can still be
  // held by the OS momentarily); a rename is also atomic, so a failed write never corrupts the
  // committed atlas.
  const tmpPath = `${ATLAS_PNG}.tmp`;
  writeFileSync(tmpPath, patched);
  renameSync(tmpPath, ATLAS_PNG);

  const map = loadAtlasMap();
  const toAdd = patches.filter((p) => !map[p.id]); // never overwrite an existing entry
  if (toAdd.length > 0) {
    // Textual append rather than JSON.stringify(map, null, 2): the committed file's convention
    // is one compact single-line array per entry ("id": [a, b, c, d]), and a full re-serialize
    // would reformat all 260+ pre-existing entries onto one array-element-per-line, an enormous
    // diff for a 3-entry change. Splice new lines in just before the closing brace instead.
    const raw = readFileSync(ATLAS_MAP, "utf8");
    const closeIdx = raw.lastIndexOf("}");
    const before = raw.slice(0, closeIdx).replace(/\s*$/, "");
    const needsComma = !before.endsWith("{");
    const newLines = toAdd
      .map((p) => `  "${p.id}": [${slotToUv(p.slot).join(", ")}]`)
      .join(",\n");
    const patchedJson =
      before +
      (needsComma ? ",\n" : "\n") +
      newLines +
      "\n" +
      raw.slice(closeIdx);
    writeFileSync(ATLAS_MAP, patchedJson);
    // Confirms the hand-spliced text is still valid, structurally-equal JSON before trusting it.
    const reparsed = JSON.parse(patchedJson);
    for (const p of toAdd) {
      if (!reparsed[p.id])
        throw new Error(`splice failed to add "${p.id}" to ${ATLAS_MAP}`);
    }
  }
  console.log(
    `patch-atlas: applied ${patches.length} cell(s) — ${patches.map((p) => p.id).join(", ")}.`,
  );
}

async function main() {
  const args = process.argv.slice(2);
  const verifyOnly = args.includes("--verify");
  const ifStale = args.includes("--if-stale");
  const force = args.includes("--force");

  if (verifyOnly) {
    if (await verify()) process.exitCode = 1;
    return;
  }

  const map = loadAtlasMap();
  const missing = PATCHES.filter((p) => !map[p.id]);

  if (ifStale) {
    if (missing.length === 0) {
      console.log("patch-atlas: all configured cells already present.");
      if (await verify()) process.exitCode = 1;
      return;
    }
    await apply(missing);
    if (await verify()) process.exitCode = 1;
    return;
  }

  if (force) {
    console.warn(
      "patch-atlas: --force — re-encoding the whole 4096x4096 atlas. This is LOSSY for every " +
        "cell already in it, not just the patched ones. Use the default mode unless you " +
        "specifically need a full re-encode.",
    );
    await apply(PATCHES);
    if (await verify()) process.exitCode = 1;
    return;
  }

  // Default: only what genuinely changed. See the header's generation-loss note for why an
  // unconditional re-encode here was wrong.
  const stale = stalePatches(PATCHES, map, mtimeMs(ATLAS_PNG), mtimeMs);
  if (stale.length === 0) {
    console.log(
      "patch-atlas: nothing to do — every configured cell is present and no source image is " +
        "newer than the atlas. (Pass --force to re-encode anyway; it is lossy.)",
    );
    if (await verify()) process.exitCode = 1;
    return;
  }
  await apply(stale);
  if (await verify()) process.exitCode = 1;
}

if (process.argv[1] && process.argv[1].endsWith("patch-atlas.mjs")) {
  main();
}

export { PATCHES, slotToUv, slotToPixel };
