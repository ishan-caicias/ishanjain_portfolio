/**
 * PF-09 B3 — volumetric nebulae: placement, raymarch mirrors, and generated
 * shader-source structure (including the TR-045 WGSL reserved-word guard).
 */
import { describe, expect, it } from "vitest";
import {
  NEBULA_MARCH,
  NEBULA_RADIUS_FACTOR,
  NEBULA_REVEAL,
  NEBULA_VOLUMES,
  WGSL_RESERVED_IDENTIFIERS,
  expDamp,
  fbm3,
  hash3,
  marchNebula,
  nebulaDensity,
  nebulaGlslFragment,
  nebulaRevealTarget,
  nebulaWgslCompute,
  quatRotate,
  raySphere,
  shapeQ,
  topTwoReveal,
  valueNoise3,
} from "@/lib/nebula-field";
import {
  ARRIVE_STANDOFF,
  NEBULA_ARRIVE_STANDOFF_FACTOR,
  ZOOM_MIN_MULT,
  bodyWorldPosition,
  quatFromAxisAngle,
} from "@/lib/ship-dynamics";

/** The catalog anchors the volumes must sit on — duplicated from
 * celestial-catalog.js / celestial-extra.js / celestial-extra2.js /
 * celestial-ngc2000.js (which aren't importable modules; they populate
 * window.CELESTIAL as scripts). If a catalog entry moves, this test states
 * the drift explicitly instead of the volume silently detaching from where
 * travelTo() goes. The 7 objects added 2026-07-20 (ADR-0004 amendment) each
 * anchor to whichever real catalog entry actually carries the id travelTo()
 * would reach — see nebula-field.ts's own header comment on NEBULA_SOURCES
 * for why (several of these real objects exist twice in this repo's data:
 * once hand-curated, once via the bulk NGC2000 pipeline). */
const CATALOG_ANCHORS: Record<string, { ra: number; dec: number; ly: number }> =
  {
    m42: { ra: 83.822, dec: -5.391, ly: 1344 },
    ngc7293: { ra: 337.411, dec: -20.837, ly: 655 },
    veil: { ra: 311.75, dec: 30.71, ly: 2400 },
    rosette: { ra: 97.98, dec: 4.94, ly: 5200 },
    ngc6543: { ra: 269.639, dec: 66.633, ly: 3300 },
    "ngc2000-box-nebula": { ra: 258.5254, dec: -12.9167, ly: 8515.82 },
    ngc6302: { ra: 258.436, dec: -37.104, ly: 3400 },
    "ngc2000-hourglass-nebula": { ra: 204.8736, dec: -67.3774, ly: 7999.99 },
    m1: { ra: 83.63, dec: 22.01, ly: 6500 },
    m57: { ra: 283.396, dec: 33.029, ly: 2280 },
    ngc6514: { ra: 270.62, dec: -22.972, ly: 4100 },
  };

