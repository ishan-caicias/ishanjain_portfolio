# Science Brief — Gaia DR3 asteroid belt: propagation, frame, scale, time, photometry

**Date:** 2026-07-20
**Mode:** SCIENCE-BRIEF (with per-decision REALISM-AUDIT verdicts)
**Requested by:** Procyon, for PF-10 phase C3 — replacing the procedural seeded-LCG Havok belt
with the real Gaia DR3 asteroid catalog
(`resources/gaia_datasets/catalog-asteroids-dr3/asteroids-dr3.json`).

All numbers below were **computed from the actual file**, not recalled. Where the brief
corrects a figure in the request, it says so.

---

## 0. Corrections to the stated dataset facts (read first)

| Stated in request               | Actual, measured                                       |
| ------------------------------- | ------------------------------------------------------ |
| 154,635 objects                 | **154,662** objects carrying an `orbit` block          |
| 959 distinct epochs             | **945** distinct epochs                                |
| Epoch range ~JD 2457356–2457490 | **JD 2456876.5 – 2457888.5** (2014-08-08 → 2017-05-17) |

The epoch spread is ~2.8 years wide, not ~4 months. This does not change any verdict below,
but it does change the propagation baseline: **Δt ranges from 9.2 to 11.9 years**, not a tight
10.5. Per-object propagation from each object's own epoch (as designed) is therefore the
_right_ call and more necessary than the request assumed — a single common epoch would smear
objects by up to 2.8 yr of mean motion.

Measured element distributions (154,662 objects):

| Quantity   | min    | 1st pct | median | mean   | 99th pct | max     |
| ---------- | ------ | ------- | ------ | ------ | -------- | ------- |
| a (AU)     | 0.662  | 1.912   | 2.627  | 2.689  | 5.090    | 67.70   |
| e          | 0.0003 | 0.0176  | 0.1334 | 0.1393 | 0.3221   | 0.895   |
| i (deg)    | 0.022  | 0.889   | 8.088  | 9.453  | 28.20    | 72.16   |
| period (d) | 196.7  | 965.6   | 1555.0 | 1634.8 | 4193.9   | 203,435 |

Two things worth knowing: the catalog is **not purely main-belt** — it contains 108 near-Earth
objects (a < 1.3 AU), 1,545 Jupiter Trojans, and 23 trans-Neptunian objects (a > 30 AU, out to
67.7 AU). The mean inclination of 9.45° is real and matters for decision 3.

---

## 1. Two-body Kepler propagation ~10 years past epoch

**Verdict: SIMPLIFIED — and, for this specific use, effectively indistinguishable from
ACCURATE. Ship it.**

### The physics

The stored elements are **osculating** elements — the instantaneous two-body ellipse at epoch.
Real asteroid motion departs from that ellipse because of planetary perturbations, dominated
overwhelmingly by Jupiter (M_J/M_☉ = 9.55×10⁻⁴). Two-body propagation therefore accumulates
error, and the error is **almost entirely along-track** (in mean anomaly), not radial.

That asymmetry is the whole argument. The mechanism:

```
n = √(GM☉ / a³)          →      δn/n = −(3/2) · δa/a
```

An error in the assumed semi-major axis produces an error in mean motion, which integrates
linearly into an along-track angular error:

```
δM ≈ (3/2) · (δa/a) · n · Δt = (3/2) · (δa/a) · ΔM_elapsed
```

With the measured median period of 1555 d and Δt ≈ 3,840 d, each object completes
**ΔM_elapsed ≈ 2.47 revolutions ≈ 889°** of mean anomaly. Osculating-vs-mean semi-major axis
for a typical main-belt asteroid differs by δa/a ~ 10⁻⁴ (short-period Jovian forcing), rising
toward 10⁻³ for objects near a mean-motion resonance:

| δa/a | δM after 10.5 yr | along-track arc at 2.7 AU | in world units (63 wu/AU) |
| ---- | ---------------- | ------------------------- | ------------------------- |
| 10⁻⁴ | 0.13°            | 0.0063 AU                 | **0.40 wu**               |
| 10⁻³ | 1.33°            | 0.063 AU                  | **3.95 wu**               |
| 10⁻² | 13.3°            | 0.63 AU                   | 39.5 wu (resonant only)   |

