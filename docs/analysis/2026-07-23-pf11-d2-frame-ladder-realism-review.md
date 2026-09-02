# PF-11 D2 — REALISM-AUDIT: the frame ladder (furniture gating + extragalactic collapse)

**Author:** Astra (space research scientist), paired with Procyon
**Date:** 2026-07-23
**Mode:** REALISM-AUDIT (audits the D2.1/D2.2 implementation, [TR-090](../test-reports/TR-090.md))
**Audited against:** the science this feature was designed from —
[PF-11 sky-frames & travel science brief](2026-07-22-pf11-sky-frames-and-travel-science-brief.md)
(§1 the frame ladder, §2 belt visibility). Those numbers were Astra's own prior work, authored
_for_ this slice; this audit confirms the implementation used them and grades every departure.

**Verdict taxonomy:** ACCURATE · SIMPLIFIED (declared) · DECLARED LICENSE · BROKEN PHYSICS.

---

## What shipped, checked term by term

| Claim in the code                                                                                                           | Brief number                                                                                                 | Verdict                                                                                                                                                                           |
| --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Furniture (belt + Havok + glare) fully present ≤ `FURNITURE_FADE_START_LY = 0.001` ly, gone by `FURNITURE_GONE_LY = 0.1` ly | §2 / design table: "ly > 0.001 (≈ 63 AU) → gone by ly ≈ 0.1"                                                 | **ACCURATE** — the thresholds are the brief's, verbatim. Every planet (Neptune ≈ 4.7×10⁻⁴ ly) stays inside the window; the nearest star (4.25 ly) is far past it.                 |
| Belt renders at Mars, is gone at M42 (1,344 ly)                                                                             | §2: the 6.6-AU belt subtends **16 mas** from M42 — a belt pixel there is wrong by ~7 orders of magnitude     | **Fixes BROKEN PHYSICS.** The audited baseline drew the belt as a faint ring at every destination; the frame ladder removes it beyond the solar system, which is the whole point. |
| Local galaxy (band + 168,959-star field + constellation figures) collapses at `EXTRAGALACTIC_LY = 1e6` ly                   | §1: "Everything local vanishes… the entire Milky Way collapses into ONE small external galaxy" at ≥ 32.6 Mly | **ACCURATE**, with a declared-threshold note (below).                                                                                                                             |
| Band + field + figures PERSIST for all in-galaxy travel (Moon → M42)                                                        | §1: band shifts only 2.1°/1,000 ly; "effectively a fixed backdrop for ALL current catalog travel"            | **ACCURATE** — `localFieldVisibility` returns 1 for every destination < 1e6 ly, so nothing local moves for in-galaxy hops. This is the correct physics, not a missing feature.    |
| Havok sleeps when the belt is faded                                                                                         | §2: "stepping belt physics while parked at an SDSS galaxy is pure waste"                                     | **ACCURATE** intent; see the honest-scope note on the sleep mechanism.                                                                                                            |

## The two DECLARED LICENSES this slice introduces

**L12 — the external-galaxy impostor is a procedural disc, not a photograph.**
The brief names the deferred photographic Milky-Way skybox pack as the impostor's ideal texture,
but that panorama's licence is unverified (docs/research; the licensing tripwire forbids shipping
it until it clears). What ships is a procedural inclined disc built from the band's own tone model
(`milkyWayImpostorPixel`). It reproduces the _appearance_ of a distant spiral — bright bulge,
exponential disc, feathered rim — without a photometric or structural model of M101-class galaxies.
**SIMPLIFIED (declared).** Honest and licence-clean; upgradeable to the photograph if its licence
verifies.

