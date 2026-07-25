/* celestial-content-overlay.js — PF-11 D4.4: hand-curated card content, applied LAST.
 *
 * NEVER hand-edit a generated catalog file (CLAUDE.md #22) — celestial-clusters.js and
 * celestial-ngc2000.js are mechanical/pipeline output. This module patches their `"f"`
 * (field note) and `"lo"` (sourced lore fact) text for the ids that were shipped with an
 * honest `[[TODO: content pass...]]` placeholder rather than fabricated content, per the
 * delivery plan's own D4.4 authorship decision (owner-approved GENERATED drafts, grounded in
 * official/refereed sources, no invented facts — ADR-0010).
 *
 * Per-cluster source list: docs/analysis/2026-07-25-card-content-sources.md. Numerical facts
 * (distance/age/magnitude) are NOT re-derived here — they were already hand-verified in each
 * record's own `"st"` field (see celestial-clusters.js's header, its own Astra realism
 * review). This overlay supplies narrative text only, anchored to those existing numbers.
 *
 * OVERRIDE-ONLY, never additive: every id below MUST already exist in `window.CELESTIAL` by
 * the time this runs (celestial-clusters.js and celestial-ngc2000.js both load earlier in
 * SpaceScene's import chain). An id with no matching catalog entry is silently skipped, never
 * used to fabricate a phantom body — celestial-content-overlay.test.ts asserts this directly.
 *
 * BATCH 1 OF 2, owner-approved 2026-07-25 and wired into SpaceScene.tsx's import chain
 * (sequenced in its own `.then` AFTER the base-catalog Promise.all resolves, never inside it —
 * Promise.all does not order its array's own module side effects relative to each other, and
 * this module's whole job depends on every base catalog module having already run). Covers
 * the 25 deferred cluster texts only — the 41+ NGC2000 nebula entries are batch 2, not
 * started (see TR-099), and land the same way (new OVERRIDES keys here, or a sibling module,
 * once drafted and approved).
 */
