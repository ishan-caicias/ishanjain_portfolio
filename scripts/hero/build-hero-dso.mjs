// Builds public/hero-dso/manifest.json + public/hero-dso/images/*.webp from the curated,
// license-filtered source set in scripts/hero/source/ (raw images + per-object attribution.json,
// gathered from Wikimedia Commons and pre-filtered to Public Domain / CC0 / CC BY only).
//
// Re-run with: node scripts/hero/build-hero-dso.mjs

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = join(__dirname, "source");
const OUTPUT_DIR = join(__dirname, "..", "..", "public", "hero-dso");
const IMAGES_DIR = join(OUTPUT_DIR, "images");
const MANIFEST_PATH = join(OUTPUT_DIR, "manifest.json");

// Same physical object catalogued under both its Messier and NGC number; source files were
// confirmed byte-identical downloads. Keep the more recognisable Messier id, drop the NGC one.
const ALIAS_DROP = new Set([
  "NGC224", // = M31, Andromeda Galaxy
  "NGC1976", // = M42, Orion Nebula
  "NGC3034", // = M82, Cigar Galaxy
  "NGC4258", // = M106
  "NGC4594", // = M104, Sombrero Galaxy
  "NGC5194", // = M51, Whirlpool Galaxy
  "NGC5457", // = M101, Pinwheel Galaxy
  "NGC6720", // = M57, Ring Nebula
]);

// IC1848.jpg (Soul Nebula) is a byte-identical duplicate of IC1805.jpg (Heart Nebula) - a
// curation bug, not a catalog alias. Excluded pending re-sourcing of the correct photo.
const EXCLUDED = new Set(["IC1848"]);

function collapseWhitespace(text) {
  return text.replace(/\s+/g, " ").trim();
}

function findSourceImage(id) {
  const candidates = [".jpg", ".jpeg", ".png"];
  for (const ext of candidates) {
    const path = join(SOURCE_DIR, `${id}${ext}`);
    try {
      readFileSync(path);
      return path;
    } catch {
      // try next extension
    }
  }
  throw new Error(`No source image found for ${id}`);
}

async function main() {
  const attributionFiles = readdirSync(SOURCE_DIR).filter((f) =>
    f.endsWith(".attribution.json"),
  );

  rmSync(IMAGES_DIR, { recursive: true, force: true });
  mkdirSync(IMAGES_DIR, { recursive: true });

  const manifest = [];
  let droppedAliases = 0;
  let excluded = 0;

  for (const file of attributionFiles.sort()) {
    const meta = JSON.parse(readFileSync(join(SOURCE_DIR, file), "utf-8"));
    const {
      id,
      label,
      licenseShortName,
      licenseUrl,
      artist,
      imageDescriptionUrl,
      attributionRequired,
    } = meta;

    if (ALIAS_DROP.has(id)) {
      droppedAliases++;
      continue;
    }
    if (EXCLUDED.has(id)) {
      excluded++;
      continue;
    }

    const sourcePath = findSourceImage(id);
    const outputPath = join(IMAGES_DIR, `${id}.webp`);

    await sharp(sourcePath)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 75 })
      .toFile(outputPath);

    manifest.push({
      id,
      label,
      imagePath: `/hero-dso/images/${id}.webp`,
      credit: collapseWhitespace(artist),
      attributionRequired: Boolean(attributionRequired),
      license: licenseShortName,
      licenseUrl: licenseUrl ?? null,
      sourceUrl: imageDescriptionUrl,
    });
  }

  manifest.sort((a, b) => a.id.localeCompare(b.id));
  writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + "\n");

  console.log(`Hero DSO manifest built: ${manifest.length} objects`);
  console.log(
    `  - ${droppedAliases} dropped as Messier/NGC catalog-alias duplicates`,
  );
  console.log(
    `  - ${excluded} excluded (known image-collision bug, see EXCLUDED)`,
  );
  console.log(`  -> ${MANIFEST_PATH}`);
  console.log(`  -> ${IMAGES_DIR} (${manifest.length} .webp files)`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
