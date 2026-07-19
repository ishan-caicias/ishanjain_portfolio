/**
 * PF-09 B3 — ship track pure math: flip-and-burn choreography, plume phase
 * mapping, docking fade, and the unit-ship → wrapper-space plume transform.
 */
import { describe, expect, it } from "vitest";
import {
  DOCK_CONTACT,
  DOCK_FADE_S,
  DOCK_HOLD_S,
  dockFade,
  dockSettleOffset,
  EMBER_BURST_START,
  EMBER_BURST_STOP,
  emberBillboards,
  EMBER_FRAGMENT_GLSL,
  EMBER_FRAGMENT_WGSL,
  emberIndices,
  EMBER_VERTEX_GLSL,
  EMBER_VERTEX_WGSL,
  flipPhase,
  MAX_EMBERS,
  plumeBuffersForWrapper,
  plumeIndices,
  plumeParamsForWarp,
  plumeParamsIdle,
  PLUME_FRAGMENT_GLSL,
  PLUME_FRAGMENT_WGSL,
  SHIMMER_FRAGMENT_GLSL,
  SHIMMER_FRAGMENT_WGSL,
  spawnEmberLocal,
  WARP_ACCEL_END,
  WARP_DECEL_START,
} from "@/lib/babylon-ship";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";
import {
  buildPlumeVertices,
  PLUME_CORE,
  PLUME_ENGINES,
  PLUME_SHEATH,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
  stepEmber,
  type Ember,
} from "@/lib/ship-dynamics";

describe("flipPhase", () => {
  it("is 0 through the accel burn and 1 through the decel burn", () => {
    for (const k of [0, 0.2, WARP_ACCEL_END]) expect(flipPhase(k)).toBe(0);
    for (const k of [WARP_DECEL_START, 0.7, 1]) expect(flipPhase(k)).toBe(1);
  });

  it("ramps monotonically across the flip window", () => {
    let prev = 0;
    for (let k = WARP_ACCEL_END; k <= WARP_DECEL_START; k += 0.005) {
      const f = flipPhase(k);
      expect(f).toBeGreaterThanOrEqual(prev);
      expect(f).toBeLessThanOrEqual(1);
      prev = f;
    }
    expect(flipPhase((WARP_ACCEL_END + WARP_DECEL_START) / 2)).toBeCloseTo(
      0.5,
      6,
    );
  });

  it("matches the HUD's own phase thresholds exactly", () => {
    // babylon-engine.ts `wphase`: accel < 0.47, flip < 0.53 — a drift here
    // would show the hull burning while the HUD says FLIP & BURN
    expect(WARP_ACCEL_END).toBe(0.47);
    expect(WARP_DECEL_START).toBe(0.53);
  });
});

describe("plume phase mapping", () => {
  it("burns on accel and decel, coasts across the flip", () => {
    expect(plumeParamsForWarp(0.2, false, 1).burning).toBe(true);
    expect(plumeParamsForWarp(0.2, false, 1).coasting).toBe(false);
    expect(plumeParamsForWarp(0.5, false, 1).coasting).toBe(true);
    expect(plumeParamsForWarp(0.5, false, 1).burning).toBe(false);
    expect(plumeParamsForWarp(0.9, false, 1).burning).toBe(true);
  });

  it("idle params are the parked phase", () => {
    const p = plumeParamsIdle(false, 2);
    expect(p.parked).toBe(true);
    expect(p.burning).toBe(false);
    expect(p.t).toBe(2);
  });
});

describe("dockFade (docking-approach polish)", () => {
  it("holds at 1 through the berth beat, then fades to 0", () => {
    expect(dockFade(0)).toBe(1);
    expect(dockFade(DOCK_HOLD_S)).toBe(1);
    const mid = dockFade(DOCK_HOLD_S + DOCK_FADE_S / 2);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
    expect(dockFade(DOCK_HOLD_S + DOCK_FADE_S)).toBe(0);
    expect(dockFade(60)).toBe(0);
  });

  it("is monotonically non-increasing", () => {
    let prev = 1;
    for (let t = 0; t <= DOCK_HOLD_S + DOCK_FADE_S + 0.5; t += 0.05) {
      const v = dockFade(t);
      expect(v).toBeLessThanOrEqual(prev + 1e-9);
      prev = v;
    }
  });
});

