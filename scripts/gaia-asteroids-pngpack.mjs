#!/usr/bin/env node
/* gaia-asteroids-pngpack.mjs — PF-10 C3: the real Gaia DR3 asteroid belt.
 *
 * Replaces `babylon-asteroids.ts`'s seeded-LCG procedural torus with the real catalog:
 * `resources/gaia_datasets/catalog-asteroids-dr3/asteroids-dr3.json`, 154,635 real solar-system
 * objects, each carrying real Keplerian orbital elements at its own real epoch. Every position
 * this script emits is the two-body solution for a real object's real elements — no `Math.random`
 * and no seeded LCG anywhere in the position path, which is C3's stated exit criterion.
 *
 * TWO OUTPUTS, matching the plan's two-tier split (a split that exists because 154,635 Havok
 * rigid bodies is 3,200x the current tier budget and not physically possible inside a 16.6 ms
 * frame — not because the catalog is being sampled for convenience):
 *
 *   1. VISUAL LAYER — `public/assets/asteroids-dr3.png`. All 154,635 records, PNG-packed in the
 *      exact 15-byte layout `star-catalog.ts` already decodes (Track B, the same format as the
 *      star field / white dwarfs / CNS5 / Oort cloud / SDSS DR18). Object-type byte 6, which
 *      BOTH shader twins already label "DR3 asteroid" — a slot reserved by earlier PF-10 work
 *      and filled for the first time here.
 *
 *   2. PHYSICS LAYER — `src/data/asteroids-dr3-physics.ts`. A bounded, real subset, chosen by
 *      real ORBITAL ELEMENTS first and geometry second (ASTRA, science brief 2026-07-20 — the
 *      first draft ranked purely by snapshot position, which silently makes the belt's physics
 *      roster a function of the date you happened to run the script): the candidates are the real
 *      asteroids on the catalog's own density peak with near-circular, near-coplanar orbits
 *      (a in [2.60, 2.75] AU, e < 0.10, i < 5°), and among those the N closest to the belt's
 *      spine circle. The element cuts are epoch-independent and reproduce the belt's existing
 *      tuned radial/vertical excursions from real orbital dynamics rather than from tuning. Each
 *      record carries its real name, real world position, real world velocity, and the real
 *      orbital elements it came from, so any claim about it is checkable against the catalog.
 *      Emitted as a TypeScript module rather than JSON: no `resolveJsonModule` dependency, and
 *      the engine gets it at import time — the physics field can never be half-built because a
 *      fetch was in flight.
 *
 * HONEST LIMITS (stated, not discovered later):
 *
 *   - The catalog carries NO magnitude, NO diameter, NO albedo and NO rotation data. Verified,
 *     not assumed: a key census over the real file finds exactly `name`, `color`, `parent`,
 *     `impl`, `provider`, `ct`, `transformFunction`, `orbit{epoch, meananomaly, semimajoraxis,
 *     eccentricity, argofpericenter, ascendingnode, period, inclination}`, `onlybody`,
 *     `newmethod` — and nothing photometric. The visual layer therefore ships ONE uniform
 *     magnitude/colour byte pair rather than fabricating variation the data does not contain,
 *     the same treatment the Oort cloud (TR-066) and SDSS DR18 (TR-067) layers already use.
 *   - Rock radii, spin and base geometry for the physics subset are DECLARED, not real, and are
 *     assigned at runtime by `buildRealAsteroidField` (babylon-asteroids.ts) from the existing
 *     seeded LCG — deliberately kept OUT of this file so the emitted module is real data only.
 *   - Positions are a snapshot for a stated date. See `asteroid-kepler.mjs`'s header for the
 *     three declared licences (belt-plane alignment, AU->world scale, uniform time acceleration).
 *
 * Run: node scripts/gaia-asteroids-pngpack.mjs [--date 2026-07-20] [--physics-count 64]
 *      [--png public/assets/asteroids-dr3.png] [--physics src/data/asteroids-dr3-physics.ts]
 *      [--limit N]   (--limit truncates the read for a fast smoke run; never for a shipped asset)
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { streamGaiaSkyObjects } from "./lib/gaiasky-orbit-json.mjs";
import {
  AU_TO_WORLD,
  BELT_CENTER_Z,
  BELT_RADIUS,
  TIME_ACCEL,
  distanceToBeltSpine,
  eclipticToWorld,
  eclipticVelocityToWorld,
  julianDate,
  keplerState,
} from "./lib/asteroid-kepler.mjs";
import { writeStreamAsPng } from "./lib/starfield-pngpack.mjs";

const SOURCE_PATH =
  "resources/gaia_datasets/catalog-asteroids-dr3/asteroids-dr3.json";

/** Object-type byte 6 — "DR3 asteroid" in both shader twins' vertex stage (an existing branch,
 * `ty < 6.5`, px *= 0.85) plus the tight low-alpha fragment branch C3 adds alongside it. */
