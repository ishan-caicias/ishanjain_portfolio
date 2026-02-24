import type { HubbleEntry } from "@/types";

/**
 * Load Hubble dataset from local JSON.
 * Optionally fetches from NASA APOD API if PUBLIC_NASA_API_KEY is set.
 */
export async function loadHubbleData(): Promise<HubbleEntry[]> {
  try {
    const response = await fetch("/hubble/data.json");
    if (!response.ok) {
      throw new Error(`Failed to load Hubble data: ${response.status}`);
    }
    const data: HubbleEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading Hubble data:", error);
    return getFallbackData();
  }
}

/**
 * Minimal fallback if data.json is unavailable.
 */
function getFallbackData(): HubbleEntry[] {
  return [
    {
      id: "fallback-nebula",
      title: "A Distant Nebula",
      date: "2024-01-01",
      description:
        "Somewhere in the cosmos, a cloud of gas and dust glows with the light of newborn stars. The universe is full of wonders waiting to be discovered.",
      imagePath: "",
      credit: "The Universe",
      sourceUrl: "",
    },
  ];
}

/**
 * Optional: Fetch from NASA APOD API.
 * Only used if PUBLIC_NASA_API_KEY environment variable is set (or options.apiKey in tests).
 */
export async function fetchNasaApod(options?: {
  apiKey?: string;
}): Promise<HubbleEntry | null> {
  const apiKey = options?.apiKey ?? import.meta.env.PUBLIC_NASA_API_KEY;
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://api.nasa.gov/planetary/apod?api_key=${apiKey}`,
    );
    if (!response.ok) return null;

    const data = await response.json();
    return {
      id: `nasa-apod-${data.date}`,
      title: data.title,
      date: data.date,
      description: data.explanation,
      imagePath: data.url,
      credit: data.copyright ?? "NASA",
      sourceUrl: data.hdurl ?? data.url,
    };
  } catch {
    return null;
  }
}
