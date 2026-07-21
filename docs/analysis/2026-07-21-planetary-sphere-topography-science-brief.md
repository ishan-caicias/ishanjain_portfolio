# Science Brief — Planetary spheres: elevation, encoding, lighting, rotation, body selection

**Date:** 2026-07-21
**Mode:** SCIENCE-BRIEF (with per-decision REALISM-AUDIT verdicts)
**Requested by:** Procyon, for PF-10 phase C4 — "Texture & surface-data upgrade", re-scoped from
an atlas swap to **real sphere meshes with real topography** for the solar-system bodies.

Every number below was **measured from the actual files** or derived from stated constants, not
recalled. Where the brief corrects the request, it says so.

---

## 0. Corrections to the stated asset inventory (read first)

| Stated in request                                            | Actual, measured                                                                                                                                                                                                                                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `tex/base/` holds 105 files                                  | **56 files** in `base/`; 104 across the whole `tex/` tree (incl. `cubemap/`, `skybox/`)                                                                                                                                                                |
| Surface/normal maps for callisto, enceladus, uranus, neptune | **None of these four exist.** `moons.json` references `callisto-diffuse`/`callisto-height`, `enceladus-normal`, and `planets.json` references `uranus`/`neptune` diffuse — the files are absent from the pack                                          |
| mars-height-ultra 8192×4096                                  | ✔ confirmed, 8-bit, 3-channel, **R=G=B verified across all 33.5 M pixels** (true greyscale)                                                                                                                                                            |
| earth-height-ultra 21600×10800                               | ✔ confirmed — but **median byte = 0**: it is a land-only map, sea level clamped to 0                                                                                                                                                                   |
| "no sphere meshes anywhere in the renderer"                  | Nearly right. No **body** sphere. Two non-body spheres exist: the Milky Way background sphere (`babylon-engine.ts:2350`, `infiniteDistance`) and the icosphere asteroid rocks (`:3543`). The rocks already prove the lit-`StandardMaterial` path works |

**Only four bodies in the pack ship a height map at all: Mars, Moon, Mercury, Earth.** Every
other body (Io, Europa, Ganymede, Titan, Pluto, Rhea, Dione, Tethys, Ceres, Phobos, Deimos)
ships a _normal_ map and no elevation. Mars notably has **no** normal map — it must be derived.

Measured height-map histograms (full-frame, not sampled):

| File                       | Dimensions  | Greyscale | Range | Levels used | Mean  | Median |
| -------------------------- | ----------- | --------- | ----- | ----------- | ----- | ------ |
| `mars-height-ultra.jpg`    | 8192×4096   | yes       | 0–255 | 256/256     | 109.4 | 118    |
| `moon-height-ultra.jpg`    | 8192×4096   | yes       | 0–255 | 256/256     | 111.6 | 106    |
| `mercury-height-ultra.jpg` | 8192×4096   | yes       | 0–255 | 256/256     | 134.3 | 136    |
| `earth-height-ultra.jpg`   | 21600×10800 | yes       | 0–255 | 256/256     | 18.5  | **0**  |

All three channels are identical, so the files carry **zero information in G and B** — they cost
3× the decode bandwidth of the data they hold. That matters in §2.

---

## 1. Elevation scale and exaggeration

**Verdict: true-scale displacement is invisible on the silhouette at any size this scene will
render — but true-scale _shading_ is highly visible. Exaggerate nothing. Recommended factor
1.0 for both bodies.**

### The geometry

| Body    | Radius R  | Real relief span        | span/R     |
| ------- | --------- | ----------------------- | ---------- |
| Mars    | 3389.5 km | −8.2 → +21.9 = 30.1 km  | **0.888%** |
| Moon    | 1737.4 km | −9.1 → +10.8 = 19.9 km  | **1.145%** |
| Mercury | 2439.7 km | −5.4 → +4.48 = 9.9 km   | 0.405%     |
| Earth   | 6371.0 km | −10.9 → +8.85 = 19.7 km | 0.310%     |

A sphere of screen diameter **D** pixels has radius D/2 px, so a relief feature of height h
deviates the limb by `(h/R)·(D/2)` pixels.

| Body    | D for 1 px deviation, **full span** (Olympus↔Hellas, both on the limb — never happens) | D for 1 px deviation, **typical local relief** (the honest case) |
| ------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Mars    | 225 px                                                                                 | **2260 px** (±3 km local)                                        |
| Moon    | 175 px                                                                                 | **695 px** (±5 km local)                                         |
| Mercury | 494 px                                                                                 | 2440 px                                                          |
| Earth   | 645 px                                                                                 | 4247 px                                                          |

The "full span" column is a trap: it requires the single highest and single lowest points on the
planet to sit on the limb simultaneously. The operative column is the second. So:

- **Mars needs to be 2260 px across** — wider than a 1080p screen is tall — before true-scale
  topography bends the silhouette by a single pixel. **True-scale Martian relief is never
  visible on the Mars silhouette in this portfolio.** Not "subtle": below the sampling grid.
- **The Moon is the interesting case.** At 695 px the lunar limb deviates by 1 px, and at
  ~1400 px by 2 px. This is real: lunar limb profiles genuinely _are_ irregular, which is why
  grazing-occultation timing works as an observational technique. A large, close Moon with
  true-scale displacement shows a faintly ragged limb — and that is an honest thing to show.

### Why this does _not_ mean "exaggerate to compensate"

Silhouette is one channel. **Shading is the other, and it is scale-free.** Surface shading
depends on the _slope_ `dh/dx`, which does not contain R at all. At true scale the shading is
already correct and already vivid, especially near the terminator. Nothing needs help.

