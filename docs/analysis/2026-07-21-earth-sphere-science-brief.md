# Science Brief — Earth: photometry, night lights, clouds, ocean glint, and the atmosphere that is doing most of the work

**Date:** 2026-07-21
**Mode:** SCIENCE-BRIEF (with per-decision REALISM-AUDIT verdicts)
**Requested by:** Procyon, for PF-10 phase C4 — adding Earth as a real sphere alongside Mars, the
Moon, Mercury and the Venus fork.

Every number below was **measured from the actual files in
`resources/gaia_datasets/hi-res-textures/`**, computed from the engine's own constants, or derived
from stated physics. Where the brief corrects an earlier brief, it says so and does not edit the
earlier claim away.

**Read §0.2 before anything else.** A property of the arrival geometry, measured out of
`babylon-engine.ts` and `ship-dynamics.ts` this session, decides the answer to two of the seven
questions and changes the answer to two more. It is not a detail.

---

## 0. Measured facts (read before designing)

### 0.1 The assets — confirmed, plus four things the request did not know

| Asset                                          | Stated      | Measured                                                                                       |
| ---------------------------------------------- | ----------- | ---------------------------------------------------------------------------------------------- |
| `cubemap/earth-day-ultra/` (6 faces)           | 8192²       | ✔ 8192×8192, 3-channel, 8-bit                                                                  |
| `cubemap/earth-night-ultra/` (6 faces)         | 4096²       | ✔ 4096×4096 — **note the filenames use `earth_night_*`, underscore, not `earth-night-*`**      |
| `cubemap/earth-cloud-high/` (6 faces)          | 4096²       | ✔ 4096×4096, **R = G = B (single band replicated)**                                            |
| `base/earth-specular-high.jpg`                 | 8192×4096   | ✔, **R = G = B**, near-binary: 29.1 % below byte 16, 69.4 % above byte 239, 1.5 % in between   |
| `base/earth-normal-high.jpg`                   | 8192×4096   | ✔ — a **real, usable, un-terraced tangent-space normal map**. See §0.4                         |
| `base/earth-height-ultra.jpg`                  | 21600×10800 | ✔, R = G = B, mean byte 18.53, **median 0** (land-only, sea clamped) — as TR-078's brief found |
| `cubemap/earth-day-high/`, `earth-night-high/` | not stated  | **also present** — 4096² and 2048² fallback tiers, free `high`-tier sources                    |

Four measured findings that were not in the request:

1. **The day map is cloud-free.** Solid-angle-weighted fraction of the sphere above luminance 180
   is **3.56 %**, against a real permanent-ice cover of 3.17 % (Antarctica 2.74 % + Greenland
   0.43 %) plus bright desert. A map with clouds baked in would show 30 %+. It is a Blue-Marble-class
   surface product, and the separate cloud shell is therefore additive, not a duplicate.
2. **The specular map is a genuine ocean mask, and it is right.** Area-weighted (cos-latitude)
   fraction above byte 128 = **70.06 %**. Earth's real ocean fraction is **70.9 %**
   (361.9 × 10⁶ km² of 510.1 × 10⁶ km²). Agreement to 0.8 percentage points. This is not an
   artistic gloss map; it is the coastline.
3. **The night map has a hard non-zero floor and it is blue.** **Not one texel of the sphere is
   black** (exact-black fraction 0.000 %). 99.24 % of the solid angle sits at mean RGB
   **(9.5, 11.0, 16.7)**, modal blue byte 12–15. Only **0.149 %** of the sphere exceeds luminance
   100, and _those_ pixels are warm — mean RGB **(140.0, 135.5, 111.7)**, R > G > B, the real
   sodium/LED signature. **The lights are honest; the background is not.** See §2.
4. **The day map is atmospherically corrected, and this is the single most consequential
   measurement in the brief.** Sorted by luminance, the darkest 60 % of the sphere — the ocean —
   sits at RGB **(2.0, 5.0, 20.0)** out of 255. That is water-leaving reflectance with the air
   column removed. **Rendered raw with no atmospheric term, Earth's ocean is essentially black.**
   See §5.

### 0.2 The arrival geometry: **the phase angle is exactly zero, always**

This is measured out of the engine, not assumed.

```
ship-dynamics.ts:499   bodyWorldPosition()  ->  pos = dir * depth   (dir = normalize(pos))
babylon-engine.ts:4607 travelTo()           ->  camera parks at  b.pos - dir * ARRIVE_STANDOFF
planet-sphere.ts:236   sunDirectionFrom()   ->  sunDir = -normalize(bodyPos) = -dir
```

The camera parks at `pos − dir·38`, i.e. **between Sol and the body, on the Sun–body line**. The
Sun direction from the body is `−dir`. The direction from the body to the camera is `−dir`.

> **V = L. Phase angle α = 0.000°, for every body, every time.**

Free-look (`freeLookDir`, `_dragging`) changes **orientation only** — there is no camera
translation anywhere after arrival, and the sphere is `isVisible = false` except while parked. So
the sphere is _only ever_ drawn at zero phase.

The consequences are large and they are all measurable:

| Quantity                                 | Value at the parked camera                                                                |
| ---------------------------------------- | ----------------------------------------------------------------------------------------- |
| Sub-solar point                          | **coincides with the sub-camera point — dead frame centre**                               |
| N·L across the whole visible cap         | 1.000 (centre) → 0.684 (limb)                                                             |
| **N·L across the framed 23.5° patch**    | **1.000 → 0.979 — a 2.1 % variation**                                                     |
| μ (cos emission) across the framed patch | 1.000 → 0.824                                                                             |
| **Local phase angle across the frame**   | **= the off-axis screen angle**: 0° centre, 22.9° top/bottom edge, 40.8° at a 16:9 corner |
| Terminator                               | **never in frame** — it is 90° from the sub-camera point                                  |
| Night hemisphere                         | **100 % occluded by the body**                                                            |
| Specular (mirror) point                  | **exactly at the frame centre**                                                           |

Three things follow immediately, and the rest of this brief is mostly their consequences:

- **The night-lights texture cannot produce a single visible pixel** (§2).
- **The Lunar-Lambert coefficient is nearly inconsequential** — L = 0 and L = 1 differ by 0 % at
  the frame centre and 8.6 % at the frame edge (§1).
- **The ocean sunglint is guaranteed, centred, and unavoidable** (§4). This is the DSCOVR/EPIC
  geometry, which is exactly where the specular glint was published as a real Earth signature.

**Additive correction to the C4.1 brief.** `2026-07-21-planetary-sphere-topography-science-brief.md`
§7 names "real phases and a real terminator" as the honest headline of the whole C4 effort. That
claim was correct about the _physics of a sphere_ and wrong about _this scene's arrival
geometry_ — I did not check `travelTo` when I wrote it. **As shipped, no body in this scene ever
shows a phase or a terminator.** The earlier claim stands as written in its own document; this is
the dated correction. It is also the single highest-value item in this brief, because one
engineering change (§2's TRADEOFF) unlocks it, the night lights, the twilight band, and the cloud
shadows all at once.

### 0.3 The scene's fixed geometry, in numbers used throughout

| Quantity                                       | Value                                              |
| ---------------------------------------------- | -------------------------------------------------- |
| Sphere radius / camera standoff                | 26 / 38 world units                                |
| **1 world unit for Earth**                     | 6371 / 26 = **245.04 km**                          |
| Camera FOV (Babylon default 0.8 rad, vertical) | 45.84°                                             |
| Focal length at 1080p                          | 540 / tan(22.92°) = **1277 px**                    |
| Angular radius of the disc                     | asin(26/38) = **43.155°**                          |
| Central angle to the limb                      | acos(26/38) = **46.845°**                          |
| **Disc radius on a 1080p frame**               | 1277 · tan(43.155°) = **1198 px** (diameter 2397)  |
| Framed patch                                   | 23.5° of central angle across (PLANET_PATCH_DEG)   |
| **Screen scale at the frame centre**           | **48.3 px per degree of central angle**            |
| Depth quantum (24-bit, minZ 0.1, maxZ 6000)    | 8.6 × 10⁻⁵ wu at z = 12; 4.6 × 10⁻⁴ wu at z = 27.7 |

**The limb is off-screen** — 43.155° off-axis against a 22.92° half-FOV. The frame corner of a
16:9 view sits at 40.8° off-axis, so the limb misses the corner by **97 px**. Solving for the
aspect ratio at which the corner reaches 43.155° gives **a = 1.981**: on any display wider than
**≈ 2:1** (21:9 ultrawide, 2560×1080, 3440×1440) the limb _does_ clip the frame corners. Everything
narrower — 16:9, 16:10, every phone in portrait — never sees it. §5 depends on this.

### 0.4 `earth-normal-high.jpg` is real, and Earth is the one body that needs no normal bake

Measured on three 512² crops of the 8192×4096 map:

| Crop                    | Distinct R values | Typical slope (from mean \|x\|) | Max tilt (from min B) |
| ----------------------- | ----------------- | ------------------------------- | --------------------- |
| Himalaya (6076, 1410)   | **201 / 256**     | **2.69°**                       | 30.8°                 |
| Sahara (4700, 1250)     | 160 / 256         | 0.89°                           | 30.8°                 |
| S. Pacific (1500, 2400) | 9 / 256           | 0.00°                           | 16.1° (JPEG noise)    |

Whole-map channel stats: R mean 127.97 σ 4.41, G mean 127.07 σ 5.03, **B mean 253.89 σ 1.29, B min
209**. That is a true-scale normal map (mean tilt a few degrees, max 30.8° over a 4.9 km baseline,
which is right for the Himalaya) with **no terracing** — 201 of 256 levels used in a single
512² land crop.

Contrast with deriving normals from `earth-height-ultra.jpg`: heightScale 8.848 km / 255 =
**34.7 m per byte level**, and at 21600 px the equatorial texel is 40075/21600 = **1.855 km**, so
the minimum representable slope step is atan(34.7/1855) = **1.072°** — the same terracing class the
C4.1 brief measured on Mars.

> **Earth is the only body in this pack that ships a real elevation map AND a real normal map. Use
> the normal map and never differentiate the height map.** Set `uHasHeight = 0` for Earth and feed
> `earth-normal-high.jpg` through the shader's existing tangent-space detail path (the
> `detailTex` encoding — `rgb·2−1`, x = east, y = north, z = up — is already exactly this map's
> encoding). Zero bake work, zero terracing, and it is the shipped data rather than a derivative.

One accidental correctness worth naming rather than "fixing": the height map's **sea-level clamp
is right for Earth**. You are rendering the ocean _surface_, which is the geoid — flat by
definition. Bathymetry would be wrong here, not missing. Verdict **ACCURATE**, and no
recalibration (unlike the Moon's 3.6× and Mercury's 7.7× under-scale).

### 0.5 Resolution: the day cubemap holds exactly VT level 4 and not one texel more

A cube face of 8192 texels covers 90°, coarsest at the face centre: 90/8192 = 0.01099° per texel.
The equivalent equirectangular width at that density is **360/0.01099 = 32,768 px**.

| Source                      | Equirect-equivalent width | Texels across the 23.5° patch | Verdict vs. this camera         |
| --------------------------- | ------------------------- | ----------------------------- | ------------------------------- |
| `ultra` tier (8192)         | 8,192                     | 535                           | 2× magnified at 1080p           |
| **earth-day-ultra cubemap** | **32,768**                | **2,139**                     | **≈ VT level 4 exactly**        |
| earth-night / earth-cloud   | 16,384                    | 1,070                         | ≈ VT level 3                    |
| VT level 5 (not shipped)    | 65,536                    | 4,278                         | beyond what the camera resolves |

Per `planet-vt.ts`'s own table, level 4 is 4K parity and level 5 is unresolvable. **The Earth day
cubemap contains precisely the pyramid depth this camera can use, and baking it into the 8192
`ultra` tier throws away 4× linear resolution that is genuinely visible.** That is a real
tradeoff, quantified on both sides:

- **Realism side:** 2,139 vs 535 texels across the framed patch — a 4× sharpness difference on the
  one body every visitor has personally seen from orbit in photographs.
- **Engineering side:** an Earth _colour_ VT at levels 0–4 is 512 tiles of 1024² JPEG, ≈ 50–60 MB,
  against a `public/assets` already at ~221 MB (TR-077 Part 4, still open). It is also a **new
  pipeline**: Mars and the Moon stream _normals_ through `detailTex`; Earth would need colour
  streaming, which is a second consumer of the same streamer.

**Owner decision, not mine.** I will not pick, but I will state that the resolution gap is the
largest _visible_ difference available on this body and the asset cost is the largest _unbudgeted_
one. Shipping at `ultra` (8192) is defensible and is not a lie about anything; it is just soft.

---

## 1. Earth's photometry

**Verdict: the geometric albedo is fine but must not be applied to the surface map, because Earth's
0.434 is a two-layer number. The Lunar-Lambert `refl` formula holds — with L = 0 — but reusing
Mars's 0.55 or the Moon's 1.0 is BROKEN PHYSICS for a reason that has nothing to do with how it
looks at this camera.**

### 1.1 The real numbers

| Quantity                              | Value      | Source / basis                                                       |
| ------------------------------------- | ---------- | -------------------------------------------------------------------- |
| **Geometric albedo, V band (cloudy)** | **0.434**  | NASA Planetary Fact Sheet (Bond 0.306, V(1,0) −3.99)                 |
| Bond albedo (all-sky)                 | 0.306      | same                                                                 |
| Phase integral q = Bond / geometric   | 0.705      | derived                                                              |
| **Clear-sky Bond albedo**             | **0.15**   | standard climate figure (all-sky 0.30, clear-sky ~0.15)              |
| **Clear-sky geometric albedo**        | **0.213**  | 0.15 / 0.705                                                         |
| **Global-mean cloud albedo**          | **≈ 0.55** | closes the budget at f = 0.67; consistent with τ ≈ 10–20 water cloud |
| Mean radius                           | 6371.0 km  | IUGG mean; equatorial 6378.137, polar 6356.752                       |
| Flattening f                          | 0.00335281 | 1 / 298.257223563 (WGS-84)                                           |

**Budget check:** (1 − 0.67)·0.213 + 0.67·0.55 = 0.0703 + 0.3685 = **0.439**, against the real
0.434. Closes to 1 %.

**Second, independent check from the shipped cloud map.** The map's solid-angle-weighted mean
byte is 61.92 → 0.2428 raw. Treating that raw value as (coverage × cloud albedo) with a white
cloud gives (1 − 0.2428)·0.213 + 0.2428·1.0 = **0.404** — within **7 %** of the real 0.434, using
nothing but the measured asset and two literature albedos. (Linearising the cloud byte through
sRGB first gives mean 0.1010 and a composite of 0.293, **33 % low**.) That measurement settles a
question §3 would otherwise have to hand-wave: **the cloud map's byte is a coverage/reflectance
product and belongs in alpha raw, not sRGB-decoded.**

> ### The trap: `PLANET_ALBEDO["earth"] = 0.434` is wrong
>
> Earth is the first body in this scene whose geometric albedo is a **composite of two rendered
> layers**. Put 0.434 on the surface sphere _and_ draw a cloud shell over it and you have counted
> the clouds twice; the planet renders ~2× too bright and, worse, the _contrast_ between ocean and
> cloud collapses because the ocean has been lifted to cloud brightness.
>
> **The surface sphere takes 0.213. The cloud shell supplies the rest.** This deserves a comment in
> `PLANET_PHYSICAL`, whose `albedo` field is currently documented as "real GEOMETRIC albedo, V
> band" — true for every body so far and false for Earth.

### 1.2 The reflectance model — the `refl` formula holds, the coefficient does not

The shipped formula is

```
refl = 2·L·μ0 / (μ0 + μ)  +  (1 − L)·μ0
```

**It holds for Earth.** With **L = 0** it degenerates to pure Lambert, which is the right
first-order model for land (soil, vegetation, snow) and for optically thick cloud viewed near
backscatter. Nothing needs replacing.

**Why Mars's 0.55 or the Moon's 1.0 would be BROKEN PHYSICS, concretely.** The Lommel-Seeliger
term models **shadow hiding in a porous, sharp-grained regolith**: light entering a fairy-castle
structure is preferentially returned toward the source, which is why the full Moon is a flat
evenly-lit disc and the half Moon is only ~9 % as bright as full. **There is no regolith on
Earth's visible surface.** Water has no pore structure; a vegetation canopy has a hotspot but by a
different mechanism and a much smaller amplitude; a cloud is a multiple-scattering droplet slab.
Applying a regolith law to an ocean is the same class of error as lighting a radar map (TR-078
Part 2): a real formula, applied to a surface whose physics it does not describe, producing a
result that looks plausible.

The magnitude, at the illumination angles that matter:

| μ0 (cos incidence)         | μ (cos emission) | Lambert (L=0) | L = 0.55 (Mars)   | L = 1.0 (Moon)    |
| -------------------------- | ---------------- | ------------- | ----------------- | ----------------- |
| 1.00                       | 1.00             | 1.000         | 1.000             | 1.000             |
| 0.979 (frame edge, α = 0)  | 0.824            | 0.979         | 1.031 (+5.3 %)    | 1.063 (+8.6 %)    |
| 0.50                       | 1.00             | 0.500         | 0.592 (+18 %)     | 0.667 (+33 %)     |
| **0.20 (terminator zone)** | 1.00             | **0.200**     | **0.273 (+37 %)** | **0.333 (+67 %)** |

