/**
 * Parse HYG star catalog and convert to optimized JSON
 * Filters to brightest stars and converts equatorial → Cartesian coordinates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//=============================================================================
// COORDINATE CONVERSION UTILITIES
//=============================================================================

/**
 * Convert equatorial coordinates (RA, Dec, Distance) to Cartesian (x, y, z)
 *
 * @param ra - Right Ascension in decimal degrees (0-360)
 * @param dec - Declination in decimal degrees (-90 to +90)
 * @param dist - Distance in parsecs
 * @returns Cartesian coordinates [x, y, z]
 */
function equatorialToCartesian(ra: number, dec: number, dist: number): [number, number, number] {
  // Convert degrees to radians
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;

  // Spherical → Cartesian conversion
  // Standard astronomical coordinate system:
  // - X points toward vernal equinox (RA=0, Dec=0)
  // - Y points toward RA=90°, Dec=0
  // - Z points toward north celestial pole (Dec=90°)
  const x = dist * Math.cos(decRad) * Math.cos(raRad);
  const y = dist * Math.cos(decRad) * Math.sin(raRad);
  const z = dist * Math.sin(decRad);

  return [x, y, z];
}

/**
 * Map spectral type to approximate color temperature
 * Used for rendering star colors
 */
function spectralTypeToColor(spect: string): string {
  if (!spect) return 'white';

  const type = spect.charAt(0).toUpperCase();

  const colorMap: Record<string, string> = {
    'O': 'blue',      // O-type: Very hot, blue stars (>30,000 K)
    'B': 'lightblue', // B-type: Hot, blue-white stars (10,000-30,000 K)
    'A': 'white',     // A-type: White stars (7,500-10,000 K)
    'F': 'yellow',    // F-type: Yellow-white stars (6,000-7,500 K)
    'G': 'orange',    // G-type: Yellow stars like Sun (5,200-6,000 K)
    'K': 'darkorange',// K-type: Orange stars (3,700-5,200 K)
    'M': 'red',       // M-type: Red stars (2,400-3,700 K)
  };

  return colorMap[type] || 'white';
}

//=============================================================================
// HYG PARSER
//=============================================================================

interface HYGStar {
  id: number;
  hip?: number;          // Hipparcos catalog number
  proper?: string;       // Proper name (e.g., "Sirius", "Betelgeuse")
  ra: number;            // Right Ascension (degrees)
  dec: number;           // Declination (degrees)
  dist: number;          // Distance (parsecs)
  mag: number;           // Apparent magnitude (brightness)
  absmag?: number;       // Absolute magnitude
  spect?: string;        // Spectral type (O, B, A, F, G, K, M)
  x: number;             // Cartesian X
  y: number;             // Cartesian Y
  z: number;             // Cartesian Z
  color?: string;        // Color hint for rendering
  lum?: number;          // Luminosity (solar units)
  bayer?: string;        // Bayer designation (e.g., "α Ori" for Betelgeuse)
  con?: string;          // Constellation abbreviation
}

async function parseHYG(csvPath: string, maxMagnitude: number = 8.0): Promise<HYGStar[]> {
  console.log(`📖 Reading HYG catalog: ${csvPath}`);

  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(',');

  console.log(`📊 Total rows: ${lines.length.toLocaleString()}`);
  console.log(`🔍 Filtering stars brighter than magnitude ${maxMagnitude}`);

  const stars: HYGStar[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');

    // Parse key fields
    const id = parseInt(values[0]);
    const ra = parseFloat(values[7]);   // Right Ascension (degrees)
    const dec = parseFloat(values[8]);  // Declination (degrees)
    const dist = parseFloat(values[9]); // Distance (parsecs)
    const mag = parseFloat(values[13]); // Apparent magnitude

    // Skip if invalid or too dim
    if (isNaN(mag) || mag > maxMagnitude) {
      skipped++;
      continue;
    }

    if (isNaN(ra) || isNaN(dec) || isNaN(dist) || dist <= 0) {
      skipped++;
      continue;
    }

    // Convert to Cartesian coordinates
    const [x, y, z] = equatorialToCartesian(ra, dec, dist);

    // Parse optional fields
    const hip = values[1] ? parseInt(values[1]) : undefined;
    const proper = values[6] || undefined;
    const absmag = parseFloat(values[14]);
    const spect = values[15] || undefined;
    const lum = parseFloat(values[33]);
    const bayer = values[27] || undefined;
    const con = values[29] || undefined;

    const star: HYGStar = {
      id,
      hip,
      proper,
      ra,
      dec,
      dist,
      mag,
      absmag: isNaN(absmag) ? undefined : absmag,
      spect,
      x,
      y,
      z,
      color: spectralTypeToColor(spect || ''),
      lum: isNaN(lum) ? undefined : lum,
      bayer,
      con,
    };

    stars.push(star);

    // Progress indicator (every 10k stars)
    if (stars.length % 10000 === 0) {
      process.stdout.write(`\r✨ Parsed: ${stars.length.toLocaleString()} stars`);
    }
  }

  console.log(`\r✅ Parsed: ${stars.length.toLocaleString()} stars (skipped ${skipped.toLocaleString()} dim/invalid)`);

  return stars;
}

//=============================================================================
// MAIN
//=============================================================================

async function main() {
  console.log('🌟 HYG Star Catalog Parser\n');

  const hygCsv = path.join(__dirname, 'hygdata_v3.csv');
  const outputJson = path.join(__dirname, '../../public/data/hyg-stars.json');

  // Create output directory
  const outputDir = path.dirname(outputJson);
  await fs.mkdir(outputDir, { recursive: true });

  // Parse stars (filter to mag < 8.0 for ~20,000 visible stars)
  const stars = await parseHYG(hygCsv, 8.0);

  // Sort by brightness (brighter stars first)
  stars.sort((a, b) => a.mag - b.mag);

  // Display stats
  console.log('\n📊 Statistics:');
  console.log(`   Total stars: ${stars.length.toLocaleString()}`);
  console.log(`   Brightest star: ${stars[0].proper || stars[0].id} (mag ${stars[0].mag.toFixed(2)})`);
  console.log(`   Dimmest star: mag ${stars[stars.length - 1].mag.toFixed(2)}`);

  // Count stars by spectral type
  const spectralCounts: Record<string, number> = {};
  stars.forEach(s => {
    const type = s.spect?.charAt(0) || 'Unknown';
    spectralCounts[type] = (spectralCounts[type] || 0) + 1;
  });
  console.log('\n🌈 Spectral Type Distribution:');
  Object.entries(spectralCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pct = ((count / stars.length) * 100).toFixed(1);
      console.log(`   ${type}: ${count.toLocaleString()} (${pct}%)`);
    });

  // Save to JSON
  console.log(`\n💾 Saving to: ${outputJson}`);
  await fs.writeFile(outputJson, JSON.stringify(stars, null, 2), 'utf-8');

  const stats = await fs.stat(outputJson);
  console.log(`✅ Saved: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n🎉 Done!\n');
}

main().catch(console.error);
