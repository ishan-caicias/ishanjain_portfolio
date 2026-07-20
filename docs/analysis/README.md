# Space Scene Analysis

Date: 2026-07-16

This folder documents the current state of the portfolio codebase and the spaceship-travel prototype, with a focus on three questions:

1. Which Sketchfab ship models are good replacement candidates?
2. Why does the current space-travel experience feel less physical than intended?
3. Would framework or dependency changes materially unlock better rendering?

## Inputs Reviewed

### Root app

- `README.md`
- `package.json`
- `astro.config.mjs`
- `src/components/islands/Starfield.tsx`
- `src/components/islands/AstronautMascot.tsx`
- `src/components/islands/MissionControl.tsx`
- `docs/architecture.md`
- `docs/diagrams/*.mmd`

### Prototype

- `Interactive Outerspace Portfolio/README.md`
- `Interactive Outerspace Portfolio/CLAUDE_CODE_HANDOFF.md`
- `Interactive Outerspace Portfolio/DATA.md`
- `Interactive Outerspace Portfolio/FULL-DATASET-PIPELINE.md`
- `Interactive Outerspace Portfolio/Space Portfolio.dc.html`
- `Interactive Outerspace Portfolio/space-engine.js`
- `Interactive Outerspace Portfolio/assets/ship.obj`

## Output Docs

