# Star cluster "hall of fame" — Astra realism review

**Date:** 2026-07-20
**Mode:** REALISM-AUDIT + SCIENCE-BRIEF (Astra), consumed by Procyon same-turn
**Context:** [PF-10 Phase C1](../delivery-plan/PF-10-gaia-dataset-realism.md#phase-c1--missing-objects)
needs a small, curated "hall of fame" subset of star clusters promoted to full travelable/dossier
status. The owner hand-authored a 31-cluster candidate list
([`docs/datasets/star_clusters_hall_of_fame.md`](../datasets/star_clusters_hall_of_fame.md)) and
asked Procyon to validate it and check for gaps. Per the Procyon↔Astra seam, scientific
validation of a real-astronomy content list routes to Astra rather than being asserted by
Procyon. This document is the durable record of that review and the decisions it produced.

**Status of the flip side:** all four decisions below were made by the owner immediately after
this review landed — recorded together here rather than as a separate "decision" doc, since none
of them reopened Astra's verdicts, only accepted or picked between the options presented.

---

## 1. List validation — 31/31 accurate

Every nickname, alternative designation, and "genuinely iconic" framing in the original 31-object
list checked out as real and correctly attributed. Age estimates fall within normal literature
variance (different papers/methods routinely disagree 10–30% on cluster ages — expected, not an
error). Two items got a specific verdict:

| Object                                      | Verdict                        | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Trapezium / Orion Nebula Cluster / M42 core | **SIMPLIFIED**                 | "Trapezium" strictly names 4 stars (θ¹ Ori A–D); the ~2,000-member surrounding cluster is the Orion Nebula Cluster (ONC). This is also _why_ it didn't decode from either local VOTable catalog (MWSC, Hunt-Reffert 2023) under any name — embedded, high-extinction, still-forming clusters are hard for astrometric survey pipelines generally, Gaia included. **Consequence: this entry cannot be sourced from the local pipeline at all and needs a fully hand-authored position/distance**, same treatment as the site's existing spacecraft/exotic-system entries. |
| Messier 92 age (~14 Gyr)                    | **SIMPLIFIED — phrasing risk** | 14 Gyr formally exceeds the universe's age (13.797 Gyr, Planck 2018) — not a real tension (GC ages carry ~1 Gyr systematic uncertainty), but stating it as a bare fact reads as an error to anyone who knows the universe's age. Reworded in content (see below) to "brushes right up against the age of the universe itself" rather than asserting a number past the ceiling.                                                                                                                                                                                           |

No BROKEN PHYSICS findings in the original list.

## 2. Completeness — 4 candidates evaluated, all accepted

| Candidate                         | Astra's verdict                                                                                                                                                                                | Owner decision                                                |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Messier 67 / NGC 2682             | **Strong add — real gap.** Unusually old for an open cluster (~4 Gyr; most disperse via tidal stripping long before this), a "solar twin" benchmark with confirmed member-star exoplanets.     | **Added.**                                                    |
| NGC 6397                          | **Add.** One of the two nearest globulars to Earth (paired with M4), core-collapsed, subject of HST's landmark deep white-dwarf-cooling-sequence study.                                        | **Added.**                                                    |
| Rosette Nebula Cluster / NGC 2244 | **Add, with a naming caveat** — same nebula-vs-cluster ambiguity as Trapezium, but consistent with the list's own existing pattern (M16, NGC 6530 are both nebula-associated entries already). | **Added.**                                                    |
| Messier 2 / NGC 7089              | **Optional, not essential** — genuinely large/bright but tier-2 fame next to the 10 already-listed globulars.                                                                                  | **Added anyway** (owner: "let's add the 4, it's acceptable"). |

**List grows 31 → 35** (22 open clusters, 13 globular clusters). Full finalized list, with real
J2000 coordinates, distances, ages, apparent magnitudes, and constellations, is in the
reformatted [`docs/datasets/star_clusters_hall_of_fame.md`](../datasets/star_clusters_hall_of_fame.md).

## 3. Data-vintage tradeoff — resolved as a split decision

**The finding:** the local MWSC catalog (Kharchenko et al. 2013) predates Gaia entirely (2MASS +
PPMXL ground astrometry), which is why Procyon's raw decode of Pleiades/Praesepe drifted from
modern Gaia-DR3-era literature (Pleiades: MWSC gives ~141 Myr/130 pc vs. modern ~115 Myr/136 pc;
Praesepe: MWSC gives ~832 Myr/187 pc vs. modern ~600–730 Myr/177–183 pc). Astra's verdict:
**SIMPLIFIED, not BROKEN PHYSICS** — real 2013 measurements, just superseded in precision.

**Astra's recommendation, accepted by the owner in full:**

- **Bulk instanced layer (~12,180 non-dossier clusters):** ship MWSC as decoded, unmodified.
  SIMPLIFIED / declared-license — "2013 systematic survey, not per-object modern literature" is
  an honest, reasonable trade for an ambient background population nobody reads a dossier for.
  **No change to the PF-10 C0/C1 pipeline plan** — `scripts/gaia-dataset-pipeline.mjs` continues
  to read MWSC directly for this tier.
- **Curated hall-of-fame tier (the 35 dossier objects):** hand-correct age/distance/position to
  modern literature consensus rather than pulling raw MWSC values, since these are exactly the
  objects a domain-literate visitor is most likely to spot-check. **This is why the 35 curated
  entries in the reformatted doc carry hand-verified modern values, not raw pipeline output** —
  they were never intended to run through `gaia-dataset-pipeline.mjs`'s mechanical Track A path
  at all once this decision was made.

## 4. Content authoring — 10 samples delivered, remainder deferred

Astra authored 10 flavour+lore pairs (Pleiades, Hyades, Orion Nebula Cluster/Trapezium, M67,
Jewel Box, Omega Centauri, M13, M4, NGC 6397, M92) matching the site's existing collector-card
tone (`celestial-gaia.js`'s Voyager 1 entry as the reference bar), plus sourcing guidance for the
rest (Gaia DR3 characterization papers / Hunt & Reffert 2023 for age+distance, SIMBAD/NASA ADS
for the "why it's notable" fact, Wikipedia only as a _pointer_ to the real citation, never as the
citation itself).

**Owner decision:** ship the 10 as-is; defer authoring the remaining 25 until "the portfolio is
functionally ready" — i.e. after C1's data/rendering path exists, not before. The reformatted doc
marks all 25 pending entries with an explicit `[[TODO: content pass — deferred by owner]]`
marker, matching the honesty convention TR-061 established (no fabricated flavour text standing
in for real content).

---

## Cross-references

- Triggered by: owner request in-conversation, 2026-07-20 (no TR/GAP number — a content/data
  validation pass, not a code change).
- Feeds: [PF-10 Phase C1](../delivery-plan/PF-10-gaia-dataset-realism.md#phase-c1--missing-objects)
  (list finalized, data-vintage split decided).
- Data source ground truth: [TR-061](../test-reports/TR-061.md) (the VOTable BINARY2 pipeline
  this review's MWSC findings were decoded through).
- Reformatted content: [`docs/datasets/star_clusters_hall_of_fame.md`](../datasets/star_clusters_hall_of_fame.md).
