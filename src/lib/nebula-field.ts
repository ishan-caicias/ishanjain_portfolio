/* nebula-field.ts — PF-09 B3: volumetric/raymarched nebulae.
 *
 * NOT a port — the live engine's nebulae (space-engine.js, celestial type 2)
 * are 2D billboard sprites: lobed gaussians in a point-sprite fragment shader.
 * There is no volumetric, raymarched, or even 3D-positioned gas anywhere in
 * the live engine, and the Babylon path had no nebula visual at all before
 * this module (grep "nebula" — only ship-dynamics.ts comments). Same
 * new-work-with-named-reference framing TR-044 used for shooting stars.
 *
 * ARCHITECTURE (ADR-0004). One half-resolution offscreen texture holds the
 * raymarched nebulae each frame; a fullscreen triangle composites it
 * additively over the scene. The PRODUCER of that texture is tier-gated:
 *
 *   WebGPU  — a WGSL compute shader (Babylon ComputeShader) raymarches into a
 *             storage texture, STEPS_COMPUTE steps. The B3 "gaseous look"
 *             showcase path.
 *   WebGL2  — the same raymarch as a GLSL fragment shader in a Babylon
 *             ProceduralTexture (WebGL2 has no compute API), STEPS_FRAGMENT
 *             steps. The "fallback tier still coherent" half of B3's exit
 *             criterion.
 *
 * SINGLE SOURCE OF TRUTH. Volumes anchor at REAL catalog nebulae — the same
 * (ra, dec, ly) → bodyWorldPosition placement travelTo() uses — so traveling
 * to m42 flies the camera into the Orion Nebula's actual volume. Volume
 * constants and march tuning are BAKED into both generated shader sources by
 * the generator functions below (no per-volume uniforms, no UBO array layout
 * to get wrong); the same numbers drive the JS mirrors the unit tests pin.
 *
 * TR-045 GUARD. WGSL reserves identifiers (`meta`, `ref` blanked the whole
 * scene once) and validates asynchronously, so generated sources are checked
 * by unit test against a reserved-word list, and the real-hardware E2E spec
 * asserts a clean console. Identifiers here avoid the reserved list entirely.
 */
import { bodyWorldPosition } from "./ship-dynamics";
import type { Quat } from "./ship-dynamics";

export interface NebulaVolume {
  /** Catalog id — the same body travelTo() targets. */
  id: string;
  center: [number, number, number];
  radius: number;
  /** Dense-core emission colour (linear-ish 0..1 rgb). */
  colA: [number, number, number];
  /** Thin-edge emission colour. */
  colB: [number, number, number];
  seed: number;
}

/** Volume radius as a fraction of the body's log-scaled world depth — keeps
 * every nebula's apparent angular size from home roughly constant (~16°)
 * regardless of its physical distance, matching how the catalog's log-depth
 * placement already compresses distance. */
export const NEBULA_RADIUS_FACTOR = 0.14;

/** Offscreen nebula texture resolution as a fraction of the render target —
 * half-res: raymarching is bandwidth/ALU-bound and the result is soft gas,
 * so half-res upsampled bilinearly is visually indistinguishable at ~4x less
 * work. */
export const NEBULA_TEX_SCALE = 0.5;

/** Raymarch tuning — every constant here is baked into BOTH generated shader
 * sources and used by the JS mirrors, so there is exactly one place to tune. */
