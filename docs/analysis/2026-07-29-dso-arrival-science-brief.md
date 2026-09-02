# Science Brief — What a visitor would actually see approaching and arriving at a nebula

**Date:** 2026-07-29
**Mode:** SCIENCE-BRIEF (with embedded verdicts)
**By:** Astra
**Requested by:** Procyon, ahead of the arrival-standoff change for defect #4 (DSO arrival
overshoot, P0).
**Pairs with:** Vega's cinematography brief for the same slice (framing choice), written in
parallel. Astra bounds what is true; Vega chooses within the bound.

**Prior record this brief AMENDS rather than replaces:**

- [ADR-0004](../adr/0004-volumetric-nebulae-compute-raymarch.md) — the raymarch architecture,
  the 2026-07-19 destination-gated reveal amendment, and the 2026-07-20 shape generalization.
- [2026-07-20-ngc2000-volume-nebula-shapes-science-brief.md](2026-07-20-ngc2000-volume-nebula-shapes-science-brief.md)
  — per-object **morphology** and **colour-physics** verdicts (8 objects, all ACCURATE or
  SIMPLIFIED). **Nothing in that brief is overturned here.** It graded _shape_; this one grades
  _scale, brightness, and vantage_, which it never covered.
- [2026-07-29-owner-device-pass-and-defect-triage.md](2026-07-29-owner-device-pass-and-defect-triage.md)
  §"#4 — DSO arrival overshoot" — the engineering root cause, already exact. This brief supplies
  the science that fixes the multiplier `k` with a number instead of a guess.
- Standing ledger: entries L1–L18 across the exposure, Earth-home, ascent, frame-ladder and
  sky-frames documents. **New entries here are L19–L24.**

---

## 0. Headline — three findings, in the order they change the decision

**Finding 1 — the arrival is not "past" the nebula; it is _inside_ it, and that is
BROKEN PHYSICS for a different reason than assumed.** Confirmed from the code: `ARRIVE_STANDOFF
= 38` against a volume radius of 71.5–91.4 world units puts the camera at `q = 0.42–0.53` — deep
inside the full-density shell, which begins its falloff only at `q = 0.55`. `raySphere` returns a
hit in **every** direction from there, so the gas covers 100% of the frame with no silhouette.
The owner's "travels past it and stops way past it" is the correct reading of that image.

**Finding 2 — the premise in the request ("a ship inside M42 would see essentially nothing")
is _half_ right, and the half that is wrong is the important half.** The local gas within a few
thousand km of the ship emits **~25.5 magnitudes** below the nebula's own core surface brightness
— utterly invisible, exactly as suspected. But you never see only the local gas. From inside M42
the sight-line still runs through **~12 light-years** of the same cloud in every direction, so the
**entire sky glows** at very nearly the surface brightness M42 shows from Earth. Surface
brightness is a conserved quantity along a ray; distance cannot change it. What you lose by going
inside is not light — it is **structure**: no shape, no silhouette, no recognizable object.

**Finding 3 — therefore the "fly to a nebula and look at it" premise is NOT a declared license.
It is real.** The familiar image is scale-free: it looks identical from 1,344 ly and from 40 ly,
only larger. There is a perfectly physical viewing distance, and it is roughly **2.5–4 × the
object's own radius**. The declared licenses in this feature are elsewhere — in the constant
16.10° apparent size, in the colour palette, and in the reveal envelope — and those are large.

---

## 1. Real angular sizes of the shipped nebulae (Q1)

Rendered angular diameter from the world origin is **16.10° for every one of the 11 volumes**,
by construction (§5). Column "×" is rendered ÷ real.

| #   | Object (repo id)                    | Real ang. diameter          | = deg  | Repo `ly` | Real linear diam. | **×** |
| --- | ----------------------------------- | --------------------------- | ------ | --------- | ----------------- | ----- |
| 1   | Veil / Cygnus Loop (`veil`)         | **3°**                      | 3.0    | 2 400     | ~126 ly           | 5     |
| 2   | Rosette (`rosette`)                 | **1.3°** (78′)              | 1.30   | 5 200     | ~118 ly           | 12    |
| 3   | M42 Orion (`m42`)                   | **65′ × 60′**               | 1.083  | 1 344     | ~25 ly            | 15    |
| 4   | M20 Trifid (`ngc6514`)              | **28′**                     | 0.467  | 4 100     | ~33 ly            | 35    |
| 5   | NGC 7293 Helix (`ngc7293`)          | **25′** (bright ring 16′)   | 0.417  | 655       | ~4.8 ly           | 39    |
| 6   | M1 Crab (`m1`)                      | **420″ × 290″** (7′×4.8′)   | 0.117  | 6 500     | ~13 ly            | 138   |
| 7   | NGC 6543 Cat's Eye (`ngc6543`)      | halo **300–386″** (5–5.8′)  | 0.083  | 3 300     | ~4.8 ly           | 193   |
|     | ” — bright inner nebula             | **~20″** (16.1″ mean)       | 0.0056 |           | ~0.32 ly          | 2 900 |
| 8   | NGC 6302 Butterfly/Bug (`ngc6302`)  | **1.8′ × 1.3′** (≥3′ faint) | 0.030  | 3 400     | ~1.8 ly           | 537   |
| 9   | M57 Ring (`m57`)                    | **84″ × 58.8″**             | 0.023  | 2 280     | ~0.93 ly          | 690   |
| 10  | NGC 6309 Box (`ngc2000-box-nebula`) | halo **60″**                | 0.0167 | 8 516     | ~2.5 ly           | 966   |
|     | ” — quadrupolar inner nebula        | **~19″** (44″×30″ deep)     | 0.0053 |           | ~0.78 ly          | 3 051 |
| 11  | MyCn 18 Hourglass (`…-hourglass-…`) | **19″ × 8.5″**              | 0.0053 | 8 000     | ~0.74 ly          | 3 051 |

