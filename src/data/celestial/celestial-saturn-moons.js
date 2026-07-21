/* celestial-saturn-moons.js — PF-10 C4 closeout: Tethys, Dione and Rhea as real travel destinations.
 *
 * WHY THESE THREE, AND WHY NOW. C4's texture pipeline built real surface and real pre-baked normal
 * maps for them, and then nobody could reach them: they had no catalog entry, so 17.5 MB of real
 * imagery could never render. Found by live validation against a running preview server, not by any
 * test — "the source pack has imagery for this body" is not the same claim as "this body exists in
 * the scene", and nothing connected the two. `tests/unit/planet-asset-pipeline.test.ts` now asserts
 * the link.
 *
 * POSITIONS ARE A DECLARED LICENCE, AND ASTRA MEASURED EXACTLY HOW BIG A ONE (2026-07-22 addendum
 * to the Earth sphere brief). Real maximum elongation from Saturn as seen from Earth at opposition
 * is Tethys 47.6", Dione 61.0", Rhea 85.1" — the entire inner Saturnian system fits inside 0.11
 * degrees, against Saturn's own 9.7" disc. At this scene's `bodyDepth` of 172.54, Tethys's real
 * separation is 0.040 WORLD UNITS from a sphere of radius 26: one pixel, and unpickable.
 *
 * So the offsets below are a visual spread, not real astrometry — and that is a deliberate,
 * recorded choice rather than an oversight. TR-065's "compute the real position" argument
 * DOES NOT TRANSFER here, and the distinction is worth keeping: a heliocentric minor planet's true
 * position is computable AND visually meaningful; a close satellite's is computable AND visually
 * meaningless. What IS preserved is the real ORDERING — 0.758 / 0.820 / 0.882 degrees ranks them by
 * true orbital radius (294,619 / 377,396 / 527,108 km), and the set is bracketed by the already-
 * shipped Enceladus (0.685) and Titan (0.926) so the Saturn system stays internally consistent.
 *
 * Colours are tied to real measured geometric albedo (Tethys 1.229, Dione 0.998, Rhea 0.949 —
 * Verbiscer et al. 2007), not picked. Astra specifically ruled out Callisto's `#9fa8da`: that token
 * belongs to a body with p = 0.17, and these are 5.6-7.2x more reflective.
 */
(function () {
  var G = [
    {
      id: "tethys",
      n: "Tethys",
      d: "Saturn III",
      t: "moon",
      r: "uncommon",
      ra: 285.5,
      dec: -22.6,
      ly: 0.0000158,
      mg: "10.2",
      sp: "Near-pure ice moon",
      img: "assets/planets/tethys.jpg",
      c: "#e8eaf6",
      con: "—",
      st: [
        ["Parent", "Saturn", 0.5],
        ["Radius", "531 km", 0.04],
        ["Orbital period", "1.888 days", 0.02],
        ["Density", "0.98 g/cm³ · almost pure ice", 0.1],
        ["Geometric albedo", "1.23 · brighter than white", 1],
        ["Odysseus crater", "400 km · 2/5 of its diameter", 0.95],
      ],
      f: "Tethys reflects more light than a perfect white surface — its albedo is above 1.0, because fresh E-ring ice and a backscattering regolith send sunlight straight back where it came from.",
      lo: [
        [
          "Greek",
          "The Titaness of fresh water, sister and wife of Oceanus — mother of the world's rivers and of three thousand ocean nymphs.",
        ],
        [
          "Cassini, 1684",
          "Giovanni Cassini found Tethys and Dione in the same year, using aerial telescopes with focal lengths of 30 metres and no tube at all — the objective hung from a mast.",
        ],
      ],
    },
    {
      id: "dione",
      n: "Dione",
      d: "Saturn IV",
      t: "moon",
      r: "uncommon",
      ra: 284.3,
      dec: -21.5,
      ly: 0.0000158,
      mg: "10.4",
      sp: "Ice-cliff moon",
      img: "assets/planets/dione.jpg",
      c: "#dfe3f4",
      con: "—",
      st: [
        ["Parent", "Saturn", 0.5],
        ["Radius", "561 km", 0.05],
        ["Orbital period", "2.737 days", 0.03],
        ["Density", "1.48 g/cm³ · rock-rich core", 0.2],
        ["Geometric albedo", "1.00", 0.9],
        ["Ice cliffs", "Hundreds of metres high", 0.7],
      ],
      f: "Dione's bright 'wispy terrain' was assumed for decades to be frost streaks. Cassini flew close enough to resolve them and they turned out to be cliffs — a tectonic fracture network hundreds of metres tall, seen edge-on.",
      lo: [
        [
          "Greek",
          "A Titaness whose name is simply the feminine of Zeus. In Homer she is Aphrodite's mother — an older tradition than the one where Aphrodite rises from the sea.",
        ],
        [
          "Cassini, 1684",
          "Discovered alongside Tethys; Cassini named the pair, with Iapetus and Rhea, the 'Sidera Lodoicea' — Louis XIV's stars.",
        ],
      ],
    },
    {
      id: "rhea",
      n: "Rhea",
      d: "Saturn V",
      t: "moon",
      r: "rare",
      ra: 285.4,
      dec: -21.2,
      ly: 0.0000158,
      mg: "9.7",
      sp: "Icy moon · O₂ exosphere",
      img: "assets/planets/rhea.jpg",
      c: "#c5cae9",
      con: "—",
      st: [
        ["Parent", "Saturn", 0.5],
        ["Radius", "764 km · 2nd largest", 0.07],
        ["Orbital period", "4.518 days", 0.05],
        ["Density", "1.24 g/cm³", 0.15],
        ["Geometric albedo", "0.95", 0.85],
        ["Exosphere", "O₂ + CO₂ · detected 2010", 0.8],
      ],
      f: "Rhea has a thin oxygen atmosphere — the first ever detected directly around a moon. It is not biological: Saturn's magnetosphere sputters the surface ice apart, and the oxygen it frees lingers.",
      lo: [
        [
          "Greek",
          "The Titaness who hid the infant Zeus from Cronus — and Cronus is Saturn. Rhea has been orbiting the husband she outwitted for four and a half billion years.",
        ],
        [
          "Cassini, 1672",
          "The first of Cassini's four Saturnian discoveries, and for two centuries the outermost known moon after Titan.",
        ],
      ],
    },
  ];
  var have = {};
  (window.CELESTIAL || []).forEach(function (e) {
    have[e.id] = 1;
  });
  window.CELESTIAL = (window.CELESTIAL || []).concat(
    G.filter(function (e) {
      return !have[e.id];
    }),
  );
  window.CELESTIAL_SATURNMOONS_COUNT = G.length;
})();

export {};
