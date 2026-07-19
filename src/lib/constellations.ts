/* constellations.ts — GAP-04: constellation figures on the Babylon path
 * (docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
 *
 * Ported (not shared — space-engine.js stays frozen) from that engine's
 * `_buildConstellations`: for every `window.CELESTIAL` entry carrying a
 * `.fig` (a small star-position + line-index list), place its stars at
 * radius 720 and emit one 3D line segment per `fig.l` index pair. Reuses
 * `ship-dynamics.ts`'s `raDecToDir` directly (already shared, engine-
 * agnostic, exported for exactly this kind of reuse) rather than
 * re-deriving the ra/dec-to-direction transform a third time.
 */
import { raDecToDir } from "./ship-dynamics";

/** Matches space-engine.js's constellation-figure radius exactly. */
export const CONSTELLATION_RADIUS = 720;

export interface ConstellationSource {
  fig?: {
    s: readonly (readonly [number, number])[]; // [ra, dec] per figure star
    l: readonly (readonly [number, number])[]; // [indexA, indexB] line segments
  };
}

export interface ConstellationLines {
  /** Two endpoints per line segment, xyz each (segments * 6 floats). */
  positions: Float32Array;
  /** Number of line segments (positions.length === count * 6). */
  count: number;
}

export function buildConstellationLines(
  bodies: readonly ConstellationSource[],
  radius: number = CONSTELLATION_RADIUS,
): ConstellationLines {
  const verts: number[] = [];
  for (const e of bodies) {
    if (!e.fig) continue;
    const dirs = e.fig.s.map(([ra, dec]) => raDecToDir(ra, dec));
    for (const [a, b] of e.fig.l) {
      const da = dirs[a];
      const db = dirs[b];
      if (!da || !db) continue; // malformed figure data — skip, don't crash
      verts.push(
        da[0] * radius,
        da[1] * radius,
        da[2] * radius,
        db[0] * radius,
        db[1] * radius,
        db[2] * radius,
      );
    }
  }
  const positions = new Float32Array(verts);
  return { positions, count: positions.length / 6 };
}

/* ---------- shader twins: flat-coloured line list, fixed colour + alpha uniform ---------- */

export const CONSTELLATION_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
uniform mat4 view;
uniform mat4 projection;
void main(){
  gl_Position = projection * view * vec4(position, 1.0);
}`;

export const CONSTELLATION_FRAGMENT_GLSL = `
precision mediump float;
uniform vec4 uColor;
void main(){
  gl_FragColor = uColor;
}`;

export const CONSTELLATION_VERTEX_WGSL = `
attribute position : vec3<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.projection * uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
}`;

export const CONSTELLATION_FRAGMENT_WGSL = `
uniform uColor : vec4<f32>;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  fragmentOutputs.color = uniforms.uColor;
}`;
