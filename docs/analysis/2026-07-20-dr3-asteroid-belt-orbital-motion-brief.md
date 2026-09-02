# Science Brief — animating the DR3 asteroid belt: radius-derived Keplerian shear in the vertex shader

**Date:** 2026-07-20
**Mode:** SCIENCE-BRIEF (addendum) with per-decision REALISM-AUDIT verdicts
**Requested by:** Procyon, for PF-10 phase C3 follow-up — animating the 154,662-object visual
layer that TR-074 Part 6 shipped as a static snapshot.

**Supersedes nothing.** This is an addendum to
[`2026-07-20-dr3-asteroid-belt-science-brief.md`](2026-07-20-dr3-asteroid-belt-science-brief.md),
whose decision 5 named shader-side animation as "the strong version" of this feature and left
it unbuilt. That brief's verdicts stand unchanged. This document evaluates the specific
approach now proposed, and also answers a separate data question about the trojan/NEA packs
(section 8).

All numbers below were **computed from the real 150.7 MB catalog and the real shipped physics
module**, not recalled. Scripts and raw output are reproducible from the derivations shown.

---

## 0. Headline

**The proposed approach is sound, and it is better than the request feared.** The worry in the
request — that deriving ω from the instantaneous radius instead of the semi-major axis would
mis-rate eccentric orbits by (1−e)^−3/2, i.e. **+24% at the catalog median eccentricity** — rests
on comparing against the wrong quantity. Compared against a real asteroid's _actual instantaneous
angular rate_, the error is:

```
ω_shader / ω_true  =  1 / √(1 + e·cos ν)
```

which at the measured median e = 0.1334 spans **−6.1% at perihelion to +7.4% at aphelion** — about
a third of the feared magnitude, and centred on zero rather than biased. The r^−3/2 law is not a
crude stand-in for the real rate; it is a genuinely good approximation to it, because both the real
rate and the model fall with radius and the difference between r^−3/2 and the true r^−2 is small
across the range an individual orbit actually samples.

One correction to the proposed constant (section 7), one cheap refinement worth taking
(section 2.3), and one honest new claim the animation earns (section 5).

| #   | Element                                           | Verdict                     | Action                                                             |
| --- | ------------------------------------------------- | --------------------------- | ------------------------------------------------------------------ |
| 1   | ω derived from instantaneous r, not from a        | **SIMPLIFIED**              | Ship it. Ensemble-exact; per-speck median error 4.9° per 60 s      |
| 2   | Rigid rotation about world Z (r and z preserved)  | **SIMPLIFIED**              | Ship it. Discards radial breathing + vertical bob; both incoherent |
| 2.3 | Rate law fed by `length(position.xy)`             | **SIMPLIFIED (improvable)** | Use the true heliocentric radius — free, removes a 189% tail       |
| 3   | Prograde (CCW about +Z) for the whole catalog     | **ACCURATE**                | Confirmed: 0 retrograde in 154,662; 64/64 shipped bodies L_z > 0   |
| 4   | Differential shear / winding over a session       | **ACCURATE**                | This is real physics, not an artefact. Kirkwood gaps exactly safe  |
| 4b  | Jupiter Trojan clumps smear under the model       | **DECLARED LICENSE**        | 2.2°/min. Invisible at 60 s, real at 30 min. Declare, don't fix    |
| 5   | New honest claim: Keplerian differential rotation | **ACCURATE**                | Claim it. It is the mechanism that makes belts axisymmetric        |
| 6   | Visual layer vs Havok subset consistency          | **ACCURATE**                | Max 1.74° divergence over 60 s — no visible tearing                |
| 7   | K = 39.807                                        | **off by 0.041%**           | Use **K = 39.8234**, or better, derive it (section 7)              |

---

## 1. Deriving ω from the instantaneous radius

**Verdict: SIMPLIFIED — and ensemble-exact, which is the property that matters here.**

### 1.1 The analytic result

For a real Keplerian orbit the instantaneous rate of change of true anomaly is

```
dν/dt = h / r²        where   h = √(GM · a(1 − e²)) = √(GM · p)
```

The shader instead applies

```
ω_shader = √(GM) · r^(−3/2)
```

