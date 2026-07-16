import { describe, expect, it, vi } from "vitest";
import {
  readShipQualityPreference,
  selectShipQuality,
  writeShipQualityPreference,
} from "@/components/islands/space/shipQuality";

describe("selectShipQuality", () => {
  it("honours the explicit high-quality preference", () => {
    expect(
      selectShipQuality({
        preference: "high",
        viewportIsWide: false,
        saveData: true,
        gpuTier: 0,
      }),
    ).toBe("high");
  });

  it("selects low quality for the data-saver preference and hard low signals", () => {
    expect(
      selectShipQuality({ preference: "data-saver", viewportIsWide: true }),
    ).toBe("low");
    expect(
      selectShipQuality({
        preference: "auto",
        viewportIsWide: true,
        saveData: true,
      }),
    ).toBe("low");
    expect(
      selectShipQuality({
        preference: "auto",
        viewportIsWide: true,
        deviceMemory: 2,
      }),
    ).toBe("low");
  });

  it("uses GPU tier before its viewport fallback in automatic mode", () => {
    expect(
      selectShipQuality({
        preference: "auto",
        viewportIsWide: false,
        gpuTier: 2,
      }),
    ).toBe("high");
    expect(
      selectShipQuality({
        preference: "auto",
        viewportIsWide: true,
        gpuTier: 1,
      }),
    ).toBe("low");
    expect(
      selectShipQuality({ preference: "auto", viewportIsWide: false }),
    ).toBe("low");
    expect(
      selectShipQuality({ preference: "auto", viewportIsWide: true }),
    ).toBe("high");
  });
});

describe("ship quality preference storage", () => {
  it("reads a saved preference and ignores malformed values", () => {
    window.localStorage.setItem("ship-quality-preference", "high");
    expect(readShipQualityPreference()).toBe("high");

    window.localStorage.setItem("ship-quality-preference", "corrupted");
    expect(readShipQualityPreference()).toBe("auto");
  });

  it("writes a valid preference without requiring available storage", () => {
    expect(writeShipQualityPreference("data-saver")).toBe(true);
    expect(window.localStorage.getItem("ship-quality-preference")).toBe(
      "data-saver",
    );
  });

  it("reports when restrictive browser storage rejects a preference", () => {
    const setItem = vi
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => {
        throw new Error("storage blocked");
      });

    expect(writeShipQualityPreference("high")).toBe(false);

    setItem.mockRestore();
  });
});
