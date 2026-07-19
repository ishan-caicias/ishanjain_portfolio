# PF-10 Gaia Dataset Realism — real celestial catalog expansion & physical asteroid belt

**Date:** 2026-07-20
**Status:** PLANNED — no phase started. Scope and priority order confirmed by owner 2026-07-20.
**Basis:** [Local Gaia dataset gap analysis](../analysis/2026-07-20-gaia-dataset-gap-analysis.md),
[dataset inventory](../datasets/README.md) (40 real Gaia Sky data packs in
`resources/gaia_datasets/`).

**Numbering note:** PF-09 records a decision that an originally-planned "PF-10 (physics phase)"
was folded into PF-09 as its B4 milestone (Havok asteroid belt) rather than shipped as its own
plan — see PF-09's "Decision: PF-09 and PF-10 are combined" section. That PF-10 never became a
file. This is a different, later PF-10: real-dataset celestial-catalog expansion, decided
2026-07-20. No collision — this is simply the next free plan number.

**On the "/astra" directive:** the owner asked this plan be built with `/astra` "to work with
accuracy on representation and rendering of outer space and celestial DSOs." No skill named
`astra` is installed or discoverable in this environment (checked the session's available-skill
list and the repo for a local skill definition) — flagging this rather than silently proceeding
as if it had run. Deep rendering/astrometric-accuracy work is already Procyon's own specialty
per its own charter ("never delegated" — the generalist registry has no graphics specialist).
The **Cross-cutting DSO accuracy requirements** section below is the concrete substitute:
every phase is bound by it, not just described as "should look accurate."

---

## Goals (owner, carried from CLAUDE.md, unchanged from PF-09)

1. Maximum realistic rendering, physics, and cinematics — every new object category must be
   astrometrically or physically accurate (real coordinates, real photometry, real orbital
   mechanics) — never placeholder or procedural where real data exists.
2. Extreme performance — measured on real devices, never assumed. Every new bulk dataset gets a
   tier/LOD budget decision before it ships broadly.
3. Native-feeling responsiveness across desktop, tablet, and mobile.

## Scope & priority (owner decision, 2026-07-20)

1. **All missing objects** identified in the gap analysis — everything except the galaxy-catalog
   choice and the asteroid belt, which the owner called out separately (below).
2. **Galaxy field: SDSS DR18** specifically — the owner's choice, not the smaller DR12 the gap
   analysis recommended for budget safety. Recorded as a deliberate goal-1-over-goal-2 call,
   resolved by measurement at the C2 gate, not by assumption either way.
3. **Full real-data asteroid belt**, replacing the current fully-procedural Babylon/Havok belt.
4. **Texture and surface-data upgrade** from the hi-res and topography packs.

## Budgets (extends PF-09's device-class budgets — same floors apply, no new device tiers)

| Device class              | Sustained fps floor | Startup budget | New-dataset policy             |
| ------------------------- | ------------------- | -------------- | ------------------------------ |
| Desktop (WebGPU)          | 60                  | ≤ 2.5 s        | Full quality tier              |
| iPad / tablet (WebGPU)    | 60                  | ≤ 3.0 s        | Full-minus tier                |
| Mid Android (WebGPU)      | ≥ 40                | ≤ 4.0 s        | Reduced particles/physics tier |
| No WebGPU (WebGL2)        | ≥ 30                | ≤ 4.0 s        | Fallback tier, no compute FX   |
| No WebGL / reduced-motion | n/a                 | instant        | Static/DOM fallback (kept)     |

**Data-size policy (new, this plan):** a dataset that fits the existing curated-JSON pattern
(`celestial-*.js`, roughly ≤ 10–20k records) stays curated JSON. Anything larger **must** use
the PNG-packed background-layer technique already proven for the 168,959-star field
(`star-catalog.ts`), or GPU-instanced particles for structureless populations (Oort cloud). No
dataset is bundled into JS past the curated-JSON range — that is a bundle-budget violation by
construction, not a judgment call per dataset.

## Strategy Gate

No PF-10-specific SoxCrunch scorecard exists in `docs/llm/`. Applying the same milestone-type
card PF-09's B0 used (`docs/llm/llm-strategy-scorecard-5milestone.md`) under the same recorded
exception PF-09 took at B0 ("no 3feature scorecard; milestone card governs"). Re-run the Gate
against a feature-level card once C0 scopes a specific phase for IMPLEMENT.

---

## Phase C0 — Data pipeline foundation ⛔ blocks every other phase

**Why this has to come first:** none of the 40 local datasets are in a format the site's build
step can ingest. `data/build/03-curated.js` (which produced `celestial-gaia.js`) has no
executable body in this repo — only its header comment survives, describing but not containing
the transform. There is currently **no working path** from a Gaia Sky `dataset.json`/
`particles-*.json`/`.vot`/`.bin` file to a `celestial-*.js` module or a PNG-packed asset.

