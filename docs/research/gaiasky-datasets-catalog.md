# Gaia Sky Dataset Catalog — In-Depth Reference

**Fetched:** 2026-07-22
**Purpose:** authoritative reference for accuracy/texture work (PF-11 planning). Documents
every dataset family in the Gaia Sky repository, cross-referenced against what is already
mirrored locally in `resources/gaia_datasets/`.

**Sources (fetched on the date above):**

- https://gaiasky.space/resources/ (navigation hub; links to the datasets listing)
- https://gaiasky.space/resources/datasets/ (the generated full listing; sections and per-pack rows)
- https://gaia.ari.uni-heidelberg.de/gaiasky/repository/ (the actual data repository; per-pack version directories)
- https://gaia.ari.uni-heidelberg.de/gaiasky/repository/catalog/dr3/011-tiny/v03_20240423/index.html (example per-pack page)
- https://gaia.ari.uni-heidelberg.de/gaiasky/repository/tex/v015_20260109/index.html (hi-res texture pack page)
- https://gaia.ari.uni-heidelberg.de/gaiasky/repository/basedata/ (base pack version history)
- https://gaia.ari.uni-heidelberg.de/gaiasky/docs/master/Datasets.html and `FAQ.html` (docs mirror; `docs.gaiasky.space` refused connections on the fetch date, same as noted in `gaiasky-space-site.md`)
- https://www.cosmos.esa.int/web/gaia-users/license (ESA Gaia data license page)
- Local: `resources/gaia_datasets/*/dataset.json` descriptors and directory trees (read 2026-07-22)

Sibling doc: `docs/research/gaiasky-space-site.md` (same fetch date) covers the site,
release history, and per-asset licensing from `ACKNOWLEDGEMENTS.md`. This doc goes deep on
the dataset catalog only. All prose below is my own summary; short quotes are attributed.
`https://gaiasky.space/resources/repository/` returns 404 — the listing lives at
`/resources/datasets/`, the bytes live on the Heidelberg server.

---

## 1. How the repository is organized

- **Listing page** (`gaiasky.space/resources/datasets/`): a generated table of every pack —
  name, key, type, description, object count, size, version. Fourteen sections, in page
  order: data packs, texture packs, Gaia star catalogs, level-of-detail catalogs, star
  catalogs, galaxy catalogs, cluster catalogs, other catalogs, asteroids/SSO, exoplanets and
  extrasolar systems, 3D iso-density meshes, missions/spacecraft/satellites, virtual
  textures, volumetric objects and effects.
- **Download server** (`gaia.ari.uni-heidelberg.de/gaiasky/repository/`): plain directory
  listing with 11 top-level dirs — `basedata/`, `catalog/`, `clusters/`, `extra/`,
  `galaxies/`, `meshes/`, `nebulae/`, `sphericalmirror/`, `systems/`, `tex/`, `volumes/`,
  `vt/`. Each pack lives under a versioned directory named `vNN_YYYYMMDD` (e.g.
  `catalog/dr3/011-tiny/v03_20240423/`) containing exactly four files: the
  `<key>.tar.gz` payload, `dataset.json` (metadata), `md5`, and `sha256`. No license text
  is published per pack on the server.
- **`dataset.json` descriptor** (also shipped inside every extracted pack): `key`, `name`,
  `version` (integer), `type`, `size` (bytes, **uncompressed**), `releasenotes`, optional
  `link`, `creator`, `credits[]`, `description`. This is the ground truth for a pack.
- **Size semantics — important.** The listing page's "size" column is the **compressed
  download** (tar.gz), not the extracted size. Verified on `gaia-dr3-tiny`: listing says
  170.5 MiB, the tar.gz is 171 MB, the descriptor's `size` is 206,947,413 bytes (~197 MiB),
  and the extracted directory on our disk is 198 MB.
- Old versions stay on the server (base pack history runs from `000_20180829` to
  `v064_20260716`), so a pinned URL keeps working — useful for reproducibility.

### Known listing-page errors (observed on fetch date)

1. **NEA row is wrong on the site.** The listing shows `catalog-asteroids-dr3-nea` with
   154.79k objects / 15.3 MiB — a copy of the parent DR3 asteroid row. The pack's own
   descriptor says "Some 390 near Earth asteroids", 323,354 bytes. Trust the descriptor.
2. **"0.0B" sizes are a rendering artifact.** Base data pack and most spacecraft packs show
   0.0B on the listing; the real descriptors say e.g. base pack ≈ 111 MB, Euclid ≈ 38.7 MB
   uncompressed.
3. NEARGALCAT shows 875 objects while its own description says 869 galaxies (the delta is
   auxiliary entries).

---

## 2. Full catalog by family

