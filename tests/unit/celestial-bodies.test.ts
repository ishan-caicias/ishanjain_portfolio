/**
 * GAP-01/GAP-02 — curated celestial bodies on the Babylon path. Pure
 * appearance-derivation and billboard-geometry tests, mirroring star-field.
 * test.ts's conventions, plus the TR-045 WGSL reserved-identifier guard and a
 * TR-047 uniform-control-flow guard (a body's photographic shader branches on
 * a value that is constant per-body but not per-draw-call, which is exactly
 * the class TR-047 fixed — see celestial-bodies.ts's header comment on the
 * photo fragment twins for the full rationale).
 */
import { describe, expect, it } from "vitest";
import {
  buildPhotoBodyBillboards,
  buildProceduralBodyBillboards,
  hexToRampT,
  isPhotoEligible,
  isRingedBody,
  partitionCelestialBodies,
  photoSizeBoost,
  PHOTO_BODY_FRAGMENT_GLSL,
  PHOTO_BODY_FRAGMENT_WGSL,
  PHOTO_BODY_VERTEX_GLSL,
  PHOTO_BODY_VERTEX_WGSL,
  PHOTO_TYPE,
  PROCEDURAL_BODY_FRAGMENT_GLSL,
  PROCEDURAL_BODY_FRAGMENT_WGSL,
  PROCEDURAL_BODY_VERTEX_GLSL,
  PROCEDURAL_BODY_VERTEX_WGSL,
  proceduralTypeCode,
  RARITY_SIZE_BOOST,
  seedForIndex,
  sizeBoostForRarity,
  type PhotoBodySource,
  type ProceduralBodySource,
} from "@/lib/celestial-bodies";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";
import type { CelestialEntry } from "@/data/celestial/celestial.d.ts";

const entry = (over: Partial<CelestialEntry> = {}): CelestialEntry => ({
  id: "x",
  n: "X",
  d: "X",
  t: "star",
  r: "common",
  ra: 0,
  dec: 0,
  ly: 100,
  mg: "5",
  sp: "G2V",
  img: null,
  crd: null,
  c: "#ffd54f",
  con: null,
  st: [],
  f: "",
  lo: null,
  ...over,
});

describe("sizeBoostForRarity", () => {
  it("matches space-engine.js's _buildBodies rarity table exactly", () => {
    expect(sizeBoostForRarity("common")).toBe(60);
    expect(sizeBoostForRarity("uncommon")).toBe(90);
    expect(sizeBoostForRarity("rare")).toBe(130);
    expect(sizeBoostForRarity("epic")).toBe(180);
    expect(sizeBoostForRarity("legendary")).toBe(235);
  });

  it("defaults to 90 for an unrecognised or missing rarity", () => {
    expect(sizeBoostForRarity("mythic")).toBe(90);
    expect(sizeBoostForRarity(null)).toBe(90);
    expect(sizeBoostForRarity(undefined)).toBe(90);
  });

  it("every value in the table is also the module's exported constant", () => {
    expect(RARITY_SIZE_BOOST).toEqual({
      common: 60,
      uncommon: 90,
      rare: 130,
      epic: 180,
      legendary: 235,
    });
  });
});

describe("proceduralTypeCode", () => {
  it("maps named types to the archived engine's TC table exactly", () => {
    expect(proceduralTypeCode("star", null)).toBe(0);
    expect(proceduralTypeCode("planet", null)).toBe(1);
    expect(proceduralTypeCode("moon", null)).toBe(1);
    expect(proceduralTypeCode("dwarf", null)).toBe(1);
    expect(proceduralTypeCode("nebula", null)).toBe(2);
    expect(proceduralTypeCode("galaxy", null)).toBe(3);
    expect(proceduralTypeCode("deepfield", null)).toBe(6);
    expect(proceduralTypeCode("constellation", null)).toBe(7);
    expect(proceduralTypeCode("blackhole", null)).toBe(8);
  });

  it("splits cluster into globular (4) / open (5) via the sp field, case-insensitively", () => {
    expect(proceduralTypeCode("cluster", "Globular cluster")).toBe(4);
    expect(proceduralTypeCode("cluster", "GLOBULAR")).toBe(4);
    expect(proceduralTypeCode("cluster", "Open cluster")).toBe(5);
    expect(proceduralTypeCode("cluster", null)).toBe(5);
  });

  it("falls back to 0 for an unrecognised type", () => {
    expect(proceduralTypeCode("comet", null)).toBe(0);
  });
});

