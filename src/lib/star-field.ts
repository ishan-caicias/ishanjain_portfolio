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
 *
 * **B2 step 2 (2026-07-19):** the real catalog now ships via star-catalog.ts and
 * is what the engine draws. This generator is retained as the offline/asset-
 * failure fallback (and as the deterministic fixture for tests), and was updated
 * to emit the same photometric `meta` semantics so the two are interchangeable.
 */
import { packTypeAndColour } from "./star-catalog";

export interface StarField {
  /** xyz per point (count * 3). */
  positions: Float32Array;
  /** Per point (count * 2):
   *   [0] magnitude byte / 255 — the shader applies Pogson's law to it
   *   [1] object type + colour index / 256 (see star-catalog.ts packing)
   *
   * **B2 step 2 semantics change.** These were `[size 0..1, colourT 0..1]`
   * during B1, when the field was procedural and every star was drawn at
   * uniform size and full brightness — the cause of the ~6x apparent density
   * against the live engine (TR-037). Both fields now carry catalog quantities
   * and the shader derives size and alpha photometrically, so the procedural
   * generator and the real decoder produce interchangeable buffers.
   */
  meta: Float32Array;
  count: number;
}

/** Live catalog point count (see TR-023 / space-engine stream). Confirmed at
 * B2 step 2 against the shipped assets: 117,964 Hipparcos + 50,995 Gaia deep
 * records = exactly this. */
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
 *     both backends.
 *
 * **B2 vertex expansion (2026-07-19).** The B1 layout stored a 4-float `corner`
 * attribute per vertex — 10.8 MB, of which the (cx, cy) half is pure redundancy:
 * it is a fixed 4-entry table indexed by `vertexID % 4`. Both shader twins now
 * derive it from `gl_VertexID` (GLSL ES 3.00) / `vertexInputs.vertexIndex`
 * (WGSL), so only (size, colourT) is stored. That is 5.4 MB saved outright,
 * with no per-backend divergence — the derivation is pure integer arithmetic
 * available identically on both.
 *
 * Remaining layout (~17.6 MB for the live count):
 *   positions 8.1 MB · meta 5.4 MB · indices 4.1 MB (Uint32 forced, >65535 verts)
 *
 * **The live engine's ~2.7 MB is NOT a reachable target here** — it gets that by
 * drawing one vertex per star as a point sprite, which WebGPU cannot do at all.
 * `positions` alone is an irreducible 8.1 MB floor while the mesh needs a real
 * per-vertex position attribute. Moving (size, colourT) into a per-star data
 * texture fetched by `vertexID / 4` would take this to ~14.9 MB and is the next
 * available increment; it was not taken here because a float-texture format that
 * silently misbehaves on one backend would risk the WebGPU path we have only
 * just confirmed working on real Android hardware.
 */
export interface StarBillboards {
  /** star centre xyz, repeated per corner (verts * 3). */
  positions: Float32Array;
  /** magNorm, type+colour (verts * 2) — see StarField. The quad corner is NOT
   * stored; both shader twins derive it from the vertex id (see below). */
  meta: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  count: number;
}

/** Corner winding, kept as the single source of truth for the shader twins.
 * Index `c` (= vertexID % 4) maps to (cx, cy); both shaders derive it with
 * `cx = (c == 1 || c == 2) ? 1 : -1`, `cy = (c >= 2) ? 1 : -1`.
 * Exported so a unit test can assert the arithmetic matches this table. */
export const CORNERS: readonly [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1],
];

/** The corner arithmetic the shaders use, in JS, so it is testable off-GPU. */
export function cornerFromVertexId(vertexId: number): [number, number] {
  const c = vertexId % 4;
  return [c === 1 || c === 2 ? 1 : -1, c >= 2 ? 1 : -1];
}

/** PF-11 D7.5: concatenates an already-decoded base field with a freshly-decoded bonus field
 * without re-running the decode over the base bytes — the bonus-layer merge's other audited
 * waste (`_loadBonusStarLayers` previously called `decodeStarCatalog` over
 * `[...baseChunks, ...bonusChunks]` every time, re-parsing the ~168,959 base records it had
 * already decoded once at boot). Pure array concatenation; the caller still rebuilds billboard
 * geometry for the WHOLE merged set afterward — splitting base/bonus into separate meshes to
 * avoid that too is a bigger structural change than this fixes, and is recorded as a follow-up,
 * not attempted here. */
export function mergeStarFields(base: StarField, bonus: StarField): StarField {
  const count = base.count + bonus.count;
  const positions = new Float32Array(count * 3);
  const meta = new Float32Array(count * 2);
  positions.set(base.positions, 0);
  positions.set(bonus.positions, base.count * 3);
  meta.set(base.meta, 0);
  meta.set(bonus.meta, base.count * 2);
  return { positions, meta, count };
}

export function buildStarBillboards(field: StarField): StarBillboards {
  const { count } = field;
  const vertexCount = count * 4;
  const positions = new Float32Array(vertexCount * 3);
  const meta = new Float32Array(vertexCount * 2);
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
      // corner (cx, cy) is deliberately NOT stored — both shader twins derive
      // it from the vertex id (B2 vertex expansion, see the header note).
      meta[v * 2] = size;
      meta[v * 2 + 1] = colT;
    }
    const o = i * 6;
    indices[o] = v0;
    indices[o + 1] = v0 + 1;
    indices[o + 2] = v0 + 2;
    indices[o + 3] = v0;
    indices[o + 4] = v0 + 2;
    indices[o + 5] = v0 + 3;
  }
  return { positions, meta, indices, vertexCount, count };
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
    // Magnitude byte, faint-weighted. A real catalog's magnitude distribution
    // is steeply skewed toward faint objects (measured on stars-hip.png: ~80%
    // of records fall in the lower two octiles of the byte range), and it is
    // that skew — not the count — that makes the live sky read correctly. A
    // uniform draw here was the B1 placeholder's actual defect (TR-037), so the
    // fallback approximates the shape rather than reproducing the bug.
    meta[i * 2] = Math.pow(rnd(), 2.2) * 0.75;
    meta[i * 2 + 1] = packTypeAndColour(0, Math.floor(rnd() * 256));
  }
  return { positions, meta, count };
}
