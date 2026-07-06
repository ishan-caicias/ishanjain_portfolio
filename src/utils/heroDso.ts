import type { HeroDsoEntry } from "@/types";

/**
 * Load the curated deep-sky-object manifest used by the hero star-click reveal.
 * Built by scripts/hero/build-hero-dso.mjs from license-vetted Wikimedia sources.
 */
export async function loadHeroDsoData(): Promise<HeroDsoEntry[]> {
  try {
    const response = await fetch("/hero-dso/manifest.json");
    if (!response.ok) {
      throw new Error(`Failed to load hero DSO manifest: ${response.status}`);
    }
    const data: HeroDsoEntry[] = await response.json();
    return data;
  } catch (error) {
    console.error("Error loading hero DSO manifest:", error);
    return getFallbackData();
  }
}

/**
 * Minimal fallback if the manifest is unavailable.
 */
function getFallbackData(): HeroDsoEntry[] {
  return [
    {
      id: "fallback",
      label: "A Distant Nebula",
      imagePath: "",
      credit: "The Universe",
      attributionRequired: false,
      license: "Public domain",
      licenseUrl: null,
      sourceUrl: "",
    },
  ];
}