(function () {
  var OVERRIDES = {
    "cluster-beehive": {
      f: "One of the closest open clusters to Earth — close enough that Galileo turned his brand-new telescope on it in 1609 and resolved what had looked like a faint naked-eye smudge into individual stars for the first time.",
      lo: [
        [
          "Galileo Galilei, Sidereus Nuncius (1609)",
          "Galileo counted more than 40 stars beyond the two bright 'donkey' stars that gave the cluster its ancient Latin name, Praesepe — 'the manger.'",
        ],
      ],
    },
    "cluster-ptolemy": {
      f: "Known since antiquity: the astronomer Ptolemy recorded it as a hazy 'nebulous cluster' near the Scorpion's sting around 130 AD — sixteen centuries before a telescope confirmed it was true stars, not mist.",
      lo: [
        [
          "Ptolemy, Almagest (c. 130 AD)",
          "Listed as object 567 in Ptolemy's star catalog, one of very few deep-sky objects with a named observer from classical antiquity — which is why the cluster still carries his name.",
        ],
      ],
    },
    "cluster-wild-duck": {
      f: "One of the richest, most densely packed open clusters known — nearly 3,000 stars crowded into a space most clusters this size would spread ten times thinner.",
      lo: [
        [
          "Admiral William H. Smyth, A Cycle of Celestial Objects (1844)",
          "Smyth's 1835 observation described the cluster's wedge of bright stars as resembling 'a flight of wild ducks' — the name has stuck for nearly two centuries.",
        ],
      ],
    },
    "cluster-h-persei": {
      f: "Half of a genuinely rare pair: two open clusters, both barely 14 million years old, close enough in space to be gravitationally bound to each other — one of very few confirmed true double clusters in the galaxy.",
      lo: [
        [
          "Perseus OB1 association studies",
          "h and χ Persei sit only about 20 parsecs apart — close enough that most other apparent 'double clusters' in the sky turn out, by comparison, to be unrelated chance alignments.",
        ],
      ],
    },
    "cluster-chi-persei": {
      f: "The other half of the Double Cluster — a near-twin of h Persei next door, both still glittering with young blue-white supergiants born from the same burst of star formation.",
      lo: [
        [
          "Perseus OB1 association studies",
          "Each cluster hosts over 300 blue-white supergiants — a rare concentration of the galaxy's most short-lived, luminous stars, caught before they've had time to disperse or explode.",
        ],
      ],
    },
    "cluster-butterfly": {
      f: "A loose, young cluster whose brightest stars fan out in a shape 20th-century observers likened to a butterfly with open wings.",
      lo: [
        [
          "Robert Burnham Jr.; first recorded by Giovanni Hodierna, 1654",
          "Hodierna quietly catalogued the cluster in 1654, over a century before it entered wider astronomical use — his records went largely unrecognized until the 1980s, and the 'Butterfly' name itself is a 20th-century addition.",
        ],
      ],
    },
    "cluster-salt-and-pepper": {
      f: "The brightest and richest open cluster in Auriga — thousands of stars packed into its core, scattered like grains of salt and pepper against the dark.",
      lo: [
        [
          "Giovanni Battista Hodierna (before 1654)",
          "Hodierna recorded this cluster over a century before Messier's own survey — one of several Messier objects that had already been quietly catalogued decades earlier.",
        ],
      ],
    },
    "cluster-wishing-well": {
      f: "The first object the Hubble Space Telescope ever imaged — a wide field of this cluster's stars, captured May 20, 1990, less than a month after launch, while engineers were still focusing the mirror.",
      lo: [
        [
          "NASA/ESA Hubble Space Telescope, first-light image (1990)",
          "The 'first light' frame was centered near the cluster's hot blue-white star HD 96755 and used to help verify the telescope's focus — before the famous mirror flaw was even found.",
        ],
      ],
    },
    "cluster-carolines-rose": {
      f: "One of the richest and older open clusters in the northern sky — loops of stars and dark lanes that, through a telescope, swirl like the petals of a rose.",
      lo: [
        [
          "Caroline Herschel, discovered November 1, 1783",
          "Caroline Herschel — William Herschel's sister and an accomplished discoverer in her own right — found this cluster while sweeping the sky with her own telescope.",
        ],
      ],
    },
    "cluster-coma": {
      f: "One of the nearest open clusters to Earth, close and wide enough that its brightest stars form a naked-eye 'V' across a full seven degrees of sky.",
      lo: [
        [
          "Ptolemy, Almagest (c. 138 AD); named for Queen Berenice's hair",
          "Ptolemy catalogued it as a hazy patch nearly two thousand years ago; its constellation, Coma Berenices, was later named for an Egyptian queen who is said to have sacrificed her hair as an offering.",
        ],
      ],
    },
    "cluster-alpha-persei": {
      f: "A loose, young association of stars sharing the same slow drift through space — close enough, and bright enough, that several members are visible to the naked eye without a telescope at all.",
      lo: [
        [
          "Perseus Moving Group kinematic studies",
          "The cluster's stars share a common proper motion against the more distant background — the same 'moving cluster' signature that reveals a shared birthplace and a shared age of roughly 50-60 million years.",
        ],
      ],
    },
    "cluster-eagle-nebula": {
      f: "A young cluster of hot, massive stars whose combined starlight and stellar winds carved the towering gas columns made famous by Hubble's 1995 'Pillars of Creation' image.",
      lo: [
        [
          "NASA/ESA Hubble Space Telescope (1995)",
          "The cluster's O-type stars ionize the surrounding hydrogen and push its gas outward like a slow-motion sandblast — the same process still sculpting the pillars today.",
        ],
      ],
    },
    "cluster-lagoon-nebula": {
      f: "A cluster barely two million years old, still embedded in the glowing gas it was born from — its brightest member, the young star Herschel 36, single-handedly lights up the nebula's famous 'Hourglass' region.",
      lo: [
        [
          "Infrared studies of the Hourglass region (M8)",
          "Herschel 36's fierce ultraviolet light carves a bipolar cavity into the surrounding cloud — the small, bright 'Hourglass' knot visible near the nebula's brightest patch.",
        ],
      ],
    },
    "cluster-little-beehive": {
      f: "A loose, bright cluster easily visible to the naked eye — and, by some accounts, one of the very few deep-sky objects noted in writing before the telescope even existed.",
      lo: [
        [
          "Attributed to Aristotle, c. 325 BC",
          "Aristotle is credited with noting this cluster as one of the ancient world's 'cloudy spots' in the sky — nearly two thousand years before Hodierna's telescope confirmed it as true stars.",
        ],
      ],
    },
    "cluster-shoe-buckle": {
      f: "A rich, young cluster in Gemini — and a lesson in cosmic perspective: right beside it in the same field of view sits a second, much older cluster that only looks like a near neighbor.",
      lo: [
        [
          "Comparative open-cluster studies (M35 / NGC 2158)",
          "NGC 2158, visible in the same telescope field, is roughly four times farther away and over ten times older — two unrelated clusters that happen to share a sightline, not a birthplace.",
        ],
      ],
    },
    "cluster-tau-canis-majoris": {
      f: "One of the youngest open clusters known — barely 4-5 million years old, still tightly bound around the brilliant blue supergiant that gives it its name.",
      lo: [
        [
          "Stellar population studies of NGC 2362",
          "The cluster's stars have already stopped forming and cleared away their birth gas, yet remain unusually tightly packed for their age — a snapshot of a cluster caught early, before it has had time to drift apart.",
        ],
      ],
    },
    "cluster-omicron-velorum": {
      f: "One of the brightest and largest open clusters in the southern sky — close enough, at just a few hundred light-years, to rank among the nearest young star clusters to Earth.",
      lo: [
        [
          "Lithium-depletion age studies (IC 2391 / IC 2602)",
          "Alongside its southern-hemisphere neighbor IC 2602, this cluster shares an age of roughly 50 million years, measured from how far its young stars have burned through their surface lithium.",
        ],
      ],
    },
    "cluster-rosette": {
      f: "The young star cluster responsible for the Rosette Nebula's glow — its hottest, most massive stars carve a central cavity in the surrounding gas and light it up from the inside.",
      lo: [
        [
          "O-star wind/ionization studies of NGC 2244",
          "Two of the cluster's most massive stars drive stellar winds roughly a hundred times more powerful than their already-formidable neighbors, hollowing out the nebula's dark central bubble.",
        ],
      ],
    },
    "cluster-47-tucanae": {
      f: "The second-brightest globular cluster in the entire sky, outshone only by Omega Centauri — bright enough to see with the naked eye from southern latitudes as a fuzzy, unmistakable star.",
      lo: [
        [
          "Radio pulsar surveys of 47 Tucanae",
          "The cluster's dense core hosts at least 25 millisecond pulsars — the second-largest such population known in any globular cluster, after Terzan 5.",
        ],
      ],
    },
    "cluster-m22": {
      f: "One of the closest bright globular clusters to Earth, and host to one of the rarest objects known inside any globular: a planetary nebula, the glowing shell of a star's final breath.",
      lo: [
        [
          "GJJC1 planetary nebula, discovered via IRAS (1986)",
          "Only four globular clusters in the entire galaxy are known to contain a planetary nebula — M22's, cataloged GJJC1, is thought to be a mere ~6,000 years old, an eyeblink in cosmic time.",
        ],
      ],
    },
    "cluster-m3": {
      f: "Charles Messier's first wholly original discovery — not a re-observation of someone else's comet-like sighting, but a genuinely new find that helped spur his systematic survey of the sky.",
      lo: [
        [
          "Variable-star surveys of M3 (multiple, 20th-21st century)",
          "M3 hosts more known variable stars than any other Milky Way globular cluster — over 270 in modern counts, more than 100 of them RR Lyrae 'standard candles' used to measure cosmic distances.",
        ],
      ],
    },
    "cluster-m5": {
      f: "First noticed in 1702 by a husband-and-wife team of astronomers who mistook it for a comet — it would be another 89 years before anyone resolved it into individual stars.",
      lo: [
        [
          "Gottfried & Maria Kirch (1702); William Herschel (1791)",
          "The Kirches logged it as a 'nebulous star' while tracking an actual comet; William Herschel finally resolved it into hundreds of individual points of light nearly a century later.",
        ],
      ],
    },
    "cluster-m15": {
      f: "One of the most tightly packed globular clusters known — its core has undergone a slow gravitational collapse over billions of years, crushing its stars into an extraordinarily dense center.",
      lo: [
        [
          "Francis Pease (1928); Hubble Space Telescope black hole studies",
          "M15 hosts Pease 1, the first planetary nebula ever found inside a globular cluster (1928) — and modern observations suggest an intermediate-mass black hole may be lurking in its collapsed core.",
        ],
      ],
    },
    "cluster-ngc6752": {
      f: "A dense, core-collapsed globular whose crowded center is a stellar demolition derby — packed tightly enough that up to a third of its core stars are locked in binary pairs.",
      lo: [
        [
          "Millisecond pulsar timing studies of NGC 6752",
          "Decades of radio timing on the cluster's millisecond pulsars have turned its core into one of the best-measured stellar environments in the galaxy, tracking hidden mass astronomers can't see directly.",
        ],
      ],
    },
    "cluster-m2": {
      f: "One of the largest known globular clusters — a dense, distinctly elliptical swarm of roughly 150,000 stars, first mistaken for a comet's glow.",
      lo: [
        [
          "Jean-Dominique Maraldi (1746); William Herschel",
          "Maraldi found it while hunting an actual comet in 1746 and logged it only as a 'nebulous star'; it took William Herschel's larger telescope to finally resolve it into the true star cluster it is.",
        ],
      ],
    },
  };

  var list = window.CELESTIAL || [];
  var byId = {};
  list.forEach(function (e) {
    byId[e.id] = e;
  });

  var appliedCount = 0;
  Object.keys(OVERRIDES).forEach(function (id) {
    var entry = byId[id];
    // Override-only: an id with no existing catalog entry is skipped, never used to
    // fabricate a phantom body (CLAUDE.md #22's spirit — see the header note).
    if (!entry) return;
    var patch = OVERRIDES[id];
    if (patch.f !== undefined) entry.f = patch.f;
    if (patch.lo !== undefined) entry.lo = patch.lo;
    appliedCount++;
  });
  window.CELESTIAL_CONTENT_OVERLAY_APPLIED = appliedCount;
})();

export {};
