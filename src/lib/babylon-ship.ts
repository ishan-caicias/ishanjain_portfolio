/* babylon-ship.ts — PF-09 B3: the Babylon ship-mesh track (owner-unblocked
 * 2026-07-19), carrying the three ship-attached B3 items: GPU thruster plume,
 * heat-shimmer post-pass, and docking-approach polish.
 *
 * The GLB and ALL plume math are reused, not re-invented: the same tiered
 * assets craft-loader.ts ships (public/assets/craft/sci-fi-fighter-{1k,2k}.glb,
 * tier via craft-tier.ts's audited policy) and ship-dynamics.ts's pure plume
 * system (PLUME_ENGINES anchors, buildPlumeVertices cones, plumeFlareLength/
 * plumeAlpha/plumeThrottle phase functions, PLUME_CORE/PLUME_SHEATH colours —
 * baked into the shader twins below for parity with the live engine's F3
 * flame).
 *
 * COORDINATE CONVENTION. Unit-ship space (craft-loader, PLUME_ENGINES) has
 * nose −Z / stern +Z. Babylon's glTF import converts right-handed glTF to the
 * left-handed scene by negating Z under its `__root__` node, so the imported
 * hull's nose lands on +Z — the same direction as BABYLON_FORWARD. The plume
 * anchors therefore get their Z negated (`plumeToWrapperSpace`) so cones sit
 * at the stern (wrapper −Z) and extend backwards, and the whole wrapper is
 * oriented by pointing its +Z along the travel direction.
 *
 * FLIP-AND-BURN. The warp HUD's phase thresholds (accel < 0.47, flip < 0.53,
 * then decel — babylon-engine.ts `wphase`) now drive the HULL, not just the
 * readout: `flipPhase(k)` swings the ship 180° across the flip window, so the
 * decel burn is a real retro burn — nose backwards, plume toward the
 * destination. The plume phase functions receive `burning` on both burn
 * segments and `coasting` across the flip, exactly like the live engine.
 */
import {
  buildPlumeVertices,
  PLUME_CORE,
  PLUME_SHEATH,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
  type PlumeParams,
} from "./ship-dynamics";

/** Warp-fraction thresholds shared with the HUD readout (babylon-engine.ts
 * `wphase`) — exported so hull choreography and HUD can't drift apart. */
export const WARP_ACCEL_END = 0.47;
export const WARP_DECEL_START = 0.53;

/** 0 while accelerating, ramps 0→1 across the flip window, 1 through the
 * decel burn — the hull's 180° flip-and-burn rotation fraction. Smoothstep
 * eased so the flip reads as a deliberate manoeuvre, not a snap. */
export function flipPhase(k: number): number {
  if (k <= WARP_ACCEL_END) return 0;
  if (k >= WARP_DECEL_START) return 1;
  const t = (k - WARP_ACCEL_END) / (WARP_DECEL_START - WARP_ACCEL_END);
  return t * t * (3 - 2 * t);
}

/** PlumeParams for a warp fraction — burn on both accel and decel segments,
 * engines cut across the flip, matching the live engine's phase model. */
export function plumeParamsForWarp(
  k: number,
  reduced: boolean,
  tS: number,
): PlumeParams {
  const coasting = k > WARP_ACCEL_END && k < WARP_DECEL_START;
  return {
    burning: !coasting,
    coasting,
    parked: false,
    reduced,
    t: tS,
  };
}

/** PlumeParams while parked/aiming (idling engines). */
export function plumeParamsIdle(reduced: boolean, tS: number): PlumeParams {
  return { burning: false, coasting: false, parked: true, reduced, t: tS };
}

/** Docking-approach polish: hull visibility after arrival — hold briefly at
 * full (the "berthing" beat), then fade out as the dossier takes over.
 * Returns 1 → 0. */
export const DOCK_HOLD_S = 0.45;
export const DOCK_FADE_S = 1.2;

export function dockFade(sinceArriveS: number): number {
  if (sinceArriveS <= DOCK_HOLD_S) return 1;
  const t = (sinceArriveS - DOCK_HOLD_S) / DOCK_FADE_S;
  if (t >= 1) return 0;
  return 1 - t * t * (3 - 2 * t);
}