And Earth's real behaviour at high incidence runs the _other_ way from Lommel-Seeliger only right
at the end. Clear-sky global horizontal irradiance tracks cos(solar zenith) remarkably well —
because diffuse skylight fills in as the direct beam is extinguished:

| Solar zenith | Elevation | Clear-sky GHI     | cos(SZA) × 1000 | ratio to Lambert |
| ------------ | --------- | ----------------- | --------------- | ---------------- |
| 0°           | 90°       | ~1000 W/m²        | 1000            | 1.00             |
| 60°          | 30°       | ~500              | 500             | 1.00             |
| 78°          | 12°       | ~180              | 208             | 0.87             |
| 85°          | 5°        | ~70               | 87              | 0.80             |
| 90°          | 0°        | ~15 (all diffuse) | 0               | —                |

> **Earth is Lambertian in illumination to within 13–20 % all the way to 5° of sunrise.** The last
> few degrees are dominated by the atmosphere's own scattered light — the twilight arc — which is
> an emission-side term, not a surface BRDF. So: **L = 0, plus the ocean specular of §4, plus the
> Rayleigh term of §5.** Three terms, each with a named mechanism, is the honest model. One
> regolith coefficient is not.

### 1.3 What this actually costs at the current camera

Be honest about it: **at α = 0 the choice of L changes the render by 0 % at the frame centre and
at most 8.6 % at the frame edge**, because N·L only varies from 1.000 to 0.979 across the entire
framed patch. The lighting term is doing almost nothing; what the visitor sees is very nearly the
raw texture.

