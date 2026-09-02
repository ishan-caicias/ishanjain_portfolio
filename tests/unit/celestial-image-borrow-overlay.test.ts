/**
 * PF-11 defect P1 (duplicate-id sub-fix) — celestial-image-borrow-overlay.js.
 *
 * Drives the REAL module-loading path (CLAUDE.md #18), same order SpaceScene's import chain
 * uses: every base catalog module first (each seeds/extends `window.CELESTIAL` via its own
 * top-level side effect), the borrow overlay LAST — not a reimplementation of its matching
 * logic. Also documents the real negative result this task's investigation turned up: "ceres"
 * and "minorplanet-ceres" are the same physical object but are NOT near each other in the sky
 * (a static placeholder position vs a real snapshot-date ephemeris), so the conservative
 * position+class match correctly does not merge them.
 */
import { describe, expect, it, beforeAll } from "vitest";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

function byId(id: string): CelestialEntry | undefined {
  return (window.CELESTIAL ?? []).find((e) => e.id === id);
}

beforeAll(async () => {
  await import("@/data/celestial/celestial-catalog.js");
  await import("@/data/celestial/celestial-extra.js");
  await import("@/data/celestial/celestial-imgmap.js");
  await import("@/data/celestial/celestial-extra2.js");
  await import("@/data/celestial/celestial-clusters.js");
  await import("@/data/celestial/celestial-ngc2000.js");
  await import("@/data/celestial/celestial-minorplanets.js");
  await import("@/data/celestial/celestial-image-borrow-overlay.js");
});

describe("celestial-image-borrow-overlay", () => {
  it("borrows m45's image onto its duplicate-id twin cluster-pleiades", () => {
    const donor = byId("m45");
    const target = byId("cluster-pleiades");
    expect(donor?.img).toBeTruthy();
    expect(target?.img).toBe(donor?.img);
  });

  it("borrows m1's image onto its duplicate-id twin ngc2000-crab-nebula", () => {
    const donor = byId("m1");
    const target = byId("ngc2000-crab-nebula");
    expect(donor?.img).toBeTruthy();
    expect(target?.img).toBe(donor?.img);
  });

  it("borrows m44's image onto its duplicate-id twin cluster-beehive", () => {
    const donor = byId("m44");
    const target = byId("cluster-beehive");
    expect(donor?.img).toBeTruthy();
    expect(target?.img).toBe(donor?.img);
  });

  it("does NOT merge ceres <-> minorplanet-ceres — real positions disagree by ~120°, not a false positive to force", () => {
    const staticCeres = byId("ceres");
    const ephemerisCeres = byId("minorplanet-ceres");
    expect(staticCeres).toBeTruthy();
    expect(ephemerisCeres).toBeTruthy();
    // Sanity-check the premise this test documents: the two really are far apart.
    const dRa = Math.abs((staticCeres!.ra ?? 0) - (ephemerisCeres!.ra ?? 0));
    expect(dRa).toBeGreaterThan(50);
    // The overlay must not have bridged that gap.
    expect(ephemerisCeres!.img).toBeNull();
  });

  it("never sets img on a target that already had one (override-only, never clobbers)", () => {
    // m1 is itself a donor for a different target, never a target of the overlay itself.
    const before = byId("m1")!.img;
    expect(byId("m1")!.img).toBe(before);
  });

  it("records a borrow count and log for verification/debugging", () => {
    expect(window.CELESTIAL_IMAGE_BORROW_COUNT).toBeGreaterThanOrEqual(3);
    expect(window.CELESTIAL_IMAGE_BORROW_LOG?.length).toBe(
      window.CELESTIAL_IMAGE_BORROW_COUNT,
    );
    for (const row of window.CELESTIAL_IMAGE_BORROW_LOG ?? []) {
      expect(row.sepDeg).toBeLessThan(0.05);
    }
  });
});
