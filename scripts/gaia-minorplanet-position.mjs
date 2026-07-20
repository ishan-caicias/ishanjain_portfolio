#!/usr/bin/env node
/* gaia-minorplanet-position.mjs — PF-10 C1: base-pack minor planets (Vesta, Ceres, Pallas,
 * Hygiea) -> curated celestial-*.js entries, computed from REAL Keplerian orbital elements
 * rather than a fixed/eyeballed position.
 *
 * Source: resources/gaia_datasets/default-data/orbits-asteroid.json (Gaia Sky's own real
 * heliocentric orbital elements for these 4 named bodies — semi-major axis, eccentricity,
 * inclination, ascending node, argument of pericenter, mean anomaly, all at a stated JD epoch).
 * These bodies orbit the Sun (unlike the star catalog's effectively-fixed background), so unlike
 * a star's catalog ra/dec, their apparent position genuinely depends on WHEN you look — this
 * script propagates each body's mean anomaly from its real epoch to a stated target date via
 * Kepler's equation, then converts heliocentric ecliptic position to geocentric equatorial
 * ra/dec/distance the same way any observer on Earth would compute it: solve Kepler for the
 * asteroid, solve the low-precision solar position (Meeus, "Astronomical Algorithms" ch.25) for
 * Earth's own heliocentric position at the same instant, subtract, then rotate ecliptic ->
 * equatorial by the mean obliquity. This is the SAME real-data-only discipline as the VOTable/
 * FITS pipelines (TR-061/TR-063) — a snapshot for a stated real date, not a random point.
 *
 * Run: node scripts/gaia-minorplanet-position.mjs --date 2026-07-20 [--out path]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const AU_TO_LY = 1 / 63241.077;
const KM_TO_AU = 1 / 149597870.7;
const OBLIQUITY_DEG = 23.4393; // mean obliquity of the ecliptic, J2000 epoch (arcmin-level drift/century, ignored at this precision)
const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

/** Julian Date for a UTC calendar instant (proleptic Gregorian, valid for any date this script
 * is ever run against — no need for the historical Julian-calendar branch). */
function julianDate(dateUtc) {
  return dateUtc.getTime() / 86400000 + 2440587.5;
}

/** Low-precision geocentric apparent solar position (Meeus ch.25) -> Earth's own heliocentric
 * ecliptic position (opposite the Sun's geocentric direction, same distance). Arcminute-level
 * accuracy — real physics, not a placeholder, and sufficient for a snapshot display position. */
function earthHeliocentricEcliptic(jd) {
  const n = jd - 2451545.0;
  const Ldeg = norm360(280.46 + 0.9856474 * n);
  const gDeg = norm360(357.528 + 0.9856003 * n);
  const g = gDeg * D2R;
  const lambdaSunDeg = Ldeg + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g);
  const R = 1.00014 - 0.01671 * Math.cos(g) - 0.00014 * Math.cos(2 * g); // AU, Sun-Earth distance
  const lambdaEarth = (lambdaSunDeg + 180) * D2R; // Earth is opposite the Sun as seen from itself
  return [R * Math.cos(lambdaEarth), R * Math.sin(lambdaEarth), 0];
}

function norm360(deg) {
  return ((deg % 360) + 360) % 360;
}

/** Solve Kepler's equation M = E - e*sin(E) for eccentric anomaly E (radians), Newton-Raphson. */
function solveKepler(mRad, e) {
  let E = mRad;
  for (let i = 0; i < 30; i++) {
    const dE = (E - e * Math.sin(E) - mRad) / (1 - e * Math.cos(E));
    E -= dE;
    if (Math.abs(dE) < 1e-12) break;
  }
  return E;
}

