/**
 * PF-09 B5 — the formal quality-tier system: resolver mapping, override
 * parsing, and budget-table invariants.
 */
import { describe, expect, it } from "vitest";
import {
  demoteTier,
  GOVERNOR_IDLE_STATE,
  parseTierOverride,
  promoteTier,
  QUALITY_BUDGETS,
  resolveQualityTier,
  stepGovernor,
} from "@/lib/babylon-tiers";

describe("resolveQualityTier — the budget-table mapping", () => {
  it("WebGPU: high → full, mid → balanced, low → lite", () => {
    expect(resolveQualityTier("webgpu", "high").name).toBe("full");
    expect(resolveQualityTier("webgpu", "mid").name).toBe("balanced");
    expect(resolveQualityTier("webgpu", "low").name).toBe("lite");
  });

  it("WebGL2 fallback: capable machines get balanced, the rest lite", () => {
    expect(resolveQualityTier("webgl2", "high").name).toBe("balanced");
    expect(resolveQualityTier("webgl2", "mid").name).toBe("lite");
    expect(resolveQualityTier("webgl2", "low").name).toBe("lite");
  });

  it("an override wins over any device/backend combination", () => {
    expect(resolveQualityTier("webgl2", "low", "full").name).toBe("full");
    expect(resolveQualityTier("webgpu", "high", "lite").name).toBe("lite");
  });
});

describe("parseTierOverride", () => {
  it("accepts exactly the three tier names, rejects everything else", () => {
    expect(parseTierOverride("full")).toBe("full");
    expect(parseTierOverride("balanced")).toBe("balanced");
    expect(parseTierOverride("lite")).toBe("lite");
    expect(parseTierOverride("ultra")).toBeNull();
    expect(parseTierOverride("")).toBeNull();
    expect(parseTierOverride(null)).toBeNull();
  });
});

describe("QUALITY_BUDGETS invariants", () => {
  it("every knob degrades monotonically full → balanced → lite", () => {
    const [f, b, l] = [
      QUALITY_BUDGETS.full,
      QUALITY_BUDGETS.balanced,
      QUALITY_BUDGETS.lite,
    ];
    expect(f.haloAmp).toBeGreaterThanOrEqual(b.haloAmp);
    expect(b.haloAmp).toBeGreaterThanOrEqual(l.haloAmp);
    expect(f.shootingStars).toBeGreaterThanOrEqual(b.shootingStars);
    expect(b.shootingStars).toBeGreaterThanOrEqual(l.shootingStars);
    expect(f.nebulaStepScale).toBeGreaterThanOrEqual(b.nebulaStepScale);
    expect(b.nebulaStepScale).toBeGreaterThanOrEqual(l.nebulaStepScale);
    expect(f.nebulaTexScale).toBeGreaterThanOrEqual(b.nebulaTexScale);
    expect(b.nebulaTexScale).toBeGreaterThanOrEqual(l.nebulaTexScale);
    expect(f.asteroids).toBeGreaterThanOrEqual(b.asteroids);
    expect(b.asteroids).toBeGreaterThanOrEqual(l.asteroids);
    // shimmer only ever turns OFF going down
    expect(Number(f.shimmer)).toBeGreaterThanOrEqual(Number(b.shimmer));
    expect(Number(b.shimmer)).toBeGreaterThanOrEqual(Number(l.shimmer));
  });

  it("matches the live engine's halo tier values exactly (0 / 0.55 / 1)", () => {
    expect(QUALITY_BUDGETS.full.haloAmp).toBe(1);
    expect(QUALITY_BUDGETS.balanced.haloAmp).toBe(0.55);
    expect(QUALITY_BUDGETS.lite.haloAmp).toBe(0);
  });

  it("every budget's name matches its table key", () => {
    for (const [k, v] of Object.entries(QUALITY_BUDGETS)) {
      expect(v.name).toBe(k);
    }
  });
});

describe("demoteTier / promoteTier — GAP-21 adaptive governor", () => {
  it("demote steps down one rung; promote steps up one rung", () => {
    expect(demoteTier("full")).toBe("balanced");
    expect(demoteTier("balanced")).toBe("lite");
    expect(promoteTier("lite")).toBe("balanced");
    expect(promoteTier("balanced")).toBe("full");
  });

  it("is a no-op at the floor and ceiling", () => {
    expect(demoteTier("lite")).toBe("lite");
    expect(promoteTier("full")).toBe("full");
  });
});