export const NEBULA_MARCH = {
  /** Steps per volume segment on the WebGPU compute tier. */
  stepsCompute: 40,
  /** Steps per volume segment on the WebGL2 fragment fallback tier. */
  stepsFragment: 18,
  /** fbm cycles across one volume radius. */
  noiseFreq: 2.6,
  /** Density threshold at the volume centre (higher = wispier). */
  thresholdBase: 0.32,
  /** Extra threshold toward the rim (quadratic in q = dist/radius) — makes
   * edges ragged rather than a hard sphere silhouette. */
  thresholdEdge: 0.3,
  /** q at which the radial shell falloff starts (1.0 = the rim). */
  shellInner: 0.55,
  /** Density multiplier after thresholding. */
  densityGain: 1.9,
  /** Beer-Lambert extinction per (density × step/radius). */
  extinction: 5.0,
  /** Emission brightness multiplier. */
  brightness: 1.15,
  /** Core/edge colour mix sharpness (colA at density ≥ 1/colorSharp). */
  colorSharp: 3.0,
  /** Early-out when transmittance drops below this. */
  transmittanceFloor: 0.02,
  /** Very slow domain drift (noise-space units/sec) — frozen under
   * prefers-reduced-motion (uTime pinned to 0). */
  driftRate: 0.006,
} as const;

/** Destination-gated reveal envelope (owner direction, 2026-07-19 — see
 * ADR-0004 amendment). Nebulae are NOT ambient sky features: a volume is
 * invisible until it is the active travel destination, fades in during the
 * DECELERATION burn, and swells to full strength once the ship stops. The
 * per-volume factor rides in one vec4 uniform (uReveal — component index =
 * volume order in NEBULA_VOLUMES, baked as a swizzle literal per call), so
 * the ADR-0004 no-uniform-arrays rule holds. */
export const NEBULA_REVEAL = {
  /** Warp fraction where the reveal starts — the HUD's own decel threshold
   * (babylon-engine.ts `wphase`: k < 0.47 accel, < 0.53 flip, then decel). */
  decelStart: 0.53,
  /** Reveal level at the instant of arrival (the swell continues from here). */
  decelMax: 0.7,
  /** Seconds for the post-arrival swell from decelMax to 1. */
  arriveSwellS: 1.8,
  /** Exp-decay rate (1/s) for fading a volume out when it stops being the
   * destination (goHome / travel elsewhere). */
  fadeOutLambda: 2.2,
} as const;

/** Deterministic reveal target for one volume given the travel state:
 * `warpK` = warp progress toward THIS volume (null if not warping to it),
 * `sinceArriveS` = seconds since the ship stopped AT this volume (null if
 * not arrived here). Both null → 0 (the engine damps toward it with
 * fadeOutLambda rather than snapping). */
export function nebulaRevealTarget(
  warpK: number | null,
  sinceArriveS: number | null,
): number {
  const t = NEBULA_REVEAL;
  if (sinceArriveS != null) {
    const k = Math.min(1, Math.max(0, sinceArriveS / t.arriveSwellS));
    const ease = 1 - Math.pow(1 - k, 3); // ease-out cubic settle
    return t.decelMax + (1 - t.decelMax) * ease;
  }
  if (warpK != null) {
    if (warpK <= t.decelStart) return 0;
    const k = (warpK - t.decelStart) / (1 - t.decelStart);
    return t.decelMax * smooth01(Math.min(1, Math.max(0, k)));
  }
  return 0;
}

/** Frame-rate-independent exponential damp toward a target (same construction
 * as ship-dynamics' quatDamp, scalar form). */
export function expDamp(
  current: number,
  target: number,
  lambda: number,
  dtS: number,
): number {
  return target + (current - target) * Math.exp(-lambda * dtS);
}

/** The showcase volumes: four real catalog nebulae with distinct colours and
 * good sky spread (Orion, Aquarius, Cygnus, Monoceros). ra/dec/ly duplicate
 * the catalog entries (celestial-catalog.js / celestial-extra.js) — asserted
 * against bodyWorldPosition in unit tests so placement can't drift from
 * where travelTo() actually goes. */
