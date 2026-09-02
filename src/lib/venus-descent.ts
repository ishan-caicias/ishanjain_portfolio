/* venus-descent.ts — PF-10 C4.2: the Venus cloud-descent arrival.
 *
 * THE PROBLEM THIS SOLVES. `venus-ultra.jpg` is a Magellan RADAR map. Sphered plainly it shows
 * surface detail no human eye could ever see, because the real planet is a featureless cream ball
 * behind an unbroken sulfuric-acid deck. Astra flagged it; the owner's call was to make the
 * contradiction the feature — descend through the real cloud layer and emerge over the
 * radar-mapped surface, which is honest, because radar-through-cloud is exactly how humanity has
 * actually seen that surface.
 *
 * THE FINDING THAT SHAPED THE IMPLEMENTATION, and it is not the one anyone expected.
 *
 * Astra's verdict: **the dishonesty risk is not the radar map — it is LIGHTING the radar map.**
 * C4.1's directional Sun, Lunar-Lambert reflectance and height-derived normals applied to Magellan
 * data would manufacture fake geometry and then cast fake light across it, and would pass every
 * review, because it would look superb. So below the deck this body takes a SHADER FORK: no
 * directional light, no terminator, no normal perturbation. That is also simply what is true —
 * Venera 9/10/13/14 recorded flat, shadowless orange light with no solar disc visible.
 *
 * TWO MEASURED ASSET FACTS, both re-verified against the real files rather than taken on trust:
 *
 *   `venus-cloud.jpg` (1024x512) is a UV map, not a visible-light one. All three channels carry
 *   IDENTICAL statistics — mean 171.4, sigma 35.1 — so it is one band replicated, and its
 *   contrast is 20.5% against a real visible-light cloud contrast of 1-3%. Compositing it as-is
 *   would present a UV image as a photograph. `CLOUD_CONTRAST_SCALE` below flattens it to the
 *   real figure.
 *
 *   `venus-ultra.jpg`'s orange cast IS the real Venera illuminant: Astra derived (1.00, 0.57,
 *   0.20) independently from Rayleigh transmission and it matched the asset to two decimals. So
 *   the tint is defensible and is kept; only the spatial contrast was ever the problem.
 *
 * WHAT IS DECLARED. The altitude keyframes, their ORDER and their optical consequences are real.
 * Their mapping onto world units is not, and cannot be: at PLANET_SPHERE_RADIUS = 26 the entire
 * 70 km deck is 0.097 world units thick, so a literally-scaled descent would be a camera move of
 * one tenth of a unit, and the two shells would sit inside each other's depth precision. The
 * descent is therefore played as a PARAMETER, not as a camera translation — `descentAltitudeKm`
 * maps wall-clock progress onto real altitude, and everything visual keys off that altitude.
 */

/** Real cloud-structure altitudes, km. Astra's brief; ordering and values are real. */
export const VENUS_ALTITUDES = {
  /** Entry: optical depth 1, the visual "top" of the planet. */
  cloudTopKm: 70,
  /** Upper/middle deck boundary. */
  upperMiddleKm: 56.5,
  /** The famous "habitable layer" — 0.53 bar and +30 °C, the one altitude in the solar system
   * outside Earth where a human could survive the pressure and temperature unprotected. */
  habitableKm: 55,
  /** Middle/lower deck boundary. */
  middleLowerKm: 50.5,
  /** CLOUD BASE — the breakout, and the real payoff of the whole descent. Not 0 km. */
  cloudBaseKm: 47.5,
  /** Where the descent ends. Astra: do NOT land. At the surface visibility is 3.3 km and there
   * is nothing to see; the view from just under the deck is the actual reveal. */
  endKm: 20,
} as const;

/** Total descent duration, seconds. Astra: ~170x compression of a real 55-62 min probe descent,
 * with half of it spent inside the deck where the structure actually is. */
export const VENUS_DESCENT_S = 20;

/** Contrast reduction applied to the UV cloud map: 20.5% measured -> ~2.5% real. */
export const CLOUD_CONTRAST_SCALE = 0.12;

