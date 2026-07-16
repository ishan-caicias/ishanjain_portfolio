import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detector = vi.hoisted(() => ({ getGPUTier: vi.fn() }));

vi.mock("@pmndrs/detect-gpu", () => detector);

import { detectShipQuality } from "@/components/islands/space/shipQualityDetection";

describe("detectShipQuality", () => {
  beforeEach(() => {
    window.localStorage.clear();
    detector.getGPUTier.mockReset();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "deviceMemory", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => vi.useRealTimers());

  it("uses low quality without GPU detection when data saving is requested", async () => {
    Object.defineProperty(navigator, "connection", {
      configurable: true,
      value: { saveData: true },
    });

    await expect(detectShipQuality()).resolves.toBe("low");
    expect(detector.getGPUTier).not.toHaveBeenCalled();
  });

  it("uses the detected GPU tier and caches only the automatic quality", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-16T00:00:00.000Z"));
    detector.getGPUTier.mockResolvedValue({ tier: 2 });

    await expect(detectShipQuality()).resolves.toBe("high");
    expect(detector.getGPUTier).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("ship-quality-auto-cache")).toContain(
      '"quality":"high"',
    );
    expect(
      JSON.parse(
        window.localStorage.getItem("ship-quality-auto-cache") ?? "{}",
      ),
    ).toMatchObject({
      expiresAt: Date.parse("2026-08-15T00:00:00.000Z"),
    });

    detector.getGPUTier.mockRejectedValue(new Error("should use cache"));
    await expect(detectShipQuality()).resolves.toBe("high");
    expect(detector.getGPUTier).toHaveBeenCalledOnce();
  });

  it("falls back through the pure selector when the detector rejects", async () => {
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    detector.getGPUTier.mockRejectedValue(new Error("detector unavailable"));

    await expect(detectShipQuality()).resolves.toBe("low");
    expect(detector.getGPUTier).toHaveBeenCalledOnce();
  });

  it("falls back after a 500ms detector timeout", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    detector.getGPUTier.mockImplementation(() => new Promise(() => undefined));

    const quality = detectShipQuality();
    await vi.advanceTimersByTimeAsync(500);

    await expect(quality).resolves.toBe("low");
  });
});