const NEBULA_SOURCES: {
  id: string;
  ra: number;
  dec: number;
  ly: number;
  colA: [number, number, number];
  colB: [number, number, number];
  seed: number;
}[] = [
  // Orion Nebula — H II star nursery: warm pink core, blue reflection dust.
  {
    id: "m42",
    ra: 83.822,
    dec: -5.391,
    ly: 1344,
    colA: [0.96, 0.56, 0.69],
    colB: [0.36, 0.45, 0.85],
    seed: 3.1,
  },
  // Helix Nebula — planetary: teal O III core, deep blue rim.
  {
    id: "ngc7293",
    ra: 337.411,
    dec: -20.837,
    ly: 655,
    colA: [0.5, 0.87, 0.92],
    colB: [0.25, 0.4, 0.8],
    seed: 7.7,
  },
  // Veil Nebula — supernova remnant: cyan O III filaments, red H-alpha fringe.
  {
    id: "veil",
    ra: 311.75,
    dec: 30.71,
    ly: 2400,
    colA: [0.55, 0.85, 0.95],
    colB: [0.9, 0.4, 0.5],
    seed: 12.9,
  },
  // Rosette Nebula — emission rose: red H-alpha core, crimson rim.
  {
    id: "rosette",
    ra: 97.98,
    dec: 4.94,
    ly: 5200,
    colA: [0.95, 0.42, 0.5],
    colB: [0.6, 0.25, 0.45],
    seed: 21.3,
  },
];

export const NEBULA_VOLUMES: NebulaVolume[] = NEBULA_SOURCES.map((s) => {
  const { pos, depth } = bodyWorldPosition(s.ra, s.dec, s.ly);
  return {
    id: s.id,
    center: pos,
    radius: depth * NEBULA_RADIUS_FACTOR,
    colA: s.colA,
    colB: s.colB,
    seed: s.seed,
  };
});

/* ---------- JS mirrors of the shader arithmetic --------------------------
 *
 * Same convention as shooting-stars.ts / star-field.ts: the GLSL and WGSL
 * twins are a contract with no compiler to check them against each other, so
 * the shared arithmetic is mirrored here and pinned by unit tests. Mirrors
 * use double precision where the GPU uses float32 — tests assert structure
 * (ranges, monotonicity, falloff), not bit-exact GPU equality. */

/** Rotate a vector by a unit quaternion: v' = v + 2*qw*(qxyz × v) + 2*(qxyz × (qxyz × v)).
 * Used by the engine to turn the camera quaternion into the ray-basis
 * uniforms (right/up/forward) the raymarch consumes. */
export function quatRotate(
  q: Quat,
  v: [number, number, number],
): [number, number, number] {
  const [qx, qy, qz, qw] = q;
  const tx = 2 * (qy * v[2] - qz * v[1]);
  const ty = 2 * (qz * v[0] - qx * v[2]);
  const tz = 2 * (qx * v[1] - qy * v[0]);
  return [
    v[0] + qw * tx + (qy * tz - qz * ty),
    v[1] + qw * ty + (qz * tx - qx * tz),
    v[2] + qw * tz + (qx * ty - qy * tx),
  ];
}

/** Lattice hash in [0, 1) — fract(sin(dot(p, k) + seed*17)*43758.5453),
 * the same construction both shader twins use. */
export function hash3(x: number, y: number, z: number, seed: number): number {
  const d = x * 127.1 + y * 311.7 + z * 74.7 + seed * 17.0;
  const s = Math.sin(d) * 43758.5453;
  return s - Math.floor(s);
}

const smooth01 = (t: number) => t * t * (3 - 2 * t);

/** Trilinear value noise in [0, 1]. */
export function valueNoise3(
  x: number,
  y: number,
  z: number,
  seed: number,
): number {
  const ix = Math.floor(x),
    iy = Math.floor(y),
    iz = Math.floor(z);
  const fx = smooth01(x - ix),
    fy = smooth01(y - iy),
    fz = smooth01(z - iz);
  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
  const c = (dx: number, dy: number, dz: number) =>
    hash3(ix + dx, iy + dy, iz + dz, seed);
  return lerp(
    lerp(
      lerp(c(0, 0, 0), c(1, 0, 0), fx),
      lerp(c(0, 1, 0), c(1, 1, 0), fx),
      fy,
    ),
    lerp(
      lerp(c(0, 0, 1), c(1, 0, 1), fx),
      lerp(c(0, 1, 1), c(1, 1, 1), fx),
      fy,
    ),
    fz,
  );
}

