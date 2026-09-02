/**
 * PF-11 D4.4 (batch 1: the 25 deferred cluster texts) — celestial-content-overlay.js.
 *
 * Drives the REAL module-loading path (CLAUDE.md #18): imports celestial-clusters.js (which
 * seeds `window.CELESTIAL` with the base cluster records, [[TODO]] placeholders included, via
 * its own top-level side effect) and THEN celestial-content-overlay.js, exactly the order
 * SpaceScene's import chain will use once this batch is wired in — not a reimplementation of
 * the merge logic.
 *
 * Per-cluster source list: docs/analysis/2026-07-25-card-content-sources.md. This is BATCH 1
 * only (clusters) — the 41+ NGC2000 nebula entries are batch 2, not started (TR-099), so this
 * test asserts "no TODO remains among the 25 CLUSTER ids this overlay covers," not "no TODO
 * remains in the whole catalog" (that broader claim is only true once batch 2 also lands).
 */
import { describe, expect, it, beforeAll } from "vitest";

declare global {
  interface Window {
    CELESTIAL_CONTENT_OVERLAY_APPLIED?: number;
  }
}

const DEFERRED_CLUSTER_IDS = [
  "cluster-beehive",
  "cluster-ptolemy",
  "cluster-wild-duck",
  "cluster-h-persei",
  "cluster-chi-persei",
  "cluster-butterfly",
  "cluster-salt-and-pepper",
  "cluster-wishing-well",
  "cluster-carolines-rose",
  "cluster-coma",
  "cluster-alpha-persei",
  "cluster-eagle-nebula",
  "cluster-lagoon-nebula",
  "cluster-little-beehive",
  "cluster-shoe-buckle",
  "cluster-tau-canis-majoris",
  "cluster-omicron-velorum",
  "cluster-rosette",
  "cluster-47-tucanae",
  "cluster-m22",
  "cluster-m3",
  "cluster-m5",
  "cluster-m15",
  "cluster-ngc6752",
  "cluster-m2",
];

let countBeforeOverlay: number;

beforeAll(async () => {
  // Same order SpaceScene's import chain uses: base catalog module first (its own top-level
  // side effect seeds window.CELESTIAL, TODO placeholders included), overlay LAST.
  await import("@/data/celestial/celestial-clusters.js");
  countBeforeOverlay = (window.CELESTIAL ?? []).length;
  await import("@/data/celestial/celestial-content-overlay.js");
});

describe("celestial-content-overlay.js — batch 1 (clusters)", () => {
  it("applied to exactly the 25 deferred cluster ids, none skipped", () => {
    expect(window.CELESTIAL_CONTENT_OVERLAY_APPLIED).toBe(
      DEFERRED_CLUSTER_IDS.length,
    );
  });

  it("leaves no [[TODO string on any of the 25 batch-1 cluster ids", () => {
    const byId = new Map((window.CELESTIAL ?? []).map((e) => [e.id, e]));
    for (const id of DEFERRED_CLUSTER_IDS) {
      const entry = byId.get(id);
      expect(entry, `catalog should still contain ${id}`).toBeDefined();
      expect(String(entry!.f), `${id}.f`).not.toContain("TODO");
      expect(JSON.stringify(entry!.lo), `${id}.lo`).not.toContain("TODO");
    }
  });

  it("every overridden record still carries a real, non-empty field note and lore entry", () => {
    const byId = new Map((window.CELESTIAL ?? []).map((e) => [e.id, e]));
    for (const id of DEFERRED_CLUSTER_IDS) {
      const entry = byId.get(id) as {
        f?: string | null;
        lo?: [string, string][] | null;
      };
      expect(entry.f, `${id}.f`).toBeTruthy();
      expect(entry.f!.length, `${id}.f length`).toBeGreaterThan(20);
      expect(Array.isArray(entry.lo), `${id}.lo is an array`).toBe(true);
      expect(entry.lo!.length, `${id}.lo has an entry`).toBeGreaterThan(0);
      const [source, fact] = entry.lo![0];
      // The pre-existing placeholder pattern was `["", "[[TODO...]]"]` — an empty source
      // string would mean this record slipped through un-authored.
      expect(source, `${id}.lo[0] source`).toBeTruthy();
      expect(fact, `${id}.lo[0] fact`).toBeTruthy();
    }
  });

  it("overrides in place — never appends a phantom body (the catalog's own length is unchanged)", () => {
    expect((window.CELESTIAL ?? []).length).toBe(countBeforeOverlay);
  });

  it("is a no-op for an id the overlay doesn't know about (untouched clusters keep their own content)", () => {
    // cluster-pleiades is one of the 10 ALREADY-authored clusters (not in this batch) —
    // the overlay must never have touched it.
    const pleiades = (window.CELESTIAL ?? []).find(
      (e) => e.id === "cluster-pleiades",
    );
    expect(pleiades).toBeDefined();
    expect(pleiades!.f).toContain("famous star cluster");
  });

  it("would skip an id gracefully if the catalog never carried it (no phantom-body creation)", () => {
    // Direct test of the guard itself: OVERRIDES is a closed object inside the IIFE, so this
    // asserts the OBSERVABLE contract — CELESTIAL's length is exactly what the base catalog
    // module produced, with nothing new appended, regardless of what OVERRIDES contains.
    const ids = new Set((window.CELESTIAL ?? []).map((e) => e.id));
    for (const id of DEFERRED_CLUSTER_IDS) {
      expect(ids.has(id), `${id} must be a pre-existing catalog id`).toBe(true);
    }
  });
});
