# Science Brief — Venus: the cloud descent, and how to be honest about a radar map

**Date:** 2026-07-21
**Mode:** SCIENCE-BRIEF (with per-decision REALISM-AUDIT verdicts)
**Requested by:** Procyon, for PF-10 phase **C4.2** — the owner's decision (TR-076 Part 7) to
sphere Venus and fly the arrival **through the real cloud deck** rather than drop the body or
present a Magellan radar map as a view out of a window.

Companion to `2026-07-21-planetary-sphere-topography-science-brief.md` (C4.1), which established
the sphere, the Lunar-Lambert reflectance, the real Sun direction, the geometric albedos and the
separate `ROTATION_TIME_ACCEL = 1e3` clock. **This brief overrides parts of that shading model for
Venus specifically, and says why.**

Numbers below are either measured from the shipped files, or derived here from stated constants
with the working shown. Where a quantity is genuinely contested in the literature (lightning), it
says so rather than picking a side.

---

## 0. Measured facts about the shipped assets (read before designing)

Four Venus files exist. Three of them are not what a naive reading of the filenames suggests.

| File                                                  | Measured                       | What it actually is                                                 |
| ----------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------- |
| `venus-ultra.jpg`                                     | 8192×4096, RGB, 7.31 MB        | **Magellan SAR backscatter, tinted with the Venera surface colour** |
| `venus-high.jpg`                                      | 4096×2048, RGB, 2.25 MB        | same, downsampled                                                   |
| `venus-cloud.jpg`                                     | 1024×512, **R = G = B**, 91 KB | **a single-band UV image, not a visible-light cloud map**           |
| `venus-normal.jpg`                                    | 2048×1024, RGB, 1.70 MB        | a normal map **derived from radar brightness** — see §3, do not use |
| `public/assets/planets/venus-surface-{base,high}.jpg` | 2048×1024 / 4096×2048          | C4.1's shipped tiers of the radar map, already in the pipeline      |

**`venus-cloud.jpg` is a UV map, and I can show it from the pixels.** All three channels have
identical statistics (mean 171.4, σ 35.1, range 61–243), so it carries one band, not three. Its
contrast ratio is **σ/mean = 20.5%**. Real Venus cloud-top contrast **in visible light is 1–3%** —
the planet is famously, boringly featureless to the eye. Contrast of ~20–30% with a visible Y-shaped
dark feature is the signature of the **365 nm ultraviolet** view (Mariner 10 / Pioneer Venus /
Venus Express), where an unidentified absorber in the upper cloud produces real structure.

Consequence, and it is the single most likely accidental lie in this feature: **compositing
`venus-cloud.jpg` at full contrast and calling it the view is a UV image presented as a
photograph.** It is a beautiful and completely real dataset — it just is not what an eye sees. Use
it at ~1/10 contrast for the visible render, and keep the full-contrast version available as an
explicitly-labelled UV mode if the dossier wants it.

**`venus-ultra.jpg`'s orange is real, and its contrast is not.** Measured channel means are
**R 196.5, G 112.3, B 39.6** → normalized **(1.00, 0.57, 0.20)**. That is, to two decimal places,
the Venera-derived surface illuminant colour I derive independently in §2 from the atmosphere's
Rayleigh transmission. So the mosaic's _tint_ is defensible and physically motivated. Its
_spatial variation_ is radar backscatter — roughness and slope — and has essentially nothing to do
with visible reflectance. §3 is about that.

---

## 1. The real cloud structure, and the altitudes the animation must use

**Verdict: the layer altitudes are ACCURATE and directly usable. There is no need to invent a
single keyframe.**

### The layers

Venus's aerosol is the best-characterised planetary cloud system after Earth's — Venera 8–14,
Pioneer Venus (four probes, 1978), Vega 1–2, and Venus Express VeRa/VIRTIS all profiled it. The
canonical structure:

| Layer                  | Altitude           | Thickness | Particles                                 | Optical depth (visible)               |
| ---------------------- | ------------------ | --------- | ----------------------------------------- | ------------------------------------- |
| Upper haze             | **70 – 90 km**     | 20 km     | mode 1, r ≈ 0.2 µm submicron H₂SO₄        | 0.05 – 0.5 (variable, polar-enhanced) |
| **Upper cloud**        | **56.5 – 70 km**   | 13.5 km   | modes 1 + 2, r ≈ 0.2 / 1.0 µm             | ≈ 6 – 8                               |
| **Middle cloud**       | **50.5 – 56.5 km** | 6 km      | modes 2, 2′, 3; r up to ≈ 3.5 µm          | ≈ 8 – 10                              |
| **Lower cloud**        | **47.5 – 50.5 km** | 3 km      | **highest mass density**, mode 3 dominant | ≈ 6 – 12                              |
| Lower (pre-cloud) haze | **31 – 47.5 km**   | 16.5 km   | sparse, evaporating droplets              | 0.1 – 1                               |
| Clear atmosphere       | **0 – 31 km**      | 31 km     | **aerosol-free** dense/supercritical CO₂  | Rayleigh only — see below             |

**Total cloud-deck optical depth: τ ≈ 20 – 40**, typically quoted around 29 at visible
wavelengths. For comparison, an Earth stratocumulus deck is τ ≈ 10–30 — Venus's deck is _not_
extraordinarily thick optically. What makes it opaque is that it is **global, unbroken, and 22.5 km
deep**, with no holes anywhere, ever.

The droplets are **75–85 % sulfuric acid by weight**, the rest water. Not water clouds.

### Optical depth below the clouds: the part everyone gets wrong

Below the cloud base there is no aerosol worth speaking of, but there are **92 bar of CO₂**, and
Rayleigh scattering in that column is enormous. Deriving it properly, because the result drives
every colour decision in this feature:

