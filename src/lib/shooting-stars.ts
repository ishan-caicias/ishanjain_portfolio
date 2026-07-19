/* shooting-stars.ts — PF-09 B3: GPU-particle idle shooting stars.
 *
 * NOT a port — grepping space-engine.js confirms it has no shooting-star or
 * idle-particle system at all (only the F3 plume/embers, which are ship-
 * engine-attached and CPU-stepped, re-uploaded every frame). This is new
 * work, and genuinely GPU-driven: every particle's current head/tail
 * position, taper and fade are computed in the vertex shader from `uTime`
 * alone. Once the buffer is built, there is zero per-frame CPU cost — no
 * stepping function, no re-upload, unlike the live engine's ember pattern.
 *
 * A particle cycles continuously: `age = (uTime + seed*cycle) mod cycle`
 * gives each of the N particles a distinct, endlessly-repeating phase from a
 * single shared cycle length, so the whole system is stateless after setup.
 *
 * Geometry: one tapered quad per particle (wide head, narrow tail) — not a
 * `LINES` primitive. TR-029 already established that thin GPU primitives
 * (there: point sprites) don't render consistently across the WebGL2/WebGPU
 * backends; a quad is the proven, reliable choice this codebase already
 * standardised on for the star billboards.
 */
import { travelFrame } from "./ship-dynamics";

export interface ShootingStars {
  /** Spawn/head-at-age-0 position, repeated per corner (verts * 3). */
  positions: Float32Array;
  /** Unit direction of travel, repeated per corner (verts * 3). */
  dirs: Float32Array;
  /** [speed, length, width, seed] per corner (verts * 4). */
  meta: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  count: number;
}

/** Deterministic seeded RNG (LCG) — same construction as star-field.ts's
 * buildStarField, so this stays unit-testable without Math.random. */
function makeRng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

/** Builds `count` shooting-star particles on a shell of `radius`, each with a
 * random tangential direction (perpendicular to its own radial vector, so it
 * streaks across the sky rather than toward/away from the camera at the
 * shell's centre). `travelFrame` supplies the perpendicular basis — reused
 * here exactly as it is for the chase camera, just with the radial direction
 * standing in for "the direction we don't want to travel along". */
export function buildShootingStars(
  count = 24,
  radius = 220,
  seed = 1,
): ShootingStars {
  const vertexCount = count * 4;
  const positions = new Float32Array(vertexCount * 3);
  const dirs = new Float32Array(vertexCount * 3);
  const meta = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(count * 6);
  const rnd = makeRng(seed);

  for (let i = 0; i < count; i++) {
    // random point on the shell
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const radial: [number, number, number] = [
      Math.cos(th) * r,
      Math.sin(th) * r,
      u,
    ];
    const start: [number, number, number] = [
      radial[0] * radius,
      radial[1] * radius,
      radial[2] * radius,
    ];
    // random tangential direction: rotate travelFrame(radial)'s (right, up)
    // basis by a random angle in the tangent plane.
    const { right, up } = travelFrame(radial);
    const ang = rnd() * Math.PI * 2;
    const ca = Math.cos(ang),
      sa = Math.sin(ang);
    const dir: [number, number, number] = [
      right[0] * ca + up[0] * sa,
      right[1] * ca + up[1] * sa,
      right[2] * ca + up[2] * sa,
    ];

    const speed = 60 + rnd() * 90; // world units / second
    const length = 6 + rnd() * 10;
    const width = 0.5 + rnd() * 0.7;
    const particleSeed = rnd();

    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      positions[v * 3] = start[0];
      positions[v * 3 + 1] = start[1];
      positions[v * 3 + 2] = start[2];
      dirs[v * 3] = dir[0];
      dirs[v * 3 + 1] = dir[1];
      dirs[v * 3 + 2] = dir[2];
      meta[v * 4] = speed;
      meta[v * 4 + 1] = length;
      meta[v * 4 + 2] = width;
      meta[v * 4 + 3] = particleSeed;
    }
    const o = i * 6;
    indices[o] = v0;
    indices[o + 1] = v0 + 1;
    indices[o + 2] = v0 + 2;
    indices[o + 3] = v0;
    indices[o + 4] = v0 + 2;
    indices[o + 5] = v0 + 3;
  }

  return { positions, dirs, meta, indices, vertexCount, count };
}

/** The shader-side head/tail/fade computation, mirrored in JS so the
 * per-particle lifecycle is testable off-GPU. Corner winding matches
 * star-field.ts's CORNERS table: 0=head-left, 1=head-right, 2=tail-right,
 * 3=tail-left (head corners first, matching `isHead = c < 2`). */
export function cornerIsHead(vertexId: number): boolean {
  return vertexId % 4 < 2;
}

/** age = (uTime + seed*cycleS) mod cycleS — a particle's position in its own
 * repeating cycle, in seconds since this cycle's start. */
export function particleAge(
  uTimeS: number,
  seedFrac: number,
  cycleS: number,
): number {
  const t = uTimeS + seedFrac * cycleS;
  return ((t % cycleS) + cycleS) % cycleS; // always non-negative
}

/** Fade envelope over one cycle: quick fade-in, hold, slower fade-out. */
export function particleFade(ageS: number, cycleS: number): number {
  const t = Math.max(0, Math.min(1, ageS / cycleS));
  const fadeIn = Math.min(1, t / 0.08);
  const fadeOut = t <= 0.65 ? 1 : Math.max(0, 1 - (t - 0.65) / 0.35);
  return fadeIn * fadeOut;
}
