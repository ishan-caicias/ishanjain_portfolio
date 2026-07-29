/* render-layers.ts — PF-11 D9.1: the Render Console's layer registry.
 *
 * Pure metadata + resolution logic; no DOM, no Babylon. The engine (babylon-engine.ts)
 * implements what each layer actually does when toggled, and the panel (RenderConsole.tsx)
 * renders the rows — neither owns this list, both read it, matching the implementation plan's
 * "the engine implements, the panel renders" split.
 *
 * WHY A CONSOLE AT ALL (owner R15, ADR-0010): every layer below already ships to every device
 * on every tier today ("ideal state first, desktop baseline" — PF-10 TR-067, reversed only
 * where D6.3.2 progressively fetches `ultra` textures and D2.1 fades belt physics at DSOs).
 * Automatic device tiers become the DEFAULT PRESET a visitor can move away from, never a
 * ceiling they're stuck behind — a machine that can handle complex graphics but not everything
 * AT ONCE gets to choose what it sees.
 *
 * DEFAULTS ARE NOT YET REAL-DEVICE CALIBRATED (D9.4 depends on D0.3, which is owner-scheduled
 * and has not run). Every `defaultByTier` value below is the CURRENT shipped behaviour made
 * visible and adjustable, not a new number derived from measurement — `belt-physics` mirrors
 * `QUALITY_BUDGETS[tier].asteroids` exactly (babylon-tiers.ts), `planet-hires` mirrors
 * `QUALITY_BUDGETS[tier].planetTexture === "ultra-progressive"`, and every always-on-today
 * layer (bonus-stars, sdss-field, belt-visual, nebula-volumes, gd1-trail, constellations,
 * milky-way-band) defaults to `true` on every tier because that is what ships today. Recorded
 * explicitly so this isn't mistaken for a measured recommendation.
 */
import type { QualityTierName } from "./babylon-tiers";
// PF-11 D9.3: real measured byte sizes, single-sourced from budgets.config.mjs so the panel's
// cost labels and the asset budget gate can never quietly diverge — see that file's own
// `layerBytes` comment for what's measured and when.
import { layerBytes } from "../../budgets.config.mjs";

export type LayerId =
  | "star-field" // 168,959 base Hipparcos + Gaia deep — always on, not toggleable off (it IS the scene)
  | "bonus-stars" // white dwarfs + CNS5 + Oort + open/globular clusters background
  | "sdss-field" // SDSS DR18 deep-field galaxies
  | "belt-visual" // full 154,662-object real Gaia DR3 asteroid belt (billboard layer)
  | "belt-physics" // bounded Havok rigid-body subset of the same belt
  | "nebula-volumes" // NGC2000 volumetric nebulae (GPU compute/procedural raymarch)
  | "gd1-trail" // GD-1 stellar stream connected trail
  | "constellations" // constellation figure lines
  | "milky-way-band" // the 360° galactic band
  | "planet-hires" // per-body ultra/virtual-texture surface detail ladder
  | "gaia-tiny"; // PF-11 D8 — 2,439,417 Gaia DR3 Tiny stars (post-dedup), 8 chunks, off by default

export interface LayerMeta {
  id: LayerId;
  label: string;
  /** Real measured network bytes for a fresh fetch (0 for layers that are computed/procedural,
   * or derived from data the base catalog fetch already paid for — GD-1 and constellations
   * read `window.CELESTIAL`, the band is generated on the GPU/CPU, never fetched). */
  assetBytes: number;
  /** Approximate rendered vertex count at full enable (billboards are 4 verts/object). */
  vertsApprox: number;
  /** Per-tier default: `boolean` for a plain on/off layer, `number` for a layer whose default
   * is a COUNT (belt-physics: Havok body budget; gaia-tiny: chunk prefix, once D8 ships it). */
  defaultByTier: Record<QualityTierName, boolean | number>;
  /** Upper bound for a COUNT layer, enforced by the panel's input AND by `setLayers()` so a
   * hand-typed `?layers=belt-physics:100000` cannot reach the engine either (TR-113 — the
   * input originally had `min={0}` and no ceiling, and the value becomes a Havok rigid-body
   * budget stepped every frame). Absent for boolean layers. */
  maxCount?: number;
  /** Every layer here loads (or, for `star-field`, already loaded) strictly after
   * `cosmos:ready` — none of this registry's own toggles can ever block LAUNCH. */
  bootCritical: false;
  /** How this layer can actually be controlled today. TR-113 replaced the original
   * `implemented: boolean` with this four-way status because one boolean could not tell
   * "always on, by design" apart from "doesn't exist yet" apart from "controllable, but only
   * at boot" — and the panel guessed, rendering `gaia-tiny` as a CHECKED row for 2.55M stars
   * that are not being drawn. Each value has exactly one rendering in the panel and one
   * meaning for `setLayers()`:
   *
   *   "live"       — `setLayers()` acts on it immediately. The normal case.
   *   "always-on"  — it IS the scene; there is nothing to turn off (`star-field`).
   *   "reload"     — honoured at boot only. `bonus-stars` merges permanently into the base
   *                  star mesh for one draw call (`_applyStarFieldGeometry`), so it cannot be
   *                  un-merged live, but the boot-time merge CAN be skipped. Splitting it into
   *                  an independently-disposable mesh stays a D9 follow-up.
   *   "unavailable"— declared for forward-compatibility; no data exists yet for this id.
   *                  Renders off and disabled. */
  status: LayerStatus;
}