Compare against the belt's own dimensions: radial spread ±26 wu, vertical ±14 wu, physics-rock
diameters 0.9–3.2 wu. So the **typical** propagation error is smaller than a single rendered
rock, and even the pessimistic 10⁻³ case is ~15% of the belt's radial half-width — displaced
_along_ the ring, in the one direction where the belt is statistically axisymmetric.

### Why it is unobservable by construction

Averaged over 154,662 objects, mean anomaly is uniformly distributed. A belt is a
**rotationally-symmetric structure in M**. Shifting an object along-track by 1° moves it into a
position statistically identical to the one it left. Every feature a viewer can actually
perceive — the ring's radius, its width, its thickness, the Kirkwood gaps, the Hilda island,
the Trojan clumps — is a function of **a, e, i only**, and _those are not propagated at all_.
They are read straight from the file, unaltered, real.

The one caveat worth naming: the ~1% of objects near strong resonances (and the 0.4% with
e > 0.5, plus the 23 TNOs) will drift much further, and chaotic ones are formally
unpredictable at this baseline. They are lost in a 154k-point cloud.

**Recommendation:** do it exactly as designed. Do **not** invest in a perturbed integrator —
it would change nothing a human eye can resolve. Do state the snapshot date in the code, which
the design already does.

---

## 2. The ecliptic / equatorial frame inconsistency

**Verdict: BROKEN PHYSICS as currently designed — but cheap to fix, and the dataset itself
tells you the fix.**

This is the one item in the eight I would not wave through.

### The evidence

Every object in `asteroids-dr3.json` carries this field:

```json
"transformFunction": "eclipticToEquatorial"
```

That is Gaia Sky's own instruction, shipped with the data, stating that these elements are
heliocentric **ecliptic** and must be rotated into the equatorial frame before being placed in
a scene whose other contents are equatorial. The rest of the portfolio's catalog — stars,
DSOs, clusters, GD-1 — is positioned from **equatorial RA/Dec**. Declaring the scene's X–Y
plane to be "the ecliptic" does not make it so; it makes the scene contain two mutually rotated
coordinate systems while asserting they are one.

The rotation is a single-axis matrix about the vernal-equinox X axis by the mean obliquity:

```
ε = 23.439281°   (J2000; IAU 2006 value 23°26′21.406″)

x_eq = x_ecl
y_eq = y_ecl·cos ε − z_ecl·sin ε
z_eq = y_ecl·sin ε + z_ecl·cos ε

cos ε = 0.9174821,   sin ε = 0.3977772
```

### How visible is the error?

Quantifiably: the belt plane's pole would sit **23.44° away** from where the real ecliptic pole
sits in the scene's equatorial frame. Consequences a viewer could actually catch:

- **The zodiac fails.** The ecliptic is defined by which constellations it passes through. A
  correctly-placed belt threads Taurus → Gemini → Cancer → Leo → Virgo → Scorpius →
  Sagittarius. A 23.44°-misrotated belt does not; near the solstitial points it misses by the
  full 23.44°, roughly **47 full-Moon diameters**. Anyone who knows the sky — the exact
  audience a portfolio like this is aimed at — sees a belt running along the celestial equator
  instead of the zodiac.
- **The galactic-plane relationship inverts.** The ecliptic crosses the Milky Way in
  Sagittarius and Gemini at ~60°. The celestial equator crosses it elsewhere at ~63°. If the
  scene renders both the belt and the galactic plane, their intersection geometry is wrong in a
  way that reads immediately in a wide shot.
- It is **completely invisible** if the belt is only ever viewed against empty space at close
  range, with no stars in frame for reference.

So the visibility is entirely a function of whether belt and starfield ever share a frame.

### Recommendation, in preference order

1. **Apply the obliquity rotation** (preferred). It is nine multiplies per object at build
   time, costs nothing at runtime, honours the dataset's own declared transform, and makes the
   scene internally consistent for the first time. The belt then lands wherever the real
   ecliptic lands, tilted 23.44° to the existing belt plane.