Taking the ratio, and substituting the orbit equation r = p/(1 + e·cos ν):

```
ω_shader     √(GM)·r^(−3/2)      r^(1/2)         ⎧ r ⎫^(1/2)          1
────────  =  ───────────────  =  ───────  =  ⎪ ─ ⎪          =  ───────────────
ω_true       √(GM·p) / r²          √p           ⎩ p ⎭            √(1 + e·cos ν)
```

**The error depends only on eccentricity and orbital phase — not on a, not on GM, not on the
scale factor.** That is a clean, checkable result, and it is much kinder than the request's
estimate:

| e (catalog landmark) | at perihelion | at aphelion | naive (1−e)^−3/2 estimate |
| -------------------- | ------------- | ----------- | ------------------------- |
| 0.0176 (1st pct)     | −0.87%        | +0.89%      | +2.7%                     |
| **0.1334 (median)**  | **−6.07%**    | **+7.42%**  | +24.0%                    |
| 0.1393 (mean)        | −6.31%        | +7.79%      | +25.2%                    |
| 0.3221 (99th pct)    | −13.03%       | +21.46%     | +79.2%                    |
| 0.50 (0.4% of cat.)  | −18.35%       | +41.42%     | +182.8%                   |

The naive estimate compares ω(r) against the _mean_ motion n, but n is not what a real asteroid's
angular rate is at any instant except twice per orbit. Against the real rate, the r^−3/2 law
recovers most of the variation and errs by a factor that averages to ≈ 1 over an orbit.

### 1.2 What it costs over a real viewing session — measured

Analytic bounds are not the same as what a viewer sees, so this was measured directly: for real
main-belt objects (2.06–3.28 AU, n = 147,997), solve the true Kepler orbit forward by
**277.8 simulated days** (60 s of wall clock at TIME_ACCEL = 4×10⁵), take the planar longitude
actually swept, and compare against the angle the shader would rotate that vertex through.

**Angular error, degrees of longitude, after 60 s of wall clock:**

| Eccentricity bucket | N      | median \|err\| | p90 \|err\| | max \|err\| |
| ------------------- | ------ | -------------- | ----------- | ----------- |
| e < 0.05            | 4,000  | 1.28°          | 3.15°       | 12.73°      |
| 0.05 – 0.10         | 4,000  | 3.05°          | 6.31°       | 14.61°      |
| 0.10 – 0.15         | 4,000  | 5.34°          | 10.64°      | 22.15°      |
| 0.15 – 0.20         | 4,000  | 7.61°          | 15.25°      | 29.72°      |
| 0.20 – 0.30         | 4,000  | 10.21°         | 21.40°      | 45.58°      |
| e > 0.30            | 2,510  | 13.56°         | 34.44°      | 507.65°     |
| **All**             | 22,510 | **4.89°**      | **16.28°**  | 507.65°     |

For scale, the **true** swept angle over the same 60 s runs from 19.5° to 217.9° with a median of
**61.5°**. So the median speck ends up about **8% of its own travel** away from where the real
asteroid would be — a few degrees of longitude, in a ring 154,662 specks deep, where no individual
speck is identifiable and nothing else in frame marks absolute longitude.

The 507° outlier is a high-e object that completes extra revolutions; there are a few hundred such
objects and they are lost in the cloud, exactly as the parent brief's decision-1 analysis found for
along-track propagation error.

### 1.3 Why the belt still _looks_ right — and the differential shear survives intact

The decisive property: **rotation about Z preserves each vertex's r and z exactly.** The rendered
radial density profile and the rendered vertical profile are therefore **time-invariant by
construction, to machine precision, forever.** Every structural feature a viewer can perceive —
the ring's inner and outer edges, its thickness, the Kirkwood gaps, the Hilda island, the 4.05–5.00
AU void — is a function of r and z only, and none of them move.

That is a stronger guarantee than reality provides. Measured on the _true_ orbits, the ensemble
radial histogram (100–300 wu in 5 wu bins) drifts by up to **10.1% per bin** over the same 60 s, as
individual asteroids breathe in and out of adjacent bins. The model is if anything _over_-stable —
an honest, minor over-simplification in the direction of visual calm, worth one line in the ledger.

