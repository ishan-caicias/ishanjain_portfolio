# Gaia Sky — gaiasky.space site research

**Fetched:** 2026-07-22
**Sources:**

- https://gaiasky.space/ (home)
- https://gaiasky.space/downloads/
- https://gaiasky.space/resources/
- https://gaiasky.space/resources/datasets/
- https://gaiasky.space/news/ and https://gaiasky.space/news/2026/gaiasky_3.7.4/
- https://gaiasky.space/licenses/
- https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/index.html (official docs; `docs.gaiasky.space` DNS/TLS refused connections on fetch date)
- https://codeberg.org/gaiasky/gaiasky and its `ACKNOWLEDGEMENTS.md` (linked from the site; fetched for per-asset licensing)

All content below is summarized in my own words from those pages. Short quotes are
attributed. Numbers (star counts, sizes, versions) are as published on the fetch date and
will drift — re-check before citing.

---

## 1. What Gaia Sky is

Gaia Sky is an open-source, real-time 3D universe visualization platform developed by Toni
(Antoni) Sagristà Sellés at ARI/ZAH, Heidelberg University, originally built to visualize
ESA's Gaia mission catalog. The homepage pitches it as an "open source 3D Universe
visualization platform with support for a billion objects." It runs as a desktop
application (not web) on Windows, Linux, and macOS, backed by a peer-reviewed paper ("Gaia
Sky: Navigating the Gaia Catalog", IEEE TVCG, 2018). Source is hosted on Codeberg, not
GitHub.

Relevance to this repo: Gaia Sky is the reference implementation for large-scale Gaia
catalog rendering (level-of-detail octrees over hundreds of millions of stars). Our
`<babylon-scene>` engine renders a 168,959-object catalog; Gaia Sky's LOD dataset tiering
is the mature version of the same problem and a useful benchmark for PF-11 planning.

## 2. Current version and recent releases

| Version | Date       | Highlights                                                                                                                                                                                                                                                                                                                                                                                                 |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 3.7.4   | 2026-06-17 | Atmospheric scattering overhaul: unified ground/sky path into a single `integrateAtmosphere()` integrator, Bruneton 4th-order Chapman-function polynomial for density scale (kills grazing-angle banding), ozone absorption via Gaussian stratospheric profile with Chappuis-band coefficients, terrain elevation in scattering. Also: libGDX 1.14.2, keyframe regression fixes, SSBO detection crash fix. |
| 3.7.3   | 2026-06-02 | Redesigned dataset-loading dialog and file picker with history; screen-space derivative-based line shading; PBR extensions for Wavefront OBJ; faster index creation for particle/star sets.                                                                                                                                                                                                                |
| 3.7.2   | 2026-04-08 | New billboard shading types; orbital-element group refactor; anaglyph custom colors; logarithmic UI sliders; Simplified Chinese / Japanese / Italian locales; asteroid and Saturn-ring dataset updates.                                                                                                                                                                                                    |
| 3.7.1   | 2026-02-04 | Procedural galaxy generation system; PBR shader overhaul; new 3D anaglyph modes; eclipse improvements.                                                                                                                                                                                                                                                                                                     |

Site release posts live under `https://gaiasky.space/news/2026/gaiasky_3.7.x/`. The docs
were migrated to a PyData Sphinx theme in Feb 2026.

Notable for us: the 3.7.4 atmospheric work and 3.7.1 PBR/procedural-galaxy work are
directly comparable problem domains to our shader stack (non-negotiable #10 linear-space
lighting, GLSL/WGSL twins).

## 3. Distribution and system requirements

- Packages: Windows `.exe`; macOS `.dmg` (Apple Silicon + x86_64); Linux `.deb`, `.rpm`,
  `.AppImage`, `.sh`, AUR, Flatpak; OS-agnostic `.tar.gz`. All GPG-signed.
- Minimums: OpenGL 3.3+ GPU (4.2 recommended), 1 GB VRAM, 4 GB+ RAM, Intel i5 3rd-gen
  class CPU. Storage scales with chosen datasets (1 GB base).
- The app itself ships without data; catalogs are pulled through an in-app dataset
  manager (or direct download from the datasets page).

## 4. VR support

- Full VR via **OpenXR**, on Linux and Windows only (not macOS), launched with the `-vr`
  flag or a dedicated `gaiaskyvr.exe`.
- Homepage also advertises six stereoscopic viewing modes; docs cover VR alongside
  planetarium projection, panorama, and orthosphere output modes.
- Dedicated VR docs: `https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Gaia-sky-vr.html`.

## 5. Dataset ecosystem

The datasets page (`/resources/datasets/`) is a catalog manifest — every pack has a key,
object count, download size, min Gaia Sky version, and source attribution. Structure worth
imitating: a required base pack, then star catalogs tiered by parallax-error cuts, so users
trade star count against disk/VRAM.

### 5.1 Base + textures

| Pack              | Contents                                                                 | Size                |
| ----------------- | ------------------------------------------------------------------------ | ------------------- |
| `default-data`    | Required base: solar system, constellations, Milky Way, grids, locations | (bundled meta-pack) |
| `hi-res-textures` | 4K/8K planetary + asteroid surface textures (76 textures)                | 248.1 MiB           |

### 5.2 Gaia DR3 star catalogs — small (non-LOD)

Selection criterion is bright/faint parallax relative error; every tier also folds in all
Hipparcos stars.

| Pack             | Stars  | Size      | Cut (bright/faint parallax err) |
| ---------------- | ------ | --------- | ------------------------------- |
| `gaia-dr3-best`  | 646.4k | 43.9 MiB  | 0.4% / 0.002%                   |
| `gaia-dr3-weeny` | 1.94M  | 129.7 MiB | 0.8% / 0.01%                    |
| `gaia-dr3-tiny`  | 2.55M  | 170.5 MiB | 1% / 0.01%                      |

### 5.3 Gaia DR3 level-of-detail catalogs

These are the octree/LOD sets — the headline capability. Counts and sizes as published:

| Pack                  | Stars   | Size        | Cut / selection                  |
| --------------------- | ------- | ----------- | -------------------------------- |
| `gaia-dr3-small`      | 8.2M    | 534.1 MiB   | 10% / 0.5%                       |
| `gaia-dr3-bright`     | 11.27M  | 731.0 MiB   | brightest stars, 90% / 1%        |
| `gaia-dr3-default`    | 15.13M  | 1,010.2 MiB | 20% / 1.5% (recommended balance) |
| `gaia-dr3-medium`     | 49.94M  | 3.1 GiB     | 30% / 5%                         |
| `gaia-dr3-large`      | 122.18M | 7.4 GiB     | 50% / 12.5%                      |
| `gaia-dr3-fidelity`   | 393.68M | 23.5 GiB    | astrometric fidelity > 0.5       |
| `gaia-dr3-verylarge`  | 466.14M | 27.9 GiB    | 50% parallax error               |
| `gaia-dr3-photdist`   | 470.81M | 28.1 GiB    | GSP-Phot photometric distances   |
| `gaia-dr3-extralarge` | 707.16M | 42.1 GiB    | 95% parallax error               |
| `gaia-dr3-ruwe`       | 957.75M | 57.1 GiB    | RUWE ≤ 1.4                       |
| `gaia-dr3-geodist`    | 1.47B   | 86.9 GiB    | Bailer-Jones Bayesian distances  |

So the full span runs ~646k stars / 44 MiB up to ~1.47 billion stars / ~87 GiB. Rough
rule of thumb across tiers: ~60–70 bytes per star on disk.

### 5.4 Specialty star catalogs

- `catalog-gcns` — Gaia Catalogue of Nearby Stars (Gaia EDR3, Smart et al. 2020): 331.08k objects within 100 pc, 138.4 MiB.
- `catalog-cns5` — Fifth Catalogue of Nearby Stars: 5.93k, 1.2 MiB.
- `catalog-hipparcos` — Hipparcos new reduction (van Leeuwen 2007) with curated names: 117.95k, 7.7 MiB.
- White dwarfs: DR2 (256.08k) and eDR3 (359.07k, Pwd > 0.75; Gentile Fusillo et al.), ~31 MiB each — brightened +10 mag for visibility.
- Variables: DR2 (106.34k) and DR3 (186.93k) Cepheids/RR Lyrae, brightened +5 mag.
- `catalog-gd1` — GD-1 stellar stream, 1.36k stars, 109.8 KiB.

Note the pattern: scientifically faint populations get deliberate magnitude boosts, with
the boost declared in the dataset description. That is the "declared license" approach to
realism our Astra reviews use.

### 5.5 Galaxies, clusters, other

- SDSS DR12/DR14/DR17/DR18 galaxy sets: 327.83k → 3.64M objects, 10.9–98.3 MiB.
- NEARGALCAT nearby galaxies (Karachentsev): 875 objects within ~11 Mpc.
- Open clusters: Hunt & Reffert 2023 DR3 (7.17k), Castro-Ginard DR2 (2.02k), MWSC (3.01k).
- NGC2000 nebulae: 47 bright nebulae as volumes and 3D decals.
- Oort cloud simulation (10k particles), Gargantua black hole (the _Interstellar_ one — see licensing), GPS constellation with live Celestrak TLE updates.

### 5.6 Solar system / asteroids

- Gaia FPR asteroids: 156.59k objects, 12.8 MiB; Gaia DR3: 154.79k; DR2: 14.1k; NEA and Trojan subsets colour-coded.
- Saturn rings as **1.5M particles** with a radial density profile and physics-based orbital elements (77.4 MiB) — directly relevant precedent for our GAIA-DR3-backed asteroid belt (PF-10 C3).

### 5.7 Exoplanets and Gaia discoveries

- NASA Exoplanet Archive pack: 9.79k systems rendered as per-planet-count glyphs that resolve to real stars/planets on approach.
- Eight single-system packs of Gaia-discovered/characterized systems (Gl876, HD40503, WD0141-675, brown-dwarf pair J0805+4812, etc.).
- `system-gaia-bhs`: Gaia BH1/BH2/BH3 dormant black holes (BH3: ~33 solar masses at ~590 pc).

### 5.8 Iso-density meshes and virtual textures

- Kevin Jardine's DR2/DR3 meshes: dust iso-density, HII regions, hot-star density surfaces (1.4–80 MiB).
- Virtual textures (sparse mega-textures streamed at runtime): Earth Sentinel-2/Blue Marble at 10 m/px over 31 urban areas (3.4 GiB), 128K NASA Earth (1.3 GiB), 128K GMTED2010 elevation, 64K clouds, 64K Mars (Celestia/Van Vliet, 1.2 GiB), 64K Moon LRO (2.7 GiB), Moon topography from LRO LOLA/WAC.
- Volumetric aurora using a ray-marching algorithm after Lawlor et al.

### 5.9 Spacecraft packs

Gaia itself, JWST, Hubble, Euclid, ISS, Voyagers, Pioneers, Artemis I/II — small model
packs with NASA/ESA-sourced trajectories (NASA Horizons / NASA Eyes). The Gaia mission
entry states the spacecraft operated July 2014 – January 2025 and mapped ~2 billion
objects at down to 24 microarcsecond accuracy.

## 6. Docs and other resources

- Docs (Sphinx, master build 2026-07-21): installation, dataset manager, camera/gamepad
  controls, VR, planetarium/panorama modes, procedural planet + galaxy generation,
  eclipses, Python scripting, REST server, SAMP interoperability, camera-path recording
  and keyframing, ffmpeg video capture. Canonical host:
  `https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/` (the `docs.gaiasky.space`
  alias refused HTTPS connections on the fetch date).
- `/resources/`: video tutorials, workshop decks (2021–2025), branding (logos/icons in
  SVG+PNG), the three brand fonts (Ethnocentric, Inter, Conthrax), and live usage stats at
  `https://gaia.ari.uni-heidelberg.de/gaiasky/stats/`.

## 7. Licensing notes

Accuracy matters here (PF-10 precedent). What the project itself states, per source:

### Software

- **Gaia Sky application, catgen, and documentation: MPL 2.0** (stated on `/licenses/`
  and as the repo license badge on Codeberg, `LICENSE.md`). Permissive-ish, file-level
  copyleft; fine to read for reference.

### Website and media

- **gaiasky.space website content: CC-BY-NC** — non-commercial restriction. Do not reuse
  site prose/images in a portfolio that could be construed as commercial without checking.
- **Audiovisual material produced _with_ Gaia Sky** (videos, screenshots): **CC-BY**.
- Requested (not required) credit line: "Gaia Sky (Toni Sagristà, ARI/ZAH, Heidelberg
  University)".