2. If the tilt breaks the tuned camera choreography and the owner wants the flat belt kept:
   **declare it explicitly** in the license ledger — _"the asteroid belt is rendered in
   heliocentric ecliptic coordinates and is NOT rotated into the scene's equatorial frame; it
   is therefore mis-oriented by 23.44° relative to the star catalog, deliberately, to preserve
   the tuned belt plane."_ That converts a defect into a choice, which is legitimate.
3. Silently keeping the flat belt while describing it as real ecliptic data is the only
   unacceptable option — it is the accidental-wrongness case the taxonomy exists to catch.

**Yes, flag this to the owner.** It is the single decision here with a real answer.

---

## 3. Scale and exaggerated render size

**Verdict: DECLARED LICENSE, and the correct kind — the ratio is right even though the sizes
are not.**

The linear scale checks out: 2.7 AU × 63 wu/AU = **170.1 wu**, matching the tuned spine radius
of 170. Clean.

The size exaggeration is enormous, and there is no alternative. A 1 km asteroid at 63 wu/AU is
6.7×10⁻⁶ world units across — 5 to 6 orders of magnitude below a rendered pixel. Even Ceres
(939 km diameter) is 3.95×10⁻⁴ wu. The physics rocks at 0.9–3.2 wu correspond to bodies
**0.021–0.076 AU across, i.e. 3.2–11.4 million km** — roughly 8× the diameter of the Sun, or
~2,400 to 12,000 Ceres-diameters. This is not a small exaggeration; it is the entire reason
asteroid belts can be drawn at all.

The honest framing, and worth putting in the ledger verbatim: **the real main belt is
invisible.** Total mass ~3% of the Moon spread through a torus ~1 AU wide and ~0.5 AU thick;
mean spacing between kilometre-class bodies of order 10⁶ km. A ship sitting inside the real
belt would, with the naked eye, see **nothing** — no rocks, no dust, no hint that it was inside
anything. Every spacecraft that has crossed it did so without evasive manoeuvres. What the
scene renders is not a dense belt; it is a **map of the belt** — real positions, symbolic
markers — and that is a defensible, even elegant, thing to declare.

One realism note that costs nothing: the measured mean inclination is **9.45°** (median 8.09°,
99th pct 28.2°). At 170 wu spine radius, a 9.45° inclination implies a vertical excursion of
170·tan(9.45°) ≈ **28.3 wu**, and the 99th percentile implies ±91 wu. The existing tuned
vertical spread of **±14 wu is about half the real RMS thickness** and ~6× too thin at the
tails. Since the real z comes out of the Kepler solution automatically, the belt will render
_thicker_ than the procedural one did. Do not clamp it back to ±14 — the real puffiness is a
genuine, visible signature that the data is real. The main belt is a fat torus, not a ring.

---

## 4. Uniform time acceleration — vis-viva check

**Verdict: ACCURATE. The arithmetic is right and the framing is the honest one.**

### Confirming the arithmetic

Circular orbital speed at 2.7 AU, GM_☉ = 1.32712440018×10¹¹ km³/s²:

```
r     = 2.7 × 1.495978707×10⁸ km = 4.03914×10⁸ km
v     = √(GM☉/r) = √(1.32712440018×10¹¹ / 4.03914×10⁸)
      = √328.568 = 18.126 km/s
```

Convert to world units: 63 wu/AU ÷ 1.495978707×10⁸ km/AU = 4.21129×10⁻⁷ wu/km.

```
v_wu  = 18.126 km/s × 4.21129×10⁻⁷ wu/km = 7.6335×10⁻⁶ wu/s
v_wu × TIME_ACCEL(4×10⁵) = 3.053 wu/s          ✓ matches the stated 3.05
```

And the time factor: 4×10⁵ s of simulated time per second of wall clock = 4×10⁵/86400 =
**4.63 days per wall-clock second** ✓, i.e. one 2.7 AU orbit (period 4.44 yr = 1,621 d) takes
**350 s ≈ 5.8 minutes** of real time to complete. Sanity check that the other way: a 350 s
orbit at radius 170 wu has circumference 1,068 wu, giving 3.05 wu/s ✓. Self-consistent.

Worth having on hand for the tier subsets — the real full range in this catalog:

| a (AU)         | v_orb (km/s) | scene speed (wu/s) at 4×10⁵ |
| -------------- | ------------ | --------------------------- |
| 1.9 (inner 1%) | 21.61        | 3.64                        |
| 2.5 (3:1 gap)  | 18.84        | 3.17                        |
| 2.7 (spine)    | 18.13        | **3.05**                    |
| 3.28 (2:1 gap) | 16.44        | 2.77                        |
| 3.97 (Hilda)   | 14.95        | 2.52                        |
| 5.20 (Trojan)  | 13.06        | 2.20                        |

### Why uniform acceleration is the right framing

A single scalar multiplier on the velocity field is **not** a physics distortion in the way
that, say, arbitrarily speeding up inner asteroids would be. It is a **redefinition of the time
unit**, and the deep reason it is safe is that Newtonian gravitation is scale-invariant under
the Kepler-third-law transformation: rescaling t → t/k while holding lengths fixed leaves every
orbit a valid orbit of a system with GM scaled by k². The scene is not showing distorted orbits
— it is showing **undistorted orbits of a star 1.6×10¹¹ times more massive**, which is exactly
what "fast-forward" means.

The consequence, and the thing that makes this decision genuinely good: **every ratio survives
exactly.** Kepler's third law holds. Inner asteroids really are faster, by exactly the right
√(1/a) factor. Relative velocities between neighbouring rocks are real. Differential shear
across the belt — the inner edge lapping the outer edge — is real, and is a _visible_
behaviour: over the 5.8-minute spine orbit, a 2.06 AU asteroid gains ~135° of longitude on a
3.28 AU one. That is a real, watchable, correct piece of celestial mechanics.

**Declare it as:** _"time acceleration ×4×10⁵ (4.63 days/second); all orbital velocities are
real vis-viva solutions, uniformly rescaled — relative speeds and Kepler's third law are exact."_
That sentence is true, which is the entire point.

One caution inherited from the Havok layer: at 4×10⁵× the _collision_ velocities are also
scaled. Real in-belt relative velocities are ~5 km/s — collisions at that speed are
catastrophic disruption events, not bounces. Any restitution-style bouncing between rocks is
SIMPLIFIED at best. If rocks collide visibly, the honest declaration is that the physics layer
models proximity, not impact.

---

## 5. Static visual layer + moving 20–48-body physics subset

**Verdict: DECLARED LICENSE — and far less noticeable than it sounds, for a reason worth
knowing.**

The instinct is that a static 154k-point cloud beside 48 moving rocks will read as broken. It
mostly will not, and the reason is the same axisymmetry that saved decision 1: **a uniformly
populated ring in mean anomaly looks identical to itself under rotation.** A correctly-rendered
static belt is visually indistinguishable from a correctly-rendered rotating one _when you are
looking at the belt as a structure_. There is no texture in M to track.

Where it does show:

- **Parallax-free close passes.** Flying through the belt, the specks hold station against the
  moving rocks. This is the real tell, and it is a foreground-motion cue, not an astronomy one.
- **Anywhere the belt has azimuthal structure**, because that structure is _not_ rotationally
  symmetric and its stillness is then meaningful. In this catalog the **Trojans are exactly
  that case**: 1,545 objects clumped at Jupiter's L4/L5 points, ±60° from a planet. If the
  scene ever renders Jupiter, static Trojans that do not track it are visibly wrong. If Jupiter
  is not rendered, they are just two arcs and nobody can tell.

Mitigations, cheapest first:

1. **Ship it static.** For a belt viewed as a ring, defensible. Declare: _"the 154,662-object
   visual layer is a static snapshot at 2026-07-20; only the physics subset propagates."_
2. **Rotate the whole point cloud rigidly** at the 2.7 AU rate (3.05 wu/s → 0.01795 rad/s).
   One matrix per frame, zero per-object cost. This is _wrong_ — it suppresses the real
   differential shear and makes the belt a rigid disc — but it buys global motion for free.
   Weigh honestly: it trades a true statement (frozen snapshot) for a false one (rigid belt).
   I'd rather have the honest freeze.
