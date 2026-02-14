import { describe, it, expect } from "vitest";
import { parseNasaResponse } from "@/utils/nasa";
import type { NasaApiResponse } from "@/types/nasa";

function createMockResponse(items: any[]): NasaApiResponse {
  return {
    collection: {
      items,
      metadata: { total_hits: items.length },
    },
  };
}

describe("NASA Quality Filter", () => {
  it("scores results with title keyword matches highest", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          {
            title: "Random Space Image",
            description: "Contains pillars of creation",
            nasa_id: "TEST001",
          },
        ],
        links: [{ href: "https://example.com/thumb.jpg", rel: "preview" }],
      },
      {
        data: [
          {
            title: "Pillars of Creation Nebula",
            description: "Star forming region",
            nasa_id: "TEST002",
          },
        ],
        links: [{ href: "https://example.com/thumb2.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["pillars", "creation"];
    const results = parseNasaResponse(mockResponse, 2, searchTerms);

    // TEST002 should be first (title match scores 20 points)
    expect(results[0].nasaId).toBe("TEST002");
    expect(results[0].title).toContain("Pillars of Creation");

    // TEST001 second (description match scores 6 points)
    expect(results[1].nasaId).toBe("TEST001");
  });

  it("filters out off-topic results with score=0", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          {
            title: "Completely Unrelated Image",
            description: "Nothing to do with search",
            nasa_id: "OFF_TOPIC",
          },
        ],
        links: [{ href: "https://example.com/off.jpg", rel: "preview" }],
      },
      {
        data: [
          {
            title: "Andromeda Galaxy",
            description: "Beautiful spiral galaxy",
            nasa_id: "RELEVANT",
          },
        ],
        links: [{ href: "https://example.com/galaxy.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["andromeda", "galaxy"];
    const results = parseNasaResponse(mockResponse, 5, searchTerms);

    // Only RELEVANT should be returned
    expect(results).toHaveLength(1);
    expect(results[0].nasaId).toBe("RELEVANT");
  });

  it("prefers larger images when available", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          {
            title: "Carina Nebula",
            description: "Stellar nursery",
            nasa_id: "SMALL",
          },
        ],
        links: [{ href: "https://example.com/~thumb.jpg", rel: "preview" }],
      },
      {
        data: [
          {
            title: "Carina Nebula",
            description: "Stellar nursery",
            nasa_id: "LARGE",
          },
        ],
        links: [
          { href: "https://example.com/~thumb.jpg", rel: "preview" },
          { href: "https://example.com/~large.jpg", rel: "preview" },
        ],
      },
    ]);

    const searchTerms = ["carina", "nebula"];
    const results = parseNasaResponse(mockResponse, 2, searchTerms);

    // LARGE should be first (same title/desc match, but +5 for large image)
    expect(results[0].nasaId).toBe("LARGE");
    expect(results[0].thumbUrl).toContain("~large");
  });

  it("produces deterministic results for same input", () => {
    const mockResponse = createMockResponse([
      {
        data: [{ title: "Image A", description: "Test", nasa_id: "A" }],
        links: [{ href: "https://example.com/a.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Image B", description: "Test", nasa_id: "B" }],
        links: [{ href: "https://example.com/b.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Image C", description: "Test", nasa_id: "C" }],
        links: [{ href: "https://example.com/c.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["test"];

    // Run multiple times, should get same order
    const run1 = parseNasaResponse(mockResponse, 3, searchTerms);
    const run2 = parseNasaResponse(mockResponse, 3, searchTerms);
    const run3 = parseNasaResponse(mockResponse, 3, searchTerms);

    expect(run1.map((r) => r.nasaId)).toEqual(run2.map((r) => r.nasaId));
    expect(run2.map((r) => r.nasaId)).toEqual(run3.map((r) => r.nasaId));
  });

  it("returns empty array when all results filtered out", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          {
            title: "Completely Off Topic",
            description: "Nothing relevant",
            nasa_id: "OFF1",
          },
        ],
        links: [{ href: "https://example.com/off1.jpg", rel: "preview" }],
      },
      {
        data: [
          {
            title: "Also Off Topic",
            description: "Still nothing",
            nasa_id: "OFF2",
          },
        ],
        links: [{ href: "https://example.com/off2.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["pillars", "creation"];
    const results = parseNasaResponse(mockResponse, 5, searchTerms);

    // All filtered out → empty array → triggers Hubble fallback
    expect(results).toHaveLength(0);
  });

  it("handles empty collection items", () => {
    const mockResponse = createMockResponse([]);

    const searchTerms = ["test"];
    const results = parseNasaResponse(mockResponse, 5, searchTerms);

    expect(results).toHaveLength(0);
  });

  it("handles missing data or links arrays", () => {
    const mockResponse = createMockResponse([
      {
        data: [],
        links: [],
      },
      {
        data: [{ title: "Valid", description: "Test", nasa_id: "VALID" }],
        links: [],
      },
      {
        data: [],
        links: [{ href: "https://example.com/test.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Test Image", description: "Test", nasa_id: "GOOD" }],
        links: [{ href: "https://example.com/good.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["test"];
    const results = parseNasaResponse(mockResponse, 5, searchTerms);

    // Only the last item should be returned (has both data and links)
    expect(results).toHaveLength(1);
    expect(results[0].nasaId).toBe("GOOD");
  });

  it("respects maxResults limit", () => {
    const mockResponse = createMockResponse([
      {
        data: [{ title: "Test 1", description: "Test", nasa_id: "T1" }],
        links: [{ href: "https://example.com/1.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Test 2", description: "Test", nasa_id: "T2" }],
        links: [{ href: "https://example.com/2.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Test 3", description: "Test", nasa_id: "T3" }],
        links: [{ href: "https://example.com/3.jpg", rel: "preview" }],
      },
      {
        data: [{ title: "Test 4", description: "Test", nasa_id: "T4" }],
        links: [{ href: "https://example.com/4.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["test"];
    const results = parseNasaResponse(mockResponse, 2, searchTerms);

    // Should return exactly 2 results
    expect(results).toHaveLength(2);
  });

  it("maintains original order when scores are identical", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          { title: "Nebula Image A", description: "Nebula", nasa_id: "A" },
        ],
        links: [{ href: "https://example.com/a.jpg", rel: "preview" }],
      },
      {
        data: [
          { title: "Nebula Image B", description: "Nebula", nasa_id: "B" },
        ],
        links: [{ href: "https://example.com/b.jpg", rel: "preview" }],
      },
      {
        data: [
          { title: "Nebula Image C", description: "Nebula", nasa_id: "C" },
        ],
        links: [{ href: "https://example.com/c.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["nebula"];
    const results = parseNasaResponse(mockResponse, 3, searchTerms);

    // All have same score (10 + 3 = 13), should maintain original order A, B, C
    expect(results.map((r) => r.nasaId)).toEqual(["A", "B", "C"]);
  });

  it("awards +5 points for large images", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          { title: "Pillars", description: "Nebula", nasa_id: "THUMB" },
        ],
        links: [{ href: "https://example.com/~thumb.jpg", rel: "preview" }],
      },
      {
        data: [
          { title: "Pillars", description: "Nebula", nasa_id: "ORIG" },
        ],
        links: [{ href: "https://example.com/~orig.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["pillars"];
    const results = parseNasaResponse(mockResponse, 2, searchTerms);

    // ORIG should be first (same title/desc score, but +5 for ~orig)
    expect(results[0].nasaId).toBe("ORIG");
    expect(results[0].thumbUrl).toContain("~orig");
  });

  it("awards +2 points for medium images", () => {
    const mockResponse = createMockResponse([
      {
        data: [
          { title: "Pillars", description: "Nebula", nasa_id: "THUMB" },
        ],
        links: [{ href: "https://example.com/~thumb.jpg", rel: "preview" }],
      },
      {
        data: [
          { title: "Pillars", description: "Nebula", nasa_id: "MEDIUM" },
        ],
        links: [{ href: "https://example.com/~medium.jpg", rel: "preview" }],
      },
    ]);

    const searchTerms = ["pillars"];
    const results = parseNasaResponse(mockResponse, 2, searchTerms);

    // MEDIUM should be first (same title/desc score, but +2 for ~medium)
    expect(results[0].nasaId).toBe("MEDIUM");
    expect(results[0].thumbUrl).toContain("~medium");
  });
});
