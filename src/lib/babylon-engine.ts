/* babylon-engine.ts — PF-09 B1: the Babylon renderer parity spike.
 *
 * Behind ?engine=babylon. B0 stood up the mount + telemetry seam with a barrel
 * import (measured at 1.1 MB gz — over budget, see TR-027). B1 addresses that
 * and the fps crux:
 *   - TREE-SHAKEN subpath imports (no barrel) — re-measured in TR-028.
 *   - WebGPU primary with a WebGL2 fallback (async init).
 *   - the fps-critical 168k-star point cloud via a custom ShaderMaterial (the
 *     representative parity workload — the streaming catalog + photometric
 *     port is B1-continued/B2).
 *
 * Self-registering `<babylon-scene>` mirroring `<space-engine>`; emits
 * cosmos:progress/ready so the host loading overlay + HUD behave. Travel is
 * still stubbed (B2). WebGPU can only be validated on real devices with
 * navigator.gpu — headless/CI exercises the WebGL2 fallback path.
 *
 * B2 step 2 (2026-07-19): the procedural placeholder is replaced by the real
 * Gaia/Hipparcos catalog (star-catalog.ts) and both shader twins now run the
 * live engine's photometric path. That closes the ~6x apparent-density gap the
 * owner reported on Android (TR-037).
 *
 * B2 step 3 (2026-07-19): travelTo/goHome/randomBody are wired for real, using
 * ship-dynamics.ts's damped spring (position) and quaternion slerp
 * (orientation) rather than the live engine's fixed-duration eased path — a
 * deliberate intermediate stand-in for the not-yet-built choreography.
 *
 * B2 step 4 (2026-07-19): the spring stand-in is REPLACED by the real PF-08
 * choreography — fixed-duration eased position + the behind-the-thruster
 * waypoint chase offset (ship-dynamics.ts's `chaseOffsetAt`/`travelFrame`,
 * unused until now), chase-look damping (orientation aims slightly ahead of
 * the route rather than straight along it), a launch-at-click turn preview
 * during "aim", and the accel/flip/decel + apparent-velocity HUD readout. No
 * ship mesh exists on this path yet, so the camera itself plays the "ship"
 * role the live engine's separate sprite fills — see the state-machine
 * comment below. Screen-space station projection isn't one of the plan's six
 * named B2 sub-steps at all (chase camera / launch / arrival is about the
 * ship's own choreography, not UI markers) — deferred, not attributed to a
 * step that doesn't cover it.
 *
 * B2 step 5 (2026-07-19): distance-scaled travel. NOT a port — the live
 * engine hardcodes warpDur at a fixed 2400 ms regardless of target distance;
 * this is new pure math (`warpDurationForLy`, ship-dynamics.ts) keyed off
 * `ly`, log-scaled and bounded so the catalog's full range (0 to 13+ billion
 * ly, confirmed against the shipped data) stays a reasonable wait.
 *
 * B2 step 6 (2026-07-19): reduced-motion parity, ported directly —
 * `window.matchMedia("(prefers-reduced-motion: reduce)")` checked once at
 * boot (same one-shot snapshot pattern as space-engine.js, no live listener),
 * gating fixed short durations, `CHASE_OFFSET_REST` instead of the waypoint
 * offset, and a snapped (not damped) camera look — identical branches to the
 * live engine's own `reduced` handling.
 */
import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Scene } from "@babylonjs/core/scene";
import {
  Quaternion,
  Vector2,
  Vector3,
} from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Constants } from "@babylonjs/core/Engines/constants";
import type { StarField } from "./star-field";
import {
  buildStarBillboards,
  buildStarField,
  LIVE_STAR_COUNT,
} from "./star-field";
import { CATALOG_CHUNKS, decodeStarCatalog } from "./star-catalog";
import type { Quat } from "./ship-dynamics";
import {
  ARRIVE_STANDOFF,
  bodyWorldPosition,
  CHASE_LOOK_AHEAD,
  CHASE_LOOK_LAMBDA,
  CHASE_OFFSET_REST,
  chaseOffsetAt,
  quatDamp,
  quatFromAxisAngle,
  quatFromUnitVectors,
  quatMultiply,
  QUAT_IDENTITY,
  raDecToDir,
  SHIP_MAX_DT,
  SHIP_VIEW_DEPTH,
  travelFrame,
  warpDurationForLy,
  warpEase,
  WARP_MIN_MS,
} from "./ship-dynamics";

const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

/* --- travel (B2 steps 3-4) --------------------------------------------------
 *
 * A body/station placed in world space, matching the shape the host reads
 * (SpaceEngineElement's `bodies`/`stations`). `sx`/`sy`/`ex`/`ey` (screen-space
 * projection for station-sprite DOM markers) are STILL deliberately NOT
 * computed, even with a real camera view pipeline now in place — it's not one
 * of the plan's named B2 sub-steps and is scoped out of this increment too.
 * Leaving them undefined with `vis: false` is safe: SpaceScene.tsx's station
 * effect reads `b.vis ? b.sx : b.ex`, and `undefined != null` is false, so
 * sprites simply stay hidden rather than crash or show at (0,0). */
interface BabylonBody {
  e: { id: string; ra: number; dec: number; ly: number | null };
  dir: [number, number, number];
  pos: [number, number, number];
  vis: false;
  sx?: number;
  sy?: number;
  ex?: number;
  ey?: number;
}

