import { getGPUTier } from "@pmndrs/detect-gpu";
import {
  readShipQualityPreference,
  selectShipQuality,
  type ShipQuality,
} from "@/components/islands/space/shipQuality";

const AUTO_QUALITY_CACHE_KEY = "ship-quality-auto-cache";
const AUTO_QUALITY_CACHE_DURATION_MS = 30 * 24 * 60 * 60 * 1000;
const GPU_DETECTION_TIMEOUT_MS = 500;
const GPU_BENCHMARKS_URL = "/space/ship-quality-benchmarks";

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

interface GpuTierResult {
  tier: number;
  type: string;
}

interface GpuProbe {
  context: WebGLRenderingContext;
  release: () => void;
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

function createGpuProbe(): GpuProbe | undefined {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl", {
    failIfMajorPerformanceCaveat: true,
  });

  if (!context) {
    return undefined;
  }

  let released = false;
  return {
    context,
    release: () => {
      if (released) {
        return;
      }

      released = true;
      context.getExtension("WEBGL_lose_context")?.loseContext();
      canvas.remove();
    },
  };
}

async function getGpuTierWithinDeadline(
  signal?: AbortSignal,
): Promise<GpuTierResult | undefined> {
  const probe = createGpuProbe();
  if (!probe) {
    return undefined;
  }

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  try {
    const aborted = new Promise<undefined>((resolve) => {
      if (!signal) {
        return;
      }

      abortHandler = () => resolve(undefined);
      if (signal.aborted) {
        abortHandler();
      } else {
        signal.addEventListener("abort", abortHandler, { once: true });
      }
    });
    const result: GpuTierResult | undefined = await Promise.race([
      getGPUTier({
        benchmarksURL: GPU_BENCHMARKS_URL,
        failIfMajorPerformanceCaveat: true,
        glContext: probe.context,
      }),
      new Promise<undefined>((resolve) => {
        timeoutId = setTimeout(
          () => resolve(undefined),
          GPU_DETECTION_TIMEOUT_MS,
        );
      }),
      aborted,
    ]);
    return result;
  } catch {
    return undefined;
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
    if (abortHandler) {
      signal?.removeEventListener("abort", abortHandler);
    }
    probe.release();
  }
}

export async function detectShipQuality(
  signal?: AbortSignal,
): Promise<ShipQuality> {
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

  const gpuResult = await getGpuTierWithinDeadline(signal);
  const quality = selectShipQuality({
    ...baseInput,
    gpuTier: gpuResult?.type === "BENCHMARK" ? gpuResult.tier : undefined,
  });
  if (gpuResult?.type === "BENCHMARK") {
    writeCachedAutomaticQuality(quality, now);
  }
  return quality;
}
