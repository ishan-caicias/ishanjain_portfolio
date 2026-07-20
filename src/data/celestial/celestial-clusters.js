/* celestial-clusters.js — PF-10 C1: curated star-cluster "hall of fame" dossier set.
   35 real star clusters (22 open, 13 globular) — hand-verified against modern literature after
   an Astra realism review (see docs/analysis/2026-07-20-star-cluster-hall-of-fame-realism-review.md),
   validating the owner's original 31-cluster list and adding 4 more (M67, NGC 6397, NGC 2244,
   M2). Full sourcing, schema notes, and the data-vintage rationale (why these are hand-verified
   modern values rather than a raw pipeline pull from the 2013-vintage local MWSC catalog) live
   in docs/datasets/star_clusters_hall_of_fame.md — this file is the literal copy-paste of its
   two JSON blocks (mg stringified to match CelestialEntry's mg:string contract; everything else
   unchanged). 10/35 entries have real flavour/lore text (Astra-authored); the remaining 25 carry
   an explicit [[TODO: content pass]] marker rather than fabricated content — see that doc.
   Generated 2026-07-20 by hand from the reviewed markdown, not by scripts/gaia-dataset-pipeline.mjs
   (these are hand-corrected values, not raw MWSC/Hunt-Reffert decodes — see the review doc). */
