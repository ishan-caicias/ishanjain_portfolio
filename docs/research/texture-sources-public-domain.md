# Public-domain & permissively-licensed texture/data sources for scene accuracy

**Date:** 2026-07-22
**Status:** Research reference — no assets fetched or integrated as part of this document.
**Method:** every license page below was fetched live on 2026-07-22 (URLs listed per source and
in [Sources consulted](#sources-consulted)). Quotes are verbatim from the fetched pages.
**Scope:** planetary/astronomical textures and catalogs that could raise the accuracy of the
space scene, vetted for (a) license compatibility with a personal, non-commercial portfolio,
(b) the repo's self-hosted, no-CDN CSP posture (ADR-0005 — every asset must be vendored into
`public/assets/`, so hotlink-only sources are useless and download-and-self-host rights are
mandatory), and (c) the owner's earlier rejection of CC-BY-NC-SA material (Gaia Sky's shadertoy
nebula ports — see TR-072, ADR-0004, PF-10 plan).

**Risk vocabulary used below:**

- **CLEAN** — public domain or CC BY; self-host + credit line and you're done.
- **SA** — ShareAlike: usable, but processed derivatives (e.g. a repacked texture atlas) must
  carry the same license. Acceptable if declared; heavier than CLEAN.
- **NC** — NonCommercial term present. Per the owner's PF-10 precedent this is a **declared
  risk, not an automatic no** — but it must be surfaced before any asset ships.
- **TRAP** — looks free, isn't (redistribution or provenance problem).

## Summary verdict table

| #   | Source                           | License (verified 2026-07-22)                                                             | Risk      | Verdict for this repo                                                  |
| --- | -------------------------------- | ----------------------------------------------------------------------------------------- | --------- | ---------------------------------------------------------------------- |
| 1   | NASA SVS                         | Public domain ("unless otherwise noted")                                                  | CLEAN     | Best single source for Moon/star-map textures                          |
| 2   | NASA Visible Earth / Blue Marble | Public domain (NASA media guidelines)                                                     | CLEAN     | Best Earth surface/topo/cloud source                                   |
| 3   | USGS Astrogeology (MOLA, LOLA)   | US public domain, credit requested                                                        | CLEAN     | Best Mars/Moon elevation source; huge files need downsampling          |
| 4   | JPL Horizons                     | US-gov data; no explicit license page; acknowledgment normal                              | CLEAN     | Best ephemeris ground truth for orbits/positions                       |
| 5   | ESA multimedia (Gaia imagery)    | CC BY-SA 3.0 IGO where marked; **non-CC ESA content is NC by default**                    | SA        | Usable with credit + SA declaration; check the per-image license box   |
| 6   | Gaia **data** (archive/DR3)      | **CC BY-NC 3.0 IGO** (license page) vs "open and free to use, provided credit" (DR3 docs) | **NC**    | Already shipped in-repo — needs an explicit owner risk acceptance note |
| 7   | Solar System Scope textures      | CC BY 4.0 (stated verbatim on page)                                                       | CLEAN     | Easiest drop-in full planet set, 2K–8K                                 |
| 8   | Stellarium texture tree          | Mixed per-file (PD / CC BY-SA / special permission)                                       | **TRAP**  | Do **not** bulk-copy; go to each texture's upstream instead            |
| 9   | Hubble (STScI) imagery           | Public domain (STScI asserts no copyright; NASA contract)                                 | CLEAN     | DSO sprites/skybox imagery                                             |
| 10  | JWST (STScI/ESA Webb) imagery    | PD via STScI/NASA; esawebb.org is CC BY 4.0                                               | CLEAN     | Prefer STScI (PD) over esawebb (CC BY) when both host an image         |
| 11  | ESO imagery incl. GigaGalaxy     | CC BY 4.0 (site-wide for images)                                                          | CLEAN     | Milky Way panorama; **full 800-Mpx original is NOT free** (trap)       |
| 12  | Hipparcos via CDS/VizieR         | Free for scientific use; commercial per-catalog; citation required                        | CLEAN-ish | Already the basis of the 168,959-star field; keep citation             |
| 13  | HYG database (Astronexus)        | **CC BY-SA 4.0** (v4.x; v3.x was CC BY-SA 2.5)                                            | SA        | Convenient merged catalog; SA obligations on derived binaries          |