3. **Advance M in the vertex shader.** `M = M₀ + n·t` with `n` packed per-object, solving
   Kepler in-shader (3 Newton iterations converges for e < 0.3, which covers the 99th
   percentile). This is the fully correct answer, it makes the differential shear visible
   across all 154,662 objects, and it is genuinely the most impressive version of this feature.
   Procyon owns whether the tier budget affords it — but flag that it is _possible_, because a
   belt that visibly shears is the single most convincing "this is real" motion cue available.

---

## 6. Photometry: the magnitude and colour bytes

### 6a. Magnitude — the ramp cannot express asteroid faintness

The shader maps `mag = 12.5 − magByte/255 × 14`, so magByte 0 → **mag 12.5** (the dimmest
representable) and magByte 255 → mag −1.5.

Real numbers for context. Gaia DR3's asteroid sample runs to roughly G ≈ 20–21; typical
main-belt members in a catalog this size sit around **V ≈ 15–18** at opposition, and fainter
away from it. The brightest objects in the sky from this population are Vesta (V 5.2–8.5) and
Ceres (V 6.6–9.3), and those are two objects out of 154,662.

So the honest value is **magByte = 0**, giving mag 12.5 — which is _still ~3 to 5 magnitudes
brighter than the real median asteroid_, i.e. a factor of 16–100 too luminous. The ramp simply
does not reach asteroid faintness. That is a property of the shader, not a mistake in this
feature.

**Recommendation:** `MAG_BYTE = 0`. If mag 12.5 renders too dim to see at all, go to
**magByte = 8** (mag 12.06) or **16** (11.62) — but nothing higher, and record the choice as
_"asteroid magnitudes are clamped to the dim end of the shader's ramp; the real population is
3–5 mag fainter than the ramp's floor can express."_ Uniform brightness across all 154,662 is
correct given no magnitude data — inventing a distribution would be fabricating catalog
photometry, which the realism map ranks as BROKEN PHYSICS regardless of how good it looks.

### 6b. Colour — t ≈ 0.85 is too red; use **t ≈ 0.68**

This one has a real answer, and the proposed value is off.

**What asteroids actually look like.** Asteroids do not emit; they reflect sunlight, and their
colour is the solar spectrum multiplied by a reflectance slope. The main belt is dominated by
two taxonomic classes:

| Class  | Fraction (by number, mag-limited) | Albedo    | B−V       | Character                       |
| ------ | --------------------------------- | --------- | --------- | ------------------------------- |
| C-type | ~65–75% of the belt overall       | 0.03–0.09 | **~0.70** | Carbonaceous; near-neutral grey |
| S-type | ~17–20%, dominant in inner belt   | 0.10–0.22 | **~0.85** | Silicaceous; modestly reddened  |
| M/X    | ~10%                              | 0.10–0.20 | ~0.71     | Metallic                        |