**The spread is the point.** The Veil is **568× larger on the sky than MyCn 18**. Two of the
eleven are genuinely enormous naked-eye-scale objects (the Veil is six full-Moon diameters across;
the Rosette is 2.6); five are **sub-arcminute telescopic dots** that a visitor could not resolve
as anything but a star without a telescope. The scene renders all eleven at the same 16.10°.

**Data-currency notes (no action required, logged so they are not rediscovered):**

- `m42: ly 1344` follows Menten et al. (2007) VLBA parallax, 414 pc. The Gaia-era ONC value now
  carried by Wikipedia is 388.5 ± 1.7 pc (1,267 ± 5 ly) — a 5.7% difference, both defensible.
- `m57: ly 2280` follows the Gaia-parallax figure quoted in the 2026-07-20 brief; the currently
  listed value is **2,570 ± 90 ly**. Within the real literature spread. **WATCH, not a fix** —
  correcting it would be an edit to hand-curated base data and needs its own TR under the
  CLAUDE.md §22 amendment.
- `veil: ly 2400` is current and good (Fesen et al. 2018, 735 pc; Gaia EDR3 2021, 725 ± 15 pc).
- `ngc6302: ly 3400` matches the published 3,392 ly closely. `ngc6543: 3300` is the standard
  modern value. `MyCn 18: 8000` sits on the routinely-quoted 2.4 kpc.
- **Code-comment defect (documentation drift, worth a one-line fix):** `nebula-field.ts:478`
  labels the `id: "ngc6302"` record `// Butterfly Nebula (NGC 6309 / Bug Nebula)`. NGC 6309 is
  the **Box Nebula**, shipped separately three records above as `ngc2000-box-nebula`. The ra/dec
  (258.436, −37.104) is unambiguously NGC 6302. Object correct, comment wrong.

---

## 2. What you would actually see from close range and from inside (Q2)

This is the crux question, and the answer requires separating two things the intuition conflates.

### 2.1 The part of the intuition that is right — local emission is nil

Emission-nebula gas is a better vacuum than most laboratories can make. M42's bright Huygens
region runs **n_e ≈ 10³–10⁴ cm⁻³** (O'Dell 2001, ARA&A 39, 99 and the O'Dell & Harris
spectrophotometry that followed); the outer body is nearer 10² cm⁻³. For scale, extreme-high-
vacuum apparatus at 10⁻¹² torr holds **3.2 × 10⁴ cm⁻³** at room temperature — _denser than the
Orion Nebula's core._

Emission scales as the **emission measure** EM = ∫ n_e² dl. Taking n_e = 10³ cm⁻³:

| Path length in front of the ship | EM (pc cm⁻⁶) | vs. M42 core (~5 × 10⁵) | Δ magnitude      |
| -------------------------------- | ------------ | ----------------------- | ---------------- |
| 1 000 km                         | 3.2 × 10⁻⁵   | 6.5 × 10⁻¹¹             | **25.5 fainter** |
| 1 AU                             | 4.9          | 9.7 × 10⁻⁶              | 12.5 fainter     |
| 1 000 AU                         | 4.9 × 10³    | 9.7 × 10⁻³              | 5.0 fainter      |
| 0.01 pc (0.033 ly)               | 1.0 × 10⁴    | 2.0 × 10⁻²              | 4.2 fainter      |
| 0.1 pc (0.33 ly)                 | 1.0 × 10⁵    | 0.20                    | 1.7 fainter      |

**So: yes.** Ship-scale gas — anything within a few thousand km, or a few AU, or even a few
hundred AU — contributes **nothing you could ever detect**. If the renderer's gas were a local
effect, the request's intuition would be exactly correct and the whole feature would be fiction.
The column length required to reach the familiar surface brightness at core density is
**~0.1 pc ≈ 0.36 ly ≈ 3 × 10¹² km**.

### 2.2 The part that is wrong — you are never looking at only the local gas

Specific intensity is conserved along a ray through empty space. Move the observer and the solid
angle changes; the **surface brightness does not**. Inside M42 (radius ~12.7 ly), every sight-line
still crosses ~12.7 ly of the same emitting cloud — 3.9 pc, roughly **40× the 0.1 pc needed**.
Compared with the 25.4 ly a distant observer integrates through the full diameter, the interior
observer loses a factor of 2 in path length: **0.75 magnitudes**. Negligible.

**The correct statement, then:** a ship inside M42 sees the **entire sky** glowing at essentially
the surface brightness the nebula shows from Earth. Not blackness. Not a vivid cloud. A
featureless, all-encompassing wash.

### 2.3 How bright, and what colour — the numbers that matter

Derived from M42's own integrated photometry (m_V = 4.0 over 65′ × 60′; §9 for the working):

| Region                             | Surface brightness   | Luminance        | Hemispheric illuminance |
| ---------------------------------- | -------------------- | ---------------- | ----------------------- |
| M42 whole-nebula mean              | **21.6 mag/arcsec²** | 2.5 × 10⁻⁴ cd/m² | ~8 × 10⁻⁴ lux           |
| M42 inner 5′ (Huygens)             | **~17.1**            | 1.6 × 10⁻² cd/m² | ~0.05 lux               |
| M42 innermost 2′                   | **~15.2**            | 9.4 × 10⁻² cd/m² | ~0.30 lux               |
| _Reference:_ bright Milky Way band | 20.7                 | 5.7 × 10⁻⁴       | 1.8 × 10⁻³ lux          |
| _Reference:_ dark natural sky      | 21.9                 | 1.9 × 10⁻⁴       | 5.9 × 10⁻⁴ lux          |
| _Reference:_ full Moon disc        | 3.4                  | 4.7 × 10³        | —                       |

