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
  valueNoise3,
} from "@/lib/nebula-field";
import { bodyWorldPosition, quatFromAxisAngle } from "@/lib/ship-dynamics";

/** The catalog anchors the volumes must sit on — duplicated from
 * celestial-catalog.js / celestial-extra.js (which aren't importable modules;
 * they populate window.CELESTIAL as scripts). If a catalog entry moves, this
 * test states the drift explicitly instead of the volume silently detaching
 * from where travelTo() goes. */
const CATALOG_ANCHORS: Record<string, { ra: number; dec: number; ly: number }> =
  {
    m42: { ra: 83.822, dec: -5.391, ly: 1344 },
    ngc7293: { ra: 337.411, dec: -20.837, ly: 655 },
    veil: { ra: 311.75, dec: 30.71, ly: 2400 },
    rosette: { ra: 97.98, dec: 4.94, ly: 5200 },
  };

describe("NEBULA_VOLUMES", () => {
  it("defines 4 volumes with unique catalog ids", () => {
    expect(NEBULA_VOLUMES).toHaveLength(4);
    const ids = NEBULA_VOLUMES.map((v) => v.id);
    expect(new Set(ids).size).toBe(4);
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

  it("GLSL fragment: fullscreen producer with one call per volume", () => {
    expect(glsl).toContain("varying vec2 vUV");
    expect(glsl).toContain("gl_FragColor");
    expect(glsl.match(/nebMarch\(uCamPos/g)).toHaveLength(
      NEBULA_VOLUMES.length,
    );
    expect(glsl).toContain(`for (int i = 0; i < ${NEBULA_MARCH.stepsFragment}`);
  });

  it("WGSL compute: storage-texture writer with one call per volume", () => {
    expect(wgsl).toContain("@compute @workgroup_size(8, 8, 1)");
    expect(wgsl).toContain("texture_storage_2d<rgba8unorm, write>");
    expect(wgsl).toContain("textureStore");
    expect(wgsl.match(/nebMarch\(params\.camPos/g)).toHaveLength(
      NEBULA_VOLUMES.length,
    );
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

  it("wires the per-volume reveal swizzles in NEBULA_VOLUMES order in both twins", () => {
    const sw = ["x", "y", "z", "w"];
    for (let i = 0; i < NEBULA_VOLUMES.length; i++) {
      expect(glsl).toContain(`uReveal.${sw[i]}`);
      expect(wgsl).toContain(`params.uReveal.${sw[i]}`);
    }
    expect(glsl).toContain("uniform vec4 uReveal");
    expect(wgsl).toContain("uReveal : vec4<f32>");
  });
});
