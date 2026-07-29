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
  | "gaia-tiny"; // PF-11 D8 — all 2,552,302 Gaia DR3 Tiny stars. NOT YET IMPLEMENTED (see below)

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
  /** Every layer here loads (or, for `star-field`, already loaded) strictly after
   * `cosmos:ready` — none of this registry's own toggles can ever block LAUNCH. */
  bootCritical: false;
  /** Whether `babylon-engine.ts`'s `setLayers()` can actually act on this id today. `false`
   * marks a registry entry that exists for forward-compatibility / documentation but has no
   * live toggle yet — `gaia-tiny` (the data doesn't exist until D8 ships it) and `bonus-stars`
   * (merged permanently into the base star mesh for one draw call — see babylon-engine.ts's
   * `_applyStarFieldGeometry`; separating it into an independently-disposable layer is a real
   * structural change, recorded as a D9 follow-up, not attempted here). The panel renders
   * these rows disabled with an explicit reason rather than silently omitting them. */
  implemented: boolean;
}

export const LAYERS: LayerMeta[] = [
  {
    id: "star-field",
    label: "STAR FIELD · HIPPARCOS + GAIA DEEP",
    assetBytes: layerBytes.starField,
    vertsApprox: 168_959 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: false, // always on; setLayers() ignores this id by design
  },
  {
    id: "bonus-stars",
    label: "WHITE DWARFS · CNS5 · OORT · CLUSTERS",
    assetBytes: layerBytes.bonusStars,
    vertsApprox: 387_000 * 4, // 359,073 WD (documented) + ~5,931 CNS5 + Oort + clusters
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: false, // merged into the base star mesh — see the field comment above
  },
  {
    id: "sdss-field",
    label: "SDSS DR18 DEEP FIELD",
    assetBytes: layerBytes.sdssField,
    vertsApprox: 3_637_836 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "belt-visual",
    label: "GAIA DR3 ASTEROID BELT · VISUAL",
    assetBytes: layerBytes.beltVisual,
    vertsApprox: 154_662 * 4,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "belt-physics",
    label: "GAIA DR3 ASTEROID BELT · PHYSICS",
    assetBytes: 0, // no separate fetch — a Havok body subset of belt-visual's own data
    vertsApprox: 0,
    // Mirrors QUALITY_BUDGETS[tier].asteroids exactly (babylon-tiers.ts) — the count is a
    // Havok body budget, not a byte one.
    defaultByTier: { full: 48, balanced: 32, lite: 20 },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "nebula-volumes",
    label: "NGC2000 VOLUMETRIC NEBULAE",
    assetBytes: 0, // GPU compute/procedural raymarch — not a network fetch
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "gd1-trail",
    label: "GD-1 STELLAR STREAM",
    assetBytes: 0, // derived from window.CELESTIAL, which the base catalog fetch already paid for
    vertsApprox: 0, // resolved at boot from however many gd1-member- entries the catalog carries
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "constellations",
    label: "CONSTELLATION FIGURES",
    assetBytes: 0, // derived from window.CELESTIAL, same as gd1-trail
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "milky-way-band",
    label: "MILKY WAY · 360° BAND",
    assetBytes: 0, // procedurally built (MilkyWayBandBuilder), not fetched
    vertsApprox: 0,
    defaultByTier: { full: true, balanced: true, lite: true },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "planet-hires",
    label: "PLANET SURFACE · ULTRA + VIRTUAL TEXTURE",
    assetBytes: layerBytes.planetHires, // representative PER-BODY cost, not a catalog total
    vertsApprox: 0,
    // Mirrors QUALITY_BUDGETS[tier].planetTexture === "ultra-progressive" exactly.
    defaultByTier: { full: true, balanced: false, lite: false },
    bootCritical: false,
    implemented: true,
  },
  {
    id: "gaia-tiny",
    label: "GAIA DR3 TINY · FULL BACKGROUND FIELD (2.55M STARS)",
    assetBytes: 36_000_000, // D8's own estimate: ~31-42 MiB PNG-pack — not yet built
    vertsApprox: 2_552_302 * 4,
    defaultByTier: { full: false, balanced: false, lite: false }, // off everywhere: doesn't exist yet
    bootCritical: false,
    implemented: false, // PF-11 D8 — ships as a D9 layer once its data pipeline lands
  },
];

const LAYER_IDS = new Set<LayerId>(LAYERS.map((l) => l.id));

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
    if (Number.isFinite(n) && n >= 0) out[id as LayerId] = n;
  }
  return out;
}

/** Serializes a layer config back into the `?layers=` format `parseLayersParam` reads — used
 * by the panel's "copy a link with these settings" affordance and by the URL-override chip's
 * own round-trip test. */
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
    if (storedConfig[id] !== undefined) resolved[id] = storedConfig[id]!;
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
