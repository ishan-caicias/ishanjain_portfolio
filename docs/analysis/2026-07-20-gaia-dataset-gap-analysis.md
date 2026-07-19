# Local Gaia Sky datasets vs. rendered celestial catalog — gap analysis

**Date:** 2026-07-20
**Mode:** INSPECT / DESIGN (no code changed)
**Context:** Owner supplied `resources/gaia_datasets/` (40 real Gaia Sky data packs, ~1.3 GB,
hand-picked from the ~141 on [gaiasky.space](https://gaiasky.space/resources/datasets/) under
a 0.5 GB/pack cutoff) and asked (1) whether the site is missing celestial objects that these
datasets could supply, and (2) whether the Babylon engine's asteroid belt can be replaced with
a real dataset instead of its current procedural generation. Full per-dataset detail —
authoritative record counts, formats, and two source-webpage bugs corrected — lives in
[`docs/datasets/README.md`](../datasets/README.md); this document does not repeat it.

**Status:** analysis only. No conversion scripts, no data files, no engine code changed. Scope
and priority need an owner decision before IMPLEMENT starts — see "Open decisions" at the end.

---

## Baseline: what's rendered today

Per the live catalog audit (`src/data/celestial/*.js`, `src/lib/star-catalog.ts`,
`src/lib/babylon-asteroids.ts`):

| Layer                      |            Count | Source                                                                                                                                                                     | Rendered as                                                                                                           |
| -------------------------- | ---------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| Background star field      |          168,959 | Hipparcos (117,964) + Gaia DR3 deep layer (50,995), PNG-packed                                                                                                             | Instanced point sprites, both engines                                                                                 |
| Curated interactive bodies |            2,525 | `celestial-catalog.js` (102) + `celestial-extra.js` (198, Hipparcos bright) + `celestial-extra2.js` (2,200, BSC5 + OpenNGC) + `celestial-gaia.js` (25, spacecraft/exotica) | Named, travelable, hand-curated JSON                                                                                  |
| Babylon asteroid belt      | 20/32/48 by tier | **Procedural** — seeded LCG torus, no catalog (`babylon-asteroids.ts:34-136`)                                                                                              | Havok rigid bodies, Babylon only, no legacy-engine equivalent                                                         |
| Volumetric nebulae         |                4 | Hardcoded showcase locations (`babylon-engine.ts:1172-1211`, `nebula-field.ts`)                                                                                            | Raymarched shader volumes, Babylon only                                                                               |
| OpenNGC nebula/galaxy rows | ~subset of 2,200 | `celestial-extra2.js` types `n`/`g`                                                                                                                                        | **Flat billboard quads** — procedural beacon shape or photo-atlas quad, not volumetric (`celestial-bodies.ts:70-123`) |

`celestial-gaia.js` already covers more than expected: Voyager 1/2, JWST, HST, ISS, Euclid, GPS
marker, all seven named DR3 exoplanet-host systems (Gl876, HD40503, HD81040, HD114762,
J0805+4812, UCAC2-1151977, WD0141-675), all three Gaia black holes (BH1/2/3), Gargantua, plus
TRAPPIST-1, 55 Cnc, HR8799, GJ667C, TOI-178, and Moon/Mars topography markers. **The gap is not
in named spacecraft or exotic systems — those are done.** The gap is in bulk real-catalog
categories that have never been touched.

## What the local datasets add that isn't rendered at all

Five categories exist in `resources/gaia_datasets/` with zero current representation:

1. **Star clusters** — three independent real catalogs, 12,190 clusters combined
   (Hunt-Reffert 2023: 7,167; OCDR2: 2,017; MWSC: 3,006). The site currently has no cluster
   category whatsoever — not even the handful visible in Messier/NGC data.
2. **Galaxies as a real, bulk category** — NEARGALCAT (875 nearby galaxies with real distances)
   plus four SDSS releases (327k–3.6M galaxies each, redshift-based). Today's only galaxies are
   whatever `g`-typed rows happen to exist inside the 2,200-row OpenNGC subset — a handful, not
   a catalog.
3. **Real asteroid/SSO orbital data** — 154,787 DR3 asteroids with actual astrometry and orbital
   elements, plus curated NEA (393) and Trojan (1,545) subsets. The Babylon belt currently has
   **none of this** — see the dedicated section below.
4. **White dwarfs as a distinct population** — 359,073 eDR3 candidates. Not curated separately
   today (a few may incidentally exist inside BSC5/OpenNGC, but not as a population).
5. **Oort cloud** — 10,000 simulated ice particles. No outer-solar-system particle structure
   exists today at all.

Two more categories exist locally with only partial/different current coverage:

6. **CNS5 nearby-star catalog** (5,931 stars, volume-complete within ~25 pc) is a different
   selection principle than what's rendered (BSC5 = bright-limited, Hipparcos = magnitude-driven
   background field). Nearby ≠ bright; CNS5 would surface real neighbor stars invisible to the
   naked eye that the current catalogs miss.
