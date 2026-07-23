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
 * the caller can slice the build.
 *
 * PF-11 D0.1 (2026-07-22): the pacing is now TIME-budgeted, not row-counted,
 * and — more importantly — no longer coupled to frame delivery. The original
 * port built a fixed 20 rows per RENDERED frame (~26 frames), so total build
 * wall-time scaled with 1/fps: on a loaded SwiftShader CI run at ~1 fps that
 * is ~26 seconds, which is exactly the "bandReady never true" E2E failure
 * class TR-080 root-caused. `MilkyWayBandBuilder` below owns the row cursor,
 * spends a millisecond budget per slice, and paces itself against a wall-clock
 * DEADLINE so a slow driver gets bigger slices instead of a longer build. The
 * engine drives it from the render loop (preserving TR-059's
 * frames-keep-producing contract) and from a `setTimeout(0)` chain between
 * frames — the latter matters when rAF is suspended, but measurement showed
 * it cannot carry the build on its own (see the class's header).
 *
 * GAP-06 (2026-07-20): Doppler colour tint IS now ported — see the fragment
 * shader below. The POSITIONAL half (relativistic aberration crowding the
 * band toward the travel vector) is deliberately NOT: this pass samples a
 * skybox SPHERE by its own built-in UV, not a per-pixel reconstructed view
 * ray the way the archived engine's fullscreen-triangle BAND_FS does (see
 * this file's header on that technique substitution) — re-deriving that ray
 * per fragment just to aberrate it, then inverting the mapping back to a
 * sphere UV, would mean re-deriving Babylon's own CreateSphere UV formula by
 * hand for a diffuse, huge-radius background layer where the colour shift is
 * the visually load-bearing half of the effect. Named here, not silently
 * dropped, per the gap analysis's implementation guardrail.
 */

const D2R = Math.PI / 180;
const TAU = Math.PI * 2;

export const MILKY_WAY_WIDTH = 1024;
export const MILKY_WAY_HEIGHT = 512;
/** Wall-clock budget one build slice may spend on rows (PF-11 D0.1). Chosen
 * against the 16.6ms desktop frame budget: a slice runs inside a render-loop
 * tick, so it must leave room for the rest of the frame — 6ms is ~4 rows on
 * the benchmarked ~250-400ms/512-row machine, and the whole grid finishes in
 * ~60 slices. Replaces the former fixed `MILKY_WAY_ROWS_PER_CHUNK = 20`,
 * whose real cost varied with row content and machine speed. */
export const MILKY_WAY_BUILD_MS_PER_SLICE = 6;
/** Wall-clock deadline for the WHOLE grid (PF-11 D0.1). A slow driver makes
 * slices bigger rather than making the build take longer — this is the knob
 * that stops total build time scaling with 1/fps. Set to 8s: comfortably
 * above the ~1s a healthy machine needs at `MILKY_WAY_BUILD_MS_PER_SLICE`
 * (so it never binds there and never costs a frame it didn't have to), and
 * far below the 65s a saturated SwiftShader run measured without it. */
export const MILKY_WAY_BUILD_DEADLINE_MS = 8000;
/** Hard ceiling on a single slice. The deadline is best-effort UNDER this
 * cap: a driver so slow that the deadline would demand a longer slice gets a
 * later band, not a stalled frame — TR-059's frames-keep-producing contract
 * outranks the deadline. */
export const MILKY_WAY_BUILD_MAX_SLICE_MS = 50;

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
 * slice this under a time budget to stay inside the frame budget — see
 * `MilkyWayBandBuilder` and this file's header. */
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

/** PF-11 D0.1 — the band texture's row cursor + RGBA buffer, sliced by TIME
 * and paced against a WALL-CLOCK DEADLINE, deliberately independent of any
 * particular driver (render loop, timer, or a unit test's fake clock).
 *
 * Two properties are what this class exists for:
 *
 * 1. **Frames keep producing** (TR-059's contract, non-negotiable #9's
 *    neighbourhood): a slice normally stops at `budgetMs`, so the build never
 *    swallows a frame the way one synchronous 250-400ms grid build would.
 * 2. **Total build wall-time does not scale with 1/fps** (D0.1's exit
 *    criterion). Each slice measures how long it has been since the previous
 *    slice and how many rows are still owed before `deadlineMs`, and builds
 *    at least that many — so on a machine delivering 2 fps the slices simply
 *    get bigger instead of the build taking 26 seconds. On a healthy machine
 *    the deadline never binds: `budgetMs` finishes the grid in ~1s and the
 *    required-rows term stays at 1.
 *
 * MEASURED, not assumed (the reason the pacing is deadline-driven at all):
 * the original D0.1 design was time-budgeted slices driven by the render loop
 * PLUS a `setTimeout(0)` chain between frames. Probing the built preview
 * under Playwright's chromium/SwiftShader showed the page main thread is
 * saturated by the render loop — a self-rescheduling `setTimeout(0)` chain
 * got **10 callbacks in 5 seconds** (~1 per rendered frame) — so timers alone
 * cannot decouple anything here. The chain is still driven (it is the ONLY
 * driver when rAF is suspended, e.g. a backgrounded tab, and it adds ~50%
 * more slices under load) but the deadline is what carries the guarantee.
 *
 * `now` is injectable so tests can simulate arbitrarily slow slices without
 * burning real milliseconds. */
export class MilkyWayBandBuilder {
  /** The equirect RGBA buffer being filled; valid to upload once `done`. */
  readonly buf: Uint8Array;
  readonly width: number;
  readonly height: number;
  private _row = 0;
  private _startedAt: number | undefined;
  private _lastSliceAt: number | undefined;
  private readonly _budgetMs: number;
  private readonly _deadlineMs: number;
  private readonly _maxSliceMs: number;
  private readonly _now: () => number;

  constructor(
    opts: {
      budgetMs?: number;
      deadlineMs?: number;
      maxSliceMs?: number;
      now?: () => number;
      width?: number;
      height?: number;
    } = {},
  ) {
    this.width = opts.width ?? MILKY_WAY_WIDTH;
    this.height = opts.height ?? MILKY_WAY_HEIGHT;
    this.buf = new Uint8Array(this.width * this.height * 4);
    this._budgetMs = opts.budgetMs ?? MILKY_WAY_BUILD_MS_PER_SLICE;
    this._deadlineMs = opts.deadlineMs ?? MILKY_WAY_BUILD_DEADLINE_MS;
    this._maxSliceMs = opts.maxSliceMs ?? MILKY_WAY_BUILD_MAX_SLICE_MS;
    this._now = opts.now ?? (() => performance.now());
  }

  /** Next row to build — equals `height` once complete. */
  get row(): number {
    return this._row;
  }

  get done(): boolean {
    return this._row >= this.height;
  }

  /** Fraction of rows built, 0..1 — the honest progress signal D1.1 will read. */
  get progress(): number {
    return this._row / this.height;
  }

  /** Builds one slice: at least the rows the deadline still owes at the
   * observed slice cadence, and then as many more as `budgetMs` allows —
   * capped at `maxSliceMs` so a pathologically slow driver degrades the
   * deadline rather than a frame. ALWAYS builds at least one row, so forward
   * progress is guaranteed even when a single row costs more than the whole
   * budget. Returns `done`.
   *
   * `paced: false` drops back to the plain `budgetMs` slice for this call —
   * the caller is doing something the visitor is watching (an in-flight warp)
   * and the band, which fades in over seconds anyway, must not bid for that
   * frame time. Cadence is still recorded, so pacing resumes correctly. */
  buildSlice(paced = true): boolean {
    const t0 = this._now();
    if (this._startedAt === undefined) this._startedAt = t0;
    // How long since the last slice ran — the cadence this build is actually
    // being driven at, whatever the fps happens to be.
    const sinceLast =
      this._lastSliceAt === undefined ? 0 : Math.max(0, t0 - this._lastSliceAt);
    this._lastSliceAt = t0;
    const rowsLeft = this.height - this._row;
    const msLeft = Math.max(1, this._deadlineMs - (t0 - this._startedAt));
    // Rows this slice must cover to still land the whole grid by the deadline
    // if the next slice arrives after the same gap as the last one.
    const required = paced
      ? Math.min(
          rowsLeft,
          Math.max(1, Math.ceil((rowsLeft / msLeft) * sinceLast)),
        )
      : 1;
    let built = 0;
    while (this._row < this.height) {
      buildMilkyWayRow(this.buf, this._row, this.width, this.height);
      this._row++;
      built++;
      const spent = this._now() - t0;
      if (spent >= this._maxSliceMs) break;
      if (spent >= this._budgetMs && built >= required) break;
    }
    return this.done;
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
varying vec3 vDir;
void main(){
  gl_Position = projection * view * world * vec4(position, 1.0);
  vUV = uv;
  // GAP-06: object-space position IS the observed direction — this sphere is
  // centred on the camera every frame (mesh.infiniteDistance), so its local
  // (pre-world-transform) position already points the way the archived
  // engine's per-pixel view ray d did at the point BAND_FS computes dop.
  vDir = normalize(position);
}`;

export const MILKY_WAY_FRAGMENT_GLSL = `
precision mediump float;
uniform sampler2D uTex;
uniform float uFade;
uniform float uBeta, uGamma; // GAP-06: Doppler tint (see this file's header)
uniform vec3 uWarpDir;
varying vec2 vUV;
varying vec3 vDir;
void main(){
  vec3 col = texture2D(uTex, vUV).rgb;
  if (uBeta > 0.001) {
    float c = dot(normalize(vDir), uWarpDir);
    float dop = 1.0 / (uGamma * (1.0 - uBeta * c));
    col = mix(col, vec3(0.62, 0.75, 1.0) * length(col) * 1.4, clamp((dop - 1.0) * 0.8, 0.0, 0.6));
    col = mix(col, vec3(1.0, 0.45, 0.3) * length(col) * 1.2, clamp((1.0 - dop) * 1.0, 0.0, 0.65));
    col *= clamp(dop * dop, 0.3, 2.0);
  }
  gl_FragColor = vec4(col * uFade, 1.0);
}`;

export const MILKY_WAY_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute uv : vec2<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vUV : vec2<f32>;
varying vDir : vec3<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.projection * uniforms.view * uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vUV = vertexInputs.uv;
  vertexOutputs.vDir = normalize(vertexInputs.position);
}`;

export const MILKY_WAY_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
varying vDir : vec3<f32>;
var uTex : texture_2d<f32>;
var uTexSampler : sampler;
uniform uFade : f32;
uniform uBeta : f32;
uniform uGamma : f32;
uniform uWarpDir : vec3<f32>;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  var col : vec3<f32> = textureSample(uTex, uTexSampler, fragmentInputs.vUV).rgb;
  if (uniforms.uBeta > 0.001) {
    let c : f32 = dot(normalize(fragmentInputs.vDir), uniforms.uWarpDir);
    let dop : f32 = 1.0 / (uniforms.uGamma * (1.0 - uniforms.uBeta * c));
    col = mix(col, vec3<f32>(0.62, 0.75, 1.0) * length(col) * 1.4, clamp((dop - 1.0) * 0.8, 0.0, 0.6));
    col = mix(col, vec3<f32>(1.0, 0.45, 0.3) * length(col) * 1.2, clamp((1.0 - dop) * 1.0, 0.0, 0.65));
    col = col * clamp(dop * dop, 0.3, 2.0);
  }
  fragmentOutputs.color = vec4<f32>(col * uniforms.uFade, 1.0);
}`;

/* ---------- PF-11 D2.2: the external-galaxy impostor -----------------------
 *
 * At an extragalactic arrival the 360° band collapses (D2.2) and, toward home,
 * the whole Milky Way appears as ONE small external galaxy — Astra §1's
 * "emotional payoff of the whole dataset investment": the band you flew under
 * all session shrinks into an object. Astra §1/§5: a 30-kpc disc subtends
 * ~10.3' from 32.6 Mly, the apparent size M101 has in our sky (a faint smudge).
 *
 * The impostor's TEXTURE is a PROCEDURAL inclined disc, deliberately NOT the
 * deferred photographic Milky-Way skybox pack: the Risinger panorama is
 * credited in docs/research without a printed license string, so per the
 * licensing tripwire it cannot ship until that verifies. This procedural disc
 * — a bulge + exponential disc seen ~20° from edge-on, with an alpha that falls
 * to zero at the rim so the sprite reads as a galaxy and not a quad — is
 * license-clean (our own math) and declared SIMPLIFIED in the ledger: it
 * reproduces the appearance of a distant spiral without a photometric model.
 */

/** Impostor texture edge (px). Small: the sprite is only a few dozen px on
 * screen at its honest angular size, so a 256² disc is ample. */
export const MILKY_WAY_IMPOSTOR_SIZE = 256;
/** Minor/major axis ratio of the inclined disc (~1:3 ≈ 20° from edge-on). */
const IMPOSTOR_INCLINATION = 0.34;

/** One RGBA pixel (0..255, straight alpha) of the external-galaxy impostor at
 * normalized disc coordinates (u, v) ∈ [-1, 1]². Pure so it is unit-testable
 * and identical wherever it runs. Outside the elliptical disc the pixel is
 * fully transparent (0,0,0,0), so the quad it fills reads as a disc. Shares the
 * band's warm-toward-the-core palette family (milkyWayPixel's tone curve) so
 * the impostor and the band are recognisably the same galaxy. */
export function milkyWayImpostorPixel(
  u: number,
  v: number,
): [number, number, number, number] {
  // Elliptical radius: compress the minor axis so the disc looks inclined.
  const rr = Math.hypot(u, v / IMPOSTOR_INCLINATION);
  if (rr >= 1) return [0, 0, 0, 0];
  const disc = Math.exp(-rr * 2.6); // exponential surface-brightness profile
  const bulge = 1.2 * Math.exp(-rr * rr * 26); // bright central bulge
  const intensity = disc + bulge;
  const warm = Math.min(1, bulge * 0.9 + Math.exp(-rr * 2.2) * 0.5);
  const tone = (x: number) =>
    Math.round(255 * Math.min(1, 1 - Math.exp(-x * 1.6)));
  // Alpha carries the disc shape: opaque core, feathered to 0 by the rim.
  const alpha = Math.round(
    255 * Math.min(1, intensity) * (1 - smoothstepLocal(0.72, 1.0, rr)),
  );
  return [
    tone(intensity * (0.62 + 0.38 * warm)),
    tone(intensity * (0.66 + 0.24 * warm)),
    tone(intensity * (0.88 - 0.2 * warm)),
    alpha,
  ];
}

/** Local smoothstep (kept private — milky-way.ts has no other need for one). */
function smoothstepLocal(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** Builds the impostor's RGBA texture buffer (row-major, straight alpha),
 * `size × size`. Center of the texture is the galaxy core; corners are
 * transparent. One synchronous call — the buffer is tiny and built once, then
 * bound as a RawTexture before the mesh ever draws (non-negotiable #9). */
export function buildMilkyWayImpostor(
  size: number = MILKY_WAY_IMPOSTOR_SIZE,
): Uint8Array {
  const out = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) {
    const v = ((y + 0.5) / size) * 2 - 1;
    for (let x = 0; x < size; x++) {
      const u = ((x + 0.5) / size) * 2 - 1;
      const [r, g, b, a] = milkyWayImpostorPixel(u, v);
      const o = (y * size + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
  }
  return out;
}

/* Shader twins for the impostor: a plain textured, camera-facing quad. The
 * mesh's billboardMode makes the world matrix face the camera; the shader is
 * just a UV sampler with a straight-alpha blend and a global fade. Mirrors the
 * band's proven `textureSample(uTex, uTexSampler, ...)` pattern (non-negotiable
 * #4 — both twins, line-parallel, identifier-identical). */
export const MILKY_WAY_IMPOSTOR_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 worldViewProjection;
varying vec2 vUV;
void main(){
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vUV = uv;
}`;

export const MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL = `
precision mediump float;
uniform sampler2D uTex;
uniform float uFade;
varying vec2 vUV;
void main(){
  vec4 c = texture2D(uTex, vUV);
  gl_FragColor = vec4(c.rgb, c.a * uFade);
}`;

export const MILKY_WAY_IMPOSTOR_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute uv : vec2<f32>;
uniform worldViewProjection : mat4x4<f32>;
varying vUV : vec2<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.worldViewProjection * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vUV = vertexInputs.uv;
}`;

export const MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
var uTex : texture_2d<f32>;
var uTexSampler : sampler;
uniform uFade : f32;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  var c : vec4<f32> = textureSample(uTex, uTexSampler, fragmentInputs.vUV);
  fragmentOutputs.color = vec4<f32>(c.rgb, c.a * uniforms.uFade);
}`;
