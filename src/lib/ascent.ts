/* ascent.ts — PF-11 D1.3: the launch-cinematic curves, pure and unit-testable.
 *
 * The engine owns the render loop and the camera; this module owns the SHAPES — one eased
 * progress parameter `k ∈ [0,1]` driving a physical altitude, a rendered camera standoff, and the
 * three atmospheric transitions (sky colour, star reveal, limb ring). Split out for the same
 * reason `planet-sphere.ts`'s `homeOrbitPosition` and `perf-telemetry.ts`'s `PerfMonitor` are:
 * the geometry that has to be RIGHT is testable without a browser, and a regression in it is
 * silent in a screenshot.
 *
 * Science: Astra's sky-frames & travel brief §4 (barometric sky-colour `exp(−h/8.5 km)`, star
 * reveal ~50-80 km, Kármán-line limb 80-120 km). Motion: the D1.3 ascent motion-spec
 * (docs/experience-design/2026-07-23-pf11-d1.3-ascent-motion-spec.md) — `easeCam` vs `easeAlt`,
 * the beat sheet, the pose-matched handoff.
 *
 * The whole intro is a DECLARED LICENSE on TIMING (a real ~8-minute ascent compressed to ~8 s)
 * with ACCURATE colour/altitude physics — the curve below is real, only the clock is fast.
 */

/** Nominal total duration, ms. Declared license (real ascent to the Kármán line ~8 min). */
export const ASCENT_DURATION_MS = 8000;

/** Camera standoff (world units) at launch and at handoff. The end value is deliberately equal to
 * the home standoff (`ARRIVE_STANDOFF` / `HOME_ORBIT_RADIUS` = 38), so the ascent lands on the
 * exact home pose with no cut — LAUNCH is the D6.4 `goHome` reveal played forward. The start is 3
 * units above the sphere surface (radius 26): close enough that Earth fills the lower frame with
 * its limb overhead, far enough not to clip the near plane. */
export const ASCENT_START_STANDOFF = 29;
export const ASCENT_END_STANDOFF = 38;

/** Physical altitude at k=1, km — the top of the modelled climb, just above the Kármán line. */
export const ASCENT_MAX_ALT_KM = 120;

/** Barometric scale height, km (Astra). Sky surface brightness ∝ column ∝ exp(−h/H). */
export const ATMOSPHERE_SCALE_H_KM = 8.5;

/** Star-reveal altitude band, km — first stars cross in across this window as the sky luminance
 * falls below stellar (Astra: ~50-80 km). Below the low edge the sky is too bright for any star;
 * above the high edge the full field is out. */
export const STAR_REVEAL_ALT_LO_KM = 50;
export const STAR_REVEAL_ALT_HI_KM = 80;

/** Limb-ring visibility window, km. The thin blue atmospheric arc is honest ONLY here — this is
 * the one geometry in the whole scene where a blue limb is genuinely in frame (the arrival
 * geometry has none, Astra §4). Rises toward the Kármán line, gone by the handoff so the arrival
 * geometry never inherits it. */
export const LIMB_ALT_RISE_LO_KM = 70;
export const LIMB_ALT_RISE_HI_KM = 100;
export const LIMB_ALT_FALL_LO_KM = 105;
export const LIMB_ALT_FALL_HI_KM = 120;

/** Daytime sky tint seen above the limb from the pad, linear RGB. The ascent lerps the scene
 * background from this toward space-black as altitude climbs. A modest horizon blue rather than a
 * vivid zenith blue — from a near-surface vantage looking along the limb, the visible sky is the
 * lower, paler part of the gradient. Astra audits the exact value. */
export const DAY_SKY_RGB: readonly [number, number, number] = [0.3, 0.5, 0.8];

/** Limb-glow colour, linear RGB — the blue of atmospheric Rayleigh scattering seen edge-on. A
 * touch brighter and bluer than the surface sky tint, because the limb is the longest sight-line
 * through the atmosphere there is. Astra audits it against the real twilight-arc colour. */
