import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadHeroDsoData } from "../../src/utils/heroDso";

describe("loadHeroDsoData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data from the local manifest", async () => {
    const mockData = [
      {
        id: "M42",
        label: "Orion Nebula",
        imagePath: "/hero-dso/images/M42.webp",
        credit: "NASA, ESA",
        attributionRequired: false,
        license: "Public domain",
        licenseUrl: null,
        sourceUrl: "https://example.com",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const data = await loadHeroDsoData();
    expect(data).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith("/hero-dso/manifest.json");
  });

  it("returns fallback data on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const data = await loadHeroDsoData();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("fallback");
  });

  it("returns fallback data on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const data = await loadHeroDsoData();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("fallback");
  });
});
