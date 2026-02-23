/**
 * Parse simplified Hipparcos catalog (hip2000 format) to JSON
 * Columns: [HIP_ID, designation, mag, var, RA_deg, Dec_deg, spectral, pmRA, pmDec, parallax, Vmag, BVmag, ...]
 *
 * Note: Columns 9-11 appear to be proper motion components or XYZ coords - need to verify
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface HipparcosSimpleStar {
  id: number;
  ra: number;        // Right Ascension (degrees)
  dec: number;       // Declination (degrees)
  mag: number;       // Visual magnitude
  x: number;         // Cartesian X
  y: number;         // Cartesian Y
  z: number;         // Cartesian Z
  spect?: string;    // Spectral type
}

/**
 * Convert equatorial to Cartesian (RA/Dec/Distance → X/Y/Z)
 */
function equatorialToCartesian(ra: number, dec: number, dist: number = 10): [number, number, number] {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  const x = dist * Math.cos(decRad) * Math.cos(raRad);
  const y = dist * Math.cos(decRad) * Math.sin(raRad);
  const z = dist * Math.sin(decRad);

  return [x, y, z];
}

async function parseHipparcosSimple(jsPath: string, maxMagnitude: number = 7.0): Promise<HipparcosSimpleStar[]> {
  console.log(`📖 Reading Hipparcos simplified catalog: ${jsPath}`);

  const content = await fs.readFile(jsPath, 'utf-8');

  // Extract the array content (remove variable assignment and trailing comment)
  let arrayContent = content
    .replace('hipparcos_catalog=', '')
    .replace(/\/\/.*$/gm, '')  // Remove comments
    .trim();

  // Parse as JSON array
  const rows: any[][] = eval(arrayContent);

  console.log(`📊 Total rows: ${rows.length.toLocaleString()}`);
  console.log(`🔍 Filtering stars brighter than magnitude ${maxMagnitude}`);

  const stars: HipparcosSimpleStar[] = [];
  let skipped = 0;

  for (const row of rows) {
    const id = row[0];
    const mag = row[2];
    const ra = row[4];
    const dec = row[5];
    const spect = row[6];

    // Skip if too dim or invalid
    if (mag > maxMagnitude || isNaN(ra) || isNaN(dec)) {
      skipped++;
      continue;
    }

    // Convert to Cartesian (assume distance = 10 parsecs for uniform sphere)
    const [x, y, z] = equatorialToCartesian(ra, dec, 10);

    stars.push({
      id,
      ra,
      dec,
      mag,
      x,
      y,
      z,
      spect: spect || undefined,
    });
  }

  console.log(`✅ Parsed ${stars.length.toLocaleString()} stars`);
  console.log(`⏭️  Skipped ${skipped.toLocaleString()} stars (too dim or invalid)`);

  // Sort by magnitude (brightest first)
  stars.sort((a, b) => a.mag - b.mag);

  return stars;
}

async function main() {
  const inputPath = path.join(__dirname, '../../data_raw/hipparcos_6.5.js');
  const outputPath = path.join(__dirname, '../../public/data/hipparcos-simple.json');

  try {
    const stars = await parseHipparcosSimple(inputPath, 7.0);

    // Save to JSON
    await fs.writeFile(outputPath, JSON.stringify(stars, null, 2));

    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log(`📦 File size: ${(await fs.stat(outputPath)).size / 1024 / 1024} MB`);
    console.log(`⭐ Brightest star: ${stars[0].id} (mag ${stars[0].mag})`);

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
