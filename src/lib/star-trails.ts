/* star-trails.ts — GAP-05: warp star trails on the Babylon path
 * (docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
 *
 * Ported (not shared — space-engine.js stays frozen) from that engine's
 * trail-buffer build (inside `_buildStars`, every 3rd field star) and
 * `TRAIL_VS`/`TRAIL_FS`. The technique: reuse the SAME star field positions
 * already decoded for the star billboards (star-catalog.ts /
 * loadStarField()) — one line segment per sampled star, both endpoints at
 * that star's fixed position, but the vertex shader offsets each endpoint by
 * a DIFFERENT camera reference (this frame's camera vs. an exponentially-
 * lagged "previous" camera). Because the two endpoints land at different
 * points in camera-relative space, the line reads as a radial streak whose
 * length and visibility track how fast the camera is actually moving — the
 * same trick the archived engine uses, just re-expressed as `camPrev` lag
 * rather than a literal previous-frame sample (space-engine.js already does
 * this too: `camPrev[i] += (cam[i] - camPrev[i]) * lag`, ported verbatim in
 * `warpSpeedAndLag` below).
 *
 * Deliberately NOT ported: relativistic aberration on trails (GAP-06's
 * dependency, same as the star billboards and the Milky Way band).
 */
import type { StarField } from "./star-field";

/** Every 3rd field star gets a trail — matches space-engine.js's `i % 3 === 0`
 * exactly (a full-density trail field would double the star mesh's draw
 * cost for a background embellishment). */
export const TRAIL_STRIDE = 3;

/** Camera-lag EMA factor per frame, matching space-engine.js's `lag = 0.1`
 * (reduced motion uses `lag = 1`, i.e. camPrev snaps to cam — no streak). */
export const TRAIL_CAM_LAG = 0.1;
export const TRAIL_CAM_LAG_REDUCED = 1;

/** Below this camera-delta-per-frame, trails are fully gated off — matches
 * space-engine.js's `warpSpeed > 0.4` draw condition exactly. */
export const TRAIL_WARP_SPEED_THRESHOLD = 0.4;

/** Advances the lagged "previous camera" position one frame and returns the
 * resulting warp speed (camera displacement since last frame, in world
 * units) — matches space-engine.js's per-frame trailing-camera update
 * exactly, in-place on `camPrev` to avoid a per-frame allocation. */
export function advanceTrailCamera(
  cam: readonly [number, number, number],
  camPrev: [number, number, number],
  reduced: boolean,
): number {
  const lag = reduced ? TRAIL_CAM_LAG_REDUCED : TRAIL_CAM_LAG;
  for (let i = 0; i < 3; i++) camPrev[i] += (cam[i] - camPrev[i]) * lag;
  return Math.hypot(
    cam[0] - camPrev[0],
    cam[1] - camPrev[1],
    cam[2] - camPrev[2],
  );
}

/** Trail visibility gate, matching space-engine.js's draw condition
 * (`warpSpeed > 0.4 && !reduced && tier > 0`) in spirit — this path's quality
 * budget (babylon-tiers.ts) uses named tiers, not the archived engine's
 * numeric 0/1/2, so the caller passes whether the CURRENT tier allows trails
 * (i.e. `quality.name !== "lite"`) rather than a tier index. */
export function trailsVisible(
  warpSpeed: number,
  reduced: boolean,
  tierAllowsTrails: boolean,
): boolean {
  return warpSpeed > TRAIL_WARP_SPEED_THRESHOLD && !reduced && tierAllowsTrails;
}

/** Fade multiplier, matching space-engine.js's `uWarp = min(1, warpSpeed*0.06)`. */
export function trailFade(warpSpeed: number): number {
  return Math.min(1, warpSpeed * 0.06);
}

export interface StarTrails {
  /** Two endpoints per line, xyz each, repeated (verts * 3). */
  positions: Float32Array;
  /** [colourT, endFlag] per vertex (verts * 2) — endFlag 0 = "current
   * camera" endpoint, 1 = "lagged camera" endpoint, matching the vertex
   * shader's `aMeta.w > 0.5 ? uCamPrev : uCam` branch. */
  meta: Float32Array;
  vertexCount: number;
  count: number;
}

/** Builds the trail line-list geometry from an already-decoded star field —
 * NOT a fresh catalog decode; the caller passes the same `StarField` the
 * billboards already use, so the two passes can never disagree about which
 * stars exist. */
export function buildStarTrails(
  field: StarField,
  stride: number = TRAIL_STRIDE,
): StarTrails {
  const count = Math.floor(field.count / stride);
  const vertexCount = count * 2;
  const positions = new Float32Array(vertexCount * 3);
  const meta = new Float32Array(vertexCount * 2);
  for (let t = 0; t < count; t++) {
    const i = t * stride;
    const x = field.positions[i * 3];
    const y = field.positions[i * 3 + 1];
    const z = field.positions[i * 3 + 2];
    const colourT = field.meta[i * 2 + 1];
    for (let e = 0; e < 2; e++) {
      const v = t * 2 + e;
      positions[v * 3] = x;
      positions[v * 3 + 1] = y;
      positions[v * 3 + 2] = z;
      meta[v * 2] = colourT;
      meta[v * 2 + 1] = e;
    }
  }
  return { positions, meta, vertexCount, count };
}

/* ---------- shader twins: 2-vertex line per star, endpoint offset by cam or camPrev ---------- */

