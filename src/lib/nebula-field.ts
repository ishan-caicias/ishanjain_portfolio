/* nebula-field.ts — PF-09 B3: volumetric/raymarched nebulae.
 *
 * NOT a port — the live engine's nebulae (space-engine.js, celestial type 2)
 * are 2D billboard sprites: lobed gaussians in a point-sprite fragment shader.
 * There is no volumetric, raymarched, or even 3D-positioned gas anywhere in
 * the live engine, and the Babylon path had no nebula visual at all before
 * this module (grep "nebula" — only ship-dynamics.ts comments). Same
 * new-work-with-named-reference framing TR-044 used for shooting stars.
 *
 * ARCHITECTURE (ADR-0004). One half-resolution offscreen texture holds the
 * raymarched nebulae each frame; a fullscreen triangle composites it
 * additively over the scene. The PRODUCER of that texture is tier-gated:
 *
 *   WebGPU  — a WGSL compute shader (Babylon ComputeShader) raymarches into a
 *             storage texture, STEPS_COMPUTE steps. The B3 "gaseous look"
 *             showcase path.
 *   WebGL2  — the same raymarch as a GLSL fragment shader in a Babylon
 *             ProceduralTexture (WebGL2 has no compute API), STEPS_FRAGMENT
 *             steps. The "fallback tier still coherent" half of B3's exit
 *             criterion.
 *
 * SINGLE SOURCE OF TRUTH. Volumes anchor at REAL catalog nebulae — the same
 * (ra, dec, ly) → bodyWorldPosition placement travelTo() uses — so traveling
 * to m42 flies the camera into the Orion Nebula's actual volume. Volume
 * constants and march tuning are BAKED into both generated shader sources by
 * the generator functions below (no per-volume uniforms, no UBO array layout
 * to get wrong); the same numbers drive the JS mirrors the unit tests pin.
 *
 * TR-045 GUARD. WGSL reserves identifiers (`meta`, `ref` blanked the whole
 * scene once) and validates asynchronously, so generated sources are checked
 * by unit test against a reserved-word list, and the real-hardware E2E spec
 * asserts a clean console. Identifiers here avoid the reserved list entirely.
 */
import { bodyWorldPosition } from "./ship-dynamics";
import type { Quat } from "./ship-dynamics";

export interface NebulaVolume {
  /** Catalog id — the same body travelTo() targets. */
  id: string;
  center: [number, number, number];
  radius: number;
  /** Dense-core emission colour (linear-ish 0..1 rgb). */
  colA: [number, number, number];
  /** Thin-edge emission colour. */
  colB: [number, number, number];
  seed: number;
  /** Container shape in radius-normalized unit space (defaults to `sphere` —
   * see the ADR-0004 2026-07-20 amendment). */
  shape?: NebulaShape;
}

/* ---------- shape system (ADR-0004, 2026-07-20 amendment) ----------------
 *
 * A small closed set of SDF-flavoured primitives plus two combinators, each
 * operating in the volume's own radius-normalized unit space (p already
 * divided by vol.radius — the same space the original sphere-only `q =
 * length(rel)/radius` formula operated in). Every primitive returns a
 * dimensionless "q" value with the SAME semantics the sphere case always
 * had: ~0 at the shape's densest core, 1 at its nominal visible boundary,
 * >1 outside — NOT a literal signed distance field (this is a fixed-step
 * bounding-sphere march, not adaptive SDF sphere-tracing, so a true SDF's
 * "exact distance to surface" guarantee isn't needed or exploited; only the
 * "0 at core, 1 at edge" falloff shape matters to nebulaDensity's shell/
 * threshold math downstream).
 *
 * Open/closed: nebulaDensity, the raymarch loop, and the reveal/compositing
 * pipeline never change when a new primitive kind or a new volume is added —
 * only this dispatcher (one more `kind` case) and NEBULA_VOLUMES (one more
 * descriptor) do. The `sphere` case reproduces the original `length(p)`
 * formula exactly, so the 4 pre-existing showcase volumes are unaffected
 * (pinned by a regression test).
 */
export type NebulaShape =
  | { kind: "sphere" }
  | { kind: "torus"; majorRadius: number; minorRadius: number }
  | {
      kind: "cappedCone";
      /** Unit axis the cone points along. */
      dir: [number, number, number];
      /** Distance from the volume centre to the cone's base (wide end). */
      offset: number;
      height: number;
      /** Radius at the tip (near centre) and the base (far end). */
      rTip: number;
      rBase: number;
      /** Half-thickness of the fuzzy "surface" band, in the same units. */
      edge: number;
    }
  | {
      kind: "box";
      halfExtents: [number, number, number];
      edge: number;
    }
  | {
      /** Non-uniform sphere — Crab's flattened, elongated remnant shell and
       * Ring's inner "football" glow. */
      kind: "ellipsoid";
      semiAxes: [number, number, number];
    }
  | {
      /** Thin hollow spherical shell — Cat's Eye's concentric-halo motif. */
      kind: "shell";
      radius: number;
      thickness: number;
    }
  | { kind: "union"; shapes: NebulaShape[] }
  | {
      /** `base` minus `cut` — Trifid's dust lanes as real extinction
       * (density suppression), not a colour choice. Hard cut, not a smooth
       * SDF subtract: dust-lane extinction is genuinely high-contrast. */
      kind: "subtract";
      base: NebulaShape;
      cut: NebulaShape;
    };

function dot3(a: [number, number, number], b: [number, number, number]) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Rotate `p` into a frame where `dir` is the +Y axis — used by cappedCone so
 * its own math can stay the textbook axis-aligned form. Pure/testable. */
function alignToAxis(
  p: [number, number, number],
  dir: [number, number, number],
): [number, number, number] {
  const len = Math.hypot(dir[0], dir[1], dir[2]) || 1;
  const d: [number, number, number] = [
    dir[0] / len,
    dir[1] / len,
    dir[2] / len,
  ];
  // Any vector not parallel to d works as a helper for a stable basis.
  const helper: [number, number, number] =
    Math.abs(d[1]) < 0.99 ? [0, 1, 0] : [1, 0, 0];
  const rx0 = d[1] * helper[2] - d[2] * helper[1];
  const rx1 = d[2] * helper[0] - d[0] * helper[2];
  const rx2 = d[0] * helper[1] - d[1] * helper[0];
  const rl = Math.hypot(rx0, rx1, rx2) || 1;
  const right: [number, number, number] = [rx0 / rl, rx1 / rl, rx2 / rl];
  const up: [number, number, number] = [
    d[1] * right[2] - d[2] * right[1],
    d[2] * right[0] - d[0] * right[2],
    d[0] * right[1] - d[1] * right[0],
  ];
  return [dot3(p, right), dot3(p, d), dot3(p, up)];
}

/** Dispatcher: "q" for any shape kind at a point already in radius-normalized
 * unit space. Every case documents the physical intuition it targets — see
 * the science brief (docs/analysis/2026-07-20-ngc2000-volume-nebula-shapes-
 * science-brief.md) for which real object each combination represents. */