describe("dockSettleOffset (B4 step 4 — docking contact)", () => {
  it("starts at rest, overshoots into the berth, and rings down", () => {
    expect(dockSettleOffset(0)).toBe(0);
    expect(dockSettleOffset(-1)).toBe(0);
    // first quarter-period swings positive (into the berth)
    const quarter = 1 / (4 * DOCK_CONTACT.settleFreq);
    expect(dockSettleOffset(quarter)).toBeGreaterThan(0);
    // bounded by settleAmp everywhere
    for (let t = 0; t <= 3; t += 0.01) {
      expect(Math.abs(dockSettleOffset(t))).toBeLessThanOrEqual(
        DOCK_CONTACT.settleAmp + 1e-9,
      );
    }
    // effectively at rest after ~5 time constants
    expect(Math.abs(dockSettleOffset(DOCK_CONTACT.settleTau * 5))).toBeLessThan(
      DOCK_CONTACT.settleAmp * 0.01,
    );
  });
});

describe("plumeBuffersForWrapper", () => {
  it("negates Z (unit-ship stern +Z → wrapper −Z) and preserves x/y/meta", () => {
    const flare = 0.55;
    const scratch = new Float32Array(PLUME_VERTEX_COUNT * PLUME_VERTEX_FLOATS);
    const pos = new Float32Array(PLUME_VERTEX_COUNT * 3);
    const meta = new Float32Array(PLUME_VERTEX_COUNT * 2);
    plumeBuffersForWrapper(flare, scratch, pos, meta);
    const raw = buildPlumeVertices(flare);
    for (let i = 0; i < PLUME_VERTEX_COUNT; i++) {
      const s = i * PLUME_VERTEX_FLOATS;
      expect(pos[i * 3]).toBe(raw[s]);
      expect(pos[i * 3 + 1]).toBe(raw[s + 1]);
      expect(pos[i * 3 + 2]).toBe(-raw[s + 2]);
      expect(meta[i * 2]).toBe(raw[s + 3]);
      expect(meta[i * 2 + 1]).toBe(raw[s + 4]);
    }
    // stern cones must sit BEHIND the nose (+Z): all plume z ≤ 0
    for (let i = 0; i < PLUME_VERTEX_COUNT; i++) {
      expect(pos[i * 3 + 2]).toBeLessThanOrEqual(0);
    }
  });

  it("plumeIndices covers every expanded vertex exactly once", () => {
    const idx = plumeIndices();
    expect(idx).toHaveLength(PLUME_VERTEX_COUNT);
    expect(new Set(idx).size).toBe(PLUME_VERTEX_COUNT);
  });
});

