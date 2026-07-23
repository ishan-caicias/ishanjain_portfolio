# Astronomy Reference Notes — Scene-Accuracy Brief

> **Source: model training knowledge, 2026-07-22, verify before shipping physics.**
>
> This is a SCIENCE-BRIEF (Astra) for upcoming scene-accuracy work. Nothing here was
> fetched from the web in this session; every value is from model training knowledge and is
> confidence-tagged. Anything that lands in a shader, a constant, or a marketing claim must
> be re-verified against a primary source (IAU, JPL Horizons, Gaia archive) first.

**Confidence legend**

| Tag      | Meaning                                                                           |
| -------- | --------------------------------------------------------------------------------- |
| `[HIGH]` | Defined constant or textbook value; safe to build against after a spot-check      |
| `[MED]`  | Measured quantity with real (small) spread across sources; verify before quoting  |
| `[LOW]`  | Order-of-magnitude estimate or population statistic; treat as a design guide only |

**Verdict vocabulary** (used throughout, per the Astra convention): **ACCURATE** (matches
physics), **SIMPLIFIED** (right phenomenon, reduced fidelity), **DECLARED LICENSE**
(knowingly unphysical, recorded as a choice), **BROKEN PHYSICS** (accidentally wrong — fix
or convert to declared license). License is not a defect; _undeclared_ license is.

---

## 1. What the Milky Way band looks like, from three very different seats

### 1.1 From anywhere inside the solar system: pixel-identical

The band is the galactic disk seen edge-on from inside it — the integrated glow of stars
mostly 1,000–30,000 ly away, structured by dust lanes (the Great Rift toward Cygnus/Aquila
is extinction, not an absence of stars) with the bright bulge toward Sagittarius. `[HIGH]`

The whole solar system is, against that backdrop, a single point:

- Neptune's orbit is ~30 AU; the heliopause ~120 AU; 1 ly = 63,241 AU. The entire planetary
  system spans ~0.001 ly. `[HIGH]`
- Apparent shift of a star from moving a baseline B: **Δθ ≈ B / d** (radians). `[HIGH]`
- Worst case, nearest star: Proxima Centauri (parallax ≈ 768 mas, d = 4.246 ly `[HIGH]`)
  shifts by 30 AU × 0.768″/AU ≈ **23 arcsec** between Earth and Neptune — below the ~60
  arcsec (1 arcmin) resolution of the naked eye. Even the full 60 AU diameter of Neptune's
  orbit moves Proxima only ~46″. `[HIGH]` (derived)
- Band stars at ≥1 kpc shift by **< 0.1 arcsec** across the same baseline — about 10,000×
  below visibility. `[HIGH]` (derived)

**Consequence for the scene:** the stellar sky — every constellation, every catalog star,
and the band — is _identical to the eye_ from Mercury, the belt, Pluto, or a ship anywhere
in between. Only solar-system foreground changes: the Sun's disk and brightness, planet
positions, zodiacal light. Rendering the same star skybox everywhere inside the system is
**ACCURATE**, not a shortcut. Shifting or "parallaxing" the starfield during in-system
travel would be BROKEN PHYSICS.

### 1.2 From 100–2,000 ly away: constellations die, the band survives

The same Δθ ≈ B/d rule, applied to interstellar displacement:

| Displacement | Stars within ~100 ly                      | Stars at ~500 ly           | Band (≥ 3,000 ly)                       |
| ------------ | ----------------------------------------- | -------------------------- | --------------------------------------- |
| 10 ly        | shift up to ~6°+ — asterisms visibly warp | < 1°                       | unchanged                               |
| 100 ly       | scattered beyond recognition              | ~11° shifts — shapes break | unchanged                               |
| 2,000 ly     | different sky entirely                    | gone                       | slowly deforming; still a full-sky band |

(Derived from Δθ = B/d; `[HIGH]` as geometry, star-distance examples `[MED]`.)

