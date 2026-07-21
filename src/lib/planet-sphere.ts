/* planet-sphere.ts — PF-10 C4: real planetary spheres with real topography.
 *
 * WHAT THIS ADDS, AND WHY IT IS NEW RATHER THAN AN UPGRADE. PF-10's C4 section describes applying
 * elevation "to the existing Mars mesh." No such mesh exists, and none ever has: every curated
 * body in this scene — all 267 with photographic imagery — renders as a BILLBOARD QUAD sampling a
 * 128x128 cell of the shared 4096x4096 `atlas.jpg` (celestial-bodies.ts, GAP-02). A flat sprite
 * cannot have topography. So C4 is the phase that introduces planetary surface rendering, not the
 * phase that enhances it. Owner re-scoped 2026-07-21 after this was measured and reported.
 *
 * DESIGN: ONE DESTINATION-GATED SPHERE, not twenty.
 *
 * The visitor can only ever be at one place. Rather than building a sphere per body — twenty-odd
 * meshes, each holding two 4096x2048 textures, almost all of them off-screen forever — this
 * module drives a SINGLE sphere that is repositioned and re-textured for whichever body is the
 * current destination. That choice follows the reveal mechanism ADR-0004 established for nebulae
 * and TR-072 generalized: the scene already treats "the body you are at" as a first-class state.
 *
 * It also happens to be what makes the phase tractable. GPU memory holds one body's maps instead
 * of twenty; the 267-billboard path is untouched, so there is no regression surface; and the
 * virtual-texture streaming C4.2 adds only ever has one body to stream.
 *
 * EQUIRECTANGULAR UV IS FREE HERE. Babylon's `CreateSphereVertexData` emits exactly the mapping
 * the source maps use (u = longitude/2pi, v = pole-to-pole) — the same convention `milky-way.ts`
 * already depends on and documents. No re-projection anywhere in this feature.
 *
 * TWO CLAUDE.md NON-NEGOTIABLES BIND THIS FILE DIRECTLY, and both are load-bearing rather than
 * ceremonial:
 *
 *   #9 (TR-059) — every declared sampler needs a REAL texture object bound before the mesh first
 *   draws, not before the content is ready. Most bodies here have no height map at all. On WebGPU
 *   an unbound binding is a hard exception while building the bind group, which kills
 *   `scene.render()` for the ENTIRE FRAME, not just this mesh. So `heightTex` is always bound —
 *   to a 1x1 mid-grey placeholder when a body has no elevation data — and `uHasHeight` decides
 *   whether its samples are USED, never whether they happen.
 *
 *   #8 (TR-047) — WGSL `textureSample` must sit in uniform control flow. The height samples are
 *   therefore taken unconditionally and multiplied by `uHasHeight` (0 or 1), rather than being
 *   wrapped in the `if` that would read more naturally. Branching around them would be rejected
 *   by the compiler on WebGPU while working fine on WebGL2 — a twin divergence with no compiler
 *   to catch it.
 */

/** Sphere tessellation. 64 segments gives a silhouette smooth enough that the eye reads a
 * circle rather than a polygon at the closest approach the flight model actually permits, at
 * ~8k triangles — trivial against a scene already drawing 154,662 asteroid billboards. */
export const SPHERE_SEGMENTS = 64;

/** Real physical elevation ranges for the bodies that ship a height map, in kilometres, as
 * (min, max) relief about the mean radius — used to decode the 8-bit greyscale height maps back
 * into real elevation. Mean radii in km alongside, because what matters visually is relief as a
 * FRACTION of radius, and that fraction is tiny for every real body.
 *
 * These are placeholders pending Astra's science brief (docs/analysis/
 * 2026-07-21-planetary-sphere-topography-science-brief.md) — the brief is authoritative for the
 * final numbers and for the exaggeration factor each body should ship with. */