This is the crux of the recommendation: **exaggeration multiplies slope, and slope is directly
observable.** Doubling the height map doubles every surface gradient — a 5° Olympus flank
becomes 10°, crater walls become cliffs. The silhouette gains a pixel; the shading acquires a
lie across the entire visible disc. That is a bad trade in both directions.

### Recommended factors

| Use                                             | Mars      | Moon      | Rationale                                                    |
| ----------------------------------------------- | --------- | --------- | ------------------------------------------------------------ |
| **Normal map / slope**                          | **1.0**   | **1.0**   | Slope is observable and scale-free. Never exaggerate.        |
| **Vertex displacement**                         | **1.0**   | **1.0**   | Honest; costs nothing to be right                            |
| Acceptable declared license (displacement only) | ≤ 2.0     | ≤ 2.0     | Defensible if the owner wants limb texture; must be declared |
| **Starts being a lie**                          | **≥ 3.0** | **≥ 3.0** | At 3× Mars's relief is 2.7% of radius; at 5×, 4.4%           |

Critically: **if a license factor is taken, apply it to displacement only and leave the normal
map at 1.0.** Decoupling them is trivial in the shader and it keeps the surface shading true
while the limb is stylised. That is a much more defensible license than scaling both.

### The visual tell that a scene has overdone it

Four, in order of how quickly a knowledgeable viewer catches them:

1. **A visibly bumpy limb.** In every real spacecraft image of Mars — Viking, MRO, Hubble — the
   limb is a _clean circular arc_. If you can see the mountains on the edge of the disc from a
   normal viewing distance, it is overdone. This is the single reliable tell.
2. **Golf-ball craters.** Real craters are shallow: a lunar crater's depth/diameter ratio is
   ~1:5 for small simple craters and drops to ~1:50 for large complex ones. Exaggeration turns
   them into hemispherical dimples and the surface reads as hammered metal.
3. **Shadows longer than the landform is wide.** At the terminator, an exaggerated peak casts a
   shadow whose length is inconsistent with the width of the feature casting it. The eye is
   very good at this even when it cannot say why.
4. **Olympus Mons reading as a spike.** Olympus Mons is 600 km wide and 22 km tall — an average
   flank slope of about **5°**. It is a _shield_, almost a plateau. Any render where it looks
   like a cone is wrong by construction.

---

## 2. Height map encoding — 8 bits, and it is worse than it looks

**Verdict: SIMPLIFIED for Mars/Earth, BROKEN PHYSICS for the Moon and Mercury as shipped. It
will visibly terrace. The MOLA virtual texture makes terracing _worse_, not better.**

### The ramp convention is documented in the pack — do not guess it

`default-data/planets.json` and `moons.json` ship Gaia Sky's own `heightScale`, in **km**, with
the convention `elevation = (byte/255) · heightScale`:

| Body     | `heightScale` | Source line        | m per byte level |
| -------- | ------------- | ------------------ | ---------------- |
| Mercury  | 1.2848 km     | `planets.json:41`  | **5.0 m**        |
| Earth    | 8.848 km      | `planets.json:160` | **34.7 m**       |
| Mars     | **21.287 km** | `planets.json:236` | **83.5 m**       |
| Moon     | 5.5 km        | `moons.json:40`    | **21.6 m**       |
| Callisto | 5.0 km        | `moons.json:311`   | (asset missing)  |

I verified the Mars ramp is a **full-relief** ramp, not a datum-referenced one, by locating the
extrema: the darkest 0.001% of `mars-height-ultra.jpg` centroids at **lat −36.5°, lon 64.3°E**
(Hellas Planitia, real centre 42.4°S / 70°E, floor −8.2 km) and the brightest at
**lat −7.4°, lon 254.9°E** (the Tharsis rise / Arsia–Pavonis shield complex, the highest terrain
on the planet). Byte 0 = Hellas floor, byte 255 = Tharsis summit. The texture's left edge is
**lon 180°E**, not 0°E — worth knowing before any UV work.

### Two of the four `heightScale` values are artistic, not physical

| Body    | Gaia Sky `heightScale` | Real relief span | Ramp covers | Verdict                                                                                                 |
| ------- | ---------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------------------- |
| Mars    | 21.287 km              | 30.1 km          | **71%**     | Near-physical (≈ Olympus above datum)                                                                   |
| Earth   | 8.848 km               | 19.7 km          | 45%         | Physical **for land** (= Everest exactly); ocean is clamped to 0, confirmed by the measured median of 0 |
| Moon    | 5.5 km                 | 19.9 km          | **28%**     | **Artistic — under-scales real lunar relief by 3.6×**                                                   |
| Mercury | 1.2848 km              | 9.9 km           | **13%**     | **Artistic — under-scales by 7.7×**                                                                     |

So the Moon and Mercury, used as shipped, render _flatter than reality by a large factor_ — the
opposite of the exaggeration risk §1 warns about. If C4 ships Gaia Sky's constants unchanged and
describes the result as real topography, that is the accidental-wrongness case. **Recalibrate
the Moon to 19.9 km and Mercury to 9.9 km**, or declare the compression.

### Vertical quantization, and why it terraces

The damaging quantity is not metres per level, it is the **minimum representable slope**:
`atan(m_per_level / ground_distance_per_texel)`.

| Body    | Equator km/texel (8K) | m/level | **Min. slope step (8K base map)** |
| ------- | --------------------- | ------- | --------------------------------- |
| Mars    | 2.600                 | 83.5    | **1.84°**                         |
| Moon    | 1.333                 | 21.6    | **0.93°**                         |
| Mercury | 1.871                 | 5.0     | 0.15°                             |
| Earth   | 1.853                 | 34.7    | 1.07°                             |

