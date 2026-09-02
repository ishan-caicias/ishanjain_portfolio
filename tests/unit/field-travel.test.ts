/**
 * PF-11 D4.2 — the `fs-<i>` travel-target parse/stride contract.
 *
 * Pure enough to unit test off-GPU despite living in babylon-engine.ts, same rationale as
 * babylon-engine-freelook.test.ts (the module's import-time side effects are ShaderStore
 * string registration and customElements.define, both inert without a connected element).
 *
 * These tests exist for one specific reason: the implementation plan prescribed porting
 * space-engine.js:1482-1497 verbatim, and that source indexes its field at **4 floats per
 * star** while Babylon's `_field.positions` is **3**. A verbatim port doesn't crash and
 * doesn't fail a render — it silently flies the ship to a neighbouring star. The stride
 * assertions below are the thing that stops that regressing back.
 *
 * PF-11 P2b adds two more pure exports here for the same off-GPU-testability reason:
 * `isPromotableFieldType` (which field object-type byte `_fieldBody` memoizes into a real
 * `this.bodies` entry — white dwarfs only) and `arrivalStandoffFor` (the arrival-standoff
 * selection `travelTo` uses, extracted so a promoted white dwarf's standoff is checkable
 * without a live scene).
 */
import { describe, expect, it } from "vitest";
import {
  arrivalStandoffFor,
  fieldStarTarget,
  isPromotableFieldType,
} from "@/lib/babylon-engine";
import {
  ARRIVE_STANDOFF,
  PLANET_ARRIVE_STANDOFF,
  NEBULA_ARRIVE_STANDOFF_FACTOR,
} from "@/lib/ship-dynamics";

/** Three stars at unambiguous, easily-checked coordinates: index 0 on +X, index 1 on +Y,
 * index 2 on +Z — chosen so a 4-stride misread produces obviously wrong values rather than
 * something that could coincidentally pass. */
const STARS: [number, number, number][] = [
  [10, 0, 0], // star 0
  [0, 20, 0], // star 1
  [0, 0, 30], // star 2
];
const POSITIONS = new Float32Array(STARS.flat());
const COUNT = STARS.length;

describe("fieldStarTarget — id parsing and bounds", () => {
  it("resolves a valid fs- id to its index", () => {
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.index).toBe(1);
  });

  it("returns null for a non-field id (catalog bodies and stations are looked up elsewhere)", () => {
    expect(fieldStarTarget("sirius", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("st-about", POSITIONS, COUNT)).toBeNull();
  });

  it("returns null for an unparseable index rather than flying to NaN", () => {
    expect(fieldStarTarget("fs-", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("fs-abc", POSITIONS, COUNT)).toBeNull();
  });

  it("returns null for out-of-range indices at both ends", () => {
    expect(fieldStarTarget("fs--1", POSITIONS, COUNT)).toBeNull();
    expect(fieldStarTarget("fs-3", POSITIONS, COUNT)).toBeNull(); // count is 3 → max index 2
    expect(fieldStarTarget("fs-999999", POSITIONS, COUNT)).toBeNull();
  });

  it("accepts the last valid index (the boundary is inclusive below count)", () => {
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.index).toBe(2);
  });

  it("returns null when the field is empty", () => {
    expect(fieldStarTarget("fs-0", new Float32Array(0), 0)).toBeNull();
  });
});

describe("fieldStarTarget — position stride (the 3-vs-4 float regression guard)", () => {
  it("reads index 0 at positions[0..2]", () => {
    expect(fieldStarTarget("fs-0", POSITIONS, COUNT)?.pos).toEqual([10, 0, 0]);
  });

  it("reads index 1 at positions[3..5] — a 4-stride port would read [20,0,0] here", () => {
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.pos).toEqual([0, 20, 0]);
  });

  it("reads index 2 at positions[6..8]", () => {
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.pos).toEqual([0, 0, 30]);
  });
});