describe("hexToRampT", () => {
  // Each expectation reproduces space-engine.js's rough-hue heuristic by
  // hand from the hex components, not by re-deriving the formula.
  it("reads a clearly blue hex as the bluest ramp position", () => {
    expect(hexToRampT("#3355dd")).toBe(0.12); // bb(0xdd=221) > rr(0x33=51)+20
  });

  it("reads a bright amber/gold hex as warm-but-not-reddest", () => {
    // #ffd54f: rr=255 gg=213 bb=79 -> rr>bb+60 and gg>150 -> 0.72
    expect(hexToRampT("#ffd54f")).toBe(0.72);
  });

  it("reads a deep red/orange hex as the reddest ramp position", () => {
    // #ff8a65: rr=255 gg=138 bb=101 -> rr>bb+60 and gg<=150 -> 0.9
    expect(hexToRampT("#ff8a65")).toBe(0.9);
  });

  it("reads a near-neutral hex (channels within the heuristic's dead zone) as the default", () => {
    // #e8eaf6 (the Moon's catalog colour): rr=232 gg=234 bb=246. None of the
    // three branch conditions fire (bb is not > rr+20; rr is not > bb+60 or
    // bb+15) — the heuristic is a raw channel comparison, not perceived hue,
    // so a pale near-white lands on the default rather than "blue".
    expect(hexToRampT("#e8eaf6")).toBe(0.45);
  });

  it("defaults to 0.45 (near-white) for a missing colour", () => {
    expect(hexToRampT(null)).toBe(0.72); // the documented default "#ffd54f"
    expect(hexToRampT("#9e9e9e")).toBe(0.45); // rr==bb, no branch fires
  });

  it("stays within [0, 1] for every branch", () => {
    for (const hex of ["#000000", "#ffffff", "#ff0000", "#00ff00", "#0000ff"]) {
      const t = hexToRampT(hex);
      expect(t).toBeGreaterThanOrEqual(0);
      expect(t).toBeLessThanOrEqual(1);
    }
  });
});

describe("PHOTO_TYPE", () => {
  it("excludes star, constellation, and blackhole — matches space-engine.js's PHOTO_T (no such keys)", () => {
    expect(PHOTO_TYPE.star).toBeUndefined();
    expect(PHOTO_TYPE.constellation).toBeUndefined();
    expect(PHOTO_TYPE.blackhole).toBeUndefined();
  });

  it("includes every type the archived engine's photo layer draws", () => {
    expect(PHOTO_TYPE).toEqual({
      planet: 1,
      moon: 1,
      dwarf: 1,
      nebula: 2,
      galaxy: 3,
      cluster: 4,
      deepfield: 6,
    });
  });
});

describe("isPhotoEligible", () => {
  const atlasMap = {
    m42: [0, 0, 0.1, 0.1] as [number, number, number, number],
  };

  it("requires img, an atlas cell, AND a photo-eligible type — all three", () => {
    expect(
      isPhotoEligible(
        entry({ id: "m42", t: "nebula", img: "assets/dso/m42.webp" }),
        atlasMap,
      ),
    ).toBe(true);
    expect(
      isPhotoEligible(entry({ id: "m42", t: "nebula", img: null }), atlasMap),
    ).toBe(false);
    expect(
      isPhotoEligible(
        entry({ id: "unmapped", t: "nebula", img: "x.jpg" }),
        atlasMap,
      ),
    ).toBe(false);
    expect(
      isPhotoEligible(entry({ id: "m42", t: "star", img: "x.jpg" }), atlasMap),
    ).toBe(false);
  });

  it("is false when the atlas map itself is missing (no runtime composition to fall back on)", () => {
    expect(
      isPhotoEligible(entry({ id: "m42", t: "nebula", img: "x.jpg" }), null),
    ).toBe(false);
  });
});

