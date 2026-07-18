/* star-field.ts — PF-09 B1: procedural star positions for the Babylon parity
 * spike.
 *
 * A representative point cloud (default 168k, matching the live catalog count)
 * on a spherical shell, each point carrying a size and a colour-ramp index.
 * Its job is to measure Babylon's cost of rendering that many shaded points —
 * the fps-critical crux of the B1 go/no-go gate — WITHOUT yet porting the
 * streaming binary catalog + photometric pipeline (that is B1-continued / B2).
 *
 * Deterministic (seeded LCG, no Math.random) so it is unit-testable and so the
 * spike renders the same field on every run / device during measurement.
 */

export interface StarField {
  /** xyz per point (count * 3). */
  positions: Float32Array;
  /** [size 0..1, colorT 0..1] per point (count * 2). */
  meta: Float32Array;
  count: number;
}

/** Live catalog point count (see TR-023 / space-engine stream). */
export const LIVE_STAR_COUNT = 168959;

/** Billboard-quad geometry for the star field (4 verts + 6 indices per star).
 *
 * PF-09 B1 findings that force this shape:
 *  1. **WebGPU has no `gl_PointSize` equivalent** — WGSL dropped the
 *     `point_size` builtin, `point-list` renders 1x1 px, and Babylon ignores
 *     `pointSize` on its WebGPU backend. Variable-size point sprites (what the
 *     live engine uses) simply cannot port; stars must be quads.
 *  2. Babylon **thin instances require a `matrix` buffer** — setting only
 *     custom per-instance buffers leaves `thinInstanceCount` at 0 and nothing
 *     draws. Rather than carry ~10.8 MB of per-star matrices, the spike merges
 *     every quad into one indexed mesh: no instancing machinery, identical on
 *     both backends. Cost: ~23 MB of vertex data (see TR-029) — swapping this
 *     for matrix-backed instancing is a B1-continued optimisation.
 *
 * Each vertex carries the star centre plus `corner` = (cx, cy, size, colourT);
 * the vertex shader billboards the corner in view space.
 */
export interface StarBillboards {
  /** star centre xyz, repeated per corner (verts * 3). */
  positions: Float32Array;
  /** cornerX, cornerY, size, colourT (verts * 4). */
  corners: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  count: number;
}

const CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

export function buildStarBillboards(field: StarField): StarBillboards {
  const { count } = field;
  const vertexCount = count * 4;
  const positions = new Float32Array(vertexCount * 3);
  const corners = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(count * 6);
  for (let i = 0; i < count; i++) {
    const x = field.positions[i * 3];
    const y = field.positions[i * 3 + 1];
    const z = field.positions[i * 3 + 2];
    const size = field.meta[i * 2];
    const colT = field.meta[i * 2 + 1];
    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      positions[v * 3] = x;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = z;
      corners[v * 4] = CORNERS[c][0];
      corners[v * 4 + 1] = CORNERS[c][1];
      corners[v * 4 + 2] = size;
      corners[v * 4 + 3] = colT;
    }
    const o = i * 6;
    indices[o] = v0;
    indices[o + 1] = v0 + 1;
    indices[o + 2] = v0 + 2;
    indices[o + 3] = v0;
    indices[o + 4] = v0 + 2;
    indices[o + 5] = v0 + 3;
  }
  return { positions, corners, indices, vertexCount, count };
}

export function buildStarField(
  count: number = LIVE_STAR_COUNT,
  radius = 400,
  seed = 1,
): StarField {
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 2);
  let s = seed >>> 0 || 1;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < count; i++) {
    // uniform direction on the unit sphere, jittered shell radius
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = Math.sqrt(Math.max(0, 1 - u * u));
    const rr = radius * (0.6 + 0.4 * rnd());
    positions[i * 3] = Math.cos(th) * r * rr;
    positions[i * 3 + 1] = Math.sin(th) * r * rr;
    positions[i * 3 + 2] = u * rr;
    meta[i * 2] = 0.3 + rnd() * 0.7; // point size factor
    meta[i * 2 + 1] = rnd(); // colour-ramp t (O→M)
  }
  return { positions, meta, count };
}