export const LIMB_GLOW_RGB: readonly [number, number, number] = [
  0.35, 0.55, 1.0,
];

/** Radius of the limb-glow shell as a fraction of the planet sphere radius. Just outside the
 * solid surface (like Earth's real ~5 km atmosphere on a 6371 km radius, exaggerated so the glow
 * is a visible arc rather than a sub-pixel line) — the fresnel rim on this shell reads as a thin
 * ring hugging the planet's silhouette. */
export const LIMB_SHELL_FACTOR = 1.06;

/** smoothstep(edge0, edge1, x) — the C¹ Hermite ramp, clamped. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Camera ease — `k³`, slow-out. A launch spends a long time low and slow, then leaves fast; an
 * ease-IN reads as thrust, where linear reads as drift and ease-out reads as falling backward.
 * This is the single most important curve in the sequence (motion-spec §2). */
export function easeCam(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * c;
}

/** Altitude/physics ease — `k²(3−2k)`, smoothstep. Runs slightly AHEAD of the camera on purpose:
 * the atmosphere's exponential falloff darkens the sky while the camera has barely moved, which is
 * both real (violet-black by ~40-50 km, under half the climb) and the right dramatic order — the
 * colour change is the early beat, the camera speed the late one (motion-spec §2). */
export function easeAlt(k: number): number {
  const c = Math.min(1, Math.max(0, k));
  return c * c * (3 - 2 * c);
}

/** Physical altitude (km) at eased progress k. Drives the sky/star/limb physics. */
export function ascentAltitudeKm(k: number): number {
  return ASCENT_MAX_ALT_KM * easeAlt(k);
}

/** Rendered camera standoff (world units) at eased progress k. Drives the camera position. */
export function ascentStandoff(k: number): number {
  return (
    ASCENT_START_STANDOFF +
    (ASCENT_END_STANDOFF - ASCENT_START_STANDOFF) * easeCam(k)
  );
}

/** Fraction of the DAYTIME sky colour still present at altitude h (km): `exp(−h/H)`, clamped to
 * [0,1]. 1 at the surface (full day tint), ~0.009 by 40 km (near-black) — the honest barometric
 * curve. The background is `mix(spaceBlack, DAY_SKY, skyMix(h))`. */
export function skyMix(hKm: number): number {
  return Math.min(1, Math.max(0, Math.exp(-hKm / ATMOSPHERE_SCALE_H_KM)));
}

/** Star-field / Milky Way band fade at altitude h (km): 0 below the reveal band, 1 above it. The
 * complement of the sky being bright — stars are visible once the sky luminance drops below
 * stellar. Reused for both the star material and the band uFade so they come out together. */
export function starFade(hKm: number): number {
  return smoothstep(STAR_REVEAL_ALT_LO_KM, STAR_REVEAL_ALT_HI_KM, hKm);
}

/** Limb-ring intensity at altitude h (km): rises toward the Kármán line, falls to 0 by the top of
 * the climb. A single smooth bump, never a strobe. Zero at h=0 (no ring on the pad) and zero at
 * h≥`LIMB_ALT_FALL_HI_KM` (gone at handoff). */
export function limbIntensity(hKm: number): number {
  const rise = smoothstep(LIMB_ALT_RISE_LO_KM, LIMB_ALT_RISE_HI_KM, hKm);
  const fall = 1 - smoothstep(LIMB_ALT_FALL_LO_KM, LIMB_ALT_FALL_HI_KM, hKm);
  return rise * fall;
}

/* ---------- Limb-glow shell shader (both twins, CLAUDE.md #4) -----------------------------
 *
 * A thin blue arc hugging Earth's silhouette during the 80-120 km beat — the one geometry in the
 * whole scene where a blue limb is honestly in frame (Astra §4; the arrival geometry has none). A
 * sphere shell just outside the planet, rendered additively with a FRESNEL rim so the glow lives
 * only at the silhouette edge, and gated by N·sun so only the SUNLIT limb scatters (a night-side
 * glow would be light with no source — the same honesty rule the night-lights mask follows).
 *
 * No texture sampler, so #9 (placeholder-before-draw) does not apply; no reserved WGSL
 * identifiers (fresnel/dayFac/rim/viewDir are all safe). `uLimb` is `limbIntensity(h)`. */