**Scope:**

- Reconstruct/build real conversion tooling (`data/build/` or an equivalent tracked location)
  that reads Gaia Sky's native JSON/VOTable/binary formats.
- Two output tracks, chosen per dataset by the size policy above:
  - **Track A (curated JSON):** emits a `celestial-*.js`-shaped module, following the existing
    `window.CELESTIAL` merge pattern the current 4 files already use.
  - **Track B (background layer):** emits a PNG-packed binary asset plus a decoder module,
    following `star-catalog.ts`'s proven pattern exactly rather than inventing a second format.
- Coordinate correctness: reuse the existing, already-verified conversion path
  (`ship-dynamics.ts`'s `raDecToDir`/`bodyWorldPosition`, and the axis/handedness convention
  pinned in PF-09 TR-040) rather than re-deriving RA/Dec/parallax → Cartesian from scratch.
- Photometric correctness: reuse the existing Pogson-law magnitude → flux/size pipeline
  (`star-catalog.ts` / the GLSL+WGSL shader twins) as the base for every new stellar population;
  extend, don't replace.

**Exit:** the pipeline round-trips at least one dataset per track (e.g. GD-1 → curated JSON,
white dwarfs → PNG-pack) with a decode test proving what was encoded reads back correctly.

**Progress (2026-07-20):** Track A proven end-to-end on real data — see
[TR-061](../test-reports/TR-061.md). Two findings that change downstream C1/C2 estimates:

1. **The cluster/star catalogs are not plain JSON.** `catalog-mwsc/particles-mwsc.json`,
   `catalog-clusters-hunt-reffert-2023/particles-hunt-reffert.json`, `catalog-cns5`,
   `catalog-nbg`, `catalog-ocdr2`, and the SDSS packs all ship real records in a CDS/VizieR
   **VOTable 1.3 BINARY2** file (base64-encoded binary stream, not the JSON file — that's just
   Gaia Sky app config pointing at the `.vot`). A general reader now exists:
   [`scripts/lib/votable-binary2.mjs`](../../scripts/lib/votable-binary2.mjs) (FIELD-schema
   parsing + big-endian primitive/char decoding with the BINARY2 null bitmask). This is required
   infrastructure for C1's clusters/CNS5/NEARGALCAT and C2's SDSS DR18 — built once, reused by
   both.
2. **The conversion pipeline itself works end-to-end on real data**, not just in principle:
   [`scripts/gaia-dataset-pipeline.mjs`](../../scripts/gaia-dataset-pipeline.mjs) decoded the
   real 3,006-row MWSC catalog (145 ms) and converted 3 named clusters into the exact
   `celestial-gaia.js` record shape. Sanity-checked against known astronomy, not just schema
   validity: `Melotte_22` (Pleiades) decoded to RA 56.505°/Dec 24.37°, 424 ly — the real Pleiades
   is at RA≈56.75°/Dec≈24.1°, ~444 ly. `NGC_2632` (Praesepe) and `NGC_1912` (M38) matched their
   real positions equally closely. The pipeline correctly leaves what it can't derive from data
   honest rather than fabricated: `con` (constellation) emits `"—"`, the existing placeholder
   convention from `moon-topo`/`mars-topo`, and narrative fields (`f`, `lo`) emit an explicit
   `[[TODO: content pass]]` marker rather than invented flavour text.
