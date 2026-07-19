/* babylon-tiers.ts — PF-09 B5: the formal quality-tier system.
 *
 * Until B5, quality knobs were scattered per feature: halo hardcoded to the
 * top tier ("no tier system until B5"), shooting stars fixed at 24, nebula
 * steps split only by backend, asteroids tiered ad hoc, shimmer always on.
 * This module unifies them behind ONE resolver and ONE typed budget table,
 * mapping the PF-09 budget rows onto three named tiers:
 *
 *   full     — Desktop / tablet WebGPU (60 fps rows): everything at max.
 *   balanced — Mid-device WebGPU (≥40 fps row) and capable WebGL2 machines:
 *              reduced particles/steps, dimmer halo, shimmer kept.
 *   lite     — Constrained devices and baseline WebGL2 (≥30 fps row):
 *              minimum particle counts, no halo, no shimmer post-pass.
 *
 * Inputs are things the repo already measures: the render backend (the
 * engine's own WebGPU→WebGL2 fallback) and perf-telemetry's DeviceTier
 * (the SAME classifier the perf HUD reports — one device policy, not two).
 * `?tier=full|balanced|lite` overrides for testing/rollback, mirroring the
 * established `?craft=` pattern. Reduced-motion is deliberately NOT a tier:
 * it is a per-feature behaviour contract (static nebulae, no shake, snapped
 * cameras) that composes with any tier.
 *
 * The no-WebGL/DOM fallback and the WebGPU→WebGL2 fallback themselves are
 * first-class policies that predate this module (engine-select + createEngine)
 * — B5 formalizes the QUALITY dimension on top of them.
 */
import type { DeviceTier } from "./perf-telemetry";

export type QualityTierName = "full" | "balanced" | "lite";

export interface QualityBudget {
  name: QualityTierName;
  /** Star halo/bloom amplitude — the live engine's own tier values (1 /
   * 0.55 / 0), finally honoured on the Babylon path. */
  haloAmp: number;
  /** Idle shooting-star particle count. */
  shootingStars: number;
  /** Multiplier on the per-backend nebula raymarch step counts. */
  nebulaStepScale: number;
  /** Offscreen nebula texture resolution as a fraction of the render target. */
  nebulaTexScale: number;
  /** Asteroid-belt body count (Havok bodies or visual-tier instances). */
  asteroids: number;
  /** Heat-shimmer refraction post-pass on/off. */
  shimmer: boolean;
}

export const QUALITY_BUDGETS: Record<QualityTierName, QualityBudget> = {
  full: {
    name: "full",
    haloAmp: 1,
    shootingStars: 24,
    nebulaStepScale: 1,
    nebulaTexScale: 0.5,
    asteroids: 48,
    shimmer: true,
  },
  balanced: {
    name: "balanced",
    haloAmp: 0.55,
    shootingStars: 16,
    nebulaStepScale: 0.7,
    nebulaTexScale: 0.4,
    asteroids: 32,
    shimmer: true,
  },
  lite: {
    name: "lite",
    haloAmp: 0,
    shootingStars: 8,
    nebulaStepScale: 0.5,
    nebulaTexScale: 1 / 3,
    asteroids: 20,
    shimmer: false,
  },
};

/** Parse a `?tier=` override; anything unrecognized reads as null (same
 * tolerance as craft-tier's parseStoredQuality). */
export function parseTierOverride(raw: string | null): QualityTierName | null {
  return raw === "full" || raw === "balanced" || raw === "lite" ? raw : null;
}

/** The budget-table mapping. WebGPU: high → full, mid → balanced, low →
 * lite. WebGL2 (the fallback rows): a capable machine still gets balanced;
 * everything else lite — the ≥30 fps floor is the binding constraint there. */
export function resolveQualityTier(
  backend: "webgpu" | "webgl2",
  device: DeviceTier,
  override: QualityTierName | null = null,
): QualityBudget {
  if (override) return QUALITY_BUDGETS[override];
  if (backend === "webgpu") {
    if (device === "high") return QUALITY_BUDGETS.full;
    if (device === "mid") return QUALITY_BUDGETS.balanced;
    return QUALITY_BUDGETS.lite;
  }
  return device === "high" ? QUALITY_BUDGETS.balanced : QUALITY_BUDGETS.lite;
}

/* ---------- GAP-21: adaptive quality governor ----------
 *
 * resolveQualityTier above runs once at boot. space-engine.js also demotes
 * tier after 70 sustained slow frames and promotes after 900 sustained good
 * ones (`_tick`'s `_ftBad`/`_ftGood`, space-engine.js:1975-1994) — a device
 * that starts strong but degrades (thermal throttling, a heavy background
 * tab) never recovers headroom on the Babylon path today. These two
 * functions port that governor as pure, unit-testable steps; babylon-
 * engine.ts owns only the per-instance state and the side effects (which
 * knobs are safe to re-apply live is documented at the call site there).
 */

const TIER_ORDER: readonly QualityTierName[] = ["lite", "balanced", "full"];

/** One step down (full → balanced → lite); a no-op at the floor. */
export function demoteTier(name: QualityTierName): QualityTierName {
  const i = TIER_ORDER.indexOf(name);
  return i > 0 ? TIER_ORDER[i - 1] : name;
}

/** One step up (lite → balanced → full); a no-op at the ceiling. */
export function promoteTier(name: QualityTierName): QualityTierName {
  const i = TIER_ORDER.indexOf(name);
  return i < TIER_ORDER.length - 1 ? TIER_ORDER[i + 1] : name;
}

export interface GovernorState {
  /** Exponentially-smoothed frame time, ms (space-engine.js's `_ft`). */
  ft: number;
  /** Consecutive over-budget samples (space-engine.js's `_ftBad`). */
  bad: number;
  /** Consecutive comfortably-fast samples (space-engine.js's `_ftGood`). */
  good: number;
}

export const GOVERNOR_IDLE_STATE: GovernorState = { ft: 16, bad: 0, good: 0 };

/** One governor tick. `dtMs` is the wall-clock gap since the previous call;
 * `budgetMs` is the demote threshold (space-engine.js: 25 normally, 42 while
 * scrolled off-hero) and 15 ms is hardcoded as the promote threshold on both
 * sides, matching the live engine exactly. Samples outside `(0, 200)` ms
 * (tab-hidden resume, context-loss recovery) are ignored, same as upstream.
 * Returns the next state and the tier that should now be in effect —
 * unchanged unless a threshold was just crossed. */
export function stepGovernor(
  state: GovernorState,
  dtMs: number,
  budgetMs: number,
  tier: QualityTierName,
): { state: GovernorState; tier: QualityTierName } {
  if (!(dtMs > 0 && dtMs < 200)) return { state, tier };
  const ft = state.ft * 0.9 + dtMs * 0.1;
  if (ft > budgetMs) {
    const bad = state.bad + 1;
    if (bad > 70) {
      return { state: { ft: 16, bad: 0, good: 0 }, tier: demoteTier(tier) };
    }
    return { state: { ft, bad, good: 0 }, tier };
  }
  if (ft < 15) {
    const good = state.good + 1;
    if (good > 900) {
      return { state: { ft, bad: 0, good: 0 }, tier: promoteTier(tier) };
    }
    return { state: { ft, bad: 0, good }, tier };
  }
  return { state: { ft, bad: state.bad, good: state.good }, tier };
}