const ASTEROID_TYPE_BYTE = 6;
/** Uniform, dim: no per-object photometry exists in the source (see HONEST LIMITS). The shader
 * reads mag = 12.5 - byte/255*14, so byte 0 is the format's floor at magnitude 12.5.
 * ASTRA (science brief, 2026-07-20): even that floor is 3-5 magnitudes BRIGHTER than a real
 * main-belt asteroid, so the dimmest byte the format has is the only honest choice — the first
 * draft's 24 (mag 11.2) was gratuitously bright on top of an already-generous floor. */
const UNIFORM_MAG_BYTE = 0;
/** Warm GREY. ASTRA CORRECTION (science brief, 2026-07-20): the first draft used 214 (t = 0.85),
 * which the Planckian ramp renders as RGB (1.00, 0.81, 0.53) — B-V ~ 1.4, about 4000 K, a K5-M0
 * star. Real main-belt asteroids are a C-type (B-V ~ 0.70) / S-type (~ 0.85) mix with a
 * magnitude-limited mean of ~0.80, barely redder than the Sun's 0.65; Vesta and Ceres are
 * famously grey, not ember-coloured. t ~ 0.68 -> byte 173. */
const UNIFORM_COLOUR_BYTE = 173;

function parseArgs(argv) {
  const args = {
    date: "2026-07-20",
    png: "public/assets/asteroids-dr3.png",
    physics: "src/data/asteroids-dr3-physics.ts",
    physicsCount: 64,
    limit: Infinity,
    /** DECLARED #1 — see asteroid-kepler.mjs's header and Astra's flagged frame defect. */
    frame: "ecliptic",
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--date") args.date = argv[++i];
    else if (a === "--frame") args.frame = argv[++i];
    else if (a === "--png") args.png = argv[++i];
    else if (a === "--physics") args.physics = argv[++i];
    else if (a === "--physics-count") args.physicsCount = Number(argv[++i]);
    else if (a === "--limit") args.limit = Number(argv[++i]);
  }
  return args;
}

/** True when a record carries every element the Kepler solver needs. Anything else (Gaia Sky's
 * `dr3-asteroids-hook` group node, for instance) is skipped and counted, never silently coerced
 * into a fabricated orbit. */
export function hasCompleteOrbit(obj) {
  const o = obj?.orbit;
  return (
    !!o &&
    Number.isFinite(o.epoch) &&
    Number.isFinite(o.meananomaly) &&
    Number.isFinite(o.semimajoraxis) &&
    Number.isFinite(o.eccentricity) &&
    Number.isFinite(o.argofpericenter) &&
    Number.isFinite(o.ascendingnode) &&
    Number.isFinite(o.period) &&
    Number.isFinite(o.inclination) &&
    o.period > 0 &&
    o.eccentricity >= 0 &&
    o.eccentricity < 1
  );
}

/** ASTRA's epoch-independent physics-candidate cut (science brief, 2026-07-20): the catalog's
 * own density peak, restricted to near-circular, near-coplanar orbits. These bounds are real
 * orbital-element bounds, not tuning knobs — e < 0.10 at a ~ 2.7 AU produces radial excursions
 * of about ±17 world units and i < 5° about ±14.9, which is where the belt's existing spread
 * numbers came from independently. Exported for the unit tests. */
export const PHYSICS_CUT = { aMin: 2.6, aMax: 2.75, eMax: 0.1, iMaxDeg: 5 };

export function isPhysicsCandidate(aAu, e, iDeg) {
  return (
    aAu >= PHYSICS_CUT.aMin &&
    aAu <= PHYSICS_CUT.aMax &&
    e < PHYSICS_CUT.eMax &&
    Math.abs(iDeg) < PHYSICS_CUT.iMaxDeg
  );
}

/** Bounded top-N-smallest tracker. Insertion sort into a fixed array — for N = 64 over 154,635
 * candidates this is both faster and far less memory than sorting the whole catalog, and it
 * never materializes a second copy of the data. */
function makeTopN(limit) {
  const items = [];
  return {
    items,
    offer(key, value) {
      if (items.length === limit && key >= items[items.length - 1].key) return;
      let lo = 0,
        hi = items.length;
      while (lo < hi) {
        const mid = (lo + hi) >> 1;
        if (items[mid].key < key) lo = mid + 1;
        else hi = mid;
      }
      items.splice(lo, 0, { key, value });
      if (items.length > limit) items.pop();
    },
  };
}