export type LayerStatus = "live" | "always-on" | "reload" | "unavailable";

/** Whether `setLayers()` can act on this id in the running scene. `reload` layers are
 * deliberately excluded — their state is real and persisted, but only read at boot. */
export function isLiveToggleable(l: LayerMeta): boolean {
  return l.status === "live";
}

/** Whether this layer is actually being rendered when its state says "on". `unavailable`
 * layers are never rendered whatever their stored state claims — the panel must not draw them
 * as enabled. */
export function isAvailable(l: LayerMeta): boolean {
  return l.status !== "unavailable";
}

export const LAYERS: LayerMeta[] = [
  {
    id: "star-field",
    label: "STAR FIELD · HIPPARCOS + GAIA DEEP",
    assetBytes: layerBytes.starField,
    vertsApprox: 168_959 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "always-on", // it IS the scene; setLayers() ignores this id by design
  },
  {
    id: "bonus-stars",
    label: "WHITE DWARFS · CNS5 · OORT · CLUSTERS",
    assetBytes: layerBytes.bonusStars,
    vertsApprox: 387_000 * 4, // 359,073 WD (documented) + ~5,931 CNS5 + Oort + clusters
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "reload", // merged into the base star mesh; boot-time skip only — see LayerStatus
  },
  {
    id: "sdss-field",
    label: "SDSS DR18 DEEP FIELD",
    assetBytes: layerBytes.sdssField,
    vertsApprox: 3_637_836 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "belt-visual",
    label: "GAIA DR3 ASTEROID BELT · VISUAL",
    assetBytes: layerBytes.beltVisual,
    vertsApprox: 154_662 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "belt-physics",
    label: "GAIA DR3 ASTEROID BELT · PHYSICS",
    assetBytes: 0, // no separate fetch — a Havok body subset of belt-visual's own data
    vertsApprox: 0,
    // Mirrors QUALITY_BUDGETS[tier].asteroids exactly (babylon-tiers.ts) — the count is a
    // Havok body budget, not a byte one.
    defaultByTier: { full: 48, balanced: 32, lite: 20 },
    // 4x the `full` tier budget. Deliberately a headroom ceiling for a visitor who wants more
    // rocks than their tier chose, NOT a measured safe maximum — D9.4/D0.3 owns the real
    // number. Havok steps every one of these bodies each frame.
    maxCount: 192,
    bootCritical: false,
    status: "live",
  },
  {
    id: "nebula-volumes",
    label: "NGC2000 VOLUMETRIC NEBULAE",
    assetBytes: 0, // GPU compute/procedural raymarch — not a network fetch
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "gd1-trail",
    label: "GD-1 STELLAR STREAM",
    assetBytes: 0, // derived from window.CELESTIAL, which the base catalog fetch already paid for
    vertsApprox: 0, // resolved at boot from however many gd1-member- entries the catalog carries
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "constellations",
    label: "CONSTELLATION FIGURES",
    assetBytes: 0, // derived from window.CELESTIAL, same as gd1-trail
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "milky-way-band",
    label: "MILKY WAY · 360° BAND",
    assetBytes: 0, // procedurally built (MilkyWayBandBuilder), not fetched
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    status: "live",
  },
  {
    id: "planet-hires",
    label: "PLANET SURFACE · ULTRA + VIRTUAL TEXTURE",
    assetBytes: layerBytes.planetHires, // representative PER-BODY cost, not a catalog total
    vertsApprox: 0,
    // Mirrors QUALITY_BUDGETS[tier].planetTexture === "ultra-progressive" exactly.
    defaultByTier: { full: true, balanced: false, lite: false },
    bootCritical: false,
    status: "live",
  },
  {
    id: "gaia-tiny",
    label: "GAIA DR3 TINY · FULL BACKGROUND FIELD (2.44M STARS)",
    // PF-11 D8 (ADR-0012, TR-114): 8 magnitude-sorted chunks, 2,439,455 stars post dedup against
    // the shipped Hipparcos base field (112,847 of 117,904 HIP-tagged candidates matched —
    // position crossmatch, not the originally-planned magnitude-gated one; see the ADR for why).
    assetBytes: layerBytes.gaiaTiny,
    vertsApprox: 2_439_455 * 4,
    // Off by default on every tier — an opt-in heavy layer until D0.3's real-device pass sets a
    // measured default (D9.4 note applies here too: this is current shipped behaviour — nothing
    // — made visible and adjustable, not a measured recommendation).
    defaultByTier: { full: 0, balanced: 0, lite: 0 },
    // 8 chunks total (GAIA_TINY_CHUNK_COUNT in babylon-engine.ts) — the chunk-prefix count IS
    // the whole field once fully enabled, unlike belt-physics's headroom-above-tier ceiling.
    maxCount: 8,
    bootCritical: false,
    status: "live", // PF-11 D8 — data pipeline shipped (ADR-0012)
  },
];