(function () {
  var G = [
 {
  "id": "cluster-pleiades",
  "n": "Pleiades",
  "d": "M45 · Melotte 22 · open cluster · Taurus",
  "t": "cluster",
  "r": "rare",
  "ra": 56.75,
  "dec": 24.12,
  "ly": 444,
  "mg": "1.6",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Taurus",
  "st": [
   [
    "Distance",
    "444 ly (136.2 pc)",
    0.09
   ],
   [
    "Age",
    "~115 Myr",
    0.03
   ],
   [
    "Apparent magnitude",
    "1.6",
    0.9
   ]
  ],
  "f": "The most famous star cluster in the sky — ~1,000 stars born together ~115 million years ago, still close enough to share the same birth motion through the galaxy. The haze around the brightest stars isn't leftover birth gas; it's an unrelated dust cloud the cluster happens to be passing through right now.",
  "lo": [
   [
    "Gaia mission (ESA)",
    "Gaia's parallax measurements pin the Pleiades at 136.2 parsecs (444 light-years), settling a decades-long distance dispute with pre-Gaia estimates."
   ]
  ]
 },
 {
  "id": "cluster-hyades",
  "n": "Hyades",
  "d": "Melotte 25 · open cluster · Taurus",
  "t": "cluster",
  "r": "rare",
  "ra": 66.75,
  "dec": 15.87,
  "ly": 153,
  "mg": "0.5",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Taurus",
  "st": [
   [
    "Distance",
    "153 ly (47 pc) — nearest bright open cluster to Earth",
    0.03
   ],
   [
    "Age",
    "~625 Myr",
    0.16
   ],
   [
    "Apparent magnitude",
    "0.5",
    1
   ]
  ],
  "f": "The nearest bright open cluster to Earth, close enough that its stars' shared motion visibly converges toward a point in the sky — the effect 19th-century astronomers used to measure stellar distances for the first time.",
  "lo": [
   [
    "Hipparcos Catalogue (ESA, 1997)",
    "The 'moving cluster method' applied to the Hyades gave one of the first rungs of the cosmic distance ladder, calibrating how bright a star of a given type really is."
   ]
  ]
 },
 {
  "id": "cluster-beehive",
  "n": "Beehive Cluster",
  "d": "Praesepe · M44 · NGC 2632 · open cluster · Cancer",
  "t": "cluster",
  "r": "rare",
  "ra": 130.1,
  "dec": 19.67,
  "ly": 577,
  "mg": "3.1",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Cancer",
  "st": [
   [
    "Distance",
    "577 ly (177 pc)",
    0.12
   ],
   [
    "Age",
    "~600 Myr",
    0.15
   ],
   [
    "Apparent magnitude",
    "3.1",
    0.62
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-ptolemy",
  "n": "Ptolemy Cluster",
  "d": "M7 · NGC 6475 · open cluster · Scorpius",
  "t": "cluster",
  "r": "rare",
  "ra": 268.46,
  "dec": -34.79,
  "ly": 980,
  "mg": "3.3",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Scorpius",
  "st": [
   [
    "Distance",
    "980 ly (300 pc)",
    0.2
   ],
   [
    "Age",
    "~200 Myr",
    0.05
   ],
   [
    "Apparent magnitude",
    "3.3",
    0.58
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-wild-duck",
  "n": "Wild Duck Cluster",
  "d": "M11 · NGC 6705 · open cluster · Scutum",
  "t": "cluster",
  "r": "rare",
  "ra": 282.77,
  "dec": -6.27,
  "ly": 6200,
  "mg": "5.8",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Scutum",
  "st": [
   [
    "Distance",
    "6,200 ly (1,900 pc)",
    1
   ],
   [
    "Age",
    "~250 Myr",
    0.06
   ],
   [
    "Apparent magnitude",
    "5.8",
    0.28
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-jewel-box",
  "n": "Jewel Box",
  "d": "Kappa Crucis · NGC 4755 · open cluster · Crux",
  "t": "cluster",
  "r": "rare",
  "ra": 193.42,
  "dec": -60.35,
  "ly": 6440,
  "mg": "4.2",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Crux",
  "st": [
   [
    "Distance",
    "6,440 ly (1,975 pc)",
    1
   ],
   [
    "Age",
    "~14 Myr",
    0.003
   ],
   [
    "Apparent magnitude",
    "4.2",
    0.42
   ]
  ],
  "f": "A young cluster whose few dozen stars span the full range of stellar color — blazing blue supergiants beside one striking red supergiant — a contrast vivid enough that John Herschel named it for its gem-like appearance in 1834.",
  "lo": [
   [
    "John Herschel, Cape of Good Hope observations (1834)",
    "The cluster's mixed young population (~14 Myr) makes it a textbook case for massive-star evolution timescales."
   ]
  ]
 },
 {
  "id": "cluster-trapezium",
  "n": "Orion Nebula Cluster",
  "d": "Trapezium · M42 core · open cluster (embedded) · Orion — hand-authored, not catalog-decodable",
  "t": "cluster",
  "r": "rare",
  "ra": 83.82,
  "dec": -5.39,
  "ly": 1344,
  "mg": "4",
  "sp": "Open cluster (embedded)",
  "img": null,
  "c": "#aeeaff",
  "con": "Orion",
  "st": [
   [
    "Distance",
    "1,344 ly (412 pc) — matches this site's own Orion Nebula entry",
    0.27
   ],
   [
    "Age",
    "< 1 Myr",
    0
   ],
   [
    "Apparent magnitude",
    "~4 (M42 region)",
    0.4
   ]
  ],
  "f": "Barely a few hundred thousand years old — a cosmic infant. Four hot young stars at its core, the Trapezium, are still carving the nebula around them out of the gas cloud they were born from.",
  "lo": [
   [
    "Hubble Space Telescope",
    "The ONC's youngest members still show protoplanetary disks ('proplyds') directly imaged by Hubble — planetary systems caught in the act of forming."
   ]
  ]
 },
 {
  "id": "cluster-h-persei",
  "n": "Double Cluster (h Persei)",
  "d": "NGC 869 · open cluster · Perseus",
  "t": "cluster",
  "r": "rare",
  "ra": 34.74,
  "dec": 57.13,
  "ly": 7600,
  "mg": "3.7",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Perseus",
  "st": [
   [
    "Distance",
    "7,600 ly (2,330 pc)",
    1
   ],
   [
    "Age",
    "~14 Myr",
    0.003
   ],
   [
    "Apparent magnitude",
    "3.7",
    0.53
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-chi-persei",
  "n": "Double Cluster (χ Persei)",
  "d": "NGC 884 · open cluster · Perseus",
  "t": "cluster",
  "r": "rare",
  "ra": 35.51,
  "dec": 57.13,
  "ly": 7600,
  "mg": "3.8",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Perseus",
  "st": [
   [
    "Distance",
    "7,600 ly (2,330 pc)",
    1
   ],
   [
    "Age",
    "~14 Myr",
    0.003
   ],
   [
    "Apparent magnitude",
    "3.8",
    0.51
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-butterfly",
  "n": "Butterfly Cluster",
  "d": "M6 · NGC 6405 · open cluster · Scorpius",
  "t": "cluster",
  "r": "rare",
  "ra": 265.08,
  "dec": -32.24,
  "ly": 1600,
  "mg": "4.2",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Scorpius",
  "st": [
   [
    "Distance",
    "1,600 ly (490 pc)",
    0.33
   ],
   [
    "Age",
    "~95 Myr",
    0.02
   ],
   [
    "Apparent magnitude",
    "4.2",
    0.42
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-salt-and-pepper",
  "n": "Salt and Pepper Cluster",
  "d": "M37 · NGC 2099 · open cluster · Auriga",
  "t": "cluster",
  "r": "rare",
  "ra": 88.07,
  "dec": 32.55,
  "ly": 4500,
  "mg": "5.6",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Auriga",
  "st": [
   [
    "Distance",
    "4,500 ly (1,380 pc)",
    0.92
   ],
   [
    "Age",
    "~500 Myr",
    0.13
   ],
   [
    "Apparent magnitude",
    "5.6",
    0.3
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-wishing-well",
  "n": "Wishing Well Cluster",
  "d": "NGC 3532 · open cluster · Carina",
  "t": "cluster",
  "r": "rare",
  "ra": 166.42,
  "dec": -58.74,
  "ly": 1500,
  "mg": "3",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Carina",
  "st": [
   [
    "Distance",
    "1,500 ly (460 pc)",
    0.31
   ],
   [
    "Age",
    "~300 Myr",
    0.08
   ],
   [
    "Apparent magnitude",
    "3.0",
    0.6
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-carolines-rose",
  "n": "Caroline's Rose",
  "d": "NGC 7789 · open cluster · Cassiopeia",
  "t": "cluster",
  "r": "rare",
  "ra": 359.34,
  "dec": 56.73,
  "ly": 7600,
  "mg": "6.7",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Cassiopeia",
  "st": [
   [
    "Distance",
    "7,600 ly (2,330 pc)",
    1
   ],
   [
    "Age",
    "~1.6 Gyr",
    0.4
   ],
   [
    "Apparent magnitude",
    "6.7",
    0.16
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-coma",
  "n": "Coma Star Cluster",
  "d": "Melotte 111 · open cluster · Coma Berenices",
  "t": "cluster",
  "r": "rare",
  "ra": 185,
  "dec": 25.9,
  "ly": 280,
  "mg": "1.8",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Coma Berenices",
  "st": [
   [
    "Distance",
    "280 ly (86 pc)",
    0.06
   ],
   [
    "Age",
    "~500 Myr",
    0.13
   ],
   [
    "Apparent magnitude",
    "1.8",
    0.88
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-alpha-persei",
  "n": "Alpha Persei Cluster",
  "d": "Melotte 20 · Collinder 39 · open cluster · Perseus",
  "t": "cluster",
  "r": "rare",
  "ra": 51.5,
  "dec": 49,
  "ly": 590,
  "mg": "1.2",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Perseus",
  "st": [
   [
    "Distance",
    "590 ly (181 pc)",
    0.12
   ],
   [
    "Age",
    "~50 Myr",
    0.01
   ],
   [
    "Apparent magnitude",
    "1.2",
    0.95
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-eagle-nebula",
  "n": "Eagle Nebula Cluster",
  "d": "M16 · NGC 6611 · open cluster (embedded) · Serpens",
  "t": "cluster",
  "r": "rare",
  "ra": 274.7,
  "dec": -13.8,
  "ly": 5700,
  "mg": "6",
  "sp": "Open cluster (embedded)",
  "img": null,
  "c": "#aeeaff",
  "con": "Serpens",
  "st": [
   [
    "Distance",
    "~5,700 ly (1,750 pc); some modern estimates run to ~7,000 ly",
    1
   ],
   [
    "Age",
    "~1-2 Myr",
    0
   ],
   [
    "Apparent magnitude",
    "6.0",
    0.2
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-lagoon-nebula",
  "n": "Lagoon Nebula Cluster",
  "d": "NGC 6530 · open cluster (embedded) · Sagittarius",
  "t": "cluster",
  "r": "rare",
  "ra": 271.1,
  "dec": -24.34,
  "ly": 4300,
  "mg": "4.6",
  "sp": "Open cluster (embedded)",
  "img": null,
  "c": "#aeeaff",
  "con": "Sagittarius",
  "st": [
   [
    "Distance",
    "4,300 ly (1,320 pc)",
    0.88
   ],
   [
    "Age",
    "~2 Myr",
    0
   ],
   [
    "Apparent magnitude",
    "4.6",
    0.38
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-little-beehive",
  "n": "Little Beehive Cluster",
  "d": "M41 · NGC 2287 · open cluster · Canis Major",
  "t": "cluster",
  "r": "rare",
  "ra": 101.5,
  "dec": -20.75,
  "ly": 2300,
  "mg": "4.5",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Canis Major",
  "st": [
   [
    "Distance",
    "2,300 ly (710 pc)",
    0.47
   ],
   [
    "Age",
    "~190 Myr",
    0.05
   ],
   [
    "Apparent magnitude",
    "4.5",
    0.4
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-shoe-buckle",
  "n": "Shoe-Buckle Cluster",
  "d": "M35 · NGC 2168 · open cluster · Gemini",
  "t": "cluster",
  "r": "rare",
  "ra": 92.27,
  "dec": 24.35,
  "ly": 2800,
  "mg": "5.1",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Gemini",
  "st": [
   [
    "Distance",
    "2,800 ly (860 pc)",
    0.57
   ],
   [
    "Age",
    "~150 Myr",
    0.04
   ],
   [
    "Apparent magnitude",
    "5.1",
    0.34
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-tau-canis-majoris",
  "n": "Tau Canis Majoris Cluster",
  "d": "NGC 2362 · Caldwell 64 · open cluster · Canis Major",
  "t": "cluster",
  "r": "rare",
  "ra": 109.63,
  "dec": -24.95,
  "ly": 4800,
  "mg": "4.1",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Canis Major",
  "st": [
   [
    "Distance",
    "4,800 ly (1,480 pc)",
    0.98
   ],
   [
    "Age",
    "~4-5 Myr",
    0.001
   ],
   [
    "Apparent magnitude",
    "4.1",
    0.44
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-omicron-velorum",
  "n": "Omicron Velorum Cluster",
  "d": "IC 2391 · Caldwell 85 · open cluster · Vela",
  "t": "cluster",
  "r": "rare",
  "ra": 130.13,
  "dec": -52.98,
  "ly": 500,
  "mg": "2.5",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Vela",
  "st": [
   [
    "Distance",
    "500 ly (153 pc)",
    0.1
   ],
   [
    "Age",
    "~50 Myr",
    0.01
   ],
   [
    "Apparent magnitude",
    "2.5",
    0.72
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m67",
  "n": "Messier 67",
  "d": "NGC 2682 · open cluster · Cancer — added 2026-07-20",
  "t": "cluster",
  "r": "rare",
  "ra": 132.85,
  "dec": 11.81,
  "ly": 2800,
  "mg": "6.1",
  "sp": "Open cluster",
  "img": null,
  "c": "#aeeaff",
  "con": "Cancer",
  "st": [
   [
    "Distance",
    "2,800 ly (860 pc)",
    0.57
   ],
   [
    "Age",
    "~4 Gyr — unusually old for an open cluster",
    1
   ],
   [
    "Apparent magnitude",
    "6.1",
    0.18
   ]
  ],
  "f": "An unusually old survivor — most open clusters disperse within a few hundred million years, but M67 has held together for roughly 4 billion years, nearly the Sun's own age.",
  "lo": [
   [
    "Solar-analog and exoplanet research",
    "Because its member stars share age and composition with the Sun, M67 is a standing laboratory for 'solar twin' research — several of its stars host confirmed exoplanets."
   ]
  ]
 },
 {
  "id": "cluster-rosette",
  "n": "Rosette Nebula Cluster",
  "d": "NGC 2244 · open cluster (embedded) · Monoceros — added 2026-07-20",
  "t": "cluster",
  "r": "rare",
  "ra": 98,
  "dec": 4.95,
  "ly": 5200,
  "mg": "4.8",
  "sp": "Open cluster (embedded)",
  "img": null,
  "c": "#aeeaff",
  "con": "Monoceros",
  "st": [
   [
    "Distance",
    "5,200 ly (1,600 pc)",
    1
   ],
   [
    "Age",
    "~4 Myr",
    0.001
   ],
   [
    "Apparent magnitude",
    "4.8",
    0.36
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-omega-centauri",
  "n": "Omega Centauri",
  "d": "NGC 5139 · Caldwell 80 · globular cluster · Centaurus",
  "t": "cluster",
  "r": "rare",
  "ra": 201.7,
  "dec": -47.48,
  "ly": 17000,
  "mg": "3.9",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Centaurus",
  "st": [
   [
    "Distance",
    "17,000 ly (5,200 pc)",
    1
   ],
   [
    "Age",
    "~11.5 Gyr",
    0.83
   ],
   [
    "Apparent magnitude",
    "3.9",
    0.46
   ]
  ],
  "f": "The Milky Way's largest and brightest globular cluster by a wide margin — so large, and with such a complex mix of stellar populations, that many astronomers think it isn't a true globular at all, but the stripped-bare core of a dwarf galaxy the Milky Way consumed long ago.",
  "lo": [
   [
    "Multi-population studies (multiple ages/metallicities within one cluster)",
    "Unlike a normal single-generation globular, Omega Centauri's mixed stellar populations are the key evidence for the cannibalized-dwarf-galaxy hypothesis."
   ]
  ]
 },
 {
  "id": "cluster-m13",
  "n": "Great Hercules Cluster",
  "d": "M13 · NGC 6205 · globular cluster · Hercules",
  "t": "cluster",
  "r": "rare",
  "ra": 250.42,
  "dec": 36.46,
  "ly": 22200,
  "mg": "5.8",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Hercules",
  "st": [
   [
    "Distance",
    "22,200 ly (6,800 pc)",
    1
   ],
   [
    "Age",
    "~11.65 Gyr",
    0.84
   ],
   [
    "Apparent magnitude",
    "5.8",
    0.28
   ]
  ],
  "f": "One of the brightest globulars visible from northern latitudes, home to several hundred thousand stars in a ball roughly 145 light-years across.",
  "lo": [
   [
    "Arecibo Observatory, 1974",
    "Humanity's first deliberate interstellar radio message was aimed at M13. By the time it could arrive, the cluster will have moved from where the signal was pointed — a fact its senders knew."
   ]
  ]
 },
 {
  "id": "cluster-47-tucanae",
  "n": "47 Tucanae",
  "d": "NGC 104 · Caldwell 106 · globular cluster · Tucana",
  "t": "cluster",
  "r": "rare",
  "ra": 6.02,
  "dec": -72.08,
  "ly": 13000,
  "mg": "4.1",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Tucana",
  "st": [
   [
    "Distance",
    "13,000 ly (4,000 pc)",
    0.76
   ],
   [
    "Age",
    "~13 Gyr",
    0.94
   ],
   [
    "Apparent magnitude",
    "4.1",
    0.44
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m22",
  "n": "Sagittarius Cluster",
  "d": "M22 · NGC 6656 · globular cluster · Sagittarius",
  "t": "cluster",
  "r": "rare",
  "ra": 279.1,
  "dec": -23.9,
  "ly": 10600,
  "mg": "5.1",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Sagittarius",
  "st": [
   [
    "Distance",
    "10,600 ly (3,250 pc)",
    0.62
   ],
   [
    "Age",
    "~12 Gyr",
    0.87
   ],
   [
    "Apparent magnitude",
    "5.1",
    0.34
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m3",
  "n": "Messier 3",
  "d": "NGC 5272 · globular cluster · Canes Venatici",
  "t": "cluster",
  "r": "rare",
  "ra": 205.55,
  "dec": 28.38,
  "ly": 33900,
  "mg": "6.2",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Canes Venatici",
  "st": [
   [
    "Distance",
    "33,900 ly (10,400 pc)",
    1
   ],
   [
    "Age",
    "~11.4 Gyr",
    0.83
   ],
   [
    "Apparent magnitude",
    "6.2",
    0.24
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m5",
  "n": "Rose Cluster",
  "d": "M5 · NGC 5904 · globular cluster · Serpens",
  "t": "cluster",
  "r": "rare",
  "ra": 229.64,
  "dec": 2.08,
  "ly": 24500,
  "mg": "5.6",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Serpens",
  "st": [
   [
    "Distance",
    "24,500 ly (7,500 pc)",
    1
   ],
   [
    "Age",
    "~11-13 Gyr — among the oldest known globulars",
    0.87
   ],
   [
    "Apparent magnitude",
    "5.6",
    0.3
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m15",
  "n": "Great Pegasus Cluster",
  "d": "M15 · NGC 7078 · globular cluster · Pegasus",
  "t": "cluster",
  "r": "rare",
  "ra": 322.49,
  "dec": 12.17,
  "ly": 33600,
  "mg": "6.2",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Pegasus",
  "st": [
   [
    "Distance",
    "33,600 ly (10,300 pc)",
    1
   ],
   [
    "Age",
    "~12 Gyr",
    0.87
   ],
   [
    "Apparent magnitude",
    "6.2",
    0.24
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-m92",
  "n": "Messier 92",
  "d": "NGC 6341 · globular cluster · Hercules",
  "t": "cluster",
  "r": "rare",
  "ra": 259.28,
  "dec": 43.14,
  "ly": 26700,
  "mg": "6.4",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Hercules",
  "st": [
   [
    "Distance",
    "26,700 ly (8,200 pc)",
    1
   ],
   [
    "Age",
    "Among the oldest known clusters in the galaxy",
    1
   ],
   [
    "Apparent magnitude",
    "6.4",
    0.22
   ]
  ],
  "f": "Among the oldest known star clusters in the Milky Way — its age estimate brushes right up against the age of the universe itself, a snapshot of the galaxy's very first generation of star formation.",
  "lo": [
   [
    "Comparative globular-cluster age studies",
    "Often overshadowed by its neighbor M13 in the same constellation, M92 is in most respects the more scientifically extreme object — older, and one of the more metal-poor globulars known."
   ]
  ]
 },
 {
  "id": "cluster-m4",
  "n": "Messier 4",
  "d": "NGC 6121 · globular cluster · Scorpius",
  "t": "cluster",
  "r": "rare",
  "ra": 245.9,
  "dec": -26.53,
  "ly": 7200,
  "mg": "5.6",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Scorpius",
  "st": [
   [
    "Distance",
    "7,200 ly (2,200 pc) — one of the two closest globulars to Earth",
    0.42
   ],
   [
    "Age",
    "~12.2 Gyr",
    0.88
   ],
   [
    "Apparent magnitude",
    "5.6",
    0.3
   ]
  ],
  "f": "One of the two nearest globular clusters to Earth, easily found beside the bright red star Antares. Buried in its core are some of the oldest white dwarfs known — stellar embers used to independently clock the age of the universe.",
  "lo": [
   [
    "Hubble Space Telescope white-dwarf cooling-sequence study",
    "M4's oldest white dwarfs gave an age estimate for the cluster consistent with, and independent of, cosmological measurements of the universe's age."
   ]
  ]
 },
 {
  "id": "cluster-ngc6752",
  "n": "Peacock Globular",
  "d": "NGC 6752 · Caldwell 93 · globular cluster · Pavo",
  "t": "cluster",
  "r": "rare",
  "ra": 287.72,
  "dec": -59.98,
  "ly": 13000,
  "mg": "5.4",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Pavo",
  "st": [
   [
    "Distance",
    "13,000 ly (4,000 pc)",
    0.76
   ],
   [
    "Age",
    "~11.7 Gyr",
    0.85
   ],
   [
    "Apparent magnitude",
    "5.4",
    0.32
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 },
 {
  "id": "cluster-ngc6397",
  "n": "NGC 6397",
  "d": "globular cluster · Ara — added 2026-07-20",
  "t": "cluster",
  "r": "rare",
  "ra": 265.18,
  "dec": -53.67,
  "ly": 7800,
  "mg": "5.3",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Ara",
  "st": [
   [
    "Distance",
    "7,800 ly (2,390 pc) — the other of the two closest globulars to Earth, paired with M4",
    0.46
   ],
   [
    "Age",
    "~13.5 Gyr, core-collapsed",
    0.98
   ],
   [
    "Apparent magnitude",
    "5.3",
    0.32
   ]
  ],
  "f": "M4's closer twin — the other nearest globular cluster to Earth, and a 'core-collapsed' cluster whose center has crushed down into an extraordinarily dense stellar core over billions of years.",
  "lo": [
   [
    "Hubble Space Telescope Advanced Camera for Surveys deep field",
    "Resolved NGC 6397's white dwarf cooling sequence down to the faintest, oldest members — one of the deepest stellar photometry studies ever performed."
   ]
  ]
 },
 {
  "id": "cluster-m2",
  "n": "Messier 2",
  "d": "NGC 7089 · globular cluster · Aquarius — added 2026-07-20",
  "t": "cluster",
  "r": "rare",
  "ra": 323.36,
  "dec": -0.82,
  "ly": 37500,
  "mg": "6.3",
  "sp": "Globular cluster",
  "img": null,
  "c": "#ffd699",
  "con": "Aquarius",
  "st": [
   [
    "Distance",
    "37,500 ly (11,500 pc)",
    1
   ],
   [
    "Age",
    "~13 Gyr",
    0.94
   ],
   [
    "Apparent magnitude",
    "6.3",
    0.24
   ],
   [
    "Notable",
    "One of the largest known globular clusters",
    1
   ]
  ],
  "f": "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]",
  "lo": [
   [
    "",
    "[[TODO: content pass — deferred by owner until the portfolio is functionally ready, 2026-07-20]]"
   ]
  ]
 }
];
  var have = {};
  (window.CELESTIAL || []).forEach(function (e) { have[e.id] = 1; });
  window.CELESTIAL = (window.CELESTIAL || []).concat(G.filter(function (e) { return !have[e.id]; }));
  window.CELESTIAL_CLUSTERS_COUNT = G.length;
})();

export {};