- Constellations are chance alignments of stars mostly 10–1,000 ly away, so they are the
  _fragile_ layer. Orion survives modest displacement better than most (its bright stars are
  distant: Betelgeuse ~500–650 ly `[MED]`, Rigel ~860 ly `[MED]`, belt stars ~1,200–2,000 ly
  `[MED]`), while anything anchored by Sirius (8.6 ly) or Alpha Centauri collapses within a
  few ly of travel.
- The **Sun drops below naked-eye visibility beyond ~55–70 ly**: M_V(Sun) = 4.83 `[HIGH]`,
  and m = 4.83 + 5·log₁₀(d/10 pc) reaches the 6.0–6.5 naked-eye limit at 17–22 pc. `[HIGH]`
  (derived) From Alpha Centauri the Sun is still a respectable mag +0.4 star (extending
  Cassiopeia's "W" — a classic, correct detail `[MED]`); from 100 ly it is telescope-only.
- The **band brightness/structure barely changes over 100 ly** and only gradually over
  1,000–2,000 ly of in-plane travel; you remain deep inside a 26–30 kpc disk. `[MED]`

**An observer at M42 (Orion Nebula, ~1,344 ly / 412 pc `[HIGH]`):**

- Sees **no Earth constellations** — every naked-eye asterism is scrambled or replaced.
  `[HIGH]` (derived)
- Still sees **a Milky Way band wrapping the whole sky**, broadly similar in brightness,
  with the bright bulge still in the direction we call Sagittarius: M42 sits near the
  galactic _anticenter_ (l ≈ 209°), so its galactocentric radius is ~8.6 kpc vs our 8.2 —
  the bulge shifts by only ~1–2° and dims marginally. `[MED]` (derived)
- Sits ~137 pc _below_ the midplane (b ≈ −19.4° × 412 pc `[MED]` derived), near the edge of
  the ~100–150 pc dust layer `[MED]` — the band would look slightly asymmetric, its near-side
  dust lanes viewed a little "from below." A subtle, honest differentiator if you ever render
  a remote vantage.
- The **Sun is apparent magnitude ≈ 12.9** (4.83 + 5·log₁₀(41.2)) — invisible without a
  mid-size telescope, one anonymous G dwarf among millions, in the direction of what we call
  Ophiuchus. `[HIGH]` (derived)
- The nebula itself: from _inside_ a nebula you see almost nothing — densities of 10²–10⁴
  atoms/cm³ are better vacuum than lab vacuum; the vivid Hubble-palette cloudscape is
  long-exposure photography, not eye-view. A glowing nebula backdrop at a station is
  **DECLARED LICENSE** (genre-universal — declare once). `[HIGH]` on the physics.

### 1.3 From outside the galaxy (SDSS scale): the band becomes an object

Leaving the disk is what kills the band — not distance along the plane:

- At a few hundred pc above the plane the band goes lopsided (whole disk on one side of the
  sky); by a few kpc it is a tilted glowing plane below you, no longer a 360° band. `[MED]`
- From ~50 kpc (LMC distance): the Milky Way spans **~30°** (28 kpc / 50 kpc ≈ 0.56 rad)
  with integrated magnitude ~ −2 (M_V(MW) ≈ −20.7 `[MED]`) — bright as a planet but smeared
  over a thousand square degrees: a huge, ghostly spiral filling a quarter of the sky at low
  surface brightness. `[MED]` (derived)
- From M31's distance (~770 kpc / 2.5 Mly `[HIGH]`): **~2°** across, integrated m ≈ +3.7 —
  almost exactly how Andromeda looks from Earth: a faint elongated smudge whose bright core
  is naked-eye only under dark skies. `[MED]` (derived)
- From an SDSS main-sample galaxy (z ≈ 0.1, ~400 Mpc `[MED]`): the Milky Way subtends
  **~14 arcsec at m ≈ 17–18** — literally an SDSS catalog entry, a small smudge in survey
  imaging, invisible to any eye. `[MED]` (derived)

**Scene translation:** the honest arc is _band → tilted plane → spiral object → point in a
galaxy catalog_, and the trigger variable is height above the disk plus distance, not speed.
A skybox that morphs from band-texture to an externally-rendered 3D disk as the camera
leaves the plane is **SIMPLIFIED/ACCURATE**; showing the full spiral from inside the disk,
or a band persisting at Mpc range, is BROKEN PHYSICS.

---

## 2. The asteroid belt: almost aggressively invisible

### 2.1 The reality

| Quantity                           | Value                                                                                                                                       | Confidence                                                         |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Radial extent (main belt)          | ~2.1–3.3 AU                                                                                                                                 | `[HIGH]`                                                           |
| Total mass                         | ~2.4 × 10²¹ kg ≈ 3% of the Moon                                                                                                             | `[MED]`                                                            |
| Ceres share                        | ~939 km diameter, ~⅓ of belt mass; Ceres+Vesta+Pallas+Hygiea ≈ half                                                                         | `[MED]`                                                            |
| Bodies > 1 km                      | ~1–2 million                                                                                                                                | `[MED]`                                                            |
| Mean spacing between > 1 km bodies | order **10⁶ km** (commonly quoted ~1–3 million km, several Earth–Moon distances; a torus-volume estimate with 10⁶ bodies gives ~4 × 10⁶ km) | `[MED]` (derived)                                                  |
| Spacecraft transits                | every probe crossed without evasive maneuvers; damaging-collision odds per crossing estimated ≲ 10⁻⁹                                        | `[LOW]` on the number, `[HIGH]` on "no probe ever dodged anything" |

**You cannot see your neighbours.** A 1 km asteroid (H ≈ 17.7, albedo ~0.15 `[MED]`) at
10⁶ km, 2.7 AU from the Sun, has apparent magnitude m ≈ H + 5·log₁₀(Δ·r) ≈ 17.7 − 8.7 ≈
**+9** — three magnitudes below naked-eye limit; a faint binocular star, not a rock. `[MED]`
(derived) Standing "in the belt," the sky looks like empty interplanetary space.

**The belt is invisible from outside, too.** The combined reflecting area of the million
km-scale bodies (~10⁶ km²) is comparable to _one_ Ceres-sized disk, smeared around an entire
2-AU-wide torus; the zodiacal dust outshines the asteroids themselves. From a few AU away
there is no ring, no band, no visible structure at all. `[MED]` (derived) A visible belt
ring from Jupiter's distance would be BROKEN PHYSICS if presented as realism.

### 2.2 What this implies for a game-realism license

- A traversable field of visible rocks is **~9 orders of magnitude denser** than reality —
  the _Empire Strikes Back_ gap. It is fine as **DECLARED LICENSE**; it is a defect only if
  anyone believes it. Declare it once (license ledger) and keep it.
- The portfolio's strongest honest framing already exists: the belt as a **catalog
  visualization** — real objects at real orbital positions (the PF-10 C3 belt is built from
  a Gaia DR3 solar-system-object catalog; Gaia DR3 contains ~158,000 asteroid entries
  `[MED]`). The license is then confined to _visibility_ (points rendered bright/large
  enough to see at all), not to existence or position — the same license the star renderer
  already takes, and the most defensible one available. **SIMPLIFIED + one declared
  visibility license**, rather than a fictional rock field.
- If a dense, dodge-the-rocks experience is ever wanted, the physically legitimate venues
  are a **planetary ring** (cm–10 m ice chunks, metres apart — genuinely dense `[HIGH]`), a
  recent collision cloud, or a young debris disk. Also note collision speeds: in-belt
  relative velocities are ~km/s — real impacts vaporize, they don't billiard-bounce; gentle
  bouncing implies a co-orbiting m/s cloud. `[MED]`

---

## 3. Cinematic warp kinematics: the brachistochrone flip-and-burn

### 3.1 The profile

Constant proper acceleration `a` toward the target for half the distance, a 180° flip, then
symmetric deceleration — the genre's "respectable" trajectory (The Expanse). Newtonian
forms, valid while v_max ≪ c (fine everywhere in-system at 1 g): `[HIGH]`

```
t_total = 2 · sqrt(d / a)          v_max = sqrt(a · d) = a · t_total / 2
```

Worked at 1 g (9.81 m/s²), Earth departure: `[HIGH]` (derived)

| Leg               | d            | t_total    | v_max                |
| ----------------- | ------------ | ---------- | -------------------- |
| → Mars (0.5 AU)   | 7.5 × 10¹⁰ m | ~2.0 days  | ~860 km/s (0.29% c)  |
| → belt (1.7 AU)   | 2.5 × 10¹¹ m | ~3.7 days  | ~1,580 km/s          |
| → Neptune (30 AU) | 4.5 × 10¹² m | ~15.7 days | ~6,600 km/s (2.2% c) |

Relativistic (interstellar) version, per half-leg distance d/2: ship time
τ = 2(c/a)·acosh(1 + a·d/(2c²)) `[HIGH]`. At a sustained 1 g (≈ 1.03 c/yr — the neat
coincidence `[HIGH]`): Proxima ≈ 3.5 yr ship / 5.9 yr Earth; galactic center ≈ 20 yr ship;
M31 ≈ 29 yr ship while megayears pass at home. `[MED]` (derived) Any warp that crosses these
distances in seconds is FTL-class **DECLARED LICENSE** — undeclarable into realism, and
that's fine; the credibility comes from keeping the _sub-light choreography_ rigorous.

### 3.2 The flip — the honest cinematic centerpiece

- Engines point along thrust, so deceleration means **flying backwards**; braking nose-first
  on main engines is BROKEN PHYSICS (unless declared forward thrusters exist). `[HIGH]`
- A graceful flip over **T ≈ 30–60 s** is realistic for a large craft (RCS-limited). For a
  bang-bang rotation profile, α = 4π/T²: T = 40 s → α ≈ 0.45°/s², peak rate ≈ 9°/s — gentle,
  readable animation numbers. `[HIGH]` (derived)
- During the flip the main drive is **off**: plume cut, zero apparent weight, starfield
  rotating 180° about the ship while the trajectory continues ballistically. Engine-off →
  coast/turn → re-light is a gift of free, honest drama.

### 3.3 Starfield honesty during the burn

- **Stars never streak.** At 6,600 km/s (the fastest in-system leg above) the nearest star
  shifts ~0.001 rad per _day_ of travel. Radial warp-lines are motion blur of things you
  pass within light-seconds — i.e., nothing. Streaks = **DECLARED LICENSE** (genre-standard);
  a static starfield during in-system warp = **ACCURATE**. `[HIGH]`
- **What honestly moves:** the Sun's disk (0.53° at 1 AU, ∝ 1/d, point-like beyond ~30 AU
  yet still dazzling at m ≈ −19 from Neptune `[HIGH]` derived); planets crawling against the
  stars; and the destination, which stays a star-like point until embarrassingly late — a
  500 km body only reaches naked-eye disk size (~1′) at ~1.7 million km, minutes before
  arrival on the deceleration leg. "The point becomes a place" is real and dramatic. `[MED]`
  (derived)