Everything in this table can be downloaded and self-hosted, so **all of it is compatible with
the no-CDN hash-based CSP** — the only sources with a distribution problem are the two traps
(#8, #11-original) and they are provenance problems, not hosting problems.

---

## 1. NASA Scientific Visualization Studio (SVS)

- **URL:** <https://svs.gsfc.nasa.gov/> — usage terms at <https://svs.gsfc.nasa.gov/help/>
- **Offers:** production-quality visualization assets, including two directly relevant kits:
  - **CGI Moon Kit (SVS 4720,** <https://svs.gsfc.nasa.gov/4720/>**):** color maps from the LRO
    LROC WAC Hapke-normalized mosaic (float16 EXR + 16-bit sRGB TIFF up to **27360×13680**;
    2048×1024 JPG preview) and LOLA displacement maps at 4/16/64 px per degree (float TIFF in
    km relative to the 1737.4 km reference radius, or unsigned 16-bit TIFF in half-meters, up
    to **23040×11520**). Coverage 70°N–70°S with LDAM albedo fill at the poles. The page
    itself warns the kit is "optimized for aesthetics, not science."
  - **Deep Star Maps 2020 (SVS 4851,** <https://svs.gsfc.nasa.gov/4851/>**):** all-sky star
    map textures from ~1.7 billion stars (Hipparcos-2, Tycho-2, **Gaia DR2**, Yale BSC,
    UCAC3/XHIP), 4K→**64K (65536×32768)** in EXR half-float / TIFF / JPG, in both
    celestial (ICRF/J2000) and galactic frames, with separate star/grid/boundary/figure
    layers. 34 MB (4K EXR) → 3.8 GB (64K EXR).
- **License (verbatim):** "All of our content is in the public domain (unless otherwise
  noted), meaning that it is free to download, use, and redistribute for whatever purposes
  you see fit." Caveat: some videos contain licensed **music** that is not PD.
- **Attribution:** requested, not required — credit "NASA's Scientific Visualization Studio".
  Deep Star Maps specifies "NASA/Goddard Space Flight Center Scientific Visualization Studio.
  Gaia DR2: ESA/Gaia/DPAC." (constellation figures additionally credit Alan MacRobert, Sky &
  Telescope — avoid the figure layer if that credit is unwanted).
- **Compatibility:** CLEAN. Download, downsample, self-host. Note the Deep Star Maps carry
  Gaia DR2 inside them — NASA distributes them as public domain, which is the strongest
  available signal that a rendered Gaia-derived texture with the ESA/Gaia/DPAC credit is safe
  (see §6 for the underlying data-license tension).

## 2. NASA Visible Earth / Earth Observatory / Blue Marble

- **URLs:** <https://visibleearth.nasa.gov/> · <https://neo.gsfc.nasa.gov/view.php?datasetId=BlueMarbleNG>
  · <https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/>
  - Note: the old `visibleearth.nasa.gov/image-use-policy` and
    `earthobservatory.nasa.gov/image-use-policy` URLs both **301-redirect** (verified
    2026-07-22) to the consolidated NASA media guidelines at
    <https://www.nasa.gov/nasa-brand-center/images-and-media/> — that page now governs.
- **Offers:** **Blue Marble Next Generation** — monthly (Jan–Dec 2004) true-color global
  composites at **500 m/px** (full grid 86400×43200), in three variants (plain, +topography,
  +topography+bathymetry), so seasonal Earth is possible. Also city-lights (Black Marble),
  global cloud composites, and sea-ice/vegetation layers. JPEG/PNG/GeoTIFF tiles.
- **License (verbatim, NASA media guidelines):** "NASA content – images, audio, video, and
  media files … generally are not subject to copyright in the United States." Restrictions:
  NASA insignia/logos are protected; no implied NASA endorsement of goods/services; permission
  needed for commercial use of identifiable people; occasional third-party copyrighted items
  are marked.
- **Attribution:** requested — "NASA should be acknowledged as the source of the material"
  (e.g. "NASA Earth Observatory / Blue Marble: Next Generation, Reto Stöckli, NASA/GSFC").
- **Compatibility:** CLEAN. The current `earth-surface-*` textures could be upgraded or
  season-varied from here with zero license burden.

## 3. USGS Astrogeology (Astropedia) — Mars MOLA, Moon LOLA

- **URLs:** <https://astrogeology.usgs.gov/search> — policy at
  <https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits>
- **Key products (verified pages):**
  - **Mars MGS MOLA DEM 463m v2** — global DEM mosaic, GeoTIFF, from >600 M altimeter
    measurements (1999–2001). <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m>
  - **Mars MGS MOLA Global Color Shaded Relief 463m** — the classic rainbow-hypsometric Mars,
    **1 GB GeoTIFF** direct download
    (`https://planetarymaps.usgs.gov/mosaic/Mars_MGS_MOLA_ClrShade_merge_global_463m.tif`).
  - **Mars MGS MOLA–MEX HRSC Blended DEM Global 200m** — best current global Mars elevation.
  - **Moon LRO LOLA DEM 118m (Mar 2014)** — **8 GB GeoTIFF**, 16-bit signed int, elevation =
    DN × 0.5 m; ~10 cm vertical precision; the lunar geodetic reference.
    (`https://planetarymaps.usgs.gov/mosaic/Lunar_LRO_LOLA_Global_LDEM_118m_Mar2014.tif`)
  - **Moon LRO LROC WAC Global Morphology Mosaic 100m** — the standard grayscale Moon albedo.
- **License (verbatim):** "USGS-authored or produced data and information are considered to
  be in the U.S. Public Domain." Some third-party images on USGS pages are marked copyrighted.
- **Attribution:** requested — "Credit: U.S. Geological Survey" (plus instrument/mission,
  e.g. "NASA/JPL/GSFC/USGS – MGS MOLA").
- **Compatibility:** CLEAN. These are the authoritative upstream sources of the repo's
  existing `vt-mars-topography-mola` / `vt-moon-topography-nasa` Gaia Sky virtual-texture
  mirrors — sourcing direct from USGS/SVS removes the Gaia Sky middleman entirely for
  height data. Files are enormous; budget a downsample step (e.g. `gdal_translate`) and keep
  only web-sized derivatives in `public/assets/`.

## 4. JPL Horizons (ephemerides)

- **URL:** <https://ssd.jpl.nasa.gov/horizons/> (web app, REST API at
  <https://ssd-api.jpl.nasa.gov/>, command-line, email batch)
- **Offers:** high-precision ephemerides for planets, planetary satellites, asteroids,
  comets, spacecraft, barycenters and Lagrange points; osculating elements, state vectors,
  and observer tables; >99.9% historical uptime. Output is plain text/JSON via the API.
- **License:** the Horizons site states **no explicit license** (verified — the manual and
  front page carry none). It is a NASA/JPL-operated US-government service producing
  numerical facts; NASA's general "not subject to copyright" media policy is the operative
  posture, and academic practice is to acknowledge "JPL Horizons ephemeris system".
- **Compatibility:** CLEAN. Best use here: **bake** planetary/moon positions or orbital
  elements at build time into `src/data/celestial/` (live API calls would violate the no-CDN
  CSP; baking sidesteps it and matches the existing data pipeline). Would materially improve
  planet placement accuracy vs. hand-tuned positions, and is the natural cross-check for the
  DR3 asteroid-belt orbital motion work (PF-10 C3).

## 5. ESA multimedia — Gaia imagery (all-sky maps)

- **URLs:** <https://www.esa.int/ESA_Multimedia/Search> — terms at
  <https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website>
- **Offers:** the Gaia EDR3/DR3 all-sky colour maps — e.g. "The colour of the sky from
  Gaia's Early Data Release 3" (<https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_3>):
  1.8-billion-star full-sky brightness/colour map, hi-res PNG **60.5 MB** download, credit
  line on the page: **"ESA/Gaia/DPAC; CC BY-SA 3.0 IGO. Acknowledgement: A. Moitinho."** —
  an excellent physically-true Milky Way background/skybox candidate.
- **License:** two-tier and per-item — this is the subtlety:
  - Items **marked CC BY-SA 3.0 IGO** (most Gaia outreach imagery) are reusable, commercial
    use included, under ShareAlike terms.
  - ESA website content **not** released under CC defaults to ESA's standard terms, which
    state (verbatim): "Images or videos available on the ESA Website shall not be used for a
    commercial purpose" without written authorization. **Always check the per-image license
    box** before taking anything from esa.int.
- **Attribution:** exact credit line as printed on the image page, kept visible and
  unaltered.
- **Compatibility:** SA. Fine for this portfolio if (a) the credit ships on an attributions
  page/scene UI, and (b) any processed derivative (tone-mapped skybox, repacked atlas) is
  itself declared CC BY-SA 3.0 IGO. That's a real obligation — heavier than the CC BY items
  in §7/§9/§11 — but not an NC term.

## 6. Gaia data — ESA Gaia Archive (DR3) — **flagged NC**

- **URLs:** archive <https://gea.esac.esa.int/archive/> · license page
  <https://www.cosmos.esa.int/web/gaia-users/license> · DR3 credit instructions
  <https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/>
- **Offers:** the mission catalogs themselves — DR3: 1.8 B sources, astrometry, photometry,
  radial velocities; SSO/asteroid tables; via TAP/ADQL queries or bulk CSV/VOTable/FITS.
  This is the upstream of the repo's `catalog-gaia-dr3-*`, `catalog-asteroids-dr3*`, and
  white-dwarf packs (mirrored via gaiasky.space — see `docs/datasets/README.md`).
- **License — two statements coexist, verified same-day:**
  - The Gaia Users license page states verbatim: **"Gaia data are distributed under the
    CC BY-NC 3.0 IGO license."** (NonCommercial), deferring commercial-use questions to the
    ESA space-science-archive terms.
  - The DR3 archive documentation's credit page states verbatim: **"The Gaia data are open
    and free to use, provided credit is given to 'ESA/Gaia/DPAC'."**
- **Attribution (mandatory, DR3 docs):** "This work has made use of data from the European
  Space Agency (ESA) mission Gaia (https://www.cosmos.esa.int/gaia), processed by the Gaia
  Data Processing and Analysis Consortium (DPAC, …). Funding for the DPAC has been provided
  by national institutions, in particular the institutions participating in the Gaia
  Multilateral Agreement." Short form for visuals: **ESA/Gaia/DPAC**.
- **Compatibility — RISK FLAG (the one that matters):** this repo **already ships Gaia
  DR3-derived data** (asteroid belt PF-10 C3, white dwarfs, star field textures). The formal
  NC term is the same license family the owner declined for Gaia Sky's nebula shaders
  (CC-BY-NC-SA, TR-072/ADR-0004) — though data-NC is materially weaker than code-NC here:
  a personal, no-revenue portfolio is a defensible non-commercial use, ESA's own DR3
  documentation calls the data "open and free to use, provided credit", and NASA SVS
  redistributes Gaia-derived textures as public domain. **Recommended posture:** keep using
  it, add the mandatory DPAC acknowledgment to an attributions page (it is not currently
  anywhere in the site UI or docs), and record the owner's explicit acceptance of the NC
  reading in the next relevant plan/ADR so it's a decision, not an accident. If the
  portfolio ever gains a commercial dimension (paid consulting funnel, sponsorship), this is
  the first license to re-examine.

## 7. Solar System Scope textures

- **URL:** <https://www.solarsystemscope.com/textures/>
- **Offers:** matched full solar-system set: Sun, all 8 planets (Venus surface **and**
  atmosphere separately), Earth (day, night, clouds, normal, specular), Moon, stars/Milky
  Way, plus stylised dwarf planets (their Ceres/Haumea/Makemake/Eris are **fictional**
  artist maps — don't use those for accuracy work). 2K free tier, 4K/8K for major bodies.
  JPG/PNG (Earth normal/specular as TIF). Based on NASA elevation/imagery data.
- **License (verbatim from page):** "Distributed under Attribution 4.0 International
  license: You may use, adapt, and share these textures for any purpose, even commercially."
  (**CC BY 4.0**.)
- **Attribution:** credit "Solar System Scope" (link them on the attributions page).
- **Compatibility:** CLEAN — the friendliest license of any full drop-in set. Likely origin
  of textures similar to those already in `public/assets/planets/`; if the existing set's
  provenance is undocumented, re-sourcing from here retroactively cleans it up. Accuracy
  caveat: these are artist-harmonized for visual consistency, not calibrated science
  products — for measured-accuracy bodies prefer §1/§2/§3 and keep SSS for gas giants and
  the Venus cloud deck.

## 8. Stellarium texture tree — **TRAP: mixed per-file licenses**

- **URLs:** <https://github.com/Stellarium/stellarium/tree/master/textures> — license ledger
  at <https://github.com/Stellarium/stellarium/blob/master/CREDITS.md>
- **Offers:** a complete, battle-tested planet/moon/DSO texture set inside a GPL-2.0
  application repo.
- **License reality (from CREDITS.md):** per-file patchwork —
  - USGS-derived maps (e.g. Ganymede): public domain.
  - NASA/CICLOPS Cassini maps (Tethys, Dione, Rhea, Enceladus, Mimas): public domain.
  - John van Vliet's maps (Europa, Io, Callisto, others): **CC BY-SA**.
  - Moon albedo map: **CC BY-SA 4.0**.
  - James Hastings-Trew's maps (incl. Jupiter): used **with the author's specific
    authorization to Stellarium** — his Planet Pixel Emporium terms allow free use _in
    renders/artwork_ but **prohibit redistributing the map files themselves**, so copying
    those files into this repo would not be covered.
- **Compatibility:** do **not** bulk-copy from this tree. For any texture you want, read its
  CREDITS.md entry and go to the _upstream_ (USGS → §3, NASA → §1/§2, van Vliet → accept SA).
  Planet Pixel Emporium (<https://planetpixelemporium.com/>) itself is the classic trap to
  document: beautiful, free-to-render, **not redistributable** — self-hosting its files on
  this site would violate its terms.

## 9. Hubble imagery — STScI

- **URLs:** <https://hubblesite.org/> · policy at <https://www.stsci.edu/copyright>
  (note: `hubblesite.org/copyright` now 301-redirects to the NASA media-guidelines page)
- **Offers:** the full Hubble press-release archive — nebulae, galaxies, clusters — at up to
  full-mosaic resolution (often 10k–40k px), JPG/TIF/PNG. Directly useful for DSO sprite
  upgrades (`public/assets/dso*/`) and accurate nebula reference imagery.
- **License:** STScI asserts **no claim to copyright** — material was "created, authored,
  and/or prepared for NASA" under contracts NAS5-03127/NAS5-26555/80GSFC19C0054 and "may be
  freely used as in the public domain". NASA media guidelines apply on top (no logo use, no
  implied endorsement).
- **Attribution:** requested — typical credit "NASA, ESA, STScI" plus any named science team
  as shown on the image page. Note some Hubble images are ESA co-productions; the
  ESA/Hubble mirror (<https://esahubble.org/copyright/>) releases the same imagery under
  **CC BY 4.0** with a mandatory visible "ESA/Hubble" credit — when an image exists on both,
  the STScI/NASA public-domain copy is the lighter-obligation source.
- **Compatibility:** CLEAN.

## 10. JWST imagery — STScI / ESA Webb

- **URLs:** <https://webbtelescope.org/> (STScI; its `/copyright` page now redirects to the
  NASA media guidelines) · <https://esawebb.org/copyright/> (ESA mirror)
- **Offers:** all JWST release imagery, up to full-resolution mosaics (some >100 Mpx),
  JPG/TIF/PNG; infrared nebula/deep-field references far sharper than the Hubble equivalents.
- **License:** same structure as Hubble — STScI/NASA copies are effectively **public
  domain** (STScI no-copyright statement + NASA media guidelines); **esawebb.org is CC BY
  4.0** (verbatim: materials must be "clearly and visibly credited" with the credit line
  unaltered; logos excluded; alterations must be noted after the credit line).
- **Attribution:** "NASA, ESA, CSA, STScI" (+ science team as listed per image).
- **Compatibility:** CLEAN. Prefer the STScI download; keep the full credit line either way
  since CSA/ESA are mission partners.

## 11. ESO imagery — GigaGalaxy Zoom Milky Way panorama

- **URLs:** policy <https://www.eso.org/public/copyright/> — panorama
  <https://www.eso.org/public/images/eso0932a/>
- **Offers (eso0932a, "The Milky Way panorama", Serge Brunier):** 360° full-sky Milky Way
  panorama — the de-facto standard Milky Way skybox in planetarium software. Downloads
  verified on-page: fullsize original TIFF **27.7 MB** (~18 Mpx), publication 4K TIFF
  12.9 MB, large JPEG 7.8 MB, zoomable viewer. Companion images eso0932b/c exist at similar
  sizes.
- **License (site-wide, verbatim requirement):** **CC BY 4.0** — credit must be "in a clear
  and readable manner" and "not hidden or disassociated from the image footage". Exceptions:
  ESO logo, and commercial use of identifiable people.
- **Attribution:** **"ESO/S. Brunier"** exactly as printed on the image page.
- **The trap, stated on the page itself (verbatim):** "For copyright reasons, we cannot
  provide here the full 800-million-pixel original image, which can be requested from Serge
  Brunier." — i.e. the CC BY 4.0 grant covers **only the resolutions ESO hosts** (~18 Mpx).
  The famous 800-Mpx master is Brunier's personal copyright and would need his written
  permission. Do not source a "full-res GigaGalaxy" from a third-party mirror; any mirror
  above ESO's hosted resolution is unlicensed.
- **Compatibility:** CLEAN at ESO-hosted resolutions (an 18-Mpx equirect is ample for a
  skybox at this project's texture budgets). The ESA/Gaia map (§5) is the SA-licensed but
  data-true alternative; ESO's is photographic and prettier at low res.

## 12. Hipparcos / classical catalogs — CDS VizieR

- **URLs:** <https://vizier.cds.unistra.fr/> — usage rules
  <https://cds.unistra.fr/vizier-org/licences_vizier.html> — Hipparcos I/239, New Reduction
  I/311 at <https://cdsarc.cds.unistra.fr/viz-bin/cat/I/311>
- **Offers:** Hipparcos (117,955 stars, van Leeuwen 2007 New Reduction), Tycho-2, and
  ~25,000 other catalogs; FITS/VOTable/TSV downloads and TAP queries.
- **License (verbatim):** data are "free of usage in a scientific context", but "the
  original authors and publication references including the publisher have to be explicitely
  cited"; commercial usage "is subject to rules depending on the origin" — check each
  catalog's ReadMe for a copyright section. VizieR service acknowledgment: "This research
  has made use of the VizieR catalogue access tool, CDS, Strasbourg, France
  (DOI: 10.26093/cds/vizier)."
- **Compatibility:** CLEAN-ish. The site's 168,959-star field is already Hipparcos-derived
  (via the Gaia Sky mirror — `docs/datasets/README.md`). The underlying Hipparcos catalog is
  an ESA mission product with no NC term; the obligation is citation, not license fee. Add
  the van Leeuwen 2007 + ESA 1997 citations and the VizieR line to the attributions page.
  A raw-catalog re-derivation from I/311 would also drop the gaiasky.space intermediary.

## 13. HYG database — Astronexus

- **URLs:** <https://www.astronexus.com/hyg> — repo now at
  <https://codeberg.org/astronexus/hyg> (the GitHub repo was archived 2025-02-14 and points
  there)
- **Offers:** merged Hipparcos + Yale Bright Star + Gliese catalog with precomputed
  Cartesian XYZ, color indices, spectral types and cross-IDs — the "already game-ready"
  star catalog. HYG v4.4: **119,614 stars**; AT-HYG v3 (adds Tycho-2, ~2.5 M stars):
  118,971 in its core tier. CSV (`.csv.gz`).
- **License (verbatim):** "This work is licensed under a Creative Commons
  Attribution-ShareAlike 4.0 International License." (v4.x; the old v3.x was CC BY-SA 2.5.)
- **Attribution:** credit Astronexus/David Nash + the CC BY-SA 4.0 notice; derived
  data products (e.g. a repacked star texture built from it) inherit **SA**.
- **Compatibility:** SA. Not needed while the Hipparcos pipeline exists (§12 provides the
  same stars license-cleaner), but convenient if a quick magnitude/color/name join is ever
  wanted. If used, the derived binary must be declared CC BY-SA 4.0 — same obligation class
  as §5, and worth the same explicit owner sign-off given the PF-10 precedent (that
  precedent was specifically **NC**+SA; plain SA carries no commercial restriction).

---

## Cross-cutting recommendations

1. **Create an attributions surface.** Nothing in the site UI or README currently carries
   the mandatory ESA/Gaia/DPAC acknowledgment (§6) — that's the only _required_ credit
   currently outstanding, and it's required regardless of which license reading prevails.
   One `/credits` route (or footer modal) listing: ESA/Gaia/DPAC; USGS/NASA MOLA+LOLA;
   NASA SVS; Solar System Scope (CC BY 4.0); ESO/S. Brunier (CC BY 4.0) and any SA notices —
   satisfies every source above at once.
2. **CSP posture is a non-issue for all 13 sources** — each grants download+redistribute
   (within its terms), so everything gets vendored into `public/assets/` per ADR-0005. No
   source requires hotlinking; several _forbid_ nothing but it (Planet Pixel Emporium
   forbids redistribution — which is exactly what self-hosting is — hence its TRAP status).
3. **Preference order for accuracy work:** USGS/NASA SVS (PD, calibrated science products) →
   STScI/ESO (PD / CC BY imagery) → Solar System Scope (CC BY, harmonized art) →
   ESA CC BY-SA items (SA declared) → Gaia data (NC flagged, owner-accepted) → never:
   Stellarium bulk-copy, Planet Pixel Emporium files, GigaGalaxy 800-Mpx mirrors,
   anything CC-BY-NC-SA (per TR-072/ADR-0004 precedent).
4. **Record the Gaia NC decision.** §6 is the only finding that touches assets already
   shipped. It mirrors the PF-10 nebula-shader situation closely enough that it deserves the
   same treatment: a dated, explicit owner decision in the next plan or a short ADR, rather
   than silence.

## Sources consulted

All fetched 2026-07-22:

- NASA media guidelines — <https://www.nasa.gov/nasa-brand-center/images-and-media/>
- NASA SVS usage/help — <https://svs.gsfc.nasa.gov/help/> · CGI Moon Kit — <https://svs.gsfc.nasa.gov/4720/> · Deep Star Maps 2020 — <https://svs.gsfc.nasa.gov/4851/>
- USGS copyrights & credits — <https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits>
- USGS Astropedia: Mars MOLA color shaded relief 463m — <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_global_color_shaded_relief_463m> · Mars MOLA DEM 463m — <https://astrogeology.usgs.gov/search/map/mars_mgs_mola_dem_463m> · Moon LRO LOLA DEM 118m — <https://astrogeology.usgs.gov/search/map/moon_lro_lola_dem_118m>
- JPL Horizons — <https://ssd.jpl.nasa.gov/horizons/>
- ESA multimedia terms — <https://www.esa.int/ESA_Multimedia/Terms_and_conditions_of_use_of_images_and_videos_available_on_the_esa_website> · Gaia EDR3 sky map — <https://www.esa.int/ESA_Multimedia/Images/2020/12/The_colour_of_the_sky_from_Gaia_s_Early_Data_Release_3>
- Gaia data license — <https://www.cosmos.esa.int/web/gaia-users/license> · credits — <https://www.cosmos.esa.int/web/gaia-users/credits> · DR3 credit instructions — <https://gea.esac.esa.int/archive/documentation/GDR3/Miscellaneous/sec_credit_and_citation_instructions/>
- Solar System Scope textures — <https://www.solarsystemscope.com/textures/>
- Stellarium repo/CREDITS — <https://github.com/Stellarium/stellarium> · <https://github.com/Stellarium/stellarium/blob/master/CREDITS.md>
- STScI content use — <https://www.stsci.edu/copyright> · ESA/Hubble — <https://esahubble.org/copyright/> · ESA/Webb — <https://esawebb.org/copyright/>
- ESO copyright — <https://www.eso.org/public/copyright/> · GigaGalaxy panorama — <https://www.eso.org/public/images/eso0932a/>
- CDS VizieR usage rules — <https://cds.unistra.fr/vizier-org/licences_vizier.html>
- HYG database — <https://codeberg.org/astronexus/hyg> · <https://github.com/astronexus/HYG-Database>
