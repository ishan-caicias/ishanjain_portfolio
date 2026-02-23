/**
 * Load and cache real astronomy data (HYG stars + OpenNGC DSOs)
 * Provides utilities for loading parsed catalogs from JSON files
 */

export interface HYGStar {
  id: number;
  hip?: number;
  proper?: string;
  ra: number;
  dec: number;
  dist: number;
  mag: number;
  absmag?: number;
  spect?: string;
  x: number;
  y: number;
  z: number;
  color?: string;
  lum?: number;
  bayer?: string;
  con?: string;
}

export interface OpenNGCObject {
  name: string;
  type: string;
  ra: number;
  dec: number;
  const: string;
  majAx?: number;
  minAx?: number;
  posAng?: number;
  vMag?: number;
  surfBr?: number;
  hubble?: string;
  commonNames?: string;
  x: number;
  y: number;
  z: number;
  messier?: string;
}

// Cache for loaded data
let hygStarsCache: HYGStar[] | null = null;
let openNGCCache: OpenNGCObject[] | null = null;

/**
 * Load HYG star catalog (41,475 stars)
 */
export async function loadHYGStars(): Promise<HYGStar[]> {
  if (hygStarsCache) {
    return hygStarsCache;
  }

  console.log('🌟 Loading HYG star catalog...');
  const response = await fetch('/data/hyg-stars.json');
  if (!response.ok) {
    throw new Error(`Failed to load HYG stars: ${response.statusText}`);
  }

  const stars = await response.json() as HYGStar[];
  hygStarsCache = stars;
  console.log(`✅ Loaded ${stars.length.toLocaleString()} real stars`);

  return stars;
}

/**
 * Load OpenNGC deep sky object catalog (11,340 DSOs)
 */
export async function loadOpenNGC(): Promise<OpenNGCObject[]> {
  if (openNGCCache) {
    return openNGCCache;
  }

  console.log('🌌 Loading OpenNGC DSO catalog...');
  const response = await fetch('/data/openngc-dsos.json');
  if (!response.ok) {
    throw new Error(`Failed to load OpenNGC: ${response.statusText}`);
  }

  const dsos = await response.json() as OpenNGCObject[];
  openNGCCache = dsos;
  console.log(`✅ Loaded ${dsos.length.toLocaleString()} real DSOs`);

  return dsos;
}

/**
 * Filter stars by magnitude for performance
 */
export function filterStarsByMagnitude(stars: HYGStar[], maxMag: number): HYGStar[] {
  return stars.filter(s => s.mag <= maxMag);
}

/**
 * Get brightest N stars
 */
export function getBrightestStars(stars: HYGStar[], count: number): HYGStar[] {
  return stars.slice(0, count); // Already sorted by magnitude in parser
}

/**
 * Find star by name (case-insensitive)
 */
export function findStarByName(stars: HYGStar[], name: string): HYGStar | undefined {
  const lowerName = name.toLowerCase();
  return stars.find(s => s.proper?.toLowerCase() === lowerName);
}

/**
 * Find DSO by name or catalog number
 */
export function findDSOByName(dsos: OpenNGCObject[], name: string): OpenNGCObject | undefined {
  const upperName = name.toUpperCase();
  return dsos.find(d =>
    d.name.toUpperCase() === upperName ||
    d.messier?.toUpperCase() === upperName ||
    d.commonNames?.toUpperCase().includes(upperName)
  );
}

/**
 * Get Messier objects only
 */
export function getMessierObjects(dsos: OpenNGCObject[]): OpenNGCObject[] {
  return dsos.filter(d => d.messier);
}

/**
 * Scale star positions to fit within a sphere radius
 * (HYG uses parsecs, we need to scale for Three.js viewing)
 *
 * IMPORTANT: We normalize stars to a UNIT SPHERE first, then scale uniformly.
 * This preserves the sky distribution without clustering.
 */
export function scaleStarPositions(stars: HYGStar[], targetRadius: number): HYGStar[] {
  // Normalize each star to unit sphere (distance = 1), preserving direction
  // This makes all stars equidistant from center, showing only sky distribution
  return stars.map(s => {
    const dist = Math.sqrt(s.x * s.x + s.y * s.y + s.z * s.z);
    const scale = dist > 0 ? targetRadius / dist : 1;

    return {
      ...s,
      x: s.x * scale,
      y: s.y * scale,
      z: s.z * scale,
    };
  });
}

/**
 * Scale DSO positions to fit within a sphere radius
 */
export function scaleDSOPositions(dsos: OpenNGCObject[], targetRadius: number): OpenNGCObject[] {
  const maxDist = Math.max(...dsos.map(d =>
    Math.sqrt(d.x * d.x + d.y * d.y + d.z * d.z)
  ));

  const scaleFactor = targetRadius / maxDist;

  return dsos.map(d => ({
    ...d,
    x: d.x * scaleFactor,
    y: d.y * scaleFactor,
    z: d.z * scaleFactor,
  }));
}