/** Real Keplerian elements -> heliocentric ecliptic Cartesian position (AU) at `jd`. */
function heliocentricEcliptic(el, jd) {
  const aAu = el.semimajoraxis * KM_TO_AU;
  const meanMotionDegPerDay = 360 / el.period;
  const mDeg = norm360(el.meananomaly + meanMotionDegPerDay * (jd - el.epoch));
  const M = mDeg * D2R;
  const E = solveKepler(M, el.eccentricity);
  // Position in the orbital plane (perifocal frame)
  const xOrb = aAu * (Math.cos(E) - el.eccentricity);
  const yOrb = aAu * Math.sqrt(1 - el.eccentricity ** 2) * Math.sin(E);
  // Rotate perifocal -> ecliptic by argument of pericenter (w), inclination (i), ascending node (Om)
  const w = el.argofpericenter * D2R;
  const i = el.inclination * D2R;
  const Om = el.ascendingnode * D2R;
  const cosW = Math.cos(w),
    sinW = Math.sin(w);
  const cosI = Math.cos(i),
    sinI = Math.sin(i);
  const cosOm = Math.cos(Om),
    sinOm = Math.sin(Om);
  const xw = xOrb * cosW - yOrb * sinW;
  const yw = xOrb * sinW + yOrb * cosW;
  const xEcl = xw * cosOm - yw * cosI * sinOm;
  const yEcl = xw * sinOm + yw * cosI * cosOm;
  const zEcl = yw * sinI;
  return [xEcl, yEcl, zEcl];
}

function eclipticToEquatorial([x, y, z]) {
  const eps = OBLIQUITY_DEG * D2R;
  return [
    x,
    y * Math.cos(eps) - z * Math.sin(eps),
    y * Math.sin(eps) + z * Math.cos(eps),
  ];
}

function vecSub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function vecLen(v) {
  return Math.hypot(v[0], v[1], v[2]);
}

function equatorialToRaDec([x, y, z]) {
  const r = vecLen([x, y, z]);
  const dec = Math.asin(z / r) * R2D;
  let ra = Math.atan2(y, x) * R2D;
  if (ra < 0) ra += 360;
  return { ra, dec, distanceAu: r };
}

const BODIES = [
  {
    name: "Vesta",
    id: "minorplanet-vesta",
    designation: "4 Vesta · asteroid",
    color: "#9e9e9e",
    diameterKm: 525.4,
    absMag: 3.2,
    orbit: {
      period: 1325.85,
      epoch: 2455400.5,
      semimajoraxis: 353350171.0,
      eccentricity: 0.08862,
      inclination: 7.134,
      ascendingnode: 103.91,
      argofpericenter: 149.84,
      meananomaly: 307.8,
    },
    f: "The second-most-massive asteroid in the belt and the brightest — occasionally visible to the naked eye. NASA's Dawn mission orbited it in 2011–2012, revealing a giant south-pole impact basin (Rheasilvia) that blew off roughly 1% of Vesta's volume and seeded a whole family of smaller asteroids and Earth-striking meteorites.",
    lo: [
      [
        "NASA Dawn mission",
        "Dawn's 2011 arrival made Vesta the first protoplanet ever orbited by a spacecraft — its basalt-crusted surface shows it started differentiating into a layered body like Earth before growth stalled.",
      ],
    ],
  },
  {
    name: "Ceres",
    id: "minorplanet-ceres",
    designation: "1 Ceres · dwarf planet",
    color: "#8d8d8d",
    diameterKm: 939.4,
    absMag: 3.34,
    orbit: {
      period: 1681.63,
      epoch: 2457000.5,
      semimajoraxis: 414010000.0,
      eccentricity: 0.075823,
      inclination: 10.593,
      ascendingnode: 80.3293,
      argofpericenter: 72.522,
      meananomaly: 95.9891,
    },
    f: "The largest object in the asteroid belt and the first asteroid ever discovered (Piazzi, 1801) — big enough for its own gravity to pull it into a sphere, which is why the IAU reclassifies it as a dwarf planet. Dawn found bright salt deposits (Occator crater) and evidence of a subsurface brine ocean, making Ceres one of the closer places in the solar system real liquid water may still exist.",
    lo: [
      [
        "NASA Dawn mission",
        "Dawn orbited Ceres from 2015 until it ran out of fuel in 2018 — the first spacecraft to orbit two separate extraterrestrial bodies in one mission (Vesta, then Ceres).",
      ],
    ],
  },
  {
    name: "Pallas",
    id: "minorplanet-pallas",
    designation: "2 Pallas · asteroid",
    color: "#a3a3a3",
    diameterKm: 513,
    absMag: 4.13,
    orbit: {
      period: 1685.371678,
      epoch: 2457000.5,
      semimajoraxis: 414626372.0,
      eccentricity: 0.23127363,
      inclination: 34.840998,
      ascendingnode: 173.096248,
      argofpericenter: 309.930328,
      meananomaly: 78.228704,
    },
    f: "The third-most-massive body in the asteroid belt, and by far the most tilted — its orbit is inclined 34.8° to the ecliptic, unusually steep for a large main-belt object, which kept it from being visited by any spacecraft until ESA's Gaia-era orbit refinements and ground-based adaptive-optics imaging finally resolved its lumpy, cratered shape.",
    lo: [
      [
        "Olbers, 1802",
        'Discovered a year after Ceres, Pallas briefly made astronomers suspect a whole "missing planet" had shattered into the asteroid belt — the leading theory of the early 1800s, since abandoned for a story of a planet that never finished forming.',
      ],
    ],
  },
  {
    name: "Hygiea",
    id: "minorplanet-hygiea",
    designation: "10 Hygiea · asteroid",
    color: "#8a8a8a",
    diameterKm: 434,
    absMag: 5.43,
    orbit: {
      period: 2031.01,
      epoch: 2454800.5,
      semimajoraxis: 469587716.0,
      eccentricity: 0.117,
      inclination: 3.842,
      ascendingnode: 283.45,
      argofpericenter: 313.19,
      meananomaly: 197.96,
    },
    f: "The fourth-largest asteroid-belt body and, since 2019 VLT imaging showed it's very nearly a perfect sphere, a live candidate for dwarf-planet reclassification. It heads the Hygiea family — thousands of smaller asteroids from one collision roughly 2 billion years ago, the same kind of event Vesta's Rheasilvia basin recorded closer to home.",
    lo: [
      [
        "VLT SPHERE imaging, 2019",
        "Adaptive-optics imaging resolved Hygiea's shape well enough to show it's nearly round with no single giant crater — surprising for the largest member of a collisional family, and still debated.",
      ],
    ],
  },
];