And the differential shear — the real, visible thing — survives completely, because it is a
function of r and the model's rate law is exact in r. Section 4 has the numbers.

**Recommendation: ship it.** Do not spend a per-vertex float on the real mean motion. It would buy
a median 4.9° of per-speck longitude accuracy that nothing in the scene can reveal, at ~2.5 MB and
a change to a shader four other layers depend on.

---

## 2. What rigid rotation about world Z discards

**Verdict: SIMPLIFIED. The discarded motion is real and substantial, and its absence is
unobservable for a population reason.**

### 2.1 What is lost, quantified

Real motion on an inclined eccentric orbit changes all three of r, θ and z. The model changes only
θ. Measured over 60 s of wall clock on real main-belt orbits:

| Quantity discarded      | median  | p90     | max      | for scale                     |
| ----------------------- | ------- | ------- | -------- | ----------------------------- |
| radial breathing \|Δr\| | 13.4 wu | 31.4 wu | 126.6 wu | belt radial half-width ~26 wu |
| vertical bob \|Δz\|     | 13.1 wu | 36.4 wu | 111.3 wu | belt vertical RMS ~28 wu      |

These are **not small**. The median discarded radial excursion is half the belt's radial
half-width. A single asteroid, tracked, would visibly be doing the wrong thing.

### 2.2 Why it does not matter at these scales

Because the discarded motion is **incoherent across the population**. Each asteroid breathes and
bobs at its own orbital phase, set by its own M₀, ω and Ω — 154,662 independent phases. The
ensemble sum of 154,662 out-of-phase oscillations is a _stationary distribution_: the belt's radial
and vertical density profiles do not oscillate even though every member of it does. That is
precisely why the real main belt is a steady structure rather than a pulsating one.

So the model discards motion that is real per-object and null per-ensemble. For a dust field of
sub-pixel specks with no trackable individuals, the ensemble is the entire observable. The one
context where it would show is a **close pass with a speck held in view long enough to track**,
which the additive-billboard rendering at magnitude-floor brightness does not really support.

**Verdict SIMPLIFIED, not DECLARED LICENSE** — the model shows the right phenomenon (Keplerian
motion) at reduced per-object fidelity, rather than something knowingly unphysical.

### 2.3 The one cheap correction worth making

There is exactly one, and it is nearly free: **feed the rate law the true heliocentric distance
rather than the planar projection.**

The proposal uses `r = length(position.xy)`. But an asteroid's orbital speed is set by its actual
distance from the Sun, and for an inclined orbit `length(position.xy)` understates that — which
makes the shader run it _too fast_. Measured across all 154,662 objects at the snapshot:

| Rate overestimate from using r_xy | value             |
| --------------------------------- | ----------------- |
| median                            | +0.47%            |
| p90                               | +4.04%            |
| p99                               | +14.42%           |
| p99.9                             | +27.12%           |
| **max**                           | **+189.10%**      |
| objects with > 5% error           | **11,074** (7.2%) |
| objects with > 20% error          | **471**           |
| i > 40° subset (n = 94), median   | +24.14%           |

The fix, given the belt plane is offset to z = −13 (so the Sun as focus sits at world (0, 0, −13)):

```glsl
// WGSL / GLSL twins — identical identifiers
let rPlanar : f32 = length(position.xy);                       // radius of the traced circle
let rHelio  : f32 = length(vec3(position.xy, position.z + 13.0)); // true heliocentric distance
let omega   : f32 = K * pow(rHelio, -1.5);
// then rotate by omega * t about world Z, at radius rPlanar
```

One add and one extra component in a `length()` — no new attribute, no new uniform beyond the
existing offset constant. It removes the entire high-inclination tail, and it makes K exactly
√(GM) with no compensating fudge, which matters for section 7. **Recommended.**

Note the two radii play different roles and that is correct, not a bug: the rate is set by how far
the asteroid is from the Sun; the circle it traces is set by its distance from the rotation axis.

---

## 3. Direction of motion

**Verdict: ACCURATE. Prograde — counter-clockwise seen from ecliptic north (+Z) — is right for
the entire catalog, with zero exceptions.**

Confirmed three independent ways.

