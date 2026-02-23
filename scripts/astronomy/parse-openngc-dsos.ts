/**
 * Parse OpenNGC deep sky object catalog and convert to optimized JSON
 * Filters to prominent DSOs and converts equatorial → Cartesian coordinates
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

//=============================================================================
// COORDINATE CONVERSION (same as HYG parser)
//=============================================================================

function equatorialToCartesian(ra: number, dec: number, dist: number): [number, number, number] {
  const raRad = (ra * Math.PI) / 180;
  const decRad = (dec * Math.PI) / 180;
  const x = dist * Math.cos(decRad) * Math.cos(raRad);
  const y = dist * Math.cos(decRad) * Math.sin(raRad);
  const z = dist * Math.sin(decRad);
  return [x, y, z];
}

/**
 * Parse sexagesimal format (HH:MM:SS.SS) to decimal degrees
 */
function sexagesimalToDecimal(sex: string, isRA: boolean = false): number {
  const parts = sex.split(':').map(s => parseFloat(s));
  if (parts.length !== 3) return NaN;

  const [h, m, s] = parts;
  let decimal = Math.abs(h) + m / 60 + s / 3600;

  // RA is in hours (0-24), convert to degrees (0-360)
  if (isRA) {
    decimal *= 15; // 1 hour = 15 degrees
  }

  // Handle negative declinations
  if (h < 0 || sex.startsWith('-')) {
    decimal = -decimal;
  }

  return decimal;
}

//=============================================================================
// OPENNGC PARSER
//=============================================================================

interface OpenNGCObject {
  name: string;          // NGC/IC/M designation (e.g., "NGC 224", "M31")
  type: string;          // G=Galaxy, Nb=Nebula, OCl=Open Cluster, etc.
  ra: number;            // Right Ascension (degrees)
  dec: number;           // Declination (degrees)
  const: string;         // Constellation
  majAx?: number;        // Major axis (arcminutes)
  minAx?: number;        // Minor axis (arcminutes)
  posAng?: number;       // Position angle (degrees)
  vMag?: number;         // Visual magnitude
  surfBr?: number;       // Surface brightness
  hubble?: string;       // Hubble classification (Sa, Sb, E0, Irr, etc.)
  commonNames?: string;  // Common names (e.g., "Andromeda Galaxy")
  x: number;             // Cartesian X
  y: number;             // Cartesian Y
  z: number;             // Cartesian Z
  messier?: string;      // Messier number if applicable
}

async function parseOpenNGC(
  csvPath: string,
  maxMagnitude: number = 14.0,
  minSize: number = 0.5  // arcminutes
): Promise<OpenNGCObject[]> {
  console.log(`📖 Reading OpenNGC catalog: ${csvPath}`);

  const content = await fs.readFile(csvPath, 'utf-8');
  const lines = content.split('\n');
  const headers = lines[0].split(';');

  console.log(`📊 Total rows: ${lines.length.toLocaleString()}`);
  console.log(`🔍 Filtering objects brighter than mag ${maxMagnitude}`);
  console.log(`📏 Filtering objects larger than ${minSize} arcmin`);

  const objects: OpenNGCObject[] = [];
  let skipped = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(';');

    // Parse key fields (OpenNGC uses semicolon delimiter)
    const name = values[0];
    const type = values[1];
    const raStr = values[2];     // Format: "HH:MM:SS.SS"
    const decStr = values[3];    // Format: "+DD:MM:SS.S"
    const constAbbr = values[4];
    const majAxStr = values[5];  // Major axis (arcminutes)
    const minAxStr = values[6];  // Minor axis (arcminutes)
    const posAngStr = values[7]; // Position angle
    const vMagStr = values[9];   // V-band magnitude
    const surfBrStr = values[13];// Surface brightness
    const hubble = values[14];   // Hubble type
    const messier = values[23];  // Messier designation
    const commonNames = values[28]; // Common names

    // Convert RA/Dec from sexagesimal to decimal
    const ra = sexagesimalToDecimal(raStr, true);
    const dec = sexagesimalToDecimal(decStr, false);

    if (isNaN(ra) || isNaN(dec)) {
      skipped++;
      continue;
    }

    // Parse numeric fields
    const majAx = majAxStr ? parseFloat(majAxStr) : undefined;
    const minAx = minAxStr ? parseFloat(minAxStr) : undefined;
    const posAng = posAngStr ? parseFloat(posAngStr) : undefined;
    const vMag = vMagStr ? parseFloat(vMagStr) : undefined;
    const surfBr = surfBrStr ? parseFloat(surfBrStr) : undefined;

    // Filter by magnitude and size (only keep prominent objects)
    const hasValidSize = majAx && majAx >= minSize;
    const hasValidMag = vMag && vMag <= maxMagnitude;

    // Keep if either bright OR large (or both)
    if (!hasValidSize && !hasValidMag) {
      skipped++;
      continue;
    }

    // Estimate distance (rough approximation for positioning)
    // Use a default distance based on object type
    let estimatedDist = 100; // parsecs (default)
    if (type === 'G') estimatedDist = 1000; // Galaxies are farther
    if (type === 'Nb') estimatedDist = 500; // Nebulae are mid-range
    if (type.includes('Cl')) estimatedDist = 300; // Clusters are closer

    // Convert to Cartesian
    const [x, y, z] = equatorialToCartesian(ra, dec, estimatedDist);

    const obj: OpenNGCObject = {
      name,
      type,
      ra,
      dec,
      const: constAbbr,
      majAx,
      minAx,
      posAng,
      vMag,
      surfBr,
      hubble,
      commonNames: commonNames || undefined,
      x,
      y,
      z,
      messier: messier || undefined,
    };

    objects.push(obj);

    // Progress indicator
    if (objects.length % 500 === 0) {
      process.stdout.write(`\r🌌 Parsed: ${objects.length.toLocaleString()} DSOs`);
    }
  }

  console.log(`\r✅ Parsed: ${objects.length.toLocaleString()} DSOs (skipped ${skipped.toLocaleString()} small/dim)`);

  return objects;
}