export function shapeQ(
  shape: NebulaShape,
  p: [number, number, number],
): number {
  switch (shape.kind) {
    case "sphere":
      return Math.hypot(p[0], p[1], p[2]);
    case "torus": {
      // Distance from the tube's centreline, normalized by tube radius —
      // 0 on the centreline, 1 at the tube surface. The torus's own plane
      // is XZ (Y is the thin axis) in the shape's local unit space.
      const ringDist = Math.hypot(p[0], p[2]) - shape.majorRadius;
      return Math.hypot(ringDist, p[1]) / shape.minorRadius;
    }
    case "cappedCone": {
      const [lx, ly, lz] = alignToAxis(p, shape.dir);
      // Local Y runs from 0 (tip, near centre) to `height` (base, far end),
      // offset from the volume centre by `offset` along the same axis.
      const y = ly - shape.offset;
      const t = Math.max(0, Math.min(1, y / shape.height));
      const rAtY = shape.rTip + (shape.rBase - shape.rTip) * t;
      const radial = Math.hypot(lx, lz);
      if (y < 0 || y > shape.height) return 999; // past the cone's ends
      return Math.abs(radial - rAtY) / shape.edge;
    }
    case "box": {
      const dx = Math.abs(p[0]) - shape.halfExtents[0];
      const dy = Math.abs(p[1]) - shape.halfExtents[1];
      const dz = Math.abs(p[2]) - shape.halfExtents[2];
      const outsideDist = Math.hypot(
        Math.max(dx, 0),
        Math.max(dy, 0),
        Math.max(dz, 0),
      );
      const insideDist = Math.min(Math.max(dx, Math.max(dy, dz)), 0);
      const sdf = outsideDist + insideDist; // real box SDF (negative inside)
      return sdf / shape.edge + 1;
    }
    case "shell": {
      const r = Math.hypot(p[0], p[1], p[2]);
      return Math.abs(r - shape.radius) / shape.thickness;
    }
    case "ellipsoid": {
      const [a, b, c] = shape.semiAxes;
      return Math.hypot(p[0] / a, p[1] / b, p[2] / c);
    }
    case "union": {
      let best = Infinity;
      for (const s of shape.shapes) best = Math.min(best, shapeQ(s, p));
      return best;
    }
    case "subtract": {
      const qBase = shapeQ(shape.base, p);
      const qCut = shapeQ(shape.cut, p);
      return qCut < 1 ? 999 : qBase; // inside the cut region -> fully excluded
    }
  }
}

/** Volume radius as a fraction of the body's log-scaled world depth — keeps
 * every nebula's apparent angular size from home roughly constant (~16°)
 * regardless of its physical distance, matching how the catalog's log-depth
 * placement already compresses distance. */
export const NEBULA_RADIUS_FACTOR = 0.14;

/** Offscreen nebula texture resolution as a fraction of the render target —
 * half-res: raymarching is bandwidth/ALU-bound and the result is soft gas,
 * so half-res upsampled bilinearly is visually indistinguishable at ~4x less
 * work. */
export const NEBULA_TEX_SCALE = 0.5;

/** Raymarch tuning — every constant here is baked into BOTH generated shader
 * sources and used by the JS mirrors, so there is exactly one place to tune. */
export const NEBULA_MARCH = {
  /** Steps per volume segment on the WebGPU compute tier. */
  stepsCompute: 40,
  /** Steps per volume segment on the WebGL2 fragment fallback tier. */
  stepsFragment: 18,
  /** fbm cycles across one volume radius. */
  noiseFreq: 2.6,
  /** Density threshold at the volume centre (higher = wispier). */
  thresholdBase: 0.32,
  /** Extra threshold toward the rim (quadratic in q = dist/radius) — makes
   * edges ragged rather than a hard sphere silhouette. */
  thresholdEdge: 0.3,
  /** q at which the radial shell falloff starts (1.0 = the rim). */
  shellInner: 0.55,
  /** Density multiplier after thresholding. */
  densityGain: 1.9,
  /** Beer-Lambert extinction per (density × step/radius). */
  extinction: 5.0,
  /** Emission brightness multiplier. */
  brightness: 1.15,
  /** Core/edge colour mix sharpness (colA at density ≥ 1/colorSharp). */
  colorSharp: 3.0,
  /** Early-out when transmittance drops below this. */
  transmittanceFloor: 0.02,
  /** Very slow domain drift (noise-space units/sec) — frozen under
   * prefers-reduced-motion (uTime pinned to 0). */
  driftRate: 0.006,
} as const;

/** Destination-gated reveal envelope (owner direction, 2026-07-19 — see
 * ADR-0004 amendment). Nebulae are NOT ambient sky features: a volume is
 * invisible until it is the active travel destination, fades in during the
 * DECELERATION burn, and swells to full strength once the ship stops. The
 * per-volume factor rides in one vec4 uniform (uReveal — component index =
 * volume order in NEBULA_VOLUMES, baked as a swizzle literal per call), so
 * the ADR-0004 no-uniform-arrays rule holds. */
export const NEBULA_REVEAL = {
  /** Warp fraction where the reveal starts — the HUD's own decel threshold
   * (babylon-engine.ts `wphase`: k < 0.47 accel, < 0.53 flip, then decel). */
  // PF-11 D3.2 (ADR-0011): re-keyed 0.53 → 0.56 alongside the widened flip
  // window. This literal is a FOURTH consumer of the warp phase thresholds
  // (the blast-radius sweep found it); left at 0.53 the destination gas would
  // start revealing while the ship is still mid-rotation.
  decelStart: 0.56,
  /** Reveal level at the instant of arrival (the swell continues from here). */
  decelMax: 0.7,
  /** Seconds for the post-arrival swell from decelMax to 1. */
  arriveSwellS: 1.8,
  /** Exp-decay rate (1/s) for fading a volume out when it stops being the
   * destination (goHome / travel elsewhere). */
  fadeOutLambda: 2.2,
} as const;

/** Deterministic reveal target for one volume given the travel state:
 * `warpK` = warp progress toward THIS volume (null if not warping to it),
 * `sinceArriveS` = seconds since the ship stopped AT this volume (null if
 * not arrived here). Both null → 0 (the engine damps toward it with
 * fadeOutLambda rather than snapping). */
export function nebulaRevealTarget(
  warpK: number | null,
  sinceArriveS: number | null,
): number {
  const t = NEBULA_REVEAL;
  if (sinceArriveS != null) {
    const k = Math.min(1, Math.max(0, sinceArriveS / t.arriveSwellS));
    const ease = 1 - Math.pow(1 - k, 3); // ease-out cubic settle
    return t.decelMax + (1 - t.decelMax) * ease;
  }
  if (warpK != null) {
    if (warpK <= t.decelStart) return 0;
    const k = (warpK - t.decelStart) / (1 - t.decelStart);
    return t.decelMax * smooth01(Math.min(1, Math.max(0, k)));
  }
  return 0;
}