So the honest picture from inside M42:

- **Outer body:** the sky glows at roughly the brightness of the Milky Way band — everywhere,
  all at once, with no dark sky anywhere. Total illumination ≈ **starlight to faint moonlight**.
- **Deep inside the Huygens region:** ~0.05 lux, comparable to **full-moon illumination** on a
  planetary surface. Bright enough to read a control panel by. Genuinely striking — but as a
  uniform glow, not a picture.
- **Colour: essentially none.** At 10⁻⁴–10⁻² cd/m² the human eye is scotopic to low-mesopic
  (cone-mediated colour needs roughly ≳ 0.01–3 cd/m²). Rod peak sensitivity is **507 nm**;
  [O III] 495.9/500.7 nm sits almost exactly on it, while **Hα at 656.3 nm is ~1 000× down** the
  scotopic curve (the Purkinje shift). This is why visual observers at large telescopes report
  M42's core as **grey-green**, never as the magenta of the photographs. Only the very brightest
  arcminutes reach even a hint of hue.

### 2.4 Verdicts

| Element                                                                      | Verdict                                                                                                                                                                                                                                                     | Why  |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Ship-scale gas rendered as a local visible medium                            | **would be BROKEN PHYSICS** — but the raymarcher does not do this; it integrates the real column. **ACCURATE mechanism.**                                                                                                                                   | §2.1 |
| Gas fills the frame when the camera is inside the volume                     | **ACCURATE physics, wrong shot.** From inside, an all-sky wash is exactly right. It is simply not an "arrival".                                                                                                                                             | §2.2 |
| Vivid saturated magenta/teal at any distance                                 | **DECLARED LICENSE (L21)** — narrow-band/Hubble-palette long-exposure reference, not eye-view. The colours are _physically motivated_ (real ionization stratification per the 2026-07-20 brief) but the **saturation and hue visibility** are photographic. | §2.3 |
| Rendered brightness such that the cloud reads clearly against the star field | **DECLARED LICENSE (L20)** — real nebulae sit at 17–22 mag/arcsec², i.e. at or below the natural sky.                                                                                                                                                       | §2.3 |

The 2026-07-20 brief's WATCH-LIST item _"Nebula colour reference — Hubble-palette vs eye-view vs
Hα-red: one declared reference per nebula class"_ is hereby **closed with a verdict**: the scene
uses a **narrow-band photographic reference** throughout, and that is now declared (L21). Do not
"fix" it toward eye-view — an eye-view nebula is grey and nearly invisible, which would destroy
the feature to buy realism nobody can perceive as realism.

---

## 3. Is there a physically-defensible viewing distance? (Q3)

**Yes — and this is the good news the framing decision needs.**

Because surface brightness is distance-invariant, the familiar image of a nebula is **scale-free**.
It is not a property of being 1,344 ly away. Move to 200 ly, 100 ly, 40 ly: the picture is
identical in brightness, colour and structure — only larger. There is no "you have to be at
Earth's distance for it to look like the photograph." The photograph _is_ what it looks like,
from anywhere outside it.

M42 (real diameter 25.4 ly) subtends:

| Real vantage         | Angular diameter | Reads as                                               |
| -------------------- | ---------------- | ------------------------------------------------------ |
| 1 344 ly (Earth)     | 1.08°            | Two full Moons — a smudge to the eye                   |
| 200 ly               | 7.3°             | A clear object with generous sky                       |
| 100 ly               | 14.5°            | Comfortably framed                                     |
| **~38 ly**           | **37.0°**        | **Dominant subject, sky still visible at the corners** |
| 25 ly (= 1 diameter) | 53.9°            | Fills most of the frame; silhouette marginal           |
| 13 ly (= at the rim) | 88.7°            | Half the sky; shape unreadable                         |
| 5 ly (inside)        | 137°             | Engulfed; §2.2                                         |

The physical constraint is simple and hard: **the observer must be outside the emitting volume,
and far enough out that the near-side gas does not dominate the sight-line.** Below about
`d ≈ 1.5 R` the object stops being an object. The comfortable region is **`d ≈ 2.5 R` to
`d ≈ 4 R`**:

| `d / R` | Angular diameter, `2·asin(R/d)` | Character                    |
| ------- | ------------------------------- | ---------------------------- |
| 1.0     | 180°                            | at the rim — engulfed        |
| 1.5     | 83.6°                           | shape barely readable        |
| 2.0     | 60.0°                           | frame-filling                |
| **2.5** | **47.2°**                       | dominant, sky at corners     |
| **3.0** | **38.9°**                       | **classic reveal ratio**     |
| **4.0** | **29.0°**                       | object with generous context |
| 5.0     | 23.1°                           | reads as distant             |

Note that the shipped density model cuts off hard at `q = 1` and begins its shell falloff at
`q = 0.55` with a threshold rising quadratically to the rim, so the **visually bright** body is
roughly `q ≲ 0.85`. At `d = 3 R` the perceived diameter is therefore nearer **32.9°** than 38.9°.
Choose `k` against the perceived figure, not the geometric one.

**Answer to the "or only from 1300 ly?" alternative: no.** The familiar image exists at every
distance from ~1.5 R outwards, unchanged. The arrival is not claiming anything false by showing
a nebula that looks like its photograph from close range. It only becomes false when the camera
goes _inside_ — which is what currently happens.

---