- **Nothing whooshes past** unless it passes within ~10⁴ km (at 860 km/s that's ~5°/s of
  apparent motion; at 10⁶ km it is a 0.03°/s crawl). Flybys of debris are license. `[HIGH]`
  (derived)
- **Relativistic effects are a ≥ 0.1 c phenomenon:** aberration compresses the forward sky
  (cos θ′ = (cos θ − β)/(1 − β cos θ)), Doppler blueshifts it, and per-star flux boosts by
  D² with D = γ(1 + β cos θ) — the crowding from aberration supplies the rest of the surface-
  brightness boost (applying D⁴ per star double-counts). At in-system speeds (≤ 2% c) all of
  this is invisible; showing it there is BROKEN PHYSICS, showing it on a licensed FTL run is
  a stylish borrowed truth. `[HIGH]` on formulas.

---

## 4. Reference frames and the transition cues between them

### 4.1 The three frames

| Frame             | Natural coordinates                                                            | What exists visually                                              | Dominant landmark                          |
| ----------------- | ------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ------------------------------------------ |
| **Heliocentric**  | Ecliptic (J2000), obliquity 23.44° to Earth's equator                          | Sun as disk/glare, planets, zodiacal light plane, (licensed) belt | The Sun                                    |
| **Galactic**      | Galactic (l, b); NGP at RA 192.859°, Dec +27.128° `[HIGH]`                     | Stars as a 3D field, the band, clusters/nebulae                   | Galactic center in Sagittarius             |
| **Extragalactic** | Supergalactic / CMB frame (dipole: 370 km/s toward l ≈ 264°, b ≈ +48° `[MED]`) | Galaxies as objects, large-scale structure                        | The Milky Way itself, then filaments/voids |