### Datasets

- **Original Gaia Sky datasets: CC-BY.**
- **Third-party catalogs (Gaia DRx, SDSS, etc.): the upstream license applies**, not Gaia
  Sky's. For Gaia data ESA's guidelines apply — standard credit "ESA/Gaia/DPAC". (Our own
  GAIA DR3 usage should follow ESA/DPAC terms directly, which we already do for PF-10 C3;
  Gaia Sky's page is consistent with that.)
- Several packs embed third-party assets with their own provenance: Celestia
  motherlode/John Van Vliet Mars and Moon textures, USGS elevation, NASA SVS Moon
  topography (credits Ernie Wright, Noah Petro), Kevin Jardine meshes. The datasets page
  attributes sources per pack but does not print a license string per pack — treat each as
  "check upstream before reuse".

### Per-asset licenses inside the application (from `ACKNOWLEDGEMENTS.md` in the repo)

- **Black hole shader by "set111": CC-BY-NC-SA.** This confirms the PF-10 finding — at
  least one shader shipped with Gaia Sky carries a non-commercial share-alike license and
  is presumably why the Gargantua pack exists as a separately-downloaded dataset. **Never
  port this shader (or derivatives of it) into our codebase.**
- Other stated licenses: VisUI (Apache), STIL/jsamp (AFL + BSD), gl-noise (MIT), Open
  Iconic (MIT). Most texture/model credits (Nick Risinger Milky Way panorama, Solar System
  Scope planetary textures, Tom Patterson maps, USGS models) list authors **without** a
  license string — the same caution applies: attribution present, terms unverified, check
  upstream before any reuse.

### Practical rules for this repo

1. Reading Gaia Sky code (MPL 2.0) for algorithmic reference is fine; copying files
   verbatim would trigger MPL file-level obligations — avoid.
2. Never adapt the set111 black hole shader — CC-BY-NC-SA is incompatible with a
   portfolio that markets professional services.
3. Do not lift textures or dataset packs from Gaia Sky distribution; go to the upstream
   source (ESA/Gaia archive, NASA, USGS) and follow its terms, which is what PF-10 C3
   already does for GAIA DR3.
4. Site text/images are CC-BY-NC — summarize, don't copy.

## 8. Takeaways for PF-11 planning

- **Tiered catalogs with declared cuts** (parallax error, RUWE, fidelity) are the
  industry-standard way to scale star counts to hardware; our tier system (`?tier=lite`)
  could adopt a published-cut vocabulary rather than ad-hoc counts.
- **Declared visual license**: Gaia Sky openly documents magnitude boosts (+5/+10 mag) on
  faint populations. Matches our accurate/simplified/declared-license realism taxonomy.
- **Saturn rings as 1.5M physically-parameterized particles** is a proven pattern for our
  belt/ring ambitions at a comparable object count to our star catalog.
- **Bruneton-style unified atmospheric integrator** (3.7.4) is the current reference for
  planet atmospheres if we ever add one.
- **Per-planet-count glyphs resolving to real systems on approach** (exoplanet pack) is a
  neat LOD/interaction idea for portfolio-station discovery.
