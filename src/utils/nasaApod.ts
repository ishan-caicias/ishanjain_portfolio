import type { ApodEntry } from "@/types";

/**
 * Optional: Fetch from NASA APOD API.
 * Only used if PUBLIC_NASA_API_KEY environment variable is set (or options.apiKey in tests).
 */
export async function fetchNasaApod(options?: {
  apiKey?: string;
}): Promise<ApodEntry | null> {
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
