import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadHubbleData } from "../../src/utils/hubble";

describe("loadHubbleData", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns data from local JSON", async () => {
    const mockData = [
      {
        id: "test",
        title: "Test",
        date: "2024-01-01",
        description: "Test desc",
        imagePath: "/test.webp",
        credit: "Test",
        sourceUrl: "https://example.com",
      },
    ];

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const data = await loadHubbleData();
    expect(data).toEqual(mockData);
    expect(global.fetch).toHaveBeenCalledWith("/hubble/data.json");
  });

  it("returns fallback data on fetch error", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const data = await loadHubbleData();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("fallback-nebula");
  });

  it("returns fallback data on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
    });

    const data = await loadHubbleData();
    expect(data).toHaveLength(1);
    expect(data[0].id).toBe("fallback-nebula");
  });
});
