#!/usr/bin/env node
/* validate-cubemap-orientation.mjs — prove the Earth cubemap re-projection is oriented correctly.
 *
 * A cubemap has 24 plausible per-face orientations and every wrong one still looks like Earth at a
 * glance: continents in roughly the right places, one face rotated, or the whole map mirrored.
 * That is not a class of error to sign off by eye, so it is measured instead.
 *
 * THE MEASUREMENT. The same pack ships `tex/base/earth-specular-high.jpg` — an 8192x4096
 * EQUIRECTANGULAR ocean/land mask, in the convention every other map in this pipeline uses.
 * Specular is high on water and low on land, so it is effectively a ground-truth land mask with
 * known orientation. Re-project the day cubemap, reduce both to a coarse grid, and correlate.
 *
 * A correct orientation gives a strongly NEGATIVE correlation (bright land <-> dark specular).
 * Any rotated or mirrored variant scrambles the pairing and collapses |r| toward zero. The
 * candidate variants are scored alongside the shipped one so the margin is visible rather than
 * asserted — if the winner is not the shipped convention, this script says so and exits non-zero.
 *
 * Run: node scripts/validate-cubemap-orientation.mjs
 */
import sharp from "sharp";
import { cubemapToEquirect } from "./lib/cubemap-equirect.mjs";

const PACK = "resources/gaia_datasets/hi-res-textures/default-data/tex";
const DAY = `${PACK}/cubemap/earth-day-ultra/earth-day`;
const SPEC = `${PACK}/base/earth-specular-high.jpg`;

/** Coarse enough that JPEG noise and coastline detail average out, fine enough that a rotated
 * face cannot coincidentally match. 128x64 = 8,192 samples. */
const W = 128;
const H = 64;

function pearson(a, b) {
  const n = a.length;
  const ma = a.reduce((s, v) => s + v, 0) / n;
  const mb = b.reduce((s, v) => s + v, 0) / n;
  let num = 0;
  let da = 0;
  let db = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    num += x * y;
    da += x * x;
    db += y * y;
  }
  return num / Math.sqrt(da * db);
}

const grey = (buf) => {
  const g = new Float64Array(buf.length / 3);
  for (let i = 0; i < g.length; i++)
    g[i] = 0.299 * buf[i * 3] + 0.587 * buf[i * 3 + 1] + 0.114 * buf[i * 3 + 2];
  return Array.from(g);
};

/** Variants that a wrong-but-plausible convention would produce, applied to the SAMPLED grid so
 * each is scored against the identical ground truth. */
const VARIANTS = {
  shipped: (g) => g,
  "mirrored (longitude flipped)": (g) => {
    const o = new Array(g.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) o[y * W + x] = g[y * W + (W - 1 - x)];
    return o;
  },
  "flipped (latitude inverted)": (g) => {
    const o = new Array(g.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) o[y * W + x] = g[(H - 1 - y) * W + x];
    return o;
  },
  "half-turn in longitude": (g) => {
    const o = new Array(g.length);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) o[y * W + x] = g[y * W + ((x + W / 2) % W)];
    return o;
  },
};

const day = await cubemapToEquirect(DAY, W, H);
const spec = await sharp(SPEC)
  .resize(W, H, { fit: "fill" })
  .greyscale()
  .raw()
  .toBuffer();

const truth = Array.from(spec);
const base = grey(day.data);

console.log(
  `correlating re-projected earth-day against earth-specular-high (${W}x${H} grid)\n`,
);
const scored = Object.entries(VARIANTS)
  .map(([name, fn]) => [name, pearson(fn(base), truth)])
  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]));

for (const [name, r] of scored) console.log(`  r = ${r.toFixed(4)}   ${name}`);

const [winner, r] = scored[0];
console.log("");
if (winner !== "shipped") {
  console.error(
    `FAIL: "${winner}" correlates more strongly than the shipped convention — ` +
      `the re-projection in lib/cubemap-equirect.mjs is oriented wrong.`,
  );
  process.exit(1);
}
if (r > -0.3) {
  console.error(
    `FAIL: shipped orientation wins but only at r = ${r.toFixed(4)}. Land should be ` +
      `strongly ANTI-correlated with an ocean specular mask; this is too weak to call correct.`,
  );
  process.exit(1);
}
console.log(
  `OK: shipped orientation is the strongest match at r = ${r.toFixed(4)} ` +
    `(land dark in specular, as it must be), beating the runner-up ` +
    `"${scored[1][0]}" at r = ${scored[1][1].toFixed(4)}.`,
);
