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
  PLUME_ENGINES,
  PLUME_SHEATH,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
  type Ember,
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

/* ---------- GAP-07: ember sparks ------------------------------------------
 *
 * Ported from space-engine.js's F3 ember burst (space-engine.js:2690-2764):
 * a burst of point sprites on burn start/stop, drifting back off the
 * nozzles and fading, capped at 48 concurrently live. That original renders
 * embers in the ship's own LOCAL/model space (re-transformed by whatever the
 * ship's CURRENT world matrix is every frame, since the draw call uses the
 * frame's own mvp) — a cheap simplification that works because embers barely
 * outlive a fraction of a second of ship motion. This port instead resolves
 * each ember's spawn position/velocity into WORLD space once, at spawn time
 * (babylon-engine.ts's `_tickShip`, using the ship's quaternion/scale at that
 * instant), then steps it in true world space thereafter via
 * `ship-dynamics.ts`'s `stepEmber` — physically cleaner (sparks a moving
 * craft actually left behind, rather than being dragged along with it) and
 * avoids needing a parented-mesh billboard technique. Point sprites don't
 * exist on WebGPU (CLAUDE.md #7), so embers are billboard quads sized in
 * clip space exactly like the star/body billboards. */
export const EMBER_BURST_START = 14;
export const EMBER_BURST_STOP = 8;
/** Concurrent live-ember cap — matches space-engine.js's `this._embers.length < 48`. */
export const MAX_EMBERS = 48;

/** Local (unit-ship, nose −Z) spawn jitter + drift-back velocity for one
 * ember at a randomly chosen engine nozzle — matches space-engine.js's F3
 * spawn block exactly (`(Math.random()-0.5)*0.05` jitter, `0.9 + rand*1.4`
 * backward drift). Returned in UNIT-SHIP space; the caller (which already
 * has the wrapper's nose-flip convention — see this file's header) applies
 * the same Z negation `plumeBuffersForWrapper` does before rotating into
 * world space. Takes no RNG dependency beyond `Math.random()`, matching
 * every other spark/jitter site in this codebase (e.g. plume turbulence). */
export function spawnEmberLocal(): {
  pos: [number, number, number];
  vel: [number, number, number];
} {
  const eng = PLUME_ENGINES[(Math.random() * PLUME_ENGINES.length) | 0];
  return {
    pos: [
      eng[0] + (Math.random() - 0.5) * 0.05,
      eng[1] + (Math.random() - 0.5) * 0.05,
      eng[2] + 0.05,
    ],
    vel: [
      (Math.random() - 0.5) * 0.7,
      (Math.random() - 0.5) * 0.7,
      0.9 + Math.random() * 1.4,
    ],
  };
}

/** Billboard-quad vertex/meta buffers for the current live-ember set, world
 * space (already stepped). Continuous alpha/size-by-life rather than the
 * archived engine's 3 discrete draw-call buckets (alpha 0.85/0.5/0.25, size
 * 7/5/3px) — that bucketing existed to batch legacy's per-bucket `gl.POINTS`
 * draw calls, not as a deliberate visual step; one merged billboard mesh has
 * no such constraint, so a continuous fade is the more faithful reading of
 * "fades instead of popping," not a scope cut. `life` is normalised 0..1 by
 * the caller (raw life / spawn life varies per ember). Reuses caller-owned
 * scratch arrays — runs every frame. */
export function emberBillboards(
  embers: readonly Ember[],
  outPositions: Float32Array,
  outMeta: Float32Array,
): number {
  const n = Math.min(embers.length, MAX_EMBERS);
  for (let i = 0; i < n; i++) {
    const e = embers[i];
    const lifeNorm = Math.max(0, Math.min(1, e.life));
    const alpha = 0.2 + 0.65 * lifeNorm;
    const size = (2.5 + 5 * lifeNorm) * (window.devicePixelRatio || 1);
    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      outPositions[v * 3] = e.x;
      outPositions[v * 3 + 1] = e.y;
      outPositions[v * 3 + 2] = e.z;
      outMeta[v * 2] = alpha;
      outMeta[v * 2 + 1] = size;
    }
  }
  // unused capacity: alpha 0 so the fragment shader's discard/blend drops it
  for (let i = n; i < MAX_EMBERS; i++) {
    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      outPositions[v * 3] = 0;
      outPositions[v * 3 + 1] = 0;
      outPositions[v * 3 + 2] = 0;
      outMeta[v * 2] = 0;
      outMeta[v * 2 + 1] = 0;
    }
  }
  return n;
}