Columns: object count and size as published on the listing (size = compressed download);
**Local** = present in `resources/gaia_datasets/` with the version we hold.

### 2.1 Data pack (required)

| Name           | Key            | Objects | Size             | Repo ver                                     | Local                              |
| -------------- | -------------- | ------- | ---------------- | -------------------------------------------- | ---------------------------------- |
| Base data pack | `default-data` | n/a     | ~111 MB unpacked | v63 listed; `v064_20260716` exists on server | **YES, v60** (3–4 versions behind) |

The mandatory pack: solar system planets/moons/minor bodies with orbits, satellites,
constellations + boundaries, the Milky Way model, location markers (Earth cities/countries,
Moon/Mars mission sites), Gaia attitude XMLs, VSOP87 ephemerides, and the low/medium
resolution texture tree (`tex/base`, `tex/cubemap`, `tex/skybox` — see §3). Per the docs
FAQ: "You can't run Gaia Sky without the base data package." The v60→v63 release notes on
the listing mention updated Milky Way datasets/parameters for the new renderer, separate
half-/full-resolution Milky Way objects, updated galaxy textures, robotic-Mars-landing
locations, updated atmospheric scattering parameters, and new Earth night cubemaps —
relevant if we ever re-scrape their Milky Way treatment.

### 2.2 Texture packs

| Name                     | Key               | Objects | Size      | Repo ver                  | Local                  |
| ------------------------ | ----------------- | ------- | --------- | ------------------------- | ---------------------- |
| High resolution textures | `hi-res-textures` | 76      | 248.1 MiB | v15 (`tex/v015_20260109`) | **YES, v15 (current)** |

4K/8K planetary-surface and asteroid textures plus high/ultra cubemaps and skyboxes. The
pack is an **overlay**: its internal tree mirrors `default-data/tex/...`, so extraction
drops hi-res files alongside the base ones (`-high`/`-ultra` suffixes: e.g.
`mars-ultra.jpg`, `earth-height-ultra.jpg`, `europa-normal-ultra.jpg`, normal/specular/
height maps per body). Local copy holds 76 base-tex files plus `cubemap/earth-*-{high,ultra}`
and `skybox/{milkyway-high,milkyway-ultra,cmwb-planck-high}`.

### 2.3 Gaia star catalogs (`catalog-gaia` — whole-catalog, loaded fully into RAM)

| Name                                  | Key                         | Objects | Size      | Ver | Local                                               |
| ------------------------------------- | --------------------------- | ------- | --------- | --- | --------------------------------------------------- |
| Gaia DR3 best                         | `gaia-dr3-best`             | 646.4k  | 43.9 MiB  | v1  | no                                                  |
| Gaia DR3 tiny                         | `gaia-dr3-tiny`             | 2.55M   | 170.5 MiB | v3  | **YES, v3 (current)** — dir `catalog-gaia-dr3-tiny` |
| Gaia DR3 weeny                        | `gaia-dr3-weeny`            | 1.94M   | 129.7 MiB | v3  | no                                                  |
| Gaia Catalogue of Nearby Stars (GCNS) | `catalog-gcns`              | 331.08k | 138.4 MiB | v3  | no                                                  |
| DR2 white dwarfs                      | `catalog-whitedwarfs-dr2`   | 256.08k | 31.2 MiB  | v3  | no                                                  |
| eDR3 white dwarfs                     | `catalog-whitedwarfs-edr3`  | 359.07k | 31.2 MiB  | v1  | **YES, v1 (current)**                               |
| DR2 Cepheids + RR Lyrae               | `catalog-variablestars-dr2` | 106.34k | 59.3 MiB  | v3  | no                                                  |
| DR3 Cepheids + RR Lyrae               | `catalog-variablestars-dr3` | 186.93k | 148.8 MiB | v1  | no                                                  |
| GD-1 stellar stream                   | `catalog-gd1`               | 1.36k   | 109.8 KiB | v2  | **YES, v2 (current)**                               |

Selection cuts are declared per pack: _best_ keeps only minimal-parallax-relative-error
stars; _tiny_ = "all stars with up to 1%/0.01% bright/faint parallax relative error, and
all Hipparcos stars" (descriptor); GCNS is the published Gaia EDR3 100 pc sample; the eDR3
white dwarf pack is Gentile Fusillo et al. 2021 with Pwd > 0.75 (arXiv:2106.07669); the
variable-star and GD-1 packs apply **declared magnitude boosts** so faint populations stay
visible — the "declared license" pattern our Astra taxonomy uses.