describe("NEBULA_VOLUMES", () => {
  it("defines 11 volumes with unique catalog ids", () => {
    expect(NEBULA_VOLUMES).toHaveLength(11);
    const ids = NEBULA_VOLUMES.map((v) => v.id);
    expect(new Set(ids).size).toBe(11);
    for (const id of ids) expect(CATALOG_ANCHORS[id]).toBeDefined();
  });

  it("anchors every volume exactly where travelTo() places the body", () => {
    for (const v of NEBULA_VOLUMES) {
      const a = CATALOG_ANCHORS[v.id];
      const { pos, depth } = bodyWorldPosition(a.ra, a.dec, a.ly);
      expect(v.center[0]).toBeCloseTo(pos[0], 10);
      expect(v.center[1]).toBeCloseTo(pos[1], 10);
      expect(v.center[2]).toBeCloseTo(pos[2], 10);
      expect(v.radius).toBeCloseTo(depth * NEBULA_RADIUS_FACTOR, 10);
      expect(v.radius).toBeGreaterThan(0);
    }
  });

  it("keeps colours in [0,1] and seeds distinct", () => {
    const seeds = new Set<number>();
    for (const v of NEBULA_VOLUMES) {
      for (const c of [...v.colA, ...v.colB]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
      seeds.add(v.seed);
    }
    expect(seeds.size).toBe(NEBULA_VOLUMES.length);
  });
});

describe("quatRotate", () => {
  it("identity leaves a vector unchanged", () => {
    const v = quatRotate([0, 0, 0, 1], [3, -2, 5]);
    expect(v[0]).toBeCloseTo(3, 10);
    expect(v[1]).toBeCloseTo(-2, 10);
    expect(v[2]).toBeCloseTo(5, 10);
  });

  it("90° about Y maps +Z to +X (left-handed, matches Babylon's frame)", () => {
    const q = quatFromAxisAngle([0, 1, 0], Math.PI / 2);
    const v = quatRotate(q, [0, 0, 1]);
    expect(v[0]).toBeCloseTo(1, 6);
    expect(v[1]).toBeCloseTo(0, 6);
    expect(v[2]).toBeCloseTo(0, 6);
  });

  it("preserves length for arbitrary rotations", () => {
    const q = quatFromAxisAngle([0.6, 0.64, 0.48], 1.234);
    const v = quatRotate(q, [1, 2, 3]);
    expect(Math.hypot(...v)).toBeCloseTo(Math.hypot(1, 2, 3), 6);
  });
});

describe("noise stack (hash3 / valueNoise3 / fbm3)", () => {
  it("hash3 stays in [0,1) and is deterministic", () => {
    for (let i = 0; i < 200; i++) {
      const h = hash3(i * 0.7, i * -1.3, i * 2.1, 3.1);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(1);
    }
    expect(hash3(1.5, 2.5, 3.5, 7)).toBe(hash3(1.5, 2.5, 3.5, 7));
    expect(hash3(1.5, 2.5, 3.5, 7)).not.toBe(hash3(1.5, 2.5, 3.5, 8));
  });

  it("valueNoise3 stays in [0,1] and is continuous", () => {
    for (let i = 0; i < 100; i++) {
      const n = valueNoise3(i * 0.31, i * 0.17, i * 0.53, 5);
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThanOrEqual(1);
    }
    // continuity: a tiny step moves the value only a tiny amount
    const a = valueNoise3(4.3, 2.7, 8.1, 5);
    const b = valueNoise3(4.3 + 1e-4, 2.7, 8.1, 5);
    expect(Math.abs(a - b)).toBeLessThan(1e-2);
  });

  it("fbm3 stays within its geometric-series bound", () => {
    // 4 octaves at gain 0.5 from amp 0.5: max 0.5+0.25+0.125+0.0625 = 0.9375
    for (let i = 0; i < 100; i++) {
      const f = fbm3(i * 0.4, -i * 0.9, i * 1.7, 12.9);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThanOrEqual(0.9375);
    }
  });
});

describe("raySphere", () => {
  it("returns null when the line never crosses the sphere", () => {
    expect(raySphere([0, 0, 0], [1, 0, 0], [0, 50, 0], 10)).toBeNull();
  });

  it("reports a sphere behind the origin with both t negative (the march culls it)", () => {
    // raySphere intersects the infinite LINE; behind-the-ray hits surface as
    // t1 < 0, which marchNebula and both shader twins cull via t1 <= max(t0,0).
    const hit = raySphere([0, 0, 0], [0, 0, -1], [0, 0, 100], 10);
    expect(hit).not.toBeNull();
    expect(hit![1]).toBeLessThan(0);
  });

  it("hits through the centre with chord length 2r", () => {
    const hit = raySphere([0, 0, 0], [0, 0, 1], [0, 0, 100], 25);
    expect(hit).not.toBeNull();
    const [t0, t1] = hit!;
    expect(t0).toBeCloseTo(75, 6);
    expect(t1).toBeCloseTo(125, 6);
  });

  it("reports t0 < 0 < t1 when the origin is inside the sphere", () => {
    const hit = raySphere([0, 0, 0], [0, 0, 1], [0, 0, 5], 20);
    expect(hit).not.toBeNull();
    const [t0, t1] = hit!;
    expect(t0).toBeLessThan(0);
    expect(t1).toBeGreaterThan(0);
  });
});

describe("nebulaDensity", () => {
  const vol = NEBULA_VOLUMES[0];

  it("is exactly 0 at and beyond the rim", () => {
    const dir = [1, 0, 0] as [number, number, number];
    for (const k of [1.0, 1.01, 2, 10]) {
      const p: [number, number, number] = [
        vol.center[0] + dir[0] * vol.radius * k,
        vol.center[1],
        vol.center[2],
      ];
      expect(nebulaDensity(p, vol, 0)).toBe(0);
    }
  });

  it("is non-negative everywhere and positive somewhere inside", () => {
    let maxD = 0;
    for (let i = 0; i < 500; i++) {
      // deterministic pseudo-random probe points inside the sphere
      const u = hash3(i, 0, 0, 1) * 2 - 1;
      const th = hash3(0, i, 0, 1) * Math.PI * 2;
      const rr = Math.cbrt(hash3(0, 0, i, 1)) * vol.radius * 0.95;
      const s = Math.sqrt(Math.max(0, 1 - u * u));
      const p: [number, number, number] = [
        vol.center[0] + Math.cos(th) * s * rr,
        vol.center[1] + Math.sin(th) * s * rr,
        vol.center[2] + u * rr,
      ];
      const d = nebulaDensity(p, vol, 0);
      expect(d).toBeGreaterThanOrEqual(0);
      maxD = Math.max(maxD, d);
    }
    expect(maxD).toBeGreaterThan(0);
  });

  it("drifts with time but stays static at t=0 (reduced-motion pin)", () => {
    // find a point with positive density, then check time moves it
    let p: [number, number, number] | null = null;
    for (let i = 0; i < 500 && !p; i++) {
      const cand: [number, number, number] = [
        vol.center[0] + (hash3(i, 1, 2, 9) - 0.5) * vol.radius,
        vol.center[1] + (hash3(i, 3, 4, 9) - 0.5) * vol.radius,
        vol.center[2] + (hash3(i, 5, 6, 9) - 0.5) * vol.radius,
      ];
      if (nebulaDensity(cand, vol, 0) > 0.01) p = cand;
    }
    expect(p).not.toBeNull();
    expect(nebulaDensity(p!, vol, 0)).toBe(nebulaDensity(p!, vol, 0));
    expect(nebulaDensity(p!, vol, 300)).not.toBe(nebulaDensity(p!, vol, 0));
  });
});

describe("marchNebula", () => {
  const vol = NEBULA_VOLUMES[0];
  const centreDir = (() => {
    const l = Math.hypot(...vol.center);
    return [vol.center[0] / l, vol.center[1] / l, vol.center[2] / l] as [
      number,
      number,
      number,
    ];
  })();

  it("returns zero for a ray that misses every part of the volume", () => {
    const away: [number, number, number] = [
      -centreDir[0],
      -centreDir[1],
      -centreDir[2],
    ];
    expect(marchNebula([0, 0, 0], away, vol, 0, 40)).toEqual([0, 0, 0, 0]);
  });

  it("accumulates emission and bounded coverage through the centre", () => {
    const [r, g, b, cover] = marchNebula([0, 0, 0], centreDir, vol, 0, 40);
    expect(cover).toBeGreaterThan(0);
    expect(cover).toBeLessThanOrEqual(1);
    for (const c of [r, g, b]) {
      expect(c).toBeGreaterThanOrEqual(0);
      expect(Number.isFinite(c)).toBe(true);
      // emission is transmittance-weighted, so it can never exceed
      // brightness × max colour channel (1.0) × total absorbed fraction (≤1)
      expect(c).toBeLessThanOrEqual(NEBULA_MARCH.brightness);
    }
  });

  it("roughly converges as step count rises (not step-count-dominated)", () => {
    const lo = marchNebula([0, 0, 0], centreDir, vol, 0, 18);
    const hi = marchNebula([0, 0, 0], centreDir, vol, 0, 72);
    // fallback tier (18 steps) must stay in the same visual ballpark as a
    // high-step march — "fallback tier still coherent" made quantitative
    expect(Math.abs(lo[3] - hi[3])).toBeLessThan(0.25);
  });
});

describe("nebulaRevealTarget (destination-gated visibility)", () => {
  it("is 0 through the entire accel and flip phases", () => {
    for (const k of [0, 0.1, 0.3, 0.47, 0.5, NEBULA_REVEAL.decelStart]) {
      expect(nebulaRevealTarget(k, null)).toBe(0);
    }
  });

  it("ramps monotonically through the decel burn to decelMax at arrival", () => {
    let prev = 0;
    for (let k = NEBULA_REVEAL.decelStart; k <= 1.0001; k += 0.05) {
      const r = nebulaRevealTarget(Math.min(1, k), null);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
    }
    expect(nebulaRevealTarget(1, null)).toBeCloseTo(NEBULA_REVEAL.decelMax, 6);
  });

  it("swells from decelMax to 1 after the ship stops", () => {
    expect(nebulaRevealTarget(null, 0)).toBeCloseTo(NEBULA_REVEAL.decelMax, 6);
    const mid = nebulaRevealTarget(null, NEBULA_REVEAL.arriveSwellS / 2);
    expect(mid).toBeGreaterThan(NEBULA_REVEAL.decelMax);
    expect(mid).toBeLessThan(1);
    expect(nebulaRevealTarget(null, NEBULA_REVEAL.arriveSwellS)).toBeCloseTo(
      1,
      6,
    );
    expect(nebulaRevealTarget(null, 60)).toBe(1); // clamped, no overshoot
  });

  it("is 0 when neither warping to nor arrived at the volume", () => {
    expect(nebulaRevealTarget(null, null)).toBe(0);
  });
});

describe("expDamp", () => {
  it("converges toward the target and is frame-rate independent", () => {
    // one 0.2s step == two 0.1s steps, exactly (the exp-form guarantee)
    const one = expDamp(1, 0, 2.2, 0.2);
    const two = expDamp(expDamp(1, 0, 2.2, 0.1), 0, 2.2, 0.1);
    expect(one).toBeCloseTo(two, 10);
    expect(one).toBeLessThan(1);
    expect(one).toBeGreaterThan(0);
  });
});

describe("marchNebula reveal gating", () => {
  const vol = NEBULA_VOLUMES[0];
  const l = Math.hypot(...vol.center);
  const dir: [number, number, number] = [
    vol.center[0] / l,
    vol.center[1] / l,
    vol.center[2] / l,
  ];

  it("reveal 0 makes the volume fully invisible even through its centre", () => {
    expect(marchNebula([0, 0, 0], dir, vol, 0, 40, 0)).toEqual([0, 0, 0, 0]);
  });

  it("coverage grows monotonically with reveal (fade-in AND growth)", () => {
    const c25 = marchNebula([0, 0, 0], dir, vol, 0, 40, 0.25)[3];
    const c50 = marchNebula([0, 0, 0], dir, vol, 0, 40, 0.5)[3];
    const c100 = marchNebula([0, 0, 0], dir, vol, 0, 40, 1)[3];
    expect(c25).toBeLessThan(c50);
    expect(c50).toBeLessThan(c100);
    expect(c100).toBeGreaterThan(0);
  });

  it("default reveal is 1 (backward-compatible full visibility)", () => {
    expect(marchNebula([0, 0, 0], dir, vol, 0, 40)).toEqual(
      marchNebula([0, 0, 0], dir, vol, 0, 40, 1),
    );
  });
});

describe("generated shader sources", () => {
  const glsl = nebulaGlslFragment();
  const wgsl = nebulaWgslCompute();

  it("GLSL fragment: fullscreen producer with one generated march function + call per volume", () => {
    expect(glsl).toContain("varying vec2 vUV");
    expect(glsl).toContain("gl_FragColor");
    // one call site (`nebMarchN(uCamPos, ...)`) per volume...
    expect(glsl.match(/nebMarch\d+\(uCamPos/g)).toHaveLength(
      NEBULA_VOLUMES.length,
    );
    // ...backed by one generated `vec4 nebMarchN(...)` function per volume,
    // each with its own march loop (no function pointers in GLSL).
    expect(glsl.match(/vec4 nebMarch\d+\(/g)).toHaveLength(
      NEBULA_VOLUMES.length,
    );
    expect(glsl).toContain(`for (int i = 0; i < ${NEBULA_MARCH.stepsFragment}`);
  });

  it("WGSL compute: storage-texture writer with one generated march function + call per volume", () => {
    expect(wgsl).toContain("@compute @workgroup_size(8, 8, 1)");
    expect(wgsl).toContain("texture_storage_2d<rgba8unorm, write>");
    expect(wgsl).toContain("textureStore");
    expect(wgsl.match(/nebMarch\d+\(params\.camPos/g)).toHaveLength(
      NEBULA_VOLUMES.length,
    );
    expect(wgsl.match(/fn nebMarch\d+\(/g)).toHaveLength(NEBULA_VOLUMES.length);
    expect(wgsl).toContain(`i < ${NEBULA_MARCH.stepsCompute}`);
  });

  it("bakes every volume's exact placement into both sources", () => {
    for (const v of NEBULA_VOLUMES) {
      for (const src of [glsl, wgsl]) {
        expect(src).toContain(v.radius.toFixed(6));
        expect(src).toContain(v.center[0].toFixed(6));
        expect(src).toContain(v.seed.toFixed(6));
      }
    }
  });

  it("TR-045 guard: no reserved WGSL identifiers appear as words", () => {
    for (const word of WGSL_RESERVED_IDENTIFIERS) {
      const re = new RegExp(`\\b${word}\\b`);
      expect(wgsl).not.toMatch(re);
    }
  });

  it("WGSL flips ndc.y (row 0 = top) while GLSL does not — the documented pair convention", () => {
    expect(wgsl).toContain("1.0 - uv.y * 2.0");
    expect(glsl).toContain("vUV * 2.0 - 1.0");
  });

  it("wires the 2-slot active/previous reveal comparison for every volume index in both twins (2026-07-20 amendment)", () => {
    // O(1) in volume count — each call site compares its own literal index
    // against the SAME two runtime uniforms, not a per-volume swizzle/array.
    for (let i = 0; i < NEBULA_VOLUMES.length; i++) {
      const lit = i.toFixed(6);
      expect(glsl).toContain(`${lit} == uVolumeA`);
      expect(glsl).toContain(`${lit} == uVolumeB`);
      expect(wgsl).toContain(`${lit} == params.uVolumeA`);
      expect(wgsl).toContain(`${lit} == params.uVolumeB`);
    }
    expect(glsl).toContain("uniform float uVolumeA");
    expect(glsl).toContain("uniform float uRevealA");
    expect(glsl).toContain("uniform float uVolumeB");
    expect(glsl).toContain("uniform float uRevealB");
    expect(wgsl).toContain("uVolumeA : f32");
    expect(wgsl).toContain("uRevealA : f32");
    expect(wgsl).toContain("uVolumeB : f32");
    expect(wgsl).toContain("uRevealB : f32");
    // the old 4-cap vec4 swizzle uniform is gone entirely (uRevealA/B and
    // uVolumeA/B legitimately CONTAIN the substring "uReveal"/"uVolume", so
    // this checks for the OLD declaration/access forms specifically, not a
    // blanket substring absence)
    expect(glsl).not.toContain("uniform vec4 uReveal");
    expect(glsl).not.toMatch(/uReveal\.[xyzw]/);
    expect(wgsl).not.toContain("uReveal : vec4<f32>");
    expect(wgsl).not.toMatch(/uReveal\.[xyzw]/);
  });

  it("11 volumes exceed the OLD 4-component cap without throwing — the point of the amendment", () => {
    expect(NEBULA_VOLUMES.length).toBeGreaterThan(4);
    expect(() => nebulaGlslFragment()).not.toThrow();
    expect(() => nebulaWgslCompute()).not.toThrow();
  });
});

describe("shapeQ (ADR-0004 2026-07-20 amendment)", () => {
  it("sphere reproduces the original length(p) formula exactly — regression safety for the 4 pre-existing showcase volumes", () => {
    const pts: [number, number, number][] = [
      [0, 0, 0],
      [0.5, 0, 0],
      [0.3, 0.4, 0],
      [1, 1, 1],
      [-0.2, 0.6, -0.1],
    ];
    for (const p of pts) {
      expect(shapeQ({ kind: "sphere" }, p)).toBeCloseTo(
        Math.hypot(p[0], p[1], p[2]),
        12,
      );
    }
  });

  it("torus is 0 on the tube centreline and 1 at the tube surface", () => {
    const shape = {
      kind: "torus" as const,
      majorRadius: 0.5,
      minorRadius: 0.2,
    };
    // a point on the ring's centreline (major radius out in X, y=0, z=0)
    expect(shapeQ(shape, [0.5, 0, 0])).toBeCloseTo(0, 10);
    // a point exactly one minor radius above the centreline -> tube surface
    expect(shapeQ(shape, [0.5, 0.2, 0])).toBeCloseTo(1, 10);
    // the torus's own centre (the hole) is far from the tube -> large q
    expect(shapeQ(shape, [0, 0, 0])).toBeGreaterThan(1);
  });

  it("cappedCone is 999 (culled) past its tip/base ends and small near its lateral surface", () => {
    const shape = {
      kind: "cappedCone" as const,
      dir: [0, 1, 0] as [number, number, number],
      offset: 0,
      height: 1,
      rTip: 0.1,
      rBase: 0.5,
      edge: 0.1,
    };
    expect(shapeQ(shape, [0, -0.5, 0])).toBe(999); // below the tip
    expect(shapeQ(shape, [0, 1.5, 0])).toBe(999); // past the base
    // near the surface at y=0.5 (rAtY interpolates to 0.3)
    expect(shapeQ(shape, [0.3, 0.5, 0])).toBeCloseTo(0, 6);
  });

  it("box is small deep inside and grows outward from the surface", () => {
    const shape = {
      kind: "box" as const,
      halfExtents: [0.4, 0.4, 0.4] as [number, number, number],
      edge: 0.2,
    };
    const centre = shapeQ(shape, [0, 0, 0]);
    const nearSurface = shapeQ(shape, [0.4, 0, 0]);
    const outside = shapeQ(shape, [0.8, 0, 0]);
    expect(centre).toBeLessThan(nearSurface);
    expect(nearSurface).toBeLessThan(outside);
    expect(nearSurface).toBeCloseTo(1, 6);
  });

  it("ellipsoid degenerates to the sphere formula when all semi-axes are equal", () => {
    const shape = {
      kind: "ellipsoid" as const,
      semiAxes: [1, 1, 1] as [number, number, number],
    };
    const p: [number, number, number] = [0.3, 0.4, 0.5];
    expect(shapeQ(shape, p)).toBeCloseTo(Math.hypot(...p), 12);
  });

  it("shell is 0 at its mid-radius and grows toward either edge", () => {
    const shape = { kind: "shell" as const, radius: 0.7, thickness: 0.1 };
    expect(shapeQ(shape, [0.7, 0, 0])).toBeCloseTo(0, 10);
    expect(shapeQ(shape, [0.6, 0, 0])).toBeCloseTo(1, 6); // inner edge
    expect(shapeQ(shape, [0.8, 0, 0])).toBeCloseTo(1, 6); // outer edge
  });

  it("union takes the min of its members (closer/denser wins)", () => {
    const shape = {
      kind: "union" as const,
      shapes: [
        { kind: "sphere" as const },
        { kind: "shell" as const, radius: 5, thickness: 1 }, // always far here
      ],
    };
    const p: [number, number, number] = [0.3, 0, 0];
    expect(shapeQ(shape, p)).toBeCloseTo(shapeQ({ kind: "sphere" }, p), 10);
  });

  it("subtract fully excludes points inside the cut region regardless of the base shape's own q", () => {
    const shape = {
      kind: "subtract" as const,
      base: { kind: "sphere" as const }, // q=0 at centre — normally very dense
      cut: { kind: "sphere" as const }, // same sphere -> centre is "inside the cut"
    };
    expect(shapeQ(shape, [0, 0, 0])).toBe(999);
  });

  it("subtract passes through the base's q untouched outside the cut region", () => {
    const shape = {
      kind: "subtract" as const,
      base: { kind: "sphere" as const },
      cut: { kind: "shell" as const, radius: 5, thickness: 0.1 }, // never triggers near origin
    };
    const p: [number, number, number] = [0.3, 0, 0];
    expect(shapeQ(shape, p)).toBeCloseTo(shapeQ({ kind: "sphere" }, p), 10);
  });
});

describe("nebulaDensity with a non-sphere shape (Ring Nebula's torus+ellipsoid union)", () => {
  it("is nonzero at the volume centre — NOT the torus's empty hole, because the unioned inner ellipsoid is densest exactly there (the real 'football' glow feature)", () => {
    const ring = NEBULA_VOLUMES.find((v) => v.id === "m57")!;
    expect(nebulaDensity(ring.center, ring, 0)).toBeGreaterThan(0);
  });

  it("is exactly 0 well beyond the shape's overall bounding radius", () => {
    const ring = NEBULA_VOLUMES.find((v) => v.id === "m57")!;
    const p: [number, number, number] = [
      ring.center[0] + ring.radius * 2,
      ring.center[1],
      ring.center[2],
    ];
    expect(nebulaDensity(p, ring, 0)).toBe(0);
  });

  it("is non-negative everywhere sampled and positive somewhere near the torus tube", () => {
    const ring = NEBULA_VOLUMES.find((v) => v.id === "m57")!;
    let maxD = 0;
    for (let i = 0; i < 300; i++) {
      const theta = hash3(i, 0, 0, 3) * Math.PI * 2;
      const p: [number, number, number] = [
        ring.center[0] + Math.cos(theta) * ring.radius * 0.55,
        ring.center[1],
        ring.center[2] + Math.sin(theta) * ring.radius * 0.55,
      ];
      const d = nebulaDensity(p, ring, 0);
      expect(d).toBeGreaterThanOrEqual(0);
      maxD = Math.max(maxD, d);
    }
    expect(maxD).toBeGreaterThan(0);
  });
});

describe("topTwoReveal", () => {
  it("returns -1/0 slots when every reveal is 0", () => {
    expect(topTwoReveal([0, 0, 0])).toEqual({
      volA: -1,
      revealA: 0,
      volB: -1,
      revealB: 0,
    });
  });

  it("fills slot A with the single nonzero entry, leaves B unused", () => {
    expect(topTwoReveal([0, 0.8, 0])).toEqual({
      volA: 1,
      revealA: 0.8,
      volB: -1,
      revealB: 0,
    });
  });

  it("picks the top 2 by value, A >= B, regardless of index order", () => {
    const r = topTwoReveal([0.2, 0.9, 0, 0.5]);
    expect(r.volA).toBe(1);
    expect(r.revealA).toBe(0.9);
    expect(r.volB).toBe(3);
    expect(r.revealB).toBe(0.5);
  });

  it("gracefully drops a 3rd nonzero entry rather than crashing", () => {
    const r = topTwoReveal([0.9, 0.5, 0.7]);
    expect(r.volA).toBe(0);
    expect(r.revealA).toBe(0.9);
    expect(r.volB).toBe(2);
    expect(r.revealB).toBe(0.7);
    // index 1 (0.5) is real but dropped — documented graceful degradation
  });
});

/**
 * PF-11 post-D8 (TR-115) — the invariant this suite was MISSING, and whose absence let a P0
 * ship: nothing anywhere related the arrival standoff to the rendered volume's own radius.
 * `nebula-field.test.ts` even pinned `radius === depth * NEBULA_RADIUS_FACTOR` — the very
 * number that caused the overshoot — without ever comparing it to a standoff, and every DSO
 * arrival E2E spec asserted only `arrivedId === "m42"`. So the whole suite stayed green while
 * the camera parked at 0.42-0.53 of the volume radius from the core, i.e. inside the gas.
 */
describe("volumetric arrival standoff (Astra SCIENCE-BRIEF + Vega SHOT-BRIEF, 2026-07-29)", () => {
  it("parks the camera OUTSIDE every shipped volume, and keeps it outside even fully zoomed in", () => {
    expect(NEBULA_VOLUMES.length).toBeGreaterThan(0);
    for (const v of NEBULA_VOLUMES) {
      const standoff = v.radius * NEBULA_ARRIVE_STANDOFF_FACTOR;
      // The arrival itself is clear of the gas.
      expect(standoff, `${v.id} arrival is outside the volume`).toBeGreaterThan(
        v.radius,
      );
      // ...and so is the closest the visitor can hand-zoom to. This is the binding constraint:
      // `clampZoomDistance` floors a non-planet target at `restDist * ZOOM_MIN_MULT`, so a
      // factor below 1/ZOOM_MIN_MULT would let the visitor zoom straight back inside by hand.
      expect(
        standoff * ZOOM_MIN_MULT,
        `${v.id} stays outside the volume at maximum zoom-in`,
      ).toBeGreaterThan(v.radius);
    }
  });

  it("the OLD fixed standoff would have been inside every one of them — this is not a no-op", () => {
    // Documents the defect numerically so a future "simplification" back to a fixed distance
    // fails loudly rather than silently reintroducing it.
    for (const v of NEBULA_VOLUMES) {
      expect(
        ARRIVE_STANDOFF,
        `${v.id} was overshot at the old 38`,
      ).toBeLessThan(v.radius);
    }
  });

  it("the factor sits inside Astra's signed-off physics band AND clears Vega's zoom floor", () => {
    // Astra: 2.5-4.0 volume radii is the defensible viewing band (hard physics floor 1.5).
    expect(NEBULA_ARRIVE_STANDOFF_FACTOR).toBeGreaterThanOrEqual(2.5);
    expect(NEBULA_ARRIVE_STANDOFF_FACTOR).toBeLessThanOrEqual(4.0);
    // Vega: the zoom floor forces >= 1/ZOOM_MIN_MULT. 3.5 is the only value satisfying both,
    // which is why it is derived rather than chosen.
    expect(NEBULA_ARRIVE_STANDOFF_FACTOR).toBeGreaterThanOrEqual(
      1 / ZOOM_MIN_MULT,
    );
  });

  it("the reveal is essentially complete at rest, so the cloud is not still building under the dossier", () => {
    // The tail half of the same re-key: with the ship stopping outside the cloud there is no
    // final loom left to carry a low arrival level.
    expect(NEBULA_REVEAL.decelMax).toBeGreaterThanOrEqual(0.85);
    // decelStart must NOT move — it is coupled to the D3.2 flip window (ADR-0011).
    expect(NEBULA_REVEAL.decelStart).toBeCloseTo(0.56, 6);
  });
});
