/* milky-way.ts — GAP-03: the galactic starlight band on the Babylon path
 * (docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
 *
 * Ported (not shared — space-engine.js stays frozen, per the gap analysis's
 * implementation guardrail) from space-engine.js's `_buildMilkyWay` /
 * `BAND_VS` / `BAND_FS`. The archived engine's algorithm splits cleanly in
 * two: a CPU procedural equirectangular texture (disc+bulge glow, patchy fBm
 * star clouds, the Great Rift dust lanes, the Coalsack dark nebula — all pure
 * per-pixel math, no GL calls) and a trivial fragment shader that samples it
 * by view ray. Only the texture-building half needed porting; the sampling
 * half is a two-line fullscreen-triangle shader, same technique as the
 * nebula composite (nebula-field.ts) and the star billboards.
 *
 * Benchmarked at ~250-400ms for the full 1024x512 grid on this machine — a
 * single synchronous call would stall multiple frames past budget (16.6ms
 * desktop). `buildMilkyWayRow` is therefore a PURE, single-row function so
 * the caller can chunk the build across frames (exactly the legacy engine's
 * own `setTimeout(step, 0)` 20-rows-per-tick technique, just driven from
 * Babylon's render loop instead of a raw timer).
 *
 * Deliberately NOT ported: relativistic aberration/Doppler tinting on the
 * band (GAP-06's dependency — needs the flight model's velocity wired to
 * this pass, not yet done for stars or bodies either on this path).
 */

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

export const MILKY_WAY_WIDTH = 1024;
export const MILKY_WAY_HEIGHT = 512;
/** Rows built per chunk — matches space-engine.js's own pacing exactly. */
export const MILKY_WAY_ROWS_PER_CHUNK = 20;

// North Galactic Pole + ascending node (J2000), matching space-engine.js's
// constants exactly so both engines agree on which patch of sky is "the
// galactic centre".
const RA_G = 192.859508 * D2R;
const DEC_G = 27.128336 * D2R;
const L_NODE = 122.932 * D2R;
const SIN_DEC_G = Math.sin(DEC_G);
const COS_DEC_G = Math.cos(DEC_G);

/** Equatorial (ra, dec, degrees) -> galactic (l, b, degrees), l wrapped to
 * (-180, 180] with 0 at the galactic centre. Matches space-engine.js's
 * inline transform exactly. */
export function galacticLB(
  raDeg: number,
  decDeg: number,
): { l: number; b: number } {
  const ra = raDeg * D2R;
  const dec = decDeg * D2R;
  const sd = Math.sin(dec);
  const cd = Math.cos(dec);
  const dra = ra - RA_G;
  const sb = sd * SIN_DEC_G + cd * COS_DEC_G * Math.cos(dra);
  const b = Math.asin(Math.max(-1, Math.min(1, sb))) / D2R;
  let l =
    (L_NODE -
      Math.atan2(
        cd * Math.sin(dra),
        sd * COS_DEC_G - cd * SIN_DEC_G * Math.cos(dra),
      )) /
    D2R;
  l = ((l % 360) + 360) % 360;
  const lc = l > 180 ? l - 360 : l;
  return { l: lc, b };
}

/** 2D value noise + 3-octave fBm, matching space-engine.js's `hash`/`vnoise`/
 * `fbm` exactly (same hash constants) so both engines paint the same sky. */
function hash(x: number, y: number): number {
  const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return s - Math.floor(s);
}
function vnoise(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  return (
    hash(xi, yi) * (1 - u) * (1 - v) +
    hash(xi + 1, yi) * u * (1 - v) +
    hash(xi, yi + 1) * (1 - u) * v +
    hash(xi + 1, yi + 1) * u * v
  );
}
export function fbm(x: number, y: number): number {
  return (
    0.55 * vnoise(x, y) +
    0.28 * vnoise(x * 2.13, y * 2.13) +
    0.17 * vnoise(x * 4.41, y * 4.41)
  );
}

/** Per-pixel galactic-band colour (0..255 RGB), given galactic (l, b) in
 * degrees. Matches space-engine.js's `_buildMilkyWay` inner loop term for
 * term: disc+bulge glow, patchy star clouds, three named bright clouds
 * (Cygnus/Carina/Scutum), the Great Rift dust lanes, the Coalsack, and the
 * warm-toward-centre tone mapping. */