```
Rayleigh cross-section, CO2 relative to air at 550 nm:
  sigma_CO2/sigma_air = ((n_CO2-1)/(n_air-1))^2 * (F_CO2/F_air)
                      = (4.49e-4 / 2.78e-4)^2 * (1.15 / 1.048) = 2.861
  sigma_air(550 nm)   = 4.55e-31 m^2   ->  sigma_CO2(550 nm) = 1.302e-30 m^2

Column number density (96.5% CO2 / 3.5% N2, mean mass 43.45 g/mol = 7.216e-26 kg):
  N = P / (m * g) = 92.1e5 Pa / (7.216e-26 kg * 8.87 m/s^2) = 1.439e31 molecules/m^2

  tau_R(550 nm) = sigma * N = 18.7
```

Scaling by λ⁻⁴ from 550 nm gives the vertical Rayleigh optical depth of the **whole** Venusian
atmosphere:

| Wavelength     | τ (surface → space) | Altitude where τ to the surface = 1 |
| -------------- | ------------------- | ----------------------------------- |
| 450 nm (blue)  | **41.8**            | **43.5 km**                         |
| 550 nm (green) | **18.7**            | **37.1 km**                         |
| 650 nm (red)   | **9.58**            | **30.4 km**                         |
| 700 nm         | 7.13                | 27 km                               |

For reference, Earth's entire atmosphere is τ_R(550) ≈ **0.097**. Venus's is **190× thicker in
Rayleigh alone.** This is why the light at the bottom is orange, and it is not an artistic choice —
blue is attenuated by `e^-41.8`, a factor of 10⁻¹⁸.

### At what altitude does the surface actually become visible?

Two different answers, and both matter to the animation:

1. **Aerosol clears at the cloud base, 47.5 km.** Rayleigh optical depth from 47.5 km to the
   ground is only `18.7 × 1.4/92.1 = 0.28` in green. **The surface is already substantially
   visible from just under the cloud base** — softened by the thin lower haze (τ ~ 0.1–1) but
   genuinely there.
2. **The last haze clears at 31 km**, and below that the view is limited only by the CO₂ itself,
   which reddens progressively but never becomes opaque from that height.

**The dramatic payoff of this animation is therefore at 47.5 km, not at 0 km.** That is worth
stating plainly to whoever choreographs it: the breakout moment is real, it happens at a real
altitude, and everything below it is a slow reddening rather than a further reveal.

### Keyframes — real altitudes, real conditions, and what you would actually see

Pressures and temperatures are VIRA / Seiff standard-model values.

| Alt (km) | P (bar)  | T (°C)   | Regime                                                                                                    | What a descending observer actually sees                                                                                               |
| -------- | -------- | -------- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| **100**  | 3.0e-5   | −100     | above everything                                                                                          | Venus as a **featureless pale-cream disc**, limb sharp, no visible structure whatever                                                  |
| **90**   | 3.8e-4   | −104     | upper haze top                                                                                            | the limb begins to soften; a faint bluish-white haze ring appears against space                                                        |
| **80**   | 4.8e-3   | −76      | upper haze                                                                                                | thin veil, τ ≲ 0.5; the cream deck below still reads as a hard surface                                                                 |
| **70**   | 0.037    | −43      | **CLOUD TOP (τ = 1)**                                                                                     | **entry.** Shadows vanish, contrast collapses, the world becomes a bright featureless cream fog. This is the moment.                   |
| **65**   | 0.098    | −43      | upper cloud                                                                                               | dense pale fog, still **very bright** — most of the deck's scattering happens here, so it is luminous, not dark                        |
| **60**   | 0.236    | −10      | upper cloud                                                                                               | cream fog dimming; colour begins to warm                                                                                               |
| **56.5** | 0.44     | +14      | upper/middle boundary                                                                                     | droplets coarsen; fog turns slightly yellow                                                                                            |
| **55**   | 0.53     | **+30**  | middle cloud — **the "habitable layer"**: 0.5 bar and Earth-room-temperature. Real, famous, worth a label |
| **50.5** | 1.02     | +72      | middle/lower boundary                                                                                     | pressure passes **1 bar** — sea-level Earth, at 50 km altitude                                                                         |
| **50**   | 1.07     | +75      | lower cloud                                                                                               | **darkest point of the entire descent** — highest mass density, deepest in the deck, dim warm ochre                                    |
| **47.5** | ~1.4     | +92      | **CLOUD BASE — BREAKOUT**                                                                                 | **the reveal.** The deck ends; the ground appears below through thin haze, in orange light. Sky above = a solid grey-yellow lid        |
| **40**   | 3.50     | +143     | lower haze                                                                                                | last aerosol thinning; view lengthening; colour reddening measurably                                                                   |
| **31**   | ~9.3     | +218     | haze base                                                                                                 | final aerosol gone; below here it is pure clear CO₂                                                                                    |
| **30**   | 9.85     | +221     | clear                                                                                                     | τ_blue = 4.5 — **blue is gone from the scene from here down.** Everything is orange                                                    |
| **20**   | 22.5     | +308     | clear, dense                                                                                              | τ_green = 4.6 — green fading too; contrast washing toward monochrome amber                                                             |
| **10**   | 47.4     | +385     | **supercritical CO₂**                                                                                     | CO₂ passes its critical point (304 K, 73.8 bar) around 7–10 km: this is a **fluid**, not a gas. Optical shimmer; density 50× Earth air |
| **0**    | **92.1** | **+462** | surface                                                                                                   | dark basalt in flat orange light, **no sun disc, no shadows**, visible range ~3 km. The Venera view                                    |

---

