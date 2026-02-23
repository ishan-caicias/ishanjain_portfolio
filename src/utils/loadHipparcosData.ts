/**
 * Load Hipparcos simplified star catalog
 */

export interface HipparcosStar {
  id: number;
  ra: number;        // Right Ascension (degrees)
  dec: number;       // Declination (degrees)
  mag: number;       // Visual magnitude
  x: number;         // Cartesian X
  y: number;         // Cartesian Y
  z: number;         // Cartesian Z
  spect?: string;    // Spectral type
}

let hipparcosCache: HipparcosStar[] | null = null;

export async function loadHipparcosStars(): Promise<HipparcosStar[]> {
  if (hipparcosCache) {
    return hipparcosCache;
  }

  const response = await fetch('/data/hipparcos-simple.json');
  const stars = await response.json() as HipparcosStar[];
  hipparcosCache = stars;
  return stars;
}

/**
 * Scale star positions to fit within a sphere radius
 */
export function scaleHipparcosPositions(stars: HipparcosStar[], targetRadius: number): HipparcosStar[] {
  // Normalize each star to unit sphere (distance = 1), then scale to target radius
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