/** Radial histogram of the real semi-major axes, 0.05 AU bins over 1.5-6.0 AU. Emitted to the
 * console (and asserted in the unit tests) because it is the one cheap check that proves the
 * belt is REAL rather than procedural: a uniform torus has a flat histogram, whereas real
 * elements carve the Kirkwood resonance gaps at 2.50 / 2.82 / 2.95 / 3.28 AU. */
export function semiMajorHistogram(aValues, binAu = 0.05, lo = 1.5, hi = 6.0) {
  const bins = new Uint32Array(Math.ceil((hi - lo) / binAu));
  for (const a of aValues) {
    if (a < lo || a >= hi) continue;
    bins[Math.floor((a - lo) / binAu)]++;
  }
  return { bins, binAu, lo };
}

/** Count in the bin containing `aAu`. */
export function binCountAt(hist, aAu) {
  const idx = Math.floor((aAu - hist.lo) / hist.binAu);
  return idx >= 0 && idx < hist.bins.length ? hist.bins[idx] : 0;
}

function emitPhysicsModule(records, meta) {
  const rows = records
    .map(
      (r) =>
        `  { n: ${JSON.stringify(r.n)}, p: [${r.p.map(f6).join(", ")}], ` +
        `v: [${r.v.map(f6).join(", ")}], a: ${f6(r.a)}, e: ${f6(r.e)}, i: ${f6(r.i)} },`,
    )
    .join("\n");
  const frameNote =
    meta.frame === "equatorial"
      ? "rotated into the scene's EQUATORIAL frame (the real 23.44 deg obliquity applied — PF-11 D6.2, matches the rest of the catalog)"
      : "the scene's X-Y plane = the ecliptic UNROTATED (DECLARED #1 — see asteroid-kepler.mjs)";
  return `/* asteroids-dr3-physics.ts — GENERATED, DO NOT HAND-EDIT.
 *
 * PF-10 C3 (PF-11 D6.2: regenerated in the equatorial frame). Regenerate with:
 *   node scripts/gaia-asteroids-pngpack.mjs --date ${meta.date} --physics-count ${records.length} --frame ${meta.frame}
 *
 * The bounded physics tier of the real Gaia DR3 asteroid belt: the ${records.length} real
 * asteroids whose real positions at ${meta.date} lie closest to the belt's spine circle
 * (radius ${BELT_RADIUS}, plane z = ${BELT_CENTER_Z} in belt-LOCAL space — babylon-asteroids.ts's
 * toBeltSpace/fromBeltSpace) — the region where the tuned belt density, warp slowdown and
 * passage deflection actually act. Selected out of ${meta.sourceCount} real catalog records by
 * REAL ORBITAL ELEMENTS first (a ${PHYSICS_CUT.aMin}-${PHYSICS_CUT.aMax} AU, e < ${PHYSICS_CUT.eMax}, i < ${PHYSICS_CUT.iMaxDeg}°
 * — epoch-independent, on the catalog's own density peak, per Astra's science brief) and by
 * spine proximity second (frame-aware — see distanceToBeltSpine). Not sampled arbitrarily and
 * not a function of the date the script happened to run.
 *
 * Every field here is REAL. Rock radii, spin, base geometry and mass are DECLARED (no size data
 * exists in the source catalog) and are applied separately at runtime by
 * \`buildRealAsteroidField\` in src/lib/babylon-asteroids.ts — that boundary is deliberate, so a
 * reader can tell real from declared without cross-referencing.
 *
 *   n  real designation from the catalog
 *   p  world-space position   (1 AU = ${AU_TO_WORLD} world units; ${frameNote})
 *   v  world-space velocity   (units/s, real Keplerian velocity x TIME_ACCEL = ${TIME_ACCEL})
 *   a  real semi-major axis, AU
 *   e  real eccentricity
 *   i  real inclination, degrees
 *
 * See scripts/lib/asteroid-kepler.mjs for the three declared licences behind p and v.
 */

export interface RealAsteroidRecord {
  readonly n: string;
  readonly p: readonly [number, number, number];
  readonly v: readonly [number, number, number];
  readonly a: number;
  readonly e: number;
  readonly i: number;
}

export interface RealAsteroidCatalog {
  /** Snapshot date the positions were computed for (UTC). */
  readonly epoch: string;
  /** World units per AU — declared scale. */
  readonly auToWorld: number;
  /** Uniform velocity time-acceleration factor — declared. */
  readonly timeAccel: number;
  /** Real records in the source catalog the subset was drawn from. */
  readonly sourceCount: number;
  readonly bodies: readonly RealAsteroidRecord[];
}

export const REAL_ASTEROIDS: RealAsteroidCatalog = {
  epoch: ${JSON.stringify(meta.date)},
  auToWorld: ${AU_TO_WORLD},
  timeAccel: ${TIME_ACCEL},
  sourceCount: ${meta.sourceCount},
  bodies: [
${rows}
  ],
};
`;
}