**(a) Measured across the full catalog.** Streaming all 154,662 records:

```
objects with inclination > 90° (retrograde):     0
objects with inclination > 40°:                 94
maximum inclination in the catalog:         72.156°
```

Both auxiliary packs likewise: 0 retrograde in the 1,544 Trojans, 0 in the 392 NEAs. The request's
recollection of max i = 72.16° is confirmed exactly.

**(b) It is expected.** Retrograde asteroids exist — (514107) Ka'epaoka'awela at i ≈ 163° is the
famous main-belt-adjacent case, and there is a small population of retrograde Centaurs and damocloids
— but they are extraordinarily rare, mostly faint, mostly outside the main belt, and there is no
reason for a Gaia DR3 astrometric solution sample dominated by bright main-belt objects to contain
any. It contains none.

**(c) Verified against the shipped data itself.** For each of the 64 real Havok bodies in
`src/data/asteroids-dr3-physics.ts`, the z-component of the specific angular momentum
L_z = x·v_y − y·v_x was computed from the real position and real velocity vectors:

```
records: 64    L_z > 0 (counter-clockwise about +Z): 64    L_z < 0: 0
```

So the sense the shader must use is the same sense the already-shipped physics layer moves in,
confirmed from the shipped file rather than assumed. **Rotate by +ω·t in the standard
right-handed sense about +Z:**

```
x' = x·cos(ω t) − y·sin(ω t)
y' = x·sin(ω t) + y·cos(ω t)
```

If the belt is ever rendered with a camera below the ecliptic plane it will correctly appear to
turn clockwise; that is not an error.

---

## 4. Shear, winding, and whether the belt tears itself apart

**Verdict: ACCURATE. The winding is real physics, and the belt has almost nothing for it to
wind.**

### 4.1 The measured shear

Using the recommended K = 39.8234, over **60 s of wall clock**:

| Location                 | r (wu) | ω (rad/s) | rotation in 60 s | lag behind inner edge |
| ------------------------ | -----: | --------: | ---------------: | --------------------: |
| inner edge, 2.06 AU      |  129.8 |  0.026936 |        **92.6°** |                  0.0° |
| 3:1 Kirkwood, 2.50 AU    |  157.5 |  0.020147 |            69.3° |                 23.3° |
| spine, 2.70 AU           |  170.1 |  0.017951 |        **61.7°** |                 30.9° |
| 5:2 Kirkwood, 2.825 AU   |  178.0 |  0.016773 |            57.7° |                 34.9° |
| 2:1 outer edge, 3.28 AU  |  206.6 |  0.013407 |        **46.1°** |             **46.5°** |
| Hilda island, 3.97 AU    |  250.1 |  0.010068 |            34.6° |                 58.0° |
| Jupiter Trojans, 5.20 AU |  327.6 |  0.006716 |            23.1° |                 69.5° |

So over a one-minute look the belt turns through roughly **a sixth of a revolution at the spine**,
and the inner edge gains **46.5° of longitude on the outer edge**. That is emphatically visible —
it is a quarter-turn of relative twist inside the main annulus, in one minute — and it is the
correct amount. This is the most valuable thing the animation buys.

Full 360° relative wrap, inner edge vs outer edge: **464 s = 7.7 minutes** of wall clock.

### 4.2 Does it look wrong? No — because there is nothing to wind

The concern in the request is well-posed and is the classic **winding problem** of galactic
dynamics: a differentially-rotating disc shears any coherent feature into an ever-tighter spiral,
which is why spiral arms cannot be material structures. It absolutely applies here.

But it applies to _azimuthal_ structure, and this belt has essentially none:

- **The Kirkwood gaps are radial. They are exactly invariant.** Confirmed by construction, and this
  is worth stating precisely, because it is the single strongest guarantee in this design. A gap is
  a deficit of objects at particular radii. Rotation about Z maps every vertex to a new azimuth at
  **identical r**. The set of radii present in the scene is therefore literally unchanged, frame to
  frame, for all time. The 3:1 groove at 157.5 wu, the 5:2 at 178.0 wu, the hard 2:1 edge at 206.6
  wu, the Hilda ring at 250.1 wu and the 4.05–5.00 AU void neither blur, drift, fill in, nor sharpen.
  They cannot. The request's reasoning is correct.
