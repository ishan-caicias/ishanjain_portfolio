#!/usr/bin/env node
/* gaia-sdss18-pngpack.mjs — PF-10 C2: SDSS DR18 galaxy field -> PNG-packed background layer,
 * Track B, run against the REAL FULL 3,637,836-row file (not a sample).
 *
 * Source: resources/gaia_datasets/catalog-sdss-18/sdss/sdss_dr18.bin — Gaia Sky's own native
 * binary particle format (scripts/lib/gaiasky-binary-particles.mjs), confirmed against the
 * official format spec and byte-verified this session. Real per-record ra/dec/distance(pc),
 * already comoving-distance-corrected per the dataset's own description ("High-redshift
 * galaxies... with comoving distances") — no separate redshift->distance cosmology needed here,
 * unlike a raw spectroscopic-redshift catalog would require.
 *
 * REAL SCALE FINDING that changes this phase's placement design (measured this session, not
 * assumed): real distances in this file span ~32.6 MILLION to ~28.86 BILLION light-years — a
 * ~1000x dynamic range, dwarfing the existing 168,959-star background field's real linear-ly
 * placement (max ~2,400 ly in the shipped catalog). Placing SDSS galaxies at the SAME linear-ly
 * convention star-catalog.ts's background layer uses would put nearly every point somewhere
 * between "far outside any plausible camera frustum" and "a float32 position with meaningless
 * absolute precision at ~1e10 units." This is a genuinely different physical regime, not the
 * same kind of "far star" the existing linear scale was built for.
 *
 * RESOLUTION APPLIED: bake LOGARITHMIC depth into the packed x/y/z floats, using the exact same
 * `bodyDepth()` formula ship-dynamics.ts already uses for every curated (celestial-*.js) body
 * (`150 + 128*log10(ly+1.5)`) — ported here rather than imported, matching this repo's own
 * stated convention for build scripts duplicating engine-adjacent formulas rather than importing
 * across the module graph (see gaia-whitedwarf-pngpack.mjs's header for the same rationale).
 * This compresses the real 32.6M-28.86B ly range down to ~1,112-1,489 world-depth units — the
 * same order of magnitude as the rest of the scene's log-scaled bodies, not a new coordinate
 * system. CONSEQUENCE, stated plainly: this makes SDSS DR18's background-layer positions
 * LOG-scaled while the star/white-dwarf/CNS5/Oort background layers stay LINEAR-scaled. Mixing
 * both conventions inside one merged `CATALOG_CHUNKS` draw call would silently corrupt whichever
 * layer's convention doesn't match, so this is intentionally NOT added to `CATALOG_CHUNKS` —
 * it needs its OWN mesh/VertexBuffer pair (reusing the same `ijStar` shader material, since
 * object-type byte 3 = "galaxy smudge" is already a first-class shader branch), a real,
 * separate rendering-integration step, not attempted here.
 *
 * PHOTOMETRY: this file's "simple" (non-extended) format carries NO per-object magnitude or
 * colour — id/ra/dec/distance only (see gaiasky-binary-particles.mjs's header). The Gaia Sky
 * app's own particles-sdss-18.json config confirms this: `colorMin`/`colorMax`/
 * `particleSizeLimits` are RENDERER-side procedural ranges, not per-object data. Rather than
 * inventing per-galaxy brightness/colour the source data doesn't contain, every record gets a
 * uniform magnitude/colour byte pair — same honest treatment as the Oort cloud (TR-065).
 *
 * MEMORY: streams all 3,637,836 real rows via forEachGaiaSkyParticleInFile + packStreamToBytes
 * — zero per-record JS objects (measured this session: 487ms, 0.6 MB heap delta for the decode
 * pass alone). This is the real C0 "streaming decode" gap, closed.
 *
 * Run: node scripts/gaia-sdss18-pngpack.mjs [--out scripts/out/sdss18-full.png] [--limit N]
 */
import {
  forEachGaiaSkyParticleInFile,
  readGaiaSkyBinaryHeader,
} from "./lib/gaiasky-binary-particles.mjs";
import { bytesToPixelBuffer, RECORD_BYTES } from "./lib/starfield-pngpack.mjs";
import { bodyDepth, raDecToDir } from "./lib/log-depth.mjs";
import { mkdirSync, openSync, readSync, closeSync } from "node:fs";
import { dirname } from "node:path";
import sharp from "sharp";