/** Real cloud-top albedo, linear RGB (~#F0DAC5 — pale warm cream). */
export const VENUS_CLOUDTOP_RGB: readonly [number, number, number] = [
  0.85, 0.69, 0.55,
];

/** Real Venera surface illuminant, linear RGB (~#FFC57B). Matches the asset's own cast. */
export const VENUS_SURFACE_RGB: readonly [number, number, number] = [
  1.0, 0.57, 0.2,
];

/** Real basalt albedo at the Venera landing sites — uniformly dark, which is exactly why a
 * "visible-light interpretation" of the radar map would be an invention. */
export const VENUS_SURFACE_ALBEDO = 0.1;

/** Altitude below which the shader fork engages: no directional light, no terminator, no normal
 * perturbation. Astra's boundary. */
export const VENUS_FLAT_LIGHT_KM = 45;

/** Real cloud-top super-rotation, m/s. The atmosphere laps the planet in 4.45 days against a
 * 243-day solid body — 54.6x, in the same (retrograde) sense. */
export const VENUS_CLOUDTOP_WIND_MS = 100;

/** Descent altitude (km) at wall-clock progress `t` in [0,1].
 *
 * Deliberately NOT linear in altitude. Astra's pacing spends 3.5 s above the deck, 10.0 s inside
 * it, 4.5 s through the breakout and 2.0 s below — half the runtime inside the clouds, because
 * that is where the real structure is and a linear fall would rush it. Implemented as a piecewise
 * map over the real altitudes so the keyframes stay legible against the brief. */
export function descentAltitudeKm(t: number): number {
  const p = Math.max(0, Math.min(1, t));
  const A = VENUS_ALTITUDES;
  // segment fractions: above deck, upper+middle, breakout, below
  const seg: Array<[number, number, number]> = [
    [0.0, 0.175, A.cloudTopKm],
    [0.175, 0.675, A.upperMiddleKm],
    [0.675, 0.9, A.cloudBaseKm],
    [0.9, 1.0, A.endKm],
  ];
  // Entry altitude is above the cloud top so the approach starts genuinely outside the deck.
  let from = A.cloudTopKm + 20;
  for (const [t0, t1, to] of seg) {
    if (p <= t1) {
      const k = (p - t0) / (t1 - t0);
      return from + (to - from) * Math.max(0, Math.min(1, k));
    }
    from = to;
  }
  return A.endKm;
}

/** Cloud opacity at an altitude: opaque inside the deck, clearing below the base.
 *
 * The deck really is optically thick — you cannot see the surface from inside it — so this goes
 * to 1 through the middle and only releases below `cloudBaseKm`. Above the top it fades in as the
 * approach begins rather than switching on. */
export function cloudOpacity(altKm: number): number {
  const A = VENUS_ALTITUDES;
  if (altKm >= A.cloudTopKm + 15) return 0;
  if (altKm >= A.cloudTopKm) {
    return 1 - (altKm - A.cloudTopKm) / 15;
  }
  if (altKm >= A.cloudBaseKm) return 1;
  // Below the base the deck is above you and thinning fast.
  return Math.max(0, (altKm - (A.cloudBaseKm - 12)) / 12);
}

/** How far the flat-light shader fork has engaged at an altitude: 0 above `VENUS_FLAT_LIGHT_KM`,
 * 1 well below it. Ramped rather than switched so the transition is not a visible pop. */
export function flatLightAmount(altKm: number): number {
  const hi = VENUS_FLAT_LIGHT_KM;
  const lo = hi - 15;
  if (altKm >= hi) return 0;
  if (altKm <= lo) return 1;
  return (hi - altKm) / (hi - lo);
}

/** Illumination colour at an altitude: real cream at the cloud top grading to the real Venera
 * orange below. Both endpoints are measured, not chosen. */
export function descentTint(altKm: number): [number, number, number] {
  const k = flatLightAmount(altKm);
  return [
    VENUS_CLOUDTOP_RGB[0] + (VENUS_SURFACE_RGB[0] - VENUS_CLOUDTOP_RGB[0]) * k,
    VENUS_CLOUDTOP_RGB[1] + (VENUS_SURFACE_RGB[1] - VENUS_CLOUDTOP_RGB[1]) * k,
    VENUS_CLOUDTOP_RGB[2] + (VENUS_SURFACE_RGB[2] - VENUS_CLOUDTOP_RGB[2]) * k,
  ];
}

