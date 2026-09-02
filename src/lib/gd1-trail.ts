/* gd1-trail.ts — PF-10 C1: GD-1 stellar-stream connected-trail visual.
 *
 * Astra science brief (docs/analysis/2026-07-20-gd1-connected-trail-science-brief.md):
 * the 1,365 real GD-1 member stars (celestial-gd1.js) are NOT in stream order in the
 * source catalog (confirmed: ~50/50 split of increasing/decreasing RA between
 * consecutive rows) — connecting them in file order would draw a chaotic zigzag across
 * the real ~66deg of RA the data spans, not a coherent trail. This module fits the
 * stream's own great circle directly from the real 1,365-star sample (spherical PCA:
 * the smallest-eigenvalue eigenvector of the point cloud's covariance matrix, found via
 * shifted power iteration — self-verifying against the real rendered data, deliberately
 * NOT importing an external literature rotation-matrix constant Astra's own confidence
 * couldn't fully back from memory), sorts stars by their angle along that great circle,
 * and colours the resulting line by REAL radial velocity — a genuine, literature-
 * standard GD-1 diagnostic (the stream's dynamically-cold-orbit signature), not
 * decoration.
 *
 * Rendering technique matches constellations.ts's established pattern exactly (a static
 * Material.LineListDrawMode mesh, positions as segment-endpoint pairs) — the only real
 * difference is a per-vertex colour attribute instead of a single uniform colour.
 */
import { raDecToDir } from "./ship-dynamics";

export type Vec3 = [number, number, number];