## 2. Colour and illumination — what it really looks like, top to bottom

**Verdict: ACCURATE and fully specifiable. The colours below are derived, not chosen.**

### From outside: cream, and dull

Venus's spectral geometric albedo is roughly 0.85 at 650 nm, **0.689 at 550 nm (V band, the value
C4.1 already uses)**, and ~0.55 at 450 nm — a smooth fall into the blue caused by SO₂ and the
unidentified UV absorber. As linear RGB reflectance that is:

```
VENUS_CLOUDTOP_ALBEDO_RGB = (0.85, 0.69, 0.55)     // linear, absolute reflectance
                          ~ sRGB #F0DAC5           // pale warm cream
VENUS_VISIBLE_CONTRAST    = 0.02                   // +/- 1-3%, essentially featureless
VENUS_UV_CONTRAST         = 0.30                   // real, and what venus-cloud.jpg carries
```

Venus is the **brightest planet in our sky** (geometric albedo 0.689 against Earth's 0.434 and
Mars's 0.170) and simultaneously the **least interesting to look at**. Both facts are real and both
should survive into the render. If Venus-from-orbit looks dramatic, it is wrong.

### Through the deck: the brightness curve

Pioneer Venus and Venera net-flux radiometers measured the solar flux profile directly. Normalizing
to the flux above the cloud (subsolar insolation at Venus = 1361/0.7233² = **2601 W/m²**):

| Altitude       | Relative downwelling illuminance | Colour                     |
| -------------- | -------------------------------- | -------------------------- |
| ≥ 70 km        | 1.00                             | cream `#F0DAC5`            |
| 65 km          | 0.60                             | cream, flattening          |
| 60 km          | 0.35                             | warm cream                 |
| 55 km          | 0.15                             | pale ochre                 |
| 50 km          | **0.06**                         | dim ochre — the dark point |
| 47.5 km (base) | **0.04** (~100 W/m²)             | orange                     |
| 30 km          | 0.03                             | deep orange                |
| 0 km           | **0.02** (~20–50 W/m² subsolar)  | orange, fully diffuse      |

The important qualitative point: **the cloud deck is not dark inside.** It is a bright, luminous,
shadowless white-out for the first 15 km, and only becomes gloomy near the base. An animation that
plunges into darkness at cloud top has the physics backwards.

### At the surface: the Venera record

Venera 13 and 14 (March 1982) returned colour panoramas — the only colour photographs ever taken on
Venus. Reprocessed with the calibration targets on the spacecraft (Don Mitchell's work is the
standard reference), they show:

- **Illumination:** strongly orange. The Rayleigh transmission derived in §1 predicts a linear RGB
  illuminant ratio of about **(1.00, 0.57, 0.20)** — which, as noted in §0, is within a percent of
  the measured mean tint of the shipped `venus-ultra.jpg`. Two independent routes to the same colour.
- **Rock:** basalt, intrinsically **dark neutral grey-brown, visible albedo ≈ 0.10**. The famous
  orange is entirely the light, not the ground. Under white light Venus's surface would look like a
  Hawaiian lava field.
- **Sky:** a **uniform orange dome**. No blue, no gradient worth modelling, **no solar disc**, and
  **no shadows** — the deck diffuses the Sun completely. Venera saw flat, shadowless light.
- **Visibility:** derived from the same Rayleigh coefficients at surface density
  (n = 9.07e26 m⁻³, β = σn), using the Koschmieder relation 3.912/β:

  | Wavelength | β (per km) | Visual range |
  | ---------- | ---------- | ------------ |
  | 450 nm     | 2.64       | **1.5 km**   |
  | 550 nm     | 1.18       | **3.3 km**   |
  | 650 nm     | 0.61       | **6.5 km**   |

  Consistent with the panoramas, which resolve rock out to a few hundred metres and lose the scene
  in haze well before any horizon.

```
VENUS_SURFACE_ILLUMINANT_RGB = (1.00, 0.57, 0.20)   // linear; sRGB ~ #FFC57B
VENUS_SURFACE_ALBEDO         = 0.10                 // basalt, neutral grey-brown
VENUS_SKY_RGB                = (1.00, 0.60, 0.25)   // uniform dome, no gradient, no sun disc
VENUS_SURFACE_VIS_RANGE_KM   = 3.3                  // green; 1.5 blue, 6.5 red
VENUS_SURFACE_DIRECTIONAL    = 0.0                  // NO directional term below ~45 km
```

That last constant is the one that matters most, and it leads directly into §3.

---

## 3. The honesty problem at the bottom — **this is the crux, and my answer is (a), with teeth**

**Recommendation: (a), present it frankly as a radar visualization — and the frankness has to be
in the _lighting model_, not just the palette.**

### Why (b) is not available

Option (b), "a plausible visible-light interpretation of the radar data," cannot be done honestly,
for a reason specific to Venus rather than a general objection to interpretation:

1. **The mapping does not exist.** SAR backscatter responds to surface **roughness at the radar
   wavelength (12.6 cm)** and to **local slope toward the spacecraft**. Visible reflectance responds
   to mineralogy and grain size. These are physically independent. Bright-in-radar means rough or
   tilted; it does not mean bright.
2. **There is no contrast to interpret it into.** Every Venera landing site — four of them, widely
   separated — found basalt with visible albedo near 0.10 and very little variation. The best
   available evidence says Venus's surface in visible light is **close to uniform dark grey**.
   Producing a "visible-light interpretation" would therefore mean **inventing contrast that the
   real planet does not have**, using a dataset that measures something else, and the invention
   would be invisible as an invention to every viewer. That is the exact failure mode the four-tier
   taxonomy exists to prevent: not a declared license, an undeclared fabrication.

The genuinely honest visible-light render of Venus's surface is a **near-featureless dark plain in
flat orange light with a 3 km horizon**. That is real, it is what Venera photographed, and it is
also — stated plainly — visually inert. It cannot carry the payoff of a descent.

### Why (a) is not a consolation prize

Radar is not a substitute for the picture. **Radar _is_ the picture.** No human eye and no camera
has ever seen Venus's surface from above; every map humanity possesses of that surface came from
Pioneer Venus, Venera 15/16 and Magellan bouncing centimetre waves through 22.5 km of sulfuric
acid. Presenting the descent as _ending in an instrument view_ is not a compromise with the truth —
it is a more accurate account of how we know this place than any photograph could be, because there
are no photographs.

So the descent's dramatic structure should be: **real visible-light physics from 100 km down to
the cloud base, then a visible change of instrument.** The transition is the point.

### Three rules that make (a) honest rather than merely defensible

**Rule 1 — the lighting model must change at the cloud base, and C4.1's shading must switch off.**

This is the strongest specific recommendation in this brief. C4.1 lights every body with a real
Sun direction, Lunar-Lambert reflectance and height-derived normals. Applying any of that to the
radar map would produce **terrain that appears lit** — a directional highlight and a terminator
across data that is not reflectance at all. It would look convincing, it would be doubly fictional
(fake geometry from radar brightness, then fake lighting on the fake geometry), and no viewer could
detect it. For Venus below ~45 km:

```
uUseDirectionalLight = 0.0    // no Sun direction, no terminator
uUseNormalMap        = 0.0    // <- venus-normal.jpg must NOT be bound
uUseSelfShadow       = 0.0    // C4.3's ray-march must be gated off for Venus
uAmbientRGB          = VENUS_SURFACE_ILLUMINANT_RGB
```

**`venus-normal.jpg` (2048×1024, measured present in the pack) is derived from radar brightness and
must not be used as a normal map.** It converts backscatter into relief. Everything in the C4.1
brief about true-scale elevation being honest depends on the height data being elevation; here it
isn't. Flatly: **BROKEN PHYSICS if shipped.**

The physically correct lighting below the deck is what §2 established anyway — **uniform diffuse
orange, no directional component, no shadows**. So the honest choice and the physical choice are
the same choice, which is a pleasant place to be.

**Rule 2 — the palette must not be photographic.**

Use the archetypal SAR presentation: **monochromatic amber/sepia luminance**, the look every
Magellan product ever published carries. The shipped mosaic's measured tint (1.00, 0.57, 0.20)
already is this, and — usefully — it is simultaneously the real Venera illuminant, so the palette
reads as _instrument_ and _atmosphere_ at once. Do **not** stretch the contrast toward
photographic, do not add colour variation, do not add specular.

**Rule 3 — say so, at the moment of emergence.**

One line of on-screen provenance as the deck breaks: _"Surface: Magellan synthetic-aperture radar,
12.6 cm. Brightness is roughness, not reflectance. No eye has seen this."_ That sentence is the
feature. It converts the awkward asset into the most interesting thing on the page, and it is the
difference between a declared license and a quiet lie.

**Verdict with these three rules: DECLARED LICENSE, and a good one.** Without Rule 1 specifically:
**BROKEN PHYSICS.**

### The honest upgrade path, noted for later

Magellan also produced a genuine **altimetry** product — real topography, measured, distinct from
SAR backscatter, with a real 13.7 km relief range (Maxwell Montes +11 km to Diana Chasma −2.9 km).
That dataset _would_ legitimately drive geometry and displacement. It is **not in this pack**. If it
is ever added, Venus can have real elevation with the radar image as its albedo channel, and the
distinction between the two products is itself worth explaining.

---

## 4. Super-rotation — real, quantified, and it should use **neither** accelerated clock

**Verdict: ACCURATE if implemented as real-time local advection. BROKEN PHYSICS on either
accelerated clock.**

### The real numbers

Venus's solid body rotates once in **243.025 days, retrograde**. Its atmosphere at cloud top laps
the planet in about **four days, in the same retrograde sense** — one of the outstanding unsolved
problems in planetary dynamics, and the reason "super-rotation" has a name.

```
Cloud-top radius       = 6051.8 + 70 = 6121.8 km
Circumference          = 2*pi*6121.8 = 38,464 km
At 100 m/s (360 km/h)  = 384,640 s = 4.45 Earth days
Super-rotation factor  = 243.025 / 4.45 = 54.6x
```

The vertical wind profile, from Venera/Vega tracking and Venus Express cloud-motion winds:

| Altitude | Zonal wind        | Note                                 |
| -------- | ----------------- | ------------------------------------ |
| 70 km    | **100 m/s**       | cloud top; peak of the profile       |
| 60 km    | 85 m/s            |                                      |
| 50 km    | **60 m/s**        | cloud base region                    |
| 40 km    | 35 m/s            |                                      |
| 20 km    | 10 m/s            |                                      |
| 10 km    | ~2 m/s            |                                      |
| 0 km     | **0.3 – 1.0 m/s** | Venera 9/10 anemometry — a dead calm |

**The entire 100 m/s lives aloft.** At the surface the air barely moves — though at 65 kg/m³
(50× Earth air, 6.5 % of water) a 1 m/s Venusian breeze carries the dynamic pressure of about
7 m/s on Earth, which is why Venera's landers found evidence of wind-moved fines despite the calm.

### Which clock

Three quantities, and they want different treatment. This is the useful distinction:

| Motion                                                 | Clock                       | Why                                                                                                                                 |
| ------------------------------------------------------ | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Venus's **solid-body** rotation                        | `ROTATION_TIME_ACCEL = 1e3` | As C4.1: 243.025 d retrograde → **5.83 h** wall-clock per turn                                                                      |
| The **cloud shell's** rotation relative to the surface | `ROTATION_TIME_ACCEL = 1e3` | 4.45 d → **385 s** per lap. The 54.6× ratio is preserved exactly, and a lingering visitor genuinely sees the deck outrun the ground |
| **Local cloud advection during the descent**           | **1.0 — real time**         | See below                                                                                                                           |

**The descent must use real time (1×), and the reason is a hard number.** At `1e3`, a cloud-top wind
of 100 m/s becomes **100 km/s — 0.033 c**. That is not a fast wind, it is a rendering artifact; the
texture would be a smear and the physics would be nonsense. It is the same class of error as
sharing the belt's `4e5` for rotation, and it fails for the same reason: an accelerated clock is
only defensible when nothing local is legible in the frame, and during a descent _everything_ local
is legible.

At **1×** the number is already dramatic: 100 m/s is 360 km/h of fog streaming past a ship that is
20 km from the nearest solid object. Over a 20 s descent that is **2 km of lateral drift at the top
decaying to ~10 m at the bottom** — a strong, real, visible shear that reads immediately as
"this atmosphere is moving and the ground is not." No acceleration required, and none honest.

```
VENUS_SIDEREAL_PERIOD_S      = -2.0997e7   // 243.025 d, retrograde (sign per C4.1 convention)
VENUS_CLOUDTOP_PERIOD_S      = -3.8464e5   // 4.45 d, retrograde (same sense)
VENUS_SUPERROTATION_FACTOR   = 54.6
VENUS_WIND_MS_BY_ALT_KM      = { 70:100, 60:85, 50:60, 40:35, 20:10, 10:2, 0:0.6 }
VENUS_DESCENT_ADVECTION_ACCEL = 1.0        // real time. NOT 1e3, NOT 4e5.
```

---

## 5. What else is real and worth showing

Ranked by what actually rewards a viewer, all real, none invented.

1. **The 55 km habitable layer.** 0.5 bar, **+30 °C**, above the acid, with Earth-like gravity
   (8.87 m/s², 0.90 g). The single most Earth-like place in the solar system outside Earth, and it
   is in the middle of the cloud deck this animation flies through. One label, enormous payoff, and
   it is the real basis of every Venus-airship proposal from Buoyant Venus Station to HAVOC.

2. **The temperature and pressure gradient itself.** −43 °C to **+462 °C** and 0.037 bar to
   **92.1 bar** across 70 km. A running altitude/pressure/temperature readout during the descent is
   free, entirely real, and it does the narrative work that fake drama would otherwise be recruited
   for. 92 bar is the pressure at ~900 m depth in Earth's ocean.

3. **Supercritical CO₂ below ~7–10 km.** CO₂'s critical point is 304.1 K / 73.8 bar; Venus's lower
   atmosphere exceeds both. The bottom of the descent is not into a gas — it is into a **supercritical
   fluid** at 65 kg/m³. Rarely shown anywhere, completely real, and it justifies an optical
   shimmer/density-gradient effect that most scenes would have to invent an excuse for.

4. **Sulfuric acid rain that never lands.** Droplets fall from the lower cloud, descend into the
   hot lower haze, and **evaporate and thermally decompose around 31–40 km**. Virga on a planetary
   scale: Venus has rain and has had no rainfall in a billion years. This is exactly what the
   31–47.5 km haze layer _is_, so rendering that layer correctly renders the phenomenon for free.

5. **The disappearance of shadows at 70 km.** Not a subtlety — it is the most physically dramatic
   single moment available. Above the deck there is a hard terminator and a point Sun (Venus's Sun
   subtends 0.737°, per C4.1's table). At cloud top, within a couple of kilometres, the light
   becomes **entirely diffuse and stays that way to the ground**. Turning off the directional light
   _as an animated transition_ between 72 and 66 km is a one-parameter effect that encodes real
   radiative transfer.

6. **Atmospheric refraction — real, spectacular, and correctly omitted.** Worth writing down
   because someone will propose it. At the surface, CO₂ at 9.07e26 m⁻³ gives **n − 1 = 0.0152**
   (Earth: 0.00029). With a density scale height of 19.2 km, the curvature radius of a horizontal
   ray is:

   ```
   R_ray = 1 / |d(n-1)/dh| = 19,164 m / 0.01516 = 1264 km
   ```

   **Rays curve 4.8× more sharply than Venus's own surface (R = 6051.8 km).** In principle a horizontal
   line of sight bends _down into the ground_, the horizon rises, and the observer stands at the
   bottom of a shallow bowl — an effect genuinely discussed in the Venera literature. **But it is
   unobservable**, because §2's Rayleigh scattering cuts the visible range to 3.3 km, and the bowl
   needs tens of kilometres to develop. Two real effects in direct competition, and scattering wins.
   **Recommend not modelling it**, and mentioning it in the dossier, where the fact that it cancels
   is more interesting than the effect would have been.

7. **Lightning — genuinely contested; recommend not shipping it.** Venera 11/12 and Pioneer Venus
   detected VLF bursts; Venus Express's magnetometer reported whistler-mode waves (Russell et al.,
   2007). Against that: **Akatsuki's Lightning and Airglow Camera conducted extensive optical
   searches and found no flashes**, and work from ~2021–2023 using Parker Solar Probe FIELDS data
   argues many of the whistler detections have non-lightning explanations, with some optical
   candidates attributed to meteors. As of this brief's date the question is **open**. Rendering
   frequent Venusian lightning would assert a disputed claim as settled for visual benefit — the
   defect pattern, not the license pattern. If the owner wants it: rare, dim, confined to the middle
   cloud (50.5–56.5 km), and declared as contested.

8. **The polar vortices.** Both poles carry persistent vortices; the south polar one imaged by
   Venus Express is famously **double-eyed** and morphologically unstable. Real, striking, and
   visible in the UV. Only relevant if the arrival approaches over a pole — but if the UV mode of
   §0 is built, it comes along free.

---

## 6. Duration and pacing

**Verdict: DECLARED LICENSE — a ~170× time compression, uniformly declarable.**

**Real reference:** the Venera and Pioneer descent probes took **55–62 minutes** from cloud top to
touchdown, at roughly 3 m/s under parachute through the deck and ~8 m/s aerobraking below it.

**Recommended wall clock: 20 s** (defensible range 16–24 s). Under that, a full 70 km would be
3.5 km/s — the ship is not a probe, and nobody will think it is. Declare the compression factor
rather than the speed.

**Pacing — weighted to the cloud deck, because the cloud deck is the feature:**

| Segment                        | Δ altitude | Wall clock | Fraction | Rationale                                                    |
| ------------------------------ | ---------- | ---------- | -------- | ------------------------------------------------------------ |
| 100 → 70 km (approach + haze)  | 30 km      | **3.5 s**  | 18 %     | Nothing happens here. Move fast; the cream disc is the point |
| **70 → 47.5 km (the deck)**    | 22.5 km    | **10.0 s** | **50 %** | The feature. Slowest. Layer boundaries should be _felt_      |
| 47.5 → 31 km (breakout + haze) | 16.5 km    | **4.5 s**  | 22 %     | The reveal, then let it breathe                              |
| 31 → final altitude            | —          | **2.0 s**  | 10 %     | Settle. Nothing new appears below 31 km but reddening        |

**Do not land.** Two reasons, and the second is the real one:

- The overhead radar map only reads as a map from altitude. The natural resting camera is
  **15–25 km**, where a wide swath of Magellan terrain is spread out below.
- **At 0 km you can see 3.3 km and nothing else.** The Venera ground view is a completely different
  picture — a dark rock-strewn plain under an orange dome — and it is legitimately worth building
  as a _separate optional beat_ with its own honest presentation. Sliding into it at the end of a
  descent would silently swap one dataset for another at the moment the viewer stops paying
  attention, which is the sort of thing this feature exists to avoid.

**On repeat arrivals:** full sequence on first arrival, then abbreviated (≈6 s, cloud-top to
breakout) or skippable. A 20 s gate on every visit to Venus turns the honest thing into the annoying
thing, and that is how good features get deleted.

---

## 7. Engineering consequences Procyon needs before design

Not science, but they fall out of the real numbers and will otherwise be discovered late.

**The atmosphere is 1.16 % of the radius.** Venus's radius is 6051.8 km; cloud top at 70 km. On
C4.1's `PLANET_SPHERE_RADIUS = 26`:

```
surface shell      r = 26.000 wu
cloud base (47.5)  r = 26.204 wu
cloud top  (70 km) r = 26.301 wu
whole deck thickness =  0.0967 wu       <- ten seconds of animation across this
whole atmosphere     =  0.301 wu
```

The descent traverses **0.097 world units** and the two shells are separated by less than a tenth of
a unit at radius 26. Consequences: real depth-precision risk between the two spheres, and a literal
true-scale camera translation is a very small move. **The altitudes and their ordering are what must
be real; the world-unit mapping is Procyon's to choose.** A defensible construction is an
`uDescentAltitudeKm` uniform driving fog density, shell alpha, illuminance and the directional-light
fade, with the camera moving on whatever path reads best — the physics lives in the uniform, not in
the camera transform. If that path is taken, **declare it**: the altitudes are real, the metric
mapping from altitude to camera position is not.

**The shading path must fork.** C4.1's Venus currently goes through the same directional-light,
Lunar-Lambert, normal-mapped path as every other body. Per §3 Rule 1 that fork is mandatory, not
cosmetic, and it is the thing most likely to be quietly dropped under schedule pressure. It is worth
a unit test that pins `uUseDirectionalLight == 0` and the absence of any `venus-normal` binding, in
the same spirit as C4.1's tests pinning exaggeration at 1.0 and the albedos as geometric.

---

## 8. Where I would push back

Asked for, and I have four.

1. **The single largest dishonesty risk is not the radar map — it is lighting the radar map.**
   Everyone is already alert to "is the surface real"; nobody is alert to "is the _shading_ real."
   A Sun-lit, normal-mapped Magellan mosaic would look better than the honest version, would pass
   every review, and would be a fabrication no viewer could detect. §3 Rule 1 is the load-bearing
   recommendation of this brief. If only one thing survives from it, that.

2. **Do not make the cloud deck dramatic.** The temptation is a swirling, high-contrast, stormy
   descent. Measured: real visible-light cloud contrast is **1–3 %**, and the shipped
   `venus-cloud.jpg` carries **20.5 %** because it is ultraviolet. Cranking visible contrast to UV
   levels is the _same class of error_ as lighting the radar map, just in the opposite direction —
   inventing structure rather than inventing illumination. The honest descent is a bright,
   near-featureless, disorienting white-out, and I would argue that is more memorable than swirls
   precisely because it is unexpected. If the drama is wanted, ship a **labelled UV mode** where the
   contrast is real.

3. **Do not generalise the descent.** This works for Venus because a specific, unusual, real
   condition holds: an opaque atmosphere over a surface humanity has genuinely only ever seen by
   instrument. Titan is the one other body in the pack where the same argument applies (orange haze
   ball, Cassini radar/near-IR surface map), and there it would be equally honest. **Jupiter and
   Saturn have no surface to arrive at** — a descent there would have to invent a bottom, which is
   the one move that would retroactively make the Venus descent look like a visual gimmick rather
   than an argument about data provenance. The feature's value is that it is _specific_.

4. **Lightning: I would leave it out.** §5.7. The evidence is genuinely split as of this date, and
   an animated lightning flash reads to a viewer as a settled fact.

Beyond those — I think this is the best call available on Venus, better than the "render the bland
cloud deck" recommendation I made in the C4.1 brief §6. That recommendation was right about the
physics and wrong about the opportunity: it treated the radar map as a problem to be managed, and
the owner's framing treats it as the subject. **Radar-through-cloud is how humanity actually sees
Venus's surface**, and a descent that ends by changing instrument says something true that a
photograph could not say, because there are no photographs. Reversing my own recommendation here is
the honest outcome, and this brief supersedes that paragraph rather than editing it.

---

## Summary

| #   | Element                                                     | Verdict                            | Action                                                                                          |
| --- | ----------------------------------------------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0   | `venus-cloud.jpg` as a visible-light cloud map              | **BROKEN PHYSICS if used as-is**   | Measured R=G=B, σ/mean = **20.5 %** → it is **UV**. Use at ~1/10 contrast, or label it          |
| 0   | `venus-ultra.jpg` orange tint                               | ACCURATE                           | Measured (1.00, 0.57, 0.20) = the real Venera illuminant, derived independently in §2           |
| 1   | Cloud layer altitudes                                       | **ACCURATE**                       | 70 / 56.5 / 50.5 / 47.5 / 31 km — use them verbatim as keyframes                                |
| 1   | Cloud-deck optical depth                                    | ACCURATE                           | τ ≈ 20–40, total; the deck is 22.5 km thick and globally unbroken                               |
| 1   | Surface visibility from above                               | ACCURATE                           | Payoff is at **47.5 km** (cloud base), not 0 km; blue dies at 43.5 km, red at 30.4 km           |
| 2   | Cloud-top colour                                            | ACCURATE                           | linear (0.85, 0.69, 0.55) ≈ `#F0DAC5`; visible contrast ±2 %                                    |
| 2   | Illuminance through the deck                                | ACCURATE                           | 1.00 → 0.06 at 50 km → 0.02 at the surface; **bright inside the upper deck, not dark**          |
| 2   | Surface illuminant / sky                                    | ACCURATE                           | (1.00, 0.57, 0.20) ≈ `#FFC57B`; uniform dome, **no sun disc, no shadows**; vis 3.3 km           |
| 3   | Radar map presented as a view                               | **BROKEN PHYSICS**                 | Option (b) "visible-light interpretation" is unavailable — it would invent contrast             |
| 3   | Radar map as declared instrument view                       | **DECLARED LICENSE — recommended** | Non-photographic amber palette + provenance line at breakout                                    |
| 3   | **Directional light / normal map on the radar**             | **BROKEN PHYSICS**                 | **Fork the shader**: no Sun direction, no `venus-normal.jpg`, no self-shadow, below 45 km       |
| 4   | Super-rotation figures                                      | ACCURATE                           | 100 m/s at 70 km, 4.45 d lap, **54.6×** the solid body, both retrograde; 0.3–1.0 m/s at surface |
| 4   | Cloud advection on `ROTATION_TIME_ACCEL = 1e3`              | **BROKEN PHYSICS**                 | Would make cloud-top wind **100 km/s = 0.033 c**. Descent advection must be **1.0×**            |
| 4   | Cloud-shell rotation on `1e3`                               | ACCURATE (ratio preserved)         | 385 s per lap vs 5.83 h for the solid body — the real 54.6× is visible to a lingerer            |
| 5   | 55 km habitable layer, ΔT/ΔP, supercritical CO₂, acid virga | ACCURATE                           | All free, all real, all under-used elsewhere                                                    |
| 5   | Atmospheric refraction                                      | ACCURATE but **unobservable**      | R_ray = **1264 km** vs planet 6052 km — cancelled by 3.3 km visibility. Omit; explain           |
| 5   | Lightning                                                   | **CONTESTED**                      | Akatsuki optical null result vs VLF detections. Recommend omitting                              |
| 6   | 20 s descent, 50 % of it in the deck                        | DECLARED LICENSE                   | ~170× compression of a real 55–62 min probe descent. **Do not land** — stop at 15–25 km         |

### Constants to implement

```
// --- Geometry ---
VENUS_RADIUS_KM               = 6051.8
VENUS_GRAVITY_MS2             = 8.87        // 0.904 g
VENUS_FLATTENING              = 0.0         // effectively a perfect sphere (243 d rotation)

// --- Cloud structure: descent keyframe altitudes (km) ---
VENUS_UPPER_HAZE_TOP_KM       = 90.0
VENUS_CLOUD_TOP_KM            = 70.0        // tau = 1; the entry moment
VENUS_UPPER_MID_BOUNDARY_KM   = 56.5
VENUS_HABITABLE_LAYER_KM      = 55.0        // 0.53 bar, +30 C
VENUS_MID_LOWER_BOUNDARY_KM   = 50.5
VENUS_CLOUD_BASE_KM           = 47.5        // BREAKOUT — the payoff
VENUS_HAZE_BASE_KM            = 31.0        // last aerosol
VENUS_SUPERCRITICAL_KM        = 8.0         // CO2 above 304.1 K and 73.8 bar below here
VENUS_CLOUD_TAU_TOTAL         = 29.0        // range 20-40

// --- Atmosphere profile (VIRA), alt_km: [P_bar, T_C] ---
VENUS_PROFILE = { 90:[3.76e-4,-104], 80:[4.76e-3,-76], 70:[0.0369,-43], 65:[0.0977,-43],
                  60:[0.2357,-10],  55:[0.5314,30],   50:[1.066,75],   47.5:[1.40,92],
                  40:[3.501,143],   31:[9.30,218],    30:[9.851,221],  20:[22.52,308],
                  10:[47.39,385],    0:[92.10,462] }

// --- Rayleigh (derived: sigma_CO2(550) = 1.302e-30 m^2, N = 1.439e31 /m^2) ---
VENUS_TAU_RAYLEIGH_550        = 18.7        // whole atmosphere; Earth = 0.097
VENUS_TAU_RAYLEIGH_450        = 41.8
VENUS_TAU_RAYLEIGH_650        = 9.58
// tau to the surface from altitude h  =  TAU * P(h) / 92.1

// --- Colour (linear RGB) ---
VENUS_CLOUDTOP_ALBEDO_RGB     = [0.85, 0.69, 0.55]   // sRGB ~ #F0DAC5; V-band 0.689 per C4.1
VENUS_VISIBLE_CLOUD_CONTRAST  = 0.02                 // +/-1-3%. venus-cloud.jpg carries 0.205 (UV)
VENUS_UV_CLOUD_CONTRAST       = 0.30                 // real, if a labelled UV mode ships
VENUS_SURFACE_ILLUMINANT_RGB  = [1.00, 0.57, 0.20]   // sRGB ~ #FFC57B; matches the mosaic tint
VENUS_SKY_RGB                 = [1.00, 0.60, 0.25]   // uniform dome, no gradient
VENUS_SURFACE_ALBEDO          = 0.10                 // basalt, neutral under white light
VENUS_SURFACE_VIS_RANGE_KM    = 3.3                  // 1.5 blue / 3.3 green / 6.5 red

// --- Illuminance curve, alt_km: relative to above-cloud = 1.0 ---
VENUS_ILLUMINANCE = { 70:1.00, 65:0.60, 60:0.35, 55:0.15, 50:0.06,
                      47.5:0.04, 30:0.03, 0:0.02 }
VENUS_SOLAR_CONSTANT_WM2      = 2601.0      // 1361 / 0.7233^2

// --- Lighting fork (MANDATORY below the deck; see section 3 Rule 1) ---
VENUS_DIRECTIONAL_FADE_TOP_KM = 72.0        // full Sun direction above
VENUS_DIRECTIONAL_FADE_END_KM = 66.0        // fully diffuse below; stays diffuse to 0 km
VENUS_USE_NORMAL_MAP          = false       // venus-normal.jpg is radar-derived. Never bind it
VENUS_USE_SELF_SHADOW         = false       // C4.3's ray-march must be gated off for Venus

// --- Super-rotation ---
VENUS_SIDEREAL_PERIOD_S       = -2.0997e7   // 243.025 d, retrograde
VENUS_CLOUDTOP_PERIOD_S       = -3.8464e5   // 4.45 d, retrograde (same sense)
VENUS_SUPERROTATION_FACTOR    = 54.6
VENUS_WIND_MS = { 70:100, 60:85, 50:60, 40:35, 20:10, 10:2, 0:0.6 }
VENUS_SHELL_ROTATION_ACCEL    = 1.0e3       // = ROTATION_TIME_ACCEL; ratio preserved
VENUS_DESCENT_ADVECTION_ACCEL = 1.0         // REAL TIME. 1e3 would be 0.033c

// --- Descent pacing (seconds, total 20.0) ---
VENUS_DESCENT_TOTAL_S         = 20.0        // ~170x compression of a real 55-62 min probe descent
VENUS_DESCENT_SEGMENTS = [ { from:100.0, to:70.0,  s:3.5  },
                           { from:70.0,  to:47.5,  s:10.0 },   // the feature
                           { from:47.5,  to:31.0,  s:4.5  },
                           { from:31.0,  to:20.0,  s:2.0  } ]
VENUS_DESCENT_END_ALT_KM      = 20.0        // do NOT land; the map only reads from altitude
VENUS_DESCENT_REPEAT_S        = 6.0         // abbreviated on subsequent arrivals; skippable

// --- Shell radii at C4.1's PLANET_SPHERE_RADIUS = 26 ---
VENUS_SHELL_SURFACE_WU        = 26.000
VENUS_SHELL_CLOUD_BASE_WU     = 26.204
VENUS_SHELL_CLOUD_TOP_WU      = 26.301      // whole deck = 0.0967 wu. Depth precision matters
```

### Cross-references

- Prompted by `docs/test-reports/TR-076.md` Part 7 (owner decision, 2026-07-21) and
  `docs/delivery-plan/PF-10-gaia-dataset-realism.md` phase C4.2.
- Builds on `docs/analysis/2026-07-21-planetary-sphere-topography-science-brief.md` (C4.1) for the
  sphere, the equirectangular UV convention, the 180°E longitude origin, the geometric albedos, and
  `ROTATION_TIME_ACCEL = 1e3`.
- **Supersedes** that brief's §6 recommendation to "render the bland cloud deck and put the radar
  topography in the dossier." That paragraph stands as written and dated; §8.4 above records why the
  owner's framing is the better call and what changed my assessment.
- `TIME_ACCEL = 4×10⁵` (belt orbits) inherited from
  `docs/analysis/2026-07-20-dr3-asteroid-belt-science-brief.md` §4 — **not applicable here**.
- Three items should be recorded by Procyon in an ADR or the license ledger rather than only here:
  the **radar-as-declared-instrument-view** decision, the **Venus lighting fork** (a body-specific
  departure from C4.1's shared shading model), and the **descent time compression**. This brief is
  the evidence, not the decision record.