//=============================================================================
// MAIN
//=============================================================================

async function main() {
  console.log('🌌 OpenNGC Deep Sky Object Catalog Parser\n');

  const ngcCsv = path.join(__dirname, 'NGC.csv');
  const outputJson = path.join(__dirname, '../../public/data/openngc-dsos.json');

  // Create output directory
  const outputDir = path.dirname(outputJson);
  await fs.mkdir(outputDir, { recursive: true });

  // Parse DSOs (filter to mag < 14 OR size > 0.5 arcmin)
  const dsos = await parseOpenNGC(ngcCsv, 14.0, 0.5);

  // Sort by brightness (brighter first)
  dsos.sort((a, b) => (a.vMag || 99) - (b.vMag || 99));

  // Display stats
  console.log('\n📊 Statistics:');
  console.log(`   Total DSOs: ${dsos.length.toLocaleString()}`);

  const withMag = dsos.filter(d => d.vMag !== undefined);
  if (withMag.length > 0) {
    console.log(`   Brightest: ${dsos[0].name} (${dsos[0].commonNames || 'unnamed'}) mag ${dsos[0].vMag?.toFixed(2)}`);
  }

  // Count by type
  const typeCounts: Record<string, number> = {};
  dsos.forEach(d => {
    const typeKey = d.type || 'Unknown';
    typeCounts[typeKey] = (typeCounts[typeKey] || 0) + 1;
  });

  console.log('\n🌈 Object Type Distribution:');
  Object.entries(typeCounts)
    .sort((a, b) => b[1] - a[1])
    .forEach(([type, count]) => {
      const pct = ((count / dsos.length) * 100).toFixed(1);
      const typeLabels: Record<string, string> = {
        'G': 'Galaxy',
        'Nb': 'Nebula',
        'OCl': 'Open Cluster',
        'GCl': 'Globular Cluster',
        'PN': 'Planetary Nebula',
        'SNR': 'Supernova Remnant',
        'HII': 'HII Region',
        'Ast': 'Asterism',
        '**': 'Double Star',
        '*': 'Star',
      };
      const label = typeLabels[type] || type;
      console.log(`   ${label}: ${count.toLocaleString()} (${pct}%)`);
    });

  // Count Messier objects
  const messierCount = dsos.filter(d => d.messier).length;
  console.log(`\n⭐ Messier Objects: ${messierCount}`);

  // Save to JSON
  console.log(`\n💾 Saving to: ${outputJson}`);
  await fs.writeFile(outputJson, JSON.stringify(dsos, null, 2), 'utf-8');

  const stats = await fs.stat(outputJson);
  console.log(`✅ Saved: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  console.log('\n🎉 Done!\n');
}

main().catch(console.error);
