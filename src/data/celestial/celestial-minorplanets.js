/* celestial-minorplanets.js — PF-10 C1: 4 real base-pack minor planets (Vesta, Ceres, Pallas, Hygiea), positioned from real Keplerian orbital elements (resources/gaia_datasets/default-data/orbits-asteroid.json) via Kepler's equation + a Meeus low-precision solar ephemeris for the Earth-relative view, snapshotted for 2026-07-20 (see scripts/gaia-minorplanet-position.mjs). Real content (Dawn mission, discovery history), not TODO markers — these are well-documented named bodies. */
(function () {
  var G = [
 {
  "id": "minorplanet-vesta",
  "n": "Vesta",
  "d": "4 Vesta · asteroid",
  "t": "dwarf",
  "r": "uncommon",
  "ra": 23.8416,
  "dec": 1.5014,
  "ly": 0.000033,
  "mg": "3.20",
  "sp": "Main-belt minor planet",
  "img": null,
  "c": "#9e9e9e",
  "con": "—",
  "st": [
   [
    "Diameter",
    "525.4 km",
    0.5254
   ],
   [
    "Distance (this snapshot)",
    "2.087 AU",
    0.4173558665225393
   ],
   [
    "Absolute magnitude",
    "3.20",
    0.6
   ]
  ],
  "f": "The second-most-massive asteroid in the belt and the brightest — occasionally visible to the naked eye. NASA's Dawn mission orbited it in 2011–2012, revealing a giant south-pole impact basin (Rheasilvia) that blew off roughly 1% of Vesta's volume and seeded a whole family of smaller asteroids and Earth-striking meteorites.",
  "lo": [
   [
    "NASA Dawn mission",
    "Dawn's 2011 arrival made Vesta the first protoplanet ever orbited by a spacecraft — its basalt-crusted surface shows it started differentiating into a layered body like Earth before growth stalled."
   ]
  ]
 },
 {
  "id": "minorplanet-ceres",
  "n": "Ceres",
  "d": "1 Ceres · dwarf planet",
  "t": "dwarf",
  "r": "uncommon",
  "ra": 80.4015,
  "dec": 21.3988,
  "ly": 0.0000551,
  "mg": "3.34",
  "sp": "Main-belt minor planet",
  "img": null,
  "c": "#8d8d8d",
  "con": "—",
  "st": [
   [
    "Diameter",
    "939.4 km",
    0.9394
   ],
   [
    "Distance (this snapshot)",
    "3.484 AU",
    0.696891887868678
   ],
   [
    "Absolute magnitude",
    "3.34",
    0.5825
   ]
  ],
  "f": "The largest object in the asteroid belt and the first asteroid ever discovered (Piazzi, 1801) — big enough for its own gravity to pull it into a sphere, which is why the IAU reclassifies it as a dwarf planet. Dawn found bright salt deposits (Occator crater) and evidence of a subsurface brine ocean, making Ceres one of the closer places in the solar system real liquid water may still exist.",
  "lo": [
   [
    "NASA Dawn mission",
    "Dawn orbited Ceres from 2015 until it ran out of fuel in 2018 — the first spacecraft to orbit two separate extraterrestrial bodies in one mission (Vesta, then Ceres)."
   ]
  ]
 },
 {
  "id": "minorplanet-pallas",
  "n": "Pallas",
  "d": "2 Pallas · asteroid",
  "t": "dwarf",
  "r": "uncommon",
  "ra": 21.2439,
  "dec": 2.6351,
  "ly": 0.00004238,
  "mg": "4.13",
  "sp": "Main-belt minor planet",
  "img": null,
  "c": "#a3a3a3",
  "con": "—",
  "st": [
   [
    "Diameter",
    "513 km",
    0.513
   ],
   [
    "Distance (this snapshot)",
    "2.68 AU",
    0.5360078030321749
   ],
   [
    "Absolute magnitude",
    "4.13",
    0.48375
   ]
  ],
  "f": "The third-most-massive body in the asteroid belt, and by far the most tilted — its orbit is inclined 34.8° to the ecliptic, unusually steep for a large main-belt object, which kept it from being visited by any spacecraft until ESA's Gaia-era orbit refinements and ground-based adaptive-optics imaging finally resolved its lumpy, cratered shape.",
  "lo": [
   [
    "Olbers, 1802",
    "Discovered a year after Ceres, Pallas briefly made astronomers suspect a whole \"missing planet\" had shattered into the asteroid belt — the leading theory of the early 1800s, since abandoned for a story of a planet that never finished forming."
   ]
  ]
 },
 {
  "id": "minorplanet-hygiea",
  "n": "Hygiea",
  "d": "10 Hygiea · asteroid",
  "t": "dwarf",
  "r": "uncommon",
  "ra": 124.0424,
  "dec": 18.73,
  "ly": 0.00006731,
  "mg": "5.43",
  "sp": "Main-belt minor planet",
  "img": null,
  "c": "#8a8a8a",
  "con": "—",
  "st": [
   [
    "Diameter",
    "434 km",
    0.434
   ],
   [
    "Distance (this snapshot)",
    "4.257 AU",
    0.8513085042865705
   ],
   [
    "Absolute magnitude",
    "5.43",
    0.32125000000000004
   ]
  ],
  "f": "The fourth-largest asteroid-belt body and, since 2019 VLT imaging showed it's very nearly a perfect sphere, a live candidate for dwarf-planet reclassification. It heads the Hygiea family — thousands of smaller asteroids from one collision roughly 2 billion years ago, the same kind of event Vesta's Rheasilvia basin recorded closer to home.",
  "lo": [
   [
    "VLT SPHERE imaging, 2019",
    "Adaptive-optics imaging resolved Hygiea's shape well enough to show it's nearly round with no single giant crater — surprising for the largest member of a collisional family, and still debated."
   ]
  ]
 }
];
  var have = {};
  (window.CELESTIAL || []).forEach(function (e) { have[e.id] = 1; });
  window.CELESTIAL = (window.CELESTIAL || []).concat(G.filter(function (e) { return !have[e.id]; }));
  window.CELESTIAL_MINORPLANETS_COUNT = G.length;
})();

export {};