describe("photoSizeBoost", () => {
  it("matches space-engine.js's _buildPhotoQuads boost table for the base type", () => {
    // type 1 (globe) never gets the legendary multiplier — verified separately
    expect(photoSizeBoost(1, "rare")).toBeCloseTo(1.5);
    expect(photoSizeBoost(2, "rare")).toBeCloseTo(3.4);
    expect(photoSizeBoost(3, "rare")).toBeCloseTo(3.2);
    expect(photoSizeBoost(4, "rare")).toBeCloseTo(2.5);
    expect(photoSizeBoost(5, "rare")).toBeCloseTo(2.7);
    expect(photoSizeBoost(6, "rare")).toBeCloseTo(2.1); // deepfield falls to the else branch
  });

  it("applies the legendary x1.3 multiplier, except on the rotating-globe type", () => {
    expect(photoSizeBoost(2, "legendary")).toBeCloseTo(3.4 * 1.3);
    expect(photoSizeBoost(1, "legendary")).toBeCloseTo(1.5); // globe: no multiplier
  });

  it("applies uncommon x0.72 and common x0.52", () => {
    expect(photoSizeBoost(2, "uncommon")).toBeCloseTo(3.4 * 0.72);
    expect(photoSizeBoost(2, "common")).toBeCloseTo(3.4 * 0.52);
  });
});

describe("seedForIndex", () => {
  it("is deterministic and in [0, 1)", () => {
    for (let i = 0; i < 50; i++) {
      const s = seedForIndex(i);
      expect(s).toBe(seedForIndex(i));
      expect(s).toBeGreaterThanOrEqual(0);
      expect(s).toBeLessThan(1);
    }
  });

  it("varies across indices (not a constant)", () => {
    const seeds = new Set(
      Array.from({ length: 20 }, (_, i) => seedForIndex(i)),
    );
    expect(seeds.size).toBeGreaterThan(10);
  });
});

describe("isRingedBody", () => {
  it("is true only for saturn", () => {
    expect(isRingedBody("saturn")).toBe(true);
    expect(isRingedBody("jupiter")).toBe(false);
    expect(isRingedBody("m42")).toBe(false);
  });
});

describe("buildProceduralBodyBillboards", () => {
  const src = (n: number): ProceduralBodySource[] =>
    Array.from({ length: n }, (_, i) => ({
      id: `b${i}`,
      pos: [i, i * 2, i * 3] as [number, number, number],
      t: "star",
      r: "rare",
      c: "#ffd54f",
      sp: null,
    }));

  it("4 verts + 6 indices per body, centre repeated across the quad", () => {
    const bodies = src(30);
    const b = buildProceduralBodyBillboards(bodies);
    expect(b.count).toBe(30);
    expect(b.vertexCount).toBe(120);
    expect(b.positions).toHaveLength(360);
    expect(b.meta).toHaveLength(480); // 120 verts * 4 floats
    expect(b.indices).toHaveLength(180);

    for (let i = 0; i < bodies.length; i++) {
      for (let c = 0; c < 4; c++) {
        const v = i * 4 + c;
        expect(b.positions[v * 3]).toBe(bodies[i].pos[0]);
        expect(b.positions[v * 3 + 1]).toBe(bodies[i].pos[1]);
        expect(b.positions[v * 3 + 2]).toBe(bodies[i].pos[2]);
        expect(b.meta[v * 4 + 1]).toBe(0); // star type code
        expect(b.meta[v * 4 + 2]).toBe(130); // rare size boost
      }
      for (let k = 0; k < 6; k++) {
        const idx = b.indices[i * 6 + k];
        expect(idx).toBeGreaterThanOrEqual(i * 4);
        expect(idx).toBeLessThan(i * 4 + 4);
      }
    }
  });

  it("uses Uint32Array indices at the real 2,500-body catalog scale (matches star-field.ts's convention, even though this count alone doesn't need it)", () => {
    const b = buildProceduralBodyBillboards(src(2500));
    expect(b.indices).toBeInstanceOf(Uint32Array);
    expect(b.vertexCount).toBe(10000);
    expect(Math.max(...Array.from(b.indices.slice(-6)))).toBe(9999);
  });

  it("handles an empty catalog without throwing", () => {
    const b = buildProceduralBodyBillboards([]);
    expect(b.count).toBe(0);
    expect(b.vertexCount).toBe(0);
    expect(b.positions).toHaveLength(0);
  });
});