Mars is the problem child. Over most of the planet, real terrain slopes at a 2.6 km baseline are
**well under 1°** — the northern lowlands are famously among the flattest surfaces in the solar
system. Such terrain cannot produce a non-zero gradient at all: it quantizes to flat, punctuated
by 1.84° cliffs wherever the ramp happens to cross a level boundary. That is textbook terracing —
the surface reads as a **contour map with visible steps**, and derived normals turn those steps
into hard specular creases running along the contours.

**Yes, 8 bits will visibly band, and derived normals are where it shows, not the displacement.**

### The MOLA virtual texture does not fix this — it makes it worse

Measured: **the MOLA VT tiles are 8-bit, 3-channel JPEG, identical in encoding to the base map**
(`vt-mars-topography-mola/tex/level5/tx_0_0.jpg` → 1024×1024, precision 8, 3 components,
greyscale). The pyramid buys **spatial** resolution only; the vertical ramp is unchanged.

| Layer              | Width      | km/texel  | Min. slope step |
| ------------------ | ---------- | --------- | --------------- |
| Mars base map      | 8,192      | 2.600     | 1.84°           |
| **MOLA VT level5** | **65,536** | **0.325** | **14.41°**      |
| Moon base map      | 8,192      | 1.333     | 0.93°           |
| **LOLA VT level4** | **32,768** | **0.333** | **3.70°**       |

Shrinking the horizontal baseline 8× while holding the vertical step fixed multiplies the
minimum slope step 8×. At MOLA level5 the smallest expressible non-flat gradient is **14.4°** —
larger than almost every real slope on Mars. The consequence is stark and I measured it directly:
a typical mid-latitude level5 tile (`tx_15_20.jpg`) spans **only 14 distinct byte values across
the entire 1024×1024 tile** — 14 elevation levels over 333 km of ground. Another (`tx_16_30.jpg`)
spans 11. Naively normal-mapping from that produces a staircase of ~24-texel-wide plateaus
separated by 14° cliffs.

This is worth stating plainly for the delivery plan: **the 64K MOLA pyramid is a
high-resolution _horizontal_ dataset with low-resolution _vertical_ data.** It is excellent for
displacing large landforms and useless as a direct source of fine surface normals. The original
LOLA product, per the pack's own `dataset.json`, is _signed 16-bit in half-metres_ (0.5 m
quantization, reference sphere 1737.4 km) — Gaia Sky's JPEG conversion discarded a factor of
**~43** in vertical precision for the Moon and more for Mars.

### The standard mitigation, and the one I recommend

The standard fixes, in ascending order of cost:

1. **Hardware bilinear sampling** — already free, and it does more than people expect: it
   interpolates continuously _between_ quantized texels, so the terrace _plateaus_ become ramps.
   It converts stair-steps into faceting. Necessary but not sufficient.
2. **Wide-baseline Sobel.** Derive the normal from texels ±3 to ±4 apart rather than ±1. The
   quantization error is fixed at ±½ level while the baseline grows, so the slope error falls
   linearly with the baseline. At ±4 texels on Mars the slope step drops from 1.84° to **0.46°**,
   below the perceptual threshold. Costs nothing but a wider tap pattern.
3. **Dither at bake time.** Add ±½-level triangular noise before differentiating; it converts
   coherent terrace edges (which the eye locks onto) into incoherent grain (which it does not).
4. **16-bit elevation.** Pack the height into two 8-bit channels — and since the shipped files
   are verified R=G=B, **the G and B channels are free carriers already present in the file**.
   Not available from these assets as-is, but the right target if the source DEMs are ever
   re-converted.

**Recommendation: bake the normal maps offline, once, at build time.** Decode the height JPEG to
float, apply the wide-baseline Sobel with dither at full precision, and ship an 8-bit RGB normal
map. This is the correct split because **quantization error in a height field is
catastrophic — heights are differentiated — while quantization error in a normal map is
benign — normals are consumed directly.** 8 bits per normal channel is ~0.4° of angular
precision, entirely adequate. One offline step removes the entire terracing class at zero
runtime cost, and Mars needs a normal map baked anyway since the pack ships none.

---

## 3. Normal mapping vs vertex displacement

**Verdict: normal map for everything. Displacement earns its place on exactly one body (the
Moon) at close range. The real prize is neither — it is terminator self-shadowing.**

§1 already gives the silhouette answer: displacement changes the limb by less than a pixel until
Mars is 2260 px across and the Moon is 695 px across. Below those sizes, vertex displacement is
**provably invisible** — it moves vertices by sub-pixel distances and the normal map already
supplies every shading cue. The comparison is not close.

### Where the difference actually becomes visible

Three thresholds, in the order they arrive as the visitor approaches:

| Screen size (body diameter)       | What appears                                                     | Needs                           |
| --------------------------------- | ---------------------------------------------------------------- | ------------------------------- |
| any size                          | Surface shading, crater relief, Valles Marineris, maria contrast | **Normal map**                  |
| any size, **near the terminator** | Long cast shadows from rims and peaks                            | **Height-based self-shadowing** |
| **> ~700 px (Moon)**              | Faintly irregular limb                                           | Displacement                    |
| **> ~2260 px (Mars)**             | Faintly irregular limb                                           | Displacement                    |

The middle row is the one worth spending on, and it is the answer to "when does the lack of a
displaced silhouette give it away" — **it doesn't; the lack of cast shadows does.** A normal map
lights a slope but never occludes the slope behind it, and near the terminator that omission is
glaring, because grazing illumination is precisely the regime where real topography stops being
shading and becomes geometry.

