export type ShipQuality = "low" | "high";
export type ShipQualityPreference = "auto" | "high" | "data-saver";

export const SHIP_QUALITY_PREFERENCE_STORAGE_KEY = "ship-quality-preference";

export interface ShipAsset {
  quality: ShipQuality;
  url: string;
}

export const shipAssets: Record<ShipQuality, ShipAsset> = {
  low: {
    quality: "low",
    url: "/space/ships/sci-fi-aircraft-spaceship-fighter-1k.glb",
  },
  high: {
    quality: "high",
    url: "/space/ships/sci-fi-aircraft-spaceship-fighter-2k.glb",
  },
};

export interface ShipQualitySelectionInput {
  preference: ShipQualityPreference;
  viewportIsWide: boolean;
  saveData?: boolean;
  deviceMemory?: number;
  gpuTier?: number;
}

export function selectShipQuality(
  input: ShipQualitySelectionInput,
): ShipQuality {
  if (input.preference === "high") {
    return "high";
  }

  if (input.preference === "data-saver") {
    return "low";
  }

  if (
    input.saveData ||
    (input.deviceMemory !== undefined && input.deviceMemory < 4)
  ) {
    return "low";
  }

  if (input.gpuTier === 2 || input.gpuTier === 3) {
    return "high";
  }

  if (input.gpuTier === 0 || input.gpuTier === 1) {
    return "low";
  }

  return input.viewportIsWide ? "high" : "low";
}

function isShipQualityPreference(
  value: string | null,
): value is ShipQualityPreference {
  return value === "auto" || value === "high" || value === "data-saver";
}

export function readShipQualityPreference(): ShipQualityPreference {
  try {
    const value = window.localStorage.getItem(
      SHIP_QUALITY_PREFERENCE_STORAGE_KEY,
    );
    return isShipQualityPreference(value) ? value : "auto";
  } catch {
    return "auto";
  }
}

export function writeShipQualityPreference(
  preference: ShipQualityPreference,
): void {
  try {
    window.localStorage.setItem(
      SHIP_QUALITY_PREFERENCE_STORAGE_KEY,
      preference,
    );
  } catch {
    // Storage is optional: private browsing and restrictive browser settings may block it.
  }
}
