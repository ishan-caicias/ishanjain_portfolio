/**
 * PF-11 D6.6b — rank-honesty guard for declared-license moon offsets.
 *
 * Saturn's moons (celestial-saturn-moons.js) and Jupiter's (celestial-catalog.js) both use a
 * DECLARED visual spread from their parent, not real astrometry (real elongations are
 * sub-pixel at this scene's scale — see celestial-saturn-moons.js's own header). What must
 * stay true regardless is the ORDERING: a moon's offset from its parent must rank the same way
 * its real orbital radius does, or a visitor sees the innermost moon drawn farthest out. D6.6b
 * found and fixed exactly this — Io and Europa's offsets were swapped relative to their real
 * orbital radii. This test guards both systems so a future data edit can't reintroduce it.
 *
 * Drives the REAL module-loading path (CLAUDE.md #18), same pattern as
 * celestial-content-overlay.test.ts.
 */
import { describe, expect, it, beforeAll } from "vitest";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

beforeAll(async () => {
  await import("@/data/celestial/celestial-catalog.js");
  await import("@/data/celestial/celestial-saturn-moons.js");
});

function realCatalog(): CelestialEntry[] {
  return window.CELESTIAL ?? [];
}

const D2R = Math.PI / 180;

/** Angular offset from a parent, in degrees, using the same formula the catalog's own moon
 * offsets are built against: sqrt((deltaRa*cos(parentDec))^2 + deltaDec^2). */
function offsetFromParent(
  body: { ra: number; dec: number },
  parent: { ra: number; dec: number },
): number {
  const cosDec = Math.cos(parent.dec * D2R);
  const dRa = (body.ra - parent.ra) * cosDec;
  const dDec = body.dec - parent.dec;
  return Math.hypot(dRa, dDec);
}

/** Checks that `ids`, listed in real-orbital-radius-ascending order, have strictly increasing
 * offsets from `parentId`. */
function expectRankHonest(
  catalog: CelestialEntry[],
  parentId: string,
  ids: string[],
) {
  const byId = new Map(catalog.map((e) => [e.id, e]));
  const parent = byId.get(parentId);
  expect(parent, `${parentId} should be a real catalog entry`).toBeDefined();
  const offsets = ids.map((id) => {
    const body = byId.get(id);
    expect(body, `${id} should be a real catalog entry`).toBeDefined();
    return { id, offset: offsetFromParent(body!, parent!) };
  });
  for (let i = 1; i < offsets.length; i++) {
    expect(
      offsets[i].offset,
      `${offsets[i].id} (offset ${offsets[i].offset.toFixed(3)}) should rank farther from ` +
        `${parentId} than ${offsets[i - 1].id} (offset ${offsets[i - 1].offset.toFixed(3)}), ` +
        `matching real orbital-radius order`,
    ).toBeGreaterThan(offsets[i - 1].offset);
  }
}

describe("moon offset rank-honesty (PF-11 D6.6b)", () => {
  it("Jupiter's moons rank Io < Europa < Ganymede < Callisto by declared offset, matching real orbital radius (421,700 < 671,034 < 1,070,412 < 1,882,709 km)", () => {
    expectRankHonest(realCatalog(), "jupiter", [
      "io",
      "europa",
      "ganymede",
      "callisto",
    ]);
  });

  it("Saturn's moons rank Enceladus < Tethys < Dione < Rhea < Titan by declared offset, matching real orbital radius (already-established precedent, guarded here too)", () => {
    expectRankHonest(realCatalog(), "saturn", [
      "enceladus",
      "tethys",
      "dione",
      "rhea",
      "titan",
    ]);
  });
});
