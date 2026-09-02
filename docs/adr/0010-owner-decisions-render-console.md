# ADR-0010 — PF-11 owner decision set: Reinhard exposure, user-configurable Render Console, asset-weight unblock, full DR3 Tiny

**Date:** 2026-07-22
**Status:** Accepted (owner decisions, recorded verbatim-in-substance by Procyon)
**Context:** the PF-11 plan ([delivery plan](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md))
collected seven open owner decisions. The owner resolved six of them on 2026-07-22 and added
one new product requirement that changes the project's tier philosophy. The seventh (belt
frame) remains open.

## Decisions

1. **D3.3 — mid-warp input policy: `goHome` becomes a warp ABORT, and `travelTo` gains a
   retarget QUEUE.** Pressing home mid-warp flips early and brakes back; selecting a new
   destination mid-warp queues it and launches on arrival (with HUD feedback in both cases —
   the silent no-op class is retired).
2. **D6.1 — planetary exposure: the Reinhard response curve.** Chosen over
   bake-normalisation. Consequence acknowledged from Astra's numbers: never clips (fixes the
   6/16 clipping bodies), at the cost of compressing the real 9.0:1 Tethys:Moon brightness
   ratio to ~2.9:1 — recorded as a **declared license** in the ledger, not an accident. The
   opposition-surge move out of `uAlbedo` into `refl` still happens first (it is a
   correctness fix independent of the curve choice).
3. ~~**D6.2 — belt 23.44° frame: NO DECISION YET.** Remains open; unchanged since TR-074.~~
   **Update (owner, 2026-07-22, hours after the original set): D6.2 is a GO on
   re-expression.** The belt model (spine, herding pull, gaussian density, warp slowdown,
   passage deflection, shader `ORBIT_SUN_Z` rotation) moves into the obliquity-inclined
   basis (`OBLIQUITY_J2000_DEG = 23.439281`), the asteroid data regenerates with
   `--frame equatorial`, and the m42 showcase-route crossing is re-tuned — so the belt lies
   on the real zodiac, consistent with the equatorial catalog. Implementation steps:
   [implementation plan D6.2](../implementation/PF-11-implementation-plan.md#d62-belt-frame-re-expression--go).
   With this, every decision in this ADR is taken; PF-11 has no open owner decisions beyond
   the two data-driven calibrations (D9.4 presets, boot-critical budget value).
4. **D6.5 — asset-weight decision UNBLOCKED from the D0.3 real-device pass.** The
   trim-vs-keep question dissolves into the Render Console model (below): heavy layers
   become user-opt-in downloads, so `public/assets` repo weight is no longer forced onto
   every visitor's connection. ADR-0009's byte gates REMAIN (repo weight still needs a
   ceiling); what changes is the decision logic — ceilings may now rise deliberately when
   the bytes behind them are fetch-on-enable, and a new **boot-critical download budget**
   (what a default visitor must fetch before LAUNCH arms) becomes the user-facing metric.
5. **D5.1 — control renames APPROVED: `RANDOM JUMP ▸` / `◂ RETURN HOME`** (and the card's
   `◂ RETURN TO SOL` converges to `◂ RETURN HOME`). **New requirement attached: on Return
   Home, the ship ORBITS Earth** — the home state becomes a slow Earth orbit around the
   revealed Earth sphere (D6.4), replacing the static parked drift.
6. **D4.4 — card content: owner-approved GENERATED drafts, grounded in official sources.**
   Every generated field note / sky lore cites its factual basis (NASA/ESA/IAU/literature
   per `docs/research/texture-sources-public-domain.md` licensing rules); owner approves
   before ship; no invented facts.
7. **D8.1 — Gaia DR3 Tiny ships ALL 2,552,302 stars.** Not a decimated cut. Delivery
   mechanism is the Render Console: the full field is a toggleable layer (chunked,
   magnitude-sorted, fetch-on-enable), with per-device DEFAULTS set from the D0.3
   measurement pass rather than hard caps.

## The new requirement — the Render Console (user-configurable layer rendering)

**Owner's rationale (recorded):** the point of lifting hard device floors/ceilings is a
**settings control panel in the dossier format** where the visitor multi-selects which DSO /
celestial layers render, based on their machine's capability — a frictionless experience: a
machine that can handle complex graphics but not all layers at once lets the visitor switch
between what they want to see.

**Architectural consequence:** automatic device tiers stop being the _ceiling_ and become
the _default preset_. The layer set (star field, bonus layers, SDSS DR18, DR3 belt visual +
Havok physics, NGC2000 volumes, GD-1 trail, constellations, Milky Way band, planet
hi-res/VT textures, DR3 Tiny 2.55M field) becomes individually toggleable at runtime, with
honest per-layer cost labels (bytes + vertices + measured fps impact), persistence, and the
established resolution order (URL param → stored override → device-policy default). Heavy
layers load lazily on first enable — which simultaneously delivers D7's memory goals for
visitors who never enable them.

This is delivery-plan phase **D9** ([delivery plan](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d9--render-console-user-configurable-layer-rendering-adr-0010));
full technical design in the
[implementation plan](../implementation/PF-11-implementation-plan.md#d9--render-console).

## Consequences

- The D0.3 real-device pass changes purpose, not necessity: it calibrates **presets and
  defaults** (and closes PF-09 B6) instead of gating asset trims.
- `budget:check` gains a boot-critical-download granularity alongside ADR-0009's repo-weight
  gates.
- The reduced-motion and no-WebGL contracts apply to the Render Console like any feature
  (CLAUDE.md #24); every layer toggle must define its off-state as cleanly as its on-state
  (dispose/sleep semantics — see D7 interplay in the implementation plan).
- Exposure: both shader twins gain the Reinhard term together (CLAUDE.md #4/#5 discipline).

## Addendum, 2026-07-29 (TR-111/TR-112) — D9.1-D9.3 shipped; D9.4 remains blocked on D0.3

D9.1 (`src/lib/render-layers.ts`'s layer registry + `babylon-engine.ts`'s `setLayers()`
surface), D9.2 (`RenderConsole.tsx`), and D9.3 (per-layer `assetBytes` single-sourced from
`budgets.config.mjs`; the boot-critical-download budget this ADR called for had, in fact,
already landed alongside D1.1's instrumentation work, ahead of this ADR's own D9 phase) are
implemented. **D9.4's `defaultByTier` values are NOT the real-device-calibrated numbers this
ADR anticipates** — D0.3 has still not run. What shipped instead: every `defaultByTier` in
`render-layers.ts` mirrors CURRENT shipped behaviour made visible and adjustable (every layer
that ships unconditionally on every tier today defaults to on everywhere; `belt-physics` and
`planet-hires` mirror their existing `QUALITY_BUDGETS` entries exactly) — a real default, just
not a newly-measured one. The panel's own header comment states this explicitly so it is never
mistaken for a calibration result. Re-run D9.4 once D0.3's real-device pass lands; until then,
the Render Console still does everything ADR-0010 asked for (multi-select, honest cost labels,
persistence, the resolution order) — only the specific numbers behind "which preset turns
which layers on" are provisional.