/** Reduces a full per-volume reveal array (arbitrary length) to the fixed
 * 2-slot {volA/revealA, volB/revealB} the GPU uniforms actually carry — see
 * the ADR-0004 2026-07-20 amendment. At most 2 volumes can plausibly have
 * nonzero reveal at once (the current destination, and the previous one
 * still damping to 0), so keeping the top 2 by value never silently drops a
 * volume that matters; a 3rd nonzero entry (extremely unlikely given
 * NEBULA_REVEAL.fadeOutLambda's decay rate) would be dropped, a documented,
 * graceful degradation rather than a crash. Index -1 / reveal 0 marks an
 * unused slot (never matches a real 0-based volume index in the shader's
 * `i == uVolumeA` comparison). */
export function topTwoReveal(reveal: number[]): {
  volA: number;
  revealA: number;
  volB: number;
  revealB: number;
} {
  let volA = -1,
    revealA = 0,
    volB = -1,
    revealB = 0;
  for (let i = 0; i < reveal.length; i++) {
    const r = reveal[i];
    if (r <= 0) continue;
    if (r > revealA) {
      volB = volA;
      revealB = revealA;
      volA = i;
      revealA = r;
    } else if (r > revealB) {
      volB = i;
      revealB = r;
    }
  }
  return { volA, revealA, volB, revealB };
}

/** Frame-rate-independent exponential damp toward a target (same construction
 * as ship-dynamics' quatDamp, scalar form). */
export function expDamp(
  current: number,
  target: number,
  lambda: number,
  dtS: number,
): number {
  return target + (current - target) * Math.exp(-lambda * dtS);
}

/** The showcase volumes: four real catalog nebulae with distinct colours and
 * good sky spread (Orion, Aquarius, Cygnus, Monoceros), PLUS (2026-07-20,
 * ADR-0004 amendment) the 7 remaining real NGC2000 Volume-archetype objects
 * — Astra science-briefed (docs/analysis/2026-07-20-ngc2000-volume-nebula-
 * shapes-science-brief.md) original SDF shapes, not ported from Gaia Sky's
 * CC-BY-NC-SA shadertoy-derived shaders. ra/dec/ly duplicate real catalog
 * entries — asserted against bodyWorldPosition in unit tests so placement
 * can't drift from where travelTo() actually goes.
 *
 * ANCHOR SELECTION, checked deliberately rather than guessed: several of
 * these real objects exist TWICE in this repo's catalog data — once as a
 * hand-curated dossier body (real image, magnitude, constellation) and once
 * as a bulk NGC2000-pipeline import (TR-066, no image, sometimes a real
 * distance-unit bug — e.g. the pipeline's Crab Nebula entry decoded to
 * 652 ly, a 10x error from misreading the source's ambiguous distance
 * field; this repo's own celestial-extra.js curated entry has the correct
 * ~6500 ly). Anchoring to the WRONG one would leave the gas cloud visually
 * detached from the body a visitor actually arrives at. Preference order
 * applied per-object: curated dossier entry when it has a real (non-null)
 * distance, else the NGC2000-pipeline entry. Checked against the live data
 * files, not assumed:
 *   - Ring (m57), Cat's Eye (ngc6543), Crab (m1), Trifid (ngc6514) — curated
 *     entries exist with real distances, used directly.
 *   - Box (ngc6309's curated entry has ly: null, a real missing-data gap,
 *     not fabricated) — falls back to the pipeline's ngc2000-box-nebula.
 *   - Hourglass — no curated duplicate exists; uses the pipeline entry.
 *   - "Butterfly Nebula" is a genuine real-astronomy naming collision: this
 *     repo's curated entry (ngc6302) and the NGC2000 pipeline's informal
 *     "Butterfly Nebula" (M2-9/Twin Jet Nebula, Astra's science brief's
 *     original subject) are two DIFFERENT real bipolar planetary nebulae
 *     that both carry this informal name. Anchored to the curated ngc6302
 *     (Bug Nebula/NGC 6302) for the same "prefer the dossier body" reason
 *     as the others — also a real, well-documented bipolar planetary
 *     nebula, so the two-opposed-capped-cones shape recommendation stays
 *     equally valid for this specific object. */