export interface PlanetPhysical {
  /** Mean radius, km. */
  radiusKm: number;
  /** Lowest real elevation relative to the datum, km. */
  reliefMinKm: number;
  /** Highest real elevation relative to the datum, km. */
  reliefMaxKm: number;
  /** Real GEOMETRIC albedo, V band.
   *
   * ASTRA CORRECTION (2026-07-21 brief): this file's first draft used 0.25 for Mars and 0.12 for
   * the Moon. Both are BOND albedos — the fraction of incident light scattered in all directions,
   * which is not the quantity a renderer wants. Geometric albedo (brightness at zero phase
   * against a Lambertian disc) governs how bright the lit hemisphere reads. */
  albedo: number;
  /** Lunar-Lambert coefficient: 0 = pure Lambert, 1 = pure Lommel-Seeliger backscatter.
   *
   * Astra classed plain Lambertian shading on the Moon as BROKEN PHYSICS, not a simplification.
   * Real regolith backscatters: the full Moon is a flat, evenly-lit disc with no limb darkening,
   * and the half Moon is only ~9% as bright as the full Moon rather than the 50% Lambert
   * predicts. Airless bodies (Moon, Mercury) take 1.0; Mars takes 0.55. */
  lunarLambertL: number;
}

export const PLANET_PHYSICAL: Record<string, PlanetPhysical> = {
  mars: {
    radiusKm: 3389.5,
    reliefMinKm: -8.2,
    reliefMaxKm: 21.9,
    albedo: 0.17,
    lunarLambertL: 0.55,
  },
  moon: {
    radiusKm: 1737.4,
    reliefMinKm: -9.1,
    reliefMaxKm: 10.8,
    albedo: 0.136,
    lunarLambertL: 1.0,
  },
  mercury: {
    radiusKm: 2439.7,
    reliefMinKm: -5.4,
    reliefMaxKm: 4.5,
    albedo: 0.142,
    lunarLambertL: 1.0,
  },
};

/** World-space radius the sphere is drawn at.
 *
 * DECLARED, and unavoidably so. Real bodies are not to scale with anything else in this scene:
 * the catalog places bodies by `bodyWorldPosition`'s log-depth compression, so there is no single
 * length unit a "true" planetary radius could even be expressed in. This value is chosen to read
 * as a substantial world on arrival without occluding the HUD — the same class of declared choice
 * as the asteroid rocks' 0.9-3.2 unit radii. */
export const PLANET_SPHERE_RADIUS = 26;

/** Vertical exaggeration applied to the height-derived surface normals.
 *
 * ASTRA CORRECTION — 1.0, where this file's first draft had 12.
 *
 * The draft reasoned that since real relief is a tiny fraction of a planet's radius (Olympus Mons
 * is 0.65% of Mars's), exaggeration must be mandatory or the topography "may as well not exist".
 * That conflates two things. Relief is invisible on the SILHOUETTE — Astra measured that Mars
 * must render 2,260 px across before topography bends the limb by a single pixel — but shading
 * depends on SLOPE, which is scale-free and already vivid at true scale. Exaggerating the normals
 * buys a sub-pixel limb nobody can see, and corrupts the shading across the whole disc, which is
 * the part you actually look at. Astra puts >= 3.0 in lie territory.
 *
 * The visual tell that a scene has overdone this: real planetary limbs are clean arcs in every
 * spacecraft image ever taken. If you can see mountains on the edge, it is wrong. */
export const PLANET_ELEV_SCALE = 1;

/** Geometric albedos for the surface-only bodies, so each sphere reads at its real brightness
 * rather than at whatever exposure its source texture happened to be captured with. Astra's
 * brief; bodies absent here fall back to a neutral default. */
export const PLANET_ALBEDO: Record<string, number> = {
  venus: 0.689,
  io: 0.63,
  europa: 0.67,
  ganymede: 0.43,
  titan: 0.22,
  pluto: 0.6,
  ceres: 0.09,
  jupiter: 0.538,
  saturn: 0.499,
};

/** Bodies that must NEVER be rendered as a sphere, however much texture data exists for them.
 *
 * OWNER DECISION (2026-07-21), on Astra's advice, recorded as a standing RULE rather than a
 * deferral: Phobos and Deimos are the most famously irregular bodies in the pack — Phobos is
 * roughly 27x22x18 km and visibly a battered potato. Sphering them would be broken physics in the
 * most literal sense: the shape IS the science. They stay billboards permanently.
 *
 * This list is enforced rather than merely honoured by omission. The pipeline is data-driven — a
 * body becomes spherical the moment the texture manifest contains it — so without an explicit
 * block, adding `phobos-high.jpg` to the pipeline later would silently sphere a potato. */