## 4. Surface-brightness invariance — confirmed, and what it means for the renderer (Q4)

**Confirmed.** Specific intensity `I_ν` is conserved along a ray in vacuum (the brightness
theorem — a direct consequence of Liouville's theorem applied to photon phase space, equivalently
of `dΩ ∝ 1/d²` cancelling `F ∝ 1/d²`). Approaching an extended source increases its solid angle
and therefore its **total received flux**, but every square arcsecond of it stays at exactly the
same brightness. The only real modifiers are cosmological redshift dimming (`I ∝ (1+z)⁻⁴`,
irrelevant at 655–8 500 ly) and foreground extinction (§6.3).

### What MUST change as the ship approaches

| Cue                                                                                                              | Physics                                                     | Currently                                                                    |
| ---------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------------------------------------- |
| **Angular size** — grows as `2·asin(R/d)`                                                                        | The only thing that changes                                 | ✅ correct, it is a real 3D volume                                           |
| **Parallax / 3D structure** — near filaments shift against far ones under lateral motion                         | The one thing a visitor can see that no Earth telescope can | ❌ not exploited — the arrival is a dead stop, radial, with no lateral drift |
| **Angular scale of the noise** — fbm features subtend more sky, so the cloud resolves from smooth into filaments | Real; the shipped `noiseFreq / radius` gives this for free  | ✅ correct by construction                                                   |
| **Embedded stars** brighten as `1/d²` — point sources are _not_ surface-brightness invariant                     | Real, and a large effect (§6.1)                             | ❌ absent                                                                    |
| **Occultation** — the cloud must begin to hide the star field behind it                                          | Real for the dusty ones                                     | ❌ absent (§6.3)                                                             |

### What must NOT change

| Cue                                              | Physics                                                                            |
| ------------------------------------------------ | ---------------------------------------------------------------------------------- |
| **Peak surface brightness / per-pixel radiance** | Invariant. A nebula that gets _brighter_ as you close is BROKEN PHYSICS.           |
| **Colour**                                       | Invariant (no redshift, no significant differential extinction over the approach). |
| **Contrast against the sky**                     | Invariant, for the same reason.                                                    |

**Assessment of the shipped raymarch against this:** the emission/absorption integral
(`a = 1 − exp(−d·dtN·extinction)`, front-to-back with transmittance accumulation) is a **correct
radiative-transfer march**, and step size adapts to segment length, so per-pixel radiance is
already distance-correct. **The raymarch is not the problem.** The two things that break
invariance are both outside it:

1. `NEBULA_REVEAL` scales **density** by the reveal factor, ramping 0 → 0.7 across the
   deceleration burn and swelling 0.7 → 1.0 over 1.8 s after the stop. Since density drives both
   opacity and emission, the cloud measurably **brightens and grows** as a function of
   proximity-in-time. This is knowingly unphysical (owner direction, ADR-0004 amendment
   2026-07-19) — it just needs to be **in the ledger** (L22), which it currently is not.
2. Volumes are **invisible unless they are the destination**. Also knowingly unphysical, same
   amendment, same missing ledger entry.

Neither should be reverted. Both should be declared.

---

## 5. Grading `radius = depth × 0.14` (Q5)

### 5.1 What it does

`bodyDepth(ly) = 150 + 128·log₁₀(ly + 1.5)` places every catalog body on a log-compressed radial
scale; `NEBULA_RADIUS_FACTOR = 0.14` then sets each volume's radius as a fixed fraction of its
own depth. The consequence is exact and, verified numerically across all 11 volumes:

> **θ = 2·asin(0.14) = 16.0959…° for every nebula in the scene, to the last digit, regardless of
> its real size or distance.**

| id                         | `ly`  | depth | radius | θ from origin | `38 / R` |
| -------------------------- | ----- | ----- | ------ | ------------- | -------- |
| `ngc7293`                  | 655   | 510.6 | 71.5   | 16.10°        | 0.532    |
| `m42`                      | 1 344 | 550.5 | 77.1   | 16.10°        | 0.493    |
| `m57`                      | 2 280 | 579.9 | 81.2   | 16.10°        | 0.468    |
| `veil`                     | 2 400 | 582.7 | 81.6   | 16.10°        | 0.466    |
| `ngc6543`                  | 3 300 | 600.4 | 84.1   | 16.10°        | 0.452    |
| `ngc6302`                  | 3 400 | 602.1 | 84.3   | 16.10°        | 0.451    |
| `ngc6514`                  | 4 100 | 612.5 | 85.7   | 16.10°        | 0.443    |
| `rosette`                  | 5 200 | 625.7 | 87.6   | 16.10°        | 0.434    |
| `m1`                       | 6 500 | 638.1 | 89.3   | 16.10°        | 0.425    |
| `ngc2000-hourglass-nebula` | 8 000 | 649.6 | 90.9   | 16.10°        | 0.418    |
| `ngc2000-box-nebula`       | 8 516 | 653.1 | 91.4   | 16.10°        | 0.416    |

### 5.2 Verdict

**DECLARED LICENSE (L19) — legitimate, large, and currently undeclared.** It is not broken
physics: nobody has asserted these are real sizes, the shape and colour work underneath it is
honest, and the departure is deliberate. But it is a **5× to 3 000× departure** (§1) applied
uniformly, and a portfolio whose thesis is "secretly true" should not leave a three-order-of-
magnitude compression unrecorded. It belongs in the ledger next to the belt's ~10⁶× overbright
entry, which is the same species of decision.

Two specific criticisms of the constant as written, beyond the magnitude:

**(a) The stated rationale is stale.** The source comment says the factor exists so that "every
nebula's apparent angular size **from home** stays roughly constant (~16°)". Since the 2026-07-19
reveal amendment, **a nebula is invisible from home** — reveal is 0 until the destination's
deceleration burn. The 16° home view the constant was tuned to produce **cannot be seen**. The
only view that exists is the arrival view, so the constant should be justified by arrival framing,
not by a home framing that the reveal envelope removed. (This is documentation drift of the exact
class CLAUDE.md treats as a defect — worth correcting in the comment when the standoff lands.)

**(b) It flattens a real, cheap, available ordering.** The real linear diameters span
**170 : 1** across the shipped set (0.74 ly for MyCn 18 to 126 ly for the Veil). The repo's own
house style for exactly this problem — see L1, the Reinhard exposure compression — is
**preserve rank strictly, compress magnitude, declare the compression**. That pattern applies
here verbatim and costs one per-volume constant. §7.2 gives the numbers.

### 5.3 What is genuinely good about it, and should survive

The factor is **scale-free**: because both the radius and (after the fix) the standoff derive from
the same `depth`, the arrival framing is automatically identical for every nebula with no
per-object tuning, and the fix cannot regress when volume #12 is added. Keep that property.
Whatever `k` Vega picks, express the standoff as `k × volume.radius`, never as a world-unit
literal — a literal would silently re-break the moment a new nebula's depth differs.

---

## 6. Other things physically wrong or missing on approach (Q6)

### 6.1 Embedded stars should become dominant — the Trapezium (BROKEN PHYSICS, by omission)

Point sources obey the inverse-square law; extended sources do not. This is the single largest
**qualitative** change on approach, and it is entirely absent.

θ¹ Orionis C (O7V, dereddened M_V ≈ −4.6, using A_V ≈ 1.7 through the Trapezium):

| Distance                            | Apparent m_V | Comparable to                     |
| ----------------------------------- | ------------ | --------------------------------- |
| 1 344 ly (Earth)                    | +3.5         | a modest naked-eye star           |
| 100 ly                              | −2.2         | brighter than Sirius (−1.46)      |
| **38 ly** (the recommended vantage) | **−4.3**     | **Venus at its brightest (−4.9)** |
| 12 ly                               | −6.8         | 12× Venus                         |
| 1 ly                                | −12.2        | half a full Moon (−12.7)          |
| 0.1 ly                              | −17.2        | 80× the full Moon                 |

At the physically-defensible arrival vantage the Trapezium is a **compact clump of four to six
Venus-class beacons** sitting in the nebula's heart, casting the ionizing light that makes the
cloud glow at all. It is causally the most important object in the frame and it is not rendered.
**Recommendation:** at nebula arrivals, seed 3–6 bright point sprites at the volume centre for
the H II regions that have real ionizing clusters (`m42` Trapezium, `rosette` NGC 2244,
`ngc6514` HD 164492) and a **single** central source for the planetary nebulae and the Crab
(one dying star / one pulsar — a real and citable distinction). This is honest, cheap, and it is
the physical explanation of the whole object.

### 6.2 Structure should resolve — and it already does (SIMPLIFIED, correctly)

