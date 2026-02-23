/**
 * Parse Gaia NBG (Near Galaxy Catalog) to simplified JSON
 * Input: C:\dev\gaia_datasets\catalog-nbg\particles-nbg.json
 * Output: public/data/gaia-galaxies.json
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface GaiaGalaxy {
  names: string[];
  appMag: number;
  sizePc: number;
  ra: number;      // Right ascension (degrees)
  dec: number;     // Declination (degrees)
  distance: number; // Distance (parsecs)
  x: number;       // Cartesian X
  y: number;       // Cartesian Y
  z: number;       // Cartesian Z
}

/**
 * Convert equatorial to Cartesian (RA/Dec/Distance → X/Y/Z)
 */
function equatorialToCartesian(ra: number, dec: number, dist: number): [number, number, number] {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  const x = dist * Math.cos(decRad) * Math.cos(raRad);
  const y = dist * Math.cos(decRad) * Math.sin(raRad);
  const z = dist * Math.sin(decRad);

  return [x, y, z];
}

async function parseGaiaGalaxies(inputPath: string): Promise<GaiaGalaxy[]> {
  console.log(`📖 Reading Gaia NBG catalog: ${inputPath}`);

  const content = await fs.readFile(inputPath, 'utf-8');
  const data = JSON.parse(content);

  const galaxies: GaiaGalaxy[] = [];

  for (const obj of data.objects) {
    // Skip the hook object
    if (obj.name === 'nbg-hook') continue;

    // Extract coordinates
    const coords = obj.coordinates;
    if (!coords || !coords.equatorial) continue;

    const [ra, dec, distance] = coords.equatorial;

    // Convert to Cartesian
    const [x, y, z] = equatorialToCartesian(ra, dec, distance);

    galaxies.push({
      names: obj.names || [],
      appMag: obj.appMag || 99,
      sizePc: obj.sizePc || 1000,
      ra,
      dec,
      distance,
      x,
      y,
      z,
    });
  }

  console.log(`✅ Parsed ${galaxies.length} galaxies`);

  // Sort by magnitude (brightest first)
  galaxies.sort((a, b) => a.appMag - b.appMag);

  return galaxies;
}

async function main() {
  const inputPath = path.join('C:', 'dev', 'gaia_datasets', 'catalog-nbg', 'particles-nbg.json');
  const outputPath = path.join(__dirname, '../../public/data/gaia-galaxies.json');

  try {
    const galaxies = await parseGaiaGalaxies(inputPath);

    // Save to JSON
    await fs.writeFile(outputPath, JSON.stringify(galaxies, null, 2));

    console.log(`\n💾 Saved to: ${outputPath}`);
    console.log(`📦 File size: ${((await fs.stat(outputPath)).size / 1024).toFixed(1)} KB`);
    console.log(`⭐ Brightest galaxy: ${galaxies[0].names[0]} (mag ${galaxies[0].appMag})`);

    console.log('\n✨ Done!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

main();