describe("stepGovernor — GAP-21 adaptive governor", () => {
  // Exact port of space-engine.js's _tick governor (_ft/_ftBad/_ftGood):
  // exponential smoothing (ft' = ft*0.9 + dt*0.1), demote after 70
  // consecutive over-budget samples, promote after 900 consecutive
  // comfortably-fast (<15ms) ones. States are constructed directly at the
  // threshold boundary rather than simulated from cold via many iterations
  // of the smoothing curve — that would make the exact sample count needed
  // to cross a threshold a function of float convergence, not of the
  // counter logic these tests actually mean to pin down.

  it("ignores samples outside (0, 200)ms — tab-hidden resume, context loss", () => {
    const r1 = stepGovernor(GOVERNOR_IDLE_STATE, 0, 25, "full");
    expect(r1.state).toBe(GOVERNOR_IDLE_STATE);
    expect(r1.tier).toBe("full");
    const r2 = stepGovernor(GOVERNOR_IDLE_STATE, 5000, 25, "full");
    expect(r2.state).toBe(GOVERNOR_IDLE_STATE);
    expect(r2.tier).toBe("full");
  });

  it("does not demote at the 70th consecutive over-budget sample", () => {
    // ft=100, dt=100 -> smoothed ft stays 100, comfortably over budget=25.
    const state = { ft: 100, bad: 69, good: 0 };
    const { tier, state: next } = stepGovernor(state, 100, 25, "full");
    expect(tier).toBe("full");
    expect(next.bad).toBe(70);
  });

  it("demotes one tier at the 71st consecutive over-budget sample", () => {
    const state = { ft: 100, bad: 70, good: 0 };
    const { tier, state: next } = stepGovernor(state, 100, 25, "full");
    expect(tier).toBe("balanced");
    expect(next).toEqual({ ft: 16, bad: 0, good: 0 }); // resets, like upstream
  });

  it("does not demote past the lite floor", () => {
    const state = { ft: 100, bad: 70, good: 0 };
    const { tier } = stepGovernor(state, 100, 25, "lite");
    expect(tier).toBe("lite");
  });

  it("does not promote at the 900th consecutive comfortably-fast sample", () => {
    // ft=1, dt=1 -> smoothed ft stays ~1, comfortably under the 15ms floor.
    const state = { ft: 1, bad: 0, good: 899 };
    const { tier, state: next } = stepGovernor(state, 1, 25, "lite");
    expect(tier).toBe("lite");
    expect(next.good).toBe(900);
  });

  it("promotes one tier at the 901st consecutive comfortably-fast sample", () => {
    const state = { ft: 1, bad: 0, good: 900 };
    const { tier, state: next } = stepGovernor(state, 1, 25, "lite");
    expect(tier).toBe("balanced");
    expect(next.bad).toBe(0);
    expect(next.good).toBe(0);
    // unlike demote, promote does NOT force-reset ft — matches upstream,
    // which only zeroes _ftGood on promote, never _ft.
    expect(next.ft).toBeCloseTo(1, 5);
  });

  it("does not promote past the full ceiling", () => {
    const state = { ft: 1, bad: 0, good: 900 };
    const { tier } = stepGovernor(state, 1, 25, "full");
    expect(tier).toBe("full");
  });

  it("an over-budget sample resets the good streak to zero", () => {
    const state = { ft: 90, bad: 0, good: 500 };
    const { state: next } = stepGovernor(state, 100, 25, "full");
    expect(next.good).toBe(0);
  });

  it("a mid-range sample (neither over budget nor comfortably fast) advances neither counter", () => {
    // ft settles at 20 (between the 15ms promote floor and the 25ms demote
    // budget) — neither branch should fire.
    const state = { ft: 20, bad: 5, good: 5 };
    const { tier, state: next } = stepGovernor(state, 20, 25, "full");
    expect(tier).toBe("full");
    expect(next.bad).toBe(5);
    expect(next.good).toBe(5);
  });

  it("widens the demote budget while scrolled, matching space-engine.js's 25 -> 42", () => {
    // ft=30 is already converged to a steady 30ms/frame pace (dt=30 keeps
    // it at 30). That breaches the non-scrolled budget (25) but not the
    // scrolled one (42) — same frame pace, different verdict by budget.
    const state = { ft: 30, bad: 70, good: 0 };
    const scrolled = stepGovernor(state, 30, 42, "full");
    expect(scrolled.tier).toBe("full");
    expect(scrolled.state.bad).toBe(70); // mid-range branch — unchanged
    const notScrolled = stepGovernor(state, 30, 25, "full");
    expect(notScrolled.tier).toBe("balanced");
  });
});