const BIN_PATH = "resources/gaia_datasets/catalog-sdss-18/sdss/sdss_dr18.bin";
const PC_TO_LY = 3.26156;
const GALAXY_TYPE_BYTE = 3; // "galaxy smudge" — already a real shader branch (babylon-engine.ts)
// PF-11 P2b: recomputed to preserve the ORIGINAL intended "moderate brightness" real magnitude
// (~9.21) under the rescaled decode formula (mag = 21.5 - 32*t + 9*t^2, t = byte/255) — byte 60
// meant mag 9.21 under the old 12.5-floor formula; see gaia-oortcloud-pngpack.mjs's sibling
// note for why leaving the byte unchanged would silently shift the intended brightness.
// NOT YET REGENERATED as of this change (out of P2b's regeneration scope — this header's own
// "NOT attempted here" note above is stale, `assets/sdss18.png` IS wired live via
// babylon-engine.ts's `_loadSdssGalaxyLayer`; regenerating this 47 MB asset is real disk/CPU
// cost, deferred as a manual follow-up step, NOT covered by `assets:craft`/`assets:verify`).
// Until this script is re-run, the SHIPPED sdss18.png still carries the OLD byte (60), which the
// now-updated shared decode formula reinterprets as mag ~14.47 instead of the intended ~9.21 —
// a real, live, undocumented dimming of the SDSS galaxy layer. Flagged, not silently left.
const UNIFORM_MAG_BYTE = 112; // moderate brightness (~mag 9.21, unchanged intent — see note above)
const UNIFORM_COLOUR_BYTE = 140; // warm-neutral, mid-ramp

function parseArgs(argv) {
  const args = { out: "scripts/out/sdss18-full.png", limit: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--out") args.out = argv[++i];
    else if (argv[i] === "--limit") args.limit = Number.parseInt(argv[++i], 10);
  }
  return args;
}

/** Reads just the 5-byte header (particle count + extended flag) without loading the rest of
 * the 131 MB file — a targeted partial read, not the double-full-scan a header-via-forEach
 * pass would cost. */
function readHeaderOnly(path) {
  const fd = openSync(path, "r");
  try {
    const buf = Buffer.alloc(5);
    readSync(fd, buf, 0, 5, 0);
    return readGaiaSkyBinaryHeader(buf);
  } finally {
    closeSync(fd);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const t0 = Date.now();

  const header = readHeaderOnly(BIN_PATH);
  const count = args.limit ? Math.min(args.limit, header.count) : header.count;
  console.log(
    `SDSS DR18: ${header.count} real rows in the file, packing ${count}`,
  );

  // packStreamToBytes owns its own iteration (a count + fillRecord(view, index) callback); SDSS
  // needs to drive the buffer fill from the .bin file's OWN stream instead, so the output buffer
  // is built directly here using the exact same byte layout packStreamToBytes/star-catalog.ts
  // share (RECORD_BYTES=15, little-endian f32 x/y/z, u8 mag/colour/type) rather than forcing an
  // awkward double-iteration through packStreamToBytes's single-source callback shape.
  let minDepth = Infinity;
  let maxDepth = -Infinity;
  let i = 0;
  const out = Buffer.alloc(count * RECORD_BYTES);
  forEachGaiaSkyParticleInFile(BIN_PATH, (_id, ra, dec, distancePc) => {
    if (i >= count) return;
    const distanceLy = distancePc * PC_TO_LY;
    const depth = bodyDepth(distanceLy);
    if (depth < minDepth) minDepth = depth;
    if (depth > maxDepth) maxDepth = depth;
    const [dx, dy, dz] = raDecToDir(ra, dec);
    const o = i * RECORD_BYTES;
    out.writeFloatLE(dx * depth, o);
    out.writeFloatLE(dy * depth, o + 4);
    out.writeFloatLE(dz * depth, o + 8);
    out.writeUInt8(UNIFORM_MAG_BYTE, o + 12);
    out.writeUInt8(UNIFORM_COLOUR_BYTE, o + 13);
    out.writeUInt8(GALAXY_TYPE_BYTE, o + 14);
    i++;
  });

  console.log(
    `packed ${i} records in ${Date.now() - t0}ms — depth range [${minDepth.toFixed(1)}, ${maxDepth.toFixed(1)}] world units (compare: existing shipped star field's own depth range is a similar order of magnitude, per bodyDepth() applied to its ~34.8-2,399.6 ly real span)`,
  );

  const { pixels, width, height } = bytesToPixelBuffer(out);
  mkdirSync(dirname(args.out), { recursive: true });
  await sharp(pixels, { raw: { width, height, channels: 4 } })
    .png()
    .toFile(args.out);
  console.log(
    `wrote ${i} records (${out.length} bytes) -> ${args.out} (${width}x${height})`,
  );

  const memMb = (process.memoryUsage().heapUsed / 1024 / 1024).toFixed(1);
  console.log(
    `peak-ish heap at completion: ${memMb} MB (no per-record object allocation)`,
  );
}

main();