**Exact `gaia-dr3-tiny` provenance (from the shipped catgen `log`, 2024-04-23):** input DR3
CSV + Hipparcos van Leeuwen CSV + HIP–Gaia crossmatch (99,525 records); parameters
`max_part: 2,200,000`, `plx_err_bright: 0.01`, `plx_err_faint: 0.0001`, `ruwe_cap: NaN`
(none), `distpc_cap: 100,000`, `plx_zeropoint: 0.0`, `mag_corrections: 2` (extinction +
reddening applied), `allow_negative_plx: false`, octree `child_count: 100` /
`parent_count: 1000`; per-star columns
`sourceid, ra, dec, pllx, ra_err, dec_err, pllx_err, pmra, pmdec, radvel, gmag, bpmag,
rpmag, ruwe, ref_epoch, radvel_err, dist_phot, teff`; parallax zero-point and A_G/E
corrections come from auxiliary files. All 117,955 Hipparcos stars are force-included.

### 2.4 Level-of-detail catalogs (`catalog-lod` — octree-streamed from disk)

| Name                                             | Key                   | Objects | Size       | Ver | Local |
| ------------------------------------------------ | --------------------- | ------- | ---------- | --- | ----- |
| Gaia DR3 default                                 | `gaia-dr3-default`    | 15.13M  | 1010.2 MiB | v3  | no    |
| Gaia DR3 small                                   | `gaia-dr3-small`      | 8.2M    | 534.1 MiB  | v2  | no    |
| Gaia DR3 medium                                  | `gaia-dr3-medium`     | 49.94M  | 3.1 GiB    | v2  | no    |
| Gaia DR3 large                                   | `gaia-dr3-large`      | 122.18M | 7.4 GiB    | v2  | no    |
| Gaia DR3 very large                              | `gaia-dr3-verylarge`  | 466.14M | 27.9 GiB   | v2  | no    |
| Gaia DR3 extra large                             | `gaia-dr3-extralarge` | 707.16M | 42.1 GiB   | v2  | no    |
| Gaia DR3 bright                                  | `gaia-dr3-bright`     | 11.27M  | 731.0 MiB  | v2  | no    |
| Gaia DR3 RUWE                                    | `gaia-dr3-ruwe`       | 957.75M | 57.1 GiB   | v2  | no    |
| Gaia DR3 Bayesian distances (Bailer-Jones)       | `gaia-dr3-geodist`    | 1.47B   | 86.9 GiB   | v2  | no    |
| Gaia DR3 fidelity                                | `gaia-dr3-fidelity`   | 393.68M | 23.5 GiB   | v2  | no    |
| Gaia DR3 photometric distances (GSP-Phot Aeneas) | `gaia-dr3-photdist`   | 470.81M | 28.1 GiB   | v2  | no    |

The tiers are nested subsets of the same data — the FAQ is explicit that "**Only one**
should be used at a time, as they are different subsets of the same data." Cuts are
published per tier (parallax error for the size ladder; RUWE ≤ 1.4; Bailer-Jones geometric
distances; astrometric fidelity; GSP-Phot photometric distances). This is the
industry-standard "declared-cut ladder" for scaling star counts to hardware — the
vocabulary our `?tier=` system could adopt. None are locally mirrored (1–87 GiB each; our
in-browser catalog is generated separately).

### 2.5 Non-Gaia star catalogs (`catalog-star`)

| Name                                       | Key                 | Objects | Size    | Ver | Local                 |
| ------------------------------------------ | ------------------- | ------- | ------- | --- | --------------------- |
| Fifth Catalogue of Nearby Stars (CNS5)     | `catalog-cns5`      | 5.93k   | 1.2 MiB | v3  | **YES, v3 (current)** |
| Hipparcos new reduction (van Leeuwen 2007) | `catalog-hipparcos` | 117.95k | 7.7 MiB | v6  | **YES, v6 (current)** |

CNS5 is the volume-complete solar-neighbourhood sample (Gaia EDR3 + Hipparcos + infrared
surveys, complete to L8 spectral type within 25 pc); Hipparcos ships "curated star names".

### 2.6 Galaxy catalogs (`catalog-gal`)

| Name                                                    | Key               | Objects | Size     | Ver | Local                   |
| ------------------------------------------------------- | ----------------- | ------- | -------- | --- | ----------------------- |
| NEARGALCAT (Karachentsev updated Nearby Galaxy Catalog) | `catalog-nbg`     | 875     | 4.6 MiB  | v17 | **YES, v16 (1 behind)** |
| SDSS DR12                                               | `catalog-sdss-12` | 327.83k | 10.9 MiB | v8  | **YES, v8 (current)**   |
| SDSS DR14                                               | `catalog-sdss-14` | 3.04M   | 79.0 MiB | v8  | **YES, v8 (current)**   |
| SDSS DR17                                               | `catalog-sdss-17` | 2.81M   | 69.9 MiB | v5  | **YES, v5 (current)**   |
| SDSS DR18                                               | `catalog-sdss-18` | 3.64M   | 98.3 MiB | v2  | **YES, v2 (current)**   |