/** 4-octave fbm in [0, ~0.94]. Lacunarity 2.02 (not exactly 2 — avoids
 * lattice-aligned octaves reinforcing into visible grid artefacts). */
export function fbm3(x: number, y: number, z: number, seed: number): number {
  let amp = 0.5;
  let sum = 0;
  let px = x,
    py = y,
    pz = z;
  for (let o = 0; o < 4; o++) {
    sum += amp * valueNoise3(px, py, pz, seed);
    px *= 2.02;
    py *= 2.02;
    pz *= 2.02;
    amp *= 0.5;
  }
  return sum;
}

/** Ray/sphere intersection. Returns null on a miss, else [t0, t1] (t0 may be
 * negative when the origin is inside the sphere). `rd` must be unit length. */
export function raySphere(
  ro: [number, number, number],
  rd: [number, number, number],
  c: [number, number, number],
  r: number,
): [number, number] | null {
  const ox = ro[0] - c[0],
    oy = ro[1] - c[1],
    oz = ro[2] - c[2];
  const b = ox * rd[0] + oy * rd[1] + oz * rd[2];
  const cc = ox * ox + oy * oy + oz * oz - r * r;
  const disc = b * b - cc;
  if (disc < 0) return null;
  const s = Math.sqrt(disc);
  return [-b - s, -b + s];
}

/** Gas density at a world point: radial shell falloff × thresholded fbm.
 * Zero at/beyond the rim by construction. `timeS` drives the slow domain
 * drift (pass 0 for the reduced-motion/static result). */
export function nebulaDensity(
  p: [number, number, number],
  vol: NebulaVolume,
  timeS: number,
): number {
  const t = NEBULA_MARCH;
  const rx = p[0] - vol.center[0],
    ry = p[1] - vol.center[1],
    rz = p[2] - vol.center[2];
  const q = Math.hypot(rx, ry, rz) / vol.radius;
  if (q >= 1) return 0;
  // 1 - smoothstep(shellInner, 1, q): both twins use this exact portable
  // form (smoothstep with descending edges is undefined in GLSL).
  const st = Math.min(1, Math.max(0, (q - t.shellInner) / (1 - t.shellInner)));
  const shell = 1 - smooth01(st);
  const f = t.noiseFreq / vol.radius;
  const drift = timeS * t.driftRate;
  const n = fbm3(
    rx * f + drift,
    ry * f + drift * 0.7,
    rz * f - drift * 0.5,
    vol.seed,
  );
  const thr = t.thresholdBase + t.thresholdEdge * q * q;
  return Math.max(0, n - thr) * shell * t.densityGain;
}

/** Front-to-back emission/absorption march through one volume. Returns
 * [r, g, b, coverage] where coverage = 1 - transmittance. The composite pass
 * adds rgb to the frame; coverage is diagnostic. */
