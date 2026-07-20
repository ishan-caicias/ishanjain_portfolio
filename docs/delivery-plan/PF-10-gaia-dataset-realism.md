# PF-10 Gaia Dataset Realism — real celestial catalog expansion & physical asteroid belt

**Date:** 2026-07-20
**Status:** **C0 COMPLETE** (both tracks proven — [TR-061](../test-reports/TR-061.md) Track A,
[TR-063](../test-reports/TR-063.md) Track B — hardened with regression tests + a real Hunt-Reffert
bugfix, [TR-064](../test-reports/TR-064.md) — then its one remaining known limitation, the
streaming-decode gap, closed by [TR-066](../test-reports/TR-066.md)). **C1 — 6 of 8 sub-items now
wired live, [TR-064](../test-reports/TR-064.md)/[TR-065](../test-reports/TR-065.md)/[TR-066](../test-reports/TR-066.md):**
star clusters (35 curated), base-pack minor planets (4, real Kepler-orbit positions), NEARGALCAT
(856 real galaxies), GD-1 stellar stream (1,365 real member stars), white dwarfs + CNS5 + Oort
cloud (all 3 merged into real live rendering, TR-066 — a genuine GPU buffer leak and an
over-permissive tier gate found and fixed along the way), and NGC2000 nebulae **partially**
(41 of 47 real objects — the Billboard-archetype ones — wired live; the other 8, each with a
bespoke per-object shader, remain blocked, precisely re-scoped in TR-066). **C2 (SDSS DR18) is now WIRED into real rendering** ([TR-067](../test-reports/TR-067.md)): real
binary format cracked and confirmed against the official spec, a memory-safe streaming reader
proven against the REAL 3,637,836-row file, a real distance-scale design problem (32.6M-28.86B
ly, ~1000x the star field's linear-ly range) resolved via log-depth compression, and the real
3,637,862-record galaxy field now renders on its own live mesh (`_loadSdssGalaxyLayer`) — see
TR-066/TR-067 and [ADR-0007](../adr/0007-background-bulk-layer-merge.md). **Not yet done for
C2**: the real-device (desktop/iPad/mid-Android) GO/NO-GO gate measurement itself — real Android
hardware is now available (owner-provided mid-tier + flagship, 2026-07-20) but not yet exercised.
C3/C4 not started.

**Strategic pivot (owner direction, 2026-07-20, TR-067):** build the full PF-10 delivery plan as
an IDEAL STATE, desktop as the baseline — every feature at full real scale, not preemptively
tier-reduced. Tiers/modes/settings are introduced LATER, from real extended device testing (the
newly-available Android hardware), not guessed in advance. This reverses TR-066's white-dwarf
full-tier-only gate (a defensive restriction from a SwiftShader/software-rendering measurement,
not a real device) — all bonus star layers now ship on every tier. TR-067 also found and
quantified a real, important instrument gap: CI's bundled Chromium (SwiftShader) renders this
scene's new full scale at ~3 fps vs. ~50 fps on real Chrome/GPU hardware — a ~17x gap. Real
device measurement is not a formality for this plan going forward; it is the only trustworthy
signal, per CLAUDE.md's own "measure, don't assert" rule.

Scope and priority order confirmed by owner 2026-07-20.
**Basis:** [Local Gaia dataset gap analysis](../analysis/2026-07-20-gaia-dataset-gap-analysis.md),
[dataset inventory](../datasets/README.md) (40 real Gaia Sky data packs in
`resources/gaia_datasets/`).

**Correction (2026-07-20, later same day):** the "/astra doesn't exist" note directly below was
accurate when written but is now stale — an `astra` skill was subsequently made available in
this environment and used for the C1 cluster-list realism review (see the linked review doc).
Per this repo's corrections-are-additive convention, the original note is kept as written below
rather than edited away — it was a true, honest statement of the environment at the time.

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
   **Correction (2026-07-20, later same day, [TR-065](../test-reports/TR-065.md)):** not every
   pack listed above actually uses BINARY2 — this was an assumption from the file extension
   (`.vot`) and one real MWSC decode, not verified per-file. Decoding CNS5 and GD-1 for real
   found both ship plain-text VOTable **TABLEDATA** instead (`<TR><TD>value</TD>...</TR>` rows),
   a genuinely different local serialization. NBG was checked and does use BINARY2 as stated. A
   second reader now exists for the TABLEDATA case:
   [`scripts/lib/votable-tabledata.mjs`](../../scripts/lib/votable-tabledata.mjs). Per this
   repo's corrections-are-additive convention, the claim above is left as originally written and
   corrected here rather than silently edited.
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

**Track B proven (2026-07-20, same day) — see [TR-063](../test-reports/TR-063.md). C0 EXIT
CRITERION NOW MET, both tracks.** Built `scripts/lib/fits-bintable.mjs` (a real FITS
binary-table reader — the white dwarf catalog turned out to be a **third** local data format,
neither JSON nor VOTable) and `scripts/lib/starfield-pngpack.mjs` (generic encoder reusing
`star-catalog.ts`'s exact shipped byte layout, reverse-engineered from the real assets rather
than assumed). Proven against real eDR3 white dwarf data two ways: an in-memory round-trip
through the _actual_ production `decodeStarCatalog` (6 passing unit tests, real hardcoded FITS
fixtures) and a full file-to-file CLI run against the real 40 MB FITS file (2,000/359,073 rows,
23ms, real PNG written and read back). **Real finding surfaced, not hidden:** the shared
magnitude byte format's floor is exactly mag 12.5 (calibrated for naked-eye stars); every real
white dwarf sampled (G≈18–20) is fainter than that and saturates to the format's dimmest byte —
correct behaviour of the existing format, but it means white dwarfs sharing this byte format
would all render at one indistinguishable brightness unless C1 designs a per-population
remapping. Colour-byte mapping (`bp_rp` → byte) and the object-type byte are flagged as
first-pass/provisional, deferred to C1's actual rendering-integration work.

## Phase C1 — Missing objects

**Scope** (everything from the gap analysis not covered by C2/C3 below):

| Dataset                                                 |         Records | Track                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Note                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------------------------- | --------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Star clusters (Hunt-Reffert 2023 + OCDR2 + MWSC)        | 12,190 combined | **CODE-COMPLETE for the 35-cluster curated tier (2026-07-20, TR-064).** `src/data/celestial/celestial-clusters.js` ships all 35 named clusters (22 open, 13 globular — real hand-verified J2000 coordinates/distances/ages, [validated by Astra](../analysis/2026-07-20-star-cluster-hall-of-fame-realism-review.md)), wired into `SpaceScene.tsx`'s load chain, verified travelable via a real E2E `travelTo`/`arrivedId` proof — no new rendering code needed (`"cluster"` was already a fully-handled type). Content: 10/35 flavour+lore pairs written; 25 explicitly deferred by owner decision. **NOT started:** the ~12,155-cluster instanced background layer (real MWSC coordinates, no per-object dossier) — this is separate work from the curated tier above. |
| CNS5 nearby stars                                       |           5,931 | **CODE-COMPLETE, wired live (2026-07-20, TR-066).** `public/assets/cns5.png` (5,371 real records) merged into the live star mesh via `_loadBonusStarLayers` — kept on every quality tier. **Correction:** the original "Curated JSON" track does not hold — measured standalone at 271.5 KB gzip against a bundle that had only ~52 KB of headroom left after this session's other Track A additions; Track B (PNG-pack) used instead, see the Budgets section addendum below.                                                                                                                                                                                                                                                                                           | Real neighbor stars, distinct selection principle from the existing bright-star catalogs                                                                                                                                                                                                                                     |
| eDR3 white dwarfs                                       |         359,073 | **CODE-COMPLETE, wired live (2026-07-20, TR-066/TR-067).** `public/assets/whitedwarfs-edr3.png` (full 359,073 records) merged into the live star mesh — **ships on every quality tier** (TR-067: owner's ideal-state-first pivot reversed TR-066's `full`-tier-only gate, which was based on a SwiftShader/software-rendering measurement, not a real device; real GPU hardware confirmed ~50fps with this scale merged in). 2 Astra calibration recommendations applied and shader-verified (TR-065): colour range `[-0.6,1.2]`, type byte `0`.                                                                                                                                                                                                                         | Far past curated-JSON range                                                                                                                                                                                                                                                                                                  |
| GD-1 stellar stream                                     |           1,365 | **CODE-COMPLETE (2026-07-20, TR-065).** `src/data/celestial/celestial-gd1.js` — all 1,365 real member stars as individual `t:"star"` entries, wired into `SpaceScene.tsx`'s load chain.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Each star is real and travelable; the "novel visual" connected-trail treatment below is **not** implemented — open design decision, not attempted                                                                                                                                                                            |
| Oort cloud                                              |          10,000 | **CODE-COMPLETE, wired live (2026-07-20, TR-066).** `public/assets/oortcloud.png` (full 10,000 records) merged into the live star mesh — kept on every quality tier. **Correction:** not a new instanced-particle system — both shader twins already reserve object-type byte 7 ("oort dust grain") for exactly this population; discovered verifying the white-dwarf type-byte fix against the real shader.                                                                                                                                                                                                                                                                                                                                                             | Structureless population, not named/travelable bodies                                                                                                                                                                                                                                                                        |
| NGC2000 nebulae                                         |              47 | **PARTIALLY CODE-COMPLETE (2026-07-20, TR-066): 41/47 wired live.** `src/data/celestial/celestial-ngc2000.js` — the real "Billboard"-archetype objects (data-wireable, zero new rendering code, exactly as originally assumed for all 47). **The other 8 remain BLOCKED**, precisely re-scoped: each is a "Volume"-archetype object with its OWN bespoke, hand-authored GLSL shader — needs both the reveal-mechanism redesign below AND a per-object GLSL→WGSL port, real separate design work.                                                                                                                                                                                                                                                                         | **Correction (TR-065, refined TR-066):** the original "pure data-wiring" claim was wrong for the 8 Volume objects (`nebula-field.ts`'s reveal mechanism hard-caps at 4 volumes) but TURNED OUT TRUE for the other 41 — the 47-object catalog is not uniform, discovered by reading the real local data rather than assuming. |
| Base-pack minor planets (Vesta, Ceres, Pallas, Hygieia) |               4 | **CODE-COMPLETE (2026-07-20, TR-065).** `src/data/celestial/celestial-minorplanets.js` — real positions from real Keplerian orbital elements (`scripts/gaia-minorplanet-position.mjs`), snapshotted 2026-07-20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | **Correction:** not a trivial add as originally estimated — these orbit the Sun, so (unlike every other C1 item) a fixed ra/dec is physically wrong; needed real orbital-mechanics computation, not just a data pull                                                                                                         |
| NEARGALCAT nearby galaxies                              |             856 | **CODE-COMPLETE (2026-07-20, TR-065).** `src/data/celestial/celestial-nbg.js` — all real rows, wired into `SpaceScene.tsx`'s load chain. **Correction:** record count is 856, not 875 (the plan's original figure) — see the Budgets/datasets-README addendum.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Real distance-based nearby galaxies, separate from the SDSS redshift catalog in C2                                                                                                                                                                                                                                           |

**Exit:** every category above renders at its real catalog position; unit tests cover each new
decoder/converter; E2E confirms reachability where the design calls for travelable bodies;
`npm run budget:check` stays green after each addition (checked incrementally, not only at the
end of the phase).

**Addendum, 2026-07-20 (TR-065) — real measured budget headroom, and the NGC2000 blocker in
full:**

- **Bundle headroom is now tight.** Measured incrementally per this session's own exit criterion:
  1044.4 KB → 1082.9 KB (+ minor planets + NBG) → 1147.8 KB (+ GD-1) gzip, against the 1200 KB
  budget — **52.2 KB headroom remains.** CNS5's Track A candidate measured 271.5 KB gzip
  standalone, over 5× the remaining headroom, which is why it stayed Track B (proven, not wired)
  rather than joining the three items above. Any future C1/C2/C3 Track A addition must be
  measured against a real build before landing, not assumed safe from the original gap
  analysis's per-dataset (not per-bundle) verdicts.
- **NGC2000 is not "pure data-wiring."** `nebula-field.ts` (the module actually backing
  `babylon-engine.ts:1172-1211`'s raymarch pipeline, per ADR-0004) bakes every nebula volume's
  raymarch call directly into both shader sources with no uniform arrays (a deliberate ADR-0004
  choice), and routes each volume's destination-gated reveal state through one component of a
  single `vec4 uReveal` uniform via a swizzle literal (`x`/`y`/`z`/`w`) baked per volume at
  generation time. `revealComponent()` throws `"uReveal carries at most 4 volumes"` past index 3
  — today's 4 showcase nebulae sit exactly at that ceiling. Adding NGC2000's 47 real nebulae
  under this mechanism unmodified would not degrade gracefully; it crashes shader generation
  outright the moment a 5th volume is added. This needs a DESIGN step before any IMPLEMENT can
  start: likely replacing the per-volume reveal component with a small fixed set of
  active-volume-index + reveal-amount uniforms (since at most one destination nebula is ever
  meaningfully visible at a time by the existing destination-gated design), rather than
  continuing to unroll an unconditional raymarch call per volume regardless of visibility.

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
DR18 stays the target.

**Correction (2026-07-20, later same day, [TR-066](../test-reports/TR-066.md)): SDSS DR18 does
NOT ship VOTable BINARY2** as this section originally assumed — its real data file
(`sdss/sdss_dr18.bin`) is Gaia Sky's own native `BinaryPointDataProvider` binary format, a FOURTH
local serialization discovered this session, confirmed against the official Gaia Sky format spec
and byte-verified against the real 3,637,836-row file (`scripts/lib/gaiasky-binary-particles.mjs`

- 7 unit tests). The streaming-decode gap this section flagged as "not yet started" **is now
  closed and proven against the real file**: 487ms, 0.6 MB heap delta, zero per-record object
  allocation.

**Real distance-scale finding, resolved (TR-066):** the real file's distances span ~32.6 million
to ~28.86 billion light-years — a ~1000x range dwarfing the star field's existing linear-ly
placement convention (max ~2,400 ly). Resolved by baking log-depth compression (the exact
`bodyDepth()` formula every curated body already uses) into the packed positions instead of
linear light-years — see [ADR-0007](../adr/0007-background-bulk-layer-merge.md). Consequence:
SDSS needs its own separate mesh (not merged into the linear-scaled `CATALOG_CHUNKS` star field).

**Full pipeline proven against the REAL file** (`scripts/gaia-sdss18-pngpack.mjs`): all 3,637,836
real records packed in ~1 second. Photometry: the real file carries no per-object magnitude/
colour data (confirmed against the format spec and the Gaia Sky app's own renderer-side colour-
range config) — every record gets a uniform, honestly-declared byte pair, matching the Oort
cloud's precedent.

**WIRED INTO REAL RENDERING (2026-07-20, [TR-067](../test-reports/TR-067.md)):** the full real
asset (`public/assets/sdss18.png`, 47.1 MB, 3,637,862 real records including the shared PNG
format's known padding-record behaviour) now loads via `_loadSdssGalaxyLayer`
(`babylon-engine.ts`) into its own live mesh, fetched after `cosmos:ready`, sharing the existing
`ijStar` material (object-type byte 3 = "galaxy smudge", already a real shader branch). Real E2E
proof: exact record count + mesh readiness.

**Real finding (TR-067): CI's SwiftShader software rendering cannot represent this scene's real
performance.** Measured directly: ~3 fps on Playwright's bundled Chromium (SwiftShader) vs. ~50
fps on real Chrome/GPU hardware, on the identical scene. This is why the GO/NO-GO gate below
requires REAL device measurement, not CI automation — CI's own instrument is now confirmed
unrepresentative at this scale, not just theoretically suspect.

**Remaining before this gate can run:** the real-device fps/startup measurement itself (desktop/
iPad/mid-Android) — real Android hardware (mid-tier + flagship) is now available (owner,
2026-07-20) but not yet exercised. No iPad/tablet access confirmed yet either.

**Exit:** DR18 field renders (✅ done, TR-067); gate measured and recorded (real device data
pending); tier-gating decision (if any) written up.

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