NEARGALCAT: 869 galaxies within ~11 Mpc (or V_LG < 600 km/s), with per-galaxy observables,
rendered with real thumbnail textures (`tex/extragal/M31.jpg`, `LMC.jpg`, …). The SDSS
packs are high-redshift galaxy positions with comoving distances, stored in Gaia Sky's
binary particle format plus a small set of billboard sprite textures (`tex/galaxy-NN.png`).
DR17/DR18 descriptors note the move "to binary format, which loads much faster and weighs
less". The four SDSS packs are cumulative releases, not disjoint sets.

### 2.7 Cluster catalogs (`catalog-cluster`)

| Name                                     | Key                                  | Objects | Size      | Ver | Local                 |
| ---------------------------------------- | ------------------------------------ | ------- | --------- | --- | --------------------- |
| DR3 open clusters, Hunt & Reffert 2023   | `catalog-clusters-hunt-reffert-2023` | 7.17k   | 991.7 KiB | v2  | **YES, v2 (current)** |
| Open clusters DR2 (Castro-Ginard et al.) | `catalog-ocdr2`                      | 2.02k   | 140.5 KiB | v7  | **YES, v7 (current)** |
| MWSC (Kharchenko et al. 2013)            | `catalog-mwsc`                       | 3.01k   | 150.6 KiB | v7  | **YES, v7 (current)** |

Hunt–Reffert: 2,700 open clusters from a blind all-sky DR3 search of 729M sources to G≈20
(arXiv:2303.13424; the 7.17k object count includes member/label entries beyond the 2,700
clusters). Clusters render as wireframe spheres positioned by position + radius.

### 2.8 Other catalogs (`catalog-other`)

| Name                   | Key                   | Objects | Size      | Ver | Local                  |
| ---------------------- | --------------------- | ------- | --------- | --- | ---------------------- |
| NGC2000 nebulae        | `catalog-nebulae`     | 47      | 4.6 MiB   | v12 | **YES, v9 (3 behind)** |
| Gargantua black hole   | `gargantua-blackhole` | 1       | 3.1 KiB   | v5  | **YES, v5 (current)**  |
| Oort cloud (simulated) | `oort-cloud`          | 10k     | 430.8 KiB | v4  | **YES, v3 (1 behind)** |

The nebulae pack is the 47 best-known Milky Way nebulae, some as **ray-marched GLSL volume
shaders** (per-nebula `.glsl` files: crab, helix, ring, cats-eye, trifid, butterfly,
hourglass, box + a shared `lib/nebulae-lib.glsl`), the rest as textured 3D decals
(`tex/nebulae/*.jpg`). The v9→v12 release notes mention volume-shader raymarching-step
improvements. Gargantua is the _Interstellar_-style shader (see licensing — the underlying
shadertoy is CC-BY-NC-SA; never port). Oort cloud is explicitly a simulation, 10k particles.

### 2.9 Asteroids / solar-system objects (`catalog-sso`)

| Name                            | Key                            | Objects                              | Size      | Ver | Local                 |
| ------------------------------- | ------------------------------ | ------------------------------------ | --------- | --- | --------------------- |
| Asteroids/SSO, Gaia FPR         | `catalog-asteroids-fpr`        | 156.59k                              | 12.8 MiB  | v4  | no                    |
| Asteroids/SSO, Gaia DR3         | `catalog-asteroids-dr3`        | 154.79k                              | 15.3 MiB  | v2  | **YES, v2 (current)** |
| NEA asteroids, DR3, coloured    | `catalog-asteroids-dr3-nea`    | ~390 (listing wrongly shows 154.79k) | 323 KB    | v1  | **YES, v1 (current)** |
| Trojan asteroids, DR3, coloured | `catalog-asteroids-dr3-trojan` | 1.54k                                | 161.1 KiB | v1  | **YES, v1 (current)** |
| Asteroids/SSO, Gaia DR2         | `catalog-asteroids-dr2`        | 14.1k                                | 908.5 KiB | v2  | no                    |

Format (verified locally on the DR3 pack): JSON descriptors (`asteroids-dr3.json`,
`bodies-asteroids-dr3.json`, `orbits-asteroids-dr3.json`) carrying orbital elements per
body, plus real shape models for visited asteroids (Lutetia, Šteins as OBJ+MTL). The NEA
and Trojan packs are coloured highlight subsets with shortened orbit trails and proper
per-asteroid epochs (`argofpericenter` fix noted in release notes). The FPR pack
(Focused Product Release, 156.59k objects, v4, updated 2026-03-31) supersedes DR3 count-wise
and is **not** yet mirrored locally — worth grabbing if the belt work revisits source data
(our PF-10 C3 belt uses the DR3 catalog).