/** Sequential quad indices for the fixed-capacity ember mesh (6 per
 * particle — two triangles), always MAX_EMBERS worth regardless of how many
 * are currently alive (unused slots are zero-alpha, not zero-index). */
export function emberIndices(): Uint32Array {
  const idx = new Uint32Array(MAX_EMBERS * 6);
  for (let i = 0; i < MAX_EMBERS; i++) {
    const v0 = i * 4;
    const o = i * 6;
    idx[o] = v0;
    idx[o + 1] = v0 + 1;
    idx[o + 2] = v0 + 2;
    idx[o + 3] = v0;
    idx[o + 4] = v0 + 2;
    idx[o + 5] = v0 + 3;
  }
  return idx;
}

export const EMBER_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;   // ember world position (already stepped in JS)
attribute vec2 emberMeta;  // x = alpha, y = size (device px)
uniform mat4 view;
uniform mat4 projection;
uniform vec2 uViewport;
varying vec2 vCorner;
varying float vAlpha;
void main(){
  int c = gl_VertexID % 4;
  vec2 corner = vec2((c == 1 || c == 2) ? 1.0 : -1.0, (c >= 2) ? 1.0 : -1.0);
  vec4 centre = view * vec4(position, 1.0);
  vec4 clip = projection * centre;
  clip.x += corner.x * emberMeta.y * clip.w / max(uViewport.x, 1.0);
  clip.y += corner.y * emberMeta.y * clip.w / max(uViewport.y, 1.0);
  gl_Position = clip;
  vCorner = corner;
  vAlpha = emberMeta.x;
}`;

export const EMBER_FRAGMENT_GLSL = `
precision mediump float;
varying vec2 vCorner;
varying float vAlpha;
void main(){
  float d = length(vCorner);
  if (d > 1.0 || vAlpha <= 0.001) discard;
  float a = exp(-d * d * 4.0) * vAlpha;
  vec3 col = mix(vec3(1.0, 0.6, 0.2), vec3(1.0, 0.85, 0.55), exp(-d * d * 3.0));
  gl_FragColor = vec4(col, a);
}`;

export const EMBER_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute emberMeta : vec2<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uViewport : vec2<f32>;
varying vCorner : vec2<f32>;
varying vAlpha : f32;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let corner : vec2<f32> = vec2<f32>(
    select(-1.0, 1.0, c == 1u || c == 2u),
    select(-1.0, 1.0, c >= 2u));
  let centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  var clip : vec4<f32> = uniforms.projection * centre;
  clip = vec4<f32>(
    clip.x + corner.x * vertexInputs.emberMeta.y * clip.w / max(uniforms.uViewport.x, 1.0),
    clip.y + corner.y * vertexInputs.emberMeta.y * clip.w / max(uniforms.uViewport.y, 1.0),
    clip.z, clip.w);
  vertexOutputs.position = clip;
  vertexOutputs.vCorner = corner;
  vertexOutputs.vAlpha = vertexInputs.emberMeta.x;
}`;

export const EMBER_FRAGMENT_WGSL = `
varying vCorner : vec2<f32>;
varying vAlpha : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d : f32 = length(fragmentInputs.vCorner);
  if (d > 1.0 || fragmentInputs.vAlpha <= 0.001) { discard; }
  let a : f32 = exp(-d * d * 4.0) * fragmentInputs.vAlpha;
  let col : vec3<f32> = mix(
    vec3<f32>(1.0, 0.6, 0.2), vec3<f32>(1.0, 0.85, 0.55), exp(-d * d * 3.0));
  fragmentOutputs.color = vec4<f32>(col, a);
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
