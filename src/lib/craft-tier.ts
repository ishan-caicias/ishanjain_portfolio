/* craft-tier.ts — PF-07 ship-v2 P4: adaptive craft-quality selection.
 *
 * Pure policy (unit-tested) + a thin browser reader. Resolution order, applied
 * in SpaceScene:
 *   1. URL param  ?craft=1k|2k|off   — dev/rollback, always wins
 *   2. Stored user override          — the accessible selector in Data & Licenses
 *   3. Auto device policy            — the default since the P5 rollout (TR-020);
 *                                      also explicit via ?craft=on / stored "auto"
 * Site-wide rollback: see docs/runbooks/2026-07-17-craft-rollback.md
 *
 * The policy mirrors the audited design from the validation record: data-saver,
 * low-memory, or narrow devices get the 1K tier (simplified mesh + 1024px
 * textures); everyone else gets 2K. The visitor can always override.
 */

export type CraftTier = "1k" | "2k";
export type CraftQuality = CraftTier | "off" | "auto";

export const CRAFT_QUALITY_STORAGE_KEY = "ij-craft-quality";

export interface TierSignals {
  /** navigator.connection.saveData — explicit request for less data. */
  saveData: boolean;
  /** navigator.deviceMemory in GiB, or null where unsupported (Safari/Firefox). */
  deviceMemory: number | null;
  /** window.innerWidth (CSS px). */
  viewportWidth: number;
}

/** Viewport narrower than this gets the 1K tier (phone-class layout). */
export const TIER_NARROW_VIEWPORT = 768;
/** deviceMemory at or below this (GiB) gets the 1K tier. */
export const TIER_LOW_MEMORY = 4;

/** Device-signal policy: any constrained signal → lite tier; else full. */
export function resolveCraftTier(s: TierSignals): CraftTier {
  if (s.saveData) return "1k";
  if (s.deviceMemory !== null && s.deviceMemory <= TIER_LOW_MEMORY) return "1k";
  if (s.viewportWidth < TIER_NARROW_VIEWPORT) return "1k";
  return "2k";
}

interface NavigatorSignals extends Navigator {
  connection?: { saveData?: boolean };
  deviceMemory?: number;
}

/** Read the live device signals (browser only). */
export function readTierSignals(win: Window): TierSignals {
  const nav = win.navigator as NavigatorSignals;
  return {
    saveData: nav.connection?.saveData === true,
    deviceMemory:
      typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    viewportWidth: win.innerWidth,
  };
}

/** Parse a stored quality value; anything unrecognized reads as null. */
export function parseStoredQuality(raw: string | null): CraftQuality | null {
  return raw === "1k" || raw === "2k" || raw === "off" || raw === "auto"
    ? raw
    : null;
}

/**
 * Full resolution for a page load. Returns the tier to apply, or null for the
 * wireframe (explicit opt-out only — the auto policy is the default since the
 * P5 rollout, TR-020).
 */
export function resolveCraftAttribute(
  urlParam: string | null,
  stored: CraftQuality | null,
  signals: TierSignals,
): CraftTier | null {
  if (urlParam === "off") return null;
  if (urlParam === "1k" || urlParam === "2k") return urlParam;
  if (stored === "off") return null;
  if (stored === "1k" || stored === "2k") return stored;
  return resolveCraftTier(signals);
}
