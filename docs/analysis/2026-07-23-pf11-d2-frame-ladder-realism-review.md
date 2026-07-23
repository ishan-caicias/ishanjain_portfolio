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