- [2026-07-16-repo-state-and-space-scene-scope.md](2026-07-16-repo-state-and-space-scene-scope.md) — **void per audit** (described `main`, not the working branch)
- [2026-07-16-sketchfab-ship-survey.md](2026-07-16-sketchfab-ship-survey.md) — valid; ship chosen (Sci-Fi Aircraft | Spaceship Fighter, CC-BY-4.0)
- [2026-07-16-space-motion-realism-audit.md](2026-07-16-space-motion-realism-audit.md) — **survives audit in full**; primary design input
- [2026-07-16-rendering-stack-options.md](2026-07-16-rendering-stack-options.md) — A/B/C analysis valid; "validated delivery decision" void (rolled back)
- [2026-07-16-validation-record.md](2026-07-16-validation-record.md) — model validations useful; repo/implementation claims void
- [2026-07-17-codex-analysis-audit.md](2026-07-17-codex-analysis-audit.md) — **claim-by-claim audit of the set above** (Orion, 2026-07-17)
- [2026-07-19-webgl-babylon-cutover-gap-analysis.md](2026-07-19-webgl-babylon-cutover-gap-analysis.md) — **PF-09 B6 post-flip delta register** (Procyon, 2026-07-19); 27 gaps between the archived WebGL1 engine and the Babylon default. Headline: curated destination bodies and the photographic DSO layer are not rendered on the Babylon path — undocumented in ADR-0006
- [2026-07-20-gaia-dataset-gap-analysis.md](2026-07-20-gaia-dataset-gap-analysis.md) — **local Gaia Sky dataset vs. rendered catalog gap analysis** (Procyon, 2026-07-20); 40 real datasets in `resources/gaia_datasets/` (documented in `docs/datasets/README.md`) vs. the live celestial catalog. Headline: named spacecraft/exotic systems are already covered, but star clusters, real galaxy catalogs, white dwarfs, and real asteroid orbital data are entirely absent, and the Babylon asteroid belt is fully procedural with no catalog backing it. Analysis only — no conversion started, priority pending owner decision
- [2026-07-20-star-cluster-hall-of-fame-realism-review.md](2026-07-20-star-cluster-hall-of-fame-realism-review.md) — **Astra realism audit of the PF-10 C1 curated cluster list** (Astra + Procyon, 2026-07-20); validated the owner's 31-cluster hand-curated list (all accurate), added 4 candidates (M67, NGC 6397, NGC 2244/Rosette, M2 — list now 35), flagged Trapezium/ONC as needing hand-authored data (not decodable from local catalogs), and resolved a data-vintage tradeoff — bulk instanced clusters keep 2013 MWSC data, the 35 curated dossier objects get modern-literature-corrected values
- [2026-07-20-ngc2000-volume-nebula-shapes-science-brief.md](2026-07-20-ngc2000-volume-nebula-shapes-science-brief.md) — **Astra science brief for PF-10 C1's 8 remaining NGC2000 volume nebulae** (Astra, 2026-07-20); original SDF-primitive shapes (torus/capped-cone/box/ellipsoid + CSG union/subtract) for Helix, Cat's Eye, Box, Butterfly, Hourglass, Crab, Ring, and Trifid, chosen to avoid porting Gaia Sky's CC-BY-NC-SA shadertoy-derived shaders. All 8 verdict ACCURATE or SIMPLIFIED — none need a declared license. Flags real ionization-stratification colour physics (4 objects), Crab's genuinely distinct synchrotron-emission mechanism (it's a supernova remnant, not a planetary nebula), and Trifid's dark lanes as real extinction (density subtraction, not a dark colour)
- [2026-07-20-gd1-connected-trail-science-brief.md](2026-07-20-gd1-connected-trail-science-brief.md) — **Astra science brief for PF-10 C1's GD-1 connected-trail visual** (Astra, 2026-07-20); recommends a spherical-PCA great-circle fit on the real 1,365-star sample to order stars along the stream (ACCURATE, self-verifying — declined to cite a memorized literature rotation-matrix constant without independent verification), and confirms real radial-velocity gradient colouring as a genuine, literature-standard GD-1 diagnostic (the stream's dynamically-cold-orbit signature), not decoration
- [2026-07-20-dr3-asteroid-belt-science-brief.md](2026-07-20-dr3-asteroid-belt-science-brief.md) — **Astra science brief for PF-10 C3's real Gaia DR3 asteroid belt** (Astra, 2026-07-20); audits the 8 design decisions replacing the procedural Havok belt with 154,662 real Keplerian orbits. Two BROKEN PHYSICS findings: (a) the scene declares its X–Y plane the ecliptic without applying the obliquity rotation, while the star catalog is equatorial — the dataset itself ships `transformFunction: eclipticToEquatorial`, so the belt would sit 23.44° off the real zodiac; (b) the proposed colour byte t = 0.85 implies B−V ≈ 1.4 (an M star) — real main-belt asteroids are warm grey at B−V ≈ 0.80, recommending t ≈ 0.68 / byte 173. Confirms the vis-viva arithmetic (3.053 wu/s at 2.7 AU, 4.63 days per wall-clock second) and clears uniform time acceleration as ACCURATE. Corrects the stated dataset facts (154,662 objects, 945 epochs, JD 2456876.5–2457888.5). Supplies a measured radial-histogram signature for unit tests: Kirkwood gap minima land on the 3:1, 5:2, 7:3 and 2:1 resonances to ≤0.01 AU with depletion factors of 100× and 200×, plus the 569-object Hilda island, the 6-object void from 4.05–5.00 AU, and 1,545 Jupiter Trojans
- [pf-07-spaceship-v2-report.html](../checkpoint/pf-07-spaceship-v2-report.html) — interactive HTML report (audit verdicts, decision, phased plan, roadmap); lives in `docs/checkpoint/`, also published as a Claude Artifact

## Headline Conclusions

> **⚠ Audit correction (2026-07-17):** the first bullet below is void — it described `main`. On
> the working branch the traveling spaceship scene has been shipped since 2026-07-08. The
> remaining bullets survive audit.

- ~~The checked-in Astro app does not yet contain the traveling spaceship scene; that logic still lives in the prototype folder.~~ (void — see audit)
- The prototype's ship feels partly 2D because the scene mixes a real 3D star renderer with several fixed-screen DOM and clip-space presentation layers.
- The safest replacement path is not "find the most animated Sketchfab file"; it is "pick a legally clean, performance-safe ship with a strong silhouette, then decide whether animation stays procedural or moves to glTF."
- Language and framework upgrades alone will not fix the realism gap. The meaningful unlock is glTF-friendly rendering, not a general Astro or React migration.

See the validation record for the repository state, third-party-source checks, and findings that were intentionally marked unverified rather than treated as facts.
