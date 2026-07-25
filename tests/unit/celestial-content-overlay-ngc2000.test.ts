/**
 * PF-11 D4.4 (batch 2: the 41 NGC2000 nebula texts) — celestial-content-overlay-ngc2000.js.
 *
 * Drives the REAL module-loading path (CLAUDE.md #18): imports celestial-ngc2000.js (which
 * seeds `window.CELESTIAL` with the base nebula records, [[TODO]] placeholders included, via
 * its own top-level side effect) and THEN celestial-content-overlay-ngc2000.js, the same order
 * SpaceScene's import chain uses now that this batch is wired in (owner-approved 2026-07-25,
 * TR-101; drafted in TR-100).
 *
 * Per-object source list: docs/analysis/2026-07-25-ngc2000-card-content-sources.md. Mirrors
 * celestial-content-overlay.test.ts (batch 1, clusters) structurally.
 */
import { describe, expect, it, beforeAll } from "vitest";

declare global {
  interface Window {
    CELESTIAL_CONTENT_OVERLAY_NGC2000_APPLIED?: number;
  }
}

const NGC2000_IDS = [
  "ngc2000-crab-nebula",
  "ngc2000-lagoon-nebula",
  "ngc2000-eagle-nebula",
  "ngc2000-omega-nebula",
  "ngc2000-trifid-nebula",
  "ngc2000-dumbbell-nebula",
  "ngc2000-orion-nebula",
  "ngc2000-ring-nebula",
  "ngc2000-owl-nebula",
  "ngc2000-horse-head-nebula",
  "ngc2000-butterfly-nebula",
  "ngc2000-hourglass-nebula",
  "ngc2000-cat-s-eye-nebula",
  "ngc2000-helix-nebula",
  "ngc2000-maia-nebula",
  "ngc2000-merope-nebula",
  "ngc2000-california-nebula",
  "ngc2000-hind-s-variable-nebula",
  "ngc2000-ngc-2068",
  "ngc2000-rosette-nebula",
  "ngc2000-hubble-s-variable-nebula",
  "ngc2000-crescent-nebula",
  "ngc2000-veil-nebula",
  "ngc2000-north-america-nebula",
  "ngc2000-bubble-nebula",
  "ngc2000-flaming-star-nebula",
  "ngc2000-witch-head-nebula",
  "ngc2000-pelican-nebula",
  "ngc2000-little-dumbbell",
  "ngc2000-eskimo-nebula",
  "ngc2000-eight-burst-nebula",
  "ngc2000-ghost-of-jupiter",
  "ngc2000-blue-planetary",
  "ngc2000-bug-nebula",
  "ngc2000-box-nebula",
  "ngc2000-little-gem-nebula",
  "ngc2000-saturn-nebula",
  "ngc2000-blue-snowball-nebula",
  "ngc2000-tarantula-nebula",
  "ngc2000-christmas-tree-cluster",
  "ngc2000-cocoon-nebula",
];

let countBeforeOverlay: number;

beforeAll(async () => {
  await import("@/data/celestial/celestial-ngc2000.js");
  countBeforeOverlay = (window.CELESTIAL ?? []).length;
  await import("@/data/celestial/celestial-content-overlay-ngc2000.js");
});

describe("celestial-content-overlay-ngc2000.js — batch 2 (NGC2000 nebulae)", () => {
  it("applied to exactly the 41 NGC2000 ids, none skipped", () => {
    expect(window.CELESTIAL_CONTENT_OVERLAY_NGC2000_APPLIED).toBe(
      NGC2000_IDS.length,
    );
  });

  it("leaves no [[TODO string on any of the 41 batch-2 ids", () => {
    const byId = new Map((window.CELESTIAL ?? []).map((e) => [e.id, e]));
    for (const id of NGC2000_IDS) {
      const entry = byId.get(id);
      expect(entry, `catalog should still contain ${id}`).toBeDefined();
      expect(String(entry!.f), `${id}.f`).not.toContain("TODO");
      expect(JSON.stringify(entry!.lo), `${id}.lo`).not.toContain("TODO");
    }
  });

  it("every overridden record still carries a real, non-empty field note and lore entry", () => {
    const byId = new Map((window.CELESTIAL ?? []).map((e) => [e.id, e]));
    for (const id of NGC2000_IDS) {
      const entry = byId.get(id) as {
        f?: string | null;
        lo?: [string, string][] | null;
      };
      expect(entry.f, `${id}.f`).toBeTruthy();
      expect(entry.f!.length, `${id}.f length`).toBeGreaterThan(20);
      expect(Array.isArray(entry.lo), `${id}.lo is an array`).toBe(true);
      expect(entry.lo!.length, `${id}.lo has an entry`).toBeGreaterThan(0);
      const [source, fact] = entry.lo![0];
      expect(source, `${id}.lo[0] source`).toBeTruthy();
      expect(fact, `${id}.lo[0] fact`).toBeTruthy();
    }
  });

  it("overrides in place — never appends a phantom body (the catalog's own length is unchanged)", () => {
    expect((window.CELESTIAL ?? []).length).toBe(countBeforeOverlay);
  });

  it("is a no-op for an id the overlay doesn't know about (no phantom-body creation)", () => {
    const ids = new Set((window.CELESTIAL ?? []).map((e) => e.id));
    for (const id of NGC2000_IDS) {
      expect(ids.has(id), `${id} must be a pre-existing catalog id`).toBe(true);
    }
  });

  it("ngc2000-crescent-nebula's authored text never repeats the catalog's own anomalous distance value", () => {
    // TR-100: this record's own `ly` field (5) is a suspected data-pipeline error (the real
    // Crescent Nebula, NGC 6888, is ~5,000 ly away) — the authored prose must not launder
    // that anomaly by restating it as fact.
    const entry = (window.CELESTIAL ?? []).find(
      (e) => e.id === "ngc2000-crescent-nebula",
    ) as { f?: string | null; lo?: [string, string][] | null } | undefined;
    expect(entry).toBeDefined();
    const text = (entry!.f ?? "") + JSON.stringify(entry!.lo ?? []);
    expect(text).not.toMatch(/\b5\s*(ly|light[- ]years?)\b/i);
  });
});