That is an argument for getting L right (it is free) and against spending anything on refining it
further. It becomes a 37–67 % error the moment the arrival phase changes (§2's TRADEOFF).

---

## 2. Night lights

**Verdict: at the shipped arrival geometry, DO NOT SHIP THEM. The night hemisphere is 100 %
occluded, and any technique that makes city lights visible from phase 0 is manufacturing a view
that does not exist — the exact analogue of lighting the Magellan radar map. If the owner takes the
geometry change in §2.4, they become one of the best things in the scene, and here is exactly how
to composite them.**

### 2.1 The geometric fact first

At α = 0 the framed patch runs N·L ∈ [0.979, 1.000] and the _entire visible cap_ runs
N·L ∈ [0.684, 1.000]. The lowest N·L any pixel can reach is 0.684 — the sub-solar hemisphere,
brightly lit, at a point that is itself 46.8° outside the frame.

There is no exposure, no threshold, no soft mask that puts a city light on that screen. The only
ways to do it are to lie about the Sun direction, to lie about `N·L`, or to add the night map
unconditionally — and the third is the one that would ship, because it would look wonderful.

**BROKEN PHYSICS ranking: this is #1.** It is precisely the Venus failure mode. The map is real
data; the _view_ would be invented.

### 2.2 If the geometry changes: at what N·L, and how sharply

City lights become the dominant source when the ground's own illumination drops below them. The
real illuminance ladder (standard reference values):

| Condition                         | Sun elevation | Illuminance | Relative to noon |
| --------------------------------- | ------------- | ----------- | ---------------- |
| Full sun, overhead                | +90°          | 120,000 lux | 1                |
| Sunset / sunrise (sun at horizon) | 0°            | ~400 lux    | 3.3 × 10⁻³       |
| **End of civil twilight**         | **−6°**       | **3.4 lux** | 2.8 × 10⁻⁵       |
| End of nautical twilight          | −12°          | 0.008 lux   | 6.7 × 10⁻⁸       |
| End of astronomical twilight      | −18°          | 0.0006 lux  | 5 × 10⁻⁹         |
| Full moon                         | —             | 0.25 lux    | 2.1 × 10⁻⁶       |
| Lit urban street (for scale)      | —             | 5–50 lux    | —                |

Cities win at roughly **the end of civil twilight**, sun 6° below the local horizon. In N·L:

```
EARTH_NIGHT_ON   = -0.05   // sun ~3 deg below horizon: lights begin to register
EARTH_NIGHT_FULL = -0.20   // sun ~11.5 deg below horizon: lights fully dominant
nightMask = 1.0 - smoothstep(EARTH_NIGHT_FULL, EARTH_NIGHT_ON, dot(N, L));
```

**And note how wide that is compared with the terminator itself.** `TERMINATOR_SOFTEN = 0.005`
encodes the Sun's angular radius at 1 AU (sin 0.2665° = 0.00465) — a **0.0093-wide** band in N·L,
which on this render is 0.533° of arc = **26 px**. The night-lights ramp is 0.15 wide = 8.6° of arc
= **415 px**, and the physical civil-twilight band alone is 6° = **290 px**.

> **Earth's terminator is 11–33× softer than the Moon's, and the mechanism is completely
> different.** The Moon's terminator width is set by the Sun's disc. Earth's is set by its
> atmosphere. On the same 26-unit sphere at the same distance those are 26 px and 290–830 px.
> That is a real, checkable, rarely-rendered fact, and it is one smoothstep.
>
> Recommended dayside gate for Earth, replacing the shared `TERMINATOR_SOFTEN`:
> `dayside = smoothstep(-0.105, +0.02, dot(N, L))` — the civil-twilight band. A twilight
> **glow** term (the bright arc) can be added as
> `E_twilight(x) = 0.0033·exp(45.4·x)` for x = N·L < 0, fitted to the illuminance ladder above
> (0.33 % at sunset, 2.8 × 10⁻⁵ at civil-twilight end, within 4× at nautical).

### 2.3 Compositing: the floor must be subtracted, and the gain is a declared exposure

**Measured, and this decides the method:** not one texel of `earth-night-ultra` is black. 99.24 %
of the solid angle sits at RGB (9.5, 11.0, 16.7) — linear (0.0029, 0.0033, 0.0055), luminance
0.0034 — with a modal blue byte of 12–15. **Adding this map additively paints a uniform dim blue
wash across the whole night hemisphere, including the middle of the Pacific.** It reads as an
airglow or an atmosphere. It is a JPEG floor plus a baked ocean tint.

How badly? The shader's existing night-side ambient is `surface · uAlbedo · 0.06` = 0.1235 ×
0.213 × 0.06 = **0.00158** linear. The night map's floor alone is **0.0034** — **2.2× brighter
than the entire declared night-side ambient**. It would not be a subtle contamination; it would be
the dominant term.

```glsl
// Subtract the measured floor per channel, then lift. Never add the sample raw.
vec3 nightRaw  = texture2D(nightTex, tUV).rgb;
vec3 nightLit  = max(nightRaw - EARTH_NIGHT_FLOOR_RGB, 0.0) * EARTH_NIGHT_GAIN;
lit += nightLit * nightMask;
```

**The real radiance ratio, so the gain is a declared number and not a guess:**

| Quantity                                               | Value                                        |
| ------------------------------------------------------ | -------------------------------------------- |
| Dayside reflected radiance (Bond 0.306, E = 1361 W/m²) | 0.306 × 1361/π = **130 W·m⁻²·sr⁻¹**          |
| Bright urban core, VIIRS DNB                           | 100 nW·cm⁻²·sr⁻¹ = **1.0 × 10⁻³ W·m⁻²·sr⁻¹** |
| Typical suburban                                       | ~10 nW·cm⁻²·sr⁻¹ = 1 × 10⁻⁴                  |
| **Real ratio, brightest city : sub-solar dayside**     | **7.7 × 10⁻⁶ — 17.0 stops**                  |

At the correct ratio the cities are **invisible**. No single exposure shows a correctly-exposed
dayside and any city light at all — which is exactly why every NASA "Earth at Night" / Black Marble
image is a **composite of two separately-exposed channels**, and the DNB channel is exposed 10⁴–10⁵
above the daylight channel.

> **DECLARED LICENSE, and it is a good one because it is the honest description of how the real
> imagery is made.** Target the brightest cores at ~15 % of the mean dayside output — 2.7 stops
> down instead of 17 — a lift of **1.9 × 10⁴ ≈ 14 stops**. Declare it as a composite exposure,
> not as radiance.
>
> Concrete gain, using the measured peak-city and floor values: peak-city luminance after floor
> subtraction is 0.485 raw / 0.238 linear; mean dayside output is
> mean(surface) × uAlbedo × 3.6 = 0.1235 × 0.213 × 3.6 = 0.0947; target 0.15 × that = 0.0142.
> → **`EARTH_NIGHT_GAIN` = 0.029 if the map is sampled raw, 0.060 if it is sRGB-decoded first.**
> The shader currently samples `surfaceTex` raw (Babylon `Texture` with no sRGB flag), so **0.029**
> matches today's path. Pin whichever is chosen in a unit test — this constant is meaningless
> without knowing which.

### 2.4 Before or after tone mapping

**There is no tone mapping in this engine.** Verified: no `DefaultRenderingPipeline`, no
`ImageProcessingConfiguration`, no `toneMappingEnabled` anywhere in `src/lib/`. The planet shader
writes `gl_FragColor` directly. So the question is moot today.

If one is ever added: **city lights are emission and must be added in linear radiance BEFORE the
tone map.** Added after, they are additive in display space — they clip to flat white blobs with no
core structure, and the tone curve that correctly rolls off the dayside does nothing for them. The
whole visual character of city lights from orbit is the _gradient_ from core to suburb, and that
gradient only survives if the tone curve sees it.

### 2.5 Limb / atmospheric extinction on the lights at grazing angles

**Real, large, and out of frame.** The physics:

- Vertical extinction optical depth at 550 nm: Rayleigh 0.0973 + ozone ~0.016 + maritime aerosol
  ~0.05 → **τ_v ≈ 0.16** (= 0.18 mag per airmass, the standard sea-level clear-sky figure).
- Airmass, Rozenberg (1966), cheap and shader-safe:
  `X(μ) = 1 / (μ + 0.025·exp(−11·μ))` — X(1) = 0.98, X(0) = 40 (true horizon value ≈ 38).
- Extinction `= exp(−τ_v · X(μ))`.

| μ (cos emission)              | Emission angle | Airmass  | Transmission | Magnitudes lost |
| ----------------------------- | -------------- | -------- | ------------ | --------------- |
| 1.00                          | 0°             | 0.98     | 0.855        | 0.17            |
| **0.824 (frame edge, α = 0)** | **34.5°**      | **1.21** | **0.824**    | **0.21**        |
| 0.50                          | 60°            | 2.00     | 0.727        | 0.35            |
| 0.10                          | 84.3°          | 9.2      | 0.229        | 1.60            |
| 0.02                          | 88.9°          | 25       | 0.018        | 4.35            |

At the true limb the extinction is ~7 magnitudes — a factor of 630. Dramatic, real, and the reason
city lights fade out well before the edge of the disc in real night imagery.

**But across this camera's framed patch, μ runs only 1.000 → 0.824, so the total extinction
gradient is exp(−0.16 × 1.21) / exp(−0.16 × 1.00) = 0.967 — a 3.3 % dimming from frame centre to
frame edge, 0.036 mag.** That is below the 8-bit quantization of the source map.

> **Verdict: SIMPLIFIED — omit it.** The effect is real and I would fight for it on a body whose
> limb was in frame. Here it is a 3 % vignette. Adding it would be manufacturing an effect nobody
> can see, and it costs an exp() per fragment across a full-screen disc.

### 2.6 The TRADEOFF the owner has to settle

**Option A — ship no night map.** Cost: 0 MB, 0 ms, one texture not baked. Loses: nothing that is
currently visible. Honest by construction.

**Option B — park Earth (or every body) at a non-zero arrival phase.** Change `travelTo`'s standoff
direction from `−dir` to a direction at angle α from `−dir`.

| Phase α    | Terminator's nearest point (from sub-camera) | In the 11.75° framed patch?  | What you get                                                                       |
| ---------- | -------------------------------------------- | ---------------------------- | ---------------------------------------------------------------------------------- |
| 0° (today) | 90°                                          | no                           | full disc, ocean glint centred, no night                                           |
| 45°        | 45°                                          | no                           | still full; glint pushed 22.5° out, off-frame                                      |
| **78.25°** | **11.75°**                                   | **just enters**              | a thin night crescent at one frame edge                                            |
| **90°**    | **0°**                                       | **through the frame centre** | **terminator dead centre; ~50 % night; city lights, twilight band, cloud shadows** |
| 120°       | −30°                                         | fully night-side             | crescent Earth; most of the frame dark                                             |

**Quantified both ways:**

- **Realism side of Option B:** it delivers, in one change, all four of: real phase (the C4.1
  brief's undelivered headline), the 290-px twilight band that is unique to Earth among these
  bodies, the city lights, and cloud shadows (§3.5, 12 px at the terminator vs 0.4 px today). It
  also makes the L = 0 decision of §1 matter (37–67 % instead of 8.6 %).
- **Cost side of Option B:** it changes the arrival geometry for _every_ body, which touches
  `travelTo`, the warp path, the docking choreography, and every E2E spec that asserts a parked
  position — and it **loses the ocean glint**, which at α = 90° has its specular point 45° off the
  sub-camera point, far outside the frame. It also darkens every other body's arrival by putting a
  terminator through it, which for Mars and the Moon is a gain and for Jupiter is a loss.
- **A per-body arrival phase** (Earth at 90°, everything else at 0°) is a third option and is a
  smaller change, but it is a per-body special case in a path that currently has none.

**Glint and city lights are mutually exclusive at this FOV.** That is a genuine either/or set by
the 45.84° camera, not a preference. I am not picking it.

---

## 3. Clouds

**Verdict: the cloud shell is the most straightforwardly honest thing in this feature. It is
representable at true scale (unlike Venus's deck), the map needs no contrast surgery (unlike
Venus's), and the one thing that would look impressive — a separately rotating deck — is BROKEN
PHYSICS.**

### 3.1 Real cloud-top altitudes, and whether true scale is representable

| Layer                                      | Cloud-top altitude | Fraction of R (6371 km) | World units at R = 26 |
| ------------------------------------------ | ------------------ | ----------------------- | --------------------- |
| Low (stratocumulus, cumulus)               | 0.5 – 2 km         | 0.008 – 0.031 %         | 0.0020 – 0.0082       |
| Mid (altostratus, altocumulus)             | 2 – 7 km           | 0.031 – 0.110 %         | 0.0082 – 0.0286       |
| **Global mean cloud top (~550 hPa)**       | **≈ 5 km**         | **0.0785 %**            | **0.0204**            |
| High (cirrus, cirrostratus), mid-latitudes | 5 – 13 km          | 0.078 – 0.204 %         | 0.0204 – 0.0530       |
| Deep convective tops, tropical tropopause  | 16 – 18 km         | 0.251 – 0.283 %         | 0.0653 – 0.0734       |
| Polar tropopause                           | 8 – 10 km          | 0.126 – 0.157 %         | 0.0327 – 0.0408       |

**Is a literally-scaled shell representable? Yes — and this is where Earth genuinely differs from
Venus.**

The depth quantum at this camera (24-bit buffer, minZ 0.1, maxZ 6000) is **8.6 × 10⁻⁵ wu at the
nearest surface point (z = 12)** and 4.6 × 10⁻⁴ wu at the limb (z = 27.7). A true-scale 5 km shell
offset of **0.0204 wu is 24–237 depth quanta**. It resolves comfortably.

> **Ship the Earth cloud shell at true scale. Declare nothing.**
> `EARTH_CLOUD_SHELL_FACTOR = 1 + 5/6371 = 1.000785` (mean cloud top), or **1.00157** (10 km) if
> the map's cirrus-dominated appearance is the target.
>
> Venus's declaration does **not** transfer. That declaration was about a **camera translation**
> through a 22.5 km-thick deck (0.097 wu of camera travel), not about a static shell offset. Earth
> has no descent; the shell is a fixed radius.

**The failure mode, quantified: do NOT reuse Venus's `2 × 1.012`.** On Earth that is
0.012 × 6371 = **76.5 km** — the mesosphere, above the noctilucent-cloud altitude and 15× the real
mean cloud top. And unlike the altitude itself, the _consequence_ is visible: cloud/surface
parallax at the framed patch edge is `h·tan(emission angle)`:

| Shell offset                | Parallax at frame edge (34.5° emission) | On screen   |
| --------------------------- | --------------------------------------- | ----------- |
| **True scale, 5 km**        | 0.0140 wu                               | **~1.3 px** |
| 10 km                       | 0.0281 wu                               | ~2.6 px     |
| **Venus's 1.012 (76.5 km)** | **0.2145 wu**                           | **~19 px**  |

At true scale the offset is sub-pixel to marginal — invisible, which is correct, because from
400 km up Earth's clouds _do_ look pasted to the surface. At 1.012 you get 19 px of visible
offset, and a knowledgeable viewer reads it instantly as a floating shell.

**Engineering note:** because the shell is always in front of the surface over the entire visible
cap at this camera, depth-writing it is optional. Rendering it with `depthWrite = false` after the
surface removes the depth question entirely and costs nothing.

### 3.2 Real global cloud fraction, and what the shipped map actually says

| Source                                | Value          |
| ------------------------------------- | -------------- |
| **MODIS (Terra/Aqua) long-term mean** | **≈ 0.67**     |
| ISCCP                                 | 0.66 – 0.68    |
| Ocean vs land                         | ~0.72 vs ~0.55 |

Measured from `earth-cloud-high`, solid-angle-weighted over all six faces:

| Statistic                         | Value       |
| --------------------------------- | ----------- |
| Mean byte                         | 61.92       |
| **Mean as raw fraction**          | **0.2428**  |
| Mean sRGB-decoded (linear)        | 0.1010      |
| Coverage above byte 10 (α > 0.04) | **72.87 %** |
| Coverage above byte 25 (α > 0.10) | **59.34 %** |
| Coverage above byte 50            | 46.11 %     |
| Coverage above byte 128           | 17.54 %     |

The real 0.67 falls between the byte-10 (72.9 %) and byte-25 (59.3 %) thresholds — the map recovers
the true global cloud fraction at a threshold of about byte 15. **This is a genuine cloud-field
snapshot, correctly scaled.**

> **Verdict: ACCURATE. Use `alpha = mapByte / 255` raw, with a WHITE (albedo 1.0) cloud colour.**
> The albedo budget of §1.1 independently confirms this is the right reading: raw alpha × white
> reproduces Earth's real geometric albedo to 7 %, sRGB-decoded alpha misses by 33 %.
>
> **Do not apply a `CLOUD_CONTRAST_SCALE`.** That constant exists because `venus-cloud.jpg` is a
> **UV image at 20.5 % contrast against a real visible-light 1–3 %**. Earth's cloud map has no such
> problem: Earth's clouds really are near-white against a near-black ocean, and the map's contrast
> is the truth. Flattening it would be the Venus fix applied where there is no Venus problem.

### 3.3 Relative rotation of the deck — this is a trap

**Real numbers:**

| Quantity                                      | Earth                                               | Venus (for contrast) |
| --------------------------------------------- | --------------------------------------------------- | -------------------- |
| Equatorial surface speed                      | **465.1 m/s**                                       | 1.81 m/s             |
| Cloud-top wind                                | 30–50 m/s (jet stream), 100 m/s in winter jet cores | 100 m/s              |
| **Globally mass-weighted zonal-mean wind**    | **≈ +6 m/s**                                        | ≈ +100 m/s           |
| **Super-rotation index (deck vs solid body)** | **1.013 ×** (+1.3 %)                                | **54.6 ×**           |
| **Lap time of the deck against the surface**  | **≈ 77 days**                                       | 4.45 days            |
| Lap time on `ROTATION_TIME_ACCEL = 1e3`       | **6,630 s ≈ 1.84 h**                                | 384 s                |

> **Verdict: an independently rotating Earth cloud shell is BROKEN PHYSICS. Lock it to the
> surface.**
>
> Earth's atmosphere co-rotates with the planet. Its total relative angular momentum corresponds to
> a globally mass-weighted zonal wind of about **+6 m/s against a 465 m/s surface — 1.3 %**. There
> is no rate at which an Earth cloud shell can visibly rotate and be true. Even the most generous
> honest choice — the jet-stream level at +2 % — laps in 50 days, which is 4,300 s of wall clock on
> the 1e3 rotation clock. Nobody will be parked at Earth for 72 minutes.
>
> And what real Earth cloud motion actually _is_ — the thing a rotating shell would be
> counterfeiting — is **evolution**, not advection: systems form and dissipate over 1–3 days, and
> the field is unrecognisable after a week. A coherent cloud field sliding intact over the
> continents is a thing Earth never does. Borrowing `cloudAdvection()` from `venus-descent.ts`
> would be borrowing a real Venus phenomenon and asserting it on a planet that does not have it.

If the owner wants a defensible non-zero number for completeness:
`EARTH_CLOUD_SUPERROTATION = 1.013` → relative angular rate `2π/86164.09 × 0.013` rad/s. It is
correct and it is invisible. That is the honest state of affairs.

### 3.4 Should clouds use the same reflectance term?

**Verdict: SIMPLIFIED — use the same `refl` formula with a _different_ L, ≈ 0.9, and the reason is
genuinely interesting.**

A thick water cloud is an optically deep, **conservatively scattering** slab: the single-scattering
albedo of cloud droplets at 550 nm is ≈ 0.9999. Chandrasekhar's exact solution for the reflection
function of a semi-infinite conservative isotropically-scattering atmosphere is

```
I(μ, μ0)  ∝  μ0 · H(μ) · H(μ0) / (μ + μ0)
```

which is **the Lommel-Seeliger form**, modulated by the Chandrasekhar H-functions (H(0) = 1,
H(1) = 2.908 for ω = 1). So the shipped `refl` with L → 1 is not merely a convenient
approximation for clouds — it is the correct functional shape, arriving from an entirely different
mechanism than the regolith backscatter it was introduced for.

| Body              | L       | Mechanism                                                       |
| ----------------- | ------- | --------------------------------------------------------------- |
| Moon, Mercury     | 1.0     | Shadow hiding in porous regolith                                |
| Mars              | 0.55    | Dusty, weakly backscattering                                    |
| **Earth surface** | **0.0** | Water, vegetation, soil, snow — no shadow-hiding structure      |
| **Earth clouds**  | **0.9** | **Conservative multiple scattering in an optically thick slab** |

What L = 0.9 ignores: the H-functions (≈ +15 % at grazing emission), the droplet asymmetry
parameter g ≈ 0.85 (real clouds are strongly forward-scattering, so the isotropic solution is a
similarity approximation), and two genuine backscatter features that live at _exactly_ this
camera's zero-phase geometry:

- **The glory** — a coloured ring at 5–10° scattering angle from exact backscatter. At α = 0 that
  maps to a ring at 5–10° of local phase, i.e. **45–85 % of the frame radius**. Real, in frame,
  and a few percent in contrast — below what an 8-bit source can carry. Omit; note it.
- **The cloudbow** at ~140° scattering angle — 40° of local phase, outside the frame.

At the current camera the difference between L = 0.9 and L = 0 on the cloud shell is **0 % at the
frame centre and 7.7 % at the frame edge**. Take L = 0.9 because it is free and correct; do not
spend anything more on it.

### 3.5 Cloud shadows — real, cheap, and gated on the same decision as §2

A cloud at height h casts a ground shadow displaced by `h·tan(incidence)` in the sun's ground
direction. In UV, `Δu = (h/R)·tan(i)/(2π)`:

| Incidence                     | Ground offset (h = 5 km) | Arc     | Screen (48.3 px/°) |
| ----------------------------- | ------------------------ | ------- | ------------------ |
| **11.75° (frame edge today)** | **1.04 km**              | 0.0094° | **0.45 px**        |
| 60°                           | 8.66 km                  | 0.078°  | 3.8 px             |
| 80°                           | 28.4 km                  | 0.255°  | 12.3 px            |
| 85°                           | 57.2 km                  | 0.514°  | 24.8 px            |

**At α = 0 cloud shadows are sub-pixel and must not be drawn** (drawing them would require an
invented sun angle). At α = 90° they are 12–25 px near the terminator, which is the iconic
Earth-from-orbit detail, and they cost **one extra tap of the cloud map** in the surface shader:

```glsl
vec2 sunUV = normalize(vec2(dot(L, east), dot(L, north)));
float tanI = sqrt(max(1.0 - mu0*mu0, 0.0)) / max(mu0, 0.05);
vec2 shadowUV = tUV + sunUV * (CLOUD_H_OVER_R * tanI / (2.0*PI)) * vec2(1.0/cos(lat), 1.0);
float shadow = 1.0 - CLOUD_SHADOW_STRENGTH * texture2D(cloudTex, shadowUV).r;
```

Same structural argument as the C4.1 brief's §3 conclusion about terminator self-shadowing: **the
shadow, not the shading, is what makes topography (here, cloud structure) read as geometry.**

---

## 4. Ocean specular

**Verdict: ACCURATE, and at this exact camera geometry it is not optional — it is the one thing
Earth does that this fixed camera is perfectly positioned to see, and omitting it is the departure
from reality, not adding it.**

### 4.1 The geometry makes the decision

At α = 0, `H = normalize(L + V) = L = V`, and at the sub-camera point `N = L = V`. **The mirror
condition is satisfied exactly, at the dead centre of the frame.** This is not a marginal case; it
is the maximum of the specular lobe sitting on the crosshair.

This is essentially the **DSCOVR/EPIC** geometry — a spacecraft at L1 viewing Earth at 4–15° phase —
where the ocean specular glint is a published, routinely observed feature and has been proposed as
an exoplanet ocean diagnostic (Marshak et al. 2017 on the EPIC "flashes"). It is real, it is
photographed daily, and the arrival camera reproduces its geometry more exactly than the real
spacecraft does.

How the required facet tilt grows with distance from the frame centre (computed for r = 26,
d = 38):

| Central angle γ from sub-camera | Local phase | Facet tilt needed       | Screen radius (1080p) |
| ------------------------------- | ----------- | ----------------------- | --------------------- |
| 0°                              | 0°          | **0°** (perfect mirror) | 0 px                  |
| 4°                              | 7.8°        | 8.28°                   | 193 px                |
| 6°                              | 11.7°       | 12.24°                  | 290 px                |
| 8°                              | 15.6°       | 16.24°                  | 386 px                |
| 11.75° (frame edge)             | 22.87°      | 23.2°                   | 540 px                |

### 4.2 The real Fresnel / roughness treatment

**Cox & Munk (1954)**, still the standard: the sea-surface slope distribution is Gaussian with
total variance

```
sigma2 = 0.003 + 0.00512 * W        (W = wind speed at 12.5 m, in m/s)
```

| Wind W                  | σ²          | RMS slope  | Peak glint BRDF | vs. Lambertian ocean (A = 0.06) | Half-power γ | Half-power radius (1080p) |
| ----------------------- | ----------- | ---------- | --------------- | ------------------------------- | ------------ | ------------------------- |
| 3 m/s (calm)            | 0.01836     | 7.72°      | 0.0911 sr⁻¹     | **4.8 ×**                       | 3.14°        | 144 px                    |
| **7 m/s (global mean)** | **0.03884** | **11.15°** | **0.0431 sr⁻¹** | **2.26 ×**                      | **4.55°**    | **209 px**                |
| 12 m/s (stormy)         | 0.06444     | 14.32°     | 0.0259 sr⁻¹     | 1.36 ×                          | 5.86°        | 271 px                    |

Peak BRDF = `R0 / (4π σ²)`, against a Lambertian ocean's `A/π = 0.0191 sr⁻¹`. Global mean ocean
surface wind is **6.6–7.0 m/s** (scatterometer climatology); use **7.0**.

Fresnel at normal incidence for seawater, n = **1.339** at 550 nm:
`R0 = ((1.339−1)/(1.339+1))² = 0.144934² = ` **0.02101**.

```glsl
// --- Cox-Munk ocean glint, Torrance-Sparrow form. ~15 ALU + 1 tap.
float oceanMask = texture2D(specularTex, tUV).r;          // 70.06% of the sphere, near-binary
vec3  Hv        = normalize(uSunDir + viewDir);
float cosTh     = max(dot(perturbed, Hv), 1e-4);          // facet tilt from the local normal
float tan2      = (1.0 - cosTh*cosTh) / (cosTh*cosTh);
float p         = exp(-tan2 / OCEAN_SIGMA2) / (PI * OCEAN_SIGMA2 * cosTh*cosTh*cosTh*cosTh);
float cosI      = max(dot(Hv, viewDir), 0.0);
float F         = OCEAN_F0 + (1.0 - OCEAN_F0) * pow(1.0 - cosI, 5.0);   // Schlick
float glint     = oceanMask * F * p / (4.0 * max(mu0 * mu, 0.02));      // CLAMP: diverges at the terminator
lit += vec3(glint) * dayside;
```

Three notes that matter:

- **Clamp the `1/(4 μ0 μ)` denominator.** It diverges at the terminator, where the
  single-scattering microfacet form is invalid anyway. `max(μ0·μ, 0.02)` is the cheap guard.
- **No double counting.** Blue-Marble-class products mask glint out during compositing, and the
  measured deep-ocean pixels (2.0, 5.0, 20.0) confirm this map carries none. The glint is purely
  additive.
- **Clouds mask it automatically** — the shell is drawn over the surface, and real DSCOVR glint
  imagery shows exactly this: a bright patch broken up by cloud. Free, and correct.

### 4.3 The honest caveats

- **Glint over land** is also a real EPIC finding (specular reflection from horizontally-oriented
  ice crystals in cirrus), but it is exotic and would need a cirrus discriminator. Mask it out with
  `oceanMask` and note the omission.
- **Wind is not uniform.** A single global σ² is a SIMPLIFICATION — the real glint patch has
  structure from the wind field (which is why glint imagery is used to _retrieve_ wind speed). One
  constant is the right call at 8-bit and this frame size.
- **This is the one place where the fixed camera helps rather than hurts.** Every other effect in
  this brief is diminished or eliminated by α = 0. This one is maximised by it.

---

## 5. Atmosphere and limb

**Verdict: omitting the blue limb ring is NOT an honesty problem — the limb is off-screen. But
omitting atmospheric scattering entirely IS the biggest honesty problem in the whole feature, and
it is not a limb effect. Measured: the day map's ocean is RGB (2, 5, 20). Without a Rayleigh term
Earth renders as a black ball with continents on it.**

### 5.1 The limb, and why it is not the question

Real numbers, for the record:

| Quantity                                         | Value                                  |
| ------------------------------------------------ | -------------------------------------- |
| **Scale height** H = kT/(m g), T = 288 K         | **8.43 km**; standard value **8.5 km** |
| H as a fraction of R                             | **0.1334 %**                           |
| H in world units at R = 26                       | **0.0347 wu**                          |
| Visible blue rim (~2.5 H, ~20 km)                | 0.0816 wu                              |
| **On-screen width per scale height at the limb** | **3.7 px** at 1080p                    |
| **On-screen width of the visible rim**           | **~9 px**                              |
| Karman line (100 km), for scale                  | 0.408 wu, 44 px                        |

So a limb ring would be a ~9 px bright blue arc on a 2397 px disc. Perfectly renderable — **if it
were in frame.**

It is not. The limb sits **43.155°** off the camera axis against a **22.92°** half-FOV. On 16:9 the
frame corner reaches 40.8° and the limb misses it by **97 px**. The threshold aspect ratio at which
the corner reaches the limb is

```
atan( tan(22.92°) · sqrt(1 + a²) ) = 43.155°   ->   a = 1.981
```

| Display                 | Aspect    | Corner off-axis angle | Limb visible?           |
| ----------------------- | --------- | --------------------- | ----------------------- |
| Phone, portrait 390×844 | 0.462     | 24.97°                | no                      |
| 16:10 laptop            | 1.600     | 36.0°                 | no                      |
| **1920×1080**           | **1.778** | **40.8°**             | **no — by 97 px**       |
| **2560×1080 (21:9)**    | **2.370** | **47.4°**             | **YES, in the corners** |
| 3440×1440 (21:9)        | 2.389     | 47.6°                 | YES                     |

> **Verdict: DECLARED, and the declaration is "the camera cannot see it".** Omitting the limb ring
> is honest at every aspect narrower than 1.98:1, which is every device except an ultrawide desktop.
> **Adding a "limb glow" that appears anywhere the visitor can actually see would be inventing a
> limb** — a rim of atmosphere drawn where the geometry says there is solid daylit surface. That is
> failure mode #3 in §7.
>
> If ultrawide support is wanted, the ring is cheap and correct — but it is a corner-only effect
> on <5 % of viewports, and I would not spend the frame budget for it before the real-device pass.

### 5.2 The atmosphere effect that IS in frame, and it is not optional

**Measured (§0.1, finding 4):** sorting the day cubemap by luminance, the darkest 60 % of the
sphere — the ocean — has mean RGB **(2.0, 5.0, 20.0)** of 255. Deep ocean is (1.8, 4.5, 18.1).

That is **water-leaving reflectance**: 0.8 % / 2.0 % / 7.8 % raw, or (0.0006, 0.0015, 0.0061)
linear. It is a correct measurement of what the _water_ does. It is nothing like what **Earth**
looks like, because most of the blue you see from orbit never reaches the water at all.

**Rayleigh optical depth**, sea level, τ ∝ λ⁻⁴·⁰⁹ (Bodhaine et al. 1999):

| Band      | λ          | τ_R        | Single-scattering reflectance at backscatter, `0.375·τ_R` |
| --------- | ---------- | ---------- | --------------------------------------------------------- |
| Red       | 650 nm     | 0.0491     | 0.0184                                                    |
| **Green** | **550 nm** | **0.0973** | **0.0365**                                                |
| Blue      | 450 nm     | 0.2211     | 0.0829                                                    |

(`ρ_R = τ_R · P(Θ)/(4 μ μ0)` with the Rayleigh phase function `P = 0.75(1 + cos²Θ)` = 1.5 at
Θ = 180°, which is **exactly this camera's scattering angle at the frame centre**.)

Adding maritime background aerosol (τ_a ≈ 0.08 at 550 nm, ω ≈ 0.98, weak backscatter → ~0.006
spectrally flat), the top-of-atmosphere ocean reflectance becomes:

| Component                        | R          | G          | B          |
| -------------------------------- | ---------- | ---------- | ---------- |
| Water-leaving (measured, linear) | 0.0006     | 0.0015     | 0.0061     |
| **Rayleigh**                     | **0.0184** | **0.0365** | **0.0829** |
| Aerosol                          | 0.0060     | 0.0060     | 0.0060     |
| **Total TOA**                    | **0.0250** | **0.0440** | **0.0950** |
| **Rayleigh's share**             | **74 %**   | **83 %**   | **87 %**   |

> **Between 74 % and 87 % of the light you see over open ocean from space is scattered air, not
> water.** The Blue Marble map has that removed, on purpose, because it is a _surface_ product.
> Rendering it raw is not a simplification — it renders the wrong object.
>
> **Verdict on omitting it: BROKEN PHYSICS.** Not because the render would look bad (it would look
> like a dramatic dark-ocean Earth, which some people would call striking) but because it would be
> a picture of the sea floor's reflectance, presented as a picture of Earth.

The shader term is four lines and no texture:

```glsl
// Single-scattering Rayleigh + flat aerosol. Real tau, real lambda^-4.09 colour, real phase fn.
float cosT      = dot(-uSunDir, viewDir);                    // scattering angle; -1 at frame centre
float phaseR    = 0.75 * (1.0 + cosT * cosT);                // = 1.5 at backscatter
vec3  rayleigh  = RAYLEIGH_TAU_RGB * phaseR / (4.0 * max(mu * mu0, 0.05));
vec3  aerosol   = vec3(AEROSOL_TAU) * 0.3 / (4.0 * max(mu * mu0, 0.05));
lit += (rayleigh + aerosol) * dayside;
```

with `RAYLEIGH_TAU_RGB = vec3(0.0491, 0.0973, 0.2211)`. Clamp `μ·μ0` — the single-scattering form
diverges at the terminator, where it is invalid anyway.

**Frame-budget side, stated honestly.** The disc fills the entire viewport, so every one of
~2.07 M fragments at 1080p pays for everything in §4 and §5. The additions across the brief are
roughly **35–45 ALU ops, one `exp`, one `pow`, and two extra texture taps** (specular mask, cloud
shadow) per fragment. On a mid-tier Android GPU at 2–4 Gtexel/s, the two extra taps alone are
**1–2 ms of a 25 ms budget** before any ALU. This is measurable and it is not free; it wants the
real-device pass ADR-0008 defers rather than cancels. The Rayleigh term is the cheapest item on the
list (no taps) and the highest-value; the glint is the most expensive (an `exp` plus a `pow`) and
is the one this camera geometry most rewards.

### 5.3 What is real and should still be skipped

- **Atmospheric refraction.** Real (ray curvature radius ~ 6.5 × R at the surface), and it slightly
  distorts the limb — which is off-screen. Skip.
- **Airglow** (OI 557.7 nm nightglow). Real, ~10⁻⁹ of daylight. Skip.
- **Ozone Chappuis absorption**, which is what makes the twilight sky deep blue rather than orange
  at high sun depression. Real, second-order, and only matters if the terminator ever enters frame.
- **Multiple Rayleigh scattering.** The single-scattering form above under-predicts blue by roughly
  15–25 % at τ = 0.22. SIMPLIFIED; the fix is a lookup table and it is not worth it here.

---

## 6. Rotation

| Quantity                                               | Value                                       |
| ------------------------------------------------------ | ------------------------------------------- |
| **Sidereal rotation period**                           | **23h 56m 4.0905s = 86,164.0905 s**         |
| Sign                                                   | **positive — prograde**                     |
| Mean solar day (for reference)                         | 86,400 s (+0.273 %)                         |
| Equatorial rotation speed                              | 465.1 m/s                                   |
| Axial tilt (obliquity to orbit)                        | 23.4393°                                    |
| **IAU north pole, equatorial J2000**                   | **α₀ = 0.00°, δ₀ = 90.00° — by definition** |
| Wall-clock per rotation at `ROTATION_TIME_ACCEL = 1e3` | **86.16 s**                                 |
| Degrees per frame at 60 fps                            | 0.070° — comfortably inside Nyquist         |

For `ROTATION_PERIOD_S`:

```ts
earth: 86164.0905,  // 23h 56m 4.0905s sidereal, prograde
```

Two notes:

- **The scene's frame makes Earth's axis exact and free.** The DR3 belt brief (2026-07-20 §2)
  established the catalog frame as **equatorial J2000**, whose pole _is_ Earth's rotation pole. So
  Earth's spin axis is the frame's own polar axis — α₀ = 0°, δ₀ = 90° — with no construction
  needed. Every other body needs its IAU pole; Earth is the definition.
- **Sidereal, not solar, is right here — with a 0.273 % caveat.** The file's convention is sidereal
  for every body. Because the scene's Sun direction is static (bodies do not orbit), spinning at
  the sidereal rate advances the sub-solar longitude at the _stellar_ rate, so a "day" in the scene
  is 86,164 s where the real perceived day is 86,400 s. That is a **0.273 % error, or 3.9 minutes
  per rendered day** — 0.24 s of wall clock at 1e3. Below noticing. Stay consistent with the file.

Oblateness, if the Jupiter/Saturn treatment is extended: `EARTH_FLATTENING = 0.00335281` → polar
axis scale 0.99665. On a 1198 px disc radius that is **4.0 px of polar squash** — an order of
magnitude smaller than Jupiter's 6.5 % and, at α = 0, entirely on the off-screen limb. It costs one
axis scale, so apply it for consistency, but do not expect to see it.

---

## 7. What NOT to do — ranked by "looks impressive, is wrong"

The Venus catch (TR-078 Part 2) was: _the dishonesty was not the radar map, it was lighting the
radar map_ — a real formula applied to data it does not describe, producing something that would
pass every review because it would look superb. Ranked by that criterion:

| #   | Failure mode                                                                                                                        | Verdict if done                                         | Why it would pass review                                                                                                                        | The tell                                                                                                                                                                                                                                           |
| --- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Showing city lights at all at α = 0** — compositing the night map unconditionally, or masking on anything other than the true N·L | **BROKEN PHYSICS**                                      | It is the single most beautiful thing in the asset pack, it is real NASA data, and the render would be gorgeous. Nobody checks the phase angle. | The night hemisphere is 100 % occluded. Any city light on screen is a view that does not exist.                                                                                                                                                    |
| 2   | **Adding the night map raw, floor and all** (a sub-case of #1, but it survives even after the geometry change)                      | **BROKEN PHYSICS**                                      | Reads as airglow or a lit atmosphere. Looks atmospheric and expensive.                                                                          | Measured: **0.000 % of the map is black**; 99.24 % sits at RGB (9.5, 11.0, 16.7) — **2.2× the whole existing night ambient**. It is a JPEG floor, and it would glow over the mid-Pacific.                                                          |
| 3   | **An independently rotating cloud shell**                                                                                           | **BROKEN PHYSICS**                                      | Instantly reads as "a living planet". It is the single most satisfying-looking animation available here, and Venus already has the code.        | Earth's atmosphere co-rotates to **1.3 %**; the deck laps in **77 days**. Real Earth cloud motion is _evolution_, not rotation — a coherent field sliding intact over the continents never happens.                                                |
| 4   | **A blue limb glow drawn where it can be seen**                                                                                     | **BROKEN PHYSICS**                                      | Every space render has one; its absence will read as "unfinished" to reviewers who do not check the FOV.                                        | The limb is **43.155° off-axis against a 22.92° half-FOV** — off-screen by 97 px even at a 16:9 corner. A rim drawn in frame is a rim over solid daylit surface.                                                                                   |
| 5   | **Reusing Venus's `2 × 1.012` cloud-shell radius**                                                                                  | **BROKEN PHYSICS**                                      | It is the shipped constant; nobody would question a copy-paste.                                                                                 | 76.5 km — the mesosphere — and it produces **~19 px of visible cloud/surface parallax** at the frame edge against a true-scale 1.3 px.                                                                                                             |
| 6   | **`PLANET_ALBEDO["earth"] = 0.434` plus a cloud shell**                                                                             | **BROKEN PHYSICS**                                      | 0.434 is the correct, citable, NASA geometric albedo. It is the _right number in the wrong place_.                                              | Double-counts the clouds: ~2× too bright, and the ocean/cloud contrast collapses. The surface takes **0.213**.                                                                                                                                     |
| 7   | **Reusing `lunarLambertL` = 0.55 or 1.0**                                                                                           | **BROKEN PHYSICS** (mechanism), SMALL (magnitude today) | It is what every other body uses, and at α = 0 the visible error is ≤ 8.6 %.                                                                    | A regolith shadow-hiding law applied to water. Becomes a **37–67 % terminator error** the instant the arrival phase changes.                                                                                                                       |
| 8   | **Deriving Earth's normals from `earth-height-ultra.jpg`**                                                                          | **SIMPLIFIED, avoidable**                               | It is what the shader already does for Mars, Moon and Mercury; Earth "has a height map", so it looks like the same case.                        | **1.072° minimum slope step** → terracing, when a clean, un-terraced 8192×4096 normal map ships in the same folder. Earth is the one body that needs no bake.                                                                                      |
| 9   | **Rendering the ocean with no atmospheric term**                                                                                    | **BROKEN PHYSICS**                                      | Would read as a dramatic, moody, dark-ocean Earth. Some will prefer it.                                                                         | Measured ocean = RGB **(2, 5, 20)/255**. **74–87 % of Earth's ocean colour from space is scattered air.** Without it you are rendering the water's reflectance, not the planet.                                                                    |
| 10  | **An always-on ocean "sheen" not tied to the mirror condition**                                                                     | **BROKEN PHYSICS**                                      | A rim-lit shiny ocean is a familiar, attractive game-art look.                                                                                  | Glint obeys `H = normalize(L + V)`. A sheen that survives when the geometry does not support it is decoration wearing physics' clothes.                                                                                                            |
| 11  | **Flattening the cloud map's contrast** (the Venus fix, applied here)                                                               | SIMPLIFIED, wrong                                       | `CLOUD_CONTRAST_SCALE` exists and is well documented; reusing it looks careful.                                                                 | Venus's map is a **UV image at 20.5 % contrast against a real 1–3 %**. Earth's clouds really are near-white on near-black. Measured coverage matches the real 0.67 at threshold ~15. Nothing to fix.                                               |
| 12  | **Exaggerating relief** (`PLANET_ELEV_SCALE`)                                                                                       | **BROKEN PHYSICS ≥ 3.0**                                | Same argument the C4.1 brief already settled.                                                                                                   | Earth's land relief span is **9.28 km on a 6371 km radius = 0.146 %** — the flattest of the four height-mapped bodies. It needs 4247 px of disc before true-scale relief bends the limb by one pixel, and the limb is off-screen anyway. Keep 1.0. |

---

## Summary

| §   | Element                                      | Verdict                           | Action                                                                                                                           |
| --- | -------------------------------------------- | --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| 0.2 | **Arrival phase angle**                      | **α = 0.000°, always**            | Measured from `travelTo` + `sunDirectionFrom`. Decides §2 and §5, halves §1 and §3.5                                             |
| 0.2 | C4.1 brief's "real phases and terminator"    | **not delivered as shipped**      | Additive correction; earlier claim stands in its own document                                                                    |
| 0.4 | `earth-normal-high.jpg`                      | **ACCURATE — use it directly**    | 201/256 levels in a Himalaya crop, 2.7° typical slope. `uHasHeight = 0`; no bake                                                 |
| 0.4 | Height map's sea-level clamp                 | **ACCURATE**                      | You render the geoid; bathymetry would be wrong, not missing. No recalibration                                                   |
| 0.5 | Day cubemap resolution                       | **32,768 equirect-equivalent**    | = VT level 4 exactly. `ultra` (8192) discards 4× linear resolution. **Owner decision, ~50–60 MB**                                |
| 1   | Geometric albedo 0.434 on the surface sphere | **BROKEN PHYSICS if done**        | It is a two-layer number. **Surface takes 0.213**; cloud shell supplies the rest                                                 |
| 1   | `refl` formula                               | **holds**                         | With **L = 0** for the surface. Mars's 0.55 / Moon's 1.0 is a regolith law applied to water                                      |
| 1   | Magnitude of the L error at α = 0            | —                                 | 0 % at frame centre, **8.6 %** at frame edge; **37–67 %** if the phase changes                                                   |
| 2   | Night lights at the shipped geometry         | **BROKEN PHYSICS if shown**       | Night hemisphere 100 % occluded. **Do not ship the map** unless §2.6 Option B is taken                                           |
| 2   | Night map's non-zero floor                   | **measured, must be subtracted**  | 0.000 % black; floor RGB (9.5, 11.0, 16.7) = **2.2× the whole existing night ambient**                                           |
| 2   | Night-lights exposure                        | **DECLARED LICENSE**              | Real ratio **7.7 × 10⁻⁶ (17 stops)**; render at 0.15 (2.7 stops) = a **14-stop lift**, as Black Marble does                      |
| 2   | Tone-map ordering                            | **moot — no tone mapping exists** | If one is added: **before**, in linear radiance                                                                                  |
| 2   | Limb extinction on the lights                | **SIMPLIFIED — omit**             | Real (7 mag at the limb) but **3.3 % across this frame**                                                                         |
| 3   | True-scale cloud shell                       | **ACCURATE — representable**      | 5 km = 0.0204 wu = **24–237 depth quanta**. `factor = 1.000785`. **Venus's declaration does not transfer**                       |
| 3   | Reusing Venus's 1.012                        | **BROKEN PHYSICS if done**        | 76.5 km, **19 px of false parallax** vs 1.3 px at true scale                                                                     |
| 3   | Global cloud fraction                        | **0.67** real; map ACCURATE       | Measured mean α 0.243, coverage 59.3 % @ byte 25 / 72.9 % @ byte 10. **Raw alpha, white cloud**                                  |
| 3   | Cloud contrast surgery                       | **do not**                        | Venus's map is UV at 20.5 %; Earth's is honest                                                                                   |
| 3   | Independently rotating cloud deck            | **BROKEN PHYSICS**                | Super-rotation **1.013×**, 77-day lap. Lock to the surface                                                                       |
| 3   | Cloud reflectance term                       | **SIMPLIFIED — L = 0.9**          | Chandrasekhar's conservative slab **is** Lommel-Seeliger's form, by a different mechanism                                        |
| 3   | Cloud shadows                                | **0.45 px at α = 0**              | Do not draw today; 12–25 px and iconic if the phase changes                                                                      |
| 4   | Ocean specular                               | **ACCURATE — and mandatory**      | Mirror condition satisfied **exactly at the frame centre**. Cox-Munk σ² = 0.0388, peak **2.26×** ocean, half-power at **209 px** |
| 4   | Specular mask                                | **ACCURATE**                      | 70.06 % measured vs 70.9 % real ocean fraction                                                                                   |
| 5   | Blue limb ring                               | **omitting is honest**            | Limb 43.155° off-axis vs 22.92° half-FOV; visible **only above 1.98:1 aspect**, in the corners                                   |
| 5   | Atmospheric scattering over the disc         | **BROKEN PHYSICS to omit**        | Ocean measures RGB **(2, 5, 20)**; **74–87 % of ocean colour from space is air**                                                 |
| 5   | Frame-budget cost                            | —                                 | ~40 ALU + `exp` + `pow` + 2 taps on ~2.07 M fragments; **1–2 ms of taps alone on mid-Android**                                   |
| 6   | Rotation                                     | **ACCURATE**                      | **86,164.0905 s, prograde.** Pole is the frame's own axis (α₀ = 0°, δ₀ = 90°)                                                    |
| 6   | Sidereal vs solar day                        | **SIMPLIFIED, 0.273 %**           | Stay consistent with the file                                                                                                    |

### Constants to implement

```ts
// ---- Earth: body ----------------------------------------------------------
EARTH_RADIUS_KM = 6371.0; // IUGG mean; eq 6378.137, polar 6356.752
EARTH_FLATTENING = 0.00335281; // WGS-84, 1/298.257223563 -> 4.0 px of squash
EARTH_WORLD_UNIT_KM = 245.04; // = 6371 / PLANET_SPHERE_RADIUS(26)
EARTH_RELIEF_MIN_KM = 0.0; // map is sea-level clamped, and that is CORRECT
EARTH_RELIEF_MAX_KM = 8.84886; // Everest, 2020 joint survey
EARTH_HEIGHT_SCALE_KM = 8.848; // Gaia Sky planets.json:160 — physical, do NOT recalibrate

// ---- Rotation -------------------------------------------------------------
ROT_PERIOD_S.earth = 86164.0905; // sidereal, PROGRADE (positive)
EARTH_POLE_RA_DEG = 0.0; // equatorial J2000 pole = Earth's pole, by definition
EARTH_POLE_DEC_DEG = 90.0;
// at ROTATION_TIME_ACCEL = 1e3: 86.16 s per rotation, 0.070 deg/frame @60fps

// ---- Photometry -----------------------------------------------------------
EARTH_ALBEDO_GEOM_COMPOSITE = 0.434; // NASA fact sheet — a CHECK, never an input
EARTH_ALBEDO_BOND = 0.306;
EARTH_PHASE_INTEGRAL_Q = 0.705; // = Bond / geometric
PLANET_ALBEDO.earth = 0.213; // <-- CLEAR-SKY geometric. The cloud shell supplies the rest
EARTH_CLOUD_ALBEDO_GEOM = 0.55; // closes the budget: 0.33*0.213 + 0.67*0.55 = 0.439
EARTH_LUNAR_LAMBERT_L = 0.0; // pure Lambert. NOT 0.55 (Mars), NOT 1.0 (Moon)
EARTH_CLOUD_LUNAR_LAMBERT_L = 0.9; // Chandrasekhar conservative slab, NOT regolith backscatter

// ---- Terminator / twilight (atmospheric, ~11-33x the Sun-disc penumbra) ----
EARTH_TERMINATOR_LO = -0.105; // N.L at civil-twilight end (sun 6 deg below horizon)
EARTH_TERMINATOR_HI = 0.02;
EARTH_TWILIGHT_E0 = 0.0033; // relative illuminance at N.L = 0 (sun on the horizon)
EARTH_TWILIGHT_DECAY = 45.4; // E(x) = E0 * exp(DECAY * x) for x = N.L < 0
// widths on a 1080p frame: Sun-disc penumbra 26 px; civil twilight 290 px; astronomical 830 px

// ---- Night lights (ONLY IF the arrival phase changes -- see 2.6) -----------
EARTH_NIGHT_ON = -0.05; // N.L where lights begin to register
EARTH_NIGHT_FULL = -0.2; // N.L where lights fully dominate
EARTH_NIGHT_FLOOR_RGB_RAW = [0.0373, 0.0431, 0.0655]; // measured (9.5,11.0,16.7)/255 -- SUBTRACT
EARTH_NIGHT_FLOOR_RGB_LIN = [0.0029, 0.0033, 0.0055]; // same, sRGB-decoded
EARTH_NIGHT_GAIN_RAW = 0.029; // if the map is sampled raw (today's shader path)
EARTH_NIGHT_GAIN_LINEAR = 0.06; // if the map is sRGB-decoded first
// DECLARED: real city:dayside radiance ratio is 7.7e-6 (17 stops); this renders at 0.15 (2.7 stops)

// ---- Clouds ---------------------------------------------------------------
EARTH_CLOUD_TOP_MEAN_KM = 5.0; // global mean, ~550 hPa
EARTH_CLOUD_TOP_HIGH_KM = 13.0; // cirrus, mid-latitude
EARTH_CLOUD_TOP_MAX_KM = 18.0; // tropical deep convection / tropopause
EARTH_CLOUD_SHELL_FACTOR = 1.000785; // = 1 + 5/6371. TRUE SCALE. Never 1.012 (= 76.5 km)
EARTH_CLOUD_FRACTION = 0.67; // MODIS long-term mean
EARTH_CLOUD_ALPHA_MODE = "raw"; // byte/255 directly; sRGB-decoding it misses albedo by 33%
EARTH_CLOUD_CONTRAST_SCALE = 1.0; // NO flattening -- the Venus fix does not apply here
EARTH_CLOUD_SUPERROTATION = 1.013; // +1.3%, 77-day lap. Correct AND invisible: lock to surface
EARTH_CLOUD_SHADOW_STRENGTH = 0.55; // only meaningful if the arrival phase changes
CLOUD_H_OVER_R = 7.848e-4; // = 5 / 6371, for the shadow-offset term

// ---- Ocean specular (Cox & Munk 1954) -------------------------------------
OCEAN_F0 = 0.02101; // Fresnel at normal incidence, seawater n = 1.339 @550nm
OCEAN_WIND_MS = 7.0; // global mean ocean surface wind
OCEAN_SIGMA2 = 0.03884; // = 0.003 + 0.00512 * W ; RMS slope 11.15 deg
// peak glint BRDF 0.0431 /sr = 2.26x a Lambertian ocean; half-power at 209 px from frame centre
// alternatives: W=3 -> sigma2 0.01836, 4.8x, 144 px ; W=12 -> 0.06444, 1.36x, 271 px
OCEAN_MASK_SOURCE = "earth-specular-high.jpg"; // 70.06% measured vs 70.9% real

// ---- Atmosphere -----------------------------------------------------------
EARTH_SCALE_HEIGHT_KM = 8.5; // kT/mg = 8.43 at 288 K; 0.1334% of R; 3.7 px at the limb
RAYLEIGH_TAU_RGB = [0.0491, 0.0973, 0.2211]; // 650/550/450 nm, tau ∝ lambda^-4.09
AEROSOL_TAU_550 = 0.08; // maritime background; ~0.006 backscatter, spectrally flat
EXTINCTION_TAU_V = 0.16; // total vertical, 550 nm (Rayleigh + O3 + aerosol)
// airmass, Rozenberg: X(mu) = 1/(mu + 0.025*exp(-11*mu))  -- X(1)=0.98, X(0)=40
// TOA ocean reflectance (R,G,B) = 0.0250, 0.0440, 0.0950 ; Rayleigh's share 74/83/87%

// ---- Scene geometry facts these rest on (derived, not chosen) --------------
ARRIVAL_PHASE_ANGLE_DEG = 0.0; // MEASURED: camera parks on the Sun-body line
DISC_RADIUS_PX_1080P = 1198; // = 1277 * tan(asin(26/38))
SCREEN_SCALE_PX_PER_DEG = 48.3; // central angle, at the frame centre
LIMB_OFF_AXIS_DEG = 43.155; // vs a 22.92 deg half-FOV -> off-screen
LIMB_VISIBLE_ABOVE_ASPECT = 1.981; // 21:9 sees it in the corners; 16:9 misses by 97 px
IN_FRAME_NDOTL_RANGE = [0.979, 1.0]; // 2.1% variation across the whole framed patch
IN_FRAME_MU_RANGE = [0.824, 1.0];
IN_FRAME_LOCAL_PHASE_DEG = [0.0, 22.87]; // = the off-axis screen angle; 40.8 at a 16:9 corner
```

### Cross-references

- Prompted by `docs/delivery-plan/PF-10-gaia-dataset-realism.md`, phase C4.
- **Corrects, additively**, `docs/analysis/2026-07-21-planetary-sphere-topography-science-brief.md`
  §7: "real phases and a real terminator" is the correct physics of a sphere but is **not delivered
  by this scene's arrival geometry**, which parks every body at phase angle 0. The earlier claim
  stands as written in its own document; §0.2 above is the dated correction.
- Body-specific fork precedent and its justification structure:
  `docs/analysis/2026-07-21-venus-cloud-descent-science-brief.md` §3 and `docs/test-reports/TR-078.md`
  Part 2. **Two of its constants must NOT be reused for Earth**: the cloud-shell radius factor
  1.012 (§3.1) and `CLOUD_CONTRAST_SCALE` (§3.2).
- Frame convention (equatorial J2000) inherited from
  `docs/analysis/2026-07-20-dr3-asteroid-belt-science-brief.md` §2 — which is what makes Earth's
  pole exact and free (§6).
- Camera-geometry constants (`ARRIVE_STANDOFF` 38, `PLANET_SPHERE_RADIUS` 26, `PLANET_PATCH_DEG`
  23.5) from `src/lib/ship-dynamics.ts` and `src/lib/planet-sphere.ts`; VT pyramid depth from
  `src/lib/planet-vt.ts`.
- Asset-weight context for §0.5's Earth-colour-VT tradeoff: `docs/test-reports/TR-078.md` Part 7
  (`public/assets` at ~221 MB, VT level 4 ≈ 50 MB, still open).
- **Four findings change engineering decisions and should be recorded by Procyon in an ADR or the
  license ledger, not only here**: (a) the arrival phase angle is 0 and the C4.1 "real phases"
  headline is undelivered; (b) whether to change the arrival geometry for Earth (§2.6), which
  trades the ocean glint for the night lights and the terminator; (c) `PLANET_ALBEDO.earth = 0.213`
  breaking that field's documented "geometric albedo" contract; (d) whether to build an Earth
  colour VT (§0.5, ~50–60 MB). **This brief is the evidence, not the decision record.**

---

---

# ADDENDUM (same day) — REALISM-AUDIT: Dione, Rhea and Tethys, and the albedo-above-unity conflict

**Date:** 2026-07-21
**Mode:** REALISM-AUDIT
**Scope:** the three Saturnian icy satellites provisionally entered into
`src/lib/planet-sphere.ts` this session (`PLANET_ALBEDO` lines 162–164, `ROTATION_PERIOD_S` lines
230–232), their missing `lunarLambertL`, the `3.6` gain in the shipped fragment shader, and the
flat `+0.06` night ambient.

Appended rather than merged: §§0–7 above stand as written.

---

## A1. The constants — three confirmed, one arithmetic slip, one class of error

### A1.1 Geometric albedos: **all three CONFIRMED, and they are the good modern values**

| Body       | Entered   | Verdict      | Source                                                                                 |
| ---------- | --------- | ------------ | -------------------------------------------------------------------------------------- |
| **Dione**  | **0.998** | **ACCURATE** | Verbiscer, French, Showalter & Helfenstein (2007), from sub-0.1° opposition photometry |
| **Rhea**   | **0.949** | **ACCURATE** | same                                                                                   |
| **Tethys** | **1.229** | **ACCURATE** | same                                                                                   |

For context, from the same source set: Enceladus **1.375**, Mimas 0.962, Iapetus 0.05–0.6 (leading
vs trailing). These are the highest geometric albedos measured anywhere in the solar system, and the
cause is real and specific: **E-ring resurfacing.** Enceladus's south-polar plumes feed a torus of
micron-scale water-ice grains that continuously repaints Tethys, Dione and Rhea with fresh, bright,
extremely fine-grained frost. Tethys sits closest to the densest part of the E ring, which is
exactly why it is the brightest of the three. That is not trivia — it is the physical reason the
number exceeds unity, and it belongs in the dossier text.

> **Additive correction to my own C4.1 brief.**
> `2026-07-21-planetary-sphere-topography-science-brief.md` §4 lists **Rhea 0.65 and Dione 0.66** in
> its geometric-albedo table. Those are the older, Voyager-era values. The Verbiscer et al. (2007)
> figures entered this session — 0.949 and 0.998 — supersede them. My earlier table stands in its
> own document; this is the dated correction. Tethys was absent from that table entirely.

**Bond albedos, which matter enormously for §A2:**

| Body             | Geometric p | **Bond A_B** | **q = A_B/p** | Mean radius | Semi-major axis |
| ---------------- | ----------- | ------------ | ------------- | ----------- | --------------- |
| Tethys           | 1.229       | **0.80**     | **0.651**     | 531.0 km    | 294,619 km      |
| Dione            | 0.998       | **0.63**     | **0.631**     | 561.4 km    | 377,396 km      |
| Rhea             | 0.949       | **0.48**     | **0.506**     | 763.5 km    | 527,108 km      |
| _Moon_           | _0.136_     | _0.11_       | _0.81_        | _1737.4 km_ | —               |
| _Lambert sphere_ | —           | —            | _1.5_         | —           | —               |

**Every Bond albedo is comfortably below 1.** Nothing here reflects more light than falls on it.
The phase integrals — 0.51 to 0.65 against a Lambert sphere's 1.5 — are the quantitative statement
of _how much_ of each body's geometric albedo is concentrated in a narrow backscatter peak. That
single column is the key to §A2.

### A1.2 Rotation periods: two exact, one off by 40 seconds

All three are **tidally locked**, so the sidereal rotation period is the orbital period, and all
three are **prograde (positive)**.

| Body       | Entered | Correct                    | Δ           | Verdict                                                       |
| ---------- | ------- | -------------------------- | ----------- | ------------------------------------------------------------- |
| **Rhea**   | 390373  | **390,373.5** (4.518212 d) | 0           | **ACCURATE**                                                  |
| **Tethys** | 163106  | **163,106.1** (1.887802 d) | 0           | **ACCURATE**                                                  |
| **Dione**  | 236429  | **236,469.5** (2.736915 d) | **+40.5 s** | **arithmetic slip — the comment is right, the number is not** |

The in-file comment on the Dione line already reads `// 2.736915 d, synchronous`, and
2.736915 × 86400 = **236,469.46 s**, not 236,429. Cross-checked against the independent quotation of
Dione's period as 65.686 h → 65.686 × 3600 = 236,469.6 s. The entered value corresponds to
2.73645 d.

The error is **0.017 %** — visually nothing (0.015 s of wall clock per rotation at
`ROTATION_TIME_ACCEL = 1e3`, against a 236 s rotation). But it is free to fix and the whole point of
the table is that the ratios are real.

Wall-clock rotation at 1e3, for the record: **Tethys 163 s, Dione 236 s, Rhea 390 s.** All far
inside Nyquist (Rhea 0.92°/s = 0.015°/frame at 60 fps).

### A1.3 `lunarLambertL`: **1.0 for all three. The 0.55 fallback is BROKEN PHYSICS.**

| Body   | Correct L | Basis                                                                |
| ------ | --------- | -------------------------------------------------------------------- |
| Tethys | **1.0**   | Airless icy regolith — porous, fine-grained, strongly backscattering |
| Dione  | **1.0**   | same                                                                 |
| Rhea   | **1.0**   | same (a ~10⁻¹⁵ bar O₂/CO₂ exosphere; optically irrelevant)           |

`0.55` is **Mars's** value, chosen in the C4.1 brief because Mars is dusty _and has an atmosphere_
that suppresses the backscatter peak. Applying it to an airless icy satellite is the same class of
mis-attribution as applying the Moon's 1.0 to Earth's ocean (§1.2 above): a real coefficient,
carried onto a surface whose physics it does not describe.

If anything these three deserve L = 1.0 **more** than the Moon does. The whole reason their
geometric albedos exceed unity is that their backscatter is the strongest measured anywhere — the
exact behaviour the Lommel-Seeliger limb of the law encodes.

**How much does the fallback actually cost?** On the smooth sphere at zero phase, almost nothing —
0.9 % at the frame edge — because at α = 0 both formulations converge (see A2.2). The cost lands on
the **normal-mapped terrain**, where μ₀ varies locally: on a facet at μ₀ = 0.3, L = 0.55 gives 0.685
against L = 1.0's 1.000 — a **32 % error**, and one that reads as crater walls being darker than
they should be. Fix it; it is one number.

---

## A2. The conflict: geometric albedo > 1 against a displayable range

**Short answer, stated plainly as requested: yes, this needs a decision — but it is not the decision
you think, because _the geometric albedo was never the right number to apply across the disc_, and
the `×2` in `refl` is a red herring. Measured, `refl` never exceeds 1.26 anywhere in this frame.**

### A2.1 The true fact the scene should preserve

At the geometry this scene actually presents (α ≈ 0, §0.2), the honest comparison is the ratio of
geometric albedos:

| Comparison                       | Ratio      | In magnitudes |
| -------------------------------- | ---------- | ------------- |
| **Tethys : Moon**                | **9.04 ×** | **2.39 mag**  |
| Dione : Moon                     | 7.34 ×     | 2.16 mag      |
| Rhea : Moon                      | 6.98 ×     | 2.11 mag      |
| Tethys : Mars                    | 7.23 ×     | 2.15 mag      |
| Tethys : Rhea                    | 1.29 ×     | 0.28 mag      |
| _Enceladus : Moon (not shipped)_ | _10.1 ×_   | _2.51 mag_    |

**Tethys is nine times as reflective as the Moon.** That is the fact, it is checkable, and the owner
is right that it is the single most distinctive true thing about these bodies.

**One structural mitigation, stated because it changes the weight of the tradeoff:** this scene
draws **one destination-gated sphere at a time** (`planet-sphere.ts` header). Tethys and the Moon
are **never in the same frame**. The ratio is a comparison across visits, held in memory, not a
side-by-side. That does not make it worthless — a visitor absolutely remembers whether a body looked
dazzling — but it means a monotone compression of the ratio costs far less here than it would in a
scene that showed both at once.

### A2.2 `refl` does **not** approach 2 at this geometry — measured

This part of the diagnosis is wrong, and pleasantly so.

At the frame centre the local phase angle is **exactly zero**, so `V = L`, so for **any** surface
normal `μ = N·V = N·L = μ₀` identically. Therefore

```
refl = 2·L·μ0/(μ0 + μ) + (1−L)·μ0
     = 2·L·μ0/(2·μ0)   + (1−L)·μ0
     = L + (1 − L)·μ0
```

and with **L = 1.0 this is exactly 1.000, independent of the normal.** The `2·μ0/(μ0+μ)` term can
only exceed 1 when `μ < μ0`, which requires a non-zero phase angle.

Across the framed patch the local phase angle rises to 22.87° (= the off-axis screen angle, §0.2),
so `refl` does rise — but bounded. Measured against the **actual shipped normal maps**:

| Body   | Normal-map tilt p50 / p90 / p99 / max | Smooth-sphere refl at frame edge | **Worst-case refl on the steepest texel in frame** |
| ------ | ------------------------------------- | -------------------------------- | -------------------------------------------------- |
| Tethys | 5.1° / 11.4° / 19.1° / 38.7°          | 1.086                            | **1.242**                                          |
| Dione  | 7.2° / 17.6° / 26.6° / 40.5°          | 1.086                            | **1.258**                                          |
| Rhea   | 7.2° / 12.5° / 16.9° / 27.1°          | 1.086                            | **1.161**                                          |

> **`refl` ∈ [1.000, 1.26] everywhere the camera can see, on every one of these three bodies.**
> `refl → 2` needs `μ → 0` — facets viewed edge-on, which are foreshortened to near-zero screen area
> _and_ simultaneously at low μ₀. It is not reachable in practice at α = 0 with a 22.9° half-FOV.

**So the blowout is not `refl`. It is `uAlbedo × 3.6 × surface`, entirely.**

### A2.3 What is actually blowing out — measured across the whole shipped set

The shipped textures are **not** normalised. The C4.1 brief's §4 recommendation — _"normalise each
texture so its mean luminance equals the body's geometric albedo, computed once at bake time"_ — was
never implemented. So `surface` carries whatever exposure the source capture had, and the shader
multiplies that by the albedo _and_ by 3.6. Measured cos-latitude-weighted mean luminance of every
shipped `-surface-` map, and the resulting mean output at `refl = 1.0`:

| Body       | Texture mean | p × 3.6 | **Mean output** | p99 output | Status      |
| ---------- | ------------ | ------- | --------------- | ---------- | ----------- |
| **Dione**  | 0.605        | 3.593   | **2.173**       | 3.284      | **clipped** |
| **Europa** | 0.844        | 2.412   | **2.035**       | 2.243      | **clipped** |
| **Tethys** | 0.407        | 4.424   | **1.802**       | 2.915      | **clipped** |
| **Rhea**   | 0.380        | 3.416   | **1.300**       | 2.357      | **clipped** |
| **Venus**  | 0.503        | 2.480   | **1.248**       | 2.049      | **clipped** |
| **Io**     | 0.533        | 2.268   | **1.209**       | 1.680      | **clipped** |
| Ceres      | 0.554        | 0.324   | 0.180           | 0.266      | ok          |
| Mars       | 0.408        | 0.612   | 0.250           | 0.608      | ok          |
| Moon       | 0.575        | 0.490   | 0.282           | 0.396      | ok          |

> **This is not a Tethys problem. Measured, the `3.6` gain already saturates six of the shipped
> bodies — Dione, Europa, Tethys, Rhea, Venus and Io — and only Mars and the Moon, the two bodies it
> was tuned on, fall inside the displayable range.** Europa has been rendering at a mean output of
> 2.03 since C4.1. Tethys is not the cause; it is the body that made an existing systemic saturation
> undeniable.
>
> Note also the second, unmodelled coupling: the texture means range from **0.380 (Rhea) to 0.844
> (Europa)** — a factor of **2.2** of pure capture-exposure variation multiplying straight into the
> output, entirely unrelated to any body's real albedo. Dione outranks Tethys in the table above
> _despite having the lower albedo_, purely because its source map was captured brighter.

### A2.4 The physically-grounded escape — and it is real, not a workaround

**The geometric albedo is defined at α = 0.000° and it is only valid there.** What pushes these
three above unity is the **opposition surge** — shadow hiding (SHOE, angular half-width ~1–6°) plus
coherent backscatter (CBOE, ~0.1–0.5°). Verbiscer et al. measured these values _by observing at
sub-0.1° phase specifically, because that is the only place the peak exists._

In this scene, the local phase angle rises at **0.045° per pixel** from the frame centre (= 1/1277
rad per pixel, §0.3). Therefore:

| Feature                         | Half-width | **Radius on the 1198-px disc** | Fraction of the lit disc's area |
| ------------------------------- | ---------- | ------------------------------ | ------------------------------- |
| **CBOE (coherent backscatter)** | 0.1–0.5°   | **2 – 11 px**                  | 3 × 10⁻⁶ – 8 × 10⁻⁵             |
| **SHOE (shadow hiding)**        | 1 – 6°     | **22 – 134 px**                | 3 × 10⁻⁴ – 1.3 × 10⁻²           |
| The rest of the disc            | —          | out to 1198 px                 | > 98.7 %                        |

> **Applying a geometric albedo of 1.229 uniformly across Tethys's disc paints a 2-pixel
> coherent-backscatter spike over the entire body.** That is BROKEN PHYSICS in the strict sense of
> this brief's taxonomy: a real, correctly-measured number, applied at a geometry where it does not
> hold. It is the same failure shape as lighting a radar map — nothing is fabricated, the _domain_
> is wrong.

An independent confirmation from the phase integrals: `q = A_B/p` is 0.51–0.65 for these bodies
against 1.5 for a Lambert sphere. A body whose disc-integrated brightness falls that steeply with
phase is, by definition, one whose zero-phase value is unrepresentative of every other geometry.

**The fix is to put the surge where it physically lives — in the phase function — and give the
albedo its surge-free value.** The C4.1 brief already specified the shape (§4,
`surge = 1 + A·exp(−phase_deg / w)`, recommended for the Moon and skipped elsewhere); these three
are the bodies it was really for.

```
base albedo  = Bond albedo A_B        (measured, energy-bounded, always < 1)
surge(alpha) = 1 + B0 * exp(-alpha_deg / SURGE_W_DEG)
B0           = p / A_B - 1            (so that base * surge(0) == the real geometric albedo)
```

| Body       | Base = A_B | p / A_B | **B0**    | Peak (α = 0) | e-folding radius on screen (w = 2°)                                                                           |
| ---------- | ---------- | ------- | --------- | ------------ | ------------------------------------------------------------------------------------------------------------- |
| **Tethys** | **0.80**   | 1.536   | **0.536** | 1.229        | 44 px                                                                                                         |
| **Dione**  | **0.63**   | 1.584   | **0.584** | 0.998        | 44 px                                                                                                         |
| **Rhea**   | **0.48**   | 1.977   | **0.977** | 0.949        | 44 px                                                                                                         |
| _Moon_     | _0.11_     | _1.236_ | _0.236_   | _0.136_      | 44 px                                                                                                         |
| _Mars_     | _0.25_     | _0.680_ | _−0.320_  | _0.170_      | — Mars's surge is **negative**: its dusty, forward-scattering atmosphere makes A_B > p. **Leave Mars alone.** |

`SURGE_W_DEG = 2.0` is a deliberate compromise: it is dominated by the SHOE, because the CBOE at
0.1–0.5° is a 2–11 px dot that no amount of correctness makes worth a shader term. At w = 2° the
surge e-folds by 44 px and is gone by ~150 px on a 1198-px disc — which is exactly what an
opposition spot looks like, and exactly the scale at which it has been photographed on the Moon and
on Cassini's icy-satellite approaches.

> **And here is the payoff.** §0.2 showed that this scene's α = 0 arrival geometry destroys Earth's
> terminator and hides its night lights. **It is also the one and only geometry at which an
> opposition surge is visible at all** — and these three bodies have the strongest opposition surges
> ever measured. The camera that ruins Earth is the camera that was built for Tethys. That is a
> genuinely free, genuinely distinctive, genuinely correct piece of physics, and no other body in
> this pack can show it.
>
> It also resolves the owner's real objection. The thing worth preserving is not the raw number
> 1.229 — it is _that these bodies are conspicuously brighter than the Moon_. The surge formulation
> keeps both: the base ratio (Tethys : Moon = 0.80 : 0.11 = **7.3 ×**, against the true zero-phase
> **9.0 ×** — a 19 % compression, and a _physically meaningful_ one, since it is precisely the
> difference in surge strength between icy and silicate regolith) **and** a real bright bloom at the
> sub-solar point that the Moon shows far more weakly.

### A2.5 Both sides, quantified, for the owner to decide

Even with the surge relocated, `0.80 × 0.407 × 3.6 = 1.17` for Tethys — still over. **The `3.6` has
to move; that part is unavoidable.** Three routes, priced:

**Route 1 — implement C4.1's bake normalisation, then a plain linear gain. _(least dishonest)_**
Normalise every shipped texture at bake time so its cos-lat-weighted mean luminance is 1.0, drop the
`3.6`, and let `lit = surface_norm × base_albedo × refl × surge`.

- Mean output becomes **exactly the base albedo**: Tethys 0.80, Dione 0.63, Rhea 0.48, Venus 0.76,
  Europa 0.62, Io 0.56, Mars 0.25, Moon 0.11, Ceres 0.034.
- **Every ratio is exact**, by construction. Nothing is compressed.
- Nothing clips at the mean. Tethys's p99 (1.61 × its mean) reaches 1.29 and clips the brightest
  ~1 % of the disc, plus the surge spot at the frame centre — which is a perfectly ordinary
  photographic outcome and arguably the correct look for a backscatter bloom.
- **Cost:** a pipeline change in `build-planet-textures.mjs`, a re-bake and re-ship of every planet
  texture (the assets are already ~221 MB, so this is a re-upload, not a size increase), a shader
  change removing `uAlbedo`'s current role, and a visual regression across all nine bodies. The Moon
  drops from 0.282 to 0.11 — **2.6 × darker than it renders today** — which is _correct_ (the Moon
  really is asphalt-dark) but is a real, visible change to one of the scene's two showcase bodies.

**Route 2 — keep the textures, replace `3.6` with a real tone curve.**
`Ld = L / (1 + L)` is not an arbitrary artistic curve: it is the **Naka-Rushton / Michaelis-Menten
photoreceptor response**, the measured response of vertebrate photoreceptors, and it is the reason a
human eye can see both the Moon and Tethys at all. Reinhard tone mapping is that equation.

| Body                         | Linear output today | **Reinhard `L/(1+L)`** | Extended Reinhard, W = 3 |
| ---------------------------- | ------------------- | ---------------------- | ------------------------ |
| Dione                        | 2.173               | 0.685                  | 0.815                    |
| Europa                       | 2.035               | 0.670                  | 0.798                    |
| Tethys                       | 1.802               | 0.643                  | 0.771                    |
| Rhea                         | 1.300               | 0.565                  | 0.649                    |
| Venus                        | 1.248               | 0.555                  | 0.632                    |
| Io                           | 1.209               | 0.547                  | 0.620                    |
| Moon                         | 0.282               | 0.220                  | 0.222                    |
| Mars                         | 0.250               | 0.200                  | 0.202                    |
| **Tethys : Moon in display** | **6.4 : 1**         | **2.9 : 1**            | **3.5 : 1**              |

- **Nothing ever clips** — Reinhard asymptotes to 1.
- Ordering is strictly preserved; every body stays in the right rank.
- **Cost:** the true 9.0 : 1 ratio compresses to 2.9 : 1 (or 3.5 : 1 extended), and every body's
  appearance changes at once. One divide per fragment.

**Route 3 — a per-body gain.** Cheapest, and I recommend against it: it destroys the ratio, which is
the only thing in this section worth protecting. It would make every body look "correctly exposed"
and make every brightness statement in the dossiers false.

### A2.6 The plain answer

> **Yes — an albedo above unity cannot be displayed without a tone-mapping decision, because the
> display range is [0, 1] and 1.229 is, by definition, brighter than a perfect white Lambertian
> disc. There is no gain that avoids it.**
>
> **But the decision is much smaller than it looks, and here is the least-dishonest option:**
>
> 1. **Move the opposition surge out of `uAlbedo` and into `refl`** (§A2.4). This is a physics fix,
>    not a display fix, and it should happen regardless of what is decided about the gain. It drops
>    every base albedo in the set to ≤ 0.80 and it _adds_ a real, visible, distinctive effect that
>    this camera geometry is uniquely able to show.
> 2. **Then Route 1** (bake normalisation + linear gain). With the surge removed, a plain linear
>    pipeline displays every body with **exact ratios** and clips only the brightest ~1 % of Tethys
>    and Dione plus their surge spots. No tone curve is needed at all, and no ratio is compressed.
> 3. **Route 2 is the fallback if the re-bake is too expensive.** It never clips, it is grounded in
>    real photoreceptor physiology, and it costs the ratio: 9.0 : 1 becomes 2.9 : 1.
>
> **What must not happen is clamping `uAlbedo` to 1.0.** That would be the worst of all options: it
> destroys the ratio _and_ keeps the wrong physics, telling the viewer that Tethys and a
> hypothetical perfect white reflector are the same thing, when the real statement is that Tethys is
> brighter than one — at exactly one angle, for a specific and beautiful reason.
>
> **And whichever route is taken, the true number belongs in the dossier text**, where the render
> cannot carry it: _"Tethys reflects nine times as much sunlight as the Moon — its surface is
> continuously repainted with fresh water-ice frost from Enceladus's plumes."_ That sentence is free,
> exact, and immune to tone mapping.

---

## A3. The `+0.06` ambient: Saturnshine is real and it is ~100× earthshine

**Verdict: the shipped `+0.06` is a declared legibility floor, and it happens to be nearly right for
Tethys, 1.4 × too bright for Dione, 2.7 × too bright for Rhea — and 140 × too bright for the Moon it
was written for. But it is unobservable at the current camera, so fixing it changes nothing on
screen today.**

### A3.1 The real numbers

The irradiance at a satellite from its primary at full phase is `F/E_sun = p_primary · (R/d)²`.
Saturn: R_eq = 58,232 km, geometric albedo 0.499.

| Satellite           | d (km)    | Saturn's angular diameter in its sky | **Saturnshine / direct sunlight** | vs. earthshine |
| ------------------- | --------- | ------------------------------------ | --------------------------------- | -------------- |
| **Tethys**          | 294,619   | **22.8°** (45 × the Moon in our sky) | **1.95 %**                        | **164 ×**      |
| **Dione**           | 377,396   | **17.8°**                            | **1.19 %**                        | **100 ×**      |
| **Rhea**            | 527,108   | **12.7°**                            | **0.61 %**                        | **51 ×**       |
| _Moon (earthshine)_ | _384,400_ | _1.90°_                              | _0.0119 %_                        | _1 ×_          |

Translating into the shader's own units — the day term peaks at `refl × 3.6 = 3.6`, so a physically
scaled ambient is `fraction × 3.6`:

| Body       | Shipped ambient | **Physically correct ambient**         | Error                                      |
| ---------- | --------------- | -------------------------------------- | ------------------------------------------ |
| **Tethys** | 0.06            | **0.070**                              | 0.86 × — **essentially right by accident** |
| **Dione**  | 0.06            | **0.043**                              | 1.4 × too bright                           |
| **Rhea**   | 0.06            | **0.022**                              | 2.7 × too bright                           |
| _Moon_     | _0.06_          | **_0.00043_**                          | **_140 × too bright_**                     |
| _Mars_     | _0.06_          | _~0.00002_ (Phobos/Deimos + starlight) | _~3000 × too bright_                       |

So the shipped constant is not a physical figure at all — it is a legibility floor tuned so the
night side is not pure black, which is exactly what the shader comment says. **What is new is that
for these three bodies a real figure exists and is the same order of magnitude**, which makes
Saturn's icy satellites the only bodies in this scene where the ambient term can be honest rather
than declared.

### A3.2 Three real refinements, and why I would still ship none of them today

1. **Saturnshine is directional, not ambient.** All three are tidally locked, so the sub-Saturn
   point is at a **fixed body longitude**. A physically-correct term is a second directional light at
   that longitude — pale gold (Saturn's B−V ≈ 1.04; linear RGB ≈ (1.00, 0.95, 0.82)) — with the
   intensity above. The anti-Saturn hemisphere **never** receives it, which is a real, checkable
   asymmetry that a flat ambient cannot express.
2. **Ringshine is small, and for a satisfying reason.** Saturn's rings are bright, but Tethys, Dione
   and Rhea all orbit within ~1° of the ring plane — so they see the rings **edge-on**, and the
   contribution is a fraction of a percent of Saturnshine. The geometry cancels the effect. Worth a
   sentence in a dossier; worth nothing in a shader.
3. **The maximum coincides with eclipse season.** As with earthshine on the Moon, the night side
   receives maximum Saturnshine when the primary is near full as seen from the satellite — which is
   when the satellite is near Saturn's anti-solar side, i.e. near eclipse. Real, and completely
   unrenderable in a scene with no orbital motion for these bodies.

**Why none of it ships today:** at α = 0 the night side is **100 % occluded** (§0.2). The in-frame
N·L range is [0.979, 1.000] and the darkest point on the entire visible cap is 0.684. **The ambient
term contributes to zero visible pixels**, exactly as Earth's city lights do. Changing 0.06 to
0.070 / 0.043 / 0.022 is free and correct and will not alter a single rendered pixel until the
arrival geometry changes (§2.6).

I would still make the change, because it costs one line and because it stops being cosmetic the
moment that decision is taken.

---

## A4. The finding that ties both halves of this brief together

At α = 0 with L = 1.0, `refl = L + (1−L)·μ₀ = 1.000` **exactly, for every surface normal** (§A2.2).

> **The normal maps that were added to reveal surface detail on these three bodies contribute
> literally nothing at the frame centre, and at most ±16 % at the frame edge.**

This is not a defect in the maps — they are good (measured: median tilt 5–7°, p99 17–27°, no
terracing). It is the **full-Moon effect**, arriving exactly as the physics predicts: a
backscattering regolith viewed at zero phase is a flat, evenly-lit disc with no visible relief. It is
why every telescope observer looks at the terminator and nobody looks at the full Moon, and the C4.1
brief said so in §7 before anyone knew the scene had pinned itself to α = 0.

So the same single change unlocks, at once:

| Feature                                    | At α = 0 (today)                 | At α ≈ 90°                                                         |
| ------------------------------------------ | -------------------------------- | ------------------------------------------------------------------ |
| Earth's terminator                         | never in frame                   | through the frame centre                                           |
| Earth's city lights                        | 0 visible pixels                 | ~50 % of the frame                                                 |
| Earth's twilight band                      | not in frame                     | ~290 px                                                            |
| Earth's cloud shadows                      | 0.45 px                          | 12–25 px                                                           |
| **Normal-map relief on Tethys/Dione/Rhea** | **0 % at centre, ±16 % at edge** | **full Lommel-Seeliger shading, crater shadows at the terminator** |
| Ambient / Saturnshine                      | 0 visible pixels                 | the night limb                                                     |
| **Ocean glint on Earth**                   | **maximal, centred**             | **lost — specular point 45° off-frame**                            |
| **Opposition surge on the icy satellites** | **maximal, centred**             | **lost — the surge exists only at α ≲ 6°**                         |

**The last two rows are the cost, and they are not small.** The α = 0 geometry is not simply bad: it
is the geometry that maximises the two _backscatter_ phenomena in this pack — Earth's sunglint and
the icy satellites' opposition surge — while eliminating every _terminator_ phenomenon. A per-body
arrival phase (Earth and the cratered bodies at ~90°, Tethys/Dione/Rhea/Europa at 0°) would take
both, at the cost of a per-body special case in a path that currently has none.

That is the owner's call, and it is now quantified on both sides.

---

## Addendum summary — corrected constants

```ts
// ---- PLANET_ALBEDO: CONFIRMED as geometric (Verbiscer et al. 2007) --------
dione:  0.998,   // CONFIRMED. Bond 0.63, q = 0.631
rhea:   0.949,   // CONFIRMED. Bond 0.48, q = 0.506
tethys: 1.229,   // CONFIRMED. Bond 0.80, q = 0.651. > 1 is REAL (E-ring frost + opposition surge)
// supersedes the C4.1 brief's Voyager-era rhea 0.65 / dione 0.66

// ---- ROTATION_PERIOD_S: all tidally locked, all PROGRADE ------------------
dione:  236469.5,  // <-- CORRECTED from 236429 (+40.5 s). 2.736915 d = 65.686 h. Comment was right
rhea:   390373.5,  // CONFIRMED (4.518212 d)
tethys: 163106.1,  // CONFIRMED (1.887802 d)
// wall clock at ROTATION_TIME_ACCEL = 1e3: tethys 163 s, dione 236 s, rhea 390 s

// ---- lunarLambertL: the 0.55 fallback is BROKEN PHYSICS for all three -----
dione:  1.0,   // airless icy regolith - the strongest backscatter measured anywhere
rhea:   1.0,
tethys: 1.0,
// 0.55 is MARS's value and Mars has an atmosphere. Cost of the fallback: 0.9% on the
// smooth sphere at alpha = 0, but 32% on a mu0 = 0.3 crater wall.

// ---- Bond albedos (the surge-free base, and a hard energy bound) ----------
BOND_ALBEDO = { tethys: 0.80, dione: 0.63, rhea: 0.48, moon: 0.11, mars: 0.25,
                venus: 0.76, europa: 0.62, io: 0.56, ceres: 0.034 }

// ---- Opposition surge: move it OUT of uAlbedo and INTO refl --------------
// surge(a) = 1 + B0 * exp(-a_deg / SURGE_W_DEG);   base = Bond albedo
SURGE_B0    = { tethys: 0.536, dione: 0.584, rhea: 0.977, moon: 0.236 }  // = p/A_B - 1
SURGE_W_DEG = 2.0        // SHOE-dominated; CBOE at 0.1-0.5 deg is a 2-11 px dot, not worth a term
// at 0.045 deg/px this e-folds over 44 px on a 1198-px-radius disc
// MARS IS THE EXCEPTION: p (0.170) < A_B (0.25), so its "surge" is NEGATIVE. Leave Mars alone.

// ---- Physical bodies -----------------------------------------------------
RADIUS_KM     = { tethys: 531.0,  dione: 561.4,  rhea: 763.5 }
SEMI_MAJOR_KM = { tethys: 294619, dione: 377396, rhea: 527108 }

// ---- Saturnshine: replaces the flat +0.06 for these three ----------------
// F/E_sun = p_saturn * (R_saturn/d)^2, p_saturn = 0.499, R_saturn = 58232 km
SATURNSHINE_FRACTION = { tethys: 0.01950, dione: 0.01188, rhea: 0.00609 }
NIGHT_AMBIENT        = { tethys: 0.070,   dione: 0.043,   rhea: 0.022 }   // = fraction * 3.6
// for scale: earthshine on the Moon is 0.000119 -> ambient 0.00043, so the shipped
// +0.06 is 140x too bright for the Moon. It is a DECLARED legibility floor, not physics.
SATURN_TINT_LINEAR_RGB = [1.00, 0.95, 0.82]   // Saturn B-V ~ 1.04, pale gold
// Saturnshine is DIRECTIONAL and lights only the (tidally locked) sub-Saturn hemisphere.
// Ringshine is negligible: all three orbit within ~1 deg of the ring plane, seeing the rings edge-on.

// ---- Measured shader facts (not chosen - measured this session) -----------
REFL_MAX_IN_FRAME    = 1.26   // measured against the real normal maps; the feared 2.0 is unreachable
REFL_AT_FRAME_CENTRE = 1.000  // EXACT, for any normal, because V = L makes mu == mu0
// Mean output = texMean * albedo * 3.6 at refl = 1:
//   dione 2.17, europa 2.04, tethys 1.80, rhea 1.30, venus 1.25, io 1.21  <- ALL CLIPPED
//   ceres 0.18, mars 0.25, moon 0.28                                      <- the tuning bodies
// Shipped texture means span 0.380 (rhea) to 0.844 (europa) - a 2.2x unmodelled exposure
// variation multiplying straight into the output. C4.1's bake normalisation was never implemented.
```

### Addendum verdict table

| #   | Element                                  | Verdict                                        | Action                                                                                              |
| --- | ---------------------------------------- | ---------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| 1   | `PLANET_ALBEDO` dione/rhea/tethys        | **ACCURATE**                                   | Confirmed against Verbiscer et al. 2007; supersedes C4.1's rhea 0.65 / dione 0.66                   |
| 2   | `ROTATION_PERIOD_S` rhea, tethys         | **ACCURATE**                                   | Exact                                                                                               |
| 3   | `ROTATION_PERIOD_S` dione                | **arithmetic slip**                            | **236429 → 236469.5** (the comment's own 2.736915 d)                                                |
| 4   | `lunarLambertL` fallback 0.55            | **BROKEN PHYSICS**                             | **1.0 for all three.** 0.55 is Mars's, and Mars has an atmosphere                                   |
| 5   | Geometric albedo applied across the disc | **BROKEN PHYSICS**                             | It is an α = 0 quantity; the surge is a **2–134 px** feature. Move it into `refl`                   |
| 6   | `refl` "approaches 2"                    | **not reproduced**                             | **Measured max 1.26 in frame; exactly 1.000 at the centre for any normal**                          |
| 7   | The `3.6` gain                           | **systemically saturating**                    | Clips **six** shipped bodies, not one. Europa has been at 2.03 since C4.1                           |
| 8   | Un-normalised textures                   | **unimplemented C4.1 step**                    | 2.2× exposure spread (0.380–0.844) multiplying into every body's output                             |
| 9   | Displaying p > 1                         | **needs a tone-mapping decision**              | Surge relocation first; then Route 1 (exact ratios, ~1 % clip) or Route 2 (Reinhard, 9.0:1 → 2.9:1) |
| 10  | Clamping `uAlbedo` to 1.0                | **worst option**                               | Destroys the ratio _and_ keeps the wrong physics                                                    |
| 11  | Flat `+0.06` ambient                     | **DECLARED, and 140× too bright for the Moon** | Real Saturnshine: **0.070 / 0.043 / 0.022**. Unobservable at α = 0                                  |
| 12  | Normal maps on these three               | **0 % effect at frame centre**                 | The full-Moon effect, correctly. Gated on the same §2.6 arrival-phase decision                      |

---

# ADDENDUM 2 (2026-07-22) — catalog entries for Earth, Tethys, Dione and Rhea

**Mode:** SCIENCE-BRIEF (placement), with per-decision REALISM-AUDIT verdicts
**Requested by:** Procyon — four bodies now ship real sphere textures but have no
`celestial-catalog.js` entry and are therefore unreachable.
**Scope:** placement only (ra / dec / ly / mg / sp / c / d). Rendering questions are settled in
the body of this brief and its first addendum; nothing here changes them.

This is a **frames** question before it is a data-entry question, so §B0 establishes the frame
and §B3 answers Earth out of it. Every number below was computed this session from the shipped
`bodyDepth`, `bodyWorldPosition`, `warpDurationForLy` and `WarpOverlay` code, or from published
photometry.

---

## B0. What frame is this catalog actually in? (measured, and it is not what one file says)

Three files make three different claims about the world origin:

| Source                           | Claim                                                                                   |
| -------------------------------- | --------------------------------------------------------------------------------------- |
| `HUD.tsx:84`                     | `ORIGIN · SOL-3 (EARTH)`                                                                |
| `planet-sphere.ts:319` (comment) | "`bodyWorldPosition` places every catalog body relative to **Sol** at the world origin" |
| `celestial-catalog.js:8`         | the Sun is a **body**, at ra 250 / dec −20.5 / ly 1 AU — _not_ at the origin            |

**The HUD is right and the comment is loose.** The evidence is the data, not the prose:

1. Every ra/dec in the file is **J2000 apparent place** — which is by definition _as seen from
   Earth_. The Sun's own entry, ra 250 / dec −20.5, is a real geocentric solar position (16h40m,
   −20.5° — the Sun in early December). A heliocentric catalog cannot contain that number.
2. `celestial-minorplanets.js` was built by `scripts/gaia-minorplanet-position.mjs`, which
   TR-065 explicitly computed as _"a Meeus low-precision solar ephemeris for the **Earth-relative
   view**"_. Vesta's `ly: 0.000033` = **2.087 AU**, its stated **geocentric** distance.
3. `celestial-catalog.js:20` gives the Moon `ly: 0.00000004` = **384,400 km** — its distance
   from Earth, not from Sol.
4. `goHome` warps to `[0, 0, 0]` (`babylon-engine.ts:4748`) and `WarpOverlay.tsx:48` prints
   _"returning to origin"_.

> **The world origin is Earth.** The catalog is a geocentric apparent-place catalog with a
> geocentric distance column, and `goHome` returns the visitor to the observer's own position.
> `sunDirectionFrom`'s "Sol at the world origin" is a **lighting simplification** that happens to
> be a good one — it is exact for the Sun's own entry and holds elsewhere to within the real
> Sun–body–Earth phase angle, which is ≤ 6.1° at Saturn, ≤ 3.1° at Uranus and ≤ 1.9° at Neptune.
> It is a poor approximation only for Mercury and Venus (real phase angles reach 90–150°), and it
> is **undefined** for Earth. That last case is §B3.

**Verdict on `sunDirectionFrom`'s comment: SIMPLIFIED, not broken — but the comment overstates it.**
Recommend it say "_relative to an origin the lighting model treats as Sol; the catalog's own frame
is geocentric, and the two agree to the body's real phase angle (≤ 6° beyond Jupiter)_".

---

## B1. The shared `ly: 0.0000158` — a no-op, and provably so

**Verdict: DECLARED LICENSE, and functionally inert. Nothing real breaks. Do not spend effort
here, and do not let any of the four new bodies deviate from their local neighbours.**

`bodyDepth(ly) = 150 + 128·log₁₀(ly + 1.5)`. The `+1.5` offset is the whole story: anything with
`ly ≪ 1.5` sits on a floor.

| Body / value                        | `ly`        | depth (wu)     |
| ----------------------------------- | ----------- | -------------- |
| Moon (real, 0.00257 AU)             | 4.06 × 10⁻⁸ | **172.539683** |
| Shared 1 AU                         | 1.58 × 10⁻⁵ | **172.540267** |
| Saturn at opposition (8.54 AU)      | 1.35 × 10⁻⁴ | 172.544684     |
| Neptune (30 AU)                     | 4.74 × 10⁻⁴ | **172.557259** |
| `ly: 0` → falsy → 0.001 substituted | 0.001       | **172.576729** |
| Proxima Centauri (4.24 ly)          | 4.24        | 247.140722     |

> **The entire solar system — Moon to Neptune, an 11,700:1 range in true distance — spans
> 0.0176 world units of depth.** That is **0.046 % of `ARRIVE_STANDOFF` (38)** and **0.068 % of the
> sphere radius (26)**. The log-depth function annihilates the distance column inside the solar
> system before any placement decision is made.

The three other consumers agree:

- **Warp duration.** `warpDurationForLy` clamps on `log₁₀(ly+1)/4`. 1 AU → **1400.005 ms**,
  30 AU → **1400.144 ms**, the Moon → **1400.000 ms**. A **0.14 ms** spread on a 1400 ms floor.
- **HUD text.** `WarpOverlay.tsx:44` prints _"final approach"_ for any `ly ≤ 0.01`. Every
  solar-system body, true distance or shared, prints the same string. The number is never shown.
- **Brightness.** `mg` is a display string; nothing photometric reads `ly`. There is no
  inverse-square path to break.

**One genuinely funny consequence, and it decides §B3:** `bodyDepth` reads `(ly || 0.001)`, so
**`ly: 0` is falsy and substitutes 0.001 ly = 63.2 AU**. Entering a body's _true_ zero distance
places it at depth **172.5767 — deeper than Neptune, the single deepest solar-system placement the
file can produce.** The scheme cannot express "here".

**Should any of the four deviate?** No.

- Tethys / Dione / Rhea: take **`0.0000158`**, matching Saturn, Titan and Enceladus. Their true
  geocentric distance (≈ 9.5 AU) would move them 0.0044 wu — invisible — while breaking the
  internal consistency of the Saturn block, which is the only thing the field can still do
  usefully. _Optional and additive:_ setting the whole Saturn block (Saturn, Titan, Enceladus and
  the three new entries) to `0.00015` would make the field true at literally zero visual cost. It
  touches shipped entries, so it is the owner's call, not a fix.
- Earth: see §B3. There is no correct value, which is itself the finding.

---

## B2. Tethys, Dione, Rhea — the offsets are 37–64× real, and they have to be

### B2.1 The real angular separation, computed

A moon at orbital radius _a_, seen from Earth at geocentric distance _D_, reaches a maximum
elongation θ = _a/D_. At Saturn's opposition distance _D_ = 8.537 AU = 1.277 × 10⁹ km:

| Moon       | _a_ (km)  | θ_max (deg) | θ_max (arcsec) | at depth 172.54 |
| ---------- | --------- | ----------- | -------------- | --------------- |
| Enceladus  | 237,948   | 0.01068     | 38.4″          | 0.032 wu        |
| **Tethys** | 294,619   | **0.01322** | **47.6″**      | **0.040 wu**    |
| **Dione**  | 377,396   | **0.01693** | **61.0″**      | **0.051 wu**    |
| **Rhea**   | 527,108   | **0.02365** | **85.1″**      | **0.071 wu**    |
| Titan      | 1,221,870 | 0.05482     | 197.3″         | 0.165 wu        |
| Iapetus    | 3,560,820 | 0.15975     | 575.1″         | 0.481 wu        |

For scale: Saturn's equatorial disc is **9.7″** of radius and the A-ring's outer edge **22.1″**.
Tethys's real elongation is 2.2 ring-radii. **The classical inner six fit inside a 0.11° circle.**

### B2.2 The catalog's offsets, measured against that

| Moon      | catalog ra/dec | sep. from parent | at depth 172.54 | real θ_max | ratio     |
| --------- | -------------- | ---------------- | --------------- | ---------- | --------- |
| Titan     | 285.9 / −21.6  | 0.9264°          | 2.790 wu        | 0.05482°   | **16.9×** |
| Enceladus | 284.4 / −22.4  | 0.6845°          | 2.061 wu        | 0.01068°   | **64.1×** |
| Io        | 229 / −17.4    | 1.1259°          | 3.39 wu         | 0.03843°   | **29.3×** |
| Europa    | 230.8 / −18.4  | 0.8588°          | 2.59 wu         | 0.06114°   | **14.0×** |
| Ganymede  | 231.5 / −18.9  | 1.6836°          | 5.07 wu         | 0.09752°   | **17.3×** |
| Callisto  | 228.2 / −17    | 1.9867°          | 5.98 wu         | 0.17152°   | **11.6×** |

> **Verdict: DECLARED LICENSE — but currently _undeclared_, which is the only defect here.**
> The spread is 12–64× the true maximum elongation. It is also, at Jupiter, **rank-wrong**: the
> catalog makes Io (_a_ = 421,800 km) the _most_ separated Galilean and Europa the least, while the
> truth is strictly monotonic in _a_.

**Why the license is forced rather than chosen — and why TR-065's argument does not transfer.**
TR-065 replaced fixed ra/dec for the minor planets with real Kepler because a heliocentric body's
true position is _computable and visually meaningful_: Vesta and Hygiea sit ~100° apart on the real
sky. For a **satellite**, the true position is computable and **visually meaningless**: at depth
172.54, Tethys's real 47.6″ is **0.040 world units** from Saturn, while the rendered sphere has a
**26-unit radius**. Two beacons 0.04 wu apart are one pixel, unpickable, and `travelTo` becomes a
coin-flip. Even the licensed ~0.8° spread only buys 2–3 wu — still deep inside Saturn's own sphere.
**The log-depth compression, not taste, sets this floor.** Declare it; do not "fix" it.

Two further honest notes for the declaration: the offsets are **fixed**, whereas real elongation
cycles ±θ_max in half a period (Tethys 1.888 d, Dione 2.737 d, Rhea 4.518 d), so the layout is a
frozen instant with five moons simultaneously near maximum elongation on five different sides — a
possible but momentary configuration; and all three orbit within ~1° of the ring plane, so a real
view has them strung along a line, not scattered in position angle.

**The free improvement, taken in the values below:** rank the new offsets by true orbital radius,
so the license is at least _rank-honest_ inside the Saturn system —
Enceladus 0.685° < **Tethys 0.758°** < **Dione 0.820°** < **Rhea 0.882°** < Titan 0.926°, against
the true ordering 237,948 < 294,619 < 377,396 < 527,108 < 1,221,870 km. Position angles are spread
to keep every pair ≥ 0.61° apart (minimum: Titan–Rhea, comparable to the existing Enceladus–Saturn
spacing).

### B2.3 Magnitudes — and a cross-check that catches a permuted albedo assignment

Published mean-opposition visual magnitudes (NASA/JPL Saturnian satellite fact sheet, the same
source as the shipped Titan 8.4 and Enceladus 11.7): **Tethys 10.2, Dione 10.4, Rhea 9.7.**

These are checkable against the geometric albedos this brief's first addendum confirmed, since
reflected flux ∝ _p·r²_. Anchoring on Rhea:

| Moon   | _p_ (Verbiscer 2007) | _r_ (km) | predicted V | published V | Δ         |
| ------ | -------------------- | -------- | ----------- | ----------- | --------- |
| Tethys | **1.229**            | 531.0    | 10.21       | 10.2        | **+0.01** |
| Dione  | **0.998**            | 561.4    | 10.31       | 10.4        | **−0.09** |
| Rhea   | **0.949**            | 763.5    | 9.70        | 9.7         | 0.00      |

**Closes to 0.09 mag across the set.** Note the physics it recovers: Dione is _larger_ than Tethys
and _fainter_, purely because Tethys is 23 % more reflective.

> **Flag for the requester.** The brief request listed the albedos as "0.998 / 0.949 / 1.229"
> against "Tethys, Dione, Rhea" — a **permuted** transcription. The shipped `PLANET_ALBEDO`
> (`planet-sphere.ts:162-164`) is **correct** — dione 0.998, rhea 0.949, tethys **1.229** — and the
> photometry above proves it independently: run the same check with the permuted assignment and it
> misses by **+0.51 / +0.25 mag**, a factor 1.6 in flux. Use the repo's values, not the prompt's.

### B2.4 Colour

`c` is a **UI glow token, not photometry**, and the file is candid about it once you look: the Moon
carries `#e8eaf6`, a cool blue-white, for a body with B−V = 0.92 — distinctly warm grey-brown.
The real colours here are **near-white with a faint cream cast**: B−V ≈ 0.73 (Tethys), 0.71 (Dione),
0.78 (Rhea), against the Sun's 0.653 — all three within 0.13 mag of solar, with Rhea the reddest (it
also has the strongest leading/trailing hemispheric asymmetry, its trailing side visibly darker and
redder). Photometrically honest hexes, sun-white-balanced, would be ≈ `#fffaee` / `#fffbf1` /
`#fff7e8` — three indistinguishable near-whites, which is why the file does not do that.

**Recommendation: stay in the existing indigo ramp, ordered by albedo,** which encodes the one real
fact worth encoding — that these are among the most reflective surfaces in the solar system:

- Tethys (_p_ 1.229) → **`#e8eaf6`** (indigo-50, the Enceladus/Europa step — both E-ring-frosted, both _p_ > 1)
- Dione (_p_ 0.998) → **`#dfe3f4`** (one interpolated step between indigo-50 and indigo-100)
- Rhea (_p_ 0.949) → **`#c5cae9`** (indigo-100, the Ganymede/Ceres step)

**Hard constraint:** none of the three may take `#9fa8da` (indigo-200). That is Callisto's token,
and Callisto's geometric albedo is **0.17** — these three are **5.6–7.2× more reflective**. Giving
Rhea Callisto's colour would contradict the single most distinctive real fact about the Saturnian
icy satellites, which the first addendum already fought to preserve in the shader.

---

## B3. Earth — incoherent as a travel destination, and the honest alternative is better

> ### Verdict: **BROKEN PHYSICS if shipped as a catalog entry with any ra/dec.** Earth must not be a `travelTo` destination in this frame. It should be the origin, revealed by `goHome`.

### B3.1 Why there is no value to enter

Under the frame established in §B0, the catalog's ra/dec is **geocentric apparent place** and `ly`
is **geocentric distance**. For Earth:

- **Distance = 0.** Exactly, by construction.
- **Direction = undefined.** `raDecToDir` needs a unit vector; Earth's geocentric position vector is
  the zero vector, whose direction is 0/0. This is not a quantity that is hard to measure or that
  varies with epoch — it is a quantity that **does not exist**. Any ra/dec entered is not an
  approximation of anything; it is fabricated. The realism map ranks fabricated positions as
  BROKEN PHYSICS, and it does not carve out an exception for the observer.

The engine says the same thing mechanically, three times:

1. `bodyDepth(0)` → `(0 || 0.001)` → **depth 172.5767**, deeper than Neptune (§B1). The visitor
   would warp 172.6 world units _away from Earth_, _to Earth_.
2. `sunDirectionFrom([0,0,0])` hits its own `len < 1e-6` guard and returns **`[0,0,1]` — "arbitrary
   but stable"** by the comment's own admission. Earth's sphere would be lit from a direction the
   code openly documents as meaningless.
3. `goHome` already warps to `[0,0,0]` and already refuses to run when `|cam| < 1` — _"already
   home"_. The origin is already occupied, by Earth, by design.

**The deepest reason, and the one that should settle it:** every other RA/Dec in the catalog — all
168,959 objects, all 101 curated bodies — is measured **from Earth**. Put Earth in that list and the
list loses its origin. You have made the ruler one of the things being measured. That is not a
fidelity compromise; it is a category error, and it is the one entry in the file that would
retroactively weaken every other entry.

### B3.2 The honest alternative — and it is the only placement in the scene that can show a terminator

**Earth stays the origin. Its sphere is revealed by `goHome`, not by `travelTo`.**

This is not a consolation prize. It is strictly better, for a reason that falls straight out of §0.2
of this brief:

§0.2 measured that the arrival phase angle is **exactly 0.000° for every body, always**, because
`travelTo` parks on the origin–body line while `sunDirectionFrom` calls that same origin the Sun.
V = L, forced. That degeneracy is what kills the night lights (§2), the terminator, the 290-px
twilight band and the cloud shadows (§3.5).

**At the origin the degeneracy does not exist**, because the two vectors decouple:

- Earth's sphere centre is the origin — **no fabricated position at all**.
- The Sun direction is **real and already in the file**: the Sun's own entry, ra 250 / dec −20.5 →
  **`(−0.320361, −0.880184, −0.350207)`**. Not `sunDirectionFrom`'s arbitrary fallback — the
  catalog's own datum.
- The camera's parked direction is a **genuinely free parameter**, because a spacecraft in Earth
  orbit really can be anywhere. Choosing it is not a lie; it is a vantage.

So choose quadrature. Park along **ra 160° / dec 0°** → **u = (−0.939693, 0.342020, 0)**, camera at
`38·u` = **(−35.708, 12.997, 0.000)**. Verified: **u · sunDir = −3.3 × 10⁻¹⁶ → phase angle
90.0000°.**

At that vantage the visitor gets, on the one body they have personally seen from orbit:

| Feature               | At α = 0 (every other body) | At the home vantage, α = 90°                |
| --------------------- | --------------------------- | ------------------------------------------- |
| Terminator            | 90° out of frame            | **dead frame centre**                       |
| Night hemisphere      | 100 % occluded              | **~50 % of the frame**                      |
| City lights (§2.3)    | zero visible pixels         | **the whole §2.3 composite**                |
| Twilight band (§2.2)  | absent                      | **≈ 290 px, and unique to Earth**           |
| Cloud shadows (§3.5)  | 0.45 px                     | **12–25 px**                                |
| L = 0 vs L = 1 (§1.3) | 0 % at centre               | **37–67 %** — the decision starts mattering |
| Ocean glint (§4)      | centred and guaranteed      | **lost** (specular point 45° off-frame)     |

That last row is the declared trade §2.6 already quantified: **glint and city lights are mutually
exclusive at this 45.84° FOV.** The difference is that at home you can take that trade **for Earth
alone**, without touching `travelTo`, without changing any other body's arrival, and without a
per-body special case in the travel path.

> **This is the finding.** §2.6 asked the owner to change the arrival geometry for _every_ body to
> unlock Earth's night side. Putting Earth at the origin unlocks the same four features for the one
> body that has them, at zero cost to the other twelve, and it is the _more_ honest option rather
> than the compromise. The engineering seam is `goHome`'s arrival, not `travelTo`.

Two engineering notes for Procyon (spec, not code): `goHome`'s early-out at `|cam| < 1` means the
home sphere must be shown at the parked offset, not at the origin itself; and the home sphere's sun
direction must be read from the Sun's catalog entry, never from `sunDirectionFrom(origin)`, whose
documented fallback is arbitrary.

### B3.3 If the owner ships it as a catalog entry anyway — the one non-arbitrary placement

Should the owner overrule this, there is exactly one placement that is _derived_ rather than picked,
and it should be declared in those words.

Place Earth at the **antisolar point** of the Sun's own catalog entry: **ra 70 / dec +20.5**. Then
`sunDirectionFrom(dir·depth) = −dir` returns **`(−0.320361, −0.880184, −0.350207)`** — verified this
session to **1.000000000** against `raDecToDir(250, −20.5)`.

> **That is not a coincidence, and it is the whole argument for this fallback: the antisolar point
> is the unique direction at which the engine's origin-is-Sol lighting simplification returns
> Earth's _true_ Sun vector.** Every other ra/dec would light Earth from a direction wrong by the
> angle between it and 70/+20.5. It is also, physically, the midnight direction — where an observer
> on Earth looking away from the Sun looks — so the fabrication at least points somewhere real.

Sanity-checked for collisions: nearest neighbour is Venus (75 / +23) at **5.27°**, ≈ 15.9 wu apart
at depth 172.54. Clear.

**The declaration this requires, verbatim in the entry's comment:**

> _Earth has no geocentric position — this catalog's frame is geocentric, so Earth's direction is
> 0/0 and its distance is 0. Ra 70 / dec +20.5 is the antisolar point of the Sun's entry
> (ra 250 / dec −20.5), chosen because it is the one placement for which `sunDirectionFrom` returns
> Earth's real Sun vector. It is a navigational fiction, not a position, and it contradicts the
> HUD's `ORIGIN · SOL-3 (EARTH)` and `goHome`'s "returning to origin"._

Note `ly`: **`0.0000158`**, not `0`. Not because 1 AU is right — it is meaningless — but because
`bodyDepth` reads `(ly || 0.001)` and would silently substitute **63.2 AU**, placing Earth deeper
than Neptune (§B1). If the entry ships, the shared value is the less-wrong of two wrong numbers.

### B3.4 `mg` for Earth, and why it is the tell

Earth's photometry has no apparent magnitude, because apparent magnitude requires an observer. What
exists is **V(1,0) = −3.99** (NASA Planetary Fact Sheet) — the magnitude at 1 AU from both Sun and
observer, at full phase. Every other `mg` in the file ("−4.4", "8.4", "10.2") is a real apparent
brightness _from Earth_; Earth's would have to be annotated to mean anything at all.

> **The `mg` field cannot be filled honestly with a bare number, and that is the same finding as
> §B3.1 arriving through a different column.** When two independent fields of a schema both go
> undefined for one row, the row is not the problem — the row is in the wrong table.

---

## Addendum 2 — values to enter

Saturnian moons only. Earth is listed for completeness under the §B3.3 declaration and is **not
recommended**.

| field | **Tethys**           | **Dione**        | **Rhea**                  | _Earth (declared fallback only)_ |
| ----- | -------------------- | ---------------- | ------------------------- | -------------------------------- |
| `id`  | `tethys`             | `dione`          | `rhea`                    | _`earth`_                        |
| `n`   | `Tethys`             | `Dione`          | `Rhea`                    | _`Earth`_                        |
| `d`   | **`Saturn III`**     | **`Saturn IV`**  | **`Saturn V`**            | _**`Sol III · Terra`**_          |
| `t`   | `moon`               | `moon`           | `moon`                    | _`planet`_                       |
| `r`   | `uncommon`           | `uncommon`       | `rare`                    | _`legendary`_                    |
| `ra`  | **`285.5`**          | **`284.3`**      | **`285.4`**               | _**`70`**_ (antisolar)           |
| `dec` | **`-22.6`**          | **`-21.5`**      | **`-21.2`**               | _**`20.5`**_                     |
| `ly`  | `0.0000158`          | `0.0000158`      | `0.0000158`               | _`0.0000158`_ (never `0`)        |
| `mg`  | **`10.2`**           | **`10.4`**       | **`9.7`**                 | _**`−3.99 · at 1 AU`**_          |
| `sp`  | `Near-pure ice moon` | `Ice-cliff moon` | `Icy moon · O₂ exosphere` | _`Rocky · N₂–O₂ · oceans`_       |
| `c`   | `#e8eaf6`            | `#dfe3f4`        | `#c5cae9`                 | _`#bcd4ff`_                      |

Derived separations from Saturn (285 / −22): **Tethys 0.758°, Dione 0.820°, Rhea 0.882°** — ranked
by true orbital radius, bracketed by the existing Enceladus 0.685° and Titan 0.926°. Minimum
pairwise separation across all five moons is **0.614°** (Titan–Rhea), comparable to the existing
Enceladus–Saturn spacing.

## Addendum 2 verdict table

| #   | Element                                        | Verdict                            | Action                                                                                                                    |
| --- | ---------------------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Earth as a `travelTo` catalog entry**        | **BROKEN PHYSICS**                 | **Do not ship.** Geocentric direction is 0/0, distance is 0; `bodyDepth(0)` lands it deeper than Neptune                  |
| 2   | Earth revealed by `goHome` at the origin       | **ACCURATE, and recommended**      | Sphere at origin; sun dir from the Sun's own entry; park at ra 160 / dec 0 → **α = 90.0000°**                             |
| 3   | Earth's `mg`                                   | **undefined**                      | Only V(1,0) = −3.99 exists; a bare apparent magnitude requires an observer                                                |
| 4   | Antisolar fallback (ra 70 / dec +20.5)         | **DECLARED LICENSE**               | The unique placement where `sunDirectionFrom` returns Earth's true Sun vector — declare it verbatim                       |
| 5   | Shared `ly: 0.0000158`                         | **DECLARED LICENSE, inert**        | Whole solar system spans **0.0176 wu**; warp-duration spread **0.14 ms**; HUD prints "final approach" for all             |
| 6   | `ly: 0` anywhere                               | **avoid**                          | Falsy → substitutes 0.001 ly = **63.2 AU**                                                                                |
| 7   | Moon offsets ~0.5–1.0° from parent             | **DECLARED LICENSE (undeclared)**  | 12–64× true max elongation; forced by log-depth (real Tethys = **0.040 wu** against a 26-wu sphere)                       |
| 8   | Jupiter moons' offset **ordering**             | **rank-wrong**                     | Io is most-separated in the file, least in reality; not fixed here (touches shipped entries)                              |
| 9   | New Saturn offsets ranked by true _a_          | **SIMPLIFIED, improved**           | 0.758 / 0.820 / 0.882° — rank-honest inside the declared spread                                                           |
| 10  | `mg` 10.2 / 10.4 / 9.7                         | **ACCURATE**                       | Cross-checks against _p·r²_ to **0.09 mag**                                                                               |
| 11  | Albedo assignment in the request               | **permuted**                       | Shipped `PLANET_ALBEDO` is right (tethys **1.229**); the permutation misses photometry by **0.51 mag**                    |
| 12  | `c` as photometry                              | **it never was**                   | Real B−V 0.71–0.78 (near-white); ramp by albedo instead, and **never** give these three Callisto's `#9fa8da` (_p_ = 0.17) |
| 13  | `sunDirectionFrom`'s "Sol at the world origin" | **SIMPLIFIED, comment overstates** | Frame is geocentric; agreement is to the real phase angle (≤ 6° beyond Jupiter, 90–150° at Venus)                         |