### 2.10 Exoplanets and extrasolar systems (`system`)

| Name                               | Key                        | Objects | Size      | Ver | Local                  |
| ---------------------------------- | -------------------------- | ------- | --------- | --- | ---------------------- |
| NASA Exoplanet Archive             | `nasa-exoplanet-archive`   | 9.79k   | 2.9 MiB   | v2  | **YES, v1 (1 behind)** |
| Exonia (procedural)                | `system-exonia`            | 7       | 2.4 MiB   | v4  | no                     |
| Gl876                              | `system-dr3-gl876`         | 2       | 1.5 KiB   | v1  | **YES, v1**            |
| HD40503                            | `system-dr3-hd40503`       | 2       | 1.5 KiB   | v1  | **YES, v1**            |
| HD81040                            | `system-dr3-hd81040`       | 2       | 1.5 KiB   | v1  | **YES, v1**            |
| HD114762                           | `system-dr3-hd114762`      | 2       | 1.3 KiB   | v1  | **YES, v1**            |
| J0805+4812                         | `system-dr3-j0805-4812`    | 2       | 1.2 KiB   | v1  | **YES, v1**            |
| UCAC2 1151977                      | `system-dr3-ucac2-1151977` | 2       | 1.2 KiB   | v1  | **YES, v1**            |
| WD0141-675                         | `system-dr3-wd0141-675`    | 2       | 1.5 KiB   | v2  | **YES, v2**            |
| Gaia DR3 black holes (BH1/BH2/BH3) | `system-gaia-bhs`          | 6       | 145.0 KiB | v2  | **YES, v2**            |

The archive pack renders systems as count-coded glyphs and lazy-loads a per-system
descriptor JSON on approach ("gets loaded on-demand when approaching it" — a pattern worth
noting for our own POI streaming). The seven `system-dr3-*` micro-packs are Gaia DR3
astrometric-orbit showcases (each ~1.5 KB: star + companion + orbit). The BH pack includes
Gaia BH1 (9.62 M☉, P = 185.6 d), BH2 (~2.89 M☉ companion, P = 1277 d), BH3 (33 M☉ at
~590 pc).

### 2.11 3D iso-density meshes (`mesh`)

| Name                       | Key                    | Objects | Size     | Ver | Local                 |
| -------------------------- | ---------------------- | ------- | -------- | --- | --------------------- |
| Dust iso-density maps, DR2 | `mesh-dust-dr2`        | 2       | 2.7 MiB  | v4  | no                    |
| HII regions map, DR2       | `mesh-hii-dr2`         | n/a     | 2.4 MiB  | v4  | no                    |
| Star density map, DR2      | `mesh-stardensity-dr2` | 8       | 80.1 MiB | v3  | no                    |
| Dust iso-density maps, DR3 | `mesh-dust-dr3`        | 1       | 1.4 MiB  | v1  | **YES, v1 (current)** |
| HII regions map, DR3       | `mesh-hii-dr3`         | 1       | 8.9 MiB  | v1  | **YES, v1 (current)** |
| Star density map, DR3      | `mesh-stardensity-dr3` | 1       | 24.0 MiB | v1  | **YES, v1 (current)** |

All produced by Kevin Jardine (gruze.org). Format (verified locally): plain **OBJ + MTL
meshes** with a texture PNG, plus a loader JSON. Provenance is unusually well documented in
the descriptors: DR3 dust = 30% iso-surface from Vergely/Lallement/Cox 2022 extinction
cubes; DR3 HII = ionizing-star positions + Finkbeiner H-alpha map sizes + Bailer-Jones EDR3
distances; DR3 star density = 35% iso-surface of hot-star density, data from Ronald Drimmel
(Gaia Collaboration 2022 asymmetric-disc paper). Excellent candidates for a scientifically
grounded galactic-context layer.

### 2.12 Missions, spacecraft, satellites (`spacecraft`)