/** Relative scene illuminance at an altitude — 1.00 at the cloud top, 0.06 at 50 km, 0.02 at the
 * surface. Astra's measured profile, and the reason the descent reads as "dimming" rather than
 * "going dark": inside the upper deck Venus is BRIGHT. */
export function descentIlluminance(altKm: number): number {
  if (altKm >= VENUS_ALTITUDES.cloudTopKm) return 1;
  if (altKm >= 50)
    return 1 - 0.94 * ((VENUS_ALTITUDES.cloudTopKm - altKm) / 20);
  return Math.max(0.02, 0.06 - 0.04 * ((50 - altKm) / 50));
}

/* ---------- cloud-shell shader twins ------------------------------------ */

/* The deck is deliberately UNDRAMATIC. Astra flagged making it dramatic as the same dishonesty as
 * the radar map, only inverted: real Venus in visible light is a near-featureless cream ball, and
 * the shipped map's 20.5% contrast is a UV image. `uContrast` flattens it toward the real 1-3%
 * around its own mean, so what remains is the true faint banding rather than invented drama. */

export const VENUS_CLOUD_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
varying vec2 vUV;
varying vec3 vNormal;
void main(){
  vUV = uv;
  vNormal = normalize(mat3(world) * position);
  gl_Position = projection * view * world * vec4(position, 1.0);
}`;

export const VENUS_CLOUD_FRAGMENT_GLSL = `
precision highp float;
uniform sampler2D cloudTex;
uniform float uOpacity;
uniform float uContrast;
uniform vec3 uTint;
varying vec2 vUV;
varying vec3 vNormal;
void main(){
  // The source is a single replicated band (a UV map), so one channel carries all its data.
  float band = texture2D(cloudTex, vUV).r;
  // Flatten toward the mean: 20.5% measured contrast -> ~2.5% real visible-light contrast.
  float flattened = 0.672 + (band - 0.672) * uContrast;
  vec3 col = uTint * (0.85 + 0.30 * flattened);
  // Soften the shell's own limb so it reads as an atmosphere rather than a hard second sphere.
  float limb = 0.55 + 0.45 * abs(normalize(vNormal).z);
  gl_FragColor = vec4(col, uOpacity * limb);
}`;

export const VENUS_CLOUD_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute uv : vec2<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.vUV = vertexInputs.uv;
  let m : mat3x3<f32> = mat3x3<f32>(
    uniforms.world[0].xyz, uniforms.world[1].xyz, uniforms.world[2].xyz);
  vertexOutputs.vNormal = normalize(m * vertexInputs.position);
  vertexOutputs.position =
    uniforms.projection * uniforms.view * uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
}`;

export const VENUS_CLOUD_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;
var cloudTexSampler : sampler;
var cloudTex : texture_2d<f32>;
uniform uOpacity : f32;
uniform uContrast : f32;
uniform uTint : vec3<f32>;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let band : f32 = textureSample(cloudTex, cloudTexSampler, fragmentInputs.vUV).r;
  let flattened : f32 = 0.672 + (band - 0.672) * uniforms.uContrast;
  let col : vec3<f32> = uniforms.uTint * (0.85 + 0.30 * flattened);
  let limb : f32 = 0.55 + 0.45 * abs(normalize(fragmentInputs.vNormal).z);
  fragmentOutputs.color = vec4<f32>(col, uniforms.uOpacity * limb);
}`;

/** Cloud-shell rotation (radians) at wall-clock `tS`.
 *
 * REAL TIME, 1.0x — deliberately not the 1e3 rotation clock. Astra: on that clock the real
 * 100 m/s cloud-top wind becomes 100 km/s, which is 0.033c. The super-rotation is real and
 * visible on its own terms over a 20 s descent, so it needs no acceleration at all. */
export function cloudAdvection(tS: number): number {
  // 4.45-day lap at real rate; retrograde, matching the solid body's sense.
  return -((2 * Math.PI) / (4.45 * 86400)) * tS;
}
