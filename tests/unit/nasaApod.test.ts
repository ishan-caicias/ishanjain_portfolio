import { describe, it, expect, vi, beforeEach } from "vitest";
import { fetchNasaApod } from "../../src/utils/nasaApod";

describe("fetchNasaApod", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal("fetch", vi.fn());
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