export function marchNebula(
  ro: [number, number, number],
  rd: [number, number, number],
  vol: NebulaVolume,
  timeS: number,
  steps: number,
  reveal = 1,
): [number, number, number, number] {
  const t = NEBULA_MARCH;
  // destination-gated reveal: density scales with reveal, so low reveal both
  // dims the gas AND shrinks its apparent extent (thin fringes drop below
  // visibility first) — reads as the cloud growing in, not a crossfade
  if (reveal <= 0.004) return [0, 0, 0, 0];
  const hit = raySphere(ro, rd, vol.center, vol.radius);
  if (!hit) return [0, 0, 0, 0];
  const tA = Math.max(hit[0], 0);
  if (hit[1] <= tA) return [0, 0, 0, 0];
  const dt = (hit[1] - tA) / steps;
  const dtN = dt / vol.radius;
  let trans = 1;
  let r = 0,
    g = 0,
    b = 0;
  for (let i = 0; i < steps; i++) {
    const tt = tA + (i + 0.5) * dt;
    const p: [number, number, number] = [
      ro[0] + rd[0] * tt,
      ro[1] + rd[1] * tt,
      ro[2] + rd[2] * tt,
    ];
    const d = nebulaDensity(p, vol, timeS) * reveal;
    if (d <= 0) continue;
    const a = 1 - Math.exp(-d * dtN * t.extinction);
    const mixK = Math.min(1, d * t.colorSharp);
    const w = trans * a * t.brightness;
    r += w * (vol.colB[0] + (vol.colA[0] - vol.colB[0]) * mixK);
    g += w * (vol.colB[1] + (vol.colA[1] - vol.colB[1]) * mixK);
    b += w * (vol.colB[2] + (vol.colA[2] - vol.colB[2]) * mixK);
    trans *= 1 - a;
    if (trans < t.transmittanceFloor) break;
  }
  return [r, g, b, 1 - trans];
}

/* ---------- shader source generators -------------------------------------
 *
 * Volume constants and tuning are baked as literals — no uniform arrays, no
 * UBO layout for per-volume data, and the unrolled per-volume calls mean each
 * texel only marches segments of spheres its ray actually hits. Generated
 * sources are unit-tested for structure and for WGSL reserved identifiers. */

const f6 = (n: number) => n.toFixed(6);

function glslShared(steps: number): string {
  const t = NEBULA_MARCH;
  return `
float nebHash(vec3 p, float hseed){
  return fract(sin(dot(p, vec3(127.1, 311.7, 74.7)) + hseed*17.0)*43758.5453);
}
float nebNoise(vec3 p, float hseed){
  vec3 ip = floor(p);
  vec3 fp = p - ip;
  vec3 u = fp*fp*(3.0-2.0*fp);
  float n000 = nebHash(ip + vec3(0.0,0.0,0.0), hseed);
  float n100 = nebHash(ip + vec3(1.0,0.0,0.0), hseed);
  float n010 = nebHash(ip + vec3(0.0,1.0,0.0), hseed);
  float n110 = nebHash(ip + vec3(1.0,1.0,0.0), hseed);
  float n001 = nebHash(ip + vec3(0.0,0.0,1.0), hseed);
  float n101 = nebHash(ip + vec3(1.0,0.0,1.0), hseed);
  float n011 = nebHash(ip + vec3(0.0,1.0,1.0), hseed);
  float n111 = nebHash(ip + vec3(1.0,1.0,1.0), hseed);
  return mix(
    mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
    mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y),
    u.z);
}
float nebFbm(vec3 p, float hseed){
  float amp = 0.5;
  float sum = 0.0;
  for (int o = 0; o < 4; o++){
    sum += amp * nebNoise(p, hseed);
    p *= 2.02;
    amp *= 0.5;
  }
  return sum;
}
float nebDensity(vec3 p, vec3 c, float r, float dseed, float timeS){
  vec3 rel = p - c;
  float q = length(rel) / r;
  if (q >= 1.0) return 0.0;
  float shell = 1.0 - smoothstep(${f6(t.shellInner)}, 1.0, q);
  float drift = timeS * ${f6(t.driftRate)};
  vec3 np = rel * (${f6(t.noiseFreq)} / r) + vec3(drift, drift*0.7, -drift*0.5);
  float n = nebFbm(np, dseed);
  float thr = ${f6(t.thresholdBase)} + ${f6(t.thresholdEdge)}*q*q;
  return max(0.0, n - thr) * shell * ${f6(t.densityGain)};
}
vec4 nebMarch(vec3 ro, vec3 rd, vec3 c, float r, vec3 colA, vec3 colB, float mseed, float timeS, float rev){
  if (rev <= 0.004) return vec4(0.0);
  vec3 oc = ro - c;
  float b = dot(oc, rd);
  float cc = dot(oc, oc) - r*r;
  float disc = b*b - cc;
  if (disc < 0.0) return vec4(0.0);
  float s = sqrt(disc);
  float tA = max(-b - s, 0.0);
  float tB = -b + s;
  if (tB <= tA) return vec4(0.0);
  float dt = (tB - tA) / ${f6(steps)};
  float dtN = dt / r;
  float trans = 1.0;
  vec3 col = vec3(0.0);
  for (int i = 0; i < ${steps}; i++){
    float tt = tA + (float(i) + 0.5) * dt;
    float d = nebDensity(ro + rd*tt, c, r, mseed, timeS) * rev;
    if (d <= 0.0) continue;
    float a = 1.0 - exp(-d * dtN * ${f6(t.extinction)});
    float mixK = min(1.0, d * ${f6(t.colorSharp)});
    col += trans * a * ${f6(t.brightness)} * mix(colB, colA, mixK);
    trans *= 1.0 - a;
    if (trans < ${f6(t.transmittanceFloor)}) break;
  }
  return vec4(col, 1.0 - trans);
}`;
}