### 4.2 Honest transition cues, in the order they actually happen

A camera pulling away from Earth crosses these thresholds — each is a cheap, truthful
narrative beat (all derived from the magnitude/angular-size relations above):

1. **~30 AU — the Sun loses its disk.** Subtends ~1′; still ~400× brighter than a full Moon
   (m ≈ −19.3). `[HIGH]` (derived)
2. **~300 AU — the planets are gone.** Jupiter falls below naked-eye brightness (m > 6.5
   beyond ~290 AU); the belt was never visible at all. The solar _system_ disappears before
   you reach 0.005 ly. `[MED]` (derived)
3. **~1,000 AU — the Sun is merely the brightest star** (m ≈ −11.7, full-Moon class).
   At 1 ly: m ≈ −2.7 (Jupiter-class). At Proxima: m ≈ +0.4. `[HIGH]` (derived)
4. **Few ly — nearest-star parallax.** Sirius- and Centauri-anchored asterisms deform first;
   a catalog with real parallaxes (Gaia) morphs constellations _for free_ by simply moving
   the camera in 3D. **ACCURATE and nearly unique as a game feature.** `[HIGH]`
5. **~55–70 ly — the Sun becomes invisible.** The moment "home is lost" is astronomically
   real and datable. `[HIGH]` (derived)
