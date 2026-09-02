/* celestial-missing-moons.js — PF-11 D5.4: the missing-body audit (owner-scoped list: Mimas,
 * Iapetus, Phobos, Triton, Charon — Deimos was never named in that list and stays out of scope).
 *
 * All five were probed absent from the catalog before this file: no entry, no texture asset,
 * no atlas cell — confirmed by grep across every src/data/celestial/*.js file and the atlas
 * pipeline. Unlike C4's Tethys/Dione/Rhea (celestial-saturn-moons.js), none of the five has a
 * source surface image in resources/ either, so these ship WITHOUT a photograph (`img: null`,
 * the same honestly-non-photographic state dozens of already-shipped catalog entries carry) —
 * real astrometric/physical data and dossier text, not a texture. Adding real imagery for any
 * of these is future scope (a licensed source pack + atlas cells first), not this slice's.
 *
 * Facts below are drafted from standard public sources (NASA Solar System Exploration pages,
 * JPL Satellite Physical Parameters/Orbital Elements, Wikipedia infoboxes cross-checked against
 * them) per the D4.4 precedent — owner-approved generated drafts grounded in official sources,
 * not invented. Two real cross-source numeric discrepancies were found and resolved rather than
 * silently picking one: Mimas's albedo (NASA's own prose page rounds to "0.5"; the JPL/Wikipedia
 * scientific geometric-albedo figure is 0.962 — used here, matching how a photometric figure
 * should be sourced) and Charon's density (JPL's older table gives 1.853 g/cm³; the New
 * Horizons-refined value is ~1.70 g/cm³ — used here as the more current measurement).
 *
 * POSITIONS ARE A DECLARED LICENCE, same as celestial-saturn-moons.js: real angular separation
 * from a parent planet at this catalog's `ly` (solar-system) scale is sub-pixel and unpickable,
 * so offsets below are a visual spread, not real astrometry. For Mimas and Iapetus, the offset
 * MAGNITUDE preserves real orbital-radius rank against the already-shipped Saturn moons: Mimas
 * (185,540 km) sits below Enceladus (238,020 km, offset 0.685°) at offset 0.487°; Iapetus
 * (3,561,700 km — nearly 3x Titan's 1,221,870 km) sits above Titan (offset 0.926°) at offset
 * 1.292°. Phobos/Triton/Charon are each their planet's only catalogued moon (Deimos out of
 * scope, see above), so there is no sibling to rank against — offsets are modest and
 * non-colliding only. The angular formula (matching celestial-saturn-moons.js exactly):
 * offset_deg = sqrt((deltaRa_deg * cos(parent_dec_rad))^2 + deltaDec_deg^2).
 */