export const LIMB_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vNormal = normalize(mat3(world) * normal);
  gl_Position = projection * view * wp;
}`;

export const LIMB_FRAGMENT_GLSL = `
precision highp float;
uniform vec3 uCamPos;
uniform vec3 uSunDir;
uniform float uLimb;      // limbIntensity(h): 0..1 visibility for this frame
uniform vec3 uColor;
varying vec3 vNormal;
varying vec3 vWorldPos;
void main(){
  vec3 N = normalize(vNormal);
  vec3 viewDir = normalize(uCamPos - vWorldPos);
  // Rim: brightest where the surface turns away from the camera (the silhouette), zero facing on.
  float fresnel = pow(1.0 - abs(dot(N, viewDir)), 3.0);
  // Only the sunlit atmosphere scatters — no glow on the night limb.
  float dayFac = smoothstep(-0.1, 0.35, dot(N, normalize(uSunDir)));
  float rim = fresnel * dayFac * uLimb;
  gl_FragColor = vec4(uColor * rim, rim);
}`;

export const LIMB_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute normal : vec3<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let wp : vec4<f32> = uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vWorldPos = wp.xyz;
  let m : mat3x3<f32> = mat3x3<f32>(
    uniforms.world[0].xyz, uniforms.world[1].xyz, uniforms.world[2].xyz);
  vertexOutputs.vNormal = normalize(m * vertexInputs.normal);
  vertexOutputs.position = uniforms.projection * uniforms.view * wp;
}`;

export const LIMB_FRAGMENT_WGSL = `
uniform uCamPos : vec3<f32>;
uniform uSunDir : vec3<f32>;
uniform uLimb : f32;
uniform uColor : vec3<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let N : vec3<f32> = normalize(fragmentInputs.vNormal);
  let viewDir : vec3<f32> = normalize(uniforms.uCamPos - fragmentInputs.vWorldPos);
  let fresnel : f32 = pow(1.0 - abs(dot(N, viewDir)), 3.0);
  let dayFac : f32 = smoothstep(-0.1, 0.35, dot(N, normalize(uniforms.uSunDir)));
  let rim : f32 = fresnel * dayFac * uniforms.uLimb;
  fragmentOutputs.color = vec4<f32>(uniforms.uColor * rim, rim);
}`;

/** The full per-frame ascent state for a given eased progress k, so the engine reads one object
 * and the test asserts one object. `spaceBlack` is passed in (the engine's scene clear colour) so
 * this module needs no engine dependency. */
export interface AscentState {
  /** eased progress, 0..1 (echoed for convenience/telemetry). */
  k: number;
  altitudeKm: number;
  standoff: number;
  /** linear RGB background for this frame. */
  sky: [number, number, number];
  /** 0..1 star-field + band fade. */
  starFade: number;
  /** 0..1 limb-ring intensity. */
  limb: number;
}

export function ascentStateAt(
  k: number,
  spaceBlack: readonly [number, number, number],
): AscentState {
  const altitudeKm = ascentAltitudeKm(k);
  const m = skyMix(altitudeKm);
  return {
    k: Math.min(1, Math.max(0, k)),
    altitudeKm,
    standoff: ascentStandoff(k),
    sky: [
      spaceBlack[0] + (DAY_SKY_RGB[0] - spaceBlack[0]) * m,
      spaceBlack[1] + (DAY_SKY_RGB[1] - spaceBlack[1]) * m,
      spaceBlack[2] + (DAY_SKY_RGB[2] - spaceBlack[2]) * m,
    ],
    starFade: starFade(altitudeKm),
    limb: limbIntensity(altitudeKm),
  };
}