6. **~100 ly — no Earth constellation survives**, yet the band is untouched: the sky's
   deep structure asserts itself. `[MED]` (derived)
7. **Hundreds of pc off-plane — the band tilts and unbalances**; by a few kpc it is a plane
   below, not a ring around. `[MED]`
8. **50–800 kpc — the Galaxy becomes an object**: ~30° ghost-spiral at LMC range, ~2°
   Andromeda-twin smudge at M31 range. `[MED]` (derived)
9. **Mpc+ — SDSS scale**: the Milky Way is a ~14″, mag-17 catalog smudge among filaments and
   voids; individual stars ceased to be renderable entities long ago. `[MED]` (derived)

**Scene translation:** the portfolio's warp already spans frames 1→9 in seconds — that time
compression is the one big declared license. Everything _else_ in the list can be played
straight, and each straight-played cue makes the licensed speed feel more real, not less.

---

## 5. Key numbers table

| Quantity                                  | Value                                                                                                                                                           | Confidence                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1 AU                                      | 149,597,870.7 km (exact, IAU definition) ≈ 8.32 light-min                                                                                                       | `[HIGH]`                                    |
| 1 light-year                              | 9.4607 × 10¹² km = 63,241 AU = 0.3066 pc                                                                                                                        | `[HIGH]`                                    |
| 1 parsec                                  | 3.2616 ly = 206,265 AU                                                                                                                                          | `[HIGH]`                                    |
| c                                         | 299,792.458 km/s (exact)                                                                                                                                        | `[HIGH]`                                    |
| 1 g                                       | 9.80665 m/s² ≈ 1.03 ly/yr² (≈ c per year)                                                                                                                       | `[HIGH]`                                    |
| Obliquity of ecliptic (J2000)             | 23.4393° (23°26′21″), decreasing ~0.013°/century                                                                                                                | `[HIGH]`                                    |
| Galactic center (Sgr A*)                  | RA 266.42° (17ʰ45ᵐ40ˢ), Dec −29.008°, in Sagittarius; d ≈ 8.2 kpc (~26,700 ly); 4.15 × 10⁶ M☉                                                                   | `[HIGH]` position / `[MED]` distance & mass |
| North galactic pole (J2000)               | RA 192.859°, Dec +27.128°                                                                                                                                       | `[HIGH]`                                    |
| Sun's galactic orbit                      | ~230 km/s, period ~230 Myr; ~20 pc above midplane                                                                                                               | `[MED]`                                     |
| Solar apex (motion vs nearby stars / LSR) | toward Hercules near Vega: RA ≈ 18ʰ (~271–277°), Dec ≈ +30°; galactic l ≈ 56°, b ≈ +23°; speed ~16.5–19.5 km/s (Schönrich-2010 LSR peculiar velocity 18.0 km/s) | `[MED]`                                     |
| CMB dipole (Sun vs CMB)                   | ~370 km/s toward l ≈ 264°, b ≈ +48°                                                                                                                             | `[MED]`                                     |
| Sun photometry                            | M_V = 4.83; m = −26.74 at 1 AU; naked-eye-invisible beyond ~17–22 pc (55–70 ly)                                                                                 | `[HIGH]`                                    |
| Naked-eye limits                          | magnitude ~6.0–6.5 dark sky; resolution ~1 arcmin                                                                                                               | `[HIGH]`                                    |
| Proxima Centauri                          | 4.246 ly; parallax 768 mas                                                                                                                                      | `[HIGH]`                                    |
| Milky Way disk                            | diameter ~26–30 kpc; thin-disk scale height ~300 pc; dust layer ~100–150 pc; M_V ≈ −20.7                                                                        | `[MED]`                                     |
| Distance ladder anchors                   | Sirius 8.6 ly · Vega 25 ly · Pleiades ~444 ly · M42 ~1,344 ly · LMC ~160 kly · M31 ~2.5 Mly                                                                     | `[HIGH]`/`[MED]`                            |
| Main belt                                 | 2.1–3.3 AU; mass ~2.4 × 10²¹ kg (3% Moon); ~1–2 M bodies > 1 km; mean spacing order 10⁶ km                                                                      | `[MED]`, count/spacing `[LOW–MED]`          |
| Gaia DR3 SSO catalog                      | ~158,000 asteroid entries (the PF-10 C3 belt source class)                                                                                                      | `[MED]`                                     |

