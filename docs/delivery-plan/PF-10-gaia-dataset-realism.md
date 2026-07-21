# PF-10 Gaia Dataset Realism — real celestial catalog expansion & physical asteroid belt

**Date:** 2026-07-20
**Status:** **C0 COMPLETE** (both tracks proven — [TR-061](../test-reports/TR-061.md) Track A,
[TR-063](../test-reports/TR-063.md) Track B — hardened with regression tests + a real Hunt-Reffert
bugfix, [TR-064](../test-reports/TR-064.md) — then its one remaining known limitation, the
streaming-decode gap, closed by [TR-066](../test-reports/TR-066.md)). **C1 COMPLETE — every
sub-item now code-complete,
[TR-064](../test-reports/TR-064.md)/[TR-065](../test-reports/TR-065.md)/[TR-066](../test-reports/TR-066.md)/[TR-070](../test-reports/TR-070.md)/[TR-072](../test-reports/TR-072.md)/[TR-073](../test-reports/TR-073.md):**
star clusters (35 curated + a 12,065-object MWSC/Hunt-Reffert-2023/OCDR2 background layer,
TR-070), base-pack minor planets (4, real Kepler-orbit positions), NEARGALCAT
(856 real galaxies), white dwarfs + CNS5 + Oort cloud (all 3 merged into real live rendering,
TR-066 — a genuine GPU buffer leak and an over-permissive tier gate found and fixed along the
way), NGC2000 nebulae — **41 Billboard-archetype objects live since TR-066, and now all 8
Volume-archetype objects too (TR-072)**: a generalized SOLID shape system + a scalable 2-slot
reveal mechanism (ADR-0004 amendment, replacing the old 4-volume vec4 cap) let all 8 real objects
(Helix, Cat's Eye, Box, Butterfly, Hourglass, Crab, Ring, Trifid) render with original,
Astra-science-briefed SDF shapes — Gaia Sky's own per-object shaders for these 8 turned out to be
CC-BY-NC-SA (non-commercial licensed), which the owner declined to accept the risk of porting —
and **GD-1's connected-trail visual, the plan's last remaining C1 item, closed
(TR-073)**: the 1,365 real member stars are now connected by a line ordered by a real
great-circle fit to the stream (Astra science brief; the catalog's own row order is confirmed
arbitrary), coloured along its length by real radial velocity — a genuine, literature-standard
GD-1 diagnostic, not decoration. **C2 (SDSS
DR18) is now WIRED into real rendering** ([TR-067](../test-reports/TR-067.md)): real
binary format cracked and confirmed against the official spec, a memory-safe streaming reader
proven against the REAL 3,637,836-row file, a real distance-scale design problem (32.6M-28.86B
ly, ~1000x the star field's linear-ly range) resolved via log-depth compression, and the real
3,637,862-record galaxy field now renders on its own live mesh (`_loadSdssGalaxyLayer`) — see
TR-066/TR-067 and [ADR-0007](../adr/0007-background-bulk-layer-merge.md). **Not yet done for
C2**: the real-device (desktop/iPad/mid-Android) GO/NO-GO gate measurement itself — real Android
hardware is now available (owner-provided mid-tier + flagship, 2026-07-20) but not yet exercised.
**C3 (full real-data asteroid belt) is now CODE-COMPLETE**
([TR-074](../test-reports/TR-074.md)): the seeded-LCG procedural torus is replaced by the real
Gaia DR3 catalog — 154,662 real objects (measured; `dataset.json`'s 154,787 is wrong), each
positioned by a real Kepler state solution propagated from its own real epoch, split exactly as
this plan proposed into a full-catalog visual layer (`public/assets/asteroids-dr3.png`, own mesh,
object-type byte 6) and a bounded real-catalog Havok subset at the unchanged 20/32/48 tier counts.
The real Kirkwood resonance gaps emerge from the data unprompted, which is the proof the belt is
real rather than procedural. An Astra science brief caught a genuinely wrong colour byte (the
first draft rendered asteroids as ~4000 K K-stars) and an epoch-dependent physics-subset
selection, both fixed — and flagged one real defect, the belt's 23.44° frame offset, which is
recorded below as an OPEN OWNER DECISION rather than silently defaulted. **C3's three known
limitations are now all closed ([TR-075](../test-reports/TR-075.md)):** the full 154,662-object
belt now ORBITS with real Keplerian differential rotation — the rate derived in-shader from
Kepler's third law, so it costs zero per-vertex data in a shader four other layers share — while
the Kirkwood gaps stay exactly invariant and reduced motion freezes the belt at its real snapshot
positions; the Trojan/NEA "merge" was disproved rather than done (both packs are 100% exact
subsets with bit-identical elements, so merging adds nothing); and the docs-drift checker's
broken-link warning turned out to be a defect in the checker's own CommonMark parsing, now fixed
and regression-tested. **C3's frame-budget half is STILL NOT measured** — it inherits C2's
instrument problem exactly, and TR-075 added per-vertex trigonometric work to 154,662 billboards,
which makes that measurement more necessary rather than less. **C4 RE-SCOPED and C4.1 COMPLETE** ([TR-076](../test-reports/TR-076.md)): the plan's premise for this phase — applying topography "to the existing Mars mesh" — turned out to rest on a mesh that never existed; every body in this scene is a 128px billboard cell. Owner chose real spheres + full virtual texturing. C4.1 (sphere renderer, real equirect surface maps, real elevation, real Sun lighting with Astra's Lunar-Lambert correction) is live for 12 bodies, 3 of them with real topography; C4.2 is PARTIAL ([TR-077](../test-reports/TR-077.md)): measuring the FIXED arrival camera (38 units from a radius-26 sphere, no zoom anywhere) made the magnification computable and produced three findings — the shipped 4096 map was 4x magnified so C4.1 was visibly soft, VT level 5 is unreachable by this camera and is never built (~75% asset saving), and level 3/4 sit ~1% under 1080p/4K parity. Shipped: an ultra (8192) surface tier, progressive high->ultra loading, an enforced NEVER_SPHERE rule for Phobos/Deimos, real sidereal rotation on its own 1e3 clock (the belt's 4e5 would alias Mars backwards past Nyquist), and the complete VT bake pipeline (1,364 offline-baked normal tiles). The runtime tile streamer is deliberately NOT wired — see TR-077 Part 6. C4.2 is now COMPLETE ([TR-078](../test-reports/TR-078.md)) — the runtime VT streamer and the Venus cloud descent both landed. **PF-10 IS FEATURE-COMPLETE**: per [ADR-0008](../adr/0008-ship-first-measure-after.md) (owner direction, 2026-07-21) C2 and C3 ship at FULL SCOPE with their measurement gates retired as preconditions and replaced by a post-ship real-device obligation, and PF-09's B6 frame-budget gate is not applied to PF-10 items. What remains is measurement, not features: the real-device pass, the asset-weight decision (221 MB), the belt's 23.44° frame decision, and C4.3 (self-shadowing + tier gating), all of which now want real hardware data first. **TR-070's
flagged `ship track` E2E failure is now root-caused and fixed
([TR-071](../test-reports/TR-071.md))**: a real wall-clock-progress-vs-frame-count-bounded-ramp
race, triggered only by travelling to the closest possible catalog target under CI's now-very-slow
SwiftShader rendering for this scene's current size — confirmed correct on real GPU hardware
(534ms), fixed by pointing the test at a farther target with a longer configured warp duration.

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

## Phase C0 — Data pipeline foundation ✅ COMPLETE (both tracks proven, TR-061/TR-063) — originally ⛔ blocked every other phase

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

| Dataset                                                 |         Records | Track                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Note                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------------------------- | --------------: | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Star clusters (Hunt-Reffert 2023 + OCDR2 + MWSC)        | 12,190 combined | **CODE-COMPLETE (2026-07-20, TR-064 + TR-070).** Curated tier: `src/data/celestial/celestial-clusters.js` ships all 35 named clusters (22 open, 13 globular — real hand-verified J2000 coordinates/distances/ages, [validated by Astra](../analysis/2026-07-20-star-cluster-hall-of-fame-realism-review.md)), wired into `SpaceScene.tsx`'s load chain, verified travelable via a real E2E `travelTo`/`arrivedId` proof — no new rendering code needed (`"cluster"` was already a fully-handled type). Content: 10/35 flavour+lore pairs written; 25 explicitly deferred by owner decision. **Background tier (TR-070):** `public/assets/clusters-bg.png` (12,065 real records — the 12,190 combined raw rows across all 3 sources minus 125 real duplicates of the 35 curated clusters, deduped by real sky position + distance, not name matching) merged into the live star mesh via `_loadBonusStarLayers`, object-type byte 1 ("cluster: soft glow, no PSF core"), no per-object dossier. |
| CNS5 nearby stars                                       |           5,931 | **CODE-COMPLETE, wired live (2026-07-20, TR-066).** `public/assets/cns5.png` (5,371 real records) merged into the live star mesh via `_loadBonusStarLayers` — kept on every quality tier. **Correction:** the original "Curated JSON" track does not hold — measured standalone at 271.5 KB gzip against a bundle that had only ~52 KB of headroom left after this session's other Track A additions; Track B (PNG-pack) used instead, see the Budgets section addendum below.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Real neighbor stars, distinct selection principle from the existing bright-star catalogs                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| eDR3 white dwarfs                                       |         359,073 | **CODE-COMPLETE, wired live (2026-07-20, TR-066/TR-067).** `public/assets/whitedwarfs-edr3.png` (full 359,073 records) merged into the live star mesh — **ships on every quality tier** (TR-067: owner's ideal-state-first pivot reversed TR-066's `full`-tier-only gate, which was based on a SwiftShader/software-rendering measurement, not a real device; real GPU hardware confirmed ~50fps with this scale merged in). 2 Astra calibration recommendations applied and shader-verified (TR-065): colour range `[-0.6,1.2]`, type byte `0`.                                                                                                                                                                                                                                                                                                                                                                                                                                               | Far past curated-JSON range                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| GD-1 stellar stream                                     |           1,365 | **CODE-COMPLETE (2026-07-20, TR-065 + TR-073).** `src/data/celestial/celestial-gd1.js` — all 1,365 real member stars as individual `t:"star"` entries, wired into `SpaceScene.tsx`'s load chain. **Connected-trail visual (TR-073):** `src/lib/gd1-trail.ts` orders the real stars along a spherical-PCA great-circle fit to the real sample (the catalog's own row order is confirmed arbitrary — connecting it directly would zigzag), colours the resulting line by real radial velocity (a genuine GD-1 kinematic diagnostic, Astra science-briefed), and renders it as a static `Material.LineListDrawMode` mesh matching `constellations.ts`'s established pattern.                                                                                                                                                                                                                                                                                                                      | Each star is real and travelable; the connected-trail visual is now implemented — the open design decision (line-strip vs ribbon vs data-coloured line) was resolved by the owner in favour of a data-coloured line                                                                                                                                                                                                                                                                                                                                                       |
| Oort cloud                                              |          10,000 | **CODE-COMPLETE, wired live (2026-07-20, TR-066).** `public/assets/oortcloud.png` (full 10,000 records) merged into the live star mesh — kept on every quality tier. **Correction:** not a new instanced-particle system — both shader twins already reserve object-type byte 7 ("oort dust grain") for exactly this population; discovered verifying the white-dwarf type-byte fix against the real shader.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Structureless population, not named/travelable bodies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| NGC2000 nebulae                                         |              47 | **CODE-COMPLETE (2026-07-20, TR-066 + TR-072): 47/47 wired live.** `src/data/celestial/celestial-ngc2000.js` — 41 real "Billboard"-archetype objects (data-wireable, zero new rendering code, TR-066). The 8 "Volume"-archetype objects (Helix, Cat's Eye, Box, Butterfly, Hourglass, Crab, Ring, Trifid) render via `nebula-field.ts`'s generalized SDF shape system + a scalable 2-slot reveal mechanism (ADR-0004 amendment, TR-072) — **original shapes**, not Gaia Sky's own per-object shaders, which turned out to be CC-BY-NC-SA (non-commercial licensed); Astra produced a real science brief for each object's shape/colour choices.                                                                                                                                                                                                                                                                                                                                                | **Correction (TR-065, refined TR-066):** the original "pure data-wiring" claim was wrong for the 8 Volume objects (`nebula-field.ts`'s reveal mechanism hard-caps at 4 volumes) but TURNED OUT TRUE for the other 41 — the 47-object catalog is not uniform, discovered by reading the real local data rather than assuming. **Correction (TR-072):** the plan's original assumption that the 8 Volume objects would need "a per-object GLSL→WGSL port" of Gaia Sky's own shaders did not hold — those shaders are CC-BY-NC-SA, so original shapes were designed instead. |
| Base-pack minor planets (Vesta, Ceres, Pallas, Hygieia) |               4 | **CODE-COMPLETE (2026-07-20, TR-065).** `src/data/celestial/celestial-minorplanets.js` — real positions from real Keplerian orbital elements (`scripts/gaia-minorplanet-position.mjs`), snapshotted 2026-07-20.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | **Correction:** not a trivial add as originally estimated — these orbit the Sun, so (unlike every other C1 item) a fixed ra/dec is physically wrong; needed real orbital-mechanics computation, not just a data pull                                                                                                                                                                                                                                                                                                                                                      |
| NEARGALCAT nearby galaxies                              |             856 | **CODE-COMPLETE (2026-07-20, TR-065).** `src/data/celestial/celestial-nbg.js` — all real rows, wired into `SpaceScene.tsx`'s load chain. **Correction:** record count is 856, not 875 (the plan's original figure) — see the Budgets/datasets-README addendum.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Real distance-based nearby galaxies, separate from the SDSS redshift catalog in C2                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |

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
  **Resolved 2026-07-20 (TR-072, ADR-0004 amendment):** implemented essentially as predicted
  here — a 2-slot active/previous `uVolumeA/uRevealA` + `uVolumeB/uRevealB` scheme (2 slots
  rather than 1, to preserve the existing fade-out crossfade behaviour when leaving a volume).
  All 47 NGC2000 objects (41 Billboard + 8 Volume) are now live.

## Phase C2 — SDSS DR18 galaxy field ✅ SHIPPED AT FULL SCOPE ([ADR-0008](../adr/0008-ship-first-measure-after.md))

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

**Exit (REVISED 2026-07-21, ADR-0008):** DR18 field renders at full scope — all 3,637,862 real
records, no tier gate, no decimated subsample. **The GO/NO-GO gate below is RETIRED as a
precondition** and replaced by a post-ship real-device measurement obligation: the owner
directed shipping first and adjusting rendering from real data afterwards, because the only
automated instrument available (CI SwiftShader, ~3 fps vs ~50 on real hardware) is confirmed
unrepresentative, and gating on it repeats TR-066's reversed white-dwarf mistake. The
measurement is still owed and still gets a TR — ADR-0008 changes WHEN, not WHETHER. The original
gate text is left standing below per the corrections-are-additive convention.

**Superseded exit:** DR18 field renders (✅ done, TR-067); gate measured and recorded (real device data
pending); tier-gating decision (if any) written up.

## Phase C3 — Full real-data asteroid belt (replaces the procedural belt) ✅ CODE-COMPLETE (TR-074)

**Status (2026-07-20, [TR-074](../test-reports/TR-074.md)): implemented, both tiers, exactly as
the two-tier design below proposed.** The real catalog turned out to hold **154,662** objects with
complete orbital elements (not the 154,787 `dataset.json` advertises, and not the 154,635 a first
chunked key-count suggested — measured by a real full stream, 0 skipped). Everything else the
phase called for landed:

- **A fifth local serialization**, discovered rather than assumed: the asteroid packs are plain
  pretty-printed JSON, but 150.7 MB of it, where `JSON.parse` is the wrong tool. A streaming,
  string- and escape-aware brace-depth reader
  ([`scripts/lib/gaiasky-orbit-json.mjs`](../../scripts/lib/gaiasky-orbit-json.mjs)) walks the real
  file in ~2 s with one chunk retained, never one catalog.
- **Visual layer:** all 154,662 real objects, positions solved per object from its OWN real epoch
  (945 distinct ones spanning 2.8 years) via a real Kepler state solver, PNG-packed as
  `public/assets/asteroids-dr3.png` (2.0 MB) and rendered on their own mesh via
  `_loadAsteroidVisualLayer` — object-type byte 6, which both shader twins already labelled
  "DR3 asteroid" in their vertex stage and which C3 completes with a matching tight, bloom-free
  fragment branch.
- **Physics layer:** a bounded real subset in the generated
  [`src/data/asteroids-dr3-physics.ts`](../../src/data/asteroids-dr3-physics.ts) — real names, real
  positions, real Keplerian velocity vectors. Tier body counts (20/32/48) are unchanged: the
  budget is a frame-time fact, so the real catalog changes WHICH rocks exist, not how many.
- **The belt is demonstrably real, not procedural**: the real Kirkwood resonance gaps fall out of
  the data unprompted — 3:1 at 2.50 AU depleted to 51% of local density, 5:2 at 2.82 AU to 32%,
  2:1 at 3.28 AU to 5%. Astra measured them still sharper on the raw elements (100× / 21× / 200×
  depletion, minima landing exactly on the resonances). No noise function produces that.

**Astra science brief:**
[`docs/analysis/2026-07-20-dr3-asteroid-belt-science-brief.md`](../analysis/2026-07-20-dr3-asteroid-belt-science-brief.md).
Three of its findings were applied directly: the colour byte was **wrong** in the first draft
(214 / t = 0.85 renders as a ~4000 K K5–M0 star; real main-belt asteroids are warm grey, B−V ≈
0.80 → byte 173), the magnitude byte moved to the format's dim floor, and the physics-subset
selection was changed from snapshot-position ranking to an epoch-independent real orbital-element
cut (a ∈ [2.60, 2.75] AU, e < 0.10, i < 5°) — the original made the belt's physics roster a
function of the date the script happened to run.

**⚠️ OPEN OWNER DECISION — the belt's frame (Astra: the one real defect in C3).** The scene's X–Y
plane is DECLARED to be the ecliptic; the rest of the catalog (stars, DSOs) is equatorial. The
belt therefore sits **23.44° off the real zodiac** (~47 full-Moon diameters at the solstitial
points) — visible to anyone who knows where the ecliptic runs. It is not fixed by default because
the rotation itself is trivial (`--frame equatorial` does it today) but the belt MODEL —
spine circle, herding pull, gaussian density, warp slowdown, passage deflection, and the
deliberately-chosen m42 showcase-route crossing — is defined in the X–Y plane about world Z.
Rotating only the data tilts the real belt out of the frame those act in. Doing it properly means
re-expressing the belt model in an inclined basis: real, bounded work, and a goal-1-vs-tuned-
interaction call for the owner, not a silent default. Recorded, not resolved.

**Closed 2026-07-20 ([TR-075](../test-reports/TR-075.md)) — the belt now orbits.** TR-074 left
this as a known limitation because per-vertex orbital elements would cost ~2.5 MB of GPU memory in
a shader four other layers share. Resolved by DERIVING the rate instead of storing it: Kepler's
third law fixes mean motion from orbital radius alone, and the shader already knows each speck's
distance from the Sun, so the motion costs **zero new attributes and one uniform**. The result is
real Keplerian differential rotation — the inner edge gains 46.5° of longitude on the outer edge
every minute, full relative wrap in 7.7 minutes — while the Kirkwood gaps stay exactly invariant
(rotation about Z preserves every radius). Reduced motion pins the clock to 0, returning precisely
the already-validated static scene. Second Astra brief
([orbital motion](../analysis/2026-07-20-dr3-asteroid-belt-orbital-motion-brief.md)) supplied the
derived constant (39.823416, replacing a 0.041%-off hand-solved value) and caught that the rate
must measure from the SUN rather than the world origin — worth up to +189% error for the 94 real
objects inclined past 40°.

**Also closed (TR-075): the Trojan/NEA packs need no merge — the limitation was wrong.** Verified
by streaming all three real files: **1,544/1,544 Trojans and 392/392 NEAs are already in the main
catalog with bit-identical orbital elements.** Both packs are exact pre-filtered subsets; merging
would add zero objects and create 1,936 exact duplicates. The shipped belt was already complete.
Their one genuine offer is a curated classification label (~25 KB) if Trojans/NEAs should ever be
tagged distinctly — a new feature, not this merge.

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

**Exit REVISED 2026-07-21 ([ADR-0008](../adr/0008-ship-first-measure-after.md)):** every criterion
above is met except the last, and the frame-budget precondition is **retired as a blocker** on the
same reasoning as C2 — measured post-ship on real hardware rather than gated on a software
rasterizer. C3 ships at full scope: all 154,662 real asteroids, orbital motion active, Havok subset
at the unchanged 20/32/48 tier counts.

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

**⛔ CORRECTION (2026-07-21, [TR-076](../test-reports/TR-076.md)) — the two paragraphs above are
WRONG, and the error is structural rather than a detail.** Per this repo's corrections-are-additive
convention they are left standing; everything below supersedes them.

**There is no Mars mesh. There is no planet mesh at all.** Every curated body — all 267 with
photographic imagery — renders as a BILLBOARD QUAD sampling a 128×128 cell of the shared
4096×4096 `atlas.jpg` (`celestial-bodies.ts`, GAP-02). A flat camera-facing sprite cannot carry
topography, cannot have a terminator, and cannot show a phase. So C4 is not "the lowest-risk
phase"; it is the phase that **introduces planetary surface rendering to this engine**, which
makes it the largest rendering feature in PF-10 rather than the smallest.

The two topography packs compound this: they are **virtual textures** (Mars = 6 levels,
1024×1024 tiles, 2,048 tiles at level 5 for a 64K equirect pyramid; Moon = 5 levels), which
presuppose a sphere, UV mapping and a tile streamer with LOD selection — none of which existed.

**Owner decision (2026-07-21):** re-scoped to **real spheres + full virtual texturing**, chosen
over two cheaper alternatives (high-res close-up billboards; spheres with single-image height
maps only). Spheres are the mandatory first step of that path either way, so the work is
sequenced:

| Sub-phase | Scope                                                                                                           | Status                                                                                                                                                                                  |
| --------- | --------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **C4.1**  | Sphere renderer, real equirect surface textures, real elevation via height-derived normals, real Sun lighting   | ✅ **COMPLETE (TR-076)**                                                                                                                                                                |
| **C4.2**  | MOLA/NASA virtual-texture streaming with camera-distance LOD; body-selection rules (below); Venus cloud descent | ✅ **COMPLETE (TR-078)** — runtime streamer wired (the visible tile set is a contiguous rectangle, so no indirection table was needed), Venus descent live with Astra's flat-light fork |
| **C4.3**  | Rotation, self-shadowing, tier/budget gating from real-device data                                              | not started                                                                                                                                                                             |

**C4.1 owner-confirmed 2026-07-21:** Mars, Mercury and the Moon all read correctly on the live
page. The visual questions TR-076 left open — terminator, true-scale topography shading, and the
sphere sizing — are accepted as shipped. Astra's exaggeration correction (12 → 1.0) is vindicated
in practice as well as in physics: the worry that true-scale relief would look flat did not
materialise.

**Two C4.2 body-selection decisions, taken by the owner 2026-07-21:**

1. **Phobos and Deimos are never sphered.** Astra's advice accepted as a standing RULE rather than
   a deferral: they are the most irregular bodies in the pack, and a sphere there would be broken
   physics. They stay billboards permanently. Neither is in the pipeline's body list today, so
   nothing ships wrong — but C4.2 should make the exclusion explicit and tested rather than
   incidental, since the pipeline is data-driven and a later texture addition would otherwise
   sphere them silently.
2. **Venus gets a cloud-descent arrival.** `venus-ultra.jpg` is a Magellan _radar_ map, so a plain
   sphered Venus would show surface detail no human eye could see through the cloud deck. Rather
   than dropping Venus or quietly pretending, the owner's call is to make the contradiction the
   feature: an arrival that descends through the real cloud layer and emerges over the
   radar-mapped surface beneath. That is honest about the data's provenance — radar through cloud
   is exactly how humanity has actually seen Venus's surface — and turns the phase's most awkward
   asset into its most memorable arrival. **Needs its own Astra brief first** (real cloud-deck
   altitude and thickness, the real ~4-day super-rotation, what a descent would genuinely look
   like) before any design work.

**C4.1 as shipped:** ONE destination-gated sphere (not one per body — see `planet-sphere.ts`),
revealed on arrival, textured from the real 8192×4096 equirect maps downsampled to a 4096×2048
shipped tier by `scripts/build-planet-textures.mjs`. 12 bodies, 16.6 MB, **3 with real elevation**
(Mars, Moon, Mercury — the only bodies in the pack that ship a height map besides Earth).

**Astra's brief** ([planetary spheres](../analysis/2026-07-21-planetary-sphere-topography-science-brief.md))
changed three things and caught one **broken-physics** error: plain Lambertian shading is wrong
for airless regolith (the real full Moon is a flat, evenly-lit disc; the half Moon is ~9% as
bright as full, not 50%) — now Lunar-Lambert. It also cut the elevation exaggeration from a
drafted 12× to **1.0**, since relief is invisible on the silhouette anyway but exaggeration
corrupts shading across the whole disc, and replaced two Bond albedos with the geometric ones a
renderer actually wants.

**What this unlocks that a billboard never could:** real phases and a real terminator. A billboard
is permanently "full" — the single most visually significant fact about a body in space was
simply absent before this phase.

**Exit:** textures pass through the asset pipeline (or a documented equivalent following its
conventions); `budget:check` stays green; before/after visual diff is owner-confirmed.

### C4 DEVIATION CLOSEOUT (2026-07-21, [TR-079](../test-reports/TR-079.md))

Three deviations between what C4 promised and what C4 shipped were raised by the owner and are now
closed. All three were real; two of them concealed genuine missing work.

**1. "76 textures" -> 12 bodies was never justified. It is now a RECKONING, and it was also WRONG.**

The skips (Callisto/Uranus/Neptune absent from the pack, Phobos/Deimos ruled out by the
NEVER_SPHERE rule) were individually defensible but unrecorded, so the shortfall read as an
omission. Writing the reckoning down is what revealed that two of its premises were false:

| Claim on record                                                              | What the pack actually holds                                                                                                                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "Earth has height-but-no-surface"                                            | **False.** `earth-day-ultra` is a real 6x**8192²** cubemap, plus night lights, a cloud deck and an ocean specular mask. The pipeline only ever globbed `tex/base/`; Earth's surface lives in `tex/cubemap/`.          |
| "3 with real elevation — the only bodies in the pack that ship a height map" | **Incomplete.** Ten bodies ship pre-baked **normal** maps — real relief in exactly the form the shader consumes. Reading "ships a height map" as the test for "has real elevation" left nine bodies rendering smooth. |
| 12 bodies is the whole pack                                                  | **False.** dione (4096), rhea (**8192**) and tethys (4096) have real surface _and_ normal maps and were simply not in the list.                                                                                       |

**Shipped this session:** 3 new bodies (dione, rhea, tethys), 9 pre-baked normal maps consumed via
a new `normalTex` path in both shader twins, and Earth re-projected from its cubemap into this
pipeline's equirect convention. **16 bodies, 86 files.** The reckoning itself now lives in the
pipeline as `PACK_RECKONING` and is **asserted** — `--verify` fails if any pack file is neither
consumed nor carries a recorded reason, so a future pack update cannot silently reintroduce this
class of gap. Two items are recorded as deliberate deferrals rather than allowed to vanish: the
real Planck CMB all-sky plates and the photographic Milky Way skybox, both genuine data, both out
of C4's scope.

The cubemap re-projection's orientation is **measured, not assumed**: a cubemap has 24 plausible
per-face orientations and every wrong one still looks like Earth at a glance.
`scripts/validate-cubemap-orientation.mjs` correlates the re-projected day map against
`earth-specular-high.jpg` — an equirect ocean mask from the same pack, in the same convention — and
the shipped orientation wins at **r = -0.5995** against -0.2781 for the nearest wrong variant.

**2. C4 built a parallel pipeline instead of registering one. Now registered, and hooked.**

`build-planet-textures.mjs` and `build-planet-vt.mjs` followed the `assets:craft` conventions but
were never in `package.json`, so regenerating C4's assets required reading a TR to find the
command — a real regeneration hazard.

The fix had to account for a constraint that reframes the problem: **`resources/` is gitignored, so
CI can never regenerate any asset.** The committed bytes under `public/assets` _are_ the
deliverable. "Auto-run in CI" is therefore impossible by construction; what CI can and now does
assert is that the committed bytes still match what the pipelines declare they produce.

Both scripts gained the three-mode shape `build-craft-assets.mjs --verify` established:

| Mode         | Behaviour                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| (no flag)    | full rebuild; requires the source pack                                                                                              |
| `--if-stale` | rebuilds only what is missing or older than its source; **no-ops with a clear message** when the pack is absent — the CI-safe path  |
| `--verify`   | **source-free**: every declared body/tier/map present and non-empty, manifests consistent, no orphans, no NEVER_SPHERE body sphered |

Wired as `assets:planets`, `assets:planets:vt`, `assets:sync`, `assets:verify`; `predev` and
`prepreview` run `assets:sync`, `prebuild` runs `assets:verify`, and CI's lint job runs
`assets:verify` + `budget:check:assets` as steps in the existing job (TR-034's status-check rule).
Both branches are proven by execution, not by reading: the source-absent path exits 0 after
verifying, and removing one asset fails the gate with an attributable message.

**⚠️ The pipeline deletes nothing, by owner direction (2026-07-21).** An orphan-pruner added during
this work destroyed 19 real shipped assets before a real-browser E2E caught it (TR-079 Part 6). It
was first narrowed to files it could prove it generated, then **removed entirely** (TR-079 Part 8c)
because the approved design said _"no orphans — fails loud on drift"_, and **"fails loud" is a
report, not an `rm`**. `--verify` still fails on a true orphan; a human does the deleting. A unit
test asserts the absence of any delete call in the script, which is a stronger claim than
asserting deletion is careful.

**3. `budget:check` never looked at `public/assets`. Now it does — see [ADR-0009](../adr/0009-asset-weight-budget.md).**

Raw bytes, gated at three granularities (total / largest single file / per directory), with every
ceiling moved out of the measurement script into `budgets.config.mjs` as data. Asset ceilings
ratchet at the **high-water mark with no headroom**, deliberately unlike the bundle budgets'
~15% slack, because no defensible slack figure exists before the ADR-0008 real-device pass.

The gate caught its own first growth immediately — this session's additions took `public/assets`
from 208.92 MB to **255.26 MB** and CI refused it until the ceiling was raised deliberately, with
the cause recorded. It also surfaced **6.58 MB of `-base` (2048) tier maps that are shipped but
never fetched** (the engine reads only `.high` and `.ultra`); kept rather than trimmed because
C4.3's tier gating is what will consume them, but now a known quantity rather than a discovery.

**⚠️ OPEN OWNER DECISION — asset weight, now quantified.** `public/assets` is 256.01 MB, of which
`planets` is 168.98: base 6.6 / high 28.6 / ultra 69.1 / VT tiles 62.9 / catalog dossier images 1.8.
The two large levers (`ultra` and the VT pyramid) both want the ADR-0008 real-device pass before
anyone trims them.

**4. Earth landed as a full feature, and Astra's brief corrected the phase this whole plan
describes.** The brief's headline is about the CAMERA, not the planet: the arrival phase angle is
**exactly 0.000° for every body, every time** — `travelTo` parks on the Sun–body line and free-look
changes orientation only, so V = L identically. The terminator is never in frame and the night
hemisphere is 100% occluded. That **additively corrects the C4.1 brief's** claim that C4's honest
headline was "real phases and a real terminator": true of a sphere's physics, false of this scene's
arrival geometry. It is also why Earth's real NASA city-lights map is **deliberately not shipped**
(broken physics #1 — the map is real, the view would be invented), and why the ocean glint is
mandatory rather than decorative (the mirror condition sits exactly at frame centre — the
DSCOVR/EPIC geometry). Earth ships with clear-sky albedo 0.213, pure-Lambert reflectance, a
Cox-Munk glint, a real Rayleigh term (omitting it is broken physics — 74–87% of ocean colour from
space is scattered air), and a cloud deck locked to the surface rotation.

**5. Four sphered bodies could not be reached; three now can, and Earth must not be
(2026-07-22, [TR-079](../test-reports/TR-079.md) Part 8d).** Live validation found that `earth`,
`tethys`, `dione` and `rhea` had sphere textures but **no catalog entry** — 28.35 MB of imagery that
could never render. `sphereIdFor` is driven by the texture manifest; the **catalog** decides where a
visitor can go, and nothing connected the two. Now gated by test.

Tethys, Dione and Rhea are real destinations
(`src/data/celestial/celestial-saturn-moons.js`, verified live, console-clean). Their positions are
a **declared licence with a measured size**: real elongation from Saturn is 47.6″/61.0″/85.1″ — the
whole inner system fits in 0.11°, and Tethys's true separation is 0.040 world units against a
radius-26 sphere. The shipped 0.758°/0.820°/0.882° preserve the real _ordering_ and are bracketed by
the existing Enceladus and Titan. TR-065's real-Kepler argument does **not** transfer: a
heliocentric minor planet's true position is computable _and visually meaningful_; a close
satellite's is computable _and visually meaningless_.

**Earth is BROKEN PHYSICS as a catalog entry** and stays out. The frame is **geocentric** (verified
from the data: the Sun is itself a body at ra 250/dec −20.5), so Earth's direction is 0/0 and its
distance is 0 — non-existent, not merely awkward. Every RA/Dec here is measured _from_ Earth;
entering it makes the ruler one of the measured things. **The alternative is better:** revealed by
`goHome` at the origin, the α = 0 arrival lock does not apply, and parking at ra 160/dec 0 gives a
verified **90.0000° phase angle** — terminator dead centre, city lights, twilight band and cloud
shadows, for Earth alone, with no change to `travelTo`. Not implemented; it is a new feature, and it
would resurrect the night-light assets deleted above.

**⚠️ OPEN OWNER DECISION — planetary exposure, newly quantified by Astra.** The shipped
`surface × albedo × (refl × dayside × 3.6 + 0.06)` clips on **six of sixteen bodies** (Dione 2.17,
Europa 2.04, Tethys 1.80, Rhea 1.30, Venus 1.25, Io 1.21): 3.6 was tuned against Mars and the Moon,
and C4.1's intended bake-normalisation was never implemented. The fix moves the opposition surge out
of `uAlbedo` into `refl` and then needs a choice between bake-normalisation (exact real brightness
ratios, but the Moon renders 2.6× darker) and a Reinhard response curve (never clips, compresses the
real 9.0:1 Tethys:Moon ratio to 2.9:1). Both are honest; they are not equivalent. Not taken here.

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

- **C0:** informal exit — pipeline round-trips ≥1 dataset per track. **✅ MET (TR-061 Track A,
  TR-063 Track B, both 2026-07-20).**
- **C2 (SDSS DR18):** ⛔ formal GO/NO-GO gate — real-device measurement required before shipping
  to any tier beyond what the measured data supports.
- **C3 (asteroid belt):** informal exit, but frame-budget-gated — must hold PF-09's existing
  tier fps floors with the real belt active on all device classes. **Code-complete 2026-07-20
  (TR-074); the frame-budget half is NOT yet measured** — it inherits C2's instrument problem
  exactly (CI's SwiftShader renders this scene ~17× slower than real GPU hardware), so it needs
  the same real-device pass, on the same devices, ideally in one session with C2's.

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