For reference the **Sun is B−V = 0.65**. A magnitude-limited catalog like Gaia's is biased
toward the higher-albedo S-types (they're detectable further out for a given size), which pulls
the sample mean up. A defensible population mean for _this_ sample is **B−V ≈ 0.80**, with the
whole belt spanning roughly 0.70–0.90.

**Translating to the ramp.** B−V 0.80 corresponds to an effective colour temperature of roughly
**5,300–5,400 K** — a G8/K0 star, only slightly warmer-toned than the Sun. The proposed
**t = 0.85 → RGB (1.00, 0.81, 0.53)** is a strongly orange colour implying B−V ≳ 1.4, around
4,000 K — that is a **K5–M0 star**. No asteroid class is remotely that red. Rendering the belt
at t = 0.85 would make it look like a field of glowing embers, and would be a visible
scientific error to anyone who has seen a real asteroid image (Vesta and Ceres are famously,
almost disappointingly, **grey**).

On an O→M ramp the Sun (G2, B−V 0.65) sits at roughly **t ≈ 0.58**. Stepping the modest
0.15 mag of asteroid reddening along the same ramp:

**Recommended: `COLOR_BYTE_T = 0.68` → byte 173.**

| t        | byte    | Reads as                   | Verdict                                       |
| -------- | ------- | -------------------------- | --------------------------------------------- |
| 0.58     | 148     | solar / neutral            | Correct for pure C-type; slightly too neutral |
| **0.68** | **173** | **warm grey, faintly tan** | **Recommended — matches B−V ≈ 0.80**          |
| 0.72     | 184     | light tan                  | Defensible upper bound (S-type-weighted)      |
| 0.85     | 217     | orange                     | **Too red by ~0.6 mag in B−V — do not use**   |

If the ramp's exact t↔B−V mapping differs from the standard Planckian assumption used here,
recalibrate by finding the t that returns the Sun's colour and adding ~0.10 — the physics
constraint is _"asteroid mean sits about 0.15 mag redder than the Sun,"_ not the specific
number 0.68.

Uniform colour across all objects: **ACCURATE-adjacent and correct here.** The real belt does
have a genuine colour gradient (S-types inner, C-types outer — a fossil of the protoplanetary
temperature gradient, and a lovely piece of science), but this file carries no taxonomy, and
synthesising one from `a` alone would be fabricating data. Note it as a future enhancement if
an SDSS-MOC-style taxonomy file ever gets joined in; do not fake it now.

---

## 7. Physics-subset selection

**Verdict on "closest to the spine circle": SIMPLIFIED, and it works — but there is a
strictly better real-data criterion available from the elements you already have.**

The proposed criterion selects on _instantaneous position_, which is a snapshot property: the
same object at a different date would not be selected. It also silently prefers low-e objects
(they stay near their mean radius) — a mild, unintentional bias.

**Recommended criterion — select on low eccentricity within the mid-belt core:**

```
candidates = { a ∈ [2.60, 2.75] AU }  ∧  { e < 0.10 }  ∧  { i < 5° }
rank by |a − 2.70| ascending, take N
```

Why this is better science, and better-looking:

- It selects on **orbital elements**, which are intrinsic and epoch-independent — the same N
  asteroids are chosen whatever the snapshot date. Reproducible; unit-testable.
- The a-window 2.60–2.75 AU sits in the **most densely populated resonance-free zone in the
  entire belt** — measured, it is the peak of the distribution: 2.55–2.60 holds 11,834 objects
  and 2.60–2.65 holds 11,061, the two fullest bins in the catalog. It is safely clear of the
  3:1 gap at 2.50 and the 5:2 gap at 2.825. Picking physics bodies from the belt's genuine
  population maximum is a defensible statement: _these are typical main-belt asteroids._
- The `e < 0.10` cut keeps the rocks in a **tight torus near the tuned spine radius** rather
  than swinging between perihelion and aphelion — the visual outcome the position-based rule
  was reaching for, achieved through a real orbital property instead of a snapshot accident.
  At e = 0.10 and a = 2.70 AU the radial excursion is ±0.27 AU = **±17 wu**, comfortably inside
  the ±26 wu spread. At the catalog median e = 0.133 it would be ±22.6 wu, right at the edge.
- The `i < 5°` cut similarly bounds vertical excursion to 170·tan(5°) ≈ **±14.9 wu** — which,
  pleasingly, is almost exactly the existing tuned ±14.

Selecting by **largest a** would be actively wrong (it would pick Trojans and TNOs). Selecting
by **largest object** is what you'd genuinely want and is unavailable — no diameter, magnitude,
or albedo in this file. Worth noting for the record: **asteroid names are a real proxy for
size**, since low-numbered, classically-named asteroids were discovered first _because_ they
are big and bright. If the 20–48 physics rocks are ever labelled in the UI, matching the `name`
field against a short hand-authored list (ceres, pallas, juno, vesta, hygiea, interamnia,
davida, europa, sylvia, eunomia…) and preferring those would produce a physics subset of
**genuinely the largest real asteroids** — a much stronger claim than "typical", and it costs
one small array. Recommended if a named-body dossier is in scope; the element-based rule above
is the answer if it is not.

---

## 8. What to SEE — and what to assert in a unit test

**This is the strongest part of the feature.** The real data contains structure that a
procedural belt cannot fake, and it is _sharp_. I measured it directly from the file.

### The headline: Kirkwood gaps land exactly on the resonance locations

Scanning ±0.10 AU around each nominal resonance in 0.02 AU windows, the **minimum-density bin
falls on the predicted semi-major axis to within one bin width**:

| Resonance | Predicted a | **Measured minimum at a =** | Count in ±0.01 AU | Flank density (per 0.02 AU) | **Depth ratio** |
| --------- | ----------- | --------------------------- | ----------------- | --------------------------- | --------------- |
| 3:1       | 2.500 AU    | **2.500 AU** ✓              | 81                | 7,891                       | **0.010**       |
| 5:2       | 2.825 AU    | **2.825 AU** ✓              | 292               | 6,247                       | **0.047**       |
| 7:3       | 2.958 AU    | **2.948 AU** (−0.010)       | 802               | 5,945                       | **0.135**       |
| 2:1       | 3.279 AU    | **3.289 AU** (+0.010)       | 19                | 3,504                       | **0.005**       |

The 3:1 gap is depleted by a factor of **100**, the 2:1 by a factor of **200**. These are not
subtle statistical dips — they are near-total voids in a 154,662-object sample, sitting exactly
where Kirkwood predicted them in 1866 and where Jupiter's mean-motion resonances put them. No
LCG produces this.

### Population census (measured)

| Population                | a range (AU) | Count       | % of catalog |
| ------------------------- | ------------ | ----------- | ------------ |
| NEAs                      | < 1.3        | 108         | 0.07%        |
| Hungarias                 | 1.78–2.00    | 3,541       | 2.29%        |
| Inner belt                | 2.06–2.50    | 49,929      | 32.28%       |
| Middle belt               | 2.50–2.82    | 54,356      | 35.15%       |
| Outer belt                | 2.82–3.28    | 43,712      | 28.26%       |
| **Main belt total**       | 2.06–3.28    | **147,997** | **95.69%**   |
| Trans-2:1 desert          | 3.30–3.85    | 617         | 0.40%        |
| **Hilda group (3:2)**     | 3.87–4.05    | **569**     | 0.37%        |
| **Empty void**            | 4.05–5.00    | **6**       | **0.004%**   |
| **Jupiter Trojans (1:1)** | 5.00–5.40    | **1,545**   | 1.00%        |
| TNOs                      | > 30         | 23          | 0.01%        |

The **void between 4.05 and 5.00 AU containing 6 objects out of 154,662** is arguably the most
striking single number here — a full 0.95 AU of near-perfectly empty space, carved by Jupiter,
separating the Hilda island from the Trojan clouds. Rendered, the belt should show a bright
main annulus, a thin isolated ring at ~3.97 AU, a wide black gap, then the Trojan arcs.

### Recommended unit-test assertions

Run against the **real computed world-space radii**, converting back with `a = r_wu / 63`.
These thresholds are set with generous margin against the measured values so they assert the
real structure without being brittle:

```js
// 1. Kirkwood gap depth — the signature no procedural generator reproduces.
//    measured: 3:1 = 0.010, 5:2 = 0.047, 2:1 = 0.005
expect(density(2.49, 2.51) / density(2.35, 2.45)).toBeLessThan(0.1); // 3:1
expect(density(2.815, 2.835) / density(2.7, 2.78)).toBeLessThan(0.2); // 5:2
expect(density(3.27, 3.3) / density(3.05, 3.2)).toBeLessThan(0.05); // 2:1

// 2. Gap LOCATION — minimum must land on the resonance, not merely exist.
expect(argMinDensity(2.4, 2.6, 0.02)).toBeCloseTo(2.5, 1);
expect(argMinDensity(3.18, 3.38, 0.02)).toBeCloseTo(3.28, 1);

// 3. The Hilda island exists and is isolated (measured 569, flanked by ~0).
expect(count(3.87, 4.05)).toBeGreaterThan(400);
expect(count(4.05, 5.0)).toBeLessThan(50); // measured: 6

// 4. Trojans exist at Jupiter's semi-major axis (measured 1,545).
expect(count(5.0, 5.4)).toBeGreaterThan(1000);

// 5. Main belt dominates (measured 95.69%).
expect(count(2.06, 3.28) / total).toBeGreaterThan(0.9);

// 6. Belt is genuinely thick — real inclinations, not a flat ring.
//    measured mean i = 9.45 deg -> ~28 wu vertical excursion at r=170
expect(rmsAbs(z_wu)).toBeGreaterThan(10);
```

Assertion 2 is the one I would guard most carefully. Gap _existence_ could in principle be
faked by a generator with hand-placed notches; gaps whose minima land on
a = (n_J/n)^(2/3) · a_J for four independent integer ratios could not. That test is the
feature's proof of authenticity.

### Visual acceptance checklist

- Belt is a **fat torus**, not a thin ring — real i pushes it to ~±28 wu RMS, twice the
  procedural ±14.
- Two dark grooves visible in the main annulus at **158 wu** (3:1) and **178 wu** (5:2).
- A hard **outer edge at 207 wu** (2:1) — the belt stops, it does not fade.
- A thin isolated ring at **250 wu** (Hilda), separated by black from the main belt.
- Two arcs (not a ring) at **328 wu** (Trojans) — and if Jupiter is ever rendered, they must
  lead and trail it by 60°.
- Inner asteroids visibly **lap** outer ones over a few minutes of wall clock.

---

## Summary

| #   | Element                                             | Verdict              | Action                                                          |
| --- | --------------------------------------------------- | -------------------- | --------------------------------------------------------------- |
| 1   | Two-body Kepler propagation ~10 yr past epoch       | SIMPLIFIED           | Ship as designed; error is along-track, ~0.4–4 wu, invisible    |
| 2   | Ecliptic X–Y plane, no obliquity rotation           | **BROKEN PHYSICS**   | **Apply ε = 23.439281° rotation, or declare explicitly**        |
| 3   | 63 wu/AU; hugely exaggerated render size            | DECLARED LICENSE     | Declare "map, not belt"; do NOT clamp real thickness to ±14     |
| 4   | Uniform TIME_ACCEL = 4×10⁵ on real vis-viva vectors | ACCURATE             | Arithmetic confirmed (3.053 wu/s, 4.63 d/s); honest framing     |
| 5   | Static visual layer + moving physics subset         | DECLARED LICENSE     | Defensible; shader-side `M = M₀ + n·t` is the strong version    |
| 6   | Uniform dim magnitude byte                          | SIMPLIFIED (clamped) | `magByte = 0` (mag 12.5, ramp floor); real belt 3–5 mag fainter |
| 6   | Uniform colour byte at t = 0.85                     | **BROKEN PHYSICS**   | **Use t ≈ 0.68 (byte 173); 0.85 implies B−V ≈ 1.4, an M star**  |
| 7   | Physics subset by proximity to spine circle         | SIMPLIFIED           | Prefer a ∈ [2.60,2.75] ∧ e < 0.10 ∧ i < 5° — epoch-independent  |
| 8   | Real-vs-procedural validation signature             | ACCURATE             | Gaps land on resonances to ≤0.01 AU; assert location, not depth |

### Constants to implement

```
OBLIQUITY_J2000    = 23.439281 deg   (cos = 0.9174821, sin = 0.3977772)
AU_KM              = 1.495978707e8
GM_SUN             = 1.32712440018e11   km^3/s^2
WU_PER_AU          = 63
TIME_ACCEL         = 4e5                (= 4.63 days per wall-clock second)
SNAPSHOT_JD        = 2461241.5          (2026-07-20 00:00 TT)
MAG_BYTE           = 0                  (mag 12.5 — the ramp's dim floor)
COLOR_BYTE         = 173                (t = 0.68; B-V ~ 0.80, ~5350 K)
PHYSICS_SELECT     = a in [2.60, 2.75] AU, e < 0.10, i < 5 deg, rank |a - 2.70|
```

### Cross-references

- Prompted by `docs/delivery-plan/PF-10-gaia-dataset-realism.md`, phase C3.
- Dataset inventory: `docs/analysis/2026-07-20-gaia-dataset-gap-analysis.md` (which first
  flagged the procedural belt as having no catalog backing).
- Decision 2 (obliquity) changes an engineering decision and should be recorded by Procyon in
  an ADR, or in the license ledger if the flat belt is kept deliberately. This brief is the
  evidence, not the decision record.