- **The main belt is axisymmetric in mean anomaly.** Its longitudes are uniformly populated across
  154,662 objects, and a uniform distribution sheared by any radius-dependent rate remains uniform.
  There is no pattern to smear.
- **The belt does not "tear apart"** in any visible sense, because tearing requires a feature to
  separate. The main annulus is a continuum; its inner and outer parts slide past each other, which
  is exactly what a real belt does and exactly what a viewer should see.

### 4.3 The one exception, honestly named

**The Jupiter Trojans.** 1,545 objects clumped at L4/L5 are genuine azimuthal structure, and the
model has no mechanism to hold them there — under rigid-r rotation they shear at their internal
spread of semi-major axes:

```
Trojan a range 5.044 – 5.375 AU  →  Δω · 60 s = 2.20° per minute
                                 →  a 60°-wide clump smears through 60° in 27.3 minutes
```

Over a 60-second session: **2.2°, invisible.** Over a ten-minute session: ~22°, a noticeably
looser clump. Over half an hour the two arcs begin merging toward a ring.

This is a slow, graceful degradation rather than a glitch, and the real physics it omits (libration
about the L4/L5 equilibria, which is what actually confines Trojans) is not expressible in a rate
law with no per-object data. Two things follow:

1. **Declare it:** _"Trojan clumps are confined only by their initial positions; under the
   radius-derived rate law they shear apart over tens of minutes, because L4/L5 libration is not
   modelled."_
2. If Jupiter is ever rendered, note the pleasant accident: Jupiter at 5.2 AU would move at
   **exactly the same ω** as the Trojans at 5.2 AU under this scheme, so the clumps would lead and
   trail it correctly at ±60° for as long as the internal spread stays tight. That is a real,
   free win for the first several minutes, and it degrades at 2.2°/min thereafter.

### 4.4 The visual layer will not tear away from the Havok rocks

This deserves its own check, because it is the one place a viewer _can_ directly compare the model
against real physics: the 64 Havok bodies move on genuine Keplerian solutions, and animated specks
will be sitting right next to them.

For each of the 64 shipped bodies, the shader's ω at that body's own radius was compared against
the body's true instantaneous angular rate derived from its real velocity vector:

```
relative rate error:  min −0.78%   median +0.79%   max +2.95%
angular divergence over 60 s of wall clock:  median 0.49°   max 1.74°
```

**Under 2° of drift in a minute**, between a real Havok rock and the specks around it. Not
perceptible. This is a consequence of the physics subset's own selection cut (e < 0.10, i < 5°),
which the parent brief chose for unrelated reasons and which happens to be exactly the regime where
the r^−3/2 law is most accurate — a genuine piece of luck worth recording.

---

## 5. What the animation now shows that the snapshot did not

**Verdict: ACCURATE. There is a real, non-stretched claim here, and it is a good one.**

The honest claim is **Keplerian differential rotation** — and specifically, that the belt is
visibly _not a solid disc_.

This is not a decorative distinction. It is the defining dynamical property of every
gravitationally-bound disc in the universe:

- **It is directly visible now and was not before.** The static snapshot rendered real orbital
  _elements_; it could not render the _relation between them_. Kepler's third law, n ∝ a^−3/2, is a
  statement about rates, and rates require motion. A viewer watching the inner belt gain 46.5° on
  the outer belt in one minute is watching Kepler's third law happen — the same law, unmodified,
  that fixes the belt's radii. The animation turns a static structural fact into an observable
  dynamical one.

- **It is the mechanism that explains the belt's own appearance.** Why is the main belt a smooth
  axisymmetric annulus with no clumps, when it was assembled from a chaotic collisional history and
  is still producing collisional families today? Because differential rotation shears any clump into
  a full ring in a few orbits. The animated scene shows the process; the snapshot showed only its
  end state. That is a genuinely explanatory piece of science, and it is exactly the winding
  behaviour section 4.2 discusses — the "problem" is the phenomenon.

