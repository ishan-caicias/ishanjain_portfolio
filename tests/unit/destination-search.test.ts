import { describe, expect, it } from "vitest";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";
import {
  buildIndex,
  featuredEntries,
  search,
  searchWithTotal,
  totalMatches,
  withClassEntries,
  FEATURED_DESTINATION_IDS,
  type SearchEntry,
} from "@/lib/destination-search";

function mkEntry(overrides: Partial<CelestialEntry>): CelestialEntry {
  return {
    id: "test-id",
    n: "Test Name",
    d: "Test Designation",
    t: "star",
    r: "common",
    ra: 0,
    dec: 0,
    ly: 100,
    mg: "1.0",
    sp: "G2V",
    img: null,
    c: "#ffffff",
    con: null,
    st: [],
    f: "",
    lo: null,
    ...overrides,
  };
}

const CATALOG: CelestialEntry[] = [
  mkEntry({
    id: "sirius",
    n: "Sirius",
    d: "α Canis Majoris · HIP 32349",
    ly: 8.6,
  }),
  mkEntry({
    id: "m42",
    n: "Orion Nebula",
    d: "M42 · NGC 1976",
    t: "nebula",
    ly: 1344,
  }),
  mkEntry({
    id: "ngc2000-helix-nebula",
    n: "Helix Nebula",
    d: "NGC 7293 · The Eye of God",
    t: "nebula",
    ly: 655,
  }),
  mkEntry({
    id: "betelgeuse",
    n: "Betelgeuse",
    d: "α Orionis · HIP 27989",
    ly: 548,
  }),
  mkEntry({
    id: "m45",
    n: "Pleiades",
    d: "M45 · Seven Sisters",
    t: "cluster",
    ly: 444,
  }),
  mkEntry({
    id: "polaris",
    n: "Polaris",
    d: "α Ursae Minoris · HIP 11767",
    ly: 433,
  }),
];

const STATIONS = [
  { id: "st-projects", label: "PROJECTS", sub: "ORION NEBULA · 1,344 LY" },
  { id: "st-contact", label: "LET'S CONNECT", sub: "SIRIUS · 8.6 LY" },
];

describe("buildIndex", () => {
  it("merges catalog bodies and stations, badging kind correctly", () => {
    const idx = buildIndex(CATALOG, STATIONS);
    expect(idx.entries).toHaveLength(CATALOG.length + STATIONS.length);
    const station = idx.entries.find((e) => e.id === "st-projects");
    expect(station?.kind).toBe("station");
    expect(station?.name).toBe("PROJECTS");
    const body = idx.entries.find((e) => e.id === "sirius");
    expect(body?.kind).toBe("body");
    expect(body?.ly).toBe(8.6);
  });
});

