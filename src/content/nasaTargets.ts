/**
 * NASA Image & Video Library Targets
 * Phase 3: Golden Stars Easter Egg
 *
 * 24 curated celestial targets with weighted random selection
 * Targets refresh daily using deterministic seeded random
 */

import type { NasaTarget } from "@/types/nasa";

/**
 * All available NASA targets for golden stars
 * Distribution: 9 nebulae, 6 galaxies, 6 planets, 3 cheeky targets
 */
export const nasaTargets: NasaTarget[] = [
  // === NEBULAE (9 targets) ===
  {
    id: "pillars-of-creation",
    label: "Pillars of Creation",
    caption: "Star-forming region in the Eagle Nebula",
    category: "nebula",
    searchTerms: ["pillars of creation", "eagle nebula", "M16"],
    rarityWeight: 9, // Common
  },
  {
    id: "carina-nebula",
    label: "Carina Nebula",
    caption: "Stellar nursery in the southern sky",
    category: "nebula",
    searchTerms: ["carina nebula", "eta carinae"],
    rarityWeight: 8, // Common
  },
  {
    id: "orion-nebula",
    label: "Orion Nebula",
    caption: "Closest massive star-forming region to Earth",
    category: "nebula",
    searchTerms: ["orion nebula", "M42"],
    rarityWeight: 8, // Common
  },
  {
    id: "eagle-nebula",
    label: "Eagle Nebula",
    caption: "Home of the famous Pillars of Creation",
    category: "nebula",
    searchTerms: ["eagle nebula", "M16", "star formation"],
    rarityWeight: 7, // Common
  },
  {
    id: "horsehead-nebula",
    label: "Horsehead Nebula",
    caption: "Dark nebula in the constellation Orion",
    category: "nebula",
    searchTerms: ["horsehead nebula", "barnard 33"],
    rarityWeight: 7, // Common
  },
  {
    id: "tarantula-nebula",
    label: "Tarantula Nebula",
    caption: "Largest star-forming region in the Local Group",
    category: "nebula",
    searchTerms: ["tarantula nebula", "30 doradus"],
    rarityWeight: 7, // Common
  },
  {
    id: "butterfly-nebula",
    label: "Butterfly Nebula",
    caption: "Planetary nebula with butterfly-like structure",
    category: "nebula",
    searchTerms: ["butterfly nebula", "NGC 6302", "bug nebula"],
    rarityWeight: 5, // Uncommon
  },
  {
    id: "cat-eye-nebula",
    label: "Cat's Eye Nebula",
    caption: "Complex planetary nebula with intricate shells",
    category: "nebula",
    searchTerms: ["cats eye nebula", "NGC 6543"],
    rarityWeight: 5, // Uncommon
  },
  {
    id: "hubble-deep-field",
    label: "Hubble Deep Field",
    caption: "Deepest visible-light image of the universe",
    category: "nebula",
    searchTerms: ["hubble deep field", "ultra deep field", "galaxies"],
    rarityWeight: 2, // RARE
  },

  // === GALAXIES (6 targets) ===
  {
    id: "andromeda-galaxy",
    label: "Andromeda Galaxy",
    caption: "Nearest major galaxy to the Milky Way",
    category: "galaxy",
    searchTerms: ["andromeda galaxy", "M31"],
    rarityWeight: 9, // Common
  },
  {
    id: "whirlpool-galaxy",
    label: "Whirlpool Galaxy",
    caption: "Classic spiral galaxy with prominent arms",
    category: "galaxy",
    searchTerms: ["whirlpool galaxy", "M51"],
    rarityWeight: 8, // Common
  },
  {
    id: "sombrero-galaxy",
    label: "Sombrero Galaxy",
    caption: "Spiral galaxy with prominent dust lane",
    category: "galaxy",
    searchTerms: ["sombrero galaxy", "M104"],
    rarityWeight: 7, // Common
  },
  {
    id: "pinwheel-galaxy",
    label: "Pinwheel Galaxy",
    caption: "Face-on spiral galaxy in Ursa Major",
    category: "galaxy",
    searchTerms: ["pinwheel galaxy", "M101"],
    rarityWeight: 6, // Uncommon
  },
  {
    id: "cartwheel-galaxy",
    label: "Cartwheel Galaxy",
    caption: "Ring galaxy shaped by cosmic collision",
    category: "galaxy",
    searchTerms: ["cartwheel galaxy", "ring galaxy"],
    rarityWeight: 5, // Uncommon
  },
  {
    id: "stephans-quintet",
    label: "Stephan's Quintet",
    caption: "Five galaxies locked in cosmic dance",
    category: "galaxy",
    searchTerms: ["stephans quintet", "hickson compact group"],
    rarityWeight: 2, // RARE
  },

  // === PLANETS (6 targets) ===
  {
    id: "jupiter-great-red-spot",
    label: "Jupiter's Great Red Spot",
    caption: "Massive storm larger than Earth",
    category: "planet",
    searchTerms: ["jupiter", "great red spot", "juno"],
    rarityWeight: 9, // Common
  },
  {
    id: "saturn-rings-cassini",
    label: "Saturn's Rings",
    caption: "Iconic ring system captured by Cassini",
    category: "planet",
    searchTerms: ["saturn rings", "cassini"],
    rarityWeight: 8, // Common
  },
  {
    id: "mars-olympus-mons",
    label: "Olympus Mons",
    caption: "Largest volcano in the solar system",
    category: "planet",
    searchTerms: ["mars", "olympus mons", "volcano"],
    rarityWeight: 7, // Common
  },
  {
    id: "earth-blue-marble",
    label: "Earth - Blue Marble",
    caption: "Iconic view of our home planet",
    category: "planet",
    searchTerms: ["earth", "blue marble", "planet earth"],
    rarityWeight: 7, // Common
  },
  {
    id: "neptune-great-dark-spot",
    label: "Neptune's Great Dark Spot",
    caption: "Massive storm system on Neptune",
    category: "planet",
    searchTerms: ["neptune", "great dark spot", "voyager"],
    rarityWeight: 5, // Uncommon
  },
  {
    id: "venus-surface-radar",
    label: "Venus Surface",
    caption: "Radar-mapped surface beneath thick clouds",
    category: "planet",
    searchTerms: ["venus", "magellan", "surface radar"],
    rarityWeight: 4, // Uncommon
  },

  // === CHEEKY/RARE (3 targets) ===
  {
    id: "black-hole-accretion",
    label: "Black Hole Accretion Disk",
    caption: "Matter spiraling into a black hole",
    category: "cheeky",
    searchTerms: ["black hole", "accretion disk", "supermassive"],
    rarityWeight: 1, // VERY RARE
  },
  {
    id: "galaxy-collision",
    label: "Colliding Galaxies",
    caption: "Cosmic collision creating new stars",
    category: "cheeky",
    searchTerms: ["antennae galaxies", "galaxy collision", "NGC 4038"],
    rarityWeight: 1, // VERY RARE
  },
  {
    id: "gravitational-lens",
    label: "Gravitational Lensing",
    caption: "Space-time warped by massive galaxy cluster",
    category: "cheeky",
    searchTerms: ["gravitational lens", "einstein ring", "galaxy cluster"],
    rarityWeight: 1, // VERY RARE
  },
];