`noiseFreq` is divided by `vol.radius`, so fbm features are a fixed fraction of the volume and
their angular scale grows with the approach exactly as real filaments would. The character
change from "smooth glow" to "resolved wisps" is therefore automatic. Real nebulae resolve into
much finer, sharper structure than fbm produces (Herbig-Haro jets, ionization fronts, the
proplyds, the Orion Bar's knife-edge front) — **SIMPLIFIED, and fine**; note what full fidelity
would add and move on.

### 6.3 Extinction and occultation (SIMPLIFIED, with one real exception)

ADR-0004 composites the nebula texture **additively with no depth write**. The march computes
transmittance _internally_ (correctly), but the volume as a whole can only **add** light to the
frame — it can never dim a star behind it.

For the optically-thin ionized gas this is a good approximation: A_V through M42 is a few tenths
to ~2 magnitudes, so background stars would dim but not vanish. **SIMPLIFIED.**

The exception is real and specific: **dust lanes are defined by absorption.** Trifid's three
lanes — modelled, correctly per the 2026-07-20 brief, as density _subtraction_ inside the volume
— are in reality regions of several magnitudes of extinction that **blot out the stars behind
them**. In an additive composite, a subtracted lane renders as "no added light," i.e. it looks
like a gap you can see stars _through_, which is the opposite of a dust lane. The lane physics is
right inside the volume and inverted at the composite. **Flag, don't panic:** at the arrival
framing there is little star field behind the volume, so the artefact is small today. It becomes
real the moment a dust-lane nebula is shown against the Gaia Tiny field. Ledger L23.

Reddening on approach: negligible and not worth implementing. The colour you see already includes
the object's own internal extinction; the foreground column between the ship and the cloud
shrinks monotonically, changing E(B−V) by at most a few hundredths over a 38 ly close.

### 6.4 The nebula is not lit by the ship, and does not respond to it (ACCURATE, keep)

Emission nebulae are photoionized by their embedded O/B stars; planetary nebulae by their central
white dwarf; the Crab's inner glow is synchrotron. None of these respond to an external
illuminator. The absence of any ship-light/headlight interaction with the gas is **correct**, and
should stay correct — resist any request to add a "ship lights up the cloud" effect. (Reflection
nebulae do scatter, but they scatter _starlight_; a spacecraft's lamp is ~10²⁰ times too weak.)

### 6.5 The "arrival" cannot show a phase, terminator or opposition surge (ACCURATE by nature)

Unlike the planet spheres — where the α = 0.000° arrival geometry is a documented constraint
(Earth brief §0.2) — a self-luminous nebula has no phase angle at all. Nothing is lost here, and
no lighting geometry needs to be solved. Worth stating explicitly so nobody looks for it.

---

## 7. Ready-to-implement constants

### 7.1 The minimal fix (recommended for this slice)

```ts
/** Nebula-class arrival standoff, as a MULTIPLE of the volume's own radius —
 *  never a world-unit literal, because volume radius scales with the body's
 *  log-depth and a literal would silently re-break for a new nebula.
 *
 *  Physics floor: k > 1 puts the camera outside the emitting volume at all.
 *  Below k ~ 1.5 the near-side gas dominates every sight-line and the object
 *  has no silhouette (Astra 2026-07-29 brief, section 3). Above k ~ 5 it reads
 *  as "still travelling".  Perceived diameter is ~2*asin(0.85/k) rather than
 *  2*asin(1/k), because the density shell falls off from q = 0.55 and cuts
 *  off at q = 1. */
export const NEBULA_ARRIVE_STANDOFF_FACTOR = 3.0;
export const NEBULA_ARRIVE_STANDOFF_MIN_FACTOR = 1.5; // hard physics floor
```

Resulting world-unit standoffs (`k = 3.0`), for the third branch at
`babylon-engine.ts:6534`:

| id                         | radius | **standoff @ k=3** | geometric θ | perceived θ (0.85 R) |
| -------------------------- | ------ | ------------------ | ----------- | -------------------- |
| `ngc7293`                  | 71.5   | **214**            | 38.9°       | 32.9°                |
| `m42`                      | 77.1   | **231**            | 38.9°       | 32.9°                |
| `m57`                      | 81.2   | **244**            | 38.9°       | 32.9°                |
| `veil`                     | 81.6   | **245**            | 38.9°       | 32.9°                |
| `ngc6543`                  | 84.1   | **252**            | 38.9°       | 32.9°                |
| `ngc6302`                  | 84.3   | **253**            | 38.9°       | 32.9°                |
| `ngc6514`                  | 85.7   | **257**            | 38.9°       | 32.9°                |
| `rosette`                  | 87.6   | **263**            | 38.9°       | 32.9°                |
| `m1`                       | 89.3   | **268**            | 38.9°       | 32.9°                |
| `ngc2000-hourglass-nebula` | 90.9   | **273**            | 38.9°       | 32.9°                |
| `ngc2000-box-nebula`       | 91.4   | **274**            | 38.9°       | 32.9°                |

`k` band Astra will sign off without further review: **2.5 ≤ k ≤ 4.0** (47.2° down to 29.0°
geometric). **k = 3.0 is the recommendation.** Vega owns the choice inside that band; anything
below 1.5 is a physics violation and Astra will flag it, whatever it looks like.

**Zoom bounds must move with it.** `clampZoomDistance`'s ceiling is `restDist × ZOOM_MAX_MULT`
and its floor is a fraction of `restDist` for non-planet bodies. With `restDist ≈ 231`, the floor
must not be allowed below **`1.5 × radius`** or the visitor can zoom straight back inside the
cloud and reproduce the defect by hand. Recommend a nebula-class floor of
`max(NEBULA_ARRIVE_STANDOFF_MIN_FACTOR × radius, …)`.

**Camera FOV context:** the scene's vertical FOV is 0.8 rad = **45.84°** (horizontal ≈ 73.9° at
16:9). A 32.9° perceived subject against a 45.84° vertical frame is 72% of frame height — the
same "dominant but not edge-to-edge" ratio TR-103 chose for planets (37.9° against the same
frame). The two arrival classes will read as siblings, which is the right outcome.

### 7.2 The upgrade worth doing next (rank-honest sizes)

Replace the single `NEBULA_RADIUS_FACTOR` with a per-volume radius that preserves the **real
size ordering** and compresses only the magnitude — the L1/Reinhard pattern:

```ts
/** Real linear diameter, ly — measured, not chosen (angular size x distance;
 *  Astra 2026-07-29 brief section 1). Used ONLY to rank-order apparent size
 *  on arrival; the magnitude is deliberately compressed. */
realDiameterLy: number;
```

Arrival apparent diameter then interpolates log-linearly over the real range, 26° → 50°:

| id                         | real diam. | θ on arrival | `standoff / R` |
| -------------------------- | ---------- | ------------ | -------------- |
| `veil`                     | 126 ly     | **50.0°**    | 2.37           |
| `rosette`                  | 118 ly     | 49.7°        | 2.38           |
| `ngc6514`                  | 33 ly      | 43.8°        | 2.68           |
| `m42`                      | 25 ly      | 42.5°        | 2.76           |
| `m1`                       | 13 ly      | 39.5°        | 2.96           |
| `ngc6543`                  | 4.8 ly     | 34.7°        | 3.35           |
| `ngc7293`                  | 4.8 ly     | 34.7°        | 3.35           |
| `ngc2000-box-nebula`       | 2.5 ly     | 31.7°        | 3.67           |
| `ngc6302`                  | 1.8 ly     | 30.1°        | 3.85           |
| `m57`                      | 0.93 ly    | 27.1°        | 4.27           |
| `ngc2000-hourglass-nebula` | 0.74 ly    | 26.0°        | 4.45           |

A real **170 : 1** size range renders as **1.88 : 1** on screen — every nebula still well framed,
never a speck, and the Veil is visibly the giant it is. That converts a flat 3 000× license into a
rank-preserving one, which is a materially stronger claim for the same effort. **Not required for
this slice**; recommended for the next nebula touch.

### 7.3 Cheap, high-value additions in priority order

1. **Embedded ionizing sources** (§6.1) — 3–6 point sprites at volume centre for the H II
   regions, 1 for the PNe and the Crab. The largest realism-per-line item in this brief.
2. **Lateral drift on arrival** (§4) — a slow orbital or lateral component to the parked camera
   so the volume's 3D structure reveals itself by parallax. The one thing a visitor can see that
   no telescope on Earth can, and the volumes are already genuinely three-dimensional. This is
   the honest replacement for "it gets bigger and brighter."
3. **Occlusion for dust-lane nebulae** (§6.3) — when a nebula is composited over the Gaia Tiny
   field.

---

## 8. License-ledger additions (L19–L24)

Continuing the standing register (L1–L18). Every entry here is a **deliberate, defensible**
departure — none is a defect. The point of writing them down is that none of them was written
down before.

| #       | License                                                                                                                                                       | Magnitude                                                                                                  | Rationale                                                                                                                                                                                                                                |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **L19** | **Every nebula renders at 16.10° apparent diameter from the origin**, regardless of real angular or linear size                                               | **5× (Veil) to ~3 000× (Cat's Eye inner, Box inner, MyCn 18)**; real linear sizes span 170:1, rendered 1:1 | Five of eleven shipped objects are sub-arcminute telescopic dots; at true relative scale they would be invisible specks and the feature would not exist. True sizes belong in the dossier copy. §7.2 offers a rank-honest upgrade path.  |
| **L20** | **Nebula surface brightness is raised to read clearly against the star field**                                                                                | Real M42 sits at **17–22 mag/arcsec²** — at or below a dark natural sky (21.9)                             | Same species as the belt's ~10⁶× overbright (existing ledger entry). A physically-exposed nebula is a grey smudge; the showcase must be seeable.                                                                                         |
| **L21** | **Narrow-band / long-exposure photographic colour reference**, not eye-view                                                                                   | Real visual appearance is **grey to grey-green**; Hα is ~1 000× down the scotopic curve                    | The _hues_ are real physics (ionization stratification, per the 2026-07-20 brief); the _saturation and visibility_ are photographic. Closes that brief's colour-reference WATCH item with a verdict.                                     |
| **L22** | **Destination-gated reveal**: a volume is invisible until it is the travel destination, then ramps 0 → 0.7 across the decel burn and swells to 1.0 over 1.8 s | Total (0 → full); brightness varies with proximity, which surface-brightness invariance forbids            | Owner direction, ADR-0004 amendment 2026-07-19. Ambient nebulae read as scenery; gated ones read as destinations. Recorded here because the amendment never produced a ledger entry.                                                     |
| **L23** | **Additive composite — nebulae never occlude or redden anything behind them**                                                                                 | A_V through M42 is a few tenths to ~2 mag; through Trifid's lanes, several                                 | Good for the optically thin ionized gas; genuinely inverted for dust lanes (§6.3). Small today because the arrival framing has little behind the volume; revisit when a dust-lane nebula is shown against the Gaia Tiny field.           |
| **L24** | **Nebula volumes are traversable at ship scale** — the ship can fly into one in seconds                                                                       | ~10⁶–10⁹, inherited from the scene-wide scale compression (existing ledger entry)                          | Already covered in spirit by the scale-compression entry; named separately because the arrival-standoff fix is specifically the decision _not_ to enter, and the ledger should say that entering remains possible and remains a license. |

**Supersedes / clarifies:** the standing ledger line _"Vivid, ship-scale-traversable volumetric
nebulae — real nebulae are ly-scale, eye-faint"_ is correct but was doing four jobs at once. It is
now decomposed into **L19** (size), **L20** (brightness), **L21** (colour) and **L24** (traversal),
each with its own magnitude. Nothing is withdrawn.

---

## 9. Numbers appendix

**9.1 Volume radius and rendered angular size.**
`bodyDepth(ly) = 150 + 128·log₁₀(ly + 1.5)`; `radius = depth × 0.14`.
θ = 2·asin(radius/depth) = 2·asin(0.14) = 2 × 8.0480° = **16.0959°**, independent of `ly` — the
`depth` cancels identically. Verified numerically for all 11 volumes (all agree to 4 decimals).
Current camera position `q = 38/radius` ranges 0.416–0.532; the density shell begins falling only
at `q = 0.55`, so the camera is inside the full-density body in every case.

**9.2 Real linear diameter.** `D = d · θ_rad`, small-angle. E.g. M42: 3 900″ / 206 265 = 0.018 908
rad × 1 344 ly = **25.4 ly**. Veil: 10 800″ / 206 265 × 2 400 = **125.7 ly**. MyCn 18:
19″ / 206 265 × 8 000 = **0.74 ly**.

**9.3 M42 mean surface brightness.** Ellipse area = (π/4)(65 × 60)(60 × 60) = **1.103 × 10⁷
arcsec²**. μ = m + 2.5 log₁₀ A = 4.0 + 2.5(7.043) = **21.61 mag/arcsec²**.
_Assumption:_ the inner-region figures (17.1 at 5′, 15.2 at 2′) assume 50% of the total flux falls
inside those apertures — an **order-of-magnitude estimate from the light concentration**, not a
photometric measurement. They agree with the commonly reported 16–18 mag/arcsec² for the Huygens
region, which is the cross-check. Treat ±1 mag as the uncertainty.

**9.4 Luminance and illuminance.** L [cd/m²] = 1.08 × 10⁵ × 10^(−0.4 μ_V) (standard V-band
conversion). Hemispheric illuminance for a uniform sky, E = π L. Sanity check: μ = 21.9 gives
1.9 × 10⁻⁴ cd/m², the accepted dark-sky value. ✅

**9.5 Emission measure.** EM = n_e² L, expressed in pc cm⁻⁶ (L converted from cm at
1 pc = 3.0857 × 10¹⁸ cm). n_e = 10³ cm⁻³ over 10⁸ cm (1 000 km) → **3.2 × 10⁻⁵ pc cm⁻⁶**. Core
reference EM ≈ 5 × 10⁵ pc cm⁻⁶ (n_e = 10³ over 0.5 pc), consistent with the 10⁵–10⁷ range reported
for M42's inner region. Ratio 6.5 × 10⁻¹¹ → Δm = −2.5 log₁₀(6.5 × 10⁻¹¹) = **25.5 mag**.
_Order-of-magnitude:_ the density is a representative value, not a measurement at a specific point;
M42's n_e varies by more than a decade across the Huygens region alone.

**9.6 Interior vs exterior path length.** Centre of a sphere of radius R: path = R in every
direction. Exterior, through the centre: 2R. Ratio 0.5 → **0.75 mag** dimmer. (Optically thin
limit; M42 is optically thin in Hα, so I ∝ ∫ j dl holds.)

**9.7 Trapezium apparent magnitude.** θ¹ Ori C: V = 5.13 at 414 pc with A_V ≈ 1.7 →
M_V = 5.13 − 5 log₁₀(41.4) − 1.7 = **−4.64**. Then m = M_V + 5 log₁₀(d_pc/10). At 38 ly
(11.65 pc): −4.6 + 5(0.0663) = **−4.27**.
_Assumption:_ A_V = 1.7 is the standard Trapezium value but the extinction there is genuinely
patchy; ±0.5 mag on M_V is fair, which moves the 38 ly figure to −3.8…−4.8. The conclusion
(Venus-class) is robust across that range.

**9.8 Vacuum comparison.** n = P/kT. At 10⁻¹² torr = 1.333 × 10⁻¹⁰ Pa and T = 300 K:
n = 1.333 × 10⁻¹⁰ / (1.381 × 10⁻²³ × 300) = 3.22 × 10¹⁰ m⁻³ = **3.2 × 10⁴ cm⁻³** — above M42's
core density.

**9.9 Rank-honest framing (§7.2).** θ_i = 26° + 24° · [log₁₀(D_i) − log₁₀(D_min)] /
[log₁₀(D_max) − log₁₀(D_min)], D in ly. Standoff k_i = 1/sin(θ_i/2). Real range
125.66/0.74 = **170 : 1**; apparent range sin(25°)/sin(13°) = **1.88 : 1**.

---

## Sources

Angular sizes, distances and morphology:

- [Orion Nebula — Wikipedia](https://en.wikipedia.org/wiki/Orion_Nebula) (65′ × 60′; 1,267 ± 5 ly
  Gaia-era; ~25 ly across; ~2,000 M☉)
- [Veil Nebula — Wikipedia](https://en.wikipedia.org/wiki/Veil_Nebula) and
  [An Updated Distance to the Cygnus Loop Based on Gaia EDR3](https://arxiv.org/pdf/2109.05368)
  (3° apparent; 725 ± 15 pc)
- [Rosette Nebula — Constellation Guide](https://www.constellation-guide.com/rosette-nebula/)
  (1.3°; ~130 ly across)
- [Trifid Nebula — Constellation Guide](https://www.constellation-guide.com/trifid-nebula-messier-20/) (28′)
- [Helix Nebula — Constellation Guide](https://www.constellation-guide.com/helix-nebula-ngc-7293-caldwell-63-in-aquarius/) (25′)
- [Cat's Eye Nebula — Wikipedia](https://en.wikipedia.org/wiki/Cat%27s_Eye_Nebula) (inner ~20″,
  mean 16.1″; halo ~300–386″)
- [Crab Nebula — Wikipedia](https://en.wikipedia.org/wiki/Crab_Nebula) (420″ × 290″; 6,500 ± 1,600 ly)
- [Ring Nebula — Wikipedia](https://en.wikipedia.org/wiki/Ring_Nebula) (84″ × 58.8″; 2,570 ± 90 ly)
- [NGC 6302 — Constellation Guide](https://www.constellation-guide.com/butterfly-nebula/) (1.8′ × 1.3′)
- [NGC 6309 — Deep⋆Sky Corner](https://www.deepskycorner.ch/obj/ngc6309.en.php) and
  [NGC 6309, a planetary nebula that shifted from round to multipolar — MNRAS 446, 1931](https://academic.oup.com/mnras/article/446/2/1931/2892783)
  (inner ~19″; 60″ spherical halo)
- [Engraved Hourglass Nebula (MyCn 18) — Wikipedia](https://en.wikipedia.org/wiki/Engraved_Hourglass_Nebula)
  and [Radio continuum study of MyCn 18 — MNRAS 337, 401](https://academic.oup.com/mnras/article/337/2/401/1023209)
  (19″ × 8.5″; 2.4 kpc routinely quoted, 3.2 kpc in a recent re-analysis)

Physical conditions and photometry:

- [Structure of the Orion Nebula — O'Dell, ApJ (2001)](https://iopscience.iop.org/article/10.1086/317982)
  and [Structure and physical conditions in the Huygens region — MNRAS 464, 4835](https://academic.oup.com/mnras/article/464/4/4835/2417437)
  (electron densities and Hβ surface brightness through the Huygens region)
- [Spectrophotometry of the Huygens Region of the Orion Nebula — O'Dell & Harris (2010)](https://arxiv.org/abs/1008.1002)

Textbook physics asserted without citation (standard, re-derivable): conservation of specific
intensity along a ray; Pogson's magnitude scale; the emission-measure scaling of recombination-line
surface brightness; the scotopic/photopic luminous-efficiency curves and the Purkinje shift.