describe("buildPhotoBodyBillboards", () => {
  const src = (n: number): PhotoBodySource[] =>
    Array.from({ length: n }, (_, i) => ({
      id: i === 0 ? "saturn" : `p${i}`,
      pos: [i, 0, 0] as [number, number, number],
      t: "nebula",
      r: "epic",
      sp: null,
      cell: [0.1, 0.2, 0.05, 0.05] as [number, number, number, number],
      index: i,
    }));

  it("4 verts + 6 indices per body; the atlas cell repeats per corner", () => {
    const bodies = src(10);
    const b = buildPhotoBodyBillboards(bodies);
    expect(b.count).toBe(10);
    expect(b.vertexCount).toBe(40);
    expect(b.cells).toHaveLength(160); // 40 verts * 4 floats
    expect(b.meta).toHaveLength(160);
    for (let c = 0; c < 4; c++) {
      const v = 4 + c; // body index 1
      expect(b.cells[v * 4]).toBeCloseTo(0.1);
      expect(b.cells[v * 4 + 1]).toBeCloseTo(0.2);
    }
  });

  it("flags the ring body (+0.5 on the type slot) and leaves everyone else unflagged", () => {
    const b = buildPhotoBodyBillboards(src(3));
    // body 0 is "saturn" (id set above), type nebula -> photoType 2, +0.5 ring.
    // Each body occupies 4 vertices * 4 meta floats; slot 1 within a vertex
    // is the type(+ring) field, so body i's first vertex reads at (i*4)*4+1.
    expect(b.meta[0 * 16 + 1]).toBeCloseTo(2.5);
    expect(b.meta[1 * 16 + 1]).toBeCloseTo(2); // body 1: no ring flag
  });

  it("sizeBoost slot uses the RARITY table, not the type-based photo boost", () => {
    const b = buildPhotoBodyBillboards(src(1));
    expect(b.meta[0]).toBe(RARITY_SIZE_BOOST.epic); // slot 0 = sizeB
    expect(b.meta[3]).not.toBe(RARITY_SIZE_BOOST.epic); // slot 3 = boost, a different quantity
  });
});

describe("partitionCelestialBodies", () => {
  it("splits photo-eligible bodies out; everything else stays procedural", () => {
    const atlasMap = {
      m42: [0, 0, 0.1, 0.1] as [number, number, number, number],
    };
    const placed = [
      {
        pos: [1, 0, 0] as [number, number, number],
        e: entry({ id: "m42", t: "nebula", img: "x" }),
      },
      {
        pos: [2, 0, 0] as [number, number, number],
        e: entry({ id: "sirius", t: "star" }),
      },
      // has img but no atlas cell -> procedural
      {
        pos: [3, 0, 0] as [number, number, number],
        e: entry({ id: "no-cell", t: "galaxy", img: "y" }),
      },
    ];
    const { procedural, photo } = partitionCelestialBodies(placed, atlasMap);
    expect(photo).toHaveLength(1);
    expect(photo[0].e.id).toBe("m42");
    expect(photo[0].cell).toEqual([0, 0, 0.1, 0.1]);
    expect(procedural).toHaveLength(2);
    expect(procedural.map((p) => p.e.id)).toEqual(["sirius", "no-cell"]);
  });

  it("everything is procedural when there is no atlas map at all", () => {
    const placed = [
      {
        pos: [0, 0, 0] as [number, number, number],
        e: entry({ id: "m42", t: "nebula", img: "x" }),
      },
    ];
    const { procedural, photo } = partitionCelestialBodies(placed, null);
    expect(photo).toHaveLength(0);
    expect(procedural).toHaveLength(1);
  });
});