const LAYER_IDS = new Set<LayerId>(LAYERS.map((l) => l.id));
const LAYER_BY_ID = new Map<LayerId, LayerMeta>(LAYERS.map((l) => [l.id, l]));

export function layerMeta(id: LayerId): LayerMeta | undefined {
  return LAYER_BY_ID.get(id);
}

/** Clamps a COUNT layer's value into `[0, maxCount]` and integerises it. Applied at EVERY
 * entry point into layer state — URL param, stored JSON, the panel's input, and the engine's
 * own `setLayers()` — so no path can hand the engine a Havok body budget it can't survive
 * (TR-113). Booleans and layers without a `maxCount` pass through untouched. */
export function clampLayerValue(
  id: LayerId,
  value: boolean | number,
): boolean | number {
  if (typeof value !== "number" || !Number.isFinite(value)) return value;
  const max = LAYER_BY_ID.get(id)?.maxCount;
  if (max === undefined) return value;
  return Math.max(0, Math.min(max, Math.round(value)));
}

/** Parses the `?layers=` URL param: comma-separated `id:value` pairs, e.g.
 * `sdss-field:0,belt-physics:16`. Booleans are `1`/`0`; a plain integer is read as a count
 * (for `belt-physics`/`gaia-tiny`'s chunk-prefix-style layers). Unknown ids and malformed
 * entries are silently skipped — this is a convenience override, not a strict format, and a
 * visitor should never get a blank page from a typo'd share link. */
export function parseLayersParam(
  v: string | null,
): Partial<Record<LayerId, boolean | number>> {
  const out: Partial<Record<LayerId, boolean | number>> = {};
  if (!v) return out;
  for (const pair of v.split(",")) {
    const [id, raw] = pair.split(":");
    if (!id || raw === undefined) continue;
    if (!LAYER_IDS.has(id as LayerId)) continue;
    if (raw === "1" || raw === "0") {
      out[id as LayerId] = raw === "1";
      continue;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0)
      out[id as LayerId] = clampLayerValue(id as LayerId, n);
  }
  return out;
}

/** Serializes a layer config back into the `?layers=` format `parseLayersParam` reads — the
 * inverse of `parseLayersParam`, and what the panel's COPY LINK button hands to the clipboard
 * so a visitor can share (or bookmark) the exact layer set they are looking at. */
export function serializeLayersParam(
  config: Partial<Record<LayerId, boolean | number>>,
): string {
  return Object.entries(config)
    .filter(([id]) => LAYER_IDS.has(id as LayerId))
    .map(([id, v]) => `${id}:${typeof v === "boolean" ? (v ? 1 : 0) : v}`)
    .join(",");
}

/** Full per-layer config for a tier, built from `LAYERS`' own defaults — the starting point
 * `resolveLayers` overlays `stored`/`url` on top of. */
export function tierDefaults(
  tier: QualityTierName,
): Record<LayerId, boolean | number> {
  const out = {} as Record<LayerId, boolean | number>;
  for (const l of LAYERS) out[l.id] = l.defaultByTier[tier];
  return out;
}

/** Resolution order, matching every other override surface in this codebase (density, craft,
 * tier): URL `?layers=` → `localStorage` ("ij-layers") → the device-tier default. Each source
 * only overrides the ids it actually mentions — a partial `?layers=sdss-field:0` still leaves
 * every other layer at its stored/tier value, never resets the rest. */
export function resolveLayers(
  urlParam: string | null,
  stored: string | null,
  tier: QualityTierName,
): Record<LayerId, boolean | number> {
  const resolved = tierDefaults(tier);
  let storedConfig: Partial<Record<LayerId, boolean | number>> = {};
  if (stored) {
    try {
      const parsed: unknown = JSON.parse(stored);
      if (parsed && typeof parsed === "object") {
        storedConfig = parsed as Partial<Record<LayerId, boolean | number>>;
      }
    } catch {
      // Malformed localStorage value (hand-edited, or from an older schema) — fall back to
      // the tier default for every layer rather than throwing across the whole boot.
    }
  }
  for (const id of LAYER_IDS) {
    if (storedConfig[id] !== undefined)
      resolved[id] = clampLayerValue(id, storedConfig[id]!);
  }
  const urlConfig = parseLayersParam(urlParam);
  for (const id of LAYER_IDS) {
    if (urlConfig[id] !== undefined) resolved[id] = urlConfig[id]!;
  }
  return resolved;
}

export const LAYERS_STORAGE_KEY = "ij-layers";

/** Formats a byte count for the panel's per-row cost label — "47.1 MB", "2.08 MB", "0 B" for
 * a computed/derived layer with nothing to download. Pure so the panel's honest-cost labels
 * are unit-tested against the same registry numbers the budget gate checks (D9.3). */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

/** Formats a vertex count for the panel's per-row cost label — "675.8K verts", "0 verts". */
export function formatVerts(verts: number): string {
  if (verts === 0) return "0 verts";
  if (verts < 1000) return `${verts} verts`;
  return `${(verts / 1000).toFixed(1)}K verts`;
}