The magnitude is large. A 3 km crater rim with the Sun 1° above the local horizon casts a shadow
of `3/tan(1°) = 172 km`. On a 1000-px Moon (3474.8 km across) that is **50 pixels of hard black**.
This is the iconic lunar telescope view — the terminator is where all the detail lives — and it
is exactly what a normal-mapped sphere fails to produce. Vertex displacement does not fix it
either: displaced geometry only casts shadows if the renderer is casting shadows, which for a
self-shadowing sphere is an expensive shadow-map pass.

The cheap, correct answer is a **height-map ray-march self-shadow term**: march ~8–16 steps
along the light direction in tangent space and test whether any sample rises above the ray. This
is standard parallax-occlusion self-shadowing, it costs a small fixed number of texture taps, it
runs entirely in the fragment shader, and it produces real cast shadows from the real DEM. It is
also naturally free away from the terminator — the loop can be skipped entirely when
`N·L > ~0.3`, which is most of the disc most of the time.

### Recommended split

```
ALL BODIES        : geodesic sphere, no displacement, baked normal map
+ Mars, Moon, Mercury, Earth  : height-map self-shadow term, enabled only when N·L < 0.3
+ Moon only, LOD when screen diameter > 700 px : true-scale vertex displacement (limb only)
```

Vertex displacement on the Moon at close range is cheap if the tessellation is already there,
and it buys a genuinely real detail. Everywhere else it is budget spent on sub-pixel motion.

---

## 4. Lighting

**Verdict: a single directional light is ACCURATE. Lambertian is ACCURATE-ish for Mars and
BROKEN PHYSICS for the Moon. One formula fixes both.**

### Point source or parallel rays?

Parallel. Quantified — the Sun's angular diameter and the resulting terminator penumbra width:

| Body     | a (AU)     | Sun angular diameter | Terminator band | Width on a 1000-px disc |
| -------- | ---------- | -------------------- | --------------- | ----------------------- |
| Mercury  | 0.3871     | 1.377° (82.6′)       | 58.6 km         | 12.0 px                 |
| Venus    | 0.7233     | 0.737° (44.2′)       | 77.8 km         | 6.4 px                  |
| Moon     | 1.000      | 0.533° (32.0′)       | 16.2 km         | 4.7 px                  |
| **Mars** | **1.5237** | **0.350° (21.0′)**   | **20.7 km**     | **3.1 px**              |
| Jupiter  | 5.204      | 0.102° (6.1′)        | 124.9 km        | 0.9 px                  |
| Saturn   | 9.583      | 0.056° (3.3′)        | 56.5 km         | 0.5 px                  |
| Pluto    | 39.48      | 0.0135° (0.8′)       | 0.3 km          | 0.1 px                  |

So: **at Mars the Sun is a 21-arcminute disc and the terminator penumbra is 3 pixels wide on a
1000-px planet.** A Babylon `DirectionalLight` is correct to within 0.35°, which is well below
anything the render can resolve. Use one. Do not use a point light positioned at the Sun — it
would introduce a divergence the geometry does not have, and at these scales the inverse-square
falloff across a planet's diameter is negligible anyway.

The penumbra is worth a smoothstep rather than a hard step, and the physically-correct width is
the Sun's angular _radius_: soften over `|N·L| < sin(0.175°) = 0.00305` at Mars, `0.00465` at
the Moon. Both are small enough that a fixed `smoothstep(-0.005, 0.005, N·L)` is honest for the
inner solar system, and it eliminates a hard aliased terminator edge for free.

Note the trend in that table: **the terminator is sharper the further out you go.** At Pluto the
Sun is 0.8 arcminutes and the terminator is a knife edge. That is a real, quietly lovely detail.

### Phase behaviour

The visitor flies around these bodies, so they should see **real phases** — and this is the
single largest honest gain in C4 (see §7). Phase is not a special case in the shading; it falls
out of `N·L` with a directional light. What _does_ need care is that the phase angle is set by
the real Sun direction, not by the camera — a body should be a crescent when the visitor is
between it and the Sun, and full when the Sun is behind the visitor. A billboard sprite is
always "full" and cannot do this.

### Lambertian is wrong for the Moon, and famously so

This is the item in §4 I would not wave through.

A Lambertian sphere is strongly **limb-darkened**: brightness falls as `cos(incidence)`, so the
disc is bright at the centre and fades to the edge. The real full Moon does the opposite of
fading — it looks like a **flat, evenly-lit disc**, brightness nearly uniform right out to the
limb. Anyone who has looked at the Moon knows this shape even if they have never named it. A
Lambertian full Moon looks like a beach ball and reads as instantly wrong.

The cause is the lunar regolith: an extremely porous, fairy-castle structure of sharp-edged
grains that **backscatters** strongly — it returns light preferentially toward the source. Two
real consequences:

- **Uniform disc at full.** The limb-darkening cancels.
- **Opposition surge.** Brightness spikes sharply as phase angle → 0. The Moon at full is roughly
  **1.35–1.4× brighter** than an extrapolation from phase angle 5° predicts, driven by shadow
  hiding and coherent backscatter. The knock-on: **the half Moon is only ~8–9% as bright as the
  full Moon**, not the ~50% a Lambertian intuition suggests. This is a real, checkable number.

The standard implementable fix is the **Lunar-Lambert law** — one formula covering both bodies
with a single tunable parameter:

```
mu0 = max(dot(N, L), 0.0);     // cos(incidence)
mu  = max(dot(N, V), 0.0);     // cos(emission)

// Lommel-Seeliger term (backscatter) blended with Lambert
I = albedo * ( 2.0 * L_param * mu0 / (mu0 + mu + 1e-4)
             + (1.0 - L_param) * mu0 );
```

- `L_param = 1.0` → pure **Lommel-Seeliger**: correct for the Moon, Mercury, and airless
  regolith bodies. Produces the flat full-disc.
