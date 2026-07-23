# Research

External research collected for delivery planning — scraped/site research, public-domain
source vetting, and clearly-labelled training-knowledge briefs. Rules for this directory:

- Every doc states its **source class** (live-fetched web pages with URLs + fetch date, vs
  model training knowledge marked "verify before shipping") — never mixed silently.
- **Licensing is load-bearing**: gaiasky.space site content is CC-BY-NC and the Gaia Sky
  black-hole shader is CC-BY-NC-SA (never port either); Gaia Sky original datasets are CC-BY;
  Gaia data follows ESA/DPAC terms. See each doc's licensing section before reusing anything.
- Research docs are inputs to plans/ADRs, not decision records — decisions still land in
  `docs/adr/` and plans in `docs/delivery-plan/`.

| Doc                                                                  | What it holds                                                                                                                                                                                                                                                        | Collected                                               |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| [gaiasky-space-site.md](gaiasky-space-site.md)                       | Gaia Sky platform overview from gaiasky.space (v3.7.4, MPL-2.0, dataset ecosystem tiers 646k→1.47B stars, VR, release notes) + licensing notes incl. the CC-BY-NC-SA shader confirmation                                                                             | 2026-07-22, live fetch                                  |
| [gaiasky-datasets-catalog.md](gaiasky-datasets-catalog.md)           | Per-dataset-family reference (star packs, SDSS DR12–18, clusters, NEARGALCAT, white dwarfs, DR3/FPR asteroids, planetary texture/VT packs, Milky Way skybox, Planck CMB) cross-referenced against what's mirrored in `resources/gaia_datasets/`                      | 2026-07-22, live fetch                                  |
| [texture-sources-public-domain.md](texture-sources-public-domain.md) | Vetted public-domain/permissive texture+data sources (NASA SVS/Visible Earth, USGS Astrogeology, ESA/Gaia media, ESO, Solar System Scope, Stellarium, HYG…) with exact license terms, attribution requirements, CSP/self-hosting compatibility, and NC/SA risk flags | 2026-07-22, live fetch                                  |
| [astronomy-reference-notes.md](astronomy-reference-notes.md)         | Training-knowledge science brief (marked as such): Milky Way appearance by observer location, belt density/visibility reality, flip-and-burn kinematics, reference frames + transition cues, key scale numbers                                                       | 2026-07-22, training knowledge — verify before shipping |

Prompted by the PF-11 plan ([docs/delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md));
the peer-reviewed science companion is Astra's
[sky-frames & travel science brief](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md).
