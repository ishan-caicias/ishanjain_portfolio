/**
 * NASA Image & Video Library API Client
 * Phase 3: Golden Stars Easter Egg
 *
 * Fetches imagery from NASA's public API with localStorage caching
 * Fallback to Hubble data on failure
 */

import type {
  NasaSearchResult,
  CachedNasaData,
  NasaApiResponse,
} from "@/types/nasa";

// Cache configuration
const CACHE_PREFIX = "nasa-cache-";
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// NASA API endpoint
const NASA_API_BASE = "https://images-api.nasa.gov";

/**
 * Search NASA Image & Video Library for a target
 *
 * @param targetId - Target ID for cache key
 * @param searchTerms - Array of search terms to query
 * @param maxResults - Maximum number of results to return (default: 3)
 * @returns Array of NASA search results
 */
export async function searchNasaImages(
  targetId: string,
  searchTerms: string[],
  maxResults = 3,
): Promise<NasaSearchResult[]> {
  const cacheKey = `${CACHE_PREFIX}${targetId}`;

  // Check cache first
  const cached = getCachedData(cacheKey);
  if (cached) {
    console.log(`[NASA] Cache hit for ${targetId}`);
    return cached.results;
  }

  // Build query string
  const query = searchTerms.join(" ");
  const params = new URLSearchParams({
    q: query,
    media_type: "image",
    page_size: "20", // Fetch more to get best results
  });

  const apiKey = import.meta.env.PUBLIC_NASA_API_KEY;
  if (apiKey) {
    params.set("api_key", apiKey);
  }

  const url = `${NASA_API_BASE}/search?${params.toString()}`;

  try {
    console.log(`[NASA] Fetching ${targetId} from API...`);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`NASA API returned ${response.status}`);
    }

    const data: NasaApiResponse = await response.json();
    const results = parseNasaResponse(data, maxResults, searchTerms);

    // Cache the results
    if (results.length > 0) {
      setCachedData(cacheKey, {
        targetId,
        results,
        timestamp: Date.now(),
      });
    }

    return results;
  } catch (error) {
    console.error(`[NASA] API fetch failed for ${targetId}:`, error);
    return []; // Return empty array, caller will handle fallback
  }
}

/**
 * Parse NASA API response and extract relevant data with quality scoring
 *
 * @param response - Raw NASA API response
 * @param maxResults - Maximum number of results to extract
 * @param searchTerms - Original search terms for relevance scoring
 * @returns Array of parsed search results, sorted by quality score (deterministic)
 */
export function parseNasaResponse(
  response: NasaApiResponse,
  maxResults: number,
  searchTerms: string[] = [],
): NasaSearchResult[] {
  const items = response.collection?.items || [];
  const scoredResults: Array<{ result: NasaSearchResult; score: number; index: number }> = [];

  // Normalize search terms for matching (lowercase)
  const normalizedTerms = searchTerms.map((t) => t.toLowerCase());

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const data = item.data?.[0];
    const links = item.links || [];

    if (!data || links.length === 0) continue;

    const nasaId = data.nasa_id;
    const title = data.title || "Untitled";
    const description = data.description || "";

    // === QUALITY SCORING ===
    let score = 0;

    // 1. Title keyword matches (most important, +10 per match)
    const titleLower = title.toLowerCase();
    for (const term of normalizedTerms) {
      if (titleLower.includes(term)) {
        score += 10;
      }
    }

    // 2. Description keyword matches (+3 per match)
    const descLower = description.toLowerCase();
    for (const term of normalizedTerms) {
      if (descLower.includes(term)) {
        score += 3;
      }
    }

    // 3. Image size preference (larger images score higher)
    let thumbUrl = links[0].href; // Default to first link

    for (const link of links) {
      // Check for large/original size indicators in URL
      if (link.href.includes("~large") || link.href.includes("~orig")) {
        thumbUrl = link.href;
        score += 5; // Bonus for high-res availability
        break;
      } else if (link.href.includes("~medium")) {
        thumbUrl = link.href;
        score += 2; // Smaller bonus for medium
      }
    }

    // 4. Filter off-topic results (no keyword matches = score 0)
    if (score === 0) {
      continue; // Skip entirely
    }

    // Construct page URL
    const pageUrl = `https://images.nasa.gov/details/${nasaId}`;

    scoredResults.push({
      result: {
        title,
        nasaId,
        thumbUrl,
        pageUrl,
        description,
      },
      score,
      index: i, // Original array index for stable sort
    });
  }

  // === DETERMINISTIC SORTING ===
  // Primary: Score (descending)
  // Secondary: Original index (ascending) - ensures same results for same input
  scoredResults.sort((a, b) => {
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    return a.index - b.index;
  });

  // Extract top results
  const topResults = scoredResults.slice(0, maxResults).map((sr) => sr.result);

  console.log(
    `[NASA] Filtered ${items.length} results → ${scoredResults.length} relevant → top ${topResults.length}`,
    topResults.map((r) => ({
      title: r.title,
      score: scoredResults.find((sr) => sr.result.nasaId === r.nasaId)?.score,
    })),
  );

  return topResults;
}

/**
 * Get cached data from localStorage
 *
 * @param cacheKey - Cache key
 * @returns Cached data if valid, null otherwise
 */
function getCachedData(cacheKey: string): CachedNasaData | null {
  if (typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const data: CachedNasaData = JSON.parse(cached);

    // Check if cache is still valid (within TTL)
    const age = Date.now() - data.timestamp;
    if (age > CACHE_TTL) {
      console.log(`[NASA] Cache expired for ${cacheKey}`);
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (error) {
    console.error(`[NASA] Cache read error for ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Store data in localStorage cache
 *
 * @param cacheKey - Cache key
 * @param data - Data to cache
 */
function setCachedData(cacheKey: string, data: CachedNasaData): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    localStorage.setItem(cacheKey, JSON.stringify(data));
    console.log(`[NASA] Cached ${cacheKey} successfully`);
  } catch (error) {
    // Handle quota exceeded or other errors
    console.error(`[NASA] Cache write error for ${cacheKey}:`, error);

    // Try to clear old cache entries
    clearOldCacheEntries();

    // Retry once
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (retryError) {
      console.error(`[NASA] Cache write retry failed:`, retryError);
    }
  }
}

/**
 * Clear old NASA cache entries to free up space
 * Removes entries older than TTL
 */
function clearOldCacheEntries(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const now = Date.now();
  const keysToRemove: string[] = [];

  // Find expired cache keys
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(CACHE_PREFIX)) continue;

    try {
      const data: CachedNasaData = JSON.parse(localStorage.getItem(key)!);
      const age = now - data.timestamp;
      if (age > CACHE_TTL) {
        keysToRemove.push(key);
      }
    } catch {
      // Invalid entry, remove it
      keysToRemove.push(key);
    }
  }

  // Remove expired entries
  keysToRemove.forEach((key) => {
    localStorage.removeItem(key);
    console.log(`[NASA] Removed expired cache: ${key}`);
  });
}

/**
 * Clear all NASA cache entries (useful for debugging)
 */
export function clearNasaCache(): void {
  if (typeof window === "undefined" || !window.localStorage) {
    return;
  }

  const keysToRemove: string[] = [];

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }

  keysToRemove.forEach((key) => localStorage.removeItem(key));
  console.log(`[NASA] Cleared ${keysToRemove.length} cache entries`);
}
