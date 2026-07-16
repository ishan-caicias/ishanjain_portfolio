import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const detector = vi.hoisted(() => ({ getGPUTier: vi.fn() }));
const probe = vi.hoisted(() => ({
  getExtension: vi.fn(),
  loseContext: vi.fn(),
}));

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
    probe.getExtension.mockReset();
    probe.loseContext.mockReset();
    probe.getExtension.mockReturnValue({ loseContext: probe.loseContext });
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      probe as unknown as WebGLRenderingContext,
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

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
    detector.getGPUTier.mockResolvedValue({ tier: 2, type: "BENCHMARK" });

    await expect(detectShipQuality()).resolves.toBe("high");
    expect(detector.getGPUTier).toHaveBeenCalledOnce();
    expect(detector.getGPUTier).toHaveBeenCalledWith(
      expect.objectContaining({
        benchmarksURL: "/space/ship-quality-benchmarks",
        failIfMajorPerformanceCaveat: true,
        glContext: expect.any(Object),
      }),
    );
    expect(probe.loseContext).toHaveBeenCalledOnce();
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
    expect(probe.loseContext).toHaveBeenCalledOnce();
    expect(window.localStorage.getItem("ship-quality-auto-cache")).toBeNull();
  });

  it("uses the viewport fallback instead of a failed benchmark tier", async () => {
    detector.getGPUTier.mockResolvedValue({
      tier: 1,
      type: "BENCHMARK_FETCH_FAILED",
    });

    await expect(detectShipQuality()).resolves.toBe("high");
    expect(window.localStorage.getItem("ship-quality-auto-cache")).toBeNull();

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    await expect(detectShipQuality()).resolves.toBe("low");
    expect(detector.getGPUTier).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("ship-quality-auto-cache")).toBeNull();
  });

  it("re-evaluates the viewport fallback after a timeout without caching it", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: false })),
    );
    detector.getGPUTier.mockImplementation(() => new Promise(() => undefined));

    const narrowQuality = detectShipQuality();
    await vi.advanceTimersByTimeAsync(500);

    await expect(narrowQuality).resolves.toBe("low");
    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({ matches: true })),
    );
    const wideQuality = detectShipQuality();
    await vi.advanceTimersByTimeAsync(500);

    await expect(wideQuality).resolves.toBe("high");
    expect(detector.getGPUTier).toHaveBeenCalledTimes(2);
    expect(window.localStorage.getItem("ship-quality-auto-cache")).toBeNull();
    expect(probe.loseContext).toHaveBeenCalledTimes(2);
  });

  it("releases its owned GPU probe when detection is cancelled", async () => {
    vi.useFakeTimers();
    detector.getGPUTier.mockImplementation(() => new Promise(() => undefined));
    const controller = new AbortController();
    let quality: string | undefined;

    void detectShipQuality(controller.signal).then((result) => {
      quality = result;
    });
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);

    expect(quality).toBe("high");
    expect(probe.loseContext).toHaveBeenCalledOnce();
  });
});