**L13 — the impostor's on-screen size is floored above its true angular subtense.**
The code computes the honest angle `θ = 2·atan(15 kpc / d)` from the destination's real distance
(§5: ~10.3′ from 32.6 Mly), then floors the rendered half-size so the disc is at least a few
degrees on screen. At nbg-a0554-07's 17.9 Mly the true θ is ~18.8′ — a sub-pixel-to-few-pixel
smudge — and the floor makes it a legible object instead. This is the SAME class of declared
overbrightness the belt already carries (§2's ~10⁶× exposure license): the geometry that _drives_
the size (real distance) is honest; the minimum is a legibility license. **DECLARED LICENSE.**

## Notes on threshold form (honest, not defects)

- **`localFieldVisibility` is a hard 1/0 step at 1e6 ly, not a smooth ramp.** The brief supports
  this explicitly: nothing travelable sits between the star field's ~2,400 ly reach and the nearest
  galaxy at 32.6 Mly, so no observer ever stands at a distance where a _partial_ collapse would be
  seen. A smooth ramp would be modelling a regime with no destinations in it. The **cinematic**
  transition is still smooth — `frameLadderFade` ramps the fade over warp progress k — so the
  visitor sees the band shrink over the journey; only the destination-visibility function is binary.
- **The furniture fade is a smooth 1→0 over [0.001, 0.1] ly.** Correct: unlike the extragalactic
  gap, this window has real destinations near its edges (outer solar system vs the nearest stars),
  so a graceful fade is both honest and prettier.

## Honest scope — what this slice deliberately did NOT do

1. **Sun glare / planet billboards are not individually faded.** The brief lists "sun glare/planet
   billboards" alongside the belt in the furniture set. They render from a single shared-material
   billboard mesh with no per-body fade channel; adding one is a per-vertex change to two more
   shader twins that sits outside D2.1's core. The dominant artefact — a 154,662-speck ring visible
   at every DSO — IS the belt, and it is now gated. The residual (the Sun as a sub-pixel dot among
   the field stars at a DSO) is minor and recorded for a later pass, not silently dropped.
2. **The Havok sleep skips force application and the collision-shake callback; it does not yet halt
   Havok integration** (`setMotionType(STATIC)` / a zero timestep). That is D7.5's measured
   refinement — the belt's 20–48 dynamic bodies coasting invisibly is a trivial solver load, and
   the visible correctness (no belt, no phantom shake) is fully delivered. `beltPhysicsAwake` is the
   honest signal either way.

## What this audit does NOT cover

Real-hardware look of the impostor (its WGSL twin only draws after an extragalactic hop — validated
by the addition to the WebGPU-hardware spec, which needs a real GPU + Chrome to run); the exact
art-direction of the disc; and the D2.3 constellation-dissolve-at-50–500 ly beat, which is a
separate slice (this slice fades the figures only as part of the extragalactic collapse).

**Confidence:** all thresholds and angular-size numbers are the brief's textbook-tier values,
re-checked here; nothing required a fresh search.

---

## Addendum (2026-07-23, same day — post-review re-anchor)

The engineering review (TR-090 addendum) found the impostor's first placement — world-fixed at
1,800 from the origin — could sit beyond the camera-centred band shell and depth-fail (state
visible, zero pixels). The fix re-anchors it **camera-relative at a constant 1,500 units**, which
Astra grades as a physics _improvement_, not a compromise: an object tens of Mly away shows zero
parallax across any in-scene camera motion, so a camera-locked backdrop is exactly the modelling
the band's own `infiniteDistance` already uses. L13's angular-size derivation is unchanged (the
subtense is computed from the destination's real distance; only the render anchor moved), and the
E2E now proves the disc with **pixels**, closing the gap this audit's "does not cover" section
flagged for the GLSL path.

---

## REALISM-AUDIT — D2.3 constellation dissolve (2026-07-23, Astra)

**Scope:** the constellation-figure dissolve this audit's own "does not cover" section flagged as
outstanding — `figureVisibility` / `FIGURE_FADE_START_LY` / `FIGURE_GONE_LY` (ship-dynamics.ts),
wired into `_conMat`'s alpha in `_pushAberration` (babylon-engine.ts), and the completed 4-entry
ledger (formalised in the [science brief's dated addendum](2026-07-22-pf11-sky-frames-and-travel-science-brief.md#addendum--the-full-4-entry-ledger-completed-by-d23-2026-07-23-astra)).
Audited against Astra brief §1 ("[the figures] are parallax accidents of nearby stars").

| #   | Element                                                                 | Verdict                           | The physics                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Recommendation                                                                                                                                                                                                                                                     |
| --- | ----------------------------------------------------------------------- | --------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Figures fade on their OWN schedule, separate from `_localFieldFade`     | **ACCURATE** (mechanism)          | Correct to split: the figures go wrong (parallax) at destination distances two to three orders of magnitude nearer than where the band/star field go wrong (extragalactic, ≥1e6 ly). A single shared fade would have kept the figures honest-looking for hops the band handles correctly but the figures already don't.                                                                                                                                               | Keep the split; it is the more physically faithful of the two designs available (shared vs. separate schedule).                                                                                                                                                    |
| 2   | The `ly 50→500` window itself, applied identically to every figure      | **DECLARED LICENSE** (L17)        | Real constellation-figure stars span ~4 ly (not rendered as figures) to ~2,600 ly (Deneb); the "correct" dissolve distance is per-figure, set by that figure's nearest/farthest member star, not a scene-wide constant. At `x`=50 ly a near figure (Ursa Major, ~80-125 ly members) is already parallax-distorted by tens of degrees; at `x`=500 ly a far figure (Orion, ~900-2,000 ly members) is only mildly disturbed. See the ledger addendum for the derivation. | Accept as shipped — a single alpha term is the right cost/fidelity trade for a background decoration, not the ship's primary instrument. Flag for a per-figure depth-aware version only if figures ever become a primary navigation or scientific display element. |
| 3   | Mars → figures full (1); Polaris (433 ly) → partial; M42 (1,344 ly) → 0 | **ACCURATE** (given #2's license) | Consistent with the declared window: Mars sits far below `FIGURE_FADE_START_LY`; Polaris (433 ly) sits inside [50, 500]; M42 (1,344 ly) is well past `FIGURE_GONE_LY`. The E2E (`frame-ladder.spec.ts`) drives exactly these three checkpoints plus nbg (already 0 via the extragalactic collapse) and confirms restoration at home.                                                                                                                                  | None — matches design.                                                                                                                                                                                                                                             |
| 4   | Reduced motion: no animated dissolve, state swaps at arrival            | **ACCURATE**                      | `frameLadderFade`'s reduced-motion branch (shared with D2.1/D2.2) holds `from` until `k>=1`, then jumps to `to` — no partial-fade frame is ever rendered under reduced motion, matching non-negotiable #24.                                                                                                                                                                                                                                                           | None.                                                                                                                                                                                                                                                              |

## License ledger additions (this slice)

Completes the 4-entry ledger the science brief proposed at PF-11's start, plus the standing
Reinhard cross-reference the implementation plan asked for — full table and derivations in the
[science brief's dated addendum](2026-07-22-pf11-sky-frames-and-travel-science-brief.md#addendum--the-full-4-entry-ledger-completed-by-d23-2026-07-23-astra):
**L14** belt overbrightness (~10⁶×, formalised — was already implemented by D2.1), **L15**
seconds-scale warp durations (~1.2×10⁵×–1.2×10⁸×, distance-dependent), **L16** band + star field
persistence during in-galaxy travel (≤~2°/kly — narrowed to exclude the figures, which now have
L17), **L17** the ly 50→500 dissolve window itself (a declared threshold, not a per-figure
derivation — new this slice), plus cross-references to **L9** (intro timing, already ledgered at
D1.3) and **L1** (Reinhard compression, already ledgered at D6.1).

## Numbers appendix

**Parallax order-of-magnitude check (L17):** small-angle transverse parallax `Δθ ≈ x/d` (radians)
for a camera lateral/depth displacement `x` against a star at distance `d`. Ursa Major member
stars (Merak 79.7 ly, Dubhe 123 ly) at `x = FIGURE_FADE_START_LY = 50` ly: `Δθ ≈ 50/80 ≈ 0.63 rad
≈ 36°` — already far past "recognisable." Orion Belt stars (Alnitak ~1,260 ly, Alnilam ~2,000 ly)
at `x = FIGURE_GONE_LY = 500` ly: `Δθ ≈ 500/1,260 ≈ 0.40 rad ≈ 23°` — a real distortion, but the
figure has been fading out across the whole [50, 500] window by then (`frameLadderFade`'s
smoothstep front-loads/back-loads the actual visual transition around this destination-keyed
envelope), so 500 ly is a reasonable "call it gone" line rather than the point of first error.
These numbers do not change the verdict (DECLARED LICENSE was always the right call for a
scene-wide constant standing in for 88 different true per-figure distances) — they document why,
with real values, for anyone revisiting this later.

## What this audit does NOT cover

Real-hardware appearance of the dissolve (SwiftShader-only in the automated run); whether 50/500
ly are the _best_ choice of constant versus some other pair in the same order of magnitude (both
would be equally DECLARED LICENSE); a per-figure depth-aware refinement (not attempted, not
recommended at this slice's scope — see recommendation #2 above).

**Confidence:** the real distances cited for individual constellation stars (Merak, Dubhe,
Capella, Polaris, Betelgeuse, Rigel, Antares, Alnitak, Alnilam, Deneb, Spica) are literature-tier
parallax-derived values, consistent with the catalog's own Polaris entry (433 ly) used as the
Numbers-appendix and E2E check star. The parallax order-of-magnitude formula is textbook geometry,
asserted without a fresh search.