const NEBULA_SOURCES: {
  id: string;
  ra: number;
  dec: number;
  ly: number;
  colA: [number, number, number];
  colB: [number, number, number];
  seed: number;
  shape?: NebulaShape;
}[] = [
  // Orion Nebula — H II star nursery: warm pink core, blue reflection dust.
  {
    id: "m42",
    ra: 83.822,
    dec: -5.391,
    ly: 1344,
    colA: [0.96, 0.56, 0.69],
    colB: [0.36, 0.45, 0.85],
    seed: 3.1,
  },
  // Helix Nebula (NGC 7293) — planetary nebula, near-face-on ring with fine
  // radial "cometary knot" structure at the rim. Real ionization
  // stratification: hotter O III near the central white dwarf (teal/green
  // core), cooler H-alpha/N II at the outer rim (red/pink) — Astra
  // science-brief SIMPLIFIED verdict (a single torus omits the real
  // double-ring/misaligned-disk structure but captures the famous ring).
  {
    id: "ngc7293",
    ra: 337.411,
    dec: -20.837,
    ly: 655,
    colA: [0.5, 0.87, 0.85],
    colB: [0.85, 0.35, 0.42],
    seed: 7.7,
    shape: { kind: "torus", majorRadius: 0.55, minorRadius: 0.35 },
  },
  // Veil Nebula — supernova remnant: cyan O III filaments, red H-alpha fringe.
  {
    id: "veil",
    ra: 311.75,
    dec: 30.71,
    ly: 2400,
    colA: [0.55, 0.85, 0.95],
    colB: [0.9, 0.4, 0.5],
    seed: 12.9,
  },
  // Rosette Nebula — emission rose: red H-alpha core, crimson rim.
  {
    id: "rosette",
    ra: 97.98,
    dec: 4.94,
    ly: 5200,
    colA: [0.95, 0.42, 0.5],
    colB: [0.6, 0.25, 0.45],
    seed: 21.3,
  },
  // Cat's Eye Nebula (NGC 6543) — planetary nebula famous for 11+ real
  // concentric shells from periodic mass-loss episodes. ACCURATE-leaning
  // SIMPLIFIED: one bright knotty core + one faint concentric shell stands
  // in for "known to have many shells" without fabricating a precise count.
  {
    id: "ngc6543",
    ra: 269.639,
    dec: 66.633,
    ly: 3300,
    colA: [0.45, 0.85, 0.8],
    colB: [0.8, 0.3, 0.35],
    seed: 31.7,
    shape: {
      kind: "union",
      shapes: [
        { kind: "ellipsoid", semiAxes: [0.35, 0.5, 0.35] },
        { kind: "shell", radius: 0.75, thickness: 0.12 },
      ],
    },
  },
  // Box Nebula (NGC 6309) — ACCURATE: the informal name is literally
  // descriptive, real Hubble imagery shows a genuinely rectangular inner
  // structure. Rare case where the common name IS the SDF primitive.
  {
    id: "ngc2000-box-nebula",
    ra: 258.5254,
    dec: -12.9167,
    ly: 8515.82,
    colA: [0.7, 0.85, 0.8],
    colB: [0.6, 0.3, 0.32],
    seed: 42.3,
    shape: {
      kind: "union",
      shapes: [
        { kind: "box", halfExtents: [0.4, 0.3, 0.4], edge: 0.22 },
        { kind: "sphere" },
      ],
    },
  },
  // Butterfly Nebula (NGC 6309 / Bug Nebula) — bipolar planetary nebula;
  // ACCURATE: two opposed capped cones is the textbook schematic for a
  // bipolar PN in the professional literature itself, not a portfolio
  // simplification. Orange-red lobes, cooler shock-ionized rim.
  {
    id: "ngc6302",
    ra: 258.436,
    dec: -37.104,
    ly: 3400,
    colA: [0.9, 0.45, 0.25],
    colB: [0.35, 0.75, 0.85],
    seed: 53.9,
    shape: {
      kind: "union",
      shapes: [
        {
          kind: "cappedCone",
          dir: [0, 1, 0],
          offset: 0.03,
          height: 0.85,
          rTip: 0.04,
          rBase: 0.55,
          edge: 0.16,
        },
        {
          kind: "cappedCone",
          dir: [0, -1, 0],
          offset: 0.03,
          height: 0.85,
          rTip: 0.04,
          rBase: 0.55,
          edge: 0.16,
        },
      ],
    },
  },
  // Hourglass Nebula (MyCn18) — ACCURATE: THE archetypal hourglass, the
  // object the famous 1996 Hubble image made famous specifically for its
  // narrow-waist bipolar shape with a bright ring at the pinch point.
  {
    id: "ngc2000-hourglass-nebula",
    ra: 204.8736,
    dec: -67.3774,
    ly: 7999.99,
    colA: [0.4, 0.85, 0.75],
    colB: [0.85, 0.3, 0.35],
    seed: 64.1,
    shape: {
      kind: "union",
      shapes: [
        {
          kind: "cappedCone",
          dir: [0, 1, 0],
          offset: 0.02,
          height: 0.9,
          rTip: 0.02,
          rBase: 0.5,
          edge: 0.14,
        },
        {
          kind: "cappedCone",
          dir: [0, -1, 0],
          offset: 0.02,
          height: 0.9,
          rTip: 0.02,
          rBase: 0.5,
          edge: 0.14,
        },
        { kind: "torus", majorRadius: 0.15, minorRadius: 0.08 },
      ],
    },
  },
  // Crab Nebula (M1) — the ONE supernova remnant in this set (not a
  // planetary nebula): irregular filamentary shell (real ~1.4:1 elongated
  // aspect ratio) around a smooth blue-white synchrotron-radiation glow
  // from the central pulsar — a genuinely different emission mechanism
  // (relativistic electrons, not an atomic transition) from every other
  // colour source in this file. ACCURATE structure; the smooth-core/noisy-
  // edge distinction is approximated via density-weighted colour mixing
  // (colA favoured where local density is highest, near shape centre)
  // rather than spatially-varying noise — a named SIMPLIFICATION.
  {
    id: "m1",
    ra: 83.63,
    dec: 22.01,
    ly: 6500,
    colA: [0.75, 0.82, 0.95],
    colB: [0.85, 0.3, 0.35],
    seed: 75.5,
    shape: { kind: "ellipsoid", semiAxes: [0.5, 0.36, 0.62] },
  },
  // Ring Nebula (M57) — ACCURATE: THE archetype the term "ring nebula"
  // comes from. Torus rim (real ionization-stratified red H-alpha) + inner
  // ellipsoid "football" glow (real O III), directly matching one of the
  // most-imaged planetary nebulae in amateur and professional astronomy.
  {
    id: "m57",
    ra: 283.396,
    dec: 33.029,
    ly: 2280,
    colA: [0.45, 0.85, 0.8],
    colB: [0.85, 0.35, 0.3],
    seed: 86.2,
    shape: {
      kind: "union",
      shapes: [
        { kind: "torus", majorRadius: 0.55, minorRadius: 0.3 },
        { kind: "ellipsoid", semiAxes: [0.4, 0.25, 0.4] },
      ],
    },
  },
  // Trifid Nebula (M20) — combined emission (red H-alpha) + reflection
  // (blue, scattered starlight) nebula, split into 3 lobes by real dark
  // dust lanes. ACCURATE technique: lanes modelled as density SUBTRACTION
  // (real extinction removes light, it isn't a dark colour) via 3 thin
  // capped-cone "wedges" radiating outward. SIMPLIFIED: real lane geometry
  // is more irregular than 3 clean radiating cuts, and the separate blue
  // reflection-nebula component (a real, physically distinct region
  // offset to one side) is approximated via colB's blue tint on the main
  // body rather than a fully separate shape+colour region.
  {
    id: "ngc6514",
    ra: 270.62,
    dec: -22.972,
    ly: 4100,
    colA: [0.9, 0.35, 0.3],
    colB: [0.55, 0.55, 0.85],
    seed: 97.8,
    shape: {
      kind: "subtract",
      base: { kind: "sphere" },
      cut: {
        kind: "union",
        shapes: [
          {
            kind: "cappedCone",
            dir: [1, 0.15, 0.2],
            offset: 0,
            height: 0.95,
            rTip: 0.05,
            rBase: 0.07,
            edge: 0.06,
          },
          {
            kind: "cappedCone",
            dir: [-0.6, 0.15, 0.75],
            offset: 0,
            height: 0.95,
            rTip: 0.05,
            rBase: 0.07,
            edge: 0.06,
          },
          {
            kind: "cappedCone",
            dir: [-0.6, 0.15, -0.75],
            offset: 0,
            height: 0.95,
            rTip: 0.05,
            rBase: 0.07,
            edge: 0.06,
          },
        ],
      },
    },
  },
];

export const NEBULA_VOLUMES: NebulaVolume[] = NEBULA_SOURCES.map((s) => {
  const { pos, depth } = bodyWorldPosition(s.ra, s.dec, s.ly);
  return {
    id: s.id,
    center: pos,
    radius: depth * NEBULA_RADIUS_FACTOR,
    colA: s.colA,
    colB: s.colB,
    seed: s.seed,
    shape: s.shape,
  };
});

/* ---------- JS mirrors of the shader arithmetic --------------------------
 *
 * Same convention as shooting-stars.ts / star-field.ts: the GLSL and WGSL
 * twins are a contract with no compiler to check them against each other, so
 * the shared arithmetic is mirrored here and pinned by unit tests. Mirrors
 * use double precision where the GPU uses float32 — tests assert structure
 * (ranges, monotonicity, falloff), not bit-exact GPU equality. */

/** Rotate a vector by a unit quaternion: v' = v + 2*qw*(qxyz × v) + 2*(qxyz × (qxyz × v)).
 * Used by the engine to turn the camera quaternion into the ray-basis
 * uniforms (right/up/forward) the raymarch consumes. */
export function quatRotate(
  q: Quat,
  v: [number, number, number],
): [number, number, number] {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Lattice hash in [0, 1) — fract(sin(dot(p, k) + seed*17)*43758.5453),
 * the same construction both shader twins use. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  const d = x * 127.1 + y * 311.7 + z * 74.7 + seed * 17.0;
  const s = Math.sin(d) * 43758.5453;
  return s - Math.floor(s);
}