export const NEVER_SPHERE = new Set(["phobos", "deimos"]);

/** Real sidereal rotation periods, seconds. Negative = retrograde (Venus really does spin
 * backwards). Astra's brief supplied these; they matter because the RATIOS between them are real
 * even though the absolute rate is time-accelerated below. */
export const ROTATION_PERIOD_S: Record<string, number> = {
  mercury: 5067360, // 58.646 d
  venus: -20996760, // 243.025 d, retrograde
  moon: 2360591.5, // 27.322 d, synchronous with its orbit
  mars: 88642.66, // 24h 37m 22s — famously close to Earth's
  jupiter: 35730, // 9h 55m 30s (System III)
  saturn: 38362, // 10h 39m 22s
  io: 152853.5,
  europa: 306822,
  ganymede: 618153,
  titan: 1377648,
  pluto: -551856.7, // 6.387 d, retrograde
  ceres: 32667, // 9h 4m 27s
};

/** Rotation time acceleration — DELIBERATELY SEPARATE from the asteroid belt's TIME_ACCEL of 4e5.
 *
 * ASTRA: sharing the belt's constant here is not marginal, it is absurd. At 4e5 Mars would spin
 * at 4.5 revolutions per SECOND — 27.1° per frame at 60 fps, past the Nyquist limit, so it would
 * visibly alias BACKWARDS. Jupiter would manage 67° per frame.
 *
 * At 1e3 Mars takes ~89 s per revolution and Jupiter ~36 s: slow enough to read as a turning
 * world rather than a spinning top, fast enough to be perceptible while you are parked at it.
 * Because it is a single scalar, every real period RATIO is preserved exactly — Jupiter really
 * does finish a day in a quarter the time Mars takes.
 *
 * DECLARED, and stated plainly: the scene now runs two clocks 400x apart. The belt is on
 * geological time; the planets are on something closer to human time. Both are declared rather
 * than hidden, and neither is visible in the same frame as the other. */
export const ROTATION_TIME_ACCEL = 1e3;

/** Rotation angle (radians) for a body at wall-clock `tS`. Zero for bodies with no real period,
 * and zero under reduced motion (the caller passes tS = 0). */
export function rotationAngle(bodyId: string, tS: number): number {
  const period = ROTATION_PERIOD_S[bodyId];
  if (!period || tS === 0) return 0;
  return ((2 * Math.PI) / period) * tS * ROTATION_TIME_ACCEL;
}

/** Shape of `public/assets/planets/manifest.json`, emitted by scripts/build-planet-textures.mjs. */
export interface PlanetTierSet {
  base: string;
  high: string;
  /** Only present for bodies with a real 8192-wide source — see the pipeline's TIERS note. */
  ultra?: string;
}
export interface PlanetManifestEntry {
  surface: PlanetTierSet;
  height: PlanetTierSet | null;
}
export interface PlanetManifest {
  generated: string;
  tiers: Record<string, { width: number; quality: number }>;
  bodies: Record<string, PlanetManifestEntry>;
}

/** Real relief as a fraction of the body's own radius. This is the number that explains why
 * every planetary visualization ever made exaggerates elevation: Olympus Mons, the tallest
 * relief in the solar system, is 0.65% of Mars's radius. At true scale a sphere is a sphere. */
export function reliefFraction(p: PlanetPhysical): number {
  return (p.reliefMaxKm - p.reliefMinKm) / p.radiusKm;
}

/** Direction from a body toward the Sun, in world space.
 *
 * Real, not a lighting convenience: `bodyWorldPosition` places every catalog body relative to
 * Sol at the world origin, so the vector from a body to the Sun is simply the negated, normalized
 * body position. A planet's lit hemisphere therefore faces genuinely sunward, and the terminator
 * falls where it really would for a viewer at that body's catalog position. */
export function sunDirectionFrom(
  bodyPos: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z] = bodyPos;
  const len = Math.hypot(x, y, z);
  if (len < 1e-6) return [0, 0, 1]; // at Sol itself: arbitrary but stable
  return [-x / len, -y / len, -z / len];
}