/** B4 step 4 — docking contact: the "gentle constraint/impulse as the ship
 * berths". Two ingredients, both reduced-motion-gated: a soft camera bump
 * (fed through the impact-shake system at DOCK_BUMP_AMP) and this damped
 * contact oscillation — the hull overshoots into the berth along its
 * approach axis and rings down like a sprung docking clamp. */
export const DOCK_CONTACT = {
  /** Camera-bump amplitude fed to the shake system at the contact instant. */
  bumpAmp: 0.32,
  /** Hull overshoot amplitude along the approach axis (world units). */
  settleAmp: 0.5,
  /** Contact-spring frequency (Hz). */
  settleFreq: 2.2,
  /** Ring-down time constant (s). */
  settleTau: 0.5,
} as const;

/** Damped contact oscillation along the approach axis: 0 at contact, swings
 * forward into the berth, rings down to rest (< 1% after ~5τ). */
export function dockSettleOffset(sinceS: number): number {
  if (sinceS <= 0) return 0;
  const t = DOCK_CONTACT;
  return (
    t.settleAmp *
    Math.exp(-sinceS / t.settleTau) *
    Math.sin(2 * Math.PI * t.settleFreq * sinceS)
  );
}

/** buildPlumeVertices emits unit-ship space (stern +Z); the Babylon wrapper
 * flies nose +Z (see header), so Z negates. Splits the interleaved output
 * into the two vertex buffers the Babylon mesh uses (positions + axial/side
 * meta). Reuses caller-owned scratch arrays — this runs every frame. */
export function plumeBuffersForWrapper(
  flare: number,
  scratchInterleaved: Float32Array,
  outPositions: Float32Array,
  outMeta: Float32Array,
): void {
  const v = buildPlumeVertices(flare, scratchInterleaved);
  for (let i = 0; i < PLUME_VERTEX_COUNT; i++) {
    const s = i * PLUME_VERTEX_FLOATS;
    outPositions[i * 3] = v[s];
    outPositions[i * 3 + 1] = v[s + 1];
    outPositions[i * 3 + 2] = -v[s + 2]; // unit-ship stern +Z → wrapper −Z
    outMeta[i * 2] = v[s + 3]; // axial
    outMeta[i * 2 + 1] = v[s + 4]; // side
  }
}

/** Sequential triangle-list indices for the plume (vertices are already
 * expanded triangles — see buildPlumeVertices). */
export function plumeIndices(): Uint32Array {
  const idx = new Uint32Array(PLUME_VERTEX_COUNT);
  for (let i = 0; i < PLUME_VERTEX_COUNT; i++) idx[i] = i;
  return idx;
}

/* ---------- shader sources -------------------------------------------------
 *
 * Same GLSL/WGSL line-parallel twin convention as the star / shooting-star /
 * nebula pairs. The flame ports the live engine's F3 concept — two scrolling
 * noise taps whose interference gives turbulence plus the in-plume heat
 * shimmer — with the noise procedural (hash-based) instead of the live
 * engine's pre-generated texture, and PLUME_CORE / PLUME_SHEATH baked from
 * ship-dynamics.ts so the two engines' flames share one colour source. */

const f6 = (n: number) => n.toFixed(6);
const CORE = `vec3(${f6(PLUME_CORE[0])}, ${f6(PLUME_CORE[1])}, ${f6(PLUME_CORE[2])})`;
const SHEATH = `vec3(${f6(PLUME_SHEATH[0])}, ${f6(PLUME_SHEATH[1])}, ${f6(PLUME_SHEATH[2])})`;
const CORE_W = `vec3<f32>(${f6(PLUME_CORE[0])}, ${f6(PLUME_CORE[1])}, ${f6(PLUME_CORE[2])})`;
const SHEATH_W = `vec3<f32>(${f6(PLUME_SHEATH[0])}, ${f6(PLUME_SHEATH[1])}, ${f6(PLUME_SHEATH[2])})`;

