/**
 * PF-11 D5.4 — the missing-body audit's standing guard (D5-AC3, adopted from the UX research
 * plan): the travel surface (every real catalog body + every nav station) must be a SUBSET of
 * the search index, forever — nothing travelable should ever again be unsearchable. Drives the
 * REAL module-loading path (CLAUDE.md #18), same reasoning and same real-import-order pattern as
 * celestial-content-overlay.test.ts, rather than reimplementing what the catalog contains.
 */
import { describe, expect, it, beforeAll } from "vitest";
import { buildIndex, search } from "@/lib/destination-search";
import { STATIONS } from "@/components/islands/space/types";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

beforeAll(async () => {
  // Exactly SpaceScene.tsx's own Promise.all import list (base catalog modules that ADD ids —
  // the two content overlays only override existing ids' text, so they don't affect surface
  // coverage and are deliberately omitted here).
  await Promise.all([
    import("@/data/celestial/celestial-catalog.js"),
    import("@/data/celestial/celestial-extra.js"),
    import("@/data/celestial/celestial-imgmap.js"),
    import("@/data/celestial/celestial-extra2.js"),
    import("@/data/celestial/celestial-gaia.js"),
    import("@/data/celestial/celestial-clusters.js"),
    import("@/data/celestial/celestial-minorplanets.js"),
    import("@/data/celestial/celestial-nbg.js"),
    import("@/data/celestial/celestial-gd1.js"),
    import("@/data/celestial/celestial-ngc2000.js"),
    import("@/data/celestial/celestial-saturn-moons.js"),
    import("@/data/celestial/celestial-missing-moons.js"),
  ]);
});

function realCatalog(): CelestialEntry[] {
  return window.CELESTIAL ?? [];
}

describe("search surface audit (D5-AC3): travel surface subset-of search index", () => {
  it("loaded a plausible real catalog (the import list has not rotted)", () => {
    expect(realCatalog().length).toBeGreaterThan(4000);
  });

  it("every real catalog body is present in the built search index", () => {
    const stations = STATIONS.map((st) => ({
      id: "st-" + st.sec,
      label: st.label,
      sub: st.sub,
    }));
    const idx = buildIndex(realCatalog(), stations);
    const indexIds = new Set(idx.entries.map((e) => e.id));
    const missing = realCatalog()
      .map((e) => e.id)
      .filter((id) => !indexIds.has(id));
    expect(
      missing,
      `these catalog bodies are travelable but missing from the search index: ${missing.join(", ")}`,
    ).toEqual([]);
  });

  it("every nav station is present in the built search index and findable by name", () => {
    const stations = STATIONS.map((st) => ({
      id: "st-" + st.sec,
      label: st.label,
      sub: st.sub,
    }));
    const idx = buildIndex(realCatalog(), stations);
    const indexIds = new Set(idx.entries.map((e) => e.id));
    for (const st of STATIONS) {
      const id = "st-" + st.sec;
      expect(indexIds.has(id), `station ${id} missing from search index`).toBe(
        true,
      );
      const results = search(idx, st.label);
      expect(
        results.some((r) => r.id === id),
        `station ${id} (label "${st.label}") is not findable by its own name`,
      ).toBe(true);
    }
  });

  it("the D5.4 missing-body audit's five bodies are now real, searchable catalog entries", () => {
    const stations = STATIONS.map((st) => ({
      id: "st-" + st.sec,
      label: st.label,
      sub: st.sub,
    }));
    const idx = buildIndex(realCatalog(), stations);
    for (const [id, name] of [
      ["mimas", "Mimas"],
      ["iapetus", "Iapetus"],
      ["phobos", "Phobos"],
      ["triton", "Triton"],
      ["charon", "Charon"],
    ]) {
      const results = search(idx, name);
      expect(
        results.some((r) => r.id === id),
        `${name} (${id}) should be searchable by its own name`,
      ).toBe(true);
    }
  });

  it("Phobos never gets a sphere (NEVER_SPHERE) even though it is now a real destination", async () => {
    const { NEVER_SPHERE } = await import("@/lib/planet-sphere");
    expect(NEVER_SPHERE.has("phobos")).toBe(true);
  });
});