/**
 * Get deterministic daily seed from current date
 * Format: YYYY-MM-DD
 */
export function getDailySeed(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Seeded pseudo-random number generator
 * Uses linear congruential generator (LCG) algorithm
 */
function seedRandom(seed: string): () => number {
  // Hash the seed string to a number
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = ((hash << 5) - hash) + seed.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }

  // LCG: Xn+1 = (a * Xn + c) mod m
  // Using constants from Numerical Recipes
  return function() {
    hash = (hash * 1103515245 + 12345) & 0x7fffffff;
    return hash / 0x7fffffff; // Normalize to [0, 1)
  };
}

/**
 * Select targets using weighted random selection
 * Same seed produces same selection (deterministic)
 *
 * @param seed - Seed string for random number generator (use getDailySeed())
 * @param count - Number of targets to select
 * @returns Array of selected NASA targets
 */
export function selectTargets(seed: string, count: number): NasaTarget[] {
  const rng = seedRandom(seed);
  const selected: NasaTarget[] = [];
  const remaining = [...nasaTargets]; // Clone array

  for (let i = 0; i < count && remaining.length > 0; i++) {
    // Calculate total weight of remaining targets
    const totalWeight = remaining.reduce(
      (sum, target) => sum + target.rarityWeight,
      0,
    );

    // Generate weighted random number
    let random = rng() * totalWeight;

    // Select target using weighted probability
    for (let j = 0; j < remaining.length; j++) {
      random -= remaining[j].rarityWeight;
      if (random <= 0) {
        selected.push(remaining[j]);
        remaining.splice(j, 1); // Remove selected target
        break;
      }
    }
  }

  return selected;
}

/**
 * Get a NASA target by ID
 * @param id - Target ID
 * @returns Target or undefined if not found
 */
export function getTargetById(id: string): NasaTarget | undefined {
  return nasaTargets.find((target) => target.id === id);
}