- **It is the same physics as Saturn's rings and accretion discs.** Differential rotation is what
  drives viscous transport in accretion discs, what maintains the ring gaps around shepherd moons,
  and what forbids material spiral arms in galaxies. A belt that visibly shears is a demonstration
  of all of it.

- **The gaps' stability under shear is itself the point.** The Kirkwood gaps survive the shearing
  untouched precisely because resonant depletion acts on semi-major axis, which shear does not
  change. A viewer sees structure that persists while everything flows past it — which is the real
  reason those gaps have lasted for the age of the solar system.

**Suggested claim text, all of which is true:** _"All 154,662 asteroids orbit in real time at their
real Keplerian rates — inner asteroids lap outer ones by 46° per minute at ×400,000 time
acceleration. The Kirkwood gaps hold their radii while the belt shears past them, which is why they
have survived four billion years."_

What **not** to claim: that individual asteroids are on their correct orbits (they are on
circularised orbits at their snapshot radius, section 2); that the belt's structure evolves (it is
stationary by construction, section 1.3); or that Trojans are dynamically confined (section 4.3).

---

## 6. Reduced motion

Not raised in the request, but this repo's non-negotiable 24 makes it a design-time obligation:
`prefers-reduced-motion` composes with every quality tier and every visual feature.

A belt whose every speck rotates is a large-field continuous motion — precisely the class this
contract exists for. **Recommend: under `prefers-reduced-motion`, freeze `t` at 0**, which returns
exactly the static snapshot TR-074 already shipped and validated. That is a zero-risk fallback: the
reduced-motion path is a state the scene has already been proven in, not a new one.

---

## 7. The constant K

**Verdict: the proposed 39.807 is off by 0.041%. Use K = 39.8234 — but better, derive it.**

### 7.1 Where the discrepancy comes from

The proposal round-trips through a measured speed: K = 0.0179588 × 170^1.5. That mixes two
inconsistent radii — the speed 3.053 wu/s belongs to a **2.7 AU orbit, which is 2.7 × 63 = 170.1
world units**, not 170.0. The 0.1 wu of slop propagates as a −0.041% rate error.

### 7.2 The closed form

K is not an empirical constant. It is √(GM_☉) expressed in world units, multiplied by the time
acceleration:

```
KM_PER_WU = AU_KM / WU_PER_AU
          = 1.495978707e8 / 63
          = 2.3745693762e6 km

GM_WU     = GM_SUN / KM_PER_WU³
          = 1.32712440018e11 / (2.3745693762e6)³
          = 9.9119030687e-9  wu³/s²

GM_EFF    = GM_WU × TIME_ACCEL²        (time rescaling ⇒ GM scales as k²)
          = 9.9119030687e-9 × (4e5)²
          = 1585.904491  wu³/s²

K         = √(GM_EFF) = 39.823416
```

The TIME_ACCEL² factor is the same scale-invariance argument the parent brief's decision 4 used:
rescaling t → t/k at fixed lengths leaves every orbit a valid orbit of a system with GM scaled by
k². The scene shows undistorted orbits of a more massive Sun.

**Sanity check at the spine:**

```
r = 2.7 × 63 = 170.1 wu
ω = 39.823416 × 170.1^(−3/2) = 0.0179507 rad/s
v = ω · r = 3.05342 wu/s
```

against TR-074's independently re-derived Havok velocity for the real object `heco`
(a = 2.700156 AU): **3.0532 wu/s.** Agreement to 5 significant figures, from two calculations that
share no code path.

### 7.3 Preferred formulation

**Do not hard-code 39.8234.** Derive it, for the same reason TR-074's unit tests exist: the
constants `WU_PER_AU`, `TIME_ACCEL` and the snapshot mapping are duplicated across
`scripts/lib/asteroid-kepler.mjs` and the TS runtime, and a magic 39.8234 would silently desynchronise
if any of them were ever retuned.

```ts
// Kepler's third law constant for the shader's radius-derived orbital rate.
// omega(r) = KEPLER_K * r^(-3/2), r in world units, omega in rad/s of WALL CLOCK.
// This is sqrt(GM_sun) expressed in world units and scaled by the time acceleration —
// not a tuned value. Retuning AU_TO_WORLD or TIME_ACCEL updates it automatically.
export const KEPLER_K =
  TIME_ACCEL * Math.sqrt(GM_SUN_KM3_S2 / (AU_KM / AU_TO_WORLD) ** 3); // = 39.823416
```