function placeBody(e: {
  id: string;
  ra: number;
  dec: number;
  ly: number | null;
}): BabylonBody {
  const { dir, pos } = bodyWorldPosition(e.ra, e.dec, e.ly);
  return { e, dir, pos, vis: false };
}

/** Nav stations sit at a fixed depth regardless of their nominal `ly` — matches
 * space-engine.js's setStations exactly (a deliberate difference from
 * placeBody's log-depth catalog bodies, not an oversight). */
const STATION_DEPTH = 420;

function placeStation(s: {
  id: string;
  ra: number;
  dec: number;
  ly: number;
}): BabylonBody {
  const dir = raDecToDir(s.ra, s.dec);
  const pos: [number, number, number] = [
    dir[0] * STATION_DEPTH,
    dir[1] * STATION_DEPTH,
    dir[2] * STATION_DEPTH,
  ];
  return {
    e: { id: s.id, ra: s.ra, dec: s.dec, ly: s.ly || 0 },
    dir,
    pos,
    vis: false,
  };
}

/** Babylon's default (left-handed) camera forward at an identity
 * rotationQuaternion — confirmed against @babylonjs/core's TargetCamera source
 * (`_referencePoint = Vector3.Forward(useRightHandedSystem)`, which is (0,0,1)
 * when the scene is left-handed, Babylon's default and this scene's setting).
 * NOT the same convention as space-engine.js, whose camera looks down −Z in a
 * right-handed view space — ship-dynamics.ts's quaternion math is handedness-
 * agnostic (plain vector-to-vector rotation), so reusing it here is safe as
 * long as this constant, not the live engine's, is the reference forward. */
const BABYLON_FORWARD: [number, number, number] = [0, 0, 1];

/** Babylon's default up axis (left-handed, Y-up — matches FreeCamera's
 * default `upVector`). Used only for the ambient idle drift below. */
const UP_AXIS: [number, number, number] = [0, 1, 0];

/** Ambient idle-at-home drift rate (rad/s). Matches space-engine.js's own
 * `yaw += 0.00012` per frame at its implicit ~60fps assumption
 * (0.00012 * 60 ≈ 0.0072 rad/s) — converted to a proper per-second rate here
 * rather than copying the frame-rate-dependent raw increment. A very slow
 * spin (~14.5 minutes per revolution), not a feature — just enough that the
 * home view isn't perfectly frozen while idle. */
const IDLE_DRIFT_RATE = 0.0072;

/** idle: parked. aim: launch-turn preview before the burn (position holds).
 * warp: the eased chase-camera flight itself. Mirrors space-engine.js's
 * warp.mode values so the host (WarpOverlay, HUD) needs no engine-specific
 * branching. */
type WarpMode = "idle" | "aim" | "warp";

interface BabylonWarp {
  mode: WarpMode;
  target?: BabylonBody;
  from?: [number, number, number]; // camera position at launch
  to?: [number, number, number]; // camera's arrival position (cam(1) invariant)
  dir?: [number, number, number]; // travel direction, fixed for the whole warp
  home?: boolean;
  quiet?: boolean;
  start?: number; // performance.now() at aim-phase entry
  warpStart?: number; // performance.now() at warp-phase entry
  lyTotal?: number; // 0 for goHome — matches the live engine's cosmos:warp payload
  aimDur?: number; // resolved once at launch (reduced-motion-aware)
  warpDur?: number; // resolved once at launch — distance-scaled, reduced-motion-aware
}

// Non-reduced-motion durations, matching the live engine's own values exactly
// for aim (its distance-independent "turn toward the route" phase). Warp
// duration is resolved per-journey by warpDurationForLy (B2 step 5) instead
// of a fixed constant.
const AIM_DUR_MS = 900;
// Reduced-motion durations — identical to the live engine's own `reduced`
// branch (fixed, NOT distance-scaled: reduced motion means "get there fast",
// not "get there fast, but proportionally").
const AIM_DUR_REDUCED_MS = 200;
const WARP_DUR_REDUCED_MS = 350;

/* --- catalog loading (B2 step 2) ------------------------------------------
 *
 * The catalog is packed into PNGs and unpacked through a 2D canvas — the same
 * transport the live engine uses, so both engines read byte-identical assets
 * and no new payload ships. This half is DOM-bound; the decode itself is pure
 * and lives in star-catalog.ts. */
async function loadChunkRGB(url: string): Promise<Uint8Array> {
  const blob = await (await fetch(url)).blob();
  const bmp = await createImageBitmap(blob);
  // Read the dimensions BEFORE close() — closing an ImageBitmap zeroes its
  // width/height, which silently decodes an empty catalog and downgrades to the
  // placeholder without any error surfacing.
  const w = bmp.width;
  const h = bmp.height;
  const cv = document.createElement("canvas");
  cv.width = w;
  cv.height = h;
  const cx = cv.getContext("2d", { willReadFrequently: true });
  if (!cx) throw new Error("2d context unavailable");
  cx.drawImage(bmp, 0, 0);
  const rgba = cx.getImageData(0, 0, w, h).data;
  bmp.close?.();
  const nPx = w * h;
  const raw = new Uint8Array(nPx * 3);
  for (let p = 0; p < nPx; p++) {
    raw[p * 3] = rgba[p * 4];
    raw[p * 3 + 1] = rgba[p * 4 + 1];
    raw[p * 3 + 2] = rgba[p * 4 + 2];
  }
  return raw;
}