/** Whether a catalog entry is a body a sphere should be built for.
 *
 * Deliberately data-driven rather than a hardcoded id list: an entry qualifies when the shipped
 * planet-texture manifest has real surface imagery for it. That keeps this in step with
 * `scripts/build-planet-textures.mjs` automatically — adding a body to the pipeline makes it
 * spherical with no code change here. */
export function sphereIdFor(
  entry: { id: string; t?: string },
  manifestBodies: Record<string, unknown>,
): string | null {
  if (!entry.id) return null;
  // Catalog ids carry prefixes ("minorplanet-ceres"); the manifest is keyed on the bare name.
  const bare = entry.id.replace(/^[a-z]+-/, "");
  // Irregular bodies are blocked before any manifest lookup — see NEVER_SPHERE.
  if (NEVER_SPHERE.has(entry.id) || NEVER_SPHERE.has(bare)) return null;
  if (manifestBodies[entry.id]) return entry.id;
  if (manifestBodies[bare]) return bare;
  return null;
}

/* ---------- shader twins ------------------------------------------------ */

/* Shared constants, interpolated into both twins from the one TS source so they cannot drift.
 * ELEV_TEXEL is the finite-difference step used to derive surface normals from the height map;
 * it must match the shipped map's texel size or the derived slopes are scaled wrong. */
export const ELEV_SAMPLE_STEP = 1 / 2048;

/** Longitude offset applied when sampling, in UV units.
 *
 * ASTRA finding: the pack's maps put longitude 180°E at u = 0, not the 0°E a reader would assume.
 * Astra pinned this by locating Mars's real extrema — the Hellas basin and the Tharsis rise — in
 * the actual height map rather than trusting the convention. Without the half-turn every body
 * renders with its real features rotated 180° in longitude: still "a planet", but the wrong face
 * toward the Sun.
 *
 * Applied as a plain addition with the sampler in WRAP mode rather than fract() — fract() in a
 * fragment shader introduces a derivative discontinuity that shows up as a one-pixel mip seam. */
export const UV_LONGITUDE_OFFSET = 0.5;

/** Terminator softening half-width on N·L. The Sun is not a point: it subtends 0.350° at Mars and
 * 0.533° at the Moon, so the day/night boundary has a real penumbra — about 3 px on a 1000-px
 * disc. Small, but a hard step there is one of the tells of a fake planet. */
export const TERMINATOR_SOFTEN = 0.005;

const PLANET_SHADER_CONSTANTS = `
const float ELEV_STEP = ${ELEV_SAMPLE_STEP.toFixed(8)};
const float LON_OFFSET = ${UV_LONGITUDE_OFFSET.toFixed(4)};
const float TERM_SOFTEN = ${TERMINATOR_SOFTEN.toFixed(5)};
const float PI = 3.14159265;`;