- `L_param ≈ 0.5–0.6` → correct for **Mars**, which is dusty but far less backscattering and
  shows only mild limb darkening.
- `L_param = 0.0` → pure Lambert: correct for nothing here, but a useful A/B toggle.

Cost is one divide. It is strictly cheaper than a PBR BRDF and strictly more correct for these
surfaces than either Lambert or GGX, neither of which describes regolith.

An opposition surge term is optional and cheap if wanted:
`surge = 1.0 + 0.4 * exp(-phase_deg / 3.0)`, peaking at +40% at zero phase with a ~3° half-width.
Only visible when the Sun is directly behind the camera. Recommended for the Moon; skip elsewhere.

### Real albedos — correcting the request

The request's figures conflate two different quantities. Both numbers quoted were **Bond**
albedos, not geometric:

| Body     | **Geometric albedo (V)** | Bond albedo | Request said                                    |
| -------- | ------------------------ | ----------- | ----------------------------------------------- |
| **Mars** | **0.170**                | **0.25**    | "~0.25 geometric" → that is the **Bond** albedo |
| **Moon** | **0.136**                | **0.11**    | "~0.12" → that is the **Bond** albedo           |
| Mercury  | 0.142                    | 0.088       | —                                               |
| Venus    | 0.689                    | 0.76        | —                                               |
| Earth    | 0.434                    | 0.306       | —                                               |
| Io       | 0.63                     | 0.56        | —                                               |
| Europa   | 0.67                     | 0.62        | —                                               |
| Ganymede | 0.43                     | 0.35        | —                                               |
| Titan    | 0.22                     | 0.265       | —                                               |
| Rhea     | 0.65                     | 0.48        | —                                               |
| Dione    | 0.66                     | 0.52        | —                                               |
| Pluto    | 0.52–0.72                | 0.41        | —                                               |
| Ceres    | 0.090                    | 0.034       | —                                               |
| Phobos   | 0.071                    | 0.03        | —                                               |
| Deimos   | 0.068                    | 0.03        | —                                               |

For a renderer, **geometric albedo is the right one** — it is defined as the body's brightness at
zero phase relative to a perfect Lambertian disc, which is exactly the reflectance the shader is
modelling. Bond albedo is a whole-sphere energy-balance quantity used for thermal work.

**Implementation note that matters more than the numbers:** the Gaia Sky textures are
contrast-stretched visualisations, not calibrated reflectance maps. Multiplying an already-bright
texture by the albedo would double-count. The honest approach is to **normalise each texture so
its mean luminance equals the body's geometric albedo**, computed once at bake time. That single
step makes the _relative_ brightness of bodies correct — and the result is a genuinely true
statement the atlas cannot make: **Europa is ~5× more reflective than the Moon, and Phobos is
~2× darker than fresh asphalt.** Those contrasts are real, large, and currently absent.

---

## 5. Rotation

**Verdict on sharing TIME_ACCEL = 4×10⁵: absurd, and not marginally — Mars would spin 4.5 times
per second and alias. Use a separate rotation clock at ~1×10³.**

### Real constants

Sidereal rotation periods and axial tilts (obliquity to orbit), for direct use:

| Body     | Sidereal period               | Axial tilt                         | Notes                    |
| -------- | ----------------------------- | ---------------------------------- | ------------------------ |
| Mercury  | 58.646 d                      | 0.034°                             | 3:2 spin–orbit resonance |
| Venus    | **−243.025 d**                | 177.36°                            | **retrograde**           |
| Earth    | 23.9345 h                     | 23.44°                             |                          |
| **Mars** | **24.6230 h** (24h 37m 22.7s) | **25.19°**                         | strikingly Earth-like    |
| Jupiter  | 9.925 h (System III)          | 3.13°                              |                          |
| Saturn   | 10.656 h                      | 26.73°                             |                          |
| **Moon** | **27.321661 d**               | 6.68° to orbit (1.54° to ecliptic) | **synchronous**          |
| Io       | 1.769138 d                    | ~0°                                | synchronous              |
| Europa   | 3.551181 d                    | ~0.1°                              | synchronous              |
| Ganymede | 7.15455 d                     | ~0.33°                             | synchronous              |
| Titan    | 15.945 d                      | ~0.3°                              | synchronous              |
| Pluto    | **−6.38723 d**                | 122.53°                            | retrograde, extreme tilt |
| Ceres    | 9.074 h                       | 4.0°                               |                          |

**Frame:** rotation is about the body's own spin axis, and the axis must be expressed in the
scene's frame. Since the DR3 belt brief (2026-07-20, §2) established that the scene's catalog
frame is **equatorial J2000**, the correct construction is to build each body's pole from its
IAU right ascension/declination of the north pole (`α₀, δ₀`) directly in equatorial coordinates
— not from the "tilt" column, which is an angle relative to each body's _own orbit_ and is not
directly usable as a scene rotation. Tilt is the physically meaningful number; `α₀/δ₀` is the
implementable one. Mars, for reference, is `α₀ = 317.68°, δ₀ = 52.89°`.

Two bodies must be **retrograde** (Venus, Pluto) and that is a real, visible, free detail.

### Why 4×10⁵ is absurd here

At TIME_ACCEL = 4×10⁵ (4.63 days per wall-clock second):

| Body        | Wall-clock per rotation | Rotations/s | **Degrees per frame @ 60 fps** |
| ----------- | ----------------------- | ----------- | ------------------------------ |
| **Mars**    | **0.222 s**             | **4.51**    | **27.1°**                      |
| Earth       | 0.215 s                 | 4.64        | 27.9°                          |
| **Jupiter** | **0.089 s**             | **11.20**   | **67.2°**                      |
| Ceres       | 0.082 s                 | 12.24       | 73.5°                          |
| Io          | 0.382 s                 | 2.62        | 15.7°                          |
| Moon        | 5.90 s                  | 0.17        | 1.0°                           |
| Mercury     | 12.67 s                 | 0.08        | 0.5°                           |