/** Real catalog, falling back to the procedural field if an asset is missing.
 *
 * The fallback is not decoration: it keeps the no-network / asset-404 path
 * rendering a sky rather than a black screen, matching the live engine's
 * behaviour of tolerating a missing deep layer. It reports which path was
 * taken so a silent downgrade cannot masquerade as the real catalog. */
async function loadStarField(): Promise<{
  field: StarField;
  source: "catalog" | "procedural";
}> {
  try {
    const chunks = await Promise.all(
      CATALOG_CHUNKS.map((u) =>
        loadChunkRGB(u).catch((e) => {
          // A missing deep layer degrades; a missing base catalog does not.
          if (u === CATALOG_CHUNKS[0]) throw e;
          console.warn(`[babylon-engine] optional chunk ${u} failed`, e);
          return new Uint8Array(0);
        }),
      ),
    );
    const field = decodeStarCatalog(chunks);
    if (field.count === 0) throw new Error("catalog decoded to zero records");
    return { field, source: "catalog" };
  } catch (e) {
    console.warn("[babylon-engine] star catalog failed, using placeholder", e);
    return { field: buildStarField(LIVE_STAR_COUNT), source: "procedural" };
  }
}

/* Star rendering: BILLBOARD QUADS in one merged indexed mesh, not point sprites.
 *
 * B1 findings (TR-029): WebGPU has no gl_PointSize equivalent — WGSL dropped the
 * `point_size` builtin and `point-list` renders 1x1 px; Babylon's WebGPU backend
 * ignores `pointSize` outright. The live engine's variable-size point sprites
 * therefore cannot port. Babylon thin instances were tried and also rejected
 * (they require a per-instance `matrix` buffer, else thinInstanceCount stays 0
 * and nothing draws). Both backends therefore use one plain indexed mesh, so
 * the WebGL2 path exercises exactly the geometry WebGPU requires. GLSL + WGSL
 * twins below; the material picks by backend. */

/* PHOTOMETRY (B2 step 2). B1's shader gave every star a uniform size and a
 * full-brightness core, so all 168,959 were visible and the sky read ~6x denser
 * than the live engine (TR-037). These twins port the live engine's photometric
 * path verbatim — Pogson's law over the Hipparcos magnitude window, the
 * Planckian O->M chromaticity ramp, and the deep-layer object-class modifiers:
 *
 *   mag  = 12.5 - magByte/255 * 14      real catalog magnitude
 *   flux = 10^(-0.4*(mag - 2))          Pogson
 *   px   = clamp((0.9 + 2.6*flux^0.28) * uSize * 520/dist, 1, 13)
 *   a    = 0.10 + 0.90*sqrt(flux)
 *
 * The magnitude distribution is steeply faint-weighted, so most stars land at
 * ~1 px and alpha 0.10 — present, but only a few thousand are resolvable. That
 * is the density fix; it is a fidelity port, not a cosmetic dimming pass.
 *
 * BILLBOARD-vs-POINT-SPRITE ADAPTATION. The live engine writes `px` to
 * gl_PointSize, which WebGPU has no equivalent for (TR-029) — hence quads. Two
 * consequences, both handled here rather than left implicit:
 *
 *  1. `px` is a diameter in device pixels, so the quad is offset in CLIP space
 *     by `corner * px * clip.w / uViewport`. Going through clip.w rather than a
 *     view-space extent keeps this exact under any projection and independent
 *     of handedness — Babylon is left-handed, the live engine is not.
 *  2. A 1 px quad can fall between pixel centres and drop out entirely, where a
 *     1 px point sprite always rasterises. Faint stars would therefore flicker
 *     as the camera drifts. The GEOMETRIC extent is floored at MIN_QUAD_PX
 *     while `flux` still drives alpha, so coverage is stable and visibility
 *     stays photometric.
 *
 * Deliberately NOT ported here: relativistic aberration + Doppler (they need
 * the flight model's velocity — B2 steps 3-5) and twinkle (vacuum has none;
 * the live engine also disables it for field stars). */
const STAR_SHADER_CONSTANTS = `
const float MIN_QUAD_PX = 1.5;
const float CI_UNPACK_SCALE = ${(256 / 255).toFixed(8)};`;