describe("ship shader sources", () => {
  it("bakes the live engine's plume colours into both twins", () => {
    for (const src of [PLUME_FRAGMENT_GLSL, PLUME_FRAGMENT_WGSL]) {
      expect(src).toContain(PLUME_CORE[0].toFixed(6));
      expect(src).toContain(PLUME_SHEATH[1].toFixed(6));
    }
  });

  it("TR-045 guard: no reserved WGSL identifiers in the WGSL sources", () => {
    for (const src of [PLUME_FRAGMENT_WGSL, SHIMMER_FRAGMENT_WGSL]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("shimmer twins sample UNCONDITIONALLY — WGSL forbids textureSample in non-uniform control flow", () => {
    // The original zero-intensity early-out branched around the sample and
    // failed WGSL validation on real hardware (GPUValidationError, TR-047).
    // Pass-through is achieved by the offset zeroing, not by branching.
    expect(SHIMMER_FRAGMENT_WGSL.match(/textureSample\(/g)).toHaveLength(1);
    expect(SHIMMER_FRAGMENT_WGSL).not.toContain("if (k");
    expect(SHIMMER_FRAGMENT_GLSL.match(/texture2D\(/g)).toHaveLength(1);
    expect(SHIMMER_FRAGMENT_GLSL).not.toContain("if (k");
  });

  it("GAP-07 TR-045 guard: no reserved WGSL identifiers in the ember twins", () => {
    for (const word of WGSL_RESERVED_IDENTIFIERS) {
      expect(EMBER_VERTEX_WGSL).not.toMatch(new RegExp(`\\b${word}\\b`));
      expect(EMBER_FRAGMENT_WGSL).not.toMatch(new RegExp(`\\b${word}\\b`));
    }
  });

  it("ember twins derive the quad corner from the vertex id, like the star/body billboards", () => {
    expect(EMBER_VERTEX_GLSL).toContain("gl_VertexID % 4");
    expect(EMBER_VERTEX_WGSL).toContain("vertexIndex % 4u");
  });

  it("ember fragment twins discard on both the circular falloff and a zero-alpha slot", () => {
    expect(EMBER_FRAGMENT_GLSL).toContain("discard");
    expect(EMBER_FRAGMENT_GLSL).toContain("vAlpha <= 0.001");
    expect(EMBER_FRAGMENT_WGSL).toContain("discard");
    expect(EMBER_FRAGMENT_WGSL).toContain("vAlpha <= 0.001");
  });
});

describe("GAP-07: ember sparks", () => {
  it("burst counts match space-engine.js's F3 spark burst exactly (14 start / 8 stop)", () => {
    expect(EMBER_BURST_START).toBe(14);
    expect(EMBER_BURST_STOP).toBe(8);
  });

  it("spawnEmberLocal picks a real engine nozzle and jitters within the live engine's bounds", () => {
    for (let i = 0; i < 200; i++) {
      const { pos, vel } = spawnEmberLocal();
      // pos must be within jitter distance of SOME engine nozzle (matches
      // space-engine.js's `eng[0] + (rand-0.5)*0.05` etc.)
      const nearAnEngine = PLUME_ENGINES.some(
        (eng) =>
          Math.abs(pos[0] - eng[0]) <= 0.025 + 1e-9 &&
          Math.abs(pos[1] - eng[1]) <= 0.025 + 1e-9 &&
          Math.abs(pos[2] - eng[2] - 0.05) < 1e-9,
      );
      expect(nearAnEngine).toBe(true);
      // drift-back velocity: away from the nose (+Z in unit-ship space),
      // matches space-engine.js's `vz: 0.9 + Math.random()*1.4`.
      expect(vel[2]).toBeGreaterThanOrEqual(0.9);
      expect(vel[2]).toBeLessThanOrEqual(2.3);
    }
  });

  it("stepEmber (ship-dynamics.ts) integrates spawned embers to death within a bounded lifespan", () => {
    const { pos, vel } = spawnEmberLocal();
    const e: Ember = {
      x: pos[0],
      y: pos[1],
      z: pos[2],
      vx: vel[0],
      vy: vel[1],
      vz: vel[2],
      life: 0.7 + 0.5, // max spawn life
    };
    let steps = 0;
    while (stepEmber(e, 1 / 60) && steps < 600) steps++;
    // EMBER_DECAY = 1.6/s, max life 1.2 -> dies within ~0.75s (45 frames at
    // 60fps); generous upper bound guards against a decay-rate regression.
    expect(steps).toBeGreaterThan(0);
    expect(steps).toBeLessThan(90);
  });

  it("emberBillboards fills exactly MAX_EMBERS worth of quads, alpha 0 past the live count", () => {
    const embers: Ember[] = [
      { x: 1, y: 2, z: 3, vx: 0, vy: 0, vz: 0, life: 1 },
      { x: 4, y: 5, z: 6, vx: 0, vy: 0, vz: 0, life: 0.1 },
    ];
    const positions = new Float32Array(MAX_EMBERS * 4 * 3);
    const meta = new Float32Array(MAX_EMBERS * 4 * 2);
    const n = emberBillboards(embers, positions, meta);
    expect(n).toBe(2);
    // first ember's 4 corners all share its world position
    for (let c = 0; c < 4; c++) {
      expect(positions[c * 3]).toBe(1);
      expect(positions[c * 3 + 1]).toBe(2);
      expect(positions[c * 3 + 2]).toBe(3);
    }
    // brighter/longer-lived ember (life=1) has more alpha than the fading one
    expect(meta[0]).toBeGreaterThan(meta[4 * 2]);
    // unused capacity beyond the 2 live embers is zero-alpha
    expect(meta[2 * 4 * 2]).toBe(0);
  });

  it("emberIndices covers every quad's 6 indices for the full MAX_EMBERS capacity", () => {
    const idx = emberIndices();
    expect(idx).toHaveLength(MAX_EMBERS * 6);
    expect(Math.max(...idx)).toBe(MAX_EMBERS * 4 - 1);
  });
});