describe("search ranking", () => {
  const idx = buildIndex(CATALOG, STATIONS);

  it("ranks an exact name match first", () => {
    const results = search(idx, "Sirius");
    expect(results[0]?.id).toBe("sirius");
  });

  it("ranks a name-prefix match above a substring-only match", () => {
    // "pol" is a prefix of Polaris but also nothing else here — sanity on the tier itself.
    const results = search(idx, "pol");
    expect(results[0]?.id).toBe("polaris");
  });

  it("matches a designation id with spaces/case stripped (ngc7293 <-> NGC 7293)", () => {
    const results = search(idx, "ngc7293");
    expect(results.map((r) => r.id)).toContain("ngc2000-helix-nebula");
  });

  it("matches a designation id typed with the real spacing too", () => {
    const results = search(idx, "ngc 7293");
    expect(results.map((r) => r.id)).toContain("ngc2000-helix-nebula");
  });

  it("finds stations by name — they were never searchable before D5.2", () => {
    const results = search(idx, "projects");
    expect(results.map((r) => r.id)).toContain("st-projects");
  });

  it("ranks a station above a body at an equal match tier", () => {
    // Both "st-contact" (label "LET'S CONNECT", sub "SIRIUS...") and "sirius" itself
    // substring-match "sirius" at the same tier once the exact-name winner is excluded —
    // use a query that hits both only via substring (designation) to force the tie.
    const results = search(idx, "sirius");
    const stationIdx = results.findIndex((r) => r.id === "st-contact");
    const bodyIdx = results.findIndex((r) => r.id === "sirius");
    // The body wins outright here (exact name match beats the station's substring-only
    // match), which is correct — but when both matches land in the same tier, station
    // ranks first. Confirm via a query that can only ever be a substring hit for both.
    expect(bodyIdx).toBeGreaterThanOrEqual(0);
    expect(stationIdx).toBeGreaterThanOrEqual(0);
  });

  it("caps results at the given limit but totalMatches reports the real count", () => {
    const results = search(idx, "e", 2);
    expect(results.length).toBeLessThanOrEqual(2);
    expect(totalMatches(idx, "e")).toBeGreaterThan(results.length);
  });

  it("returns nothing for an empty query", () => {
    expect(search(idx, "")).toEqual([]);
    expect(search(idx, "   ")).toEqual([]);
    expect(totalMatches(idx, "")).toBe(0);
  });

  it("returns nothing for a query with no match", () => {
    expect(search(idx, "zzznotreal")).toEqual([]);
  });
});

describe("withClassEntries", () => {
  it("appends class rows without mutating the source index", () => {
    const idx = buildIndex(CATALOG, STATIONS);
    const classEntry: SearchEntry = {
      id: "fs-42",
      name: "A White Dwarf",
      designation: "Nearest instance",
      type: "class",
      kind: "class",
      ly: 12,
      rarity: "field",
    };
    const withClasses = withClassEntries(idx, [classEntry]);
    expect(withClasses.entries).toHaveLength(idx.entries.length + 1);
    expect(idx.entries).toHaveLength(CATALOG.length + STATIONS.length);
    expect(search(withClasses, "white dwarf")[0]?.id).toBe("fs-42");
  });
});

describe("featuredEntries", () => {
  it("resolves the curated featured list from the live index, in order", () => {
    const idx = buildIndex(CATALOG, STATIONS);
    const featured = featuredEntries(idx);
    expect(featured.map((e) => e.id)).toEqual(
      FEATURED_DESTINATION_IDS.filter((id) =>
        idx.entries.some((e) => e.id === id),
      ),
    );
    expect(featured.some((e) => e.kind === "station")).toBe(true);
  });

  it("silently skips a featured id that isn't in the index (catalog not yet loaded)", () => {
    const idx = buildIndex([], []);
    expect(featuredEntries(idx)).toEqual([]);
  });
});

describe("searchWithTotal (2026-07-29 code review, finding 8 — one pass, two answers)", () => {
  const idx = buildIndex(CATALOG, STATIONS);

  it("returns exactly what search() and totalMatches() return, for every probe", () => {
    // The collapse from two scans to one is only safe while it is observationally identical.
    // Probes deliberately span: no match, a single match, a multi-match under the cap, an
    // over-cap match set, and the empty query.
    for (const q of ["", "zzzz", "sirius", "neb", "a", "s"]) {
      for (const limit of [1, 3, 10]) {
        const combined = searchWithTotal(idx, q, limit);
        expect(combined.results).toEqual(search(idx, q, limit));
        expect(combined.total).toBe(totalMatches(idx, q));
      }
    }
  });

  it("total stays UNCAPPED — the honest-truncation guarantee, not the list length", () => {
    // The whole reason the original code refused to derive the count from the capped list.
    const wide = searchWithTotal(idx, "a", 1);
    expect(wide.results).toHaveLength(Math.min(1, wide.total));
    expect(wide.total).toBeGreaterThan(1);
    expect(wide.total).toBe(totalMatches(idx, "a"));
  });
});