and assert it in the existing constants test:

```js
expect(KEPLER_K).toBeCloseTo(39.8234, 3);
// the property that actually matters: the shader rate must reproduce the shipped Havok speed
expect(KEPLER_K * Math.pow(2.7 * 63, -1.5) * (2.7 * 63)).toBeCloseTo(3.0534, 3);
```

That second assertion is the valuable one — it pins the shader's rate law against the _independently
computed_ physics-layer velocity, so the two layers cannot drift apart silently. Section 4.4's
1.74°/60 s consistency result is only true while that holds.

### 7.4 Would a different formulation be better?

No. Considered and rejected:

- **Per-vertex mean motion n.** Fully correct per object, but ~2.5 MB in a shared attribute for a
  median 4.9°/60 s accuracy gain that nothing in the scene can reveal (section 1.2). The cost/benefit
  is not close.
- **Encoding n in the spare bits of `starMeta.y`.** Tempting, but `starMeta` is shared with four
  other layers and quantising a rate into a few bits would produce visible _banding_ in the shear —
  discrete rings of specks moving in lockstep. That would look far worse than a smooth 5° error,
  and it would be a new artefact rather than an omission.
- **Solving Kepler in the vertex shader** (the parent brief's decision-5 option 3). Still the fully
  correct answer, still requires the per-vertex elements this constraint forbids. Off the table for
  the same memory reason, not for the iteration cost.
- **Rigid rotation of the whole cloud at one rate.** Already rejected in the parent brief for the
  right reason: it suppresses the differential shear, trading a true statement (frozen snapshot)
  for a false one (rigid belt). The proposed r^−3/2 law is strictly better than this and costs the
  same.

The radius-derived law is the correct choice under the stated constraint, and it is close to the
best achievable without per-vertex data.

### 7.5 Constants to implement

```
KEPLER_K        = 39.823416      derived; omega(r) = K * r^(-3/2), rad/s wall clock
BELT_PLANE_Z    = -13            heliocentric distance = length(vec3(pos.xy, pos.z + 13))
ROTATION_AXIS   = world +Z, right-handed positive sense (prograde, CCW from ecliptic north)
REDUCED_MOTION  = freeze t at 0  (returns exactly TR-074's validated static snapshot)
```

---

## 8. Separate data question — are the trojan and NEA packs subsets?

**Answer: yes, completely. Both are exact pre-filtered subsets of the main catalog. Merging them
would add zero objects and zero information.**

This was checked directly rather than inferred, by streaming
`catalog-asteroids-dr3/asteroids-dr3.json` (150.7 MB, 154,662 orbit-carrying records, 154,662
unique names — **no duplicate names in the main catalog**) and comparing every name and every
orbital element against the two small packs parsed in full.

| Pack                           | Records with orbit | Name found in main | Not in main | a/e/i **bit-identical** |
| ------------------------------ | -----------------: | -----------------: | ----------: | ----------------------: |
| `catalog-asteroids-dr3-trojan` |          **1,544** |   **1,544 (100%)** |       **0** |               **1,544** |
| `catalog-asteroids-dr3-nea`    |            **392** |     **392 (100%)** |       **0** |                 **392** |

**Real overlap count: 1,544 of 1,544 Trojans, and 392 of 392 NEAs. Overlap is 100.00% in both
cases, with the semi-major axis, eccentricity and inclination agreeing to floating-point
identity** (tolerances 1e−6 AU / 1e−9 / 1e−9 — every record passed). These are not
independently-derived solutions that happen to agree; they are the same records, re-serialised.

Notes on the counts, since three different numbers are in circulation:

- The trojan pack's `dataset.json` advertises `nobjects: 1545`. The file contains 1,545 records, of
  which the **first is the `OrbitalElementsGroup` container node** (`dr3-asteroids-jup_trojan-no_orbits`,
  position [0,0,0], no `orbit` block). 1,544 are actual asteroids. The main catalog holds **1,545**
  objects in a ∈ [5.0, 5.4] AU — the parent brief's figure — so the window count and the pack differ
  by one object, which is a boundary-definition difference, not a missing record.
- The NEA pack's `dataset.json` advertises `nobjects: 394` and describes "some 300 near Earth
  asteroids"; the file holds 393 records, one of them the container node, giving **392** asteroids.
- The parent brief's count of **108 NEOs** in the main catalog used the cut a < 1.3 AU. The NEA
  pack's real span is **a = 0.662 – 2.853 AU (median 1.587)**, because the actual NEA definition is
  on **perihelion distance q = a(1−e) < 1.3 AU**, not on a. So the packs disagree with that figure
  only because it was a different (and, for this purpose, wrong) selection criterion — not because
  the packs contain anything extra. All 392 are in the main catalog regardless.

### Recommendation

**Do not merge the packs. There is no data to gain.** The main catalog already contains every one
of these objects with identical elements, and the C3 pipeline already renders all 154,662.

The packs do carry one thing the main file does not: **a curated classification label.** Gaia Sky's
own NEA membership list is a better NEA definition than any threshold derived from a alone, and the
trojan list is authoritative L4/L5 membership rather than an a-window guess. If a future phase ever
wants to _colour or tag_ Trojans and NEAs distinctly — a legitimate and scientifically real
distinction, and one the parent brief noted the main catalog cannot supply — the right use of these
files is as **~1,936 name lookups (≈ 25 KB as a name list), not as extra geometry**. That is the
only value in them, and it is a real one.

TR-074's Part 6 entry (_"merging risks duplicates without a dedup pass"_) is hereby confirmed with
real counts: merging naively would create **1,936 exact duplicate objects**, and a dedup pass would
correctly reject all 1,936, leaving the catalog unchanged.

---

## Numbers appendix — method

- **Catalog stream:** all 154,662 orbit-carrying records read line-wise from the pretty-printed
  150.7 MB JSON; elements `epoch, meananomaly, semimajoraxis, eccentricity, argofpericenter,
ascendingnode, period, inclination`.
- **Propagation:** each object advanced from its own real epoch to SNAPSHOT_JD 2461241.5 by
  M = M₀ + n·Δt, Kepler's equation solved by Newton–Raphson to |ΔE| < 1e−14, then the standard
  perifocal → ecliptic rotation (argp → inclination → node). This reproduces the shipped `heco`
  position to the printed precision of `src/data/asteroids-dr3-physics.ts`, confirming the method
  matches the shipping pipeline.
- **Shear experiment:** true planar longitude swept over 277.8 simulated days, branch-unwrapped
  against the mean-anomaly advance, compared against K·r₀^(−3/2)·60 s. Stratified by eccentricity,
  4,000 objects per bucket, main belt only (2.06–3.28 AU).
- **Layer-consistency check:** the 64 shipped Havok records' real p and v vectors, true rate taken
  as L_z/r² = (x·v_y − y·v_x)/r².
- **Overlap check:** exact name-set intersection plus element comparison at 1e−6 / 1e−9 / 1e−9.

## Cross-references

- Parent brief: [`2026-07-20-dr3-asteroid-belt-science-brief.md`](2026-07-20-dr3-asteroid-belt-science-brief.md)
  — decision 5 named this feature; its verdicts are unchanged by this addendum.
- Implementation of record: [`../test-reports/TR-074.md`](../test-reports/TR-074.md) — Part 6
  ("What was NOT done") lists both the static visual layer and the unmerged trojan/NEA packs; this
  brief resolves the science for the first and closes the second.
- Delivery plan: [`../delivery-plan/PF-10-gaia-dataset-realism.md`](../delivery-plan/PF-10-gaia-dataset-realism.md),
  phase C3.
- **Still open and untouched by this brief:** the 23.44° obliquity finding (parent brief decision 2,
  TR-074 Part 4). Rotating about world +Z is correct for the belt's _declared_ ecliptic frame; if
  the belt is ever re-expressed in an inclined basis to fix that, the rotation axis becomes the real
  ecliptic pole and this brief's ω and K are unchanged — only the axis vector changes.
- Per the skill seam: this document is evidence, not a decision record. Any engineering decision it
  changes is Procyon's to record.