function dot3(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function cross3(a: Vec3, b: Vec3): Vec3 {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

function normalize3(v: Vec3): Vec3 {
  const len = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / len, v[1] / len, v[2] / len];
}

/** Best-fit great-circle pole through a point cloud on the unit sphere: the
 * smallest-eigenvalue eigenvector of the covariance matrix C = (1/n) Sum
 * v_i v_i^T (minimizes the sum of squared distances from each point to the
 * plane through the origin with this normal — the standard spherical-PCA
 * great-circle fit). Found via SHIFTED power iteration: M = trace(C)*I - C
 * has the SAME eigenvectors as C, with eigenvalues (trace - lambda_i); since
 * trace >= every eigenvalue of a PSD matrix, C's SMALLEST eigenvalue becomes
 * M's LARGEST, so ordinary power iteration on M converges to the pole. A
 * simple, robust, well-tested numerical technique — no closed-form 3x3
 * eigensolver needed. */
export function fitStreamPole(dirs: readonly Vec3[]): Vec3 {
  let xx = 0,
    xy = 0,
    xz = 0,
    yy = 0,
    yz = 0,
    zz = 0;
  for (const [x, y, z] of dirs) {
    xx += x * x;
    xy += x * y;
    xz += x * z;
    yy += y * y;
    yz += y * z;
    zz += z * z;
  }
  const n = dirs.length || 1;
  xx /= n;
  xy /= n;
  xz /= n;
  yy /= n;
  yz /= n;
  zz /= n;
  const trace = xx + yy + zz;
  const m00 = trace - xx,
    m01 = -xy,
    m02 = -xz;
  const m11 = trace - yy,
    m12 = -yz;
  const m22 = trace - zz;
  // Seed deliberately non-axis-aligned so it can't start exactly orthogonal
  // to the true dominant eigenvector for a pathological input.
  let v: Vec3 = [0.5773503, 0.5773503, 0.5773503];
  for (let iter = 0; iter < 60; iter++) {
    const nv: Vec3 = [
      m00 * v[0] + m01 * v[1] + m02 * v[2],
      m01 * v[0] + m11 * v[1] + m12 * v[2],
      m02 * v[0] + m12 * v[1] + m22 * v[2],
    ];
    v = normalize3(nv);
  }
  return v;
}

/** Angle (radians) of `dir` along the great circle with the given `pole`,
 * measured from the plane-projection of `refDir` — the stream's own phi1
 * coordinate (Koposov et al. 2010's naming convention), used only as an
 * internal sort key here, not asserted to numerically match the published
 * frame (see the science brief for why). */
export function streamPhi1(pole: Vec3, refDir: Vec3, dir: Vec3): number {
  const dRef = dot3(refDir, pole);
  const e1 = normalize3([
    refDir[0] - dRef * pole[0],
    refDir[1] - dRef * pole[1],
    refDir[2] - dRef * pole[2],
  ]);
  const e2 = cross3(pole, e1);
  const dDir = dot3(dir, pole);
  const proj: Vec3 = [
    dir[0] - dDir * pole[0],
    dir[1] - dDir * pole[1],
    dir[2] - dDir * pole[2],
  ];
  return Math.atan2(dot3(proj, e2), dot3(proj, e1));
}

export interface Gd1StarInput {
  id: string;
  ra: number;
  dec: number;
  rv: number;
}

/** Full pipeline: fit the real stream's great circle from the real sample,
 * then return the input array's indices sorted into real physical stream
 * order (ascending phi1). Pure — the caller supplies world positions
 * separately (from the already-placed `this.bodies`, so trail vertices land
 * exactly on each star's existing rendered position, no drift). */
export function orderGd1Stream(stars: readonly Gd1StarInput[]): number[] {
  const dirs = stars.map((s) => raDecToDir(s.ra, s.dec));
  const pole = fitStreamPole(dirs);
  const refDir = dirs[0] ?? [1, 0, 0];
  const phi1 = dirs.map((d) => streamPhi1(pole, refDir, d));
  return stars.map((_s, i) => i).sort((a, b) => phi1[a] - phi1[b]);
}

/** Diverging blue -> white -> red colour ramp for the real radial-velocity
 * gradient (the standard astronomical blueshift/redshift convention) —
 * t in [0,1], t=0 the sample's real minimum, t=1 its real maximum (computed
 * from the actual rendered sample, per the science brief, not a literature
 * range that might not match this specific bright-star subset). */
export function radialVelocityToColor(
  rv: number,
  rvMin: number,
  rvMax: number,
): Vec3 {
  const span = rvMax - rvMin || 1;
  const t = Math.max(0, Math.min(1, (rv - rvMin) / span));
  const blue: Vec3 = [0.3, 0.55, 0.95];
  const white: Vec3 = [0.92, 0.92, 0.92];
  const red: Vec3 = [0.95, 0.35, 0.3];
  const [a, b, k] =
    t < 0.5 ? [blue, white, t / 0.5] : [white, red, (t - 0.5) / 0.5];
  return [
    a[0] + (b[0] - a[0]) * k,
    a[1] + (b[1] - a[1]) * k,
    a[2] + (b[2] - a[2]) * k,
  ];
}

export interface Gd1TrailMesh {
  /** Two endpoints per segment, xyz each ((n-1) segments * 6 floats). */
  positions: Float32Array;
  /** Matching per-vertex colour, rgb each ((n-1) segments * 6 floats). */
  colors: Float32Array;
  /** Number of line segments (positions.length === count * 6). */
  count: number;
}

/** Builds the line-list mesh data for the ordered stream: one segment
 * between each consecutive pair of already-ordered, already-world-placed
 * stars, coloured at each endpoint by that star's own real radial-velocity
 * colour (the GPU rasterizer interpolates between them along the segment,
 * producing the real gradient with no extra shader work). */
export function buildGd1TrailMesh(
  orderedPositions: readonly Vec3[],
  orderedColors: readonly Vec3[],
): Gd1TrailMesh {
  const segCount = Math.max(0, orderedPositions.length - 1);
  const positions = new Float32Array(segCount * 6);
  const colors = new Float32Array(segCount * 6);
  for (let i = 0; i < segCount; i++) {
    const pa = orderedPositions[i];
    const pb = orderedPositions[i + 1];
    const ca = orderedColors[i];
    const cb = orderedColors[i + 1];
    const po = i * 6;
    positions[po] = pa[0];
    positions[po + 1] = pa[1];
    positions[po + 2] = pa[2];
    positions[po + 3] = pb[0];
    positions[po + 4] = pb[1];
    positions[po + 5] = pb[2];
    colors[po] = ca[0];
    colors[po + 1] = ca[1];
    colors[po + 2] = ca[2];
    colors[po + 3] = cb[0];
    colors[po + 4] = cb[1];
    colors[po + 5] = cb[2];
  }
  return { positions, colors, count: segCount };
}

/* ---------- shader twins: per-vertex-coloured line list ---------- */

export const GD1_TRAIL_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec3 gd1Color;
uniform mat4 view;
uniform mat4 projection;
varying vec3 vColor;
void main(){
  vColor = gd1Color;
  gl_Position = projection * view * vec4(position, 1.0);
}`;

export const GD1_TRAIL_FRAGMENT_GLSL = `
precision mediump float;
varying vec3 vColor;
void main(){
  gl_FragColor = vec4(vColor, 0.55);
}`;

export const GD1_TRAIL_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute gd1Color : vec3<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vColor : vec3<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.vColor = vertexInputs.gd1Color;
  vertexOutputs.position = uniforms.projection * uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
}`;

export const GD1_TRAIL_FRAGMENT_WGSL = `
varying vColor : vec3<f32>;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  fragmentOutputs.color = vec4<f32>(fragmentInputs.vColor, 0.55);
}`;