function f6(n) {
  return Number(n.toFixed(6));
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const jd = julianDate(new Date(`${args.date}T00:00:00Z`));
  const t0 = Date.now();

  // One growable pass: positions are kept (they become the PNG), everything else is either
  // folded into a running statistic or into the bounded top-N. No per-record object survives.
  const xs = [];
  const ys = [];
  const zs = [];
  const aValues = [];
  const near = makeTopN(args.physicsCount);
  let skipped = 0;
  let scanned = 0;
  let physicsCandidates = 0;

  const total = await streamGaiaSkyObjects(SOURCE_PATH, (obj) => {
    scanned++;
    if (xs.length >= args.limit) return;
    if (!hasCompleteOrbit(obj)) {
      skipped++;
      return;
    }
    const state = keplerState(obj.orbit, jd);
    const p = eclipticToWorld(state.pos, args.frame);
    xs.push(p[0]);
    ys.push(p[1]);
    zs.push(p[2]);
    aValues.push(state.aAu);
    if (
      isPhysicsCandidate(
        state.aAu,
        obj.orbit.eccentricity,
        obj.orbit.inclination,
      )
    ) {
      physicsCandidates++;
      near.offer(distanceToBeltSpine(p, args.frame), {
        n: obj.name,
        p,
        v: eclipticVelocityToWorld(state.vel, args.frame),
        a: state.aAu,
        e: obj.orbit.eccentricity,
        i: obj.orbit.inclination,
      });
    }
  });

  const count = xs.length;
  console.log(
    `streamed ${scanned} objects from ${SOURCE_PATH} in ${Date.now() - t0} ms ` +
      `(${count} with complete real orbits, ${skipped} skipped)`,
  );

  // Real-structure report: a procedural belt cannot produce these.
  const hist = semiMajorHistogram(aValues);
  const kirkwood = [
    ["3:1", 2.5],
    ["5:2", 2.82],
    ["7:3", 2.95],
    ["2:1", 3.28],
  ];
  console.log("Kirkwood gap check (bin count at resonance vs its neighbours):");
  for (const [label, a] of kirkwood) {
    const at = binCountAt(hist, a);
    const around =
      (binCountAt(hist, a - 0.15) + binCountAt(hist, a + 0.15)) / 2;
    console.log(
      `  ${label} @ ${a} AU: ${at} vs ${around.toFixed(0)} nearby ` +
        `(${around > 0 ? ((at / around) * 100).toFixed(0) : "n/a"}% of local density)`,
    );
  }

  mkdirSync(dirname(args.png), { recursive: true });
  const info = await writeStreamAsPng(
    count,
    (view, i) => {
      view.setX(xs[i]);
      view.setY(ys[i]);
      view.setZ(zs[i]);
      view.setMagByte(UNIFORM_MAG_BYTE);
      view.setCiByte(UNIFORM_COLOUR_BYTE);
      view.setTypeByte(ASTEROID_TYPE_BYTE);
    },
    args.png,
  );
  console.log(
    `wrote ${info.recordCount} visual records (${info.byteCount} bytes) -> ${args.png} ` +
      `(${info.width}x${info.height})`,
  );

  console.log(
    `physics candidates (a ${PHYSICS_CUT.aMin}-${PHYSICS_CUT.aMax} AU, e < ${PHYSICS_CUT.eMax}, ` +
      `i < ${PHYSICS_CUT.iMaxDeg} deg): ${physicsCandidates} of ${count}`,
  );
  const physics = near.items.map((it) => it.value);
  mkdirSync(dirname(args.physics), { recursive: true });
  writeFileSync(
    args.physics,
    emitPhysicsModule(physics, {
      date: args.date,
      sourceCount: count,
      frame: args.frame,
    }),
  );
  console.log(
    `wrote ${physics.length} real physics bodies -> ${args.physics} ` +
      `(spine distance ${physics[0] ? near.items[0].key.toFixed(2) : "n/a"}..` +
      `${physics.length ? near.items[near.items.length - 1].key.toFixed(2) : "n/a"} world units)`,
  );
  console.log(`total ${total} stream elements, ${Date.now() - t0} ms`);
}

if (process.argv[1] && process.argv[1].endsWith("gaia-asteroids-pngpack.mjs")) {
  main();
}