7. **NGC2000 nebula pack** (47 nebulae, each shipping its own GLSL) is a real, richly-detailed
   catalog that could feed the _existing_ volumetric raymarch pipeline
   (`babylon-engine.ts:1172-1211`), which today only has 4 hardcoded showcase locations. This is
   the one gap that's purely a data-wiring problem — the rendering path already exists.

**GD-1 stellar stream** (1,365 stars) is a genuinely novel visual feature — a real tidal debris
stream — with no equivalent anywhere in the current scene.

## Asteroid belt — replacing procedural with real data

This is the owner's second explicit ask. Current state (`babylon-asteroids.ts:34-136`,
`babylon-engine.ts:2940-3070`, tier counts in `babylon-tiers.ts:55,64,73`): a seeded LCG
scatters 20/32/48 bodies on a hardcoded torus (`center [0,0,-13]`, `radius 170`), each getting a
random scale, one of 4 pre-built rock meshes, random linear/angular velocity, and mass ∝ scale³
for the Havok `PhysicsAggregate`. **Nothing about it reads real data — position, size, and
velocity are all synthetic.**

`catalog-asteroids-dr3/orbits-asteroids-dr3.json` has real Keplerian orbital elements
(semi-major axis, eccentricity, inclination, etc.) for 154,787 objects. Replacing the belt with
real data means:

- **Not** instancing all 154,787 — that's 3,200–7,700× the current body count and would blow
  frame budget and Havok's rigid-body count instantly.
- Sampling a physically-representative subset (e.g. a few hundred to match/modestly exceed
  current tier counts) drawn from the real orbital-element distribution, computing actual
  world position from each asteroid's Keplerian elements at scene time instead of a random
  torus point, and keeping synthetic mass/velocity derivation (real asteroid masses aren't in
  this catalog) or deriving velocity from the orbit itself for correctness.
- The **Trojan pack** (1,545 real Trojans, already pre-filtered and colored) is a better direct
  fit for a small showcase belt than sampling the full 154k main-belt catalog — worth comparing
  both before committing.
- `default-data/asteroids.json` (Vesta, Ceres, Pallas, Hygieia — 4 named bodies, real orbital
  elements) is a trivial add regardless of the belt decision: these are real, named, already
  correctly small.

This is real engineering work — a Kepler-to-Cartesian conversion, a sampling strategy, and
Havok body generation from real element distributions instead of `Math.random()`. Estimate:
similar order of effort to the original Havok belt build (B4).

## Budget reality check — what's safe to bake in vs. what isn't

CLAUDE.md's non-negotiables (bundle budget, 16.6 ms/25 ms frame budget, no per-frame allocation)
apply here directly. The curated-JSON pipeline (`celestial-gaia.js` style — hand-written JSON,
bundled as JS) is right for **tens to low thousands** of named, interactive bodies. It is
**wrong** for anything past that:

| Dataset                     |           Records | Safe as curated JSON?             | Recommended track                                                                                     |
| --------------------------- | ----------------: | --------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Clusters (3 packs combined) |            12,190 | Borderline                        | Curated JSON if trimmed/deduped, else PNG-pack like the star field                                    |
| NEARGALCAT                  |               875 | Yes                               | Curated JSON                                                                                          |
| CNS5                        |             5,931 | Yes                               | Curated JSON                                                                                          |
| GD-1                        |             1,365 | Yes                               | Curated JSON                                                                                          |
| Trojan asteroids            |             1,545 | Yes (for belt sampling)           | Curated JSON                                                                                          |
| NEA asteroids               |               393 | Yes                               | Curated JSON                                                                                          |
| Oort cloud                  |            10,000 | Borderline                        | Instanced particle system, not individual JSON bodies                                                 |
| eDR3 white dwarfs           |           359,073 | **No**                            | PNG-pack background layer, same technique as the 168,959-star field                                   |
| Any single SDSS release     | 327,835–3,637,836 | **No**                            | PNG-pack background layer, **pick the smallest (DR12, 327,835) not all four**                         |
| Gaia DR3 Tiny               |         2,552,302 | **No**                            | Out of scope — this alone is 15× the current background field; would need its own budget conversation |
| DR3 asteroid catalog (full) |           154,787 | **No**, not for direct instancing | Sample a small subset for the belt (see above); don't bulk-load                                       |

Nothing here should be summed uncritically. "12,190 clusters + 875 galaxies + 5,931 nearby stars

- 359,073 white dwarfs + 327,835 SDSS + 10,000 asteroids + 1,365 GD-1 + 10,000 Oort" is not one
  task — it's roughly four different integration problems (curated bodies, background-field
  PNG-pack, particle instancing, orbital-mechanics sampling) at wildly different scales, each
  needing its own budget check against `budget:check` before landing.

## Explicitly not recommended right now

- **GPS constellation live TLE fetch** — `catalog-gps/dataset.json` describes orbits pulled
  on-demand from Celestrak. This is a live external network dependency; it conflicts with the
  site's static-first, no-backend, self-hosted-CSP posture (ADR-0005, CLAUDE.md security rules).
  A static orbit snapshot would be consistent with the rest of the catalog; live TLE polling is
  not, without a dedicated ADR.
- **Summing all four SDSS releases** — they're overlapping data releases of the same survey, not
  four independent galaxy catalogs. Pick one.
- **Bulk-loading Gaia DR3 Tiny (2.55M stars) into the existing 168,959-star field** — real
  option, but a 15× field-size increase is its own performance/ADR conversation, not a rider on
  this gap analysis.
- **Mars/Moon topography virtual textures and the hi-res texture pack** — real quality
  upgrades for existing planet/moon meshes, but they're surface detail, not new _objects_. Worth
  doing, but a separate, lower-risk visual-quality task from the catalog-expansion work above.

## Open decisions (owner input needed before IMPLEMENT)

1. **Priority order** across: (a) real asteroid belt, (b) star clusters, (c) one galaxy catalog,
   (d) white dwarfs, (e) NGC2000 nebula wiring into the existing volumetric pipeline, (f) CNS5 /
   GD-1 / Oort cloud. Recommend starting with (a) and (e) — (a) is explicitly requested and (e)
   reuses an existing rendering path rather than building a new one.
2. **Which SDSS release** (recommend DR12, smallest at 327,835 records) if galaxies are in scope
   for this phase.
3. **Real vs. sampled asteroid belt** — full Kepler-element sampling from the 154,787-object
   catalog, or start with the pre-filtered 1,545-object Trojan pack as a lower-effort first cut.
4. **Whether this becomes a PF-10 delivery plan** or folds into PF-09's remaining scope — given
   the size (multiple new data-integration tracks, at least one new build-pipeline stage since
   `data/build/03-curated.js`'s executable body doesn't exist in this repo and would need
   reconstruction), this reads as a new delivery plan rather than a PF-09 GAP item.

No code, data conversion, or asteroid-belt changes have started pending these answers.