(function () {
  var G = [
    {
      id: "mimas",
      n: "Mimas",
      d: "Saturn I",
      t: "moon",
      r: "uncommon",
      ra: 285.35,
      dec: -22.35,
      ly: 0.0000158,
      mg: "12.9",
      sp: "Ice moon · Herschel crater",
      img: null,
      c: "#eceff1",
      con: "—",
      st: [
        ["Parent", "Saturn", 0.5],
        ["Radius", "198.2 km", 0.02],
        ["Orbital period", "0.942 days", 0.01],
        ["Density", "1.15 g/cm³", 0.12],
        ["Geometric albedo", "0.962 · near-pure ice", 0.95],
        ["Herschel crater", "139 km · 1/3 its diameter", 0.9],
      ],
      f: "Mimas's Herschel crater is so large — roughly a third of the moon's own diameter — that the impact nearly shattered it whole; unusual grooved terrain on the exact opposite side may be seismic shockwaves that converged there.",
      lo: [
        [
          "Greek",
          "One of the Gigantes born of Gaia, buried beneath Mount Etna after the war with the Olympians — Saturn's innermost classical moon, named for one of its most violent children.",
        ],
        [
          "Herschel, 1789",
          "William Herschel found Mimas and Enceladus within days of each other, using the largest telescope in the world at the time — his own 40-foot reflector.",
        ],
      ],
    },
    {
      id: "iapetus",
      n: "Iapetus",
      d: "Saturn VIII",
      t: "moon",
      r: "rare",
      ra: 286.0,
      dec: -21.1,
      ly: 0.0000158,
      mg: "10.2–11.9",
      sp: "Two-toned 'walnut' moon",
      img: null,
      c: "#8d6e63",
      con: "—",
      st: [
        ["Parent", "Saturn", 0.5],
        ["Radius", "735 km", 0.07],
        ["Orbital period", "79.33 days", 0.08],
        ["Density", "1.1 g/cm³", 0.1],
        ["Leading-hemisphere albedo", "0.03–0.05 · coal-dark", 0.05],
        ["Equatorial ridge", "Up to 20 km high", 0.85],
      ],
      f: "Iapetus wears two faces: one hemisphere as dark as coal, the other nearly as bright as snow. Thermal segregation drives it — dark material absorbs sunlight, the ice beneath sublimates and migrates to refreeze on the brighter side, deepening the contrast over eons.",
      lo: [
        [
          "Greek",
          "A Titan, father of Prometheus and Atlas. Cassini named this moon for him alongside Rhea, Tethys and Dione as Louis XIV's 'Sidera Lodoicea'.",
        ],
        [
          "Cassini, 1671",
          "Cassini could only ever see Iapetus on one side of Saturn, decades before anyone knew why — Voyager 2 finally resolved the two-tone surface in 1980.",
        ],
      ],
    },
    {
      id: "phobos",
      n: "Phobos",
      d: "Mars I",
      t: "moon",
      r: "rare",
      ra: 170.3,
      dec: 3.8,
      ly: 0.0000158,
      mg: "11.8",
      sp: "Doomed inner moon",
      img: null,
      c: "#6d6d6d",
      con: "—",
      st: [
        ["Parent", "Mars", 0.5],
        ["Mean radius", "11.1 km", 0.01],
        ["Orbital period", "0.319 days · 3× per Martian day", 0.01],
        ["Density", "1.86 g/cm³", 0.18],
        ["Geometric albedo", "0.071 · carbon-dark", 0.07],
        ["Stickney crater", "9 km · nearly half its width", 0.85],
      ],
      f: "Phobos orbits Mars faster than Mars itself rotates — it rises in the west and sets in the east twice a day. Tidal drag pulls it inward roughly 2 metres a century; in 30-50 million years it will crash into Mars or be torn apart into a ring.",
      lo: [
        [
          "Greek",
          "Phobos — 'Fear' — one of the twin sons Ares (Mars) brought into battle alongside his brother Deimos, 'Dread'.",
        ],
        [
          "Hall, 1877",
          "Asaph Hall found Phobos and Deimos within a week of each other at the US Naval Observatory, after nearly giving up the search.",
        ],
      ],
    },
    {
      id: "triton",
      n: "Triton",
      d: "Neptune I",
      t: "moon",
      r: "epic",
      ra: 355.4,
      dec: -3.7,
      ly: 0.0000158,
      mg: "13.5",
      sp: "Retrograde captured world",
      img: null,
      c: "#ffccbc",
      con: "—",
      st: [
        ["Parent", "Neptune", 0.5],
        ["Radius", "1,353 km", 0.13],
        ["Orbital period", "5.877 days · retrograde", 0.06],
        ["Density", "2.06 g/cm³", 0.2],
        ["Bond albedo", "0.76 · among the brightest moons", 0.75],
        ["Nitrogen geysers", "Plumes to ~8 km · active today", 0.8],
      ],
      f: "Triton is the only large moon in the solar system that orbits backwards against its planet's spin — the signature of a captured Kuiper Belt world, not one born alongside Neptune. Voyager 2 caught it venting nitrogen gas geysers in 1989, one of the only confirmed active surfaces beyond Earth at the time.",
      lo: [
        [
          "Greek",
          "A son of Poseidon (Neptune), a merman herald of the sea — a fitting name for the one moon here that arrived from somewhere else entirely.",
        ],
        [
          "Lassell, 1846",
          "William Lassell found Triton just 17 days after Neptune itself was discovered, using a telescope he built and cast the mirror for himself.",
        ],
      ],
    },
    {
      id: "charon",
      n: "Charon",
      d: "Pluto I",
      t: "moon",
      r: "epic",
      ra: 295.35,
      dec: -23.25,
      ly: 0.0000158,
      mg: "16.8",
      sp: "Binary dwarf-planet moon",
      img: null,
      c: "#a1887f",
      con: "—",
      st: [
        ["Parent", "Pluto", 0.5],
        ["Radius", "606 km · 51% of Pluto's", 0.06],
        ["Orbital period", "6.387 days · locked to Pluto's spin", 0.06],
        ["Density", "1.70 g/cm³", 0.17],
        ["Geometric albedo", "0.20–0.73 · varies by region", 0.4],
        ["Mordor Macula", "Reddish tholin cap at its north pole", 0.7],
      ],
      f: "Charon is so large relative to Pluto that the pair doesn't orbit one another so much as a shared point in open space above Pluto's surface — sometimes called a binary dwarf-planet system rather than a planet and its moon. Both bodies are mutually tidally locked, each forever showing the other the same face.",
      lo: [
        [
          "Greek",
          "The ferryman of the dead across the river Styx into the underworld ruled by Pluto/Hades — a moon named for the guide, orbiting the god of the dead himself.",
        ],
        [
          "Christy, 1978",
          "James Christy noticed a bump on photographic plates of Pluto that wouldn't stay still — the first hint Pluto had a moon at all, confirmed within months.",
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
  window.CELESTIAL_MISSINGMOONS_COUNT = G.length;
})();

export {};