export const PLANET_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vWorldPos;
${PLANET_SHADER_CONSTANTS}
void main(){
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  // The sphere is built at the origin then translated, so the object-space position IS the
  // outward radial direction — no normal matrix needed, and no non-uniform scale is ever applied.
  vNormal = normalize(mat3(world) * normal);
  vUV = uv;
  gl_Position = projection * view * wp;
}`;

export const PLANET_FRAGMENT_GLSL = `
precision highp float;
uniform sampler2D surfaceTex;
uniform sampler2D heightTex;
uniform vec3 uSunDir;      // world-space unit vector from the body toward the Sun
uniform float uHasHeight;  // 1 = this body ships real elevation, 0 = placeholder bound
uniform float uElevScale;  // vertical exaggeration (1.0 = true scale, see PLANET_ELEV_SCALE)
uniform float uAlbedo;     // real GEOMETRIC albedo
uniform float uLunarL;     // Lunar-Lambert coefficient: 1 = airless backscatter, 0 = Lambert
uniform vec3 uCamPos;      // world-space camera, for the emission-angle term
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vWorldPos;
${PLANET_SHADER_CONSTANTS}
void main(){
  // Longitude origin correction — see UV_LONGITUDE_OFFSET. Sampler is in WRAP mode, so no
  // fract() is needed and the derivative stays continuous across the seam.
  vec2 tUV = vec2(vUV.x + LON_OFFSET, vUV.y);
  vec3 surface = texture2D(surfaceTex, tUV).rgb;

  // TR-047: these four samples are taken UNCONDITIONALLY and gated by multiplication, never by
  // branching — see this file's header. The cost of sampling a 1x1 placeholder is nil.
  float hL = texture2D(heightTex, tUV - vec2(ELEV_STEP, 0.0)).r;
  float hR = texture2D(heightTex, tUV + vec2(ELEV_STEP, 0.0)).r;
  float hD = texture2D(heightTex, tUV - vec2(0.0, ELEV_STEP)).r;
  float hU = texture2D(heightTex, tUV + vec2(0.0, ELEV_STEP)).r;

  // Tangent frame for an equirectangular sphere, derived analytically rather than stored: the
  // geometric normal is radial, east is perpendicular to it and the polar axis, north completes
  // the basis. Degenerate exactly at the poles, where the cross product is stabilised below.
  vec3 N = normalize(vNormal);
  vec3 east = cross(vec3(0.0, 1.0, 0.0), N);
  float eastLen = length(east);
  east = eastLen > 1e-4 ? east / eastLen : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(N, east);

  // Slope from central differences, scaled by the declared exaggeration. The v term is negated
  // because texture v runs pole-to-pole against the north basis vector.
  float dHdu = (hR - hL) * uElevScale * uHasHeight;
  float dHdv = (hU - hD) * uElevScale * uHasHeight;
  vec3 perturbed = normalize(N - east * dHdu + north * dHdv);

  // LUNAR-LAMBERT reflectance. Plain Lambert here is BROKEN PHYSICS for airless bodies (Astra):
  // real regolith backscatters, which is why the full Moon is a flat evenly-lit disc with no limb
  // darkening, and why the half Moon is ~9% as bright as the full Moon rather than Lambert's 50%.
  //   I = albedo * ( 2 L mu0 / (mu0 + mu) + (1 - L) mu0 )
  // The Lommel-Seeliger term needs the EMISSION angle mu as well as the incidence angle mu0,
  // which is why this shader takes a camera position at all.
  vec3 viewDir = normalize(uCamPos - vWorldPos);
  float mu0 = max(dot(perturbed, normalize(uSunDir)), 0.0);
  float mu = max(dot(perturbed, viewDir), 0.0);
  float refl = 2.0 * uLunarL * mu0 / max(mu0 + mu, 1e-4) + (1.0 - uLunarL) * mu0;

  // Real terminator penumbra — the Sun is a disc, not a point (TERM_SOFTEN).
  float dayside = smoothstep(-TERM_SOFTEN, TERM_SOFTEN, dot(normalize(vNormal), normalize(uSunDir)));
  // A dim ambient term keeps the night side legible rather than pure black — a real night side is
  // lit by starlight and, for the Moon, earthshine; this stands in for that without modelling it.
  vec3 lit = surface * uAlbedo * (refl * dayside * 3.6 + 0.06);
  gl_FragColor = vec4(lit, 1.0);
}`;

export const PLANET_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;

const ELEV_STEP : f32 = ${ELEV_SAMPLE_STEP.toFixed(8)};
const PI : f32 = 3.14159265;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let wp : vec4<f32> = uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vWorldPos = wp.xyz;
  let m : mat3x3<f32> = mat3x3<f32>(
    uniforms.world[0].xyz, uniforms.world[1].xyz, uniforms.world[2].xyz);
  vertexOutputs.vNormal = normalize(m * vertexInputs.normal);
  vertexOutputs.vUV = vertexInputs.uv;
  vertexOutputs.position = uniforms.projection * uniforms.view * wp;
}`;

export const PLANET_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
var surfaceTexSampler : sampler;
var surfaceTex : texture_2d<f32>;
var heightTexSampler : sampler;
var heightTex : texture_2d<f32>;
uniform uSunDir : vec3<f32>;
uniform uHasHeight : f32;
uniform uElevScale : f32;
uniform uAlbedo : f32;
uniform uLunarL : f32;
uniform uCamPos : vec3<f32>;

