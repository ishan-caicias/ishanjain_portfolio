# Science Brief — Original procedural shapes for 8 real NGC2000 volume nebulae

**Date:** 2026-07-20
**Mode:** SCIENCE-BRIEF
**Requested by:** Procyon, for PF-10 C1's NGC2000 volume-nebula reveal-mechanism redesign.
**Context:** Procyon is porting 8 real NGC2000 "Volume"-archetype objects (currently blocked by
`nebula-field.ts`'s 4-volume reveal-uniform cap) into the site's existing raymarch pipeline. The
owner declined to port Gaia Sky's bespoke shadertoy-derived GLSL shaders for these 8 objects
(CC-BY-NC-SA, non-commercial licensed) and asked for **original** procedural shapes instead,
built from simple SDF primitives (sphere/torus/capped-cone/box, CSG union/subtract) composed with
the site's existing fbm-noise "wispy texture" model — matching the treatment already used for the
4 shipped showcase volumes (Orion/M42, Veil, Rosette, and the existing Helix placeholder).

This brief classifies each recommendation on the accurate/simplified/declared-license/broken-
physics scale. All 8 recommendations land ACCURATE or SIMPLIFIED — none require a declared
license, because "an SDF-primitive cartoon of a real nebula's known morphology" is exactly the
same kind of legitimate simplification the 4 existing showcase volumes already use (a spherical
shell + fbm wisps is itself a simplified stand-in for real turbulent gas structure).

---

## 1. Helix Nebula (NGC 7293)

- **Real classification:** Planetary nebula (PN) — the ejected outer envelope of a dying
  Sun-like star, now a white dwarf.
- **Real structure:** One of the closest PNe to Earth (~650–700 ly; the site's ~656 ly is
  consistent). Famous "Eye of God" look: a bright, nearly face-on **ring** with fine radial
  filamentary "cometary knots" at the rim (dense gas globules being eroded by the fast wind from
  the central white dwarf), plus a fainter, larger, slightly misaligned outer disk. Real
  ionization stratification: hotter, higher-ionization gas (O III) sits closer to the central
  white dwarf; cooler, lower-ionization gas (H-alpha/N II) sits at the outer rim — this pattern is
  common to essentially every PN in this set and is real photoionization physics, not an
  aesthetic choice.
- **Recommended SDF:** A **torus**, oriented face-on to a fixed reference axis (matching the real
  object's near-face-on real-sky orientation is not necessary for a stylized volume — orientation
  is an art choice). fbm-perturb the torus tube radius for the knotty rim texture.
- **Colours:** Core (colA) teal/cyan-green (O III), edge (colB) red/pink (H-alpha + N II) —
  ionization-stratified, inverted from a naive "hot center = red" assumption.
- **Verdict: SIMPLIFIED.** A single clean torus omits the real double-ring/misaligned-disk
  structure and the fine cometary-knot filaments, but captures the one feature the object is
  actually famous for (the ring) with the correct real ionization-colour stratification.

## 2. Cat's Eye Nebula (NGC 6543)

- **Real classification:** Planetary nebula.
- **Real structure:** Arguably the most structurally complex PN known — 11+ concentric spherical
  shells detected around a bright, knotty, slightly elongated inner core with jet-like
  protrusions, evidence of periodic mass-loss episodes from the central star roughly every
  1,500 years. Distance ~3,300 ly in the most-cited modern value; the site's ~3,600 ly is within
  the historically-cited range for this object (its distance has had real measurement spread).
- **Recommended SDF:** A small, slightly elongated **ellipsoid/sphere** core (bright, knotty via
  higher-frequency fbm) **unioned with 1–2 larger, much fainter concentric spherical shells**
  (a thin-shell SDF: `|sphere(p, R)| - shellThickness`, i.e. subtract a slightly smaller sphere
  from a slightly larger one to get a hollow shell rather than a solid ball). The concentric-shell
  motif is the single most real, most famous, most citable feature of this specific object — worth
  the extra primitive over a plain sphere.
- **Colours:** Same ionization stratification — teal/green core, red-pink outer shell(s).
- **Verdict: SIMPLIFIED.** Real object has 11+ shells at varying real thicknesses/spacings; 1–2
  procedural shells is a legitimate, honestly-reduced stand-in for "known to have many concentric
  shells," not a fabrication of a different structure.

## 3. Box Nebula (NGC 6309)

- **Real classification:** Planetary nebula.
- **Real structure:** The informal name is literally descriptive — Hubble imagery shows a
  distinctly **rectangular/parallelogram-shaped** bright inner region (a real, unusual, genuinely
  box-like PN morphology, thought to arise from a fast bipolar outflow interacting at oblique
  angles with slower earlier ejecta), with a fainter round outer halo and two faint
  point-symmetric extensions beyond the box.
- **Recommended SDF:** A **rounded box** (`roundBox` SDF — a standard box SDF with a small corner
  radius so it doesn't read as a hard CAD primitive) as the bright core, **unioned with a larger,
  much fainter sphere** for the halo.
- **Colours:** Same ionization stratification, though the "box" itself is closer to uniformly
  ionized than the more radially-stratified objects above — a milder core-to-edge gradient is
  defensible.
- **Verdict: ACCURATE.** This is the one case in the set where the common name IS the real SDF
  primitive — a box literally is what the real Hubble image shows. Rare, worth noting explicitly.

## 4. Butterfly Nebula (M2-9 / Twin Jet Nebula)

- **Real classification:** Bipolar planetary nebula.
- **Real structure:** The textbook bipolar/"butterfly" PN — two large, roughly wing-shaped lobes
  extending from a compact central binary star system, with thin, fast, extended jets breaking out
  through the lobe tips. Distance estimates for this object genuinely vary in the literature
  (~1,200–4,900 ly across different studies); the site's ~2,100 ly sits within that real spread,
  not a fabricated number.
- **Recommended SDF:** Two opposed **capped cones**, wide at the outer end and tapering toward a
  shared point at the centre (two ice-cream cones tip-to-tip along one axis) — the standard,
  textbook-accurate bipolar-PN primitive.
- **Colours:** Orange-red lobes (N II/H-alpha) with a cooler cyan/blue rim where the faster
  outflow shocks into slower gas (shock-ionization runs hotter/bluer than the ambient
  photoionized gas) — real, documented for bipolar PNe generally.
- **Verdict: ACCURATE.** Two opposed capped cones is the standard schematic representation of a
  bipolar PN in the professional astronomy literature itself, not a portfolio-specific
  simplification.

## 5. Hourglass Nebula (MyCn18)

- **Real classification:** Young, compact bipolar planetary nebula.
- **Real structure:** THE archetypal hourglass shape — the object the 1996 Hubble image made
  famous specifically because of how cleanly it shows two large symmetric lobes meeting at an
  extremely narrow central waist, with a small bright ring visible right at the pinch point (an
  equatorial density enhancement, real and imaged). Real distance ~7,900–8,000 ly is a
  well-cited figure; the site's ~8,000 ly matches closely.
- **Recommended SDF:** Same two-opposed-capped-cones primitive as Butterfly, but with a
  **much narrower shared waist radius**, plus a **small bright torus right at the waist** for the
  real central ring feature.
- **Colours:** The real Hubble image is a specific, well-known reference: red (N II/H-alpha)
  outer lobes transitioning to green/blue (O III) near the hot central waist — the same
  ionization-stratification pattern as Helix, but along the bipolar axis instead of radially.
- **Verdict: ACCURATE.** This is the best-documented bipolar PN in astronomy imaging; the
  cone-cone-plus-waist-ring composition maps directly onto the real, famous reference image.

## 6. Crab Nebula (M1)

- **Real classification:** **Supernova remnant** — genuinely different physics from the other 7,
  which are all planetary nebulae. The Crab is the remnant of SN 1054 (a documented historical
  supernova, observed and recorded by Chinese and Arab astronomers), containing the **Crab
  Pulsar** at its centre. Distance ~6,300–6,500 ly is one of the best-measured in this set; the
  site's ~6,500 ly matches essentially exactly.
- **Real structure:** An **irregular, ragged, filamentary** expanding shell (NOT smooth or
  point-symmetric like a PN) with a real aspect ratio of roughly 1.4:1 (mildly elongated
  ellipsoid, not circular), surrounding a **smooth, featureless blue-white glow** at the centre —
  this inner glow is not line emission at all, it's **synchrotron radiation**: relativistic
  electrons spiraling in the pulsar's magnetic field, a genuinely distinct emission mechanism from
  every other colour source in this brief.
- **Recommended SDF:** A flattened **ellipsoid**, heavily perturbed by **higher-frequency,
  higher-amplitude fbm noise** than any other volume in the set (to read as ragged/filamentary
  rather than smooth), unioned with a **smaller, smooth, minimally-perturbed inner sphere** for
  the synchrotron glow.
- **Colours:** Red/pink filaments (H-alpha, [S II]) for the outer shell; a genuinely distinct
  **blue-white, not-tied-to-an-ionization-line** colour for the inner synchrotron glow — this is
  the one object in the set where "blue center" is real physics, not decorative choice.
- **Verdict: ACCURATE** on structure (ellipsoid + heavy noise + smooth inner glow all map to real,
  documented Crab morphology) and **worth flagging explicitly in code comments** that this is the
  only supernova remnant in the set, not a planetary nebula — a real astronomical distinction a
  reviewer or a curious visitor might reasonably ask about.

## 7. Ring Nebula (M57)

- **Real classification:** Planetary nebula — the archetype the term "ring nebula" comes from.
- **Real structure:** Viewed nearly face-on: a bright elliptical ring with a fainter,
  football/American-football-shaped inner glow region, and an extended faint outer halo. Real
  distance, from a recent Gaia parallax measurement, is ~2,283 ly — the site's ~2,300 ly is an
  excellent match, one of the most precisely known distances in this entire set.
- **Recommended SDF:** A **torus** (same primitive family as Helix, but should read visually
  distinct: a thicker, brighter, cleaner rim with less knotty fbm perturbation than Helix's, since
  Ring's real image is comparatively smoother) **unioned with a flattened ellipsoid** inside the
  torus for the real football-shaped inner glow.
- **Colours:** Same real ionization stratification — the inner "football" glow is blue-green
  (O III), the outer ring rim is red (H-alpha/N II). This exact two-colour pattern is one of the
  most iconic images in amateur and professional astrophotography alike.
- **Verdict: ACCURATE.** Torus + inner ellipsoid is a direct, textbook match to the real, very
  well-imaged structure of this specific object.

## 8. Trifid Nebula (M20)

- **Real classification:** Combined **emission nebula** (H II region, red, ionized by young hot
  O-type stars) **+ reflection nebula** (blue, starlight scattered off dust) — a genuinely
  different physical composition from every PN/SNR above.
- **Real structure:** Named for appearing visually split into **three lobes** by dark linear dust
  lanes converging near the centre (true dust **extinction** — near-total absorption/blocking of
  light along those lanes, not merely "dark-coloured" gas), with a separate blue reflection-nebula
  component adjacent to one side. Distance has real literature spread: an older, still commonly
  cited figure is ~5,200 ly (the site's value); more recent Gaia-based work suggests it may be
  closer, ~4,100 ly — both are defensible, worth a one-line note rather than treating either as
  definitively "the" answer.
- **Recommended SDF:** An oblate **sphere/ellipsoid** for the red emission region, with **2–3 thin
  box or capped-cylinder volumes SUBTRACTED** (not unioned — genuinely a different CSG operation
  than every other object in this set) radiating from near-centre outward, representing the real
  dust lanes as near-total local extinction rather than a colour choice. Add a smaller, separate,
  blue-tinted blob offset to one side for the real adjacent reflection-nebula component.
- **Colours:** Red H-alpha for the main body, genuinely near-black/near-zero-density along the
  subtracted lanes (this should suppress emission, not just tint it dark), and a distinct blue
  region for the reflection-nebula lobe.
- **Verdict: ACCURATE** on the emission+reflection colour split and the dust-lane-as-subtraction
  technique (which is real physics — extinction removes light, it doesn't add dark pigment); the
  exact lane geometry (2–3 lanes converging near-centre) is a **SIMPLIFIED** stand-in for the
  real, more irregular lane pattern.

---

## Summary table

| #   | Object               | Real type                    | SDF composition                                         | Verdict                            |
| --- | -------------------- | ---------------------------- | ------------------------------------------------------- | ---------------------------------- |
| 1   | Helix (NGC 7293)     | Planetary nebula             | Torus, fbm-perturbed rim                                | SIMPLIFIED                         |
| 2   | Cat's Eye (NGC 6543) | Planetary nebula             | Core sphere + 1–2 concentric shell(s)                   | SIMPLIFIED                         |
| 3   | Box (NGC 6309)       | Planetary nebula             | Rounded box + faint halo sphere                         | ACCURATE                           |
| 4   | Butterfly (M2-9)     | Bipolar planetary nebula     | 2 opposed capped cones                                  | ACCURATE                           |
| 5   | Hourglass (MyCn18)   | Bipolar planetary nebula     | 2 opposed capped cones, narrow waist + waist torus      | ACCURATE                           |
| 6   | Crab (M1)            | **Supernova remnant**        | Ellipsoid, heavy fbm + smooth inner glow sphere         | ACCURATE                           |
| 7   | Ring (M57)           | Planetary nebula             | Torus + inner ellipsoid                                 | ACCURATE                           |
| 8   | Trifid (M20)         | Emission + reflection nebula | Ellipsoid minus 2–3 subtracted lanes + offset blue blob | ACCURATE / SIMPLIFIED (lane count) |

**Cross-cutting real physics worth encoding, not just per-object shape:**

1. **Ionization stratification** (objects 1, 2, 5, 7 — all PNe): core bluer/greener (O III), edge
   redder (H-alpha/N II). This single rule, applied consistently, is real photoionization physics
   across 4 of the 8 objects, not 4 independent colour choices.
2. **Crab's synchrotron glow is a genuinely different emission mechanism** (relativistic electrons,
   not atomic transitions) — its blue-white colour and smoothness should read as "physically
   different," not just "another blue nebula."
3. **Trifid's dark lanes are real extinction**, not a dark colour — implemented as density
   subtraction (removing emission), the shape correctly follows the physics rather than painting
   over it.

No object in this set requires a DECLARED LICENSE verdict — every recommendation is either an
honest simplification of real, documented structure or a direct match to it.