Mars completes **4.5 rotations every second**. Beyond being unreadable, it is **past the Nyquist
limit for the display**: 27.1° of rotation per frame means surface features move most of a
hemisphere between samples, producing the wagon-wheel effect — the planet will appear to rotate
_backwards_, or judder, or stand still, depending on the exact frame timing. Jupiter at 67°/frame
is pure aliasing noise. This is not "too fast to enjoy"; it is a sampling failure that makes the
8K texture and the entire topography effort invisible.

The rough limit for clean rotation is ~2°/frame at 60 fps → 120°/s → **0.33 rev/s**. Even that is
faster than anyone would want to read a surface.

### Recommendation

A **separate rotation clock**, `ROTATION_TIME_ACCEL = 1.0e3`, giving:

| Body     | Wall-clock per rotation @ 1×10³ |
| -------- | ------------------------------- |
| Ceres    | 32.7 s                          |
| Jupiter  | 35.7 s                          |
| Saturn   | 38.4 s                          |
| Earth    | 86.2 s                          |
| **Mars** | **88.6 s**                      |
| Io       | 152.9 s                         |
| Europa   | 306.8 s                         |
| Pluto    | 551.9 s                         |
| Ganymede | 618.2 s                         |
| Titan    | 1377.6 s (23 min)               |
| Moon     | 2360.6 s (39 min)               |
| Mercury  | 5067 s (84 min)                 |
| Venus    | 20997 s (5.8 h)                 |

Mars turns once in ~89 s — slow enough to read the surface, fast enough that a visitor who
lingers sees Valles Marineris rotate into view. Jupiter visibly spins in 36 s, which is _correct_:
Jupiter really does rotate 2.5× faster than Mars, and seeing that is real science, free.

The key property, inherited from the belt brief's §4 argument: **a single scalar `k` preserves
every real period ratio exactly.** The scene is not showing distorted rotation; it is showing
undistorted rotation on a redefined time unit. Every statement about relative spin rates stays
true. That is what makes one constant defensible and per-body fudging not.

### The honest caveat: the scene now has two clocks

`TIME_ACCEL = 4×10⁵` for belt orbits and `ROTATION_TIME_ACCEL = 1×10³` for spin differ by **400×**.
Strictly, that is internally inconsistent — a scene cannot have two rates of time. It is worth
naming rather than hiding:

- **Declare it:** _"orbital motion runs at 4×10⁵ and axial rotation at 1×10³; the two are never
  legible in the same frame, and each is internally consistent (all orbital ratios real, all
  rotation ratios real)."_
- The mitigating fact is real: at any camera distance where a planet's rotation is readable, the
  belt is not in frame; at any distance where belt motion is readable, the planet is a few pixels.
- Sharing 4×10⁵ is not an option — §5 shows it aliases.
- A distance-ramped clock (fast when far, slow when close) is _possible_ but trades a declared
  inconsistency for a hidden one, and I would not.

---

## 6. Which bodies are worth spheres

Ranked by what the real body plus the real available data actually delivers.

### Tier 1 — build these first; they carry the feature

| Body     | Assets                                             | Why it rewards a sphere                                                                                                                                                                                                                                                                                                                                   |
| -------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mars** | 8K surface, 8K height, **64K MOLA VT**             | The best case by a distance. Valles Marineris is 4,000 km long and 7 km deep — unmistakable, and it _needs_ relief to read. The crustal dichotomy (northern lowlands vs southern highlands, a ~5.5 km step across half the planet) is real, visible at true scale, and impossible on a billboard. Needs a baked normal map — the pack ships none for Mars |
| **Moon** | 8K surface, 8K height, 8K→ normal, **32K LOLA VT** | The photometry story (§4) and the only body where displacement earns its keep (§3). Terminator crater shadows are the iconic view. Also the one body every viewer can check against personal memory                                                                                                                                                       |

### Tier 2 — strong, once the path exists

| Body        | Assets                 | Verdict                                                                                                                                                                                                                                                                                                          |
| ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Jupiter** | 6000×3000 surface only | Sphere **yes**, despite having no surface — the visible cloud deck _is_ what you see, so the texture is honest. Two free real wins: the banding/GRS, and **oblateness of 0.06487** (equatorial 71,492 km vs polar 66,854 km). Scale the sphere's polar axis by 0.9351 and Jupiter is visibly, correctly squashed |
| **Io**      | 8K surface + normal    | The sulfur-volcanic palette is unlike anything else in the solar system and is real. Geometric albedo 0.63 — it should be _bright_                                                                                                                                                                               |
| **Europa**  | 8K surface + 8K normal | The lineae are a unique, instantly-recognisable surface, and at albedo 0.67 it is one of the most reflective bodies known. Renders dazzling, correctly                                                                                                                                                           |
| **Pluto**   | 8K surface + 8K normal | Sputnik Planitia — the "heart" — is real New Horizons imagery and hugely recognisable                                                                                                                                                                                                                            |
| **Mercury** | 8K surface + 8K height | Sphere yes, but **recalibrate `heightScale` from 1.2848 km to ~9.9 km** (§2) or it renders 7.7× too flat                                                                                                                                                                                                         |

### Tier 3 — cheap once the path exists, low information

**Ganymede, Rhea, Dione, Tethys, Ceres.** Grey cratered balls; at 4K–8K they are honest but
visually near-interchangeable. Build them if the sphere path is generic; do not spend on them.

### Do NOT sphere these — real reasons, not budget

