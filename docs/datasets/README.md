# Gaia Sky dataset inventory — local mirror

**Date:** 2026-07-20
**Source:** [gaiasky.space/resources/datasets](https://gaiasky.space/resources/datasets/) (scraped 2026-07-20) cross-checked against the local `dataset.json`/data files in `resources/gaia_datasets/`.
**Scope:** only datasets already downloaded into `resources/gaia_datasets/` — the owner selected these from the ~141 datasets on the source page, skipping everything over ~0.5 GB. Nothing in this doc was fetched or converted into the site; it is a reference so the scrape and file audit never need repeating.
**Local dataset count:** 40 top-level packs, ~1.3 GB combined on disk.

Counts below are the **authoritative local values** (read from each pack's own `dataset.json` / data file), not the source webpage's copy — the webpage has at least two known errors, both flagged in the table: the NEA and Trojan asteroid packs share a copy-pasted description ("390 near-Earth asteroids", "154.79k objects") that belongs to neither; the true counts are 393 and 1,545 respectively.

Every local pack ships raw Gaia Sky JSON/VOTable/binary — **none of this is in a format the site's build pipeline (`data/build/0*.js`, not tracked in this repo — see [the gap analysis](../analysis/2026-07-20-gaia-dataset-gap-analysis.md)) can ingest without a conversion step.**

## Data packs

| Folder            | Name                     | Records | Format                                 | Disk size | Description                                                                                                                                                                                       |
| ----------------- | ------------------------ | ------: | -------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `default-data`    | Base Data Pack           |   9,914 | JSON (many files) + GeoJSON            |    111 MB | Required Gaia Sky core pack: solar system planets/moons, 4 minor planets (Vesta, Ceres, Pallas, Hygieia — real orbital elements), satellites, orbits, constellations, Milky Way, grids, locations |
| `hi-res-textures` | High Resolution Textures |      76 | JPG/PNG (glob-referenced, no manifest) |    272 MB | 4K/8K planet & asteroid surface textures and cubemaps                                                                                                                                             |

## Star catalogs — classical

| Folder              | Name                                   | Records | Format                                         | Disk size | Description                                                                                                                                            |
| ------------------- | -------------------------------------- | ------: | ---------------------------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog-hipparcos` | Hipparcos (New Reduction)              | 117,955 | JSON + raw `.bin`                              |   11.7 MB | van Leeuwen 2007 reduction, curated star names. **Same source already decoded into the site's 168,959-star background field** (`assets/stars-hip.png`) |
| `catalog-cns5`      | Fifth Catalogue of Nearby Stars (CNS5) |   5,931 | JSON + raw `.vot` (TABLEDATA — see note below) |    3.1 MB | Volume-complete sample within ~25 pc, from Gaia EDR3 + Hipparcos + Spitzer/ground surveys                                                              |

## Star catalogs — Gaia-derived

| Folder                     | Name                |   Records | Format                                  | Disk size | Description                                                                 |
| -------------------------- | ------------------- | --------: | --------------------------------------- | --------: | --------------------------------------------------------------------------- |
| `catalog-gaia-dr3-tiny`    | Gaia DR3 Tiny       | 2,552,302 | Octree (`particles/` + `metadata.bin`)  |    207 MB | Best bright/faint-parallax-error subset of Gaia DR3 + all Hipparcos stars   |
| `catalog-whitedwarfs-edr3` | eDR3 White Dwarfs   |   359,073 | JSON                                    |   32.7 MB | Gentile Fusillo et al. 2021 high-confidence white dwarf candidates (P>0.75) |
| `catalog-gd1`              | GD-1 Stellar Stream |     1,365 | raw `.vot` (TABLEDATA — see note below) |    369 KB | One of the longest, coldest known tidal stellar streams in the Milky Way    |

**Note (added 2026-07-20, PF-10 TR-065):** not every local `.vot` pack uses the same VOTable
serialization. MWSC, Hunt-Reffert 2023, and NBG ship VOTable 1.3 **BINARY2** (base64 `<STREAM>`);
CNS5 and GD-1 ship plain-text VOTable **TABLEDATA** (`<TR><TD>value</TD>...</TR>` rows) — a real
format difference discovered decoding the actual files, not an assumption from their file
extension. `scripts/lib/votable-binary2.mjs` reads the former, `scripts/lib/votable-tabledata.mjs`
the latter.

## Galaxy catalogs

| Folder            | Name       |   Records | Format                      | Disk size | Description                                                                         |
| ----------------- | ---------- | --------: | --------------------------- | --------: | ----------------------------------------------------------------------------------- |
| `catalog-nbg`     | NEARGALCAT |       856 | JSON + raw `.vot` (BINARY2) |    5.1 MB | All-sky catalog of nearby galaxies with individual distance estimates within 11 Mpc |
| `catalog-sdss-12` | SDSS DR12  |   327,835 | JSON + `.bin`               |   14.5 MB | Sloan Digital Sky Survey DR12 high-redshift galaxies                                |
| `catalog-sdss-14` | SDSS DR14  | 3,040,257 | JSON + `.bin`               |    112 MB | SDSS DR14 high-redshift galaxies                                                    |
| `catalog-sdss-17` | SDSS DR17  | 2,812,409 | JSON + `.bin`               |    101 MB | SDSS DR17 high-redshift galaxies, comoving distances                                |
| `catalog-sdss-18` | SDSS DR18  | 3,637,836 | JSON + `.bin`               |    131 MB | SDSS DR18 high-redshift galaxies, comoving distances                                |

**Note:** the four SDSS packs are successive data releases of the same survey — largely overlapping sky coverage, not four independent catalogs. Treat as "pick one," not "sum four."

## Cluster catalogs

| Folder                               | Name                                   | Records | Format                        | Disk size | Description                                                                                                                                                                                                 |
| ------------------------------------ | -------------------------------------- | ------: | ----------------------------- | --------: | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog-clusters-hunt-reffert-2023` | DR3 Open Clusters (Hunt, Reffert 2023) |   7,167 | JSON (particles) + raw `.vot` |    1.5 MB | Blind all-sky open-cluster search over 729M Gaia DR3 sources to G≈20. _(Site description text says "2,700 clusters" — stale; the shipped `dataset.json` `nobjects` and particle file both agree on 7,167.)_ |
| `catalog-ocdr2`                      | Open Clusters DR2 Catalog              |   2,017 | JSON + raw `.csv`/`.vot`      |    358 KB | Castro-Ginard et al. open clusters from Gaia DR2                                                                                                                                                            |
| `catalog-mwsc`                       | MWSC                                   |   3,006 | JSON + raw `.vot`             |    389 KB | Milky Way Star Clusters — Kharchenko et al. 2013 global survey                                                                                                                                              |

## Asteroids & solar system objects

| Folder                         | Name                                  |                                                                        Records | Format                              | Disk size | Description                                                              |
| ------------------------------ | ------------------------------------- | -----------------------------------------------------------------------------: | ----------------------------------- | --------: | ------------------------------------------------------------------------ |
| `catalog-asteroids-dr3`        | Asteroids and SSO (Gaia DR3)          |                                                                        154,787 | JSON (astrometry + orbits + bodies) |   81.7 MB | Full Gaia DR3 minor-planet/SSO astrometric catalog with orbital elements |
| `catalog-asteroids-dr3-nea`    | NEA Asteroids (Gaia DR3, coloured)    | **393** (`dataset.json` states 394; source page wrongly repeats DR3's 154.79k) | JSON                                |    323 KB | Near-Earth asteroids subset of the DR3 catalog                           |
| `catalog-asteroids-dr3-trojan` | Trojan Asteroids (Gaia DR3, coloured) |                                                                          1,545 | JSON                                |    1.5 MB | Jupiter Trojan asteroids subset of the DR3 catalog                       |
| `oort-cloud`                   | Oort Cloud                            |                                                                         10,000 | JSON + raw `.dat`                   |    567 KB | Simulated ice-particle Oort cloud                                        |

## Nebulae

| Folder                 | Name                             | Records | Format                         | Disk size | Description                                                                                                                                                                                      |
| ---------------------- | -------------------------------- | ------: | ------------------------------ | --------: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `catalog-nebulae`      | NGC2000 Nebulae                  |      47 | JSON + GLSL shaders + textures |    3.6 MB | Best-known bright emission/reflection/planetary nebulae from NGC2000; some rendered as volumes, some as 3D decals — ships its own per-nebula GLSL (`crab-nebula.glsl`, `ring-nebula.glsl`, etc.) |
| `mesh-dust-dr3`        | Dust Iso-Density Maps (Gaia DR3) |       1 | JSON + mesh                    |    8.1 MB | 30% dust-density isosurface, DR3-derived (Vergely inversion)                                                                                                                                     |
| `mesh-hii-dr3`         | HII Regions Map (Gaia DR3)       |       1 | JSON + mesh                    |   51.7 MB | Ionized-gas cloud isosurface, DR3-derived                                                                                                                                                        |
| `mesh-stardensity-dr3` | Star Density Map (Gaia DR3)      |       1 | JSON + mesh                    |   89.9 MB | 35% hot-star density isosurface, DR3-derived                                                                                                                                                     |

## Exoplanets & multi-star systems

| Folder                     | Name                   | Records | Format                        | Disk size | Description                                                                                                                          |
| -------------------------- | ---------------------- | ------: | ----------------------------- | --------: | ------------------------------------------------------------------------------------------------------------------------------------ |
| `nasa-exoplanet-archive`   | NASA Exoplanet Archive |   9,793 | JSON + per-system descriptors |   20.4 MB | Full NASA Exoplanet Archive composite planet/star tables                                                                             |
| `system-dr3-gl876`         | Gl876 System           |       2 | JSON                          |    5.2 KB | M-dwarf + gas-giant, one of the earliest RV planet discoveries — reflex motion seen by Gaia                                          |
| `system-dr3-hd40503`       | HD40503 System         |       2 | JSON                          |    5.3 KB | K dwarf + ~5 M_Jup candidate giant planet, Gaia astrometry, ~850 day period                                                          |
| `system-dr3-hd81040`       | HD81040 System         |       2 | JSON                          |    5.2 KB | G star + super-Jupiter, Gaia astrometric orbit, ~1000 day period                                                                     |
| `system-dr3-hd114762`      | HD114762 System        |       2 | JSON                          |    4.5 KB | First substellar companion candidate around a solar-type star (1989); Gaia shows near-face-on orbit, companion is a low-mass M dwarf |
| `system-dr3-j0805-4812`    | J0805+4812 System      |       2 | JSON                          |    4.5 KB | Binary brown dwarfs (L4 + T5), Gaia orbit refers to system photocentre                                                               |
| `system-dr3-ucac2-1151977` | UCAC2 1151977 System   |       2 | JSON                          |    4.1 KB | Sirius-like binary — main-sequence primary + hot white dwarf companion                                                               |
| `system-dr3-wd0141-675`    | WD0141-675 System      |       2 | JSON                          |    4.9 KB | Candidate ~9 M_Jup giant exoplanet around a nearby white dwarf, ~33 day period                                                       |
| `system-gaia-bhs`          | Gaia DR3 Black Holes   |       6 | JSON ×3 + orbit `.dat`        |    394 KB | BH1, BH2, BH3 — Gaia's three dormant-black-hole discoveries through DR3                                                              |
| `gargantua-blackhole`      | Gargantua Black Hole   |       1 | JSON                          |    3.1 KB | Fictional (_Interstellar_) black hole, shader-driven                                                                                 |

## Spacecraft & satellites

| Folder                | Name                        | Records | Format                                | Disk size | Description                                                                         |
| --------------------- | --------------------------- | ------: | ------------------------------------- | --------: | ----------------------------------------------------------------------------------- |
| `spacecraft-euclid`   | ESA Euclid                  |       1 | JSON + `.obj` model + orbit `.dat.gz` |   38.7 MB | ESA dark-matter/dark-energy mapping mission, with orbit and 3D model                |
| `spacecraft-jwst`     | James Webb Space Telescope  |       1 | JSON + `.obj` model + orbit `.dat`    |    3.6 MB | NASA/ESA infrared observatory, launched 2021-12-25                                  |
| `spacecraft-hst`      | Hubble Space Telescope      |       1 | JSON + `.glb`                         |    9.7 MB | NASA/ESA observatory, launched 1990-04-24, low Earth orbit                          |
| `spacecraft-iss`      | International Space Station |       1 | JSON + `.glb`                         |   38.6 MB | Multinational modular station, low Earth orbit                                      |
| `spacecraft-voyagers` | Voyager 1 and 2             |       2 | JSON + `.glb` + orbit `.dat.gz` ×2    |    3.6 MB | Both Voyager probes — furthest human-made objects from Earth                        |
| `catalog-gps`         | GPS Satellite Network       |      31 | JSON + 3D models                      |   3.78 MB | GPS constellation — **orbits pulled live from Celestrak TLE feed**, not static data |

## Planetary surface data (virtual textures)

| Folder                    | Name                                     | Records | Format                   | Disk size | Description                                                        |
| ------------------------- | ---------------------------------------- | ------: | ------------------------ | --------: | ------------------------------------------------------------------ |
| `vt-mars-topography-mola` | 64K Mars Elevation VT (MOLA/USGS)        |       1 | JSON + tiled JPG pyramid |     98 MB | Mars elevation, USGS Mars Orbiter Laser Altimeter, 6 global levels |
| `vt-moon-topography-nasa` | 32K Moon Topography (NASA SVS, LRO:LOLA) |       1 | JSON + tiled JPG pyramid |   48.3 MB | Moon elevation, NASA SVS gridded DEM                               |

---

## Known discrepancies (source webpage vs. local files)

| Dataset                              | Source webpage says                                                      | Local `dataset.json` / data file says                                  | Verdict                                                                                                                                                                                                                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------ | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog-asteroids-dr3-nea`          | "Some 390 near Earth asteroids… 154.79k objects"                         | `nobjects: 394`; 393 records counted in `asteroids-dr3-nea.json`       | Webpage copy-pasted the parent DR3 pack's blurb. Use **393**.                                                                                                                                                                                                                                                   |
| `catalog-asteroids-dr3-trojan`       | "Some 390 near Earth asteroids… 154.79k objects" (identical text to NEA) | `nobjects: 1545`; 1,545 records counted in `asteroids-dr3-trojan.json` | Same copy-paste bug. Use **1,545**.                                                                                                                                                                                                                                                                             |
| `catalog-clusters-hunt-reffert-2023` | "It contains 2700 open clusters"                                         | `nobjects: 7167`, particle file agrees                                 | Webpage prose is stale (2,700 was likely an earlier catalog version). Use **7,167**.                                                                                                                                                                                                                            |
| `catalog-nbg`                        | "869 nearby galaxies"                                                    | `nobjects: 875`                                                        | **SUPERSEDED 2026-07-20 (PF-10 TR-065):** neither number matches. The real `.vot` file's `<TABLE nrows>` — and the actual row count a real decode of the file produces (`scripts/gaia-bulk-catalog-convert.mjs`) — is **856**. Use **856**, sourced from decoding the actual file rather than any stated count. |

## Not present locally (explicitly skipped per owner's >0.5 GB cutoff)

For context, the source page lists 141 datasets total; the owner pulled 40. Notable omissions relevant to future gap analyses: the full-size Gaia DR3 LOD catalogs (Default 1.0 GB through Bayesian Distances 86.9 GB), Gaia DR3 Best/Weeny and the GCNS nearby-star catalog (all under 0.5 GB but not pulled — available if wanted later), DR2-era white dwarf/variable-star/mesh catalogs (DR3 equivalents were pulled instead), Saturn Rings (77.4 MB, 1.5M particles — small enough to reconsider), Volumetric Aurora (47 KB), the fictional Exonia system, Earth/Mars/Moon _diffuse_ virtual textures (1.2–3.4 GB each, correctly skipped), and 8K Moon topography (smaller alternative to the 32K pack already pulled).

## How this doc was built

1. Scraped `https://gaiasky.space/resources/datasets/` for every dataset's name, slug, type, description, size, and object count.
2. Matched each of the 40 local folders in `resources/gaia_datasets/` to its webpage entry by slug.
3. Re-verified every count against the local `dataset.json` (and, where that looked suspicious, the actual data file) — see discrepancies above.

Re-run this process only if new datasets are added to `resources/gaia_datasets/`; otherwise this file is the record.