ShaderStore.ShadersStore["ijStarVertexShader"] = `
precision highp float;
attribute vec3 position;     // star centre (world)
attribute vec2 starMeta;     // x = magByte/255, y = type + ci/256
uniform mat4 view;
uniform mat4 projection;
uniform vec2 uViewport;      // render target size, device px
uniform float uSize;         // device pixel ratio (live engine parity)
uniform float uHaloAmp;
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vType;
varying float vHalo;
${STAR_SHADER_CONSTANTS}
vec3 ramp(float t){
  // Planckian star sequence O->M (real stellar chromaticities)
  vec3 c0=vec3(0.608,0.690,1.000), c1=vec3(0.792,0.843,1.000), c2=vec3(0.973,0.969,1.000),
       c3=vec3(1.000,0.957,0.918), c4=vec3(1.000,0.824,0.631), c5=vec3(1.000,0.800,0.435);
  if(t<0.2) return mix(c0,c1,t/0.2);
  if(t<0.4) return mix(c1,c2,(t-0.2)/0.2);
  if(t<0.6) return mix(c2,c3,(t-0.4)/0.2);
  if(t<0.8) return mix(c3,c4,(t-0.6)/0.2);
  return mix(c4,c5,(t-0.8)/0.2);
}
void main(){
  // Quad corner derived from the vertex id rather than stored (B2 vertex
  // expansion): c=0..3 -> (-1,-1) (1,-1) (1,1) (-1,1). gl_VertexID is the
  // post-index-fetch vertex index, so this is correct for indexed draws.
  int c = gl_VertexID % 4;
  vec2 corner = vec2((c == 1 || c == 2) ? 1.0 : -1.0, (c >= 2) ? 1.0 : -1.0);
  vec4 centre = view * vec4(position, 1.0);
  float dist = length(centre.xyz);          // camera sits at the view origin

  float mag  = 12.5 - starMeta.x*14.0;
  float flux = pow(10.0, -0.4*(mag - 2.0));
  float fl   = pow(flux, 0.28);
  float px   = (0.9 + 2.6*fl) * uSize * (520.0/max(dist, 90.0));
  px = clamp(px, 1.0, 13.0);
  vHalo = smoothstep(0.60, 1.0, fl) * uHaloAmp;
  px *= 1.0 + vHalo*1.5;

  float ty = floor(starMeta.y);
  vType = ty;
  vColor = ramp(fract(starMeta.y) * CI_UNPACK_SCALE);
  vAlpha = 0.10 + 0.90*sqrt(clamp(flux, 0.0, 1.4));
  if (ty > 0.5) {
    vHalo = 0.0;
    if (ty < 1.5)      { px *= 2.6; vAlpha *= 0.85; }  // open cluster glow
    else if (ty < 2.5) { px *= 0.8; }                   // white dwarf
    else if (ty < 3.5) {                                // SDSS galaxy
      px *= 1.15;
      vColor = mix(vColor, vec3(1.0, 0.45, 0.30), clamp((dist - 800.0)/500.0, 0.0, 0.75));
    }
    else if (ty < 4.5) { px *= 0.95; vColor = mix(vColor, vec3(0.55, 0.95, 0.95), 0.35); } // GD-1
    else if (ty < 5.5) { vColor = mix(vColor, vec3(1.0, 0.85, 0.45), 0.25); }               // exoplanet host
    else if (ty < 6.5) { px *= 0.85; }                  // DR3 asteroid
    else               { px *= 1.3; vAlpha *= 0.7; }    // Oort cloud
  }

  vec4 clip = projection * centre;
  float quadPx = max(px, MIN_QUAD_PX);
  clip.x += corner.x * quadPx * clip.w / max(uViewport.x, 1.0);
  clip.y += corner.y * quadPx * clip.w / max(uViewport.y, 1.0);
  gl_Position = clip;
  vCorner = corner;
}`;
ShaderStore.ShadersStore["ijStarFragmentShader"] = `
precision highp float;
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vType;
varying float vHalo;
void main(){
  float d = length(vCorner);
  if(d > 1.0) discard;
  float ty = floor(vType + 0.5);
  float a;
  if (ty > 0.5 && ty < 1.5)      { a = exp(-d*d*2.6)*0.80; }  // cluster: soft glow, no PSF core
  else if (ty > 2.5 && ty < 3.5) { a = exp(-d*d*4.0)*0.85; }  // galaxy smudge
  else if (ty > 6.5)             { a = exp(-d*d*3.2)*0.55; }  // oort dust grain
  else { a = exp(-d*d*6.0) + vHalo*exp(-d*3.0)*0.18; }        // stellar PSF + bloom
  gl_FragColor = vec4(vColor, a*vAlpha);
}`;