| Body                    | Why not                                                                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Phobos, Deimos**      | **They are not spheres.** Phobos is 27×22×18 km, Deimos 15×12×11 km — both grossly irregular, both dominated by single craters (Stickney is 9 km across on a 22 km body). Mapping their textures onto a sphere is **BROKEN PHYSICS**: it renders the most famously non-spherical bodies available as balls. Keep as billboards, or import real shape models |
| **Uranus, Neptune**     | **No textures exist in the pack** (`planets.json` references them; the files are absent). Also genuinely near-featureless — Uranus is a blank cyan disc in visible light. A billboard is honest here                                                                                                                                                        |
| **Callisto, Enceladus** | **Assets absent** despite being referenced in `moons.json`                                                                                                                                                                                                                                                                                                  |
| **Saturn**              | Sphere only **if rings are in scope**. A ringless Saturn is less recognisable and less honest than a billboard that includes them. Its oblateness is 0.09796 — even more visible than Jupiter's — so it is a great sphere _when_ the rings land                                                                                                             |

### Two honesty flags on textures that exist

- **Venus** (`venus-ultra.jpg`): almost certainly a Magellan **radar** map. The real Venus in
  visible light is a **featureless pale-cream ball** — the cloud deck is opaque and no surface
  detail is visible at any wavelength the eye uses. Rendering the radar surface and labelling it
  "Venus" is a **declared license at best**. Recommend rendering the bland cloud deck (which is
  the truth) and putting the radar topography in the dossier where it can be explained.
- **Titan** (`titan-ultra.jpg` + cloud layer): same class of issue, milder. Titan's visible
  appearance is a **smooth orange haze ball with no surface detail whatsoever**; the surface map
  is a Cassini radar/near-IR composite seen through the haze. The pack ships a separate
  `titan-cloud.jpg` — compositing the haze _over_ the surface is the honest render, and it is
  also the more striking one.

---

## 7. The real phenomenon this unlocks

**Real phases and a real terminator.** This is the honest headline, and it is not a stretch.

A billboard sprite is always **full**. It is lit from the front, uniformly, forever, regardless of
where the visitor or the Sun is. That is not a small simplification — it is the single most
visually significant fact about how a body in space actually looks, and it is completely absent.

A sphere with a directional Sun gets it for free and gets it _right_:

- Fly between the Sun and Mars and it becomes a **crescent** — the phase angle set by real
  geometry, not by an artist.
- Approach from behind the Sun and it is fully lit.
- At any intermediate angle the terminator sweeps across the disc, and — this is the part that
  makes it worth the whole C4 effort — **the terminator is where topography becomes visible.**
  Away from it, grazing-light shading is subtle. At it, a 3 km crater rim with the Sun 1° up
  casts a 172 km shadow: **50 hard black pixels on a 1000-px Moon**. That is why every telescope
  observer looks at the terminator and never at the full Moon, and why every dramatic planetary
  image is shot near it. It requires all three of the new pieces at once — a sphere for the
  geometry, real elevation for the shadow lengths, and a real Sun direction for the grazing
  angle — and no two of them suffice.

Two more, both real, both cheap, in descending order of how much they reward a knowledgeable
viewer:

1. **The lunar opposition surge / flat full-Moon disc** (§4). A connoisseur detail: a genuinely
   non-Lambertian, famous, counter-intuitive photometric effect, correct for a real physical
   reason (regolith backscatter), that most 3D space scenes get wrong. Costs one divide. The
   checkable claim — _the half Moon is only ~9% as bright as the full Moon_ — is the kind of
   thing that makes an astronomer sit up.
2. **Gas-giant oblateness** (§6). Jupiter flattened by 6.5%, Saturn by 9.8%. Real, caused by
   rapid rotation, visible in every photograph, and implemented as a single axis scale. Pairs
   beautifully with the rotation work in §5 — the fast spinners are the squashed ones, and
   that is not a coincidence but the physics.

---

## Summary

| #   | Element                                | Verdict                         | Action                                                                                          |
| --- | -------------------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------- |
| 0   | Stated asset inventory                 | —                               | 56 base files not 105; callisto/enceladus/uranus/neptune **absent**; Mars has no normal map     |
| 1   | True-scale relief on the silhouette    | —                               | Invisible below D = 2260 px (Mars) / 695 px (Moon)                                              |
| 1   | Vertical exaggeration                  | **1.0 recommended**             | Never exaggerate the normal map; ≤2.0 on displacement only if declared; ≥3.0 is a lie           |
| 2   | 8-bit height, Mars/Earth               | SIMPLIFIED                      | Will terrace (1.84° min slope step on Mars); mitigate by baking normals offline                 |
| 2   | Gaia Sky `heightScale`, Moon & Mercury | **BROKEN PHYSICS**              | 5.5 km vs real 19.9 km (3.6× flat); 1.2848 km vs real 9.9 km (7.7× flat) — **recalibrate**      |
| 2   | MOLA/LOLA virtual textures             | **SIMPLIFIED, worse than base** | Also 8-bit JPEG — verified. Min slope step **14.41°** at level5. 64K horizontal, 8-bit vertical |
| 3   | Displacement vs normal map             | —                               | Normal map everywhere; displacement Moon-only above 700 px; **self-shadowing is the real win**  |
| 4   | Directional light                      | **ACCURATE**                    | Sun subtends 0.350° at Mars; terminator 3.1 px on a 1000-px disc                                |
| 4   | Lambertian on the Moon                 | **BROKEN PHYSICS**              | Use Lunar-Lambert, `L=1.0` Moon, `L≈0.55` Mars                                                  |
| 4   | Albedo figures in request              | —                               | Both quoted values were **Bond**; geometric are Mars **0.170**, Moon **0.136**                  |
| 5   | Sharing TIME_ACCEL = 4×10⁵             | **BROKEN PHYSICS**              | Mars = 4.5 rev/s, **27.1°/frame** — past Nyquist, aliases backwards                             |
| 5   | Separate rotation clock                | DECLARED LICENSE                | `ROTATION_TIME_ACCEL = 1e3`; preserves all real period ratios exactly                           |
| 6   | Phobos / Deimos as spheres             | **BROKEN PHYSICS if done**      | Grossly irregular bodies; keep as billboards                                                    |
| 6   | Venus radar map as "Venus"             | DECLARED LICENSE                | Real Venus is a featureless cream ball; render the cloud deck                                   |
| 7   | Real phases + terminator shadows       | **ACCURATE — the headline**     | Billboards are permanently "full"; this is the honest unlock                                    |