export const STAR_TRAIL_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;   // star centre (world)
attribute vec2 trailMeta;  // colourT, endFlag
uniform mat4 view;
uniform mat4 projection;
uniform vec3 uCam, uCamPrev;
uniform float uBeta; // GAP-06: position-only aberration, matches TRAIL_VS
uniform vec3 uWarpDir; // (no Doppler — TRAIL_FS never had uBeta)
varying vec3 vColor;
varying float vAlpha;
vec3 ramp(float t){
  vec3 c0=vec3(0.608,0.690,1.000), c2=vec3(0.973,0.969,1.000), c4=vec3(1.000,0.824,0.631), c5=vec3(1.000,0.800,0.435);
  if(t<0.4) return mix(c0,c2,t/0.4);
  if(t<0.8) return mix(c2,c4,(t-0.4)/0.4);
  return mix(c4,c5,(t-0.8)/0.2);
}
vec3 aberrate(vec3 p, vec3 warpDirView){
  if (uBeta < 0.001) return p;
  float dist = length(p); vec3 d = p / dist;
  float c = dot(d, warpDirView);
  float cp = clamp((c + uBeta) / (1.0 + uBeta * c), -1.0, 1.0);
  vec3 perp = d - c * warpDirView; float pl = length(perp);
  float sp = sqrt(max(0.0, 1.0 - cp * cp));
  return (warpDirView * cp + (pl > 1e-5 ? perp * (sp / pl) : vec3(0.0))) * dist;
}
void main(){
  // Babylon's "view" bakes in the CURRENT camera position (unlike the
  // archived engine's rotation-only view matrix, which subtracts a chosen
  // camera manually per-vertex). To get the same "which camera reference"
  // effect here, offset the already-transformed view-space position by the
  // rotated delta between the two camera choices: for a view matrix with no
  // scale/shear, mat3(view) is exactly the world->view rotation, so
  // mat3(view)*(uCam-uCamPrev) is the correct view-space correction —
  // algebraically: view*p + R*(cam-camPrev) == R*(p-camPrev) + T, matching
  // the archived engine's uCamPrev branch exactly. GAP-06's aberrate() then
  // applies to that same camera-relative vector, per endpoint, exactly like
  // TRAIL_VS's aberrate(aPos - cam) (cam already selected per-endpoint by
  // the correction above).
  vec4 viewPos = view * vec4(position, 1.0);
  if (trailMeta.y > 0.5) viewPos.xyz += mat3(view) * (uCam - uCamPrev);
  vec3 warpDirView = mat3(view) * uWarpDir;
  viewPos.xyz = aberrate(viewPos.xyz, warpDirView);
  gl_Position = projection * viewPos;
  vColor = ramp(fract(trailMeta.x));
  vAlpha = 0.20;
}`;

export const STAR_TRAIL_FRAGMENT_GLSL = `
precision mediump float;
varying vec3 vColor;
varying float vAlpha;
uniform float uWarp;
void main(){
  gl_FragColor = vec4(vColor, vAlpha * uWarp);
}`;

export const STAR_TRAIL_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute trailMeta : vec2<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uCam : vec3<f32>;
uniform uCamPrev : vec3<f32>;
uniform uBeta : f32;
uniform uWarpDir : vec3<f32>;
varying vColor : vec3<f32>;
varying vAlpha : f32;

fn ramp(t : f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.608, 0.690, 1.000);
  let c2 = vec3<f32>(0.973, 0.969, 1.000);
  let c4 = vec3<f32>(1.000, 0.824, 0.631);
  let c5 = vec3<f32>(1.000, 0.800, 0.435);
  if (t < 0.4) { return mix(c0, c2, t / 0.4); }
  if (t < 0.8) { return mix(c2, c4, (t - 0.4) / 0.4); }
  return mix(c4, c5, (t - 0.8) / 0.2);
}

fn aberrate(p : vec3<f32>, warpDirView : vec3<f32>) -> vec3<f32> {
  if (uniforms.uBeta < 0.001) { return p; }
  let dist : f32 = length(p);
  let d : vec3<f32> = p / dist;
  let c : f32 = dot(d, warpDirView);
  let cp : f32 = clamp((c + uniforms.uBeta) / (1.0 + uniforms.uBeta * c), -1.0, 1.0);
  let perp : vec3<f32> = d - c * warpDirView;
  let pl : f32 = length(perp);
  let sp : f32 = sqrt(max(0.0, 1.0 - cp * cp));
  let side : vec3<f32> = select(vec3<f32>(0.0, 0.0, 0.0), perp * (sp / pl), pl > 1e-5);
  return (warpDirView * cp + side) * dist;
}

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  var viewPos : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  let rot : mat3x3<f32> = mat3x3<f32>(
    uniforms.view[0].xyz, uniforms.view[1].xyz, uniforms.view[2].xyz);
  if (vertexInputs.trailMeta.y > 0.5) {
    viewPos = vec4<f32>(viewPos.xyz + rot * (uniforms.uCam - uniforms.uCamPrev), viewPos.w);
  }
  viewPos = vec4<f32>(aberrate(viewPos.xyz, rot * uniforms.uWarpDir), viewPos.w);
  vertexOutputs.position = uniforms.projection * viewPos;
  vertexOutputs.vColor = ramp(fract(vertexInputs.trailMeta.x));
  vertexOutputs.vAlpha = 0.20;
}`;

export const STAR_TRAIL_FRAGMENT_WGSL = `
varying vColor : vec3<f32>;
varying vAlpha : f32;
uniform uWarp : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  fragmentOutputs.color = vec4<f32>(fragmentInputs.vColor, fragmentInputs.vAlpha * uniforms.uWarp);
}`;
