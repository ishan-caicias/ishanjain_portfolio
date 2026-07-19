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
  flipPhase,
  plumeBuffersForWrapper,
  plumeIndices,
  plumeParamsForWarp,
  plumeParamsIdle,
  PLUME_FRAGMENT_GLSL,
  PLUME_FRAGMENT_WGSL,
  SHIMMER_FRAGMENT_GLSL,
  SHIMMER_FRAGMENT_WGSL,
  WARP_ACCEL_END,
  WARP_DECEL_START,
} from "@/lib/babylon-ship";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";
import {
  buildPlumeVertices,
  PLUME_CORE,
  PLUME_SHEATH,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
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
});