### Constants to implement

```
// --- Bodies: radii (km), relief, encoding ---
MARS_RADIUS_KM            = 3389.5
MARS_RELIEF_KM            = 30.1        // -8.2 (Hellas) .. +21.9 (Olympus)
MARS_HEIGHT_SCALE_KM      = 21.287      // Gaia Sky ramp: byte/255 * this; covers 71% of real span
MOON_RADIUS_KM            = 1737.4      // LOLA reference sphere, per dataset.json
MOON_RELIEF_KM            = 19.9        // -9.1 .. +10.8
MOON_HEIGHT_SCALE_KM      = 19.9        // RECALIBRATED (Gaia Sky ships 5.5 = 3.6x too flat)
MERCURY_HEIGHT_SCALE_KM   = 9.9         // RECALIBRATED (Gaia Sky ships 1.2848 = 7.7x too flat)
EARTH_HEIGHT_SCALE_KM     = 8.848       // land only; sea clamped to 0 (verified: median byte 0)

// --- Exaggeration ---
NORMAL_MAP_EXAGGERATION   = 1.0         // NEVER raise; slope is directly observable
DISPLACE_EXAGGERATION     = 1.0         // <=2.0 acceptable as declared license; >=3.0 is a lie

// --- Normal bake (offline, build time) ---
SOBEL_BASELINE_TEXELS     = 4           // drops Mars slope step 1.84 deg -> 0.46 deg
BAKE_DITHER_LEVELS        = 0.5         // +/- half a byte level, triangular

// --- Height texture UV ---
MARS_TEX_LON_ORIGIN_DEG   = 180.0       // verified: left edge is lon 180E, not 0E

// --- Lighting ---
SUN_ANGULAR_DIAM_MARS_DEG = 0.3497
SUN_ANGULAR_DIAM_MOON_DEG = 0.5329
TERMINATOR_SOFTEN         = 0.005       // smoothstep half-width on N.L, inner solar system
LUNAR_LAMBERT_L_MOON      = 1.0         // pure Lommel-Seeliger
LUNAR_LAMBERT_L_MARS      = 0.55
LUNAR_LAMBERT_L_MERCURY   = 1.0
OPPOSITION_SURGE_AMP      = 0.4         // Moon only; +40% at zero phase
OPPOSITION_SURGE_WIDTH    = 3.0         // degrees
SELF_SHADOW_NL_CUTOFF     = 0.3         // ray-march only near the terminator
SELF_SHADOW_STEPS         = 12

// --- Geometric albedos (V band) — normalise each texture's mean luminance to these ---
ALBEDO_GEOM = { mercury: 0.142, venus: 0.689, earth: 0.434, moon: 0.136, mars: 0.170,
                io: 0.63, europa: 0.67, ganymede: 0.43, titan: 0.22, rhea: 0.65,
                dione: 0.66, pluto: 0.60, ceres: 0.090, phobos: 0.071, deimos: 0.068,
                jupiter: 0.538, saturn: 0.499 }

// --- Rotation ---
ROTATION_TIME_ACCEL       = 1.0e3       // SEPARATE from the belt's TIME_ACCEL = 4e5
// sidereal period (s), negative = retrograde
ROT_PERIOD_S = { mercury: 5.0670e6, venus: -2.0997e7, earth: 8.6164e4, mars: 8.8643e4,
                 jupiter: 3.5730e4, saturn: 3.8362e4, moon: 2.3606e6, io: 1.5285e5,
                 europa: 3.0682e5, ganymede: 6.1815e5, titan: 1.3776e6,
                 pluto: -5.5186e5, ceres: 3.2667e4 }
MARS_POLE_RA_DEG          = 317.68      // IAU north pole, equatorial J2000
MARS_POLE_DEC_DEG         = 52.89

// --- Oblateness (scale the polar axis by 1 - f) ---
JUPITER_FLATTENING        = 0.06487
SATURN_FLATTENING         = 0.09796
MARS_FLATTENING           = 0.00589
```

### Cross-references

- Prompted by `docs/delivery-plan/PF-10-gaia-dataset-realism.md`, phase C4.
- Frame convention (equatorial J2000) and the `TIME_ACCEL = 4×10⁵` constant inherited from
  `docs/analysis/2026-07-20-dr3-asteroid-belt-science-brief.md` §2 and §4.
- Asset inventory context: `docs/analysis/2026-07-20-gaia-dataset-gap-analysis.md`.
- The billboard-only body rendering this replaces is GAP-01/GAP-02 in
  `docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md`.
- Three findings change engineering decisions and should be recorded by Procyon in an ADR or the
  license ledger: the recalibrated Moon/Mercury `heightScale`, the separate `ROTATION_TIME_ACCEL`
  (two clocks in one scene), and the decision on Venus/Titan surface-vs-cloud rendering. This
  brief is the evidence, not the decision record.