// Babylon-flavoured WGSL twin (vertexInputs / uniforms / vertexOutputs …).
// Kept line-for-line parallel with the GLSL above — the two are a contract with
// no compiler to check them against each other, so divergence must be visible
// on inspection. The shared arithmetic (corner derivation, colour unpacking) is
// additionally pinned by unit tests via its JS mirrors.
ShaderStore.ShadersStoreWGSL["ijStarVertexShader"] = `
attribute position : vec3<f32>;
attribute starMeta : vec2<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uViewport : vec2<f32>;
uniform uSize : f32;
uniform uHaloAmp : f32;
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vAlpha : f32;
varying vType : f32;
varying vHalo : f32;

const MIN_QUAD_PX : f32 = 1.5;
const CI_UNPACK_SCALE : f32 = ${(256 / 255).toFixed(8)};

fn ramp(t : f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.608, 0.690, 1.000);
  let c1 = vec3<f32>(0.792, 0.843, 1.000);
  let c2 = vec3<f32>(0.973, 0.969, 1.000);
  let c3 = vec3<f32>(1.000, 0.957, 0.918);
  let c4 = vec3<f32>(1.000, 0.824, 0.631);
  let c5 = vec3<f32>(1.000, 0.800, 0.435);
  if (t < 0.2) { return mix(c0, c1, t / 0.2); }
  if (t < 0.4) { return mix(c1, c2, (t - 0.2) / 0.2); }
  if (t < 0.6) { return mix(c2, c3, (t - 0.4) / 0.2); }
  if (t < 0.8) { return mix(c3, c4, (t - 0.6) / 0.2); }
  return mix(c4, c5, (t - 0.8) / 0.2);
}

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  // Corner derived from the vertex index, not stored (B2 vertex expansion).
  // Babylon injects @builtin(vertex_index) into VertexInputs as vertexIndex.
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let corner : vec2<f32> = vec2<f32>(
    select(-1.0, 1.0, c == 1u || c == 2u),
    select(-1.0, 1.0, c >= 2u));
  let centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  let dist : f32 = length(centre.xyz);

  let mag : f32 = 12.5 - vertexInputs.starMeta.x * 14.0;
  let flux : f32 = pow(10.0, -0.4 * (mag - 2.0));
  let fl : f32 = pow(flux, 0.28);
  var px : f32 = (0.9 + 2.6 * fl) * uniforms.uSize * (520.0 / max(dist, 90.0));
  px = clamp(px, 1.0, 13.0);
  var halo : f32 = smoothstep(0.60, 1.0, fl) * uniforms.uHaloAmp;
  px = px * (1.0 + halo * 1.5);

  let ty : f32 = floor(vertexInputs.starMeta.y);
  var col : vec3<f32> = ramp(fract(vertexInputs.starMeta.y) * CI_UNPACK_SCALE);
  var alpha : f32 = 0.10 + 0.90 * sqrt(clamp(flux, 0.0, 1.4));
  if (ty > 0.5) {
    halo = 0.0;
    if (ty < 1.5) { px = px * 2.6; alpha = alpha * 0.85; }
    else if (ty < 2.5) { px = px * 0.8; }
    else if (ty < 3.5) {
      px = px * 1.15;
      col = mix(col, vec3<f32>(1.0, 0.45, 0.30), clamp((dist - 800.0) / 500.0, 0.0, 0.75));
    }
    else if (ty < 4.5) { px = px * 0.95; col = mix(col, vec3<f32>(0.55, 0.95, 0.95), 0.35); }
    else if (ty < 5.5) { col = mix(col, vec3<f32>(1.0, 0.85, 0.45), 0.25); }
    else if (ty < 6.5) { px = px * 0.85; }
    else { px = px * 1.3; alpha = alpha * 0.7; }
  }

  let clip : vec4<f32> = uniforms.projection * centre;
  let quadPx : f32 = max(px, MIN_QUAD_PX);
  vertexOutputs.position = vec4<f32>(
    clip.x + corner.x * quadPx * clip.w / max(uniforms.uViewport.x, 1.0),
    clip.y + corner.y * quadPx * clip.w / max(uniforms.uViewport.y, 1.0),
    clip.z,
    clip.w);
  vertexOutputs.vCorner = corner;
  vertexOutputs.vColor = col;
  vertexOutputs.vAlpha = alpha;
  vertexOutputs.vType = ty;
  vertexOutputs.vHalo = halo;
}`;
ShaderStore.ShadersStoreWGSL["ijStarFragmentShader"] = `
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vAlpha : f32;
varying vType : f32;
varying vHalo : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d : f32 = length(fragmentInputs.vCorner);
  if (d > 1.0) { discard; }
  let ty : f32 = floor(fragmentInputs.vType + 0.5);
  var a : f32;
  if (ty > 0.5 && ty < 1.5) { a = exp(-d * d * 2.6) * 0.80; }
  else if (ty > 2.5 && ty < 3.5) { a = exp(-d * d * 4.0) * 0.85; }
  else if (ty > 6.5) { a = exp(-d * d * 3.2) * 0.55; }
  else { a = exp(-d * d * 6.0) + fragmentInputs.vHalo * exp(-d * 3.0) * 0.18; }
  fragmentOutputs.color = vec4<f32>(fragmentInputs.vColor, a * fragmentInputs.vAlpha);
}`;

async function createEngine(canvas: HTMLCanvasElement): Promise<{
  engine: AbstractEngine;
  backend: "webgpu" | "webgl2";
}> {
  // WebGPU primary — only where the browser actually has it (real devices).
  const gpu = (navigator as Navigator & { gpu?: unknown }).gpu;
  if (gpu) {
    try {
      const { WebGPUEngine } =
        await import("@babylonjs/core/Engines/webgpuEngine");
      // adaptToDeviceRatio has NO positional constructor slot on WebGPUEngine
      // (unlike the WebGL2 `Engine` below, which takes it as its 4th arg) —
      // it must be set via this options field, or it silently defaults to
      // false and the canvas renders at 1x CSS-pixel resolution on any HiDPI
      // display, then gets stretched to fill the physical pixel grid by the
      // browser. That's a real, visible defect (blur), not a Babylon quirk —
      // confirmed against @babylonjs/core's AbstractEngine constructor source.
      const engine = new WebGPUEngine(canvas, {
        antialias: true,
        adaptToDeviceRatio: true,
      });
      await engine.initAsync();
      return { engine, backend: "webgpu" };
    } catch (e) {
      console.warn("[babylon-engine] WebGPU init failed, falling back", e);
    }
  }
  return {
    engine: new Engine(canvas, true, { preserveDrawingBuffer: true }, true),
    backend: "webgl2",
  };
}