| Name                  | Key                   | Size              | Ver | Local                  |
| --------------------- | --------------------- | ----------------- | --- | ---------------------- |
| ESA Gaia mission      | `mission-gaia`        | n/s               | v1  | no                     |
| ESA Euclid            | `spacecraft-euclid`   | ~38.7 MB unpacked | v4  | **YES, v3 (1 behind)** |
| JWST                  | `spacecraft-jwst`     | ~3.6 MB unpacked  | v5  | **YES, v4 (1 behind)** |
| Hubble                | `spacecraft-hst`      | ~9.7 MB unpacked  | v3  | **YES, v2 (1 behind)** |
| ISS                   | `spacecraft-iss`      | ~38.6 MB unpacked | v3  | **YES, v2 (1 behind)** |
| Artemis I and II      | `mission-artemis`     | n/s               | v1  | no                     |
| Pioneer 10 and 11     | `mission-pioneer`     | n/s               | v1  | no                     |
| GPS satellite network | `catalog-gps`         | 999.9 KiB         | v2  | **YES, v1 (1 behind)** |
| Voyager 1 and 2       | `spacecraft-voyagers` | ~3.6 MB unpacked  | v3  | **YES, v2 (1 behind)** |

3D model + orbit per craft. The GPS pack is notable: orbits pulled live on demand from
Celestrak TLEs ("updated live"), credited to Trevor Kjorlien / Plateau Astro with a
cgtrader 3D model — check terms before any reuse of the model.

### 2.13 Virtual textures (`virtualtex-pack`)

| Name                                        | Key                             | Size      | Ver | Local                 |
| ------------------------------------------- | ------------------------------- | --------- | --- | --------------------- |
| Earth surface VT, Sentinel-2 + Blue Marble  | `vt-earth-diffuse-sentinel`     | 3.4 GiB   | v0  | no                    |
| 128K Earth surface VT, NASA                 | `vt-earth-diffuse-nasa`         | 1.3 GiB   | v0  | no                    |
| 128K Earth elevation VT, USGS GMTED2010     | `vt-earth-topography-gmted2010` | 645.9 MiB | v0  | no                    |
| 64K Earth cloud VT, NASA Blue Marble        | `vt-earth-clouds-nasa`          | 378.3 MiB | v0  | no                    |
| 64K Mars diffuse VT, Celestia/van Vliet     | `vt-mars-diffuse-vanvliet`      | 1.2 GiB   | v0  | no                    |
| 64K Mars elevation VT, MOLA/USGS            | `vt-mars-topography-mola`       | 67.7 MiB  | v0  | **YES, v0 (current)** |
| 64K Moon diffuse VT, Celestia/van Vliet     | `vt-moon-diffuse-vanvliet`      | 2.7 GiB   | v0  | no                    |
| 8K Moon topography VT, LRO WAC DTM          | `vt-moon-topography-lro`        | 8.4 MiB   | v0  | no                    |
| 32K Moon topography, NASA SVS, LRO/LOLA DEM | `vt-moon-topography-nasa`       | 41.1 MiB  | v1  | **YES, v1 (current)** |

