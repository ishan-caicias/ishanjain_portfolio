/**
 * PF-07 ship-v2 Phase 0 — craft asset pipeline.
 *
 * Converts the raw Sketchfab download (resources/spaceship/, git-ignored, ~43.5 MB)
 * into the two committed runtime GLBs consumed by the in-engine ship renderer:
 *
 *   public/assets/craft/sci-fi-fighter-1k.glb   (textures ≤ 1024px, budget ≤ 0.6 MiB)
 *   public/assets/craft/sci-fi-fighter-2k.glb   (textures ≤ 2048px, budget ≤ 1.2 MiB)
 *
 * Also copies the CC-BY-4.0 attribution (LICENSE.txt) alongside the assets so the
 * license follows the derived files. Deterministic: same input + same tool versions
 * produce byte-identical output (verified by the double-run check in --verify mode).
 *
 * Usage:  node scripts/build-craft-assets.mjs [--verify]
 * Exits non-zero if a tier misses its byte budget or the source asset is absent.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, copyFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  simplify,
  meshopt,
  textureCompress,
} from "@gltf-transform/functions";
import { MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_GLB = resolve(
  ROOT,
  "resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb",
);
const SOURCE_LICENSE = resolve(
  ROOT,
  "resources/spaceship/sci-fi_aircraft__spaceship_fighter/license.txt",
);
const OUT_DIR = resolve(ROOT, "public/assets/craft");

const MiB = 1024 * 1024;
// The 1k tier serves data-saver / low-GPU contexts, so it also carries a
// simplified mesh (ratio 0.5) — minimal transfer is its entire purpose, and the
// accessible quality selector (P4) lets visitors opt up. The 2k tier keeps the
// full 31k-vertex geometry.
const TIERS = [
  { name: "1k", textureSize: 1024, budgetBytes: 0.6 * MiB, simplifyRatio: 0.5 },
  {
    name: "2k",
    textureSize: 2048,
    budgetBytes: 1.2 * MiB,
    simplifyRatio: null,
  },
];
// Matches the repo's established WebP quality convention (TR-008).
const WEBP_QUALITY = 82;

async function buildTier(io, tier) {
  const document = await io.read(SOURCE_GLB);
  const transforms = [dedup(), prune(), weld()];
  if (tier.simplifyRatio) {
    transforms.push(
      simplify({
        simplifier: MeshoptSimplifier,
        ratio: tier.simplifyRatio,
        error: 0.001,
      }),
    );
  }
  await document.transform(
    ...transforms,
    // EXT_meshopt_compression: adopted at the P0 measurement gate — plain
    // quantization left geometry at 1.04 MiB, over both tier budgets. The P1
    // in-engine loader decodes this with the self-contained meshopt_decoder.
    meshopt({ encoder: MeshoptEncoder, level: "high" }),
    textureCompress({
      encoder: sharp,
      targetFormat: "webp",
      quality: WEBP_QUALITY,
      resize: [tier.textureSize, tier.textureSize],
    }),
  );
  return io.writeBinary(document);
}

async function main() {
  const verify = process.argv.includes("--verify");

  if (!existsSync(SOURCE_GLB)) {
    console.error(
      `Source asset not found: ${SOURCE_GLB}\n` +
        `This script needs the git-ignored Sketchfab download in resources/spaceship/. ` +
        `The committed runtime GLBs in public/assets/craft/ are the build outputs — ` +
        `if they already exist, nothing needs to be rebuilt.`,
    );
    process.exit(1);
  }

  mkdirSync(OUT_DIR, { recursive: true });
  await MeshoptEncoder.ready;
  const io = new NodeIO()
    .registerExtensions(ALL_EXTENSIONS)
    .registerDependencies({ "meshopt.encoder": MeshoptEncoder });
  let failed = false;

  for (const tier of TIERS) {
    const bytes = await buildTier(io, tier);
    const outPath = resolve(OUT_DIR, `sci-fi-fighter-${tier.name}.glb`);

    if (verify) {
      // Determinism check: build the same tier twice, compare hashes.
      const second = await buildTier(io, tier);
      const h1 = createHash("sha256").update(bytes).digest("hex");
      const h2 = createHash("sha256").update(second).digest("hex");
      if (h1 !== h2) {
        console.error(`✗ ${tier.name}: NON-DETERMINISTIC (${h1} vs ${h2})`);
        failed = true;
        continue;
      }
    }

    writeFileSync(outPath, bytes);
    const mib = (bytes.length / MiB).toFixed(3);
    const ok = bytes.length <= tier.budgetBytes;
    console.log(
      `${ok ? "✓" : "✗"} ${tier.name}: ${bytes.length.toLocaleString()} bytes (${mib} MiB) — ` +
        `budget ${(tier.budgetBytes / MiB).toFixed(1)} MiB${ok ? "" : " EXCEEDED"}` +
        `${verify ? " [deterministic]" : ""}`,
    );
    if (!ok) failed = true;
  }

  copyFileSync(SOURCE_LICENSE, resolve(OUT_DIR, "LICENSE.txt"));
  console.log("✓ LICENSE.txt (CC-BY-4.0 attribution) copied alongside assets");

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