class BabylonScene extends HTMLElement {
  private _engine?: AbstractEngine;
  private _scene?: Scene;
  private _stars?: Mesh;
  private _ro?: ResizeObserver;
  private _init = false;
  private _lastFrameMs?: number;
  private _camQuat: Quat = QUAT_IDENTITY;
  /** One-shot snapshot at boot — same pattern as space-engine.js's own
   * `this.reduced`, not a live-updating listener. */
  private _reduced = false;

  // --- SpaceEngineElement contract surface ---
  bodies: BabylonBody[] = [];
  stations: BabylonBody[] = [];
  cam: [number, number, number] = [0, 0, 0];
  arrivedId: string | null = null;
  warp: BabylonWarp = { mode: "idle" };
  backend: "webgpu" | "webgl2" | null = null;
  starCount = 0;
  /** Which star data actually rendered — a procedural fallback must never be
   * mistaken for the real catalog in a measurement or a screenshot. */
  starSource: "catalog" | "procedural" | null = null;
  /** Frames this engine has actually rendered (read by the perf harness). */
  renderFrames = 0;

  connectedCallback() {
    if (this._init) return;
    this._init = true;
    void this._boot();
  }

  private async _boot() {
    this._reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const canvas = document.createElement("canvas");
    Object.assign(canvas.style, {
      position: "absolute",
      inset: "0",
      width: "100%",
      height: "100%",
      display: "block",
    });
    this.style.display = "block";
    this.appendChild(canvas);

    let engine: AbstractEngine;
    let backend: "webgpu" | "webgl2";
    try {
      ({ engine, backend } = await createEngine(canvas));
    } catch (e) {
      // Parity with space-engine's no-WebGL fallback: never blank the page.
      console.warn("[babylon-engine] engine init failed", e);
      emit("cosmos:progress", { loaded: 0, total: 0 });
      emit("cosmos:ready", {});
      return;
    }
    this._engine = engine;
    this.backend = backend;

    const scene = new Scene(engine);
    this._scene = scene;
    scene.clearColor = new Color4(0.003, 0.004, 0.012, 1); // vacuum black
    scene.skipPointerMovePicking = true;

    const camera = new FreeCamera("cam", new Vector3(0, 0, 0), scene);
    camera.minZ = 0.1;
    camera.maxZ = 6000;
    // Switches the camera from Euler (.rotation) to quaternion-driven mode —
    // required so the per-frame quatDamp below actually takes effect.
    camera.rotationQuaternion = new Quaternion();

    // B2 step 3: real catalog bodies, so travelTo/randomBody have real
    // targets. window.CELESTIAL is guaranteed populated by mount time —
    // SpaceScene.tsx imports this module and all five celestial-*.js data
    // files in one Promise.all and only renders <babylon-scene> after every
    // one resolves (each populates window.CELESTIAL synchronously on import).
    this.bodies = (window.CELESTIAL ?? []).map((e) =>
      placeBody({ id: e.id, ra: e.ra, dec: e.dec, ly: e.ly }),
    );

    const { field, source } = await loadStarField();
    const bb = buildStarBillboards(field);
    this.starCount = field.count;
    this.starSource = source;

    // one merged indexed mesh of billboard quads (see star-field.ts for why
    // neither point sprites nor thin instances are usable here)
    const mesh = new Mesh("stars", scene);
    this._stars = mesh;
    const vd = new VertexData();
    vd.positions = bb.positions;
    vd.indices = bb.indices;
    vd.applyToMesh(mesh, false);
    mesh.setVerticesBuffer(
      new VertexBuffer(engine, bb.meta, "starMeta", false, false, 2),
    );
    // the shell surrounds the camera; never frustum/occlusion-cull it away
    mesh.alwaysSelectAsActiveMesh = true;

    const mat = new ShaderMaterial(
      "stars",
      scene,
      { vertex: "ijStar", fragment: "ijStar" },
      {
        attributes: ["position", "starMeta"],
        uniforms: ["view", "projection", "uViewport", "uSize", "uHaloAmp"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    // uSize = devicePixelRatio, matching the live engine, so a star subtends the
    // same CSS size on a HiDPI panel as on a 1x one.
    mat.setFloat("uSize", window.devicePixelRatio || 1);
    // Halo/bloom is tier-gated in the live engine (0 / 0.55 / 1). The Babylon
    // path has no tier system until B5, so it runs the top tier for now.
    mat.setFloat("uHaloAmp", 1);
    const pushViewport = () =>
      mat.setVector2(
        "uViewport",
        new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
      );
    pushViewport();
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;

    let first = true;
    engine.runRenderLoop(() => {
      this._tickWarp(camera);
      scene.render();
      this.renderFrames++; // engine-side proof the scene is actually drawing
      if (first) {
        first = false;
        emit("cosmos:progress", { loaded: field.count, total: field.count });
        emit("cosmos:ready", {});
      }
    });

    this._ro = new ResizeObserver(() => {
      engine.resize();
      pushViewport(); // px-sized billboards depend on the render target size
    });
    this._ro.observe(this);

    const badge = document.createElement("div");
    badge.textContent =
      `BABYLON ${backend.toUpperCase()} · ${field.count.toLocaleString()} STARS` +
      `${source === "procedural" ? " (PLACEHOLDER)" : ""} · PF-09 B2`;
    Object.assign(badge.style, {
      position: "absolute",
      left: "12px",
      bottom: "12px",
      font: "11px/1.4 monospace",
      letterSpacing: "0.15em",
      color: "#7986cb",
      pointerEvents: "none",
      opacity: "0.8",
    });
    this.appendChild(badge);
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    this._engine?.dispose();
  }

  /** Render diagnostics — used by CI's pixel/geometry assertions and handy on
   * the owner's devices during the B1 gate measurement. */
  sceneStats() {
    const m = this._stars;
    return {
      backend: this.backend,
      starCount: this.starCount,
      starSource: this.starSource,
      activeMeshes: this._scene?.getActiveMeshes().length ?? -1,
      meshReady: m ? m.isReady(true) : false,
      activeIndices: this._scene?.getActiveIndices() ?? -1,
      totalVertices: m ? m.getTotalVertices() : -1,
      totalIndices: m ? m.getTotalIndices() : -1,
      materialReady: m?.material ? m.material.isReady(m) : false,
    };
  }

  // --- travel (B2 steps 3-4) ---

  travelTo(id: string, quiet?: boolean) {
    const b =
      this.bodies.find((x) => x.e.id === id) ??
      this.stations.find((x) => x.e.id === id);
    if (!b || this.warp.mode === "warp" || this.warp.mode === "aim") return;
    if (this.arrivedId === id) {
      emit("cosmos:arrive", { id, quiet: !!quiet }); // already parked — open dossier
      return;
    }
    const dir = b.dir;
    const to: [number, number, number] = [
      b.pos[0] - dir[0] * ARRIVE_STANDOFF,
      b.pos[1] - dir[1] * ARRIVE_STANDOFF,
      b.pos[2] - dir[2] * ARRIVE_STANDOFF,
    ];
    this.arrivedId = null;
    this._beginWarp(b, to, false, !!quiet, b.e.ly ?? 0);
    emit("cosmos:select", { id, quiet: !!quiet });
  }

  goHome(quiet?: boolean) {
    if (this.warp.mode === "warp" || this.warp.mode === "aim") return;
    if (Math.hypot(this.cam[0], this.cam[1], this.cam[2]) < 1) return; // already home
    this.arrivedId = null;
    this._beginWarp(undefined, [0, 0, 0], true, !!quiet, 0);
  }

  randomBody() {
    if (!this.bodies.length) return;
    const b = this.bodies[Math.floor(Math.random() * this.bodies.length)];
    this.travelTo(b.e.id);
  }

  setStations(list: { id: string; ra: number; dec: number; ly: number }[]) {
    this.stations = list.map(placeStation);
  }

  fieldInfo() {
    // Field-star hover/picking needs the live engine's screen-space
    // projection pipeline, still out of scope — see the header comment.
    return null;
  }

  private _beginWarp(
    target: BabylonBody | undefined,
    to: [number, number, number],
    home: boolean,
    quiet: boolean,
    lyTotal: number,
  ) {
    const from = this.cam;
    const dx = to[0] - from[0],
      dy = to[1] - from[1],
      dz = to[2] - from[2];
    const dl = Math.hypot(dx, dy, dz) || 1;
    // Durations resolved once per journey, not read from a shared constant
    // each tick — reduced motion always wins fixed-short (B2 step 6); the
    // distance-scaled formula (B2 step 5) only applies otherwise, and never
    // to goHome (home is always the fast case, matching the live engine).
    const aimDur = this._reduced ? AIM_DUR_REDUCED_MS : AIM_DUR_MS;
    const warpDur = this._reduced
      ? WARP_DUR_REDUCED_MS
      : home
        ? WARP_MIN_MS
        : warpDurationForLy(lyTotal);
    this.warp = {
      mode: "aim",
      target,
      from: [from[0], from[1], from[2]],
      to,
      dir: [dx / dl, dy / dl, dz / dl],
      home,
      quiet,
      start: performance.now(),
      lyTotal,
      aimDur,
      warpDur,
    };
  }

  /** Per-frame warp state machine + camera application — the PF-08
   * choreography (B2 step 4), superseding step 3's spring stand-in.
   *
   * "aim": position holds at `from`; the camera previews the turn toward the
   * route (space-engine.js turns the SHIP here — with no ship mesh on this
   * path, the camera plays that role, same framing TR-040 used for step 3).
   *
   * "warp": position follows a fixed-duration eased path (`warpEase`, the
   * live engine's own accel/decel curve) offset by the behind-the-thruster
   * waypoint table (`chaseOffsetAt`/`travelFrame`) — a "virtual ship" leads
   * the camera by one ship-depth along the route, and the camera trails it at
   * the waypoint offset. Both curve ends sit exactly astern by construction
   * (`chaseOffsetAt(0) === chaseOffsetAt(1) === [0,0,SHIP_VIEW_DEPTH]`), so
   * `cam(0) = from` and `cam(1) = to` hold exactly — the same invariant the
   * live engine relies on for arrival framing, preserved here algebraically
   * rather than asserted; verified in the E2E arrival check.
   *
   * Orientation SLERPs (quatDamp) toward a look-ahead point past the virtual
   * ship (`CHASE_LOOK_AHEAD`), not straight along the route — this is what
   * gives "arrival framing" for free as `k -> 1`: the look point converges on
   * the body itself rather than snapping to face it. Reduced motion (B2 step
   * 6) overrides three things, matching the live engine's own `reduced`
   * branches exactly: fixed short durations instead of distance-scaled ones
   * (resolved once in `_beginWarp`), `CHASE_OFFSET_REST` instead of the
   * waypoint offset, and a SNAPPED look instead of a damped one.
   *
   * Idle-at-home: a slow ambient orientation drift, ported from the live
   * engine's own `yaw += 0.00012` — without it, the home view is perfectly
   * frozen whenever nothing is traveling, which reads as "the scene is dead"
   * rather than "parked." */
  private _tickWarp(camera: FreeCamera) {
    const now = performance.now();
    const dt = Math.min(
      SHIP_MAX_DT,
      this._lastFrameMs != null ? (now - this._lastFrameMs) / 1000 : 1 / 60,
    );
    this._lastFrameMs = now;

    const w = this.warp;
    if (
      w.mode === "idle" &&
      !this._reduced &&
      Math.hypot(this.cam[0], this.cam[1], this.cam[2]) < 1
    ) {
      this._camQuat = quatMultiply(
        quatFromAxisAngle(UP_AXIS, IDLE_DRIFT_RATE * dt),
        this._camQuat,
      );
    }
    if (w.mode === "aim") {
      if (now - (w.start ?? now) >= (w.aimDur ?? AIM_DUR_MS)) {
        w.mode = "warp";
        w.warpStart = now;
      } else if (w.dir) {
        const targetQ = quatFromUnitVectors(BABYLON_FORWARD, w.dir);
        this._camQuat = this._reduced
          ? targetQ
          : quatDamp(this._camQuat, targetQ, CHASE_LOOK_LAMBDA, dt);
      }
    }
    if (w.mode === "warp" && w.to && w.from && w.dir) {
      const warpDur = w.warpDur ?? WARP_MIN_MS;
      const k = Math.min(1, (now - (w.warpStart ?? now)) / warpDur);
      const e = warpEase(k);
      const wd = w.dir;
      const shipW: [number, number, number] = [
        w.from[0] + (w.to[0] - w.from[0]) * e + wd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + (w.to[1] - w.from[1]) * e + wd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + (w.to[2] - w.from[2]) * e + wd[2] * SHIP_VIEW_DEPTH,
      ];
      const off = this._reduced ? CHASE_OFFSET_REST : chaseOffsetAt(k);
      const fr = travelFrame(wd);
      this.cam = [
        shipW[0] - fr.right[0] * off[0] - fr.up[0] * off[1] - wd[0] * off[2],
        shipW[1] - fr.right[1] * off[0] - fr.up[1] * off[1] - wd[1] * off[2],
        shipW[2] - fr.right[2] * off[0] - fr.up[2] * off[1] - wd[2] * off[2],
      ];

      const lx = shipW[0] + wd[0] * CHASE_LOOK_AHEAD - this.cam[0],
        ly = shipW[1] + wd[1] * CHASE_LOOK_AHEAD - this.cam[1],
        lz = shipW[2] + wd[2] * CHASE_LOOK_AHEAD - this.cam[2];
      const ll = Math.hypot(lx, ly, lz) || 1;
      const targetQ = quatFromUnitVectors(BABYLON_FORWARD, [
        lx / ll,
        ly / ll,
        lz / ll,
      ]);
      this._camQuat = this._reduced
        ? targetQ
        : quatDamp(this._camQuat, targetQ, CHASE_LOOK_LAMBDA, dt);

      if (k >= 1) {
        w.mode = "idle";
        this.cam = [w.to[0], w.to[1], w.to[2]]; // land exactly on the invariant
        if (w.home) {
          this.arrivedId = null;
          emit("cosmos:home", {});
        } else if (w.target) {
          this.arrivedId = w.target.e.id;
          emit("cosmos:arrive", { id: w.target.e.id, quiet: !!w.quiet });
        }
      } else {
        // brachistochrone accel/flip/decel readout — matches the live
        // engine's WarpOverlay contract exactly (same k thresholds, same vC
        // formula), so the transit HUD reads identically on either engine.
        const dsdk = k < 0.5 ? 4 * k : 4 * (1 - k);
        const wphase: "accel" | "flip" | "decel" =
          k < 0.47 ? "accel" : k < 0.53 ? "flip" : "decel";
        const lyTotal = w.lyTotal ?? 0;
        const vC =
          lyTotal > 0 ? (lyTotal * dsdk) / (warpDur / 1000) / 3.1688e-8 : 0;
        emit("cosmos:warp", {
          id: w.target?.e.id ?? "__home",
          t: k,
          ly: w.home ? 0 : lyTotal * (1 - e),
          vC,
          phase: wphase,
          home: !!w.home,
          quiet: !!w.quiet,
        });
      }
    }

    const q = camera.rotationQuaternion;
    if (q)
      q.set(
        this._camQuat[0],
        this._camQuat[1],
        this._camQuat[2],
        this._camQuat[3],
      );
    camera.position.set(this.cam[0], this.cam[1], this.cam[2]);
  }
}

if (!customElements.get("babylon-scene"))
  customElements.define("babylon-scene", BabylonScene);
