# Card content sources — batch 2 (41 NGC2000 nebula texts)

**Date:** 2026-07-25
**Slice:** [PF-11 D4.4 batch 2](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#d44-content-pass) ·
[TR-100](../test-reports/TR-100.md) (drafted) · [TR-101](../test-reports/TR-101.md) (approved &
wired)
**Status:** ✅ APPROVED by the owner 2026-07-25 and wired into the shipped overlay
(`celestial-content-overlay-ngc2000.js`). See TR-101.

## Scope of this batch

All 41 NGC2000 nebula entries in `celestial-ngc2000.js` (the Billboard-archetype tier; the
other 8 of the pack's 47 are custom-shader Volume objects, still blocked per that file's own
header) whose `"f"` field carried the `[[TODO: content pass — PF-10 C1 NGC2000 billboard tier,
no per-object dossier authored]]` marker — confirmed exhaustive by parsing the module's `var G`
array directly (41 matches, cross-checked 1:1 against the overlay's own key set).

## Method

Research was fanned out to five parallel research passes (~8 objects each), each required to
verify object identity via live web search before drafting (not trust a supplied guess blindly)
and to ground every claim in a source found this session — no fact drafted from memory alone.
Numerical facts (distance, size) were **not re-derived**; the pipeline's own `"st"` field is the
factual anchor, exactly as batch 1 established. Two data-quality findings surfaced during
research and are recorded here rather than silently worked around (see below).

## Data-quality findings (flagged, not fixed — out of scope for a content-only overlay)

- **`ngc2000-crescent-nebula`'s own `ly` field (5, i.e. ~1.5 pc) is very likely a data-pipeline
  error.** The real Crescent Nebula (NGC 6888, Cygnus) is ~4,700-5,200 ly away per multiple
  sources — roughly three orders of magnitude off the catalog's stored value. The authored text
  deliberately never states a distance figure for this id (unit-tested directly in
  `celestial-content-overlay-ngc2000.test.ts`), so the anomaly can't leak into shipped copy, but
  the underlying record itself still needs a pipeline fix outside this batch's scope.
- **`ngc2000-butterfly-nebula` and `ngc2000-bug-nebula` are two genuinely different real
  objects that happen to share the popular nickname "Butterfly Nebula"** — NOT a pipeline
  duplicate, despite the surface-level suspicion that prompted a flag mid-research. Verified
  directly against this catalog's own `ra`/`dec`/`ly` fields:
  - `ngc2000-bug-nebula`: `d` field explicitly reads `"NGC 6302 · nebula"`; ra/dec/ly match the
    real NGC 6302 (Scorpius) — the "Bug Nebula," whose wide-field Hubble imagery is also
    informally called "the Butterfly Nebula" by some sources, adding to the surface confusion.
  - `ngc2000-butterfly-nebula`: `d` field is generic `"Nebula"` (unresolved by the pipeline),
    but ra=256.407/dec=-10.1423/ly=2100 match Minkowski 2-9 (M2-9, Ophiuchus) almost exactly —
    confirmed via a live search this session (M2-9's published distance is ~2,100 ly). M2-9 is
    independently nicknamed "Minkowski's Butterfly" / "the Butterfly Nebula" for its own,
    unrelated bipolar shape. Content for this id was drafted for M2-9, not NGC 6302.
- **A related naming collision, noted but not actionable:** `ngc2000-box-nebula` (NGC 6309,
  confirmed via ra/dec) and `ngc2000-little-gem-nebula` (NGC 6445, confirmed via its own `d`
  field reading `"NGC 6445 · nebula"` — NOT NGC 6818, the more commonly-cited "Little Gem,"
  which this catalog does not appear to carry under this id) are BOTH informally nicknamed "Box
  Nebula" in amateur sources. Each entry's authored text was verified against its own
  coordinates rather than the shared nickname.
- **`ngc2000-little-dumbbell`'s `d` field reads `"NGC 650 · nebula"`** specifically (one of the
  two NGC numbers — 650 and 651 — that make up the combined Messier object M76, a fossil of
  Herschel having catalogued the nebula's two lobes as separate objects). The authored text
  describes the double-cataloguing history accurately without asserting which specific half
  this record's own position data corresponds to.

## Per-object sources

| id                                 | Verified identity                         | Claim(s) verified this session                                                                             | Source(s)                                                                                                                                                                 |
| ---------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ngc2000-crab-nebula`              | M1 / NGC 1952                             | 1054 CE supernova recorded in East Asia; Messier's 1758 mix-up with a comet, seeding his catalogue         | Messier, _Catalogue des Nébuleuses..._ (1774)                                                                                                                             |
| `ngc2000-lagoon-nebula`            | M8 / NGC 6523                             | Hodierna catalogued it 1654, a century before Messier (1764)                                               | Hodierna, _De Admirandis Coeli Caracteribus_ (1654)                                                                                                                       |
| `ngc2000-eagle-nebula`             | M16 / NGC 6611                            | Hubble's 1995 "Pillars of Creation" image, Hester & Scowen, 32 stitched exposures                          | Hester & Scowen, HST observations (April 1995)                                                                                                                            |
| `ngc2000-omega-nebula`             | M17 / NGC 6618                            | Multiple historical nicknames (Swan/Horseshoe/Lobster); John Herschel's 1833 "Omega" naming sketch         | John Herschel, observational sketches (1833)                                                                                                                              |
| `ngc2000-trifid-nebula`            | M20 / NGC 6514                            | Named for 3 dust lanes by John Herschel; a 4th lane recorded by William Herschel                           | Herschel nebula catalogue notes (mid-1800s)                                                                                                                               |
| `ngc2000-dumbbell-nebula`          | M27 / NGC 6853                            | First planetary nebula ever catalogued, Messier, July 12 1764                                              | Messier, _Catalogue..._, entry of 1764-07-12                                                                                                                              |
| `ngc2000-orion-nebula`             | M42 / NGC 1976                            | First nebula ever photographed, Henry & Anna Draper, Sept 30 1880 (50-min exposure)                        | Draper, photographic plate (1880)                                                                                                                                         |
| `ngc2000-ring-nebula`              | M57 / NGC 6720                            | Darquier's 1779 "fading planet" description coined the term "planetary nebula"                             | Darquier de Pellepoix, observational account (1779)                                                                                                                       |
| `ngc2000-owl-nebula`               | M97 / NGC 3587                            | Méchain 1781 discovery; Earl of Rosse's 1848 sketch of the "eyes" named it                                 | Parsons (Earl of Rosse), telescope sketches (1848)                                                                                                                        |
| `ngc2000-horse-head-nebula`        | Barnard 33                                | Williamina Fleming's 1888 Harvard plate description predates Barnard's own catalogued discovery            | Fleming, HCO plate notes (1888); Dreyer, IC                                                                                                                               |
| `ngc2000-butterfly-nebula`         | **M2-9 (Minkowski 2-9)**, NOT NGC 6302    | Minkowski catalogued it 1947 as the 9th object in his 2nd list; ~1,200-yr-old outer shell; ~2,100 ly       | Minkowski, nebula survey (1947); [Wikipedia — M2-9](https://en.wikipedia.org/wiki/M2-9); [Constellation Guide](https://www.constellation-guide.com/twin-jet-nebula-m2-9/) |
| `ngc2000-hourglass-nebula`         | MyCn 18 ("Engraved Hourglass Nebula")     | 1996 Hubble WFPC2 image (Sahai & Trauger); NOT the Lagoon's much-closer "Hourglass" knot                   | Sahai & Trauger, HST WFPC2 imagery (released 1996-01-16)                                                                                                                  |
| `ngc2000-cat-s-eye-nebula`         | NGC 6543                                  | Huggins' 1864 spectrum — first planetary-nebula spectrum, proved it was gas not unresolved stars           | Huggins, spectroscopic observations (1864-08-29)                                                                                                                          |
| `ngc2000-helix-nebula`             | NGC 7293                                  | Closest planetary nebula to Earth; ~31 km/s expansion rate dates ejection to ~10,600 yr ago                | Kinematic expansion-rate studies of the outer ring                                                                                                                        |
| `ngc2000-maia-nebula`              | NGC 1432                                  | Henry brothers' 1885 photographic plate — too faint to see visually, only found photographically           | Paul & Prosper Henry, photographic plate, Paris Obs. (1885-11-16)                                                                                                         |
| `ngc2000-merope-nebula`            | NGC 1435 / Tempel's Nebula                | Tempel's 1859 discovery; Barnard's 1890 IC 349 knot and priority dispute with Pritchard                    | Barnard, Lick Obs. 36-inch refractor (1890-11-14)                                                                                                                         |
| `ngc2000-california-nebula`        | NGC 1499                                  | Barnard's 1885 discovery; very low surface brightness requires narrowband filters                          | Barnard (1885); surface-brightness studies                                                                                                                                |
| `ngc2000-hind-s-variable-nebula`   | NGC 1555                                  | Hind's 1852 discovery while asteroid-hunting; variability tied to T Tauri (namesake of T Tauri stars)      | Hind (1852)                                                                                                                                                               |
| `ngc2000-ngc-2068`                 | M78 / NGC 2068                            | Méchain 1780 discovery, Messier catalogued same year; brightest reflection nebula                          | Méchain (1780); Messier (1780)                                                                                                                                            |
| `ngc2000-rosette-nebula`           | NGC 2237/2238/2239/2246 complex           | 100+ "globulettes" (sub-Jupiter-mass gas clumps) surveyed by Gahm et al.                                   | Gahm et al., globulette surveys (Onsala/APEX/ESO NTT)                                                                                                                     |
| `ngc2000-hubble-s-variable-nebula` | NGC 2261                                  | Mellish noticed variability 1915; Hubble confirmed/published 1916                                          | Hubble, _ApJ_ (October 1916)                                                                                                                                              |
| `ngc2000-crescent-nebula`          | NGC 6888                                  | Herschel's 1792 discovery log; central WR136 star ~55,000°C — see data-quality note above                  | Herschel (1792)                                                                                                                                                           |
| `ngc2000-veil-nebula`              | Cygnus Loop (NGC 6960/6992/6995)          | Herschel logged separate arcs 1784 before they were tied together as one shattered shell                   | Herschel (1784)                                                                                                                                                           |
| `ngc2000-north-america-nebula`     | NGC 7000                                  | Herschel 1786 discovery; Max Wolf's 1890 photograph first showed the continental shape                     | Max Wolf (1890)                                                                                                                                                           |
| `ngc2000-bubble-nebula`            | NGC 7635                                  | Central O6.5 supergiant's wind, per ESA/Hubble; Herschel's 1787 log undersold it entirely                  | Herschel's observing log (1787-11-03)                                                                                                                                     |
| `ngc2000-flaming-star-nebula`      | IC 405                                    | AE Aurigae is a runaway star ejected from Orion's Trapezium ~2.6 Myr ago                                   | Runaway-star dynamical studies of the Trapezium ejection event                                                                                                            |
| `ngc2000-witch-head-nebula`        | IC 2118                                   | Reflection nebula lit by Rigel; same scattering physics as a blue daytime sky                              | Reflection-nebula photometry of the Orion-Eridanus complex                                                                                                                |
| `ngc2000-pelican-nebula`           | IC 5070                                   | Same molecular cloud as the North America Nebula, split visually by foreground dust; real ionization front | NASA APOD ionization-front feature (2000-07-03)                                                                                                                           |
| `ngc2000-little-dumbbell`          | M76 (NGC 650/651) — see data-quality note | Herschel catalogued the two lobes separately; Curtis confirmed the true nature in 1918                     | Messier's catalog entry (1780); Curtis (1918)                                                                                                                             |
| `ngc2000-eskimo-nebula`            | NGC 2392                                  | Herschel's 1787 discovery; Hubble's 2000 image explains the "fur hood" appearance                          | Herschel's discovery log (1787-01-17)                                                                                                                                     |
| `ngc2000-eight-burst-nebula`       | NGC 3132 (Southern Ring)                  | JWST's 2022 imaging revealed a bound companion star + wider multi-star system                              | JWST imaging study (2022)                                                                                                                                                 |
| `ngc2000-ghost-of-jupiter`         | NGC 3242                                  | Herschel's 1785 discovery; the term "planetary nebula" traces to this class's telescope-era resemblance    | Herschel's discovery log (1785-02-07)                                                                                                                                     |
| `ngc2000-blue-planetary`           | NGC 3918                                  | Nickname traces to resemblance with Voyager 2's 1989 Neptune images                                        | Naming history cross-checked against Voyager 2 Neptune imagery (1989)                                                                                                     |
| `ngc2000-bug-nebula`               | NGC 6302 — see data-quality note above    | Small-aperture "Bug" view vs. Hubble-resolved wide "Butterfly" wings, same real object                     | ESA/Hubble imaging releases on NGC 6302 (2009-2010)                                                                                                                       |
| `ngc2000-box-nebula`               | NGC 6309                                  | Tempel's 1876 discovery; Hubble's 1995 imaging resolved a close double central star                        | HST imaging of NGC 6309 (1995)                                                                                                                                            |
| `ngc2000-little-gem-nebula`        | NGC 6445 — see data-quality note above    | Herschel's 1786 discovery; ~3,300 yr old; asymmetric bipolar outflow beyond the bright "square" core       | Herschel's discovery log (1786-05-28)                                                                                                                                     |
| `ngc2000-saturn-nebula`            | NGC 7009                                  | Herschel's 1782 discovery; Lord Rosse's 1840s telescope resolved the ansae, prompting the "Saturn" name    | Lord Rosse's observations, 72-inch "Leviathan" (1840s)                                                                                                                    |
| `ngc2000-blue-snowball-nebula`     | NGC 7662                                  | Herschel's 1784 discovery; "Blue Snowball" name coined later by writer Leland S. Copeland                  | Popular-astronomy writings of Leland S. Copeland (20th c.)                                                                                                                |
| `ngc2000-tarantula-nebula`         | NGC 2070 / 30 Doradus (LMC)               | R136 super star cluster hosts stars >100 solar masses, per VLT-MUSE spectroscopy                           | VLT-MUSE spectroscopic survey of the R136 core                                                                                                                            |
| `ngc2000-christmas-tree-cluster`   | NGC 2264                                  | Herschel's 1784/1786 discoveries of the cluster and the Cone Nebula; 600+ members, 1-4 Myr old             | Herschel's discovery logs (1784, c. 1786)                                                                                                                                 |
| `ngc2000-cocoon-nebula`            | IC 5146                                   | Max Wolf's 1894 photographic discovery; illuminating star is ~100,000 yr old, still forming                | Max Wolf's photographic discovery survey (1894-07-28)                                                                                                                     |

## Owner approval

**Granted 2026-07-25.** Content is live in `celestial-content-overlay-ngc2000.js`, wired into
SpaceScene's import chain immediately after batch 1's own overlay — see TR-101.
