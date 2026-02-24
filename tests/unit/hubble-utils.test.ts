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

import { fetchNasaApod } from "../../src/utils/hubble";

describe("fetchNasaApod", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null when no API key is provided", async () => {
    const result = await fetchNasaApod();
    expect(result).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns NASA entry when API key is set and fetch succeeds", async () => {
    const mockApod = {
      date: "2024-01-15",
      title: "Test Image",
      explanation: "Test explanation",
      url: "https://example.com/image.jpg",
      hdurl: "https://example.com/hd.jpg",
      copyright: "NASA",
    };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockApod),
    });

    const result = await fetchNasaApod({ apiKey: "test-key" });
    expect(result).not.toBeNull();
    expect(result!.id).toBe("nasa-apod-2024-01-15");
    expect(result!.title).toBe("Test Image");
    expect(result!.description).toBe("Test explanation");
    expect(result!.imagePath).toBe("https://example.com/image.jpg");
    expect(result!.credit).toBe("NASA");
    expect(result!.sourceUrl).toBe("https://example.com/hd.jpg");
  });

  it("uses url when hdurl is missing", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          date: "2024-01-15",
          title: "Test",
          explanation: "Desc",
          url: "https://example.com/lo.jpg",
          copyright: "NASA",
        }),
    });

    const result = await fetchNasaApod({ apiKey: "k" });
    expect(result!.sourceUrl).toBe("https://example.com/lo.jpg");
  });

  it("returns null when API returns non-ok", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false });

    const result = await fetchNasaApod({ apiKey: "test-key" });
    expect(result).toBeNull();
  });

  it("returns null when fetch throws", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchNasaApod({ apiKey: "test-key" });
    expect(result).toBeNull();
  });
});