describe("shader source", () => {
  const PROCEDURAL = [
    PROCEDURAL_BODY_VERTEX_WGSL,
    PROCEDURAL_BODY_FRAGMENT_WGSL,
  ];
  const PHOTO = [PHOTO_BODY_VERTEX_WGSL, PHOTO_BODY_FRAGMENT_WGSL];

  it("TR-045 guard: no reserved WGSL identifiers appear as words in any twin", () => {
    for (const src of [...PROCEDURAL, ...PHOTO]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("TR-047 guard: the photo fragment WGSL samples the texture exactly once, unconditionally before any branch", () => {
    const src = PHOTO_BODY_FRAGMENT_WGSL;
    expect(src.match(/textureSample\(/g)).toHaveLength(1);
    const sampleIdx = src.indexOf("textureSample(");
    const firstIf = src.indexOf("if (isGlobe)");
    expect(sampleIdx).toBeGreaterThan(0);
    expect(firstIf).toBeGreaterThan(sampleIdx); // sample precedes the branch
  });

  it("GLSL twin also samples exactly once, matching the WGSL structure", () => {
    expect(PHOTO_BODY_FRAGMENT_GLSL.match(/texture2D\(/g)).toHaveLength(1);
  });

  it("procedural VERTEX twins stay structurally parallel: same type-boundary literals in both languages", () => {
    for (const boundary of ["1.5", "2.5", "3.5", "4.5", "5.5", "6.5", "7.5"]) {
      expect(PROCEDURAL_BODY_VERTEX_GLSL).toContain(boundary);
      expect(PROCEDURAL_BODY_VERTEX_WGSL).toContain(boundary);
    }
  });

  it("procedural FRAGMENT twins stay structurally parallel: every named per-type case appears in both languages", () => {
    // The fragment shader is where the real per-type complexity lives (each
    // object class gets its own visual treatment) — this is the twin whose
    // divergence would actually be visible.
    for (const literal of [
      "7.5", // black hole
      "6.5", // star / constellation anchor upper bound
      "0.40", // black hole photon-ring radius
      "0.13", // nebula lobe offset 1
      "3.4", // galaxy disc y-stretch
      "43758.5453", // hash constant, shared by hash2 in both languages
    ]) {
      expect(PROCEDURAL_BODY_FRAGMENT_GLSL).toContain(literal);
      expect(PROCEDURAL_BODY_FRAGMENT_WGSL).toContain(literal);
    }
  });

  it("photo twins stay structurally parallel: same key constants in both languages", () => {
    for (const k of ["0.15915494", "0.31830988", "1.9", "0.58"]) {
      expect(PHOTO_BODY_VERTEX_GLSL + PHOTO_BODY_FRAGMENT_GLSL).toContain(k);
      expect(PHOTO_BODY_VERTEX_WGSL + PHOTO_BODY_FRAGMENT_WGSL).toContain(k);
    }
  });

  it("both procedural and photo vertex shaders derive the quad corner from the vertex id, no stored corner attribute", () => {
    expect(PROCEDURAL_BODY_VERTEX_GLSL).toContain("gl_VertexID % 4");
    expect(PHOTO_BODY_VERTEX_GLSL).toContain("gl_VertexID % 4");
    expect(PROCEDURAL_BODY_VERTEX_WGSL).toContain("vertexIndex % 4u");
    expect(PHOTO_BODY_VERTEX_WGSL).toContain("vertexIndex % 4u");
  });
});
