/**
 * NASA Image & Video Library API Integration Types
 * Phase 3: Golden Stars Easter Egg
 */

/**
 * Represents a NASA target for the golden stars easter egg
 */
export interface NasaTarget {
  /** Unique identifier (e.g., "pillars-of-creation") */
  id: string;

  /** Display name shown in modal (e.g., "Pillars of Creation") */
  label: string;

  /** Modal subtitle/caption (e.g., "Star-forming region in Eagle Nebula") */
  caption: string;

  /** Target category for organization */
  category: "nebula" | "galaxy" | "planet" | "cheeky";

  /** Search terms for NASA API query */
  searchTerms: string[];

  /**
   * Rarity weight for weighted random selection
   * 1 = very rare (cheeky targets)
   * 2-3 = rare
   * 4-6 = uncommon
   * 7-10 = common
   */
  rarityWeight: number;
}

/**
 * Search result from NASA Image & Video Library API
 */
export interface NasaSearchResult {
  /** Image title from NASA */
  title: string;

  /** NASA unique identifier */
  nasaId: string;

  /** Thumbnail URL */
  thumbUrl: string;

  /** Page URL on images.nasa.gov */
  pageUrl: string;

  /** Optional description */
  description?: string;
}

/**
 * Cached NASA data structure for localStorage
 */
export interface CachedNasaData {
  /** Target ID for this cached data */
  targetId: string;

  /** Array of search results */
  results: NasaSearchResult[];

  /** Unix timestamp when cached */
  timestamp: number;
}

/**
 * Event detail for star click events
 * Supports both NASA targets and legacy Hubble stars
 */
export interface StarClickEvent {
  /** NASA target ID (undefined for legacy Hubble) */
  targetId?: string;

  /** true = Hubble legacy star, false = NASA target */
  isLegacy: boolean;

  /** Index in Hubble data array (only for legacy stars) */
  hubbleIndex?: number;
}

/**
 * Raw NASA API response structure (partial)
 */
export interface NasaApiResponse {
  collection: {
    items: Array<{
      data: Array<{
        title: string;
        description?: string;
        nasa_id: string;
        date_created?: string;
        center?: string;
      }>;
      links?: Array<{
        href: string;
        rel: string;
        render?: string;
      }>;
    }>;
    metadata?: {
      total_hits: number;
    };
  };
}