/** uReveal component per volume, by NEBULA_VOLUMES order. One vec4 carries
 * all four per-volume reveal factors — the swizzle is baked per call, so the
 * ADR-0004 no-uniform-arrays rule holds. */
const REVEAL_SWIZZLE = ["x", "y", "z", "w"] as const;

function revealComponent(i: number): string {
  const c = REVEAL_SWIZZLE[i];
  if (!c) throw new Error("uReveal carries at most 4 volumes");
  return c;
}

function glslVolumeCalls(volumes: NebulaVolume[]): string {
  return volumes
    .map(
      (v, i) => `  {
    vec4 nv = nebMarch(uCamPos, rd,
      vec3(${f6(v.center[0])}, ${f6(v.center[1])}, ${f6(v.center[2])}),
      ${f6(v.radius)},
      vec3(${f6(v.colA[0])}, ${f6(v.colA[1])}, ${f6(v.colA[2])}),
      vec3(${f6(v.colB[0])}, ${f6(v.colB[1])}, ${f6(v.colB[2])}),
      ${f6(v.seed)}, uTime, uReveal.${revealComponent(i)});
    col += nv.rgb;
    cover = max(cover, nv.a);
  }`,
    )
    .join("\n");
}

/** GLSL fragment source for the WebGL2 fallback producer (Babylon
 * ProceduralTexture supplies the fullscreen pass and the `vUV` varying).
 * GL pair convention: no y-flip anywhere — vUV.y and clip-space y agree. */
export function nebulaGlslFragment(
  volumes: NebulaVolume[] = NEBULA_VOLUMES,
  steps: number = NEBULA_MARCH.stepsFragment,
): string {
  return `precision highp float;
varying vec2 vUV;
uniform vec3 uCamPos;
uniform vec3 uCamRight;
uniform vec3 uCamUp;
uniform vec3 uCamFwd;
uniform float uTanFov;
uniform float uAspect;
uniform float uTime;
uniform vec4 uReveal;
${glslShared(steps)}
void main(){
  vec2 ndc = vUV * 2.0 - 1.0;
  vec3 rd = normalize(uCamFwd
    + uCamRight * (ndc.x * uTanFov * uAspect)
    + uCamUp * (ndc.y * uTanFov));
  vec3 col = vec3(0.0);
  float cover = 0.0;
${glslVolumeCalls(volumes)}
  gl_FragColor = vec4(col, cover);
}`;
}