---

## Appendix — formulas used (all `[HIGH]`, standard results)

- Apparent shift from displacement: Δθ ≈ B/d (rad); 1 rad = 206,265″.
- Distance modulus: m = M + 5·log₁₀(d / 10 pc).
- Asteroid apparent magnitude (phase ignored): m ≈ H + 5·log₁₀(Δ·r), Δ and r in AU.
- Newtonian brachistochrone: t = 2√(d/a), v_max = √(a·d).
- Relativistic brachistochrone ship time: τ = 2(c/a)·acosh(1 + a·d/(2c²)).
- Bang-bang 180° flip: α = 4π/T² for flip duration T.
- Aberration: cos θ′ = (cos θ − β)/(1 − β·cos θ); Doppler factor D = γ(1 + β·cos θ);
  point-source flux boost D² (crowding from aberration supplies the rest — do not apply D⁴
  per star).

## License ledger candidates surfaced by this brief

1. **Warp time compression** — ly-to-kly hops in seconds vs years-to-decades at 1 g.
   (FTL-class; the founding license.)
2. **Belt visibility** — real catalog objects rendered visible at all; reality is an empty
   sky even in-belt.
3. **Star streaks / warp lines, if used** — no physical basis at any real speed; aberration +
   Doppler is the accurate (and more distinctive) alternative at ≥ 0.1 c.
4. **Nebula/station backdrops** — long-exposure vividness presented at eye scale.

Everything else in this brief can be played straight.

---

_Prepared from model training knowledge on 2026-07-22 (Astra science brief; no web
verification performed in this session). Verify all `[MED]`/`[LOW]` values — and spot-check
`[HIGH]` ones — against primary sources before shipping physics, constants, or public
claims._