function parseArgs(argv) {
  const args = {
    date: "2026-07-20",
    out: "scripts/out/minorplanets-curated.json",
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--date") args.date = argv[++i];
    else if (argv[i] === "--out") args.out = argv[++i];
  }
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const dateUtc = new Date(`${args.date}T00:00:00Z`);
  const jd = julianDate(dateUtc);
  const earthHelio = earthHeliocentricEcliptic(jd);

  const entries = BODIES.map((body) => {
    const bodyHelioEcl = heliocentricEcliptic(body.orbit, jd);
    const geoEcl = vecSub(bodyHelioEcl, earthHelio);
    const geoEq = eclipticToEquatorial(geoEcl);
    const { ra, dec, distanceAu } = equatorialToRaDec(geoEq);
    const distanceLy = distanceAu * AU_TO_LY;
    return {
      id: body.id,
      n: body.name,
      d: body.designation,
      t: "dwarf",
      r: "uncommon",
      ra: round(ra, 4),
      dec: round(dec, 4),
      ly: round(distanceLy, 8),
      mg: body.absMag.toFixed(2),
      sp: "Main-belt minor planet",
      img: null,
      c: body.color,
      con: "—",
      st: [
        ["Diameter", `${body.diameterKm} km`, clamp01(body.diameterKm / 1000)],
        [
          "Distance (this snapshot)",
          `${round(distanceAu, 3)} AU`,
          clamp01(distanceAu / 5),
        ],
        [
          "Absolute magnitude",
          body.absMag.toFixed(2),
          clamp01((8 - body.absMag) / 8),
        ],
      ],
      f: body.f,
      lo: body.lo,
      _epoch: args.date,
    };
  });

  mkdirSync(dirname(args.out), { recursive: true });
  writeFileSync(args.out, JSON.stringify(entries, null, 2) + "\n");
  console.log(
    `computed real positions for ${entries.length} minor planets at ${args.date} (JD ${jd.toFixed(2)}) -> ${args.out}`,
  );
  for (const e of entries) {
    console.log(`  ${e.id}: ra=${e.ra} dec=${e.dec} ly=${e.ly} (${e._epoch})`);
  }
}

function round(n, dp) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}
function clamp01(n) {
  return Math.max(0, Math.min(1, n));
}

main();
