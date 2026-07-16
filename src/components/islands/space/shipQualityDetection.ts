import { getGPUTier } from "@pmndrs/detect-gpu";
import {
  readShipQualityPreference,
  selectShipQuality,
  type ShipQuality,
} from "@/components/islands/space/shipQuality";

const AUTO_QUALITY_CACHE_KEY = "ship-quality-auto-cache";
const AUTO_QUALITY_CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const GPU_DETECTION_TIMEOUT_MS = 500;

interface NavigatorConnection {
  saveData?: boolean;
}

interface NavigatorWithDeviceMemory extends Navigator {
  connection?: NavigatorConnection;
  deviceMemory?: number;
}

interface CachedShipQuality {
  quality: ShipQuality;
  expiresAt: number;
}

function readCachedAutomaticQuality(now: number): ShipQuality | undefined {
  try {
    const raw = window.localStorage.getItem(AUTO_QUALITY_CACHE_KEY);
    if (!raw) {
      return undefined;
    }

    const cached = JSON.parse(raw) as Partial<CachedShipQuality>;
    if (
      (cached.quality !== "low" && cached.quality !== "high") ||
      typeof cached.expiresAt !== "number" ||
      cached.expiresAt <= now
    ) {
      return undefined;
    }

    return cached.quality;
  } catch {
    return undefined;
  }
}

function writeCachedAutomaticQuality(quality: ShipQuality, now: number): void {
  try {
    window.localStorage.setItem(
      AUTO_QUALITY_CACHE_KEY,
      JSON.stringify({
        quality,
        expiresAt: now + AUTO_QUALITY_CACHE_DURATION_MS,
      }),
    );
  } catch {
    // Storage is optional.
  }
}

async function getGpuTierWithinDeadline(): Promise<number | undefined> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      getGPUTier(),
      new Promise<undefined>((resolve) => {
        timeoutId = setTimeout(
          () => resolve(undefined),
          GPU_DETECTION_TIMEOUT_MS,
        );
      }),
    ]);
    return result?.tier;
  } catch {
    return undefined;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

export async function detectShipQuality(): Promise<ShipQuality> {
  const preference = readShipQualityPreference();
  const browserNavigator = navigator as NavigatorWithDeviceMemory;
  const viewportIsWide = window.matchMedia("(min-width: 768px)").matches;
  const baseInput = {
    preference,
    viewportIsWide,
    saveData: browserNavigator.connection?.saveData,
    deviceMemory: browserNavigator.deviceMemory,
  };

  if (preference !== "auto") {
    return selectShipQuality(baseInput);
  }

  if (
    baseInput.saveData ||
    (baseInput.deviceMemory !== undefined && baseInput.deviceMemory < 4)
  ) {
    return selectShipQuality(baseInput);
  }

  const now = Date.now();
  const cachedQuality = readCachedAutomaticQuality(now);
  if (cachedQuality) {
    return cachedQuality;
  }

  const quality = selectShipQuality({
    ...baseInput,
    gpuTier: await getGpuTierWithinDeadline(),
  });
  writeCachedAutomaticQuality(quality, now);
  return quality;
}
