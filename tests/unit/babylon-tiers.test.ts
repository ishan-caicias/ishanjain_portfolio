/**
 * PF-09 B5 — the formal quality-tier system: resolver mapping, override
 * parsing, and budget-table invariants.
 */
import { describe, expect, it } from "vitest";
import {
  parseTierOverride,
  QUALITY_BUDGETS,
  resolveQualityTier,
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