function wgslShared(steps: number): string {
  const t = NEBULA_MARCH;
  return `
fn nebHash(p : vec3<f32>, hseed : f32) -> f32 {
  return fract(sin(dot(p, vec3<f32>(127.1, 311.7, 74.7)) + hseed*17.0)*43758.5453);
}
fn nebNoise(p : vec3<f32>, hseed : f32) -> f32 {
  let ip : vec3<f32> = floor(p);
  let fp : vec3<f32> = p - ip;
  let u : vec3<f32> = fp*fp*(3.0-2.0*fp);
  let n000 : f32 = nebHash(ip + vec3<f32>(0.0,0.0,0.0), hseed);
  let n100 : f32 = nebHash(ip + vec3<f32>(1.0,0.0,0.0), hseed);
  let n010 : f32 = nebHash(ip + vec3<f32>(0.0,1.0,0.0), hseed);
  let n110 : f32 = nebHash(ip + vec3<f32>(1.0,1.0,0.0), hseed);
  let n001 : f32 = nebHash(ip + vec3<f32>(0.0,0.0,1.0), hseed);
  let n101 : f32 = nebHash(ip + vec3<f32>(1.0,0.0,1.0), hseed);
  let n011 : f32 = nebHash(ip + vec3<f32>(0.0,1.0,1.0), hseed);
  let n111 : f32 = nebHash(ip + vec3<f32>(1.0,1.0,1.0), hseed);
  return mix(
    mix(mix(n000,n100,u.x), mix(n010,n110,u.x), u.y),
    mix(mix(n001,n101,u.x), mix(n011,n111,u.x), u.y),
    u.z);
}
fn nebFbm(p0 : vec3<f32>, hseed : f32) -> f32 {
  var amp : f32 = 0.5;
  var sum : f32 = 0.0;
  var p : vec3<f32> = p0;
  for (var o : i32 = 0; o < 4; o = o + 1){
    sum = sum + amp * nebNoise(p, hseed);
    p = p * 2.02;
    amp = amp * 0.5;
  }
  return sum;
}
fn nebDensity(p : vec3<f32>, c : vec3<f32>, r : f32, dseed : f32, timeS : f32) -> f32 {
  let rel : vec3<f32> = p - c;
  let q : f32 = length(rel) / r;
  if (q >= 1.0) { return 0.0; }
  let shell : f32 = 1.0 - smoothstep(${f6(t.shellInner)}, 1.0, q);
  let drift : f32 = timeS * ${f6(t.driftRate)};
  let np : vec3<f32> = rel * (${f6(t.noiseFreq)} / r) + vec3<f32>(drift, drift*0.7, -drift*0.5);
  let n : f32 = nebFbm(np, dseed);
  let thr : f32 = ${f6(t.thresholdBase)} + ${f6(t.thresholdEdge)}*q*q;
  return max(0.0, n - thr) * shell * ${f6(t.densityGain)};
}
fn nebMarch(ro : vec3<f32>, rd : vec3<f32>, c : vec3<f32>, r : f32, colA : vec3<f32>, colB : vec3<f32>, mseed : f32, timeS : f32, rev : f32) -> vec4<f32> {
  if (rev <= 0.004) { return vec4<f32>(0.0); }
  let oc : vec3<f32> = ro - c;
  let b : f32 = dot(oc, rd);
  let cc : f32 = dot(oc, oc) - r*r;
  let disc : f32 = b*b - cc;
  if (disc < 0.0) { return vec4<f32>(0.0); }
  let s : f32 = sqrt(disc);
  let tA : f32 = max(-b - s, 0.0);
  let tB : f32 = -b + s;
  if (tB <= tA) { return vec4<f32>(0.0); }
  let dt : f32 = (tB - tA) / ${f6(steps)};
  let dtN : f32 = dt / r;
  var trans : f32 = 1.0;
  var col : vec3<f32> = vec3<f32>(0.0);
  for (var i : i32 = 0; i < ${steps}; i = i + 1){
    let tt : f32 = tA + (f32(i) + 0.5) * dt;
    let d : f32 = nebDensity(ro + rd*tt, c, r, mseed, timeS) * rev;
    if (d > 0.0) {
      let a : f32 = 1.0 - exp(-d * dtN * ${f6(t.extinction)});
      let mixK : f32 = min(1.0, d * ${f6(t.colorSharp)});
      col = col + trans * a * ${f6(t.brightness)} * mix(colB, colA, mixK);
      trans = trans * (1.0 - a);
      if (trans < ${f6(t.transmittanceFloor)}) { break; }
    }
  }
  return vec4<f32>(col, 1.0 - trans);
}`;
}

