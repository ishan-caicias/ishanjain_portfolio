# PF-11 Science Brief — sky frames by destination, belt visibility, and travel cinematics

**Author:** Astra (space research scientist), paired with Procyon
**Date:** 2026-07-22
**Mode:** SCIENCE-BRIEF (feeds the PF-11 delivery plan; per-slice REALISM-AUDITs follow implementation)
**Prompted by:** owner-reported issues — "the Milky Way should appear distant from the Moon/planets?",
"the Milky Way streak and asteroid belt are always there regardless of destination — is this
correct?", "the physics of travelling into and out of the solar system needs revisiting", "the
ship does not slow down when decelerating and abruptly flips", and the intro launch-from-Earth
cinematic.
**Standing context:** the scene's world frame is geocentric (Earth at origin — established with
evidence in the 2026-07-21 Earth brief, Addendum 2); curated bodies place by geocentric RA/Dec +
`bodyDepth(ly)` log compression (ADR-0007); the star field holds real positions to ~2,400 ly
linear; SDSS spans 32.6 Mly–28.86 Bly on its own log-depth mesh.

---

## 1. The frame ladder — what the sky actually looks like, by distance from home

The single organising fact for every question the owner raised: **the visible sky is a set of
nested backdrops, and each backdrop only changes when you move a distance comparable to its
depth.** Real numbers, geocentric start:

| Scale you travel to                  | Example destinations                 | What changes in the sky                                                                                                                                                                                                     | What does NOT change                                                                                                                                  |
| ------------------------------------ | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Solar system (≤ 40 AU ≈ 6×10⁻⁴ ly)   | Moon, Mars, Venus, Saturn moons, Sun | Sun's disc size and direction; planet positions; zodiacal geometry                                                                                                                                                          | **Everything else.** Stars, constellations, the Milky Way band are pixel-identical — the nearest star system is 4.25 ly ≈ 7,000× further than Neptune |
| Nearby stars (4–100 ly)              | Sirius, Vega, CNS5 neighbours        | The Sun fades from a star to invisibility (m > 6 beyond ~56 ly); the nearest-star patterns begin to shear                                                                                                                   | The band; distant-star constellation outlines mostly hold                                                                                             |
| Catalog depth (100–2,400 ly)         | M42, clusters, GD-1 stars            | **Constellations dissolve** — figures are parallax accidents of stars at 50–2,000 ly; at M42 none of Earth's figures survive. The band shifts by only ~2° per 1,000 ly travelled                                            | The band's overall shape and brightness (galactic centre is 26,700 ly away — you've moved < 8% of that)                                               |
| Galactic (2,400–50,000 ly)           | (not yet travelable)                 | The band warps, brightens toward the centre, becomes visibly 3-D                                                                                                                                                            | Extragalactic sky (NEARGALCAT, SDSS)                                                                                                                  |
| Extragalactic (≥ 32.6 Mly, all SDSS) | NEARGALCAT galaxies, SDSS field      | **Everything local vanishes.** The entire Milky Way — band, 168,959 stars, belt, Sun — collapses into ONE small external galaxy: from 32.6 Mly a 100,000-ly disc subtends ~10 arcmin, the apparent size M101 has in our sky | The deep SDSS field itself (you'd need ~100 Mly of travel to visibly rearrange it)                                                                    |

**Key derived numbers** (appendix for working):

- Sun's apparent magnitude vs distance: m = 4.83 + 5·log₁₀(d_pc/10). At 1 ly: **−2.7** (Jupiter-bright,
  just another bright star). At 55.8 ly: **+6.0** (naked-eye limit). At M42 (1,344 ly): **+12.9**
  (needs a telescope). "Leaving the solar system" is visually over within the first ~50 ly.
- Band shift for travel perpendicular to the galactic-centre direction: atan(d / 8,277 pc) —
  **2.1° per 1,000 ly.** The band is effectively a fixed backdrop for ALL current catalog travel.
- Milky Way from the nearest SDSS distance (32.6 Mly = 10 Mpc): 30 kpc disc → **θ ≈ 10.3 arcmin.**
  From the median SDSS depth it is arcseconds — a faint smudge among thousands.

### Verdicts on the owner's questions 3 & 4

| Claim                                                       | Verdict                                                                       | The physics                                                                                                                                                                                                                                          |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "From the Moon/planets the Milky Way should appear distant" | **ACCURATE AS SHIPPED** (if band is a fixed backdrop)                         | The band IS unreachably distant everywhere in the solar system; it must look byte-identical from the Moon, Mars, or Pluto. If the engine renders it as a camera-locked/world-fixed far backdrop, that is the correct physics, not a defect           |
| "The Milky Way streak is always there, at any DSO"          | **ACCURATE within the galaxy · BROKEN PHYSICS at extragalactic destinations** | For every star/nebula/cluster destination (≤ 2,400 ly) the band legitimately persists. For NEARGALCAT/SDSS arrivals the band + local star field must fade/collapse — an observer 32.6 Mly out sees the Milky Way as one ~10′ object, not a 360° band |
| "The asteroid belt is always there, at any DSO"             | **BROKEN PHYSICS beyond the solar system** (and undeclared license inside it) | See §2 — the belt must be gone by ~10 AU-equivalent departure, let alone 1,344 ly                                                                                                                                                                    |

**Design recommendation (the "frame ladder" mechanic):** gate each backdrop layer on the
destination's `ly`, with fades tied to the warp's progress `k` so the transition is part of the
cinematic. Thresholds (in catalog `ly`, matching the scene's own parameterisation):

| Layer                                       | Fade start → gone                                                                                                                                        | Rationale                                                 |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Belt billboards + Havok + sun glare/planets | ly > 0.001 (≈ 63 AU) → fully gone by ly ≈ 0.1                                                                                                            | Belt/planets are invisible past tens of AU                |
| Constellation figures                       | ly > 50 → gone by ly ≈ 500                                                                                                                               | Figures shear apart; honest and a great storytelling beat |
| 168,959-star field parallax/fade            | keep (real 3-D positions already parallax) — collapse only for extragalactic arrivals                                                                    | The field IS the local neighbourhood                      |
| Milky Way band                              | keep for all galactic destinations; at NEARGALCAT/SDSS arrivals cross-fade to an external-galaxy impostor (a single lit disc sprite ~10′–1° by distance) | The one honest way to show "you left home"                |
| SDSS deep field                             | always present (it is isotropic and effectively infinitely deep)                                                                                         | Correct                                                   |

The extragalactic cross-fade is the emotional payoff of the whole dataset investment: the moment
the band you've flown under all session shrinks into _an object_ is the scene teaching real
cosmology. A photographic Milky Way external view is already recorded as a C4 deferral
(the skybox pack in `PACK_RECKONING`) and would serve as the impostor's texture.

---

## 2. Asteroid-belt visibility — the numbers

Real main belt: ~1–2 × 10⁶ objects > 1 km, torus from 2.1–3.3 AU, ~0.5 AU thick. Volume
≈ 3.4 × 10³⁴ m³ → mean spacing between km-class objects ≈ **3.2 million km (0.02 AU).** Standing
"in" the belt, the nearest catalogued rock is typically further than Earth–Moon ×8; you would see
**zero asteroids with the naked eye** — Ceres itself only reaches m ≈ 6.6 from Earth.

- The rendered ring-of-154,662-billboards is therefore a **DECLARED LICENSE** (record it in the
  ledger if not already): real positions, real Kepler motion, ~10⁶× overbright so the structure
  (Kirkwood gaps, Hildas, Trojans) is visible at all. That is the good kind of license — the
  structure is real; only the exposure is turned up.
- Angular size of the entire belt from M42: 6.6 AU across seen from 1,344 ly → **16 milli-arcsec.**
  Rendering any belt pixel at a DSO arrival is wrong by ~7 orders of magnitude.
- **Havok note:** stepping belt physics while parked at an SDSS galaxy is pure waste — physics
  should sleep whenever the visual layer is faded (also a real perf win, see the plan's
  optimisation slice).

---

## 3. Travel physics — in/out of the solar system, and the flip

### 3.1 What honest travel would cost (so the license is declared, not accidental)

Brachistochrone (constant proper acceleration a, flip at midpoint): t = 2√(d/a) Newtonian;
relativistically τ_ship = 2(c/a)·acosh(1 + ad/2c²).

| Journey                                  | At 1 g                        | At 3 g      |
| ---------------------------------------- | ----------------------------- | ----------- |
| Earth → Mars (0.52 AU conjunction-class) | 2.0 days                      | 1.2 days    |
| Earth → Saturn (8.5 AU)                  | 8.2 days                      | 4.7 days    |
| Earth → Proxima (4.25 ly)                | 3.6 yr ship / 5.9 yr Earth    | 2.1 yr ship |
| Earth → M42 (1,344 ly)                   | 14.0 yr ship / 1,346 yr Earth | 7.6 yr ship |
| Earth → SDSS nearest (32.6 Mly)          | 33.9 yr ship / 32.6 Myr Earth | —           |

The scene's seconds-scale journeys are (and should remain) a **DECLARED LICENSE** — the point is
the _shape_ of the journey being right: accelerate → flip → decelerate, which the engine already
sequences (GAP-17). What reads as fake today is not the duration, it's the _kinesthetics_:

### 3.2 The flip — why it feels abrupt and what graceful means

A real flip-and-burn: main drive cuts off, attitude thrusters rotate the ship 180° about a
transverse axis over tens of seconds (the Expanse's depiction — half a minute of drift-and-rotate
— is the culturally-calibrated reference), then the drive relights pointing at the destination.
Choreography spec, in journey-progress terms (k ∈ [0,1]):

1. **Burn cutoff at k ≈ 0.46:** plume collapses over ~0.3 s of screen time; star streaks begin
   relaxing (streak length ∝ apparent velocity is the licensed cue).
2. **Coast-and-flip k ≈ 0.46–0.54 (≈ 8–12% of the journey, never < 1.5 s screen time):** hull
   rotates 180° about its pitch/transverse axis on a C²-continuous ease (smoothstep-of-smoothstep
   or a slerp driven by an easeInOutCubic parameter — zero angular velocity at both ends). RCS
   puffs at start/end of rotation sell it. The camera does NOT mirror the hull's rotation —
   the chase eases a few degrees and lets the ship turn within frame (this is exactly the shot
   the reference depictions use).
3. **Decel relight k ≈ 0.54:** plume re-ignites now pointing PROGRADE (toward the destination —
   thrust vector visibly opposing motion), throttling up over ~0.3 s.
4. **Braking readout k 0.54–1.0:** apparent-velocity HUD falls monotonically; destination angular
   size grows with visibly decreasing closure rate (ease-out); streaks shorten to zero by k ≈ 0.9.

**Why "it doesn't slow down" today (engineering-side hypothesis for the audit to confirm):** a
symmetric position-easing curve produces deceleration in _position_ terms, but if the visible
speed cues (streaks, HUD velocity, plume direction, destination growth rate) don't follow the
derivative of that curve, the brain reads constant speed then a snap turn. Perceived braking is
carried ~80% by two cues: closure-rate ease-out on the destination's angular size, and the
plume/attitude reversal. Both must be driven from d(warpEase)/dk, not from k.

### 3.3 Leaving/entering the solar system

Cues, in order, for an outbound leg (reverse for arrival into another system):

1. Planets/Moon collapse to points within the first ~1% of any interstellar journey.
2. Sun shrinks from disc to brightest-star to gone: disc → point at ~0.003 ly; m = −2.7 at 1 ly;
   gone (m > 6) by ~56 ly. A log-distance HUD (AU → ly → kly → Mly) makes the ladder legible.
3. Belt/zodiacal furniture fades by ~10 AU-equivalent (§2).
4. Constellation figures dissolve past ~50–500 ly (§1).
5. At extragalactic legs only: band collapse (§1). The SDSS log-depth compression (ADR-0007)
   means the camera never physically crosses these distances — the fades key off destination ly
   and warp k, which is both honest to implement and cheap.

---

## 4. Launch-from-Earth intro cinematic

The scene is geocentric — the camera already _starts_ at Earth. The Earth brief's Addendum 2
specifies the goHome Earth reveal (90° phase angle at ra 160/dec 0: terminator centred, city
lights, twilight band). The intro launch is the same feature viewed in reverse order — build them
as one slice pair.

Real ascent physics worth honouring (compressed to a licensed ~6–10 s):

| Beat               | Real values                                                         | Licensed rendering                                                                                        |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Pad / surface view | sky luminance from Rayleigh scattering; Sun + blue sky              | Earth sphere fills lower frame, atmosphere limb above                                                     |
| Climb 0–50 km      | pressure e-folds every 8.5 km; sky blue → violet-black by ~40–50 km | sky colour keyed to exp(−h/8.5 km); first stars appear as sky luminance < stellar                         |
| 80–120 km          | Kármán line 100 km; full star field; limb becomes a thin blue ring  | star field + band fade in; limb ring (the one place a blue limb IS in frame, unlike the arrival geometry) |
| Orbit / departure  | LEO 7.8 km/s, escape 11.2 km/s                                      | ship noses up, main burn, hand off to the standard warp choreography                                      |

**Verdict framing:** the whole intro is a DECLARED LICENSE on timing with ACCURATE colour/altitude
physics — the barometric sky-colour curve and the star-reveal threshold are cheap and correct,
and turn a loading screen into a physics demonstration.

The loading dossier itself is engineering, not physics — but its honesty rule is the same one
this repo already enforces for instruments: **the progress readout must derive from real loading
signals (bytes fetched, records decoded, meshes ready), never a timed animation** (CLAUDE.md
measurement discipline, applied to UX).

---

## 5. Numbers appendix (derivations)

- **Sun magnitude:** M_V☉ = 4.83. m(d) = 4.83 + 5·log₁₀(d_pc/10). d(m=6): log₁₀(d/10) = 1.17/5
  → d = 17.1 pc = 55.8 ly. At 412 pc (M42): 4.83 + 5·log₁₀(41.2) = 12.9.
- **Galactic centre:** Sgr A* at RA 17ʰ45ᵐ40ˢ, Dec −29°00′28″, d = 8.277 kpc (GRAVITY Collab.,
  2021). 1,000 ly = 306.6 pc perpendicular → Δθ = atan(306.6/8277) = 2.12°.
- **Milky Way from 10 Mpc:** stellar disc ~30 kpc → θ = 30/10,000 rad = 3.0 mrad = 10.3′.
  (M101 comparison: 28.9′ at 6.4 Mpc for a 52 kpc disc — same class.)
- **Belt spacing:** V ≈ 2π·(2.7 AU)·(1.2 AU)·(0.5 AU) = 10.2 AU³ = 3.44×10³⁴ m³;
  n = 10⁶/V → ℓ = n^(−1/3) = 3.25×10⁹ m ≈ 0.022 AU.
- **Belt from M42:** θ = 6.6 AU / (1,344 ly × 63,241 AU/ly) = 7.8×10⁻⁸ rad ≈ 16 mas.
- **Brachistochrone:** t = 2√(d/a). Mars 0.52 AU = 7.78×10¹⁰ m at 9.81 m/s²:
  t = 2·√(7.93×10⁹) = 1.78×10⁵ s = 2.06 d. Relativistic ship time τ = 2(c/a)·acosh(1 + ad/2c²);
  c/a(1 g) = 0.969 yr; M42: acosh(1 + 1344/1.938) = acosh(694.5) = 7.24 → τ = 14.0 yr.
- **Atmosphere:** scale height H = 8.5 km; sky surface brightness ∝ column ∝ exp(−h/H);
  Kármán 100 km; v_LEO = 7.8 km/s; v_esc = 11.2 km/s.

**Confidence:** all textbook-tier (photometry, orbital mechanics, atmospheric scale height) —
asserted. The 8.277 kpc galactic-centre distance and Verbiscer albedos are literature values
date-stamped above. Nothing here required a frontier search.

---

## License ledger additions proposed for PF-11

1. **Belt overbrightness** (~10⁶×) — structure real, exposure licensed. (Formalises the existing state.)
2. **Seconds-scale warp durations** — shape of journey honest (accel/flip/decel), duration licensed.
3. **Band + constellations persist during in-galaxy travel without per-ly re-projection** — error ≤ ~2°/kly, invisible; licensed for the star-field parallax already being real.
4. **Intro launch timing compression** (~8 min ascent → ~8 s) — colour/altitude curve stays physical.

## What PF-11 must NOT do (BROKEN-PHYSICS tripwires)

- Render the belt, Sun glare, or planetary furniture at any destination beyond ly ≈ 0.1.
- Keep the 360° band at NEARGALCAT/SDSS arrivals once a frame-ladder exists.
- Drive "deceleration" purely through a position ease while streaks/HUD/plume read constant speed.
- Make the loading dossier's progress bar a timer.

---

## Addendum — License ledger entries added by D2.1/D2.2 (2026-07-23, TR-090)

The first two brief-proposed entries above are now IMPLEMENTED and are formalised here; the D2.2
impostor introduces two new ones. (The full 4-entry ledger the brief proposes, plus the Reinhard
compression, is D2.3's scope — this addendum records only what D2.1/D2.2 shipped.)

1. **Belt overbrightness (~10⁶×) — now GATED.** Structure real, exposure licensed — and, from D2.1,
   present ONLY within the solar system (`furnitureVisibility`, gone by 0.1 ly). Rendering it beyond
   that was the BROKEN-PHYSICS tripwire above; the frame ladder closes it.
2. **Band + constellations persist during in-galaxy travel** (error ≤ ~2°/kly, invisible) — licensed,
   implemented as `localFieldVisibility === 1` for every destination < 1e6 ly.
3. **L12 — external-galaxy impostor is a procedural disc, not the (unverified-licence) photograph.**
   SIMPLIFIED: reproduces a distant spiral's appearance from the band's own tone model, no
   photometric/structural galaxy model. Upgradeable if the Risinger-pano licence ever verifies.
4. **L13 — impostor on-screen size floored above its honest ~10′ subtense.** The angle is computed
   from the destination's REAL distance (`θ = 2·atan(15 kpc / d)`); the floor is a legibility license
   of the same class as entry 1's exposure — honest geometry, licensed minimum size.

Full detail and the term-by-term audit: [D2 realism review](2026-07-23-pf11-d2-frame-ladder-realism-review.md).

---

## Addendum — the full 4-entry ledger, completed by D2.3 (2026-07-23, Astra)

D2.3 adds the constellation figures' own dissolve (destination ly 50→500 — a threshold nearer
and independent of `localFieldVisibility`'s extragalactic collapse) and, per the implementation
plan, formalises the brief's original 4-entry proposal plus a cross-reference to the Reinhard
compression (ADR-0010). Two of the five were already given ledger numbers at their own point of
origin — cited here, not re-derived, per the standing "no relitigating settled entries" rule:

| #       | Declared departure                                                             | Magnitude                                                           | Status                                                                                     |
| ------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| **L14** | Belt overbrightness — structure real, exposure licensed                        | ~10⁶×                                                               | NEW here; gated to the solar system by D2.1                                                |
| **L15** | Seconds-scale warp durations — shape of journey (accel/flip/decel) honest      | ~1.2×10⁵× (Mars, 2.0 d → 1.4 s) to ~1.2×10⁸× (M42, 14.0 yr → 3.6 s) | NEW here                                                                                   |
| **L16** | Band + star field persist during in-galaxy travel without per-ly re-projection | error ≤ ~2°/kly, invisible                                          | NEW here (constellation figures now split out — see L17)                                   |
| L9      | Intro launch timing compression (~8 min ascent → ~8 s)                         | ~60×                                                                | Already ledgered — [D1.3 ascent review](2026-07-23-pf11-d1.3-ascent-realism-review.md)     |
| L1      | Reinhard ratio compression (true 9.04:1 → 3.38:1 post-curve)                   | −63% on the ratio                                                   | Already ledgered — [D6.1 exposure review](2026-07-23-pf11-d6.1-exposure-realism-review.md) |

**L15 derivation:** `warpDurationForLy` (ship-dynamics.ts) interpolates linearly in `log10(ly+1)`
between `WARP_MIN_MS` (1.4 s) and `WARP_MAX_MS` (4.2 s), clamped past 10,000 ly. Mars
(~2.37×10⁻⁵ ly) sits at the floor, 1.4 s, against the brachistochrone honesty table's 2.0-day
(172,800 s) 1 g transit — ×1.23×10⁵. M42 (1,344 ly) computes to `1400 + 2800×(log10(1345)/4)` ≈
3.59 s, against the table's 14.0 yr (4.42×10⁸ s) ship-time — ×1.23×10⁸. The compression is
**not a single constant** — it grows with distance because the render duration is only
log-distance-scaled while honest transit time is linear-plus-relativistic — but the _shape_ of
the journey (accel/flip/decel) stays true at every distance, which is the license being declared.

**L16 note (why it now excludes the figures):** the ≤2°/kly figure was computed for the band and
star field's own depths (the star field holds real positions to ~2,400 ly; the band's structure
sits at kpc scales). Before D2.3 the constellation figures rode along under this same license
uncritically. They should not have: a figure's stars sit far closer together in distance than the
band's structure (see L17) — persisting them without a nearer dissolve was the more casual half of
this entry. D2.3 narrows L16 to the band + star field alone and gives the figures their own,
honest threshold.

**L17 (NEW) — the ly 50→500 dissolve window is a declared threshold, not a derived one.**
Constellation-figure stars span a wide range of real depths — Capella 43 ly, Merak 79.7 ly, Dubhe
123 ly, Polaris 433 ly, Spica ~250 ly, Betelgeuse ~548 ly, Rigel ~860 ly, Antares ~550 ly, up to
Alnilam/Deneb in the 2,000-2,600 ly range — so there is no single ly at which "the constellations"
become wrong; each one goes first as the camera's lateral displacement `x` approaches its own
member stars' depth `d` (small-angle parallax, Δθ ≈ x/d). At `x` = 50 ly, a **near** figure built
from ~80-125 ly stars (Ursa Major) is already visibly distorted (Δθ ≈ 50/100 ≈ 0.5 rad ≈ 29°) —
50 ly is generous, not conservative, for that case. A **far** figure built from ~900-2,000 ly
stars (Orion) is barely touched at 500 ly (Δθ ≈ 500/900 ≈ 0.56 rad ≈ 32° at the _edge_ of the
window — still a meaningful shift, so the window errs toward removing rather than lingering). A
single global window necessarily either dissolves some figures a little late or a little early
relative to their true member-star depths — this is the price of one CPU-side alpha term driving
every figure identically rather than per-figure depth-aware fades. **Verdict: DECLARED LICENSE**
(SIMPLIFIED mechanism, not BROKEN PHYSICS — every real constellation genuinely does become
meaningless somewhere in the tens-to-low-thousands-of-ly range this window covers; the window
just isn't tuned per-figure). Recorded for any future per-figure refinement, not a defect to fix
now — see the [REALISM-AUDIT](2026-07-23-pf11-d2-frame-ladder-realism-review.md#realism-audit--d23-constellation-dissolve-2026-07-23-astra).