Format (verified locally on the two mirrored packs): sparse-virtual-texture pyramids —
`tex/level0/ … levelN/` directories of `tx_<col>_<row>.jpg` tiles (level0 = 2×1 tiles,
doubling per level; MOLA has 6 global levels, the NASA Moon DEM 5 levels), plus a loader
JSON. The Sentinel-2 Earth pack goes "down to 10 m/px for 31 urban areas". Elevation packs
are height data encoded as tiles (MOLA from the 463 m/px USGS global DEM mosaic; Moon from
NASA SVS #4720, LOLA gridded products). Sources are USGS/NASA (public-domain-friendly),
except the two `vanvliet` diffuse packs which come from Celestia community textures —
check terms per-pack before reuse.

### 2.14 Volumetric objects and effects (`volume`)

| Name              | Key                 | Objects | Size     | Ver | Local |
| ----------------- | ------------------- | ------- | -------- | --- | ----- |
| Volumetric aurora | `volumetric-aurora` | 1       | 46.9 KiB | v2  | no    |
| Saturn rings      | `saturn-rings`      | 1.5M    | 77.4 MiB | v1  | no    |

The Saturn rings pack — 1.5M rock/dust particles — is a proven reference for
particle-count-comparable ring/belt rendering (our star catalog is the same order of
magnitude).

---

## 3. Milky Way skybox and Planck CMB — where they actually live

These are **not** standalone packs; they ship inside the texture trees (verified in the
local mirrors):

- `default-data/tex/skybox/milkyway-low/` and `milkyway-med/` — six-face cubemap
  (`mw_{bk,dn,ft,lf,rt,up}.jpg`) of the Milky Way panorama used as the sky background.
- `default-data/tex/skybox/gaiasky/` — a Gaia Sky-branded MW skybox variant
  (`gaiaskymw_*.jpg`).
- `default-data/tex/skybox/cmwb-planck-med/` — **Planck CMB six-face cubemap**
  (`planck_{bk,dn,ft,lf,rt,up}.jpg`); the base pack credits list "ESA/Planck/C. North" for
  it. Gaia Sky uses it as the ultimate-distance background layer.
- `hi-res-textures/default-data/tex/skybox/` adds `milkyway-high/`, `milkyway-ultra/`, and
  `cmwb-planck-high/`.

The base pack credits (from its descriptor) name the likely MW panorama/texture sources:
ESA/Gaia/DPAC, Stefan Payne-Wardenaar (the modern Milky Way artist impressions used by
ESA), Solar System Scope, Tom Patterson, USGS, NASA Visible Earth/Reto Stöckli. The
sibling doc's `ACKNOWLEDGEMENTS.md` findings add Nick Risinger's Milky Way panorama —
attribution present, license string absent; treat all of these as "verify upstream before
reuse" (see §6).

---

## 4. Format notes per family (from local inspection)

| Family                                | On-disk format                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog-gaia` (tiny/best/weeny, WDs) | Gaia Sky binary particle format: `catalog/<name>/metadata.bin` (octree node table; 236 bytes for tiny's 2-node tree) + `particles/particles_NNNNNN.bin` chunks (tiny: 2 chunks, 178 MB + 28 MB) + catgen `log` with full provenance. Same container as LOD packs, small enough to load whole. Some packs instead ship the source table: CNS5 = **VOTable** (`cns5.vot`), eDR3 WDs = **FITS** (`wd_edr3.fits`), Hipparcos = binary (`hipparcos.bin`), each with a `particles-*.json` loader descriptor. |
| `catalog-lod`                         | Same octree binary, chunked per node for on-demand streaming; only one loaded at a time.                                                                                                                                                                                                                                                                                                                                                                                                               |
| `catalog-gal`                         | Binary particle file (`sdss_dr12.bin`) or VOTable (NEARGALCAT `nbg.vot`) + loader JSON + billboard/thumbnail textures.                                                                                                                                                                                                                                                                                                                                                                                 |
| `catalog-cluster`                     | Small particle sets + loader JSON (position + radius → wireframe spheres).                                                                                                                                                                                                                                                                                                                                                                                                                             |
| `catalog-sso`                         | JSON orbital-element descriptors (bodies/orbits) + OBJ shape models for visited bodies.                                                                                                                                                                                                                                                                                                                                                                                                                |
| `system`                              | Tiny JSON descriptors per system; archive pack lazy-loads per-system JSON on approach.                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `mesh`                                | OBJ + MTL + PNG texture + loader JSON.                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| `virtualtex-pack`                     | SVT tile pyramid `tex/level{0..N}/tx_<col>_<row>.jpg`, level0 = 2×1.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| `texture-pack`                        | Overlay of the `default-data/tex` tree with `-high`/`-ultra` files.                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Nebulae                               | Loader JSONs + per-nebula ray-marched GLSL volume shaders + decal JPGs.                                                                                                                                                                                                                                                                                                                                                                                                                                |
| User-loadable formats (docs)          | CSV, VOTable (`.vot`), FITS via the STIL loader; loaded via UI (Ctrl+O), SAMP, or scripting.                                                                                                                                                                                                                                                                                                                                                                                                           |

Docs note four loadable dataset categories: star catalogs (full astrometry+photometry),
particle datasets (positions only), star cluster catalogs (position+radius), and variable
star catalogs (time-synced magnitudes).

---

## 5. Local inventory — `resources/gaia_datasets/`

**41 packs mirrored, ~1.5–1.6 GB on disk (du, 2026-07-22).** Every local pack carries its
`dataset.json`, so provenance is self-describing.

**Current (matches repo version):** hi-res-textures v15, gaia-dr3-tiny v3,
catalog-whitedwarfs-edr3 v1, catalog-gd1 v2, catalog-cns5 v3, catalog-hipparcos v6,
catalog-sdss-12 v8 / -14 v8 / -17 v5 / -18 v2, catalog-clusters-hunt-reffert-2023 v2,
catalog-ocdr2 v7, catalog-mwsc v7, catalog-asteroids-dr3 v2 / -nea v1 / -trojan v1,
gargantua-blackhole v5, mesh-dust-dr3 v1, mesh-hii-dr3 v1, mesh-stardensity-dr3 v1, all
seven `system-dr3-*` packs, system-gaia-bhs v2, vt-mars-topography-mola v0,
vt-moon-topography-nasa v1.

**Stale (repo has newer):**

| Pack                     | Local | Repo                                  | Notes                                                                                |
| ------------------------ | ----- | ------------------------------------- | ------------------------------------------------------------------------------------ |
| `default-data`           | v60   | v63 listed; `v064_20260716` on server | Milky Way renderer/texture updates in between — most relevant drift for texture work |
| `catalog-nbg`            | v16   | v17                                   | index regen for Gaia Sky 3.6.9+ (app-side, harmless for us)                          |
| `catalog-nebulae`        | v9    | v12                                   | volume-shader raymarching improvements                                               |
| `oort-cloud`             | v3    | v4                                    |                                                                                      |
| `nasa-exoplanet-archive` | v1    | v2                                    |                                                                                      |
| `catalog-gps`            | v1    | v2                                    |                                                                                      |
| `spacecraft-euclid`      | v3    | v4                                    |                                                                                      |
| `spacecraft-jwst`        | v4    | v5                                    |                                                                                      |
| `spacecraft-hst`         | v2    | v3                                    |                                                                                      |
| `spacecraft-iss`         | v2    | v3                                    |                                                                                      |
| `spacecraft-voyagers`    | v2    | v3                                    |                                                                                      |

**Not mirrored at all:** `gaia-dr3-best`, `gaia-dr3-weeny`, `catalog-gcns`,
`catalog-whitedwarfs-dr2`, `catalog-variablestars-dr2/-dr3`, all 11 LOD tiers,
`catalog-asteroids-fpr` (newer than our DR3 belt source), `catalog-asteroids-dr2`,
`system-exonia`, `mission-gaia`, `mission-artemis`, `mission-pioneer`, the three DR2
meshes, all four Earth VTs, `vt-mars-diffuse-vanvliet`, `vt-moon-diffuse-vanvliet`,
`vt-moon-topography-lro`, `volumetric-aurora`, `saturn-rings`.

---

## 6. Licensing

Per-pack license strings are **not** published on the listing page or the download server;
what exists is descriptor `credits`/`link` fields plus site-level statements. Summary
(details and per-asset findings in `docs/research/gaiasky-space-site.md` §7):

- **Gaia Sky's own datasets:** CC-BY per the site's licenses page. Third-party catalogs
  keep their upstream license.
- **Gaia data (DR2/eDR3/DR3/FPR):** ESA's Gaia Users license page
  (cosmos.esa.int/web/gaia-users/license, as fetched 2026-07-22) states Gaia data products
  are distributed under **CC BY-NC 3.0 IGO**, with commercial-use questions deferred to
  the ESA space-science-archive terms; standard credit line "ESA/Gaia/DPAC". Note: earlier
  ESA statements applied CC BY-SA 3.0 IGO to Gaia visual/media assets — the two coexist
  (data vs imagery). Verify against the ESA terms before any redistribution decision; our
  own DR3 usage already follows ESA/DPAC crediting (PF-10 C3).
- **SDSS:** upstream SDSS data-release terms (public with credit).
- **NASA / USGS sources** (Blue Marble, LOLA/SVS Moon DEM, MOLA DEM, GMTED2010): US
  government products, public-domain-friendly; per-derivative checks still required.
- **Celestia/van Vliet diffuse VTs, cgtrader GPS model, Solar System Scope textures, Nick
  Risinger panorama, Payne-Wardenaar artwork:** attribution present, license string absent
  in Gaia Sky's materials — check upstream before reuse.
- **Gargantua/black-hole shader (set111, Shadertoy): CC-BY-NC-SA — never port** into this
  repo (incompatible with a professional-services portfolio; also flagged in PF-10).
- **Planck CMB skybox:** credited "ESA/Planck/C. North"; ESA Planck imagery terms apply.
- Practical rule for this repo: read for reference, credit what we already use
  (ESA/Gaia/DPAC), and source any texture we ship from the upstream provider under its own
  terms — never lift files out of Gaia Sky packs.

---

## 7. Relevance to our accuracy/texture work

1. **Declared-cut catalog ladder** (§2.3–2.4) is the model for hardware-scaled star
   tiers: publish the cut (parallax error, RUWE, fidelity), not an ad-hoc count.
2. **The catgen log format** (§2.3) shows exactly what provenance metadata a generated
   catalog should carry — we should keep an equivalent log for our 168,959-object build.
3. **`catalog-asteroids-fpr`** is the newer, larger successor to the DR3 SSO pack our
   asteroid belt derives from; evaluate before the next belt data refresh.
4. **Kevin Jardine's DR3 meshes** (already mirrored) are ready-made, well-credited source
   material for a galactic dust/HII/density context layer.
5. **Skybox inventory** (§3): we hold MW low/med/high/ultra and Planck CMB med/high faces
   locally — but their underlying panorama licenses are unverified, so ship-quality
   backgrounds must be rebuilt from upstream sources (see
   `docs/research/texture-sources-public-domain.md`).
6. **SVT tile pyramid layout** (§2.13) is a clean reference if we ever stream planetary
   textures; the base+overlay texture-pack pattern maps directly onto our tier system.
7. **Lazy per-system JSON on approach** (§2.10) matches the POI-streaming direction for
   portfolio stations.