export function milkyWayPixel(l: number, b: number): [number, number, number] {
  const sig = 6.0 + 9.0 * Math.exp(-(l * l) / 9800);
  let band =
    Math.exp(-(b * b) / (2 * sig * sig)) *
    (0.3 + 0.7 * Math.exp(-Math.abs(l) / 95));
  band *= 0.52 + 0.75 * fbm(l * 0.05, b * 0.09);
  const rb = l * l * 0.5 + b * b * 2.6;
  const bulge = 1.25 * Math.exp(-rb / 220);
  const cloud =
    0.5 * Math.exp(-(((l - 79) * (l - 79)) / 90 + ((b - 1) * (b - 1)) / 14)) +
    0.45 * Math.exp(-(((l + 73) * (l + 73)) / 110 + ((b + 1) * (b + 1)) / 12)) +
    0.5 * Math.exp(-(((l - 27) * (l - 27)) / 55 + ((b + 2) * (b + 2)) / 16));
  const rEnv =
    Math.exp(-(b * b) / 42) * Math.exp(-((l - 35) * (l - 35)) / 5400);
  const ridge = 1 - Math.abs(2 * fbm(l * 0.11 + 7.3, b * 0.23) - 1);
  const dust = Math.max(0, Math.min(1, ridge * ridge * 1.5 - 0.28)) * rEnv;
  const coal =
    0.85 *
    Math.exp(-(((l + 57) * (l + 57)) / 26 + ((b + 1.5) * (b + 1.5)) / 9));
  let intensity =
    (band * (1 + cloud) + bulge) * (1 - 0.82 * Math.min(1, dust + coal));
  intensity = Math.max(0, intensity);
  const warm = Math.min(1, bulge * 0.9 + Math.exp(-Math.abs(l) / 60) * 0.55);
  const tone = (x: number) =>
    Math.round(255 * Math.min(1, 1 - Math.exp(-x * 1.6)));
  return [
    tone(intensity * (0.62 + 0.38 * warm) * 0.3),
    tone(intensity * (0.66 + 0.24 * warm) * 0.3),
    tone(intensity * (0.88 - 0.2 * warm) * 0.34),
  ];
}

/** Fills ONE row of an equirectangular RGBA buffer (ra across x, dec down y —
 * row 0 is the north celestial pole), matching space-engine.js's raster
 * order exactly. `out` must be at least `(row+1) * width * 4` bytes; callers
 * chunk this across `MILKY_WAY_ROWS_PER_CHUNK`-row groups to stay inside the
 * frame budget (see this file's header). */
export function buildMilkyWayRow(
  out: Uint8Array,
  row: number,
  width: number = MILKY_WAY_WIDTH,
  height: number = MILKY_WAY_HEIGHT,
): void {
  const dec = (0.5 - (row + 0.5) / height) * Math.PI;
  const decDeg = dec / D2R;
  for (let i = 0; i < width; i++) {
    const raDeg = (((i + 0.5) / width) * TAU - Math.PI) / D2R;
    const { l, b } = galacticLB(raDeg, decDeg);
    const [r, g, bch] = milkyWayPixel(l, b);
    const o = (row * width + i) * 4;
    out[o] = r;
    out[o + 1] = g;
    out[o + 2] = bch;
    out[o + 3] = 255;
  }
}

/* ---------- shader twins: sample the pre-built equirect texture by view ray ---------- */

/** Radius of the background sphere the band texture is mapped onto — large
 * enough to sit behind the star shell (star-field.ts's shell tops out around
 * radius 400) and the curated-body log-depth placement (which rarely exceeds
 * a few hundred units — see ship-dynamics.ts's `bodyDepth`). */
export const MILKY_WAY_SPHERE_RADIUS = 2000;

/* Deliberately NOT a fullscreen-triangle + view-ray reconstruction (the
 * archived engine's technique, forced by raw WebGL having no equivalent to
 * a proper skybox primitive). Babylon has one: a large sphere with
 * `mesh.infiniteDistance = true` (the exact mechanism its own
 * `scene.createDefaultSkybox()` uses) always renders behind everything
 * regardless of draw order, with no depth-write/rendering-group trickery
 * needed. The sphere's own equirect UV mapping (Babylon's CreateSphere
 * convention: u = longitude/2pi, v = pole-to-pole) does the ra/dec-to-
 * texture-coordinate job the archived engine's fragment shader did by hand
 * — so these twins are plain UV samplers, standard view/projection/world,
 * no camera-basis uniforms at all. A port of the visual RESULT (the same
 * procedural texture, same sampling job) via the platform's better-fitted
 * primitive, not a literal restatement of a WebGL1-necessitated technique —
 * the same class of substitution as the star billboards replacing point
 * sprites (star-field.ts's own header makes the identical call). */
export const MILKY_WAY_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
varying vec2 vUV;
void main(){
  gl_Position = projection * view * world * vec4(position, 1.0);
  vUV = uv;
}`;

export const MILKY_WAY_FRAGMENT_GLSL = `
precision mediump float;
uniform sampler2D uTex;
uniform float uFade;
varying vec2 vUV;
void main(){
  vec3 col = texture2D(uTex, vUV).rgb;
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export const MILKY_WAY_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute uv : vec2<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vUV : vec2<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.projection * uniforms.view * uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vUV = vertexInputs.uv;
}`;

export const MILKY_WAY_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
var uTex : texture_2d<f32>;
var uTexSampler : sampler;
uniform uFade : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let col : vec3<f32> = textureSample(uTex, uTexSampler, fragmentInputs.vUV).rgb;
  fragmentOutputs.color = vec4<f32>(col * uniforms.uFade, 1.0);
}`;