const smooth01 = (t: number) => t * t * (3 - 2 * t);

/** Trilinear value noise in [0, 1]. */
export function valueNoise3(
  x: number,
  y: number,
  z: number,
  seed: number,
): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = smooth01(x - ix),
    fy = smooth01(y - iy),
    fz = smooth01(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) =>
    hash3(ix + dx, iy + dy, iz + dz, seed);
  return lerp(
    lerp(
      lerp(c(0, 0, 0), c(1, 0, 0), fx),
      lerp(c(0, 1, 0), c(1, 1, 0), fx),
      fy,
    ),
    lerp(
      lerp(c(0, 0, 1), c(1, 0, 1), fx),
      lerp(c(0, 1, 1), c(1, 1, 1), fx),
      fy,
    ),
    fz,
  );
}

/** 4-octave fbm in [0, ~0.94]. Lacunarity 2.02 (not exactly 2 — avoids
 * lattice-aligned octaves reinforcing into visible grid artefacts). */
export function fbm3(x: number, y: number, z: number, seed: number): number {
  let amp = 0.5;
  let sum = 0;
  let px = x,
    py = y,
    pz = z;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise3(px, py, pz, seed);
    px *= 2.02;
    py *= 2.02;
    pz *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

/** Ray/sphere intersection. Returns null on a miss, else [t0, t1] (t0 may be
 * negative when the origin is inside the sphere). `rd` must be unit length. */
export function raySphere(
  ro: [number, number, number],
  rd: [number, number, number],
  c: [number, number, number],
  r: number,
): [number, number] | null {
  const ox = ro[0] - c[0],
    oy = ro[1] - c[1],
    oz = ro[2] - c[2];
  const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

const SPHERE_SHAPE: NebulaShape = { kind: "sphere" };

/** Gas density at a world point: shape-container falloff × thresholded fbm.
 * Zero at/beyond the shape's boundary by construction. `timeS` drives the
 * slow domain drift (pass 0 for the reduced-motion/static result). Shape
 * defaults to `sphere` — reproduces the original radial-only formula exactly
 * for the 4 pre-existing showcase volumes (ADR-0004, 2026-07-20 amendment). */
export function nebulaDensity(
  p: [number, number, number],
  vol: NebulaVolume,
  timeS: number,
): number {
  const t = NEBULA_MARCH;
  const rx = p[0] - vol.center[0],
    ry = p[1] - vol.center[1],
    rz = p[2] - vol.center[2];
  const q = shapeQ(vol.shape ?? SPHERE_SHAPE, [
    rx / vol.radius,
    ry / vol.radius,
    rz / vol.radius,
  ]);
  if (q >= 1) return 0;
  // 1 - smoothstep(shellInner, 1, q): both twins use this exact portable
  // form (smoothstep with descending edges is undefined in GLSL).
  const st = Math.min(1, Math.max(0, (q - t.shellInner) / (1 - t.shellInner)));
  const shell = 1 - smooth01(st);
  const f = t.noiseFreq / vol.radius;
  const drift = timeS * t.driftRate;
  const n = fbm3(
    rx * f + drift,
    ry * f + drift * 0.7,
    rz * f - drift * 0.5,
    vol.seed,
  );
  const thr = t.thresholdBase + t.thresholdEdge * q * q;
  return Math.max(0, n - thr) * shell * t.densityGain;
}

/** Front-to-back emission/absorption march through one volume. Returns
 * [r, g, b, coverage] where coverage = 1 - transmittance. The composite pass
 * adds rgb to the frame; coverage is diagnostic. */
export function marchNebula(
  ro: [number, number, number],
  rd: [number, number, number],
  vol: NebulaVolume,
  timeS: number,
  steps: number,
  reveal = 1,
): [number, number, number, number] {
  const t = NEBULA_MARCH;
  // destination-gated reveal: density scales with reveal, so low reveal both
  // dims the gas AND shrinks its apparent extent (thin fringes drop below
  // visibility first) — reads as the cloud growing in, not a crossfade
  if (reveal <= 0.004) return [0, 0, 0, 0];
  const hit = raySphere(ro, rd, vol.center, vol.radius);
  if (!hit) return [0, 0, 0, 0];
  const tA = Math.max(hit[0], 0);
  if (hit[1] <= tA) return [0, 0, 0, 0];
  const dt = (hit[1] - tA) / steps;
  const dtN = dt / vol.radius;
  let trans = 1;
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < steps; i++) {
    const tt = tA + (i + 0.5) * dt;
    const p: [number, number, number] = [
      ro[0] + rd[0] * tt,
      ro[1] + rd[1] * tt,
      ro[2] + rd[2] * tt,
    ];
    const d = nebulaDensity(p, vol, timeS) * reveal;
    if (d <= 0) continue;
    const a = 1 - Math.exp(-d * dtN * t.extinction);
    const mixK = Math.min(1, d * t.colorSharp);
    const w = trans * a * t.brightness;
    r += w * (vol.colB[0] + (vol.colA[0] - vol.colB[0]) * mixK);
    g += w * (vol.colB[1] + (vol.colA[1] - vol.colB[1]) * mixK);
    b += w * (vol.colB[2] + (vol.colA[2] - vol.colB[2]) * mixK);
    trans *= 1 - a;
    if (trans < t.transmittanceFloor) break;
  }
  return [r, g, b, 1 - trans];
}

/* ---------- shader source generators -------------------------------------
 *
 * Volume constants and tuning are baked as literals — no uniform arrays, no
 * UBO layout for per-volume data, and the unrolled per-volume march
 * functions mean each texel only marches segments of shapes its ray
 * actually hits. Generated sources are unit-tested for structure and for
 * WGSL reserved identifiers.
 *
 * SHAPE GENERALIZATION (ADR-0004, 2026-07-20 amendment). Each volume gets
 * its own generated `nebMarch{i}` function (the march LOOP is duplicated
 * per volume — GLSL/WGSL have no function pointers, so a per-volume density
 * callback isn't expressible any other way; this is the same "baked, not
 * shared via indirection" trade-off ADR-0004 already made for constants).
 * What IS shared across every volume: the noise stack (nebHash/nebNoise/
 * nebFbm), the shape-primitive `nebQ*` helpers, and `nebDensityQ` (the
 * shell/threshold/noise math, now taking a precomputed `q` instead of
 * assuming a sphere). Adding a volume never touches any of these — only
 * NEBULA_VOLUMES (one more descriptor) and, if it needs a primitive kind
 * that doesn't exist yet, one more `nebQ*` case + one more `shapeExpr`
 * dispatcher arm. That is the SOLID open/closed boundary this amendment
 * introduces. */

const f6 = (n: number) => n.toFixed(6);

/** Recursively compiles a NebulaShape into a GLSL expression string
 * computing its "q" (0 at core, 1 at boundary, >1 outside — see shapeQ's
 * own doc comment for why this isn't a literal signed-distance field). `p`
 * is the name of an in-scope `vec3` holding the point in the volume's
 * radius-normalized unit space. Mirrors `shapeQ` case-for-case; the JS
 * mirror is what unit tests pin numerically. */
function glslShapeExpr(shape: NebulaShape, p: string): string {
  switch (shape.kind) {
    case "sphere":
      return `nebQSphere(${p})`;
    case "torus":
      return `nebQTorus(${p}, ${f6(shape.majorRadius)}, ${f6(shape.minorRadius)})`;
    case "cappedCone":
      return `nebQCone(${p}, vec3(${f6(shape.dir[0])}, ${f6(shape.dir[1])}, ${f6(shape.dir[2])}), ${f6(shape.offset)}, ${f6(shape.height)}, ${f6(shape.rTip)}, ${f6(shape.rBase)}, ${f6(shape.edge)})`;
    case "box":
      return `nebQBox(${p}, vec3(${f6(shape.halfExtents[0])}, ${f6(shape.halfExtents[1])}, ${f6(shape.halfExtents[2])}), ${f6(shape.edge)})`;
    case "ellipsoid":
      return `nebQEllipsoid(${p}, vec3(${f6(shape.semiAxes[0])}, ${f6(shape.semiAxes[1])}, ${f6(shape.semiAxes[2])}))`;
    case "shell":
      return `nebQShell(${p}, ${f6(shape.radius)}, ${f6(shape.thickness)})`;
    case "union":
      return shape.shapes
        .map((s) => glslShapeExpr(s, p))
        .reduce((acc, e) => `min(${acc}, ${e})`);
    case "subtract": {
      const qBase = glslShapeExpr(shape.base, p);
      const qCut = glslShapeExpr(shape.cut, p);
      return `((${qCut}) < 1.0 ? 999.0 : (${qBase}))`;
    }
  }
}

/** WGSL twin of glslShapeExpr — same recursive structure, `?:` replaced by
 * `select()` (WGSL has no ternary operator). */
function wgslShapeExpr(shape: NebulaShape, p: string): string {
  switch (shape.kind) {
    case "sphere":
      return `nebQSphere(${p})`;
    case "torus":
      return `nebQTorus(${p}, ${f6(shape.majorRadius)}, ${f6(shape.minorRadius)})`;
    case "cappedCone":
      return `nebQCone(${p}, vec3<f32>(${f6(shape.dir[0])}, ${f6(shape.dir[1])}, ${f6(shape.dir[2])}), ${f6(shape.offset)}, ${f6(shape.height)}, ${f6(shape.rTip)}, ${f6(shape.rBase)}, ${f6(shape.edge)})`;
    case "box":
      return `nebQBox(${p}, vec3<f32>(${f6(shape.halfExtents[0])}, ${f6(shape.halfExtents[1])}, ${f6(shape.halfExtents[2])}), ${f6(shape.edge)})`;
    case "ellipsoid":
      return `nebQEllipsoid(${p}, vec3<f32>(${f6(shape.semiAxes[0])}, ${f6(shape.semiAxes[1])}, ${f6(shape.semiAxes[2])}))`;
    case "shell":
      return `nebQShell(${p}, ${f6(shape.radius)}, ${f6(shape.thickness)})`;
    case "union":
      return shape.shapes
        .map((s) => wgslShapeExpr(s, p))
        .reduce((acc, e) => `min(${acc}, ${e})`);
    case "subtract": {
      const qBase = wgslShapeExpr(shape.base, p);
      const qCut = wgslShapeExpr(shape.cut, p);
      return `select(999.0, ${qBase}, (${qCut}) >= 1.0)`;
    }
  }
}

/** The 2-slot reveal expression: volume `i`'s reveal is `revealA` if it's
 * the active slot, `revealB` if it's the previous/departing slot, else 0 —
 * see the ADR-0004 2026-07-20 amendment for why 2 fixed slots (not one per
 * volume) is both sufficient and O(1) in volume count. */
function glslRevealExpr(i: number): string {
  return `(${f6(i)} == uVolumeA ? uRevealA : (${f6(i)} == uVolumeB ? uRevealB : 0.0))`;
}
function wgslRevealExpr(i: number): string {
  return `select(select(0.0, params.uRevealB, ${f6(i)} == params.uVolumeB), params.uRevealA, ${f6(i)} == params.uVolumeA)`;
}

function glslShared(): string {
  const t = NEBULA_MARCH;
  return `
float nebHash(vec3 p, float hseed){
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + hseed*17.0)*43758.5453);
}
float nebNoise(vec3 p, float hseed){
  vec3 ip = floor(p);
  vec3 fp = p - ip;
  vec3 u = fp*fp*(3.0-2.0*fp);
  float n000 = nebHash(ip + vec3(0.0,0.0,0.0), hseed);
  float n100 = nebHash(ip + vec3(1.0,0.0,0.0), hseed);
  float n010 = nebHash(ip + vec3(0.0,1.0,0.0), hseed);
  float n110 = nebHash(ip + vec3(1.0,1.0,0.0), hseed);
  float n001 = nebHash(ip + vec3(0.0,0.0,1.0), hseed);
  float n101 = nebHash(ip + vec3(1.0,0.0,1.0), hseed);
  float n011 = nebHash(ip + vec3(0.0,1.0,1.0), hseed);
  float n111 = nebHash(ip + vec3(1.0,1.0,1.0), hseed);
  return mix(
    mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
    mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y),
    u.z);
}
float nebFbm(vec3 p, float hseed){
  float amp = 0.5;
  float sum = 0.0;
  for (int o = 0; o < 4; o++){
    sum += amp * nebNoise(p, hseed);
    p *= 2.02;
    amp *= 0.5;
  }
  return sum;
}
float nebQSphere(vec3 p){ return length(p); }
float nebQTorus(vec3 p, float majorR, float minorR){
  float ringDist = length(p.xz) - majorR;
  return length(vec2(ringDist, p.y)) / minorR;
}
vec3 nebAlignToAxis(vec3 p, vec3 dir){
  vec3 d = normalize(dir);
  vec3 helper = (abs(d.y) < 0.99) ? vec3(0.0,1.0,0.0) : vec3(1.0,0.0,0.0);
  vec3 right = normalize(cross(d, helper));
  vec3 up = cross(d, right);
  return vec3(dot(p, right), dot(p, d), dot(p, up));
}
float nebQCone(vec3 p, vec3 dir, float offset, float height, float rTip, float rBase, float edge){
  vec3 lp = nebAlignToAxis(p, dir);
  float y = lp.y - offset;
  if (y < 0.0 || y > height) return 999.0;
  float tt = clamp(y / height, 0.0, 1.0);
  float rAtY = rTip + (rBase - rTip) * tt;
  float radial = length(lp.xz);
  return abs(radial - rAtY) / edge;
}
float nebQBox(vec3 p, vec3 halfExt, float edge){
  vec3 d = abs(p) - halfExt;
  float outsideDist = length(max(d, 0.0));
  float insideDist = min(max(d.x, max(d.y, d.z)), 0.0);
  return (outsideDist + insideDist) / edge + 1.0;
}
float nebQEllipsoid(vec3 p, vec3 semiAxes){
  return length(p / semiAxes);
}
float nebQShell(vec3 p, float radius, float thickness){
  return abs(length(p) - radius) / thickness;
}
float nebDensityQ(vec3 rel, float r, float dseed, float timeS, float q){
  if (q >= 1.0) return 0.0;
  float shell = 1.0 - smoothstep(${f6(t.shellInner)}, 1.0, q);
  float drift = timeS * ${f6(t.driftRate)};
  vec3 np = rel * (${f6(t.noiseFreq)} / r) + vec3(drift, drift*0.7, -drift*0.5);
  float n = nebFbm(np, dseed);
  float thr = ${f6(t.thresholdBase)} + ${f6(t.thresholdEdge)}*q*q;
  return max(0.0, n - thr) * shell * ${f6(t.densityGain)};
}`;
}

/** One generated `nebMarch{i}` function per volume — the march loop itself
 * (identical structure to the pre-amendment shared `nebMarch`) plus this
 * volume's baked centre/radius/colours/shape. */
function glslVolumeMarchFn(v: NebulaVolume, i: number, steps: number): string {
  const t = NEBULA_MARCH;
  const qExpr = glslShapeExpr(v.shape ?? { kind: "sphere" }, "pu");
  return `
vec4 nebMarch${i}(vec3 ro, vec3 rd, float timeS, float rev){
  if (rev <= 0.004) return vec4(0.0);
  vec3 c = vec3(${f6(v.center[0])}, ${f6(v.center[1])}, ${f6(v.center[2])});
  float r = ${f6(v.radius)};
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r*r;
  float disc = b*b - cc;
  if (disc < 0.0) return vec4(0.0);
  float s = sqrt(disc);
  float tA = max(-b - s, 0.0);
  float tB = -b + s;
  if (tB <= tA) return vec4(0.0);
  float dt = (tB - tA) / ${f6(steps)};
  float trans = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${steps}; i++){
    float tt = tA + (float(i) + 0.5) * dt;
    vec3 rel = (ro + rd*tt) - c;
    vec3 pu = rel / r;
    float q = ${qExpr};
    float d = nebDensityQ(rel, r, ${f6(v.seed)}, timeS, q) * rev;
    if (d <= 0.0) continue;
    float a = 1.0 - exp(-d * (dt/r) * ${f6(t.extinction)});
    float mixK = min(1.0, d * ${f6(t.colorSharp)});
    col += trans * a * ${f6(t.brightness)} * mix(vec3(${f6(v.colB[0])}, ${f6(v.colB[1])}, ${f6(v.colB[2])}), vec3(${f6(v.colA[0])}, ${f6(v.colA[1])}, ${f6(v.colA[2])}), mixK);
    trans *= 1.0 - a;
    if (trans < ${f6(t.transmittanceFloor)}) break;
  }
  return vec4(col, 1.0 - trans);
}`;
}

function glslVolumeCalls(volumes: NebulaVolume[]): string {
  return volumes
    .map(
      (_v, i) => `  {
    vec4 nv = nebMarch${i}(uCamPos, rd, uTime, ${glslRevealExpr(i)});
    col += nv.rgb;
    cover = max(cover, nv.a);
  }`,
    )
    .join("\n");
}

/** GLSL fragment source for the WebGL2 fallback producer (Babylon
 * ProceduralTexture supplies the fullscreen pass and the `vUV` varying).
 * GL pair convention: no y-flip anywhere — vUV.y and clip-space y agree. */
export function nebulaGlslFragment(
  volumes: NebulaVolume[] = NEBULA_VOLUMES,
  steps: number = NEBULA_MARCH.stepsFragment,
): string {
  return `precision highp float;
varying vec2 vUV;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanFov;
uniform float uAspect;
uniform float uTime;
uniform float uVolumeA;
uniform float uRevealA;
uniform float uVolumeB;
uniform float uRevealB;
${glslShared()}
${volumes.map((v, i) => glslVolumeMarchFn(v, i, steps)).join("\n")}
void main(){
  vec2 ndc = vUV * 2.0 - 1.0;
  vec3 rd = normalize(uCamFwd
    + uCamRight * (ndc.x * uTanFov * uAspect)
    + uCamUp * (ndc.y * uTanFov));
  vec3 col = vec3(0.0);
  float cover = 0.0;
${glslVolumeCalls(volumes)}
  gl_FragColor = vec4(col, cover);
}`;
}

function wgslShared(): string {
  const t = NEBULA_MARCH;
  return `
fn nebHash(p : vec3<f32>, hseed : f32) -> f32 {
  return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7)) + hseed*17.0)*43758.5453);
}
fn nebNoise(p : vec3<f32>, hseed : f32) -> f32 {
  let ip : vec3<f32> = floor(p);
  let fp : vec3<f32> = p - ip;
  let u : vec3<f32> = fp*fp*(3.0-2.0*fp);
  let n000 : f32 = nebHash(ip + vec3<f32>(0.0,0.0,0.0), hseed);
  let n100 : f32 = nebHash(ip + vec3<f32>(1.0,0.0,0.0), hseed);
  let n010 : f32 = nebHash(ip + vec3<f32>(0.0,1.0,0.0), hseed);
  let n110 : f32 = nebHash(ip + vec3<f32>(1.0,1.0,0.0), hseed);
  let n001 : f32 = nebHash(ip + vec3<f32>(0.0,0.0,1.0), hseed);
  let n101 : f32 = nebHash(ip + vec3<f32>(1.0,0.0,1.0), hseed);
  let n011 : f32 = nebHash(ip + vec3<f32>(0.0,1.0,1.0), hseed);
  let n111 : f32 = nebHash(ip + vec3<f32>(1.0,1.0,1.0), hseed);
  return mix(
    mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
    mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y),
    u.z);
}
fn nebFbm(p0 : vec3<f32>, hseed : f32) -> f32 {
  var amp : f32 = 0.5;
  var sum : f32 = 0.0;
  var p : vec3<f32> = p0;
  for (var o : i32 = 0; o < 4; o = o + 1){
    sum = sum + amp * nebNoise(p, hseed);
    p = p * 2.02;
    amp = amp * 0.5;
  }
  return sum;
}
fn nebQSphere(p : vec3<f32>) -> f32 { return length(p); }
fn nebQTorus(p : vec3<f32>, majorR : f32, minorR : f32) -> f32 {
  let ringDist : f32 = length(p.xz) - majorR;
  return length(vec2<f32>(ringDist, p.y)) / minorR;
}
fn nebAlignToAxis(p : vec3<f32>, dir : vec3<f32>) -> vec3<f32> {
  let d : vec3<f32> = normalize(dir);
  let helper : vec3<f32> = select(vec3<f32>(1.0,0.0,0.0), vec3<f32>(0.0,1.0,0.0), abs(d.y) < 0.99);
  let right : vec3<f32> = normalize(cross(d, helper));
  let up : vec3<f32> = cross(d, right);
  return vec3<f32>(dot(p, right), dot(p, d), dot(p, up));
}
fn nebQCone(p : vec3<f32>, dir : vec3<f32>, offset : f32, height : f32, rTip : f32, rBase : f32, edge : f32) -> f32 {
  let lp : vec3<f32> = nebAlignToAxis(p, dir);
  let y : f32 = lp.y - offset;
  if (y < 0.0 || y > height) { return 999.0; }
  let tt : f32 = clamp(y / height, 0.0, 1.0);
  let rAtY : f32 = rTip + (rBase - rTip) * tt;
  let radial : f32 = length(lp.xz);
  return abs(radial - rAtY) / edge;
}
fn nebQBox(p : vec3<f32>, halfExt : vec3<f32>, edge : f32) -> f32 {
  let d : vec3<f32> = abs(p) - halfExt;
  let outsideDist : f32 = length(max(d, vec3<f32>(0.0)));
  let insideDist : f32 = min(max(d.x, max(d.y, d.z)), 0.0);
  return (outsideDist + insideDist) / edge + 1.0;
}
fn nebQEllipsoid(p : vec3<f32>, semiAxes : vec3<f32>) -> f32 {
  return length(p / semiAxes);
}
fn nebQShell(p : vec3<f32>, radius : f32, thickness : f32) -> f32 {
  return abs(length(p) - radius) / thickness;
}
fn nebDensityQ(rel : vec3<f32>, r : f32, dseed : f32, timeS : f32, q : f32) -> f32 {
  if (q >= 1.0) { return 0.0; }
  let shell : f32 = 1.0 - smoothstep(${f6(t.shellInner)}, 1.0, q);
  let drift : f32 = timeS * ${f6(t.driftRate)};
  let np : vec3<f32> = rel * (${f6(t.noiseFreq)} / r) + vec3<f32>(drift, drift*0.7, -drift*0.5);
  let n : f32 = nebFbm(np, dseed);
  let thr : f32 = ${f6(t.thresholdBase)} + ${f6(t.thresholdEdge)}*q*q;
  return max(0.0, n - thr) * shell * ${f6(t.densityGain)};
}`;
}

function wgslVolumeMarchFn(v: NebulaVolume, i: number, steps: number): string {
  const t = NEBULA_MARCH;
  const qExpr = wgslShapeExpr(v.shape ?? { kind: "sphere" }, "pu");
  return `
fn nebMarch${i}(ro : vec3<f32>, rd : vec3<f32>, timeS : f32, rev : f32) -> vec4<f32> {
  if (rev <= 0.004) { return vec4<f32>(0.0); }
  let c : vec3<f32> = vec3<f32>(${f6(v.center[0])}, ${f6(v.center[1])}, ${f6(v.center[2])});
  let r : f32 = ${f6(v.radius)};
  let oc : vec3<f32> = ro - c;
  let b : f32 = dot(oc, rd);
  let cc : f32 = dot(oc, oc) - r*r;
  let disc : f32 = b*b - cc;
  if (disc < 0.0) { return vec4<f32>(0.0); }
  let s : f32 = sqrt(disc);
  let tA : f32 = max(-b - s, 0.0);
  let tB : f32 = -b + s;
  if (tB <= tA) { return vec4<f32>(0.0); }
  let dt : f32 = (tB - tA) / ${f6(steps)};
  var trans : f32 = 1.0;
  var col : vec3<f32> = vec3<f32>(0.0);
  for (var i : i32 = 0; i < ${steps}; i = i + 1){
    let tt : f32 = tA + (f32(i) + 0.5) * dt;
    let rel : vec3<f32> = (ro + rd*tt) - c;
    let pu : vec3<f32> = rel / r;
    let q : f32 = ${qExpr};
    let d : f32 = nebDensityQ(rel, r, ${f6(v.seed)}, timeS, q) * rev;
    if (d > 0.0) {
      let a : f32 = 1.0 - exp(-d * (dt/r) * ${f6(t.extinction)});
      let mixK : f32 = min(1.0, d * ${f6(t.colorSharp)});
      col = col + trans * a * ${f6(t.brightness)} * mix(vec3<f32>(${f6(v.colB[0])}, ${f6(v.colB[1])}, ${f6(v.colB[2])}), vec3<f32>(${f6(v.colA[0])}, ${f6(v.colA[1])}, ${f6(v.colA[2])}), mixK);
      trans = trans * (1.0 - a);
      if (trans < ${f6(t.transmittanceFloor)}) { break; }
    }
  }
  return vec4<f32>(col, 1.0 - trans);
}`;
}

function wgslVolumeCalls(volumes: NebulaVolume[]): string {
  return volumes
    .map(
      (_v, i) => `  {
    let nv : vec4<f32> = nebMarch${i}(params.camPos, rd, params.uTime, ${wgslRevealExpr(i)});
    col = col + nv.rgb;
    cover = max(cover, nv.w);
  }`,
    )
    .join("\n");
}

/** WGSL compute source for the WebGPU producer. The Params struct layout must
 * match the UniformBuffer built in babylon-engine.ts field-for-field (vec3 +
 * f32 pairs pack into single 16-byte std140 slots on both sides).
 * WebGPU pair convention: texel row 0 is the TOP, so ndc.y flips here and the
 * composite WGSL twin flips its sample V to match. */
export function nebulaWgslCompute(
  volumes: NebulaVolume[] = NEBULA_VOLUMES,
  steps: number = NEBULA_MARCH.stepsCompute,
): string {
  return `struct Params {
  camPos : vec3<f32>,
  uTanFov : f32,
  camRight : vec3<f32>,
  uAspect : f32,
  camUp : vec3<f32>,
  uTime : f32,
  camFwd : vec3<f32>,
  pad0 : f32,
  uVolumeA : f32,
  uRevealA : f32,
  uVolumeB : f32,
  uRevealB : f32,
};
@group(0) @binding(0) var<uniform> params : Params;
@group(0) @binding(1) var outTex : texture_storage_2d<rgba8unorm, write>;
${wgslShared()}
${volumes.map((v, i) => wgslVolumeMarchFn(v, i, steps)).join("\n")}
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims : vec2<u32> = textureDimensions(outTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv : vec2<f32> = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5) / vec2<f32>(f32(dims.x), f32(dims.y));
  let ndc : vec2<f32> = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let rd : vec3<f32> = normalize(params.camFwd
    + params.camRight * (ndc.x * params.uTanFov * params.uAspect)
    + params.camUp * (ndc.y * params.uTanFov));
  var col : vec3<f32> = vec3<f32>(0.0);
  var cover : f32 = 0.0;
${wgslVolumeCalls(volumes)}
  textureStore(outTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), cover));
}`;
}

/** Identifiers reserved by the WGSL spec that have actually bitten this
 * codebase (TR-045: `meta`, `ref`) plus near-miss candidates a generated
 * source could plausibly introduce. Exported so the unit test and any future
 * generator share one list. */
export const WGSL_RESERVED_IDENTIFIERS = [
  "meta",
  "ref",
  "filter",
  "common",
  "handle",
  "auto",
  "typedef",
  "union",
] as const;
