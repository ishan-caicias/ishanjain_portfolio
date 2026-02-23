/**
 * Load Gaia galaxy catalog data
 */

export interface GaiaGalaxy {
  names: string[];
  appMag: number;
  sizePc: number;
  ra: number;
  dec: number;
  distance: number;
  x: number;
  y: number;
  z: number;
}

let galaxyCache: GaiaGalaxy[] | null = null;

export async function loadGaiaGalaxies(): Promise<GaiaGalaxy[]> {
  if (galaxyCache) {
    return galaxyCache;
  }

  const response = await fetch('/data/gaia-galaxies.json');
  const galaxies = await response.json() as GaiaGalaxy[];
  galaxyCache = galaxies;
  return galaxies;
}

/**
 * Scale galaxy positions to fit within a sphere radius
 */
export function scaleGalaxyPositions(galaxies: GaiaGalaxy[], targetRadius: number): GaiaGalaxy[] {
  // Normalize each galaxy to unit sphere, then scale to target radius
  return galaxies.map(g => {
    const dist = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z);
    const scale = dist > 0 ? targetRadius / dist : 1;

    return {
      ...g,
      x: g.x * scale,
      y: g.y * scale,
      z: g.z * scale,
    };
  });
}

/**
 * Get primary name for galaxy
 */
export function getGalaxyName(galaxy: GaiaGalaxy): string {
  return galaxy.names[0] || 'Unknown Galaxy';
}