describe("fieldStarTarget — direction", () => {
  it("is the unit vector toward the star", () => {
    expect(fieldStarTarget("fs-0", POSITIONS, COUNT)?.dir).toEqual([1, 0, 0]);
    expect(fieldStarTarget("fs-1", POSITIONS, COUNT)?.dir).toEqual([0, 1, 0]);
    expect(fieldStarTarget("fs-2", POSITIONS, COUNT)?.dir).toEqual([0, 0, 1]);
  });

  it("is a unit vector for an off-axis star", () => {
    const p = new Float32Array([3, 4, 12]); // |p| = 13
    const dir = fieldStarTarget("fs-0", p, 1)!.dir;
    expect(Math.hypot(dir[0], dir[1], dir[2])).toBeCloseTo(1, 12);
    expect(dir[0]).toBeCloseTo(3 / 13, 12);
    expect(dir[2]).toBeCloseTo(12 / 13, 12);
  });

  it("emits a finite (zero) direction rather than NaN for a star at the origin", () => {
    const dir = fieldStarTarget("fs-0", new Float32Array([0, 0, 0]), 1)!.dir;
    expect(dir.every((c) => Number.isFinite(c))).toBe(true);
  });
});

/**
 * PF-11 P2b — the white-dwarf real-body carve-out. `_fieldBody` (private, requires a live
 * scene, not unit-testable directly) delegates its promotion decision and its caller's
 * arrival-standoff selection to these two pure functions specifically so the carve-out's
 * regression-relevant contract is checkable off-GPU, the same reasoning this file's other
 * describe blocks already use for `fieldStarTarget`.
 */
describe("isPromotableFieldType — which field classes _fieldBody memoizes into this.bodies", () => {
  it("promotes white dwarfs only (FIELD_TYPES[2] in spaceHelpers.ts)", () => {
    expect(isPromotableFieldType(2)).toBe(true);
  });

  it("does not promote any other field class — base stars, or any other PF-10 bonus layer", () => {
    // 0 = base HIP/deep star, 1 = open cluster, 3 = SDSS galaxy, 4 = GD-1, 5 = exoplanet host,
    // 6 = DR3 asteroid (moves under GPU orbital motion — see _fieldBody's header for why this
    // MUST stay ephemeral, or a cached position would silently drift from the rendered one),
    // 7 = Oort dust grain.
    for (const type of [0, 1, 3, 4, 5, 6, 7]) {
      expect(isPromotableFieldType(type)).toBe(false);
    }
  });
});

describe("arrivalStandoffFor — a promoted (or ephemeral) field body gets ARRIVE_STANDOFF", () => {
  it("falls through to ARRIVE_STANDOFF for a field object (no `.t`, not a nebula id)", () => {
    // Matches EXACTLY the shape `_fieldBody` constructs for a synthesized/promoted white
    // dwarf: `e` carries id/ra/dec/ly but never `.t`, so the planet/moon/dwarf branch can never
    // match, and an `fs-<i>` id will never coincidentally equal a curated nebula's id.
    const fieldBody = { e: { id: "fs-123456" } };
    expect(arrivalStandoffFor(fieldBody, [])).toBe(ARRIVE_STANDOFF);
  });

  it("gives planet/moon/dwarf bodies the larger, decoupled PLANET_ARRIVE_STANDOFF", () => {
    expect(arrivalStandoffFor({ e: { id: "earth", t: "planet" } }, [])).toBe(
      PLANET_ARRIVE_STANDOFF,
    );
    expect(arrivalStandoffFor({ e: { id: "moon", t: "moon" } }, [])).toBe(
      PLANET_ARRIVE_STANDOFF,
    );
    expect(arrivalStandoffFor({ e: { id: "ceres", t: "dwarf" } }, [])).toBe(
      PLANET_ARRIVE_STANDOFF,
    );
  });

  it("gives a real-volume nebula a multiple of its own radius, keyed by id", () => {
    const volumes = [{ id: "orion-nebula", radius: 40 }];
    expect(
      arrivalStandoffFor({ e: { id: "orion-nebula" } }, volumes),
    ).toBeCloseTo(40 * NEBULA_ARRIVE_STANDOFF_FACTOR, 10);
  });

  it("never applies the volumetric standoff by `.t === 'nebula'` alone — presence in the volume list is what matters", () => {
    // A billboard-only DSO typed "nebula" but absent from the (deliberately empty here) volume
    // list must still get ARRIVE_STANDOFF, not a volume-derived standoff it has no volume for.
    expect(
      arrivalStandoffFor(
        { e: { id: "some-billboard-nebula", t: "nebula" } },
        [],
      ),
    ).toBe(ARRIVE_STANDOFF);
  });
});
