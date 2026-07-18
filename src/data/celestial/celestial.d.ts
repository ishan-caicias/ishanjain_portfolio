// Ambient types for the celestial catalog data files (celestial-*.js), which are copied
// verbatim from the prototype and populate these window globals as a side effect of import.
// See docs/delivery-plan/PF-07-space-portfolio-webgl.md §1 for why they weren't hand-converted.

export interface CelestialFigure {
  s: [number, number][]; // [ra, dec] star positions
  l: [number, number][]; // [starIndexA, starIndexB] line segments
}

export interface CelestialEntry {
  id: string;
  n: string; // name
  d: string; // designation/subtitle
  t: string; // type
  r: string; // rarity
  ra: number;
  dec: number;
  ly: number | null;
  mg: string; // magnitude, display string
  sp: string; // spectral class / description
  img: string | null; // relative path under assets/
  crd?: string | null; // image credit
  c: string; // hex color
  con: string | null; // constellation
  st: [string, string, number][]; // [label, value, barPct]
  f: string; // field note / fun fact
  lo: [string, string][] | null; // [culture, text] sky-lore entries
  fig?: CelestialFigure;
}

declare global {
  interface Window {
    CELESTIAL?: CelestialEntry[];
    CELESTIAL_BASE?: CelestialEntry[];
    CELESTIAL_BASE_DONE?: boolean;
    CELESTIAL_EXTRA_DONE?: boolean;
    CELESTIAL_COMPLETE?: boolean;
    CELESTIAL_GAIA_COUNT?: number;
    CELESTIAL_IMGMAP?: Record<string, [string, string]>;
  }
}