3. **Local runners added**, so bulk decode/inspect work doesn't have to render through a chat
   session: [`scripts/run-gaia-pipeline.ps1`](../../scripts/run-gaia-pipeline.ps1) (primary,
   this repo's Windows dev box) and [`scripts/run-gaia-pipeline.sh`](../../scripts/run-gaia-pipeline.sh)
   (bash/CI equivalent), both thin wrappers over `npm run gaia:pipeline`.

**Not yet built:** Track B (PNG-pack background layer) — needed for C2's SDSS DR18 and C1's
white dwarfs — is unstarted; the BINARY2 reader is a prerequisite for it (SDSS ships the same
VOTable format) but the encoder/decoder-pair and the density/LOD sampling strategy for a
3.6M-row layer are separate, larger work.

## Phase C1 — Missing objects

**Scope** (everything from the gap analysis not covered by C2/C3 below):

| Dataset                                                 |         Records | Track                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Note                                                                                          |
| ------------------------------------------------------- | --------------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| Star clusters (Hunt-Reffert 2023 + OCDR2 + MWSC)        | 12,190 combined | **Finalized (owner + Astra, 2026-07-20).** Hybrid: 35 named clusters (22 open, 13 globular — full list, real hand-verified J2000 coordinates/distances/ages, in [`docs/datasets/star_clusters_hall_of_fame.md`](../datasets/star_clusters_hall_of_fame.md), validated in the [Astra realism review](../analysis/2026-07-20-star-cluster-hall-of-fame-realism-review.md)) get full curated status: individually authored, travelable, readable dossiers. The remaining ~12,155 render as an instanced glow/label layer at real MWSC coordinates — real data, no per-object dossier, per the data-vintage split decided in that review. Content authoring: 10/35 flavour+lore pairs written (Astra); remaining 25 explicitly deferred by owner decision until the portfolio is functionally ready — not a blocker for wiring the rendering path itself. |
| CNS5 nearby stars                                       |           5,931 | Curated JSON                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Real neighbor stars, distinct selection principle from the existing bright-star catalogs      |
| eDR3 white dwarfs                                       |         359,073 | Background layer (PNG-pack)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Far past curated-JSON range                                                                   |
| GD-1 stellar stream                                     |           1,365 | Curated JSON or instanced particles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Novel visual — a real tidal debris trail                                                      |
| Oort cloud                                              |          10,000 | Instanced particles                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Structureless population, not named/travelable bodies                                         |
| NGC2000 nebulae                                         |              47 | Curated JSON, wired into the **existing** volumetric raymarch pipeline (`babylon-engine.ts:1172-1211`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Pure data-wiring — the rendering path already exists, currently hardcoded to 4 showcase spots |
| Base-pack minor planets (Vesta, Ceres, Pallas, Hygieia) |               4 | Curated JSON                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Real orbital elements, trivial add                                                            |
| NEARGALCAT nearby galaxies                              |             875 | Curated JSON                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Real distance-based nearby galaxies, separate from the SDSS redshift catalog in C2            |

**Exit:** every category above renders at its real catalog position; unit tests cover each new
decoder/converter; E2E confirms reachability where the design calls for travelable bodies;
`npm run budget:check` stays green after each addition (checked incrementally, not only at the
end of the phase).

## Phase C2 — SDSS DR18 galaxy field ⛔ GO / NO-GO GATE

**Scope:** 3,637,836 galaxies, background-layer track (PNG-pack) — bundling this as JSON is not
an option at any point on the size-policy table. Real comoving-distance-based placement.

This is the single largest technical risk in the plan: DR18 is **~21× the size of the existing
168,959-star background field.** The owner explicitly chose DR18 over the smaller DR12 this
plan's originating gap analysis recommended for budget safety — a deliberate goal-1
(realism/completeness) call. This phase's gate exists specifically to resolve the resulting
goal-1-vs-goal-2 tension with real measurement, the same discipline PF-09's B1 gate used for the
renderer decision itself — not to relitigate the owner's choice, and not to wave it through
unmeasured either.

**Gate procedure:** measure real-device fps/startup with the DR18 layer active on desktop, iPad
class, and mid-Android, against the budgets table above. **GO** → ships at the tier(s) that hold
budget. **Partial** → DR18 tier-gates to the device classes that hold budget, with a graceful,
explicitly-recorded reduced view (not a silent drop) on classes that don't — e.g. a
magnitude/redshift-weighted decimated subsample rather than a hard cutoff. Record the outcome as
an ADR if it changes what any tier ships by default, following the same pattern as ADR-0003/0006.

**Reconfirmed (owner, 2026-07-20): DR18, not DR12.** No change to the decision above — recorded
again here because C0's real-data work landed the same day and it's worth being explicit that
DR18 stays the target. C0 also confirmed SDSS ships the same VOTable BINARY2 format the cluster
catalogs use (`scripts/lib/votable-binary2.mjs` reads the schema already; a 3.6M-row file needs
a streaming pass rather than loading the whole decoded row array in memory at once, which the C0
proof-of-concept didn't need to solve at MWSC's 3,006-row scale — flagged as real, not yet
started, C2 work).

**Exit:** DR18 field renders; gate measured and recorded; tier-gating decision (if any) written
up.

## Phase C3 — Full real-data asteroid belt (replaces the procedural belt)

**Scope:** replace `babylon-asteroids.ts`'s seeded-LCG procedural generation with the Gaia DR3
asteroid catalog (154,787 objects with real orbital elements).

**Design call, confirm at IMPLEMENT (stated explicitly, not decided unilaterally):** "full" real
belt is proposed as a two-tier render split, because instancing all 154,787 objects as Havok
rigid bodies is not physically possible inside the existing frame budget (3,200–7,700× the
current 20/32/48 tier counts):

- **Visual layer (full catalog):** all 154,787 real asteroids GPU-instanced as non-physical
  points/small billboards, positioned from real Kepler elements at scene time. This is what
  makes the belt "full" and real — every visible rock traces to a real catalog record, none are
  `Math.random()`.
- **Physics layer (bounded subset):** a tier-scaled subset (starting from the current 20/32/48
  counts, possibly modestly larger once measured) gets full Havok `PhysicsAggregate` rigid
  bodies for collision/deflection, sampled from the same real catalog rather than a synthetic
  torus — nearest-to-ship or magnitude-weighted sampling, not arbitrary truncation.

The pre-filtered Trojan pack (1,545, already colored) and the base-pack named asteroids
(Vesta/Ceres/Pallas/Hygieia, folded in from C1) are natural small-scale proving grounds for the
Kepler-to-Cartesian conversion before it's asked to carry the full 154,787-object catalog.

**Exit:** zero `Math.random()`-derived positions remain in the belt; every visual and physics
body traces to a catalog record; Havok body count stays within PF-09's existing tier budgets;
visual density measured against the current procedural belt; both GLSL/WGSL shader twins
maintained (CLAUDE.md non-negotiable #4); frame budget holds on every device class.

## Phase C4 — Texture & surface-data upgrade

**Scope:**

- `hi-res-textures` pack (76 textures, 272 MB source) — compressed/resized through the existing
  tiered-asset pipeline conventions (`npm run assets:craft`-style; generated assets are never
  hand-edited or shipped raw per CLAUDE.md non-negotiable #22).
- Mars MOLA topography virtual texture — elevation/normal detail applied to the existing Mars
  mesh.
- Moon NASA topography virtual texture — same, for the existing Moon mesh.

Lowest-risk phase: enhances existing meshes, adds no new interactive objects, no new catalog
categories.

**Exit:** textures pass through the asset pipeline (or a documented equivalent following its
conventions); `budget:check` stays green; before/after visual diff is owner-confirmed.

---

## Cross-cutting DSO/outer-space accuracy requirements (applies to every phase)

This section is the concrete stand-in for the missing `/astra` directive:

1. Every new object's position derives from real catalog data (RA/Dec/parallax or distance, or
   real Keplerian orbital elements) through the C0 pipeline's coordinate conversion. Never
   randomly placed, never eyeballed into a "looks about right" spot.
2. Brightness/size derives from real magnitude via the existing Pogson-law photometric path,
   extended per population — galaxies need a surface-brightness/redshift-appropriate scaling
   rather than the stellar magnitude formula applied unchanged; this is a named design detail for
   C2's IMPLEMENT step, not assumed to fall out of the existing shader for free.
3. Nebulae keep their real per-object NGC2000 shape/shader (C1) rather than being folded into the
   generic 4-showcase-location placeholder that exists today.
4. Every VERIFY write-up distinguishes "measured against the real catalog record" from "visually
   plausible" — the same rigor PF-09's TR-037/TR-039 corrections established when a claim turned
   out to be imprecise.
5. No dataset is bulk-loaded into the JS bundle past the curated-JSON safe range — see the
   data-size policy in Budgets, above. This is enforced per-phase, not just checked at the end.

## Gates summary

- **C0:** informal exit — pipeline round-trips ≥1 dataset per track.
- **C2 (SDSS DR18):** ⛔ formal GO/NO-GO gate — real-device measurement required before shipping
  to any tier beyond what the measured data supports.
- **C3 (asteroid belt):** informal exit, but frame-budget-gated — must hold PF-09's existing
  tier fps floors with the real belt active on all device classes.

## Explicitly out of scope for PF-10

- **GPS live-TLE constellation** — `catalog-gps` pulls orbits live from Celestrak. Conflicts
  with the site's static-first, self-hosted-CSP posture (ADR-0005). Would need its own ADR if
  ever revisited; not part of this plan.
- **Gaia DR3 Tiny (2.55M stars) replacing the background field** — a 15× field-size change is
  its own future budget/ADR conversation, not a rider on this plan.
- **Summing multiple SDSS releases** — DR18 only, per owner decision. DR12/14/17 stay unused.

## Sequencing

C0 blocks C1, C2, and C3 (all three consume its output tracks). C1's sub-items have no hard
ordering among themselves. C2 and C3 can run in parallel once C0 lands — different output
tracks, no shared file conflicts. C4 has no dependency on C1–C3 and could technically move
earlier, but stays last per the owner's stated priority order.

## Next step

IMPLEMENT starts at C0. Per Procyon's operating model, PLAN doesn't self-authorize IMPLEMENT on
a plan this size — the owner should confirm before code changes begin, in particular the two
design calls flagged above (cluster rendering shape in C1, the two-tier asteroid-belt split in
C3), since both change what the feature actually feels like to a visitor, not just how it's
built.