const ELEV_STEP : f32 = ${ELEV_SAMPLE_STEP.toFixed(8)};
const LON_OFFSET : f32 = ${UV_LONGITUDE_OFFSET.toFixed(4)};
const TERM_SOFTEN : f32 = ${TERMINATOR_SOFTEN.toFixed(5)};
const PI : f32 = 3.14159265;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  // Longitude origin correction — line-for-line twin of the GLSL above.
  let tUV : vec2<f32> = vec2<f32>(fragmentInputs.vUV.x + LON_OFFSET, fragmentInputs.vUV.y);
  let surface : vec3<f32> =
    textureSample(surfaceTex, surfaceTexSampler, tUV).rgb;

  // TR-047: uniform control flow — sampled unconditionally, gated by multiplication.
  let hL : f32 = textureSample(heightTex, heightTexSampler,
    tUV - vec2<f32>(ELEV_STEP, 0.0)).r;
  let hR : f32 = textureSample(heightTex, heightTexSampler,
    tUV + vec2<f32>(ELEV_STEP, 0.0)).r;
  let hD : f32 = textureSample(heightTex, heightTexSampler,
    tUV - vec2<f32>(0.0, ELEV_STEP)).r;
  let hU : f32 = textureSample(heightTex, heightTexSampler,
    tUV + vec2<f32>(0.0, ELEV_STEP)).r;

  let N : vec3<f32> = normalize(fragmentInputs.vNormal);
  var east : vec3<f32> = cross(vec3<f32>(0.0, 1.0, 0.0), N);
  let eastLen : f32 = length(east);
  east = select(vec3<f32>(1.0, 0.0, 0.0), east / eastLen, eastLen > 1e-4);
  let north : vec3<f32> = cross(N, east);

  let dHdu : f32 = (hR - hL) * uniforms.uElevScale * uniforms.uHasHeight;
  let dHdv : f32 = (hU - hD) * uniforms.uElevScale * uniforms.uHasHeight;
  let perturbed : vec3<f32> = normalize(N - east * dHdu + north * dHdv);

  // LUNAR-LAMBERT reflectance — line-for-line twin of the GLSL above. See that comment for why
  // plain Lambert is broken physics on an airless body.
  let viewDir : vec3<f32> = normalize(uniforms.uCamPos - fragmentInputs.vWorldPos);
  let mu0 : f32 = max(dot(perturbed, normalize(uniforms.uSunDir)), 0.0);
  let mu : f32 = max(dot(perturbed, viewDir), 0.0);
  let refl : f32 =
    2.0 * uniforms.uLunarL * mu0 / max(mu0 + mu, 1e-4) + (1.0 - uniforms.uLunarL) * mu0;

  let dayside : f32 = smoothstep(-TERM_SOFTEN, TERM_SOFTEN,
    dot(normalize(fragmentInputs.vNormal), normalize(uniforms.uSunDir)));
  let lit : vec3<f32> = surface * uniforms.uAlbedo * (refl * dayside * 3.6 + 0.06);
  fragmentOutputs.color = vec4<f32>(lit, 1.0);
}`;

/** JS mirror of the shader's tangent-frame construction, so the arithmetic the twins share has an
 * off-GPU check — the same discipline star-field.ts applies to its billboard corner derivation.
 * Returns [east, north] for a given outward normal. */
export function tangentFrame(
  n: readonly [number, number, number],
): [[number, number, number], [number, number, number]] {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const N: [number, number, number] = [n[0] / len, n[1] / len, n[2] / len];
  // cross([0,1,0], N)
  let east: [number, number, number] = [
    1 * N[2] - 0 * N[1],
    0 * N[0] - 0 * N[2],
    0 * N[1] - 1 * N[0],
  ];
  const el = Math.hypot(east[0], east[1], east[2]);
  east = el > 1e-4 ? [east[0] / el, east[1] / el, east[2] / el] : [1, 0, 0];
  const north: [number, number, number] = [
    N[1] * east[2] - N[2] * east[1],
    N[2] * east[0] - N[0] * east[2],
    N[0] * east[1] - N[1] * east[0],
  ];
  return [east, north];
}