function wgslVolumeCalls(volumes: NebulaVolume[]): string {
  return volumes
    .map(
      (v, i) => `  {
    let nv : vec4<f32> = nebMarch(params.camPos, rd,
      vec3<f32>(${f6(v.center[0])}, ${f6(v.center[1])}, ${f6(v.center[2])}),
      ${f6(v.radius)},
      vec3<f32>(${f6(v.colA[0])}, ${f6(v.colA[1])}, ${f6(v.colA[2])}),
      vec3<f32>(${f6(v.colB[0])}, ${f6(v.colB[1])}, ${f6(v.colB[2])}),
      ${f6(v.seed)}, params.uTime, params.uReveal.${revealComponent(i)});
    col = col + nv.rgb;
    cover = max(cover, nv.w);
  }`,
    )
    .join("\n");
}

/** WGSL compute source for the WebGPU producer. The Params struct layout must
 * match the UniformBuffer built in babylon-engine.ts field-for-field (vec3 +
 * f32 pairs pack into single 16-byte std140 slots on both sides).
 * WebGPU pair convention: texel row 0 is the TOP, so ndc.y flips here and the
 * composite WGSL twin flips its sample V to match. */
export function nebulaWgslCompute(
  volumes: NebulaVolume[] = NEBULA_VOLUMES,
  steps: number = NEBULA_MARCH.stepsCompute,
): string {
  return `struct Params {
  camPos : vec3<f32>,
  uTanFov : f32,
  camRight : vec3<f32>,
  uAspect : f32,
  camUp : vec3<f32>,
  uTime : f32,
  camFwd : vec3<f32>,
  pad0 : f32,
  uReveal : vec4<f32>,
};
@group(0) @binding(0) var<uniform> params : Params;
@group(0) @binding(1) var outTex : texture_storage_2d<rgba8unorm, write>;
${wgslShared(steps)}
@compute @workgroup_size(8, 8, 1)
fn main(@builtin(global_invocation_id) gid : vec3<u32>) {
  let dims : vec2<u32> = textureDimensions(outTex);
  if (gid.x >= dims.x || gid.y >= dims.y) { return; }
  let uv : vec2<f32> = (vec2<f32>(f32(gid.x), f32(gid.y)) + 0.5) / vec2<f32>(f32(dims.x), f32(dims.y));
  let ndc : vec2<f32> = vec2<f32>(uv.x * 2.0 - 1.0, 1.0 - uv.y * 2.0);
  let rd : vec3<f32> = normalize(params.camFwd
    + params.camRight * (ndc.x * params.uTanFov * params.uAspect)
    + params.camUp * (ndc.y * params.uTanFov));
  var col : vec3<f32> = vec3<f32>(0.0);
  var cover : f32 = 0.0;
${wgslVolumeCalls(volumes)}
  textureStore(outTex, vec2<i32>(i32(gid.x), i32(gid.y)), vec4<f32>(clamp(col, vec3<f32>(0.0), vec3<f32>(1.0)), cover));
}`;
}

/** Identifiers reserved by the WGSL spec that have actually bitten this
 * codebase (TR-045: `meta`, `ref`) plus near-miss candidates a generated
 * source could plausibly introduce. Exported so the unit test and any future
 * generator share one list. */
export const WGSL_RESERVED_IDENTIFIERS = [
  "meta",
  "ref",
  "filter",
  "common",
  "handle",
  "auto",
  "typedef",
  "union",
] as const;