export const PLUME_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec2 plumeMeta;   // x = axial (1 nozzle -> 0 tip), y = side (-1..1)
uniform mat4 worldViewProjection;
varying vec2 vAS;
void main(){
  gl_Position = worldViewProjection * vec4(position, 1.0);
  vAS = plumeMeta;
}`;

export const PLUME_FRAGMENT_GLSL = `
precision highp float;
varying vec2 vAS;
uniform float uTime;
uniform float uThrottle;
uniform float uAlpha;
float ph(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float pn(vec2 p){
  vec2 ip = floor(p);
  vec2 fp = p - ip;
  vec2 u = fp*fp*(3.0-2.0*fp);
  return mix(
    mix(ph(ip), ph(ip + vec2(1.0, 0.0)), u.x),
    mix(ph(ip + vec2(0.0, 1.0)), ph(ip + vec2(1.0, 1.0)), u.x),
    u.y);
}
void main(){
  float axial = vAS.x;
  float along = 1.0 - axial;
  float sideAbs = abs(vAS.y);
  // two noise taps at different rates: turbulence + in-plume heat shimmer
  float m1 = pn(vec2(vAS.y*2.0, along*3.0 - uTime*2.6));
  float m2 = pn(vec2(vAS.y*3.7 + 5.0, along*5.0 - uTime*4.1));
  float turb = mix(0.8, m1*0.7 + m2*0.6, uThrottle);
  float coreK = exp(-sideAbs*sideAbs*6.0) * (0.30 + 0.70*axial);
  float sheathK = exp(-sideAbs*sideAbs*2.2) * (0.15 + 0.85*axial);
  vec3 col = ${CORE} * coreK + ${SHEATH} * max(sheathK - coreK*0.45, 0.0);
  float a = uAlpha * turb * sheathK;
  gl_FragColor = vec4(col * turb, a);
}`;

export const PLUME_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute plumeMeta : vec2<f32>;
uniform worldViewProjection : mat4x4<f32>;
varying vAS : vec2<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = uniforms.worldViewProjection * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vAS = vertexInputs.plumeMeta;
}`;

export const PLUME_FRAGMENT_WGSL = `
varying vAS : vec2<f32>;
uniform uTime : f32;
uniform uThrottle : f32;
uniform uAlpha : f32;

fn ph(p : vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}
fn pn(p : vec2<f32>) -> f32 {
  let ip : vec2<f32> = floor(p);
  let fp : vec2<f32> = p - ip;
  let u : vec2<f32> = fp*fp*(3.0-2.0*fp);
  return mix(
    mix(ph(ip), ph(ip + vec2<f32>(1.0, 0.0)), u.x),
    mix(ph(ip + vec2<f32>(0.0, 1.0)), ph(ip + vec2<f32>(1.0, 1.0)), u.x),
    u.y);
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let axial : f32 = fragmentInputs.vAS.x;
  let along : f32 = 1.0 - axial;
  let sideAbs : f32 = abs(fragmentInputs.vAS.y);
  let m1 : f32 = pn(vec2<f32>(fragmentInputs.vAS.y*2.0, along*3.0 - uniforms.uTime*2.6));
  let m2 : f32 = pn(vec2<f32>(fragmentInputs.vAS.y*3.7 + 5.0, along*5.0 - uniforms.uTime*4.1));
  let turb : f32 = mix(0.8, m1*0.7 + m2*0.6, uniforms.uThrottle);
  let coreK : f32 = exp(-sideAbs*sideAbs*6.0) * (0.30 + 0.70*axial);
  let sheathK : f32 = exp(-sideAbs*sideAbs*2.2) * (0.15 + 0.85*axial);
  let col : vec3<f32> = ${CORE_W} * coreK + ${SHEATH_W} * max(sheathK - coreK*0.45, 0.0);
  let a : f32 = uniforms.uAlpha * turb * sheathK;
  fragmentOutputs.color = vec4<f32>(col * turb, a);
}`;

/* Heat-shimmer refraction post-pass — the F3-deferred SCREEN-SPACE pass, now
 * deliverable because a real nozzle exists to anchor it. Displaces the scene
 * sample by animated noise inside a radial falloff around the nozzle's screen
 * position, scaled by throttle. Runs on both tiers (it is a fragment pass,
 * not compute — the budget table's "no compute FX" fallback rule is about
 * compute); B5 owns any per-device intensity scaling. */

export const SHIMMER_RADIUS_UV = 0.16;
export const SHIMMER_STRENGTH = 0.011;

export const SHIMMER_FRAGMENT_GLSL = `
precision highp float;
varying vec2 vUV;
uniform sampler2D textureSampler;
uniform vec2 uCenter;      // nozzle screen position, uv space
uniform float uIntensity;  // throttle × ship visibility (0 disables)
uniform float uTime;
uniform float uAspect;
float sh(vec2 p){
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float sn(vec2 p){
  vec2 ip = floor(p);
  vec2 fp = p - ip;
  vec2 u = fp*fp*(3.0-2.0*fp);
  return mix(
    mix(sh(ip), sh(ip + vec2(1.0, 0.0)), u.x),
    mix(sh(ip + vec2(0.0, 1.0)), sh(ip + vec2(1.0, 1.0)), u.x),
    u.y);
}
void main(){
  vec2 d = vUV - uCenter;
  d.x *= uAspect;
  float fall = smoothstep(${f6(SHIMMER_RADIUS_UV)}, 0.0, length(d));
  float k = uIntensity * fall;
  // no branch around the sample: implicit-derivative texture reads must stay
  // in uniform control flow (a hard WGSL validation error, and undefined
  // behaviour in GLSL) — k = 0 zeroes the offset, which IS the pass-through
  vec2 off = (vec2(
    sn(vUV*vec2(26.0, 15.0) + vec2(0.0, -uTime*3.1)),
    sn(vUV*vec2(21.0, 17.0) + vec2(4.7, -uTime*2.4))) - 0.5)
    * ${f6(SHIMMER_STRENGTH)} * k;
  gl_FragColor = texture2D(textureSampler, vUV + off);
}`;

export const SHIMMER_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
var textureSampler : texture_2d<f32>;
var textureSamplerSampler : sampler;
uniform uCenter : vec2<f32>;
uniform uIntensity : f32;
uniform uTime : f32;
uniform uAspect : f32;

fn sh(p : vec2<f32>) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7))) * 43758.5453);
}
fn sn(p : vec2<f32>) -> f32 {
  let ip : vec2<f32> = floor(p);
  let fp : vec2<f32> = p - ip;
  let u : vec2<f32> = fp*fp*(3.0-2.0*fp);
  return mix(
    mix(sh(ip), sh(ip + vec2<f32>(1.0, 0.0)), u.x),
    mix(sh(ip + vec2<f32>(0.0, 1.0)), sh(ip + vec2<f32>(1.0, 1.0)), u.x),
    u.y);
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  var d : vec2<f32> = fragmentInputs.vUV - uniforms.uCenter;
  d.x = d.x * uniforms.uAspect;
  let fall : f32 = smoothstep(${f6(SHIMMER_RADIUS_UV)}, 0.0, length(d));
  let k : f32 = uniforms.uIntensity * fall;
  // no branch around textureSample — WGSL requires uniform control flow for
  // implicit-derivative sampling (caught as a GPUValidationError on real
  // hardware, TR-047); k = 0 zeroes the offset, which IS the pass-through
  let off : vec2<f32> = (vec2<f32>(
    sn(fragmentInputs.vUV*vec2<f32>(26.0, 15.0) + vec2<f32>(0.0, -uniforms.uTime*3.1)),
    sn(fragmentInputs.vUV*vec2<f32>(21.0, 17.0) + vec2<f32>(4.7, -uniforms.uTime*2.4))) - vec2<f32>(0.5))
    * ${f6(SHIMMER_STRENGTH)} * k;
  fragmentOutputs.color = textureSample(textureSampler, textureSamplerSampler, fragmentInputs.vUV + off);
}`;
