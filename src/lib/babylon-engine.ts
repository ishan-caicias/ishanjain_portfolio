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
 * B3 volumetric nebulae (2026-07-19): four raymarched gas volumes anchored at
 * real catalog nebulae (m42/ngc7293/veil/rosette — the same bodyWorldPosition
 * placement travelTo() flies to). Tier-gated producer into one half-res
 * texture: WebGPU raymarches in a COMPUTE shader (the B3 "gaseous look"
 * showcase); WebGL2 runs the same march as a ProceduralTexture fragment pass
 * (no compute API there — B3's "fallback tier still coherent"). A fullscreen
 * triangle composites the texture additively. All volume/march constants are
 * baked into generated shader sources by nebula-field.ts — see that file's
 * header and ADR-0004 for the architecture rationale.
 *
 * B3 ship track (2026-07-19, owner-unblocked): the GLB hull finally exists on
 * this path — the same tiered sci-fi-fighter assets and craft-tier policy the
 * live engine ships, normalized under a wrapper whose +Z is the nose. It
 * materialises at the virtual-ship position the chase camera has trailed
 * since B2 step 4, performs a real 180° flip-and-burn across the HUD's flip
 * window, and carries the three ship-attached B3 items: the thruster plume
 * (ship-dynamics' F3 cone geometry + phase functions, GLSL/WGSL twins), the
 * heat-shimmer refraction post-pass (deferred from F3, anchored at the
 * nozzle's screen position), and docking-approach polish (hold + fade at
 * arrival). See babylon-ship.ts.
 *
 * B5 (2026-07-19): the formal quality-tier system (babylon-tiers.ts) —
 * backend + perf-telemetry's device class + ?tier= override resolve ONE
 * budget at boot, consumed by every knob: star halo (the live engine's
 * 0/0.55/1 values, finally honoured), shooting-star count, nebula raymarch
 * steps + offscreen resolution, asteroid-body count, and the shimmer pass
 * (skipped entirely on lite). Reduced motion stays a per-feature behaviour
 * contract composing with any tier, and the WebGPU→WebGL2 / no-WebGL
 * fallbacks remain the pre-existing first-class policies beneath it.
 *
 * B4 steps 2-4 (2026-07-19): warp progress became INTEGRATED (dk = dt/dur ×
 * beltDensity slow factor — proximity slowdown feeding the B2 velocity
 * profile; `warp.prog` is the single source of k), the warping ship deflects
 * nearby rocks with mass-scaled forces, solver collision impulses drive a
 * distance-falloff camera shake (ringing down on the camera object only —
 * this.cam stays exact), and berthing lands with a gentle docking contact:
 * a shake bump plus a sprung hull settle along the approach axis.
 *
 * B4 step 1 (2026-07-19): the Havok asteroid field — the physics showcase's
 * foundation. Lazy same-origin WASM (never a CDN), WASM-SIMD-gated: below the
 * floor (or on init failure / reduced motion) the same tier-gated belt
 * renders with kinematic drift and no live physics, per the plan. Rock
 * geometry, field construction, belt-pull herding, and the SIMD probe are
 * pure in babylon-asteroids.ts. Also adds the scene's first light (dim
 * hemispheric — custom-shader layers ignore it; the PBR hull benefits).
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
  Vector4,
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
import { TransformNode } from "@babylonjs/core/Meshes/transformNode";
import type { AbstractMesh } from "@babylonjs/core/Meshes/abstractMesh";
import { PostProcess } from "@babylonjs/core/PostProcesses/postProcess";
import { CreateIcoSphereVertexData } from "@babylonjs/core/Meshes/Builders/icoSphereBuilder";
import { CreateSphereVertexData } from "@babylonjs/core/Meshes/Builders/sphereBuilder";
import { StandardMaterial } from "@babylonjs/core/Materials/standardMaterial";
import { Material } from "@babylonjs/core/Materials/material";
import { Color3 } from "@babylonjs/core/Maths/math.color";
import { HemisphericLight } from "@babylonjs/core/Lights/hemisphericLight";
import {
  buildMilkyWayRow,
  MILKY_WAY_FRAGMENT_GLSL,
  MILKY_WAY_FRAGMENT_WGSL,
  MILKY_WAY_HEIGHT,
  MILKY_WAY_ROWS_PER_CHUNK,
  MILKY_WAY_SPHERE_RADIUS,
  MILKY_WAY_VERTEX_GLSL,
  MILKY_WAY_VERTEX_WGSL,
  MILKY_WAY_WIDTH,
} from "./milky-way";
import {
  buildConstellationLines,
  CONSTELLATION_FRAGMENT_GLSL,
  CONSTELLATION_FRAGMENT_WGSL,
  CONSTELLATION_RADIUS,
  CONSTELLATION_VERTEX_GLSL,
  CONSTELLATION_VERTEX_WGSL,
} from "./constellations";
import {
  advanceTrailCamera,
  buildStarTrails,
  trailFade,
  trailsVisible,
  STAR_TRAIL_FRAGMENT_GLSL,
  STAR_TRAIL_FRAGMENT_WGSL,
  STAR_TRAIL_VERTEX_GLSL,
  STAR_TRAIL_VERTEX_WGSL,
} from "./star-trails";
// SIDE-EFFECT import required: Mesh.createInstance() throws "InstancedMesh
// needs to be imported before" unless the class module has executed (it
// patches the factory onto Mesh) — a type-only import erases and does NOT
// run it. Same tree-shaking trap class as the computeShader extension
// (TR-046) and worth the loud comment.
import "@babylonjs/core/Meshes/instancedMesh";
import type { InstancedMesh } from "@babylonjs/core/Meshes/instancedMesh";
import type { PhysicsBody } from "@babylonjs/core/Physics/v2/physicsBody";
// Havok WASM asset URL — Vite emits the file and returns its hashed path; the
// binary itself is fetched (same-origin) only when _setupPhysics runs.
import havokWasmUrl from "@babylonjs/havok/lib/esm/HavokPhysics.wasm?url";
import {
  advanceWarpProgress,
  ASTEROID_BELT,
  beltDensityAt,
  beltPullAccel,
  buildAsteroidField,
  displaceRockVertices,
  IMPACT_SHAKE,
  impactShakeAmplitude,
  passageDeflectForce,
  ROCK_BASE_COUNT,
  shakeOffset,
  visualDriftStep,
  warpSlowFactor,
  wasmSimdSupported,
  type AsteroidField,
} from "./babylon-asteroids";
import type { StarField } from "./star-field";
import {
  buildStarBillboards,
  buildStarField,
  LIVE_STAR_COUNT,
} from "./star-field";
import {
  CATALOG_CHUNKS,
  decodeStarCatalog,
  unpackTypeAndColour,
} from "./star-catalog";
import { buildShootingStars } from "./shooting-stars";
import { ComputeShader } from "@babylonjs/core/Compute/computeShader";
import { UniformBuffer } from "@babylonjs/core/Materials/uniformBuffer";
import { RawTexture } from "@babylonjs/core/Materials/Textures/rawTexture";
import { ProceduralTexture } from "@babylonjs/core/Materials/Textures/Procedurals/proceduralTexture";
import type { BaseTexture } from "@babylonjs/core/Materials/Textures/baseTexture";
import { Texture } from "@babylonjs/core/Materials/Textures/texture";
import {
  buildPhotoBodyBillboards,
  buildProceduralBodyBillboards,
  partitionCelestialBodies,
  PHOTO_BODY_FRAGMENT_GLSL,
  PHOTO_BODY_FRAGMENT_WGSL,
  PHOTO_BODY_VERTEX_GLSL,
  PHOTO_BODY_VERTEX_WGSL,
  PROCEDURAL_BODY_FRAGMENT_GLSL,
  PROCEDURAL_BODY_FRAGMENT_WGSL,
  PROCEDURAL_BODY_VERTEX_GLSL,
  PROCEDURAL_BODY_VERTEX_WGSL,
  type AtlasMap,
} from "./celestial-bodies";
import {
  expDamp,
  NEBULA_MARCH,
  NEBULA_REVEAL,
  NEBULA_VOLUMES,
  nebulaGlslFragment,
  nebulaRevealTarget,
  nebulaWgslCompute,
  quatRotate,
} from "./nebula-field";
import type { Quat } from "./ship-dynamics";
import type { CelestialFigure } from "@/data/celestial/celestial.d.ts";
import {
  CRAFT_QUALITY_STORAGE_KEY,
  parseStoredQuality,
  readTierSignals,
  resolveCraftAttribute,
  type CraftTier,
} from "./craft-tier";
import { classifyDeviceTier } from "./perf-telemetry";
import {
  GOVERNOR_IDLE_STATE,
  parseTierOverride,
  QUALITY_BUDGETS,
  resolveQualityTier,
  stepGovernor,
  type GovernorState,
  type QualityBudget,
  type QualityTierName,
} from "./babylon-tiers";
import {
  DOCK_CONTACT,
  dockFade,
  dockSettleOffset,
  EMBER_BURST_START,
  EMBER_BURST_STOP,
  emberBillboards,
  EMBER_FRAGMENT_GLSL,
  EMBER_FRAGMENT_WGSL,
  emberIndices,
  EMBER_VERTEX_GLSL,
  EMBER_VERTEX_WGSL,
  flipPhase,
  MAX_EMBERS,
  plumeBuffersForWrapper,
  plumeIndices,
  plumeParamsForWarp,
  plumeParamsIdle,
  PLUME_FRAGMENT_GLSL,
  PLUME_FRAGMENT_WGSL,
  PLUME_VERTEX_GLSL,
  PLUME_VERTEX_WGSL,
  SHIMMER_FRAGMENT_GLSL,
  SHIMMER_FRAGMENT_WGSL,
  spawnEmberLocal,
} from "./babylon-ship";
import {
  ARRIVE_STANDOFF,
  bodyWorldPosition,
  CHASE_LOOK_AHEAD,
  CHASE_LOOK_LAMBDA,
  CHASE_OFFSET_REST,
  chaseOffsetAt,
  PLUME_ENGINES,
  PLUME_VERTEX_COUNT,
  PLUME_VERTEX_FLOATS,
  plumeAlpha,
  plumeFlareLength,
  plumeThrottle,
  type PlumeParams,
  quatDamp,
  quatFromAxisAngle,
  quatFromUnitVectors,
  quatMultiply,
  QUAT_IDENTITY,
  raDecToDir,
  SHIP_MAX_DT,
  SHIP_VIEW_DEPTH,
  SHIP_WARP_SCALE,
  shipScaleFactor,
  stepEmber,
  travelFrame,
  warpDurationForLy,
  warpEase,
  WARP_MIN_MS,
  type Ember,
} from "./ship-dynamics";

const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

const D2R = Math.PI / 180;

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
/** `e`'s appearance fields (t/r/c/img/sp) are optional: `placeStation` below
 * constructs a minimal synthetic entry for nav stations, which never enter
 * the GAP-01/GAP-02 render passes (those are built from `this.bodies`, i.e.
 * real `window.CELESTIAL` entries via `placeBody`, not `this.stations`). */
interface BabylonBody {
  e: {
    id: string;
    ra: number;
    dec: number;
    ly: number | null;
    t?: string;
    r?: string;
    c?: string | null;
    img?: string | null;
    sp?: string | null;
    fig?: CelestialFigure;
  };
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
  t?: string;
  r?: string;
  c?: string | null;
  img?: string | null;
  sp?: string | null;
  fig?: CelestialFigure;
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

/* --- GAP-08/GAP-10: free-look direction --------------------------------
 *
 * space-engine.js parametrizes its whole camera as
 * `fwd = [cos(pitch)*cos(yaw), cos(pitch)*sin(yaw), sin(pitch)]` — literally
 * ra/dec in radians, since its camera has no other orientation concept.
 * Reusing that formula verbatim here would make BABYLON_FORWARD ([0,0,1],
 * this camera's identity look direction) the convention's *pole*
 * (dec = 90°): idle drift already sweeps the camera off that pole by
 * rotating around UP_AXIS, so a direct port would gimbal-lock the very
 * first frame free-look is engaged. `_freeLookDir` instead parametrizes the
 * SAME two degrees of freedom as a standard yaw-then-pitch turn away from
 * BABYLON_FORWARD (yaw around UP_AXIS, pitch around the yawed local right
 * axis) — behaviourally identical (drag right looks right, drag down looks
 * down, ±83° pitch clamp) without the pole coincidence. `quatFromUnitVectors`
 * then does the same job space-engine.js's view-matrix-from-yaw/pitch does:
 * turn a direction into an orientation with no roll. */
export function freeLookDir(
  yaw: number,
  pitch: number,
): [number, number, number] {
  const cy = Math.cos(yaw),
    sy = Math.sin(yaw);
  const cp = Math.cos(pitch),
    sp = Math.sin(pitch);
  // +pitch -> +Y (up) — a "pull back to climb" flight-stick convention,
  // matching space-engine.js's own `pitch = down.pitch + dy*k` (drag down
  // increases pitch) reading as "nose up" rather than an inverted mouselook.
  return [cp * sy, sp, cp * cy];
}

/** Free-look pitch clamp — matches space-engine.js's ±1.45 rad (≈ ±83°). */
const FREE_LOOK_PITCH_LIMIT = 1.45;
/** Pointer-drag sensitivity — matches space-engine.js's `0.0022 * (70/60)`. */
const FREE_LOOK_DRAG_K = 0.0022 * (70 / 60);
/** Keyboard nudge/inertia — matches space-engine.js's arrow-key deltas and
 * per-frame velocity clamps (`_bindKeys`). */
const KEY_YAW_ACCEL = 0.006;
const KEY_YAW_MAX = 0.03;
const KEY_PITCH_ACCEL = 0.004;
const KEY_PITCH_MAX = 0.02;
/** Per-frame inertia decay for keyboard-driven look velocity — not specified
 * verbatim in the extracted source (the per-frame integrator lives outside
 * the cited ranges); a standard exponential damp consistent with every other
 * inertia/decay constant this codebase uses (e.g. `_beta *= 0.86`). */
const KEY_LOOK_DAMP = 0.9;

/** B3: shared cycle length (seconds) for the shooting-star particles — each
 * particle repeats endlessly at its own phase offset within this cycle (see
 * shooting-stars.ts). Long enough that particles don't feel synchronized,
 * short enough that the sky doesn't read as empty for long stretches. */
const SHOOTING_STAR_CYCLE_S = 5;

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
  /** B4 step 2: INTEGRATED warp progress (0..1). Advanced each frame by
   * dt/warpDur × the belt-density slow factor, so passing through the
   * asteroid field genuinely eases the ship. The single source of k for
   * camera, hull, HUD, and nebula reveal alike. */
  prog?: number;
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

/** GAP-07: idle hull bob amplitude, world units at shipScale=1 — a small
 * adaptation constant (see the _tickShip comment at its use site for why
 * this isn't a literal port of space-engine.js's NDC-space SHIP_BOB_NDC). */
const SHIP_BOB_WORLD = 0.05;

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
uniform float uBeta, uGamma; // GAP-06: relativistic aberration + Doppler
uniform vec3 uWarpDir;       // world-space unit travel direction
varying vec2 vCorner;
varying vec3 vColor;
varying float vAlpha;
varying float vType;
varying float vHalo;
${STAR_SHADER_CONSTANTS}
// GAP-06: ported from space-engine.js's STAR_VS aberrate() verbatim, but
// operating on the VIEW-SPACE position (and a view-space warp direction)
// rather than a world-space aPos - uCam — Babylon's view matrix already
// bakes in camera translation (unlike the archived engine's rotation-only
// view matrix), so the camera-relative vector aberrate() needs is already
// sitting in centre.xyz below; rotating uWarpDir by mat3(view) expresses
// the same world-space travel direction in that same space. Algebraically
// equivalent to the archived engine's world-space-then-view-matrix order,
// since aberrate() only ever consumes/produces camera-relative vectors.
vec3 aberrate(vec3 p, vec3 warpDirView){
  if (uBeta < 0.001) return p;
  float dist = length(p); vec3 d = p / dist;
  float c = dot(d, warpDirView);
  float cp = clamp((c + uBeta) / (1.0 + uBeta * c), -1.0, 1.0);
  vec3 perp = d - c * warpDirView; float pl = length(perp);
  float sp = sqrt(max(0.0, 1.0 - cp * cp));
  return (warpDirView * cp + (pl > 1e-5 ? perp * (sp / pl) : vec3(0.0))) * dist;
}
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
  vec3 warpDirView = mat3(view) * uWarpDir;
  centre.xyz = aberrate(centre.xyz, warpDirView);
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

  if (uBeta > 0.001) {
    // GAP-06: relativistic Doppler — blueshift + beaming ahead, redshift +
    // dimming astern. Verbatim port of STAR_VS's tail block.
    float cp2 = dot(centre.xyz, warpDirView) / max(dist, 1e-4);
    float D = 1.0 / (uGamma * (1.0 - uBeta * cp2));
    vColor = mix(vColor, vec3(0.60, 0.74, 1.0), clamp((D - 1.0) * 0.9, 0.0, 0.65));
    vColor = mix(vColor, vec3(1.0, 0.40, 0.26), clamp((1.0 - D) * 1.1, 0.0, 0.70));
    vAlpha *= clamp(D * D, 0.25, 2.2);
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
uniform uBeta : f32;
uniform uGamma : f32;
uniform uWarpDir : vec3<f32>;
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vAlpha : f32;
varying vType : f32;
varying vHalo : f32;

const MIN_QUAD_PX : f32 = 1.5;
const CI_UNPACK_SCALE : f32 = ${(256 / 255).toFixed(8)};

// GAP-06: line-for-line twin of the GLSL aberrate() above.
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
  var centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  let warpDirView : vec3<f32> = mat3x3<f32>(
    uniforms.view[0].xyz, uniforms.view[1].xyz, uniforms.view[2].xyz) * uniforms.uWarpDir;
  centre = vec4<f32>(aberrate(centre.xyz, warpDirView), centre.w);
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

  if (uniforms.uBeta > 0.001) {
    let cp2 : f32 = dot(centre.xyz, warpDirView) / max(dist, 1e-4);
    let D : f32 = 1.0 / (uniforms.uGamma * (1.0 - uniforms.uBeta * cp2));
    col = mix(col, vec3<f32>(0.60, 0.74, 1.0), clamp((D - 1.0) * 0.9, 0.0, 0.65));
    col = mix(col, vec3<f32>(1.0, 0.40, 0.26), clamp((1.0 - D) * 1.1, 0.0, 0.70));
    alpha = alpha * clamp(D * D, 0.25, 2.2);
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

/* Shooting stars (B3): tapered quad per particle, entirely GPU-driven — the
 * vertex shader computes each particle's current head/tail position and fade
 * purely from uTime, using the per-particle (position, dir, meta) attributes
 * built once by shooting-stars.ts. No per-frame CPU stepping or re-upload,
 * unlike the live engine's CPU-stepped ember pattern (see that file's header
 * for why). Corner winding matches star-field.ts (0,1 = head; 2,3 = tail),
 * pinned by shooting-stars.ts's cornerIsHead/particleAge/particleFade JS
 * mirrors so this arithmetic has an off-GPU check the same way the star
 * billboard corner derivation does. */
ShaderStore.ShadersStore["ijShootVertexShader"] = `
precision highp float;
attribute vec3 position;      // spawn/head-at-age-0 point
attribute vec3 starDir;       // unit direction of travel
attribute vec4 shootMeta;     // speed, length, width, seed
uniform mat4 view, projection;
uniform float uTime;
uniform float uCycleS;
varying float vAlpha;
varying float vHead;
void main(){
  int c = gl_VertexID % 4;
  bool isHead = c < 2;
  float speed = shootMeta.x, len = shootMeta.y, width = shootMeta.z, seed = shootMeta.w;
  float age = mod(uTime + seed * uCycleS, uCycleS);
  vec3 head = position + starDir * speed * age;
  vec3 base = isHead ? head : head - starDir * len;

  // "ref" is a reserved WGSL identifier (see the WGSL twin below) — named
  // refAxis here too so both twins use the same identifier for the same
  // quantity, matching the codebase's line-for-line-parallel convention.
  vec3 refAxis = abs(starDir.z) > 0.999 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 0.0, 1.0);
  vec3 right = normalize(cross(starDir, refAxis));
  float side = (c == 0 || c == 3) ? -1.0 : 1.0;
  float w = isHead ? width : width * 0.15; // taper to a near-point tail
  vec3 worldPos = base + right * side * w * 0.5;

  gl_Position = projection * view * vec4(worldPos, 1.0);

  float t = clamp(age / uCycleS, 0.0, 1.0);
  float fadeIn = clamp(t / 0.08, 0.0, 1.0);
  float fadeOut = t <= 0.65 ? 1.0 : clamp(1.0 - (t - 0.65) / 0.35, 0.0, 1.0);
  vAlpha = fadeIn * fadeOut;
  vHead = isHead ? 1.0 : 0.0;
}`;
ShaderStore.ShadersStore["ijShootFragmentShader"] = `
precision highp float;
varying float vAlpha;
varying float vHead;
void main(){
  // brighter, whiter at the head; dimmer, cooler toward the tail
  vec3 col = mix(vec3(0.75, 0.82, 1.0), vec3(1.0, 1.0, 0.98), vHead);
  gl_FragColor = vec4(col, vAlpha * mix(0.35, 0.9, vHead));
}`;

// "meta" and "ref" are RESERVED WGSL IDENTIFIERS (part of the spec's
// reserved-word list for future language extensions). Using either as an
// attribute/variable name fails shader-module creation with a
// GPUValidationError — and because Babylon submits a scene's draws in one
// command buffer, that single invalid pipeline silently blanked the ENTIRE
// frame (the star field included), not just this mesh. Caught via a real
// device's console output (`WebGPU uncaptured error ... 'meta' is a reserved
// keyword`), not by shader compilation alone — Babylon's isReady()/
// materialReady checks do not surface this class of validation failure, and
// neither TR-039's WGSL-compiles check nor the GLSL-only pixel-proof E2E
// test (bundled Chromium has no real adapter — TR-039) exercised the actual
// WGSL runtime path. See TR-045.
ShaderStore.ShadersStoreWGSL["ijShootVertexShader"] = `
attribute position : vec3<f32>;
attribute starDir : vec3<f32>;
attribute shootMeta : vec4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uTime : f32;
uniform uCycleS : f32;
varying vAlpha : f32;
varying vHead : f32;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let isHead : bool = c < 2u;
  let speed : f32 = vertexInputs.shootMeta.x;
  let len : f32 = vertexInputs.shootMeta.y;
  let width : f32 = vertexInputs.shootMeta.z;
  let seed : f32 = vertexInputs.shootMeta.w;
  let age : f32 = (uniforms.uTime + seed * uniforms.uCycleS) % uniforms.uCycleS;
  let head : vec3<f32> = vertexInputs.position + vertexInputs.starDir * speed * age;
  let base : vec3<f32> = select(head - vertexInputs.starDir * len, head, isHead);

  let refAxis : vec3<f32> = select(
    vec3<f32>(0.0, 0.0, 1.0), vec3<f32>(1.0, 0.0, 0.0), abs(vertexInputs.starDir.z) > 0.999);
  let right : vec3<f32> = normalize(cross(vertexInputs.starDir, refAxis));
  let side : f32 = select(1.0, -1.0, c == 0u || c == 3u);
  let w : f32 = select(width * 0.15, width, isHead);
  let worldPos : vec3<f32> = base + right * side * w * 0.5;

  vertexOutputs.position = uniforms.projection * uniforms.view * vec4<f32>(worldPos, 1.0);

  let t : f32 = clamp(age / uniforms.uCycleS, 0.0, 1.0);
  let fadeIn : f32 = clamp(t / 0.08, 0.0, 1.0);
  let fadeOut : f32 = select(clamp(1.0 - (t - 0.65) / 0.35, 0.0, 1.0), 1.0, t <= 0.65);
  vertexOutputs.vAlpha = fadeIn * fadeOut;
  vertexOutputs.vHead = select(0.0, 1.0, isHead);
}`;
ShaderStore.ShadersStoreWGSL["ijShootFragmentShader"] = `
varying vAlpha : f32;
varying vHead : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let col : vec3<f32> = mix(
    vec3<f32>(0.75, 0.82, 1.0), vec3<f32>(1.0, 1.0, 0.98), fragmentInputs.vHead);
  fragmentOutputs.color = vec4<f32>(col, fragmentInputs.vAlpha * mix(0.35, 0.9, fragmentInputs.vHead));
}`;

/* Volumetric nebulae (B3): the raymarch itself lives in generated sources —
 * see nebula-field.ts for the architecture (tier-gated producer, half-res
 * texture) and why volume constants are baked rather than uniforms. Only the
 * WebGL2 producer registers here (the WGSL compute source is handed straight
 * to ComputeShader, not the ShaderStore). */
ShaderStore.ShadersStore["ijNebulaFragmentShader"] = nebulaGlslFragment();

/* Composite pass: one fullscreen triangle adds the nebula texture over the
 * scene. Twins follow the same line-for-line convention as the pairs above.
 * Fragment outputs alpha 1.0 so ALPHA_ADD contributes rgb exactly once
 * (the accumulated emission is already premultiplied by the march).
 * V-orientation: the GLSL pair uses no flip anywhere; the WGSL pair flips V
 * both when producing (compute, row 0 = top) and when sampling here — each
 * backend pair is self-consistent (see nebula-field.ts). */
ShaderStore.ShadersStore["ijNebulaCompositeVertexShader"] = `
precision highp float;
attribute vec3 position;   // clip-space fullscreen triangle
varying vec2 vClip;
void main(){
  gl_Position = vec4(position.xy, 0.5, 1.0);
  vClip = position.xy;
}`;
ShaderStore.ShadersStore["ijNebulaCompositeFragmentShader"] = `
precision highp float;
uniform sampler2D uNebulaTex;
varying vec2 vClip;
void main(){
  vec2 uv = vClip * 0.5 + 0.5;
  vec3 col = texture2D(uNebulaTex, uv).rgb;
  gl_FragColor = vec4(col, 1.0);
}`;
ShaderStore.ShadersStoreWGSL["ijNebulaCompositeVertexShader"] = `
attribute position : vec3<f32>;
varying vClip : vec2<f32>;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  vertexOutputs.position = vec4<f32>(vertexInputs.position.xy, 0.5, 1.0);
  vertexOutputs.vClip = vertexInputs.position.xy;
}`;
ShaderStore.ShadersStoreWGSL["ijNebulaCompositeFragmentShader"] = `
varying vClip : vec2<f32>;
var uNebulaTex : texture_2d<f32>;
var uNebulaTexSampler : sampler;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let uv : vec2<f32> = vec2<f32>(
    fragmentInputs.vClip.x * 0.5 + 0.5,
    0.5 - fragmentInputs.vClip.y * 0.5);
  let col : vec3<f32> = textureSample(uNebulaTex, uNebulaTexSampler, uv).rgb;
  fragmentOutputs.color = vec4<f32>(col, 1.0);
}`;

/* Ship track (B3, owner-unblocked): thruster plume twins + the heat-shimmer
 * refraction post-pass. Sources live in babylon-ship.ts (plume colours baked
 * from ship-dynamics' PLUME_CORE/PLUME_SHEATH for live-engine parity). */
ShaderStore.ShadersStore["ijPlumeVertexShader"] = PLUME_VERTEX_GLSL;
ShaderStore.ShadersStore["ijPlumeFragmentShader"] = PLUME_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijPlumeVertexShader"] = PLUME_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijPlumeFragmentShader"] = PLUME_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijShimmerFragmentShader"] = SHIMMER_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijShimmerFragmentShader"] = SHIMMER_FRAGMENT_WGSL;
// GAP-07: ember sparks — see babylon-ship.ts's header.
ShaderStore.ShadersStore["ijEmberVertexShader"] = EMBER_VERTEX_GLSL;
ShaderStore.ShadersStore["ijEmberFragmentShader"] = EMBER_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijEmberVertexShader"] = EMBER_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijEmberFragmentShader"] = EMBER_FRAGMENT_WGSL;
// GAP-01/GAP-02: curated celestial bodies — see celestial-bodies.ts's header.
ShaderStore.ShadersStore["ijBodyVertexShader"] = PROCEDURAL_BODY_VERTEX_GLSL;
ShaderStore.ShadersStore["ijBodyFragmentShader"] =
  PROCEDURAL_BODY_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijBodyVertexShader"] =
  PROCEDURAL_BODY_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijBodyFragmentShader"] =
  PROCEDURAL_BODY_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijPhotoBodyVertexShader"] = PHOTO_BODY_VERTEX_GLSL;
ShaderStore.ShadersStore["ijPhotoBodyFragmentShader"] =
  PHOTO_BODY_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijPhotoBodyVertexShader"] =
  PHOTO_BODY_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijPhotoBodyFragmentShader"] =
  PHOTO_BODY_FRAGMENT_WGSL;
// GAP-03/04/05 — see milky-way.ts / constellations.ts / star-trails.ts headers.
ShaderStore.ShadersStore["ijMilkyWayVertexShader"] = MILKY_WAY_VERTEX_GLSL;
ShaderStore.ShadersStore["ijMilkyWayFragmentShader"] = MILKY_WAY_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijMilkyWayVertexShader"] = MILKY_WAY_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijMilkyWayFragmentShader"] =
  MILKY_WAY_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijConstellationVertexShader"] =
  CONSTELLATION_VERTEX_GLSL;
ShaderStore.ShadersStore["ijConstellationFragmentShader"] =
  CONSTELLATION_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijConstellationVertexShader"] =
  CONSTELLATION_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijConstellationFragmentShader"] =
  CONSTELLATION_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijStarTrailVertexShader"] = STAR_TRAIL_VERTEX_GLSL;
ShaderStore.ShadersStore["ijStarTrailFragmentShader"] =
  STAR_TRAIL_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijStarTrailVertexShader"] =
  STAR_TRAIL_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijStarTrailFragmentShader"] =
  STAR_TRAIL_FRAGMENT_WGSL;

async function createEngine(canvas: HTMLCanvasElement): Promise<{
  engine: AbstractEngine;
  backend: "webgpu" | "webgl2";
}> {
  // WebGPU primary — only where the browser actually has it (real devices).
  // PROBE the adapter BEFORE constructing WebGPUEngine: initAsync on an
  // adapterless browser logs a Babylon ERROR ("fatal error during WebGPU
  // creation") before we can fall back — which, post-cutover, every
  // non-WebGPU visitor would see and the strict page-load console spec
  // rightly fails on. A null probe falls back silently instead (TR-053).
  const gpu = (
    navigator as Navigator & {
      gpu?: { requestAdapter(): Promise<unknown | null> };
    }
  ).gpu;
  let adapter: unknown = null;
  if (gpu) {
    try {
      adapter = await gpu.requestAdapter();
    } catch {
      adapter = null;
    }
  }
  if (adapter) {
    try {
      // engine.computeShader is a SIDE-EFFECT extension module: it patches
      // createComputeContext/computeDispatch onto WebGPUEngine's prototype.
      // webgpuEngine.js auto-imports engine.rawTexture (storage textures) but
      // NOT this one — without it, `new ComputeShader(...)` throws
      // "createComputeContext is not a function" at B3's nebula setup and the
      // whole render loop dies. Loaded dynamically alongside the engine so
      // WebGPU code stays out of the eager WebGL2 bundle.
      const [{ WebGPUEngine }] = await Promise.all([
        import("@babylonjs/core/Engines/webgpuEngine"),
        import("@babylonjs/core/Engines/WebGPU/Extensions/engine.computeShader"),
      ]);
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
  /** Stored so pick/projection helpers (called outside the render loop's own
   * closure, e.g. from pointer/keyboard handlers) can reach the camera. */
  private _camera?: FreeCamera;
  private _stars?: Mesh;
  private _starMat?: ShaderMaterial;
  private _shootMesh?: Mesh;
  // --- GAP-01/GAP-02: curated celestial bodies ---
  private _bodyMesh?: Mesh;
  private _bodyMat?: ShaderMaterial;
  private _photoMesh?: Mesh;
  private _photoMat?: ShaderMaterial;
  private _photoTex?: Texture;
  private _bodyCount = 0;
  private _photoBodyCount = 0;
  // --- GAP-03: Milky Way band ---
  private _bandMesh?: Mesh;
  private _bandMat?: ShaderMaterial;
  private _bandTex?: RawTexture;
  /** 1x1 stand-in bound until the real equirect texture finishes building —
   * see _setupMilkyWay's WebGPU regression note. Disposed once swapped out. */
  private _bandPlaceholderTex?: RawTexture;
  private _bandBuf?: Uint8Array;
  private _bandRow = 0;
  private _bandReady = false;
  private _bandFadeAmt = 0;
  // --- GAP-04: constellation figures ---
  private _conMesh?: Mesh;
  private _conMat?: ShaderMaterial;
  private _conCount = 0;
  // --- GAP-05: warp star trails ---
  private _trailMesh?: Mesh;
  private _trailMat?: ShaderMaterial;
  private _camPrevTrail: [number, number, number] = [0, 0, 0];
  private _trailWarpSpeed = 0;
  // --- volumetric nebulae (B3) ---
  private _nebulaMode: "compute" | "fragment" | null = null;
  private _nebulaTex?: BaseTexture;
  private _nebulaCS?: ComputeShader;
  private _nebulaUbo?: UniformBuffer;
  private _nebulaProc?: ProceduralTexture;
  private _nebulaMat?: ShaderMaterial;
  private _nebulaMesh?: Mesh;
  private _nebulaW = 0;
  private _nebulaH = 0;
  /** Scratch Vector3s for per-frame ProceduralTexture uniform pushes —
   * allocated once, not per frame. */
  private _nebulaScratch = [
    new Vector3(),
    new Vector3(),
    new Vector3(),
    new Vector3(),
  ];
  /** Destination-gated reveal state, one factor per NEBULA_VOLUMES entry
   * (owner direction 2026-07-19: gas fades in during the decel burn and
   * swells at arrival — see nebula-field.ts NEBULA_REVEAL). */
  private _nebulaReveal = [0, 0, 0, 0];
  private _nebulaScratch4 = new Vector4(0, 0, 0, 0);
  /** Stamp of when the ship stopped at a nebula volume (drives the swell). */
  private _nebulaArriveId: string | null = null;
  private _nebulaArriveAt = 0;
  /** Last frame's dt (seconds), written by _tickWarp for _tickNebula. */
  private _dtS = 1 / 60;
  /** Wall-clock dt for warp-progress integration (capped at 0.5 s, NOT
   * SHIP_MAX_DT-clamped — see _tickWarp). */
  private _dtWarpS = 1 / 60;
  // --- ship track (B3: hull + thrusters + shimmer + docking polish) ---
  private _ship?: TransformNode;
  private _shipMeshes: AbstractMesh[] = [];
  private _shipState: "off" | "loading" | "ready" | "failed" = "off";
  private _shipTier: CraftTier | null = null;
  private _shipScale = 1;
  private _shipVisible = 0;
  private _shipQuat: Quat = QUAT_IDENTITY;
  private _shipDockId: string | null = null;
  private _shipDockAt = 0;
  private _plumeMesh?: Mesh;
  private _plumeMat?: ShaderMaterial;
  private _plumePos = new Float32Array(PLUME_VERTEX_COUNT * 3);
  private _plumeMeta = new Float32Array(PLUME_VERTEX_COUNT * 2);
  private _plumeScratch = new Float32Array(
    PLUME_VERTEX_COUNT * PLUME_VERTEX_FLOATS,
  );
  private _shimmer?: PostProcess;
  // --- GAP-07: ember sparks ---
  private _embers: Ember[] = [];
  private _burnPrev = false;
  private _emberMesh?: Mesh;
  private _emberMat?: ShaderMaterial;
  private _emberPos = new Float32Array(MAX_EMBERS * 4 * 3);
  private _emberMeta = new Float32Array(MAX_EMBERS * 4 * 2);
  /** Shimmer uniforms staged by _tickShip, pushed in the post-process's
   * onApply (the effect object is only valid there). */
  private _shimmerState = { cx: 0.5, cy: 0.5, intensity: 0, aspect: 1 };
  // --- B4 step 1: Havok asteroid field ---
  /** havok = live rigid bodies; visual = kinematic drift (no SIMD, init
   * failure, or reduced motion — the plan's render-without-physics tier). */
  private _physicsMode: "off" | "loading" | "havok" | "visual" | "failed" =
    "off";
  private _asteroidField?: AsteroidField;
  private _asteroidInstances: InstancedMesh[] = [];
  private _asteroidBodies: PhysicsBody[] = [];
  /** Scratch position/velocity for the visual-only integrator. */
  private _asteroidPos?: Float32Array;
  private _asteroidVel?: Float32Array;
  private _asteroidPull = new Vector3();
  // --- B4 step 2: proximity slowdown + passage deflection ---
  /** Current warp slow factor (1 = clear space) and the journey's minimum
   * (reset at launch) — the E2E proof that a belt crossing actually slowed
   * the ship. */
  private _warpSlow = 1;
  private _warpSlowMin = 1;
  /** Virtual-ship world position stashed by _tickWarp for the deflection
   * pass (avoids recomputing the eased path in _tickAsteroids). */
  private _shipWorld: [number, number, number] | null = null;
  // --- B4 step 3+4: impact camera shake + docking contact ---
  /** Current shake amplitude (world units), decayed each frame. Fed by
   * asteroid collision impulses and the docking-contact bump. */
  private _shakeAmp = 0;
  /** Impacts strong enough to shake (diagnostic; persists for the session). */
  private _impactCount = 0;
  /** True once collision callbacks are attached to every Havok body. */
  private _collisionWired = false;
  /** Berth pose + approach axis captured at dock start (settle oscillation
   * displaces the hull along this axis relative to the base). */
  private _dockBase: [number, number, number] | null = null;
  private _dockDir: [number, number, number] | null = null;
  private _ro?: ResizeObserver;
  private _init = false;
  private _lastFrameMs?: number;
  private _camQuat: Quat = QUAT_IDENTITY;
  /** One-shot snapshot at boot — same pattern as space-engine.js's own
   * `this.reduced`, not a live-updating listener. */
  private _reduced = false;
  /** GAP-14: render-loop frame counter, used only to throttle the
   * cosmos:aim readout to every 8th frame — matches space-engine.js's
   * `this._frame % 8 === 0` exactly. */
  private _frameCount = 0;
  // --- GAP-08/GAP-10: free-look (pointer drag + keyboard) ---
  /** Free-look orientation, radians. yaw/pitch parametrize a look direction
   * the same way ship-dynamics.ts's `raDecToDir` parametrizes ra/dec, but
   * around BABYLON_FORWARD (not a literal ra/dec — see `_freeLookDir`'s
   * header comment for why a literal port of the live engine's yaw/pitch
   * convention would gimbal-lock at this camera's identity forward). */
  private _yaw = 0;
  private _pitch = 0;
  private _velYaw = 0;
  private _velPitch = 0;
  /** True from pointerdown to pointerup/cancel — while true, free-look
   * yaw/pitch is authoritative over orientation even mid-warp (GAP-08). */
  private _dragging = false;
  private _dragStart: {
    x: number;
    y: number;
    yaw: number;
    pitch: number;
    t: number;
  } | null = null;
  private _dragMoved = 0;
  /** GAP-09/GAP-16: hover picking state. */
  private _hoverId: string | null = null;
  /** Throttle counter for the expensive O(starCount) field-star cone test —
   * matches space-engine.js's `this._fp` exactly (every-other pick attempt
   * runs the field test; the other holds the previous field hover). */
  private _fp = 0;
  /** The decoded star field, kept for fieldInfo()/field-star picking — not
   * needed by the render path itself (that reads the GPU billboard mesh),
   * only by hover/pick, which is why it's stored separately here rather than
   * threaded through _tickWarp etc. */
  private _field: {
    positions: Float32Array;
    meta: Float32Array;
    count: number;
  } | null = null;
  // --- GAP-06: relativistic aberration + Doppler ---
  /** Brachistochrone-profile beta (v/c), integrated from warp.prog exactly
   * like space-engine.js's `this._beta` — ramps with the accel/decel curve
   * during warp, decays 0.86x/frame otherwise. */
  private _beta = 0;
  // --- GAP-12: HTML attribute overrides ---
  private _densityOverride = 1;
  private _showConstellations = true;
  private _showShip = true;
  private _craftAttr: CraftTier | "off" | null = null;
  // --- GAP-13: scroll-linked render cadence ---
  private _scrollSkip = false;
  private _scrollFrameParity = 0;
  // --- GAP-21: adaptive quality governor ---
  private _govState: GovernorState = GOVERNOR_IDLE_STATE;
  private _govLastT: number | null = null;
  private _badge?: HTMLDivElement;

  // --- SpaceEngineElement contract surface ---
  bodies: BabylonBody[] = [];
  stations: BabylonBody[] = [];
  cam: [number, number, number] = [0, 0, 0];
  arrivedId: string | null = null;
  warp: BabylonWarp = { mode: "idle" };
  backend: "webgpu" | "webgl2" | null = null;
  starCount = 0;
  /** B5: the resolved quality budget — every feature knob reads from here.
   * Set in _boot the moment the backend is known; safe default until then. */
  private _quality: QualityBudget = resolveQualityTier("webgl2", "mid");
  /** Which star data actually rendered — a procedural fallback must never be
   * mistaken for the real catalog in a measurement or a screenshot. */
  starSource: "catalog" | "procedural" | null = null;
  /** Frames this engine has actually rendered (read by the perf harness). */
  renderFrames = 0;

  // --- GAP-12: HTML attribute parity with space-engine.js's
  // observedAttributes/attributeChangedCallback (density/constellations/
  // ship/craft) ---
  static get observedAttributes() {
    return ["density", "constellations", "ship", "craft"];
  }

  attributeChangedCallback(
    name: string,
    _old: string | null,
    value: string | null,
  ) {
    if (name === "density") {
      this._densityOverride = Math.max(
        0.05,
        Math.min(1, parseFloat(value ?? "") || 1),
      );
      this._applyDensity();
    } else if (name === "constellations") {
      this._showConstellations = value !== "off";
      this._conMesh?.setEnabled(this._showConstellations);
    } else if (name === "ship") {
      this._showShip = value !== "off";
    } else if (name === "craft") {
      this._craftAttr =
        value === "1k" || value === "2k"
          ? value
          : value === "off"
            ? "off"
            : null;
    }
  }

  /** Reduces how many of the star mesh's indices actually draw, matching
   * space-engine.js's `density` attribute in spirit (fewer stars, not a
   * uniform statistical resample — the live engine's own exact decimation
   * algorithm sits outside this gap's ported source ranges). A no-op until
   * the star mesh exists; `_boot` calls this once after building it, so a
   * `density` attribute already present in markup at connect time still
   * applies on first frame. */
  private _applyDensity() {
    const mesh = this._stars;
    if (!mesh) return;
    const sub = mesh.subMeshes?.[0];
    if (!sub) return;
    const total = mesh.getTotalIndices();
    sub.indexCount = Math.max(
      6,
      Math.floor(
        total * this._densityOverride - ((total * this._densityOverride) % 6),
      ),
    );
  }

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

    // B6 accessibility re-audit fix: Babylon's engine sets tabindex="1" on
    // its canvas — a POSITIVE tabindex that hijacks the page tab order
    // (canvas would focus before the skip link; axe flags it serious). This
    // path has no canvas-level keyboard interaction (all input rides the
    // shared chrome), so the canvas leaves the tab order entirely.
    canvas.tabIndex = -1;

    // B5: resolve the quality tier ONCE, from the backend that actually
    // initialized + the same device classifier the perf HUD reports, with a
    // ?tier= override mirroring the ?craft= pattern. Every knob below reads
    // this budget — no more per-feature ad-hoc tiering.
    this._quality = resolveQualityTier(
      backend,
      classifyDeviceTier(readTierSignals(window)),
      parseTierOverride(
        new URLSearchParams(window.location.search).get("tier"),
      ),
    );

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
    this._camera = camera;

    // B2 step 3: real catalog bodies, so travelTo/randomBody have real
    // targets. window.CELESTIAL is guaranteed populated by mount time —
    // SpaceScene.tsx imports this module and all five celestial-*.js data
    // files in one Promise.all and only renders <babylon-scene> after every
    // one resolves (each populates window.CELESTIAL synchronously on import).
    this.bodies = (window.CELESTIAL ?? []).map((e) =>
      placeBody({
        id: e.id,
        ra: e.ra,
        dec: e.dec,
        ly: e.ly,
        t: e.t,
        r: e.r,
        c: e.c,
        img: e.img,
        sp: e.sp,
        fig: e.fig,
      }),
    );

    const { field, source } = await loadStarField();
    const bb = buildStarBillboards(field);
    this.starCount = field.count;
    this.starSource = source;
    // GAP-09/GAP-16: kept for fieldInfo()/field-star hover picking.
    this._field = field;

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
        uniforms: [
          "view",
          "projection",
          "uViewport",
          "uSize",
          "uHaloAmp",
          "uBeta",
          "uGamma",
          "uWarpDir",
        ],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    // uSize = devicePixelRatio, matching the live engine, so a star subtends the
    // same CSS size on a HiDPI panel as on a 1x one.
    mat.setFloat("uSize", window.devicePixelRatio || 1);
    // Halo/bloom tier-gated exactly like the live engine (0 / 0.55 / 1) —
    // the B5 quality budget finally honours it on this path.
    mat.setFloat("uHaloAmp", this._quality.haloAmp);
    const pushViewport = () =>
      mat.setVector2(
        "uViewport",
        new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
      );
    pushViewport();
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;
    this._starMat = mat; // GAP-06: aberration/Doppler uniforms pushed here
    this._applyDensity(); // GAP-12: honour a `density` attribute set before boot finished

    // B3: GPU-particle idle shooting stars — new work, not a port (the live
    // engine has no equivalent). See shooting-stars.ts's header for why this
    // is fully GPU-driven (zero per-frame CPU cost after this setup).
    const shoot = buildShootingStars(this._quality.shootingStars);
    const shootMesh = new Mesh("shootingStars", scene);
    this._shootMesh = shootMesh;
    const shootVd = new VertexData();
    shootVd.positions = shoot.positions;
    shootVd.indices = shoot.indices;
    shootVd.applyToMesh(shootMesh, false);
    shootMesh.setVerticesBuffer(
      new VertexBuffer(engine, shoot.dirs, "starDir", false, false, 3),
    );
    shootMesh.setVerticesBuffer(
      new VertexBuffer(engine, shoot.meta, "shootMeta", false, false, 4),
    );
    shootMesh.alwaysSelectAsActiveMesh = true;
    const shootMat = new ShaderMaterial(
      "shootingStars",
      scene,
      { vertex: "ijShoot", fragment: "ijShoot" },
      {
        attributes: ["position", "starDir", "shootMeta"],
        uniforms: ["view", "projection", "uTime", "uCycleS"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    shootMat.setFloat("uCycleS", SHOOTING_STAR_CYCLE_S);
    shootMat.backFaceCulling = false;
    shootMat.alphaMode = Constants.ALPHA_ADD;
    shootMesh.material = shootMat;

    // GAP-01/GAP-02: curated celestial bodies. Fetches the small atlas-map
    // JSON (same fallback philosophy as loadStarField: a fetch failure
    // degrades every body to procedural rather than blanking the sky) before
    // building geometry, so the split is correct on the first frame; the
    // 3.4 MB atlas TEXTURE itself is not awaited (Babylon loads it in the
    // background and reports readiness via isReady(), same as the craft GLB
    // never delaying cosmos:ready).
    await this._setupCelestialBodies(scene, engine, backend);

    // GAP-03/04/05: galactic band, constellation figures, warp star trails.
    // Synchronous, cheap geometry/material setup — the band's actual texture
    // fills in progressively via _tickMilkyWay (see that method).
    this._setupMilkyWay(scene, backend);
    this._setupConstellations(scene, backend);
    this._setupStarTrails(scene, engine, backend, field);

    // B3: volumetric nebulae — tier-gated producer (WebGPU compute / WebGL2
    // ProceduralTexture) + shared fullscreen composite. See nebula-field.ts.
    this._setupNebula(scene, engine, backend);

    // B3 ship track: async, deliberately NOT awaited — a slow/failed GLB
    // fetch must never delay cosmos:ready or blank the sky (same philosophy
    // as the catalog's procedural fallback).
    void this._setupShip(scene, engine, backend, camera);

    // B4 step 1: Havok asteroid field — lazy WASM, SIMD-gated, non-blocking.
    void this._setupPhysics(scene);

    // GAP-08/GAP-10: free-look input. Canvas stays out of the tab order
    // (tabIndex=-1, see above); `this` is the keyboard-focus target.
    this._bindPointer(canvas);
    this._bindKeys();

    let first = true;
    engine.runRenderLoop(() => {
      // GAP-08/GAP-10 regression guard, moved to the TOP of the frame (GAP-21):
      // Babylon's deferred input setup re-stamps tabindex="1" post-boot (the
      // original B6 a11y fix) on whichever later frame its own lazy pointer
      // setup happens to run — not a one-shot. This used to sit at the
      // bottom of the loop, after every tick and scene.render(); GAP-21's
      // governor added real synchronous GPU work (texture/post-process
      // dispose+create) that lands only on the frame a tier actually
      // changes, and under sustained load that's enough to push a frame's
      // completion late — including, on one sequential-suite run, late
      // enough that axe's DOM scan (no extra wait beyond mount) sampled a
      // frame before the reassert had run. Correctness here must not depend
      // on how long the rest of the frame takes, so it runs first,
      // unconditionally, before any tick that could be slow or throw.
      if (canvas.tabIndex !== -1) canvas.tabIndex = -1;
      // GAP-13 (scoped): space-engine.js's four screen-space flight stations
      // (warping / corner-escort / parked-under-dossier / hero) choreograph
      // a 2D sprite's NDC position and don't have a clean analogue here — the
      // Babylon ship is a real 3D mesh flown by the chase camera (GAP-11's
      // header notes the same architecture split for station markers). What
      // DOES port cleanly, and is a genuine perf win, is the live engine's
      // other scroll behaviour: halving the render cadence once the visitor
      // has scrolled the scene mostly out of view and nothing is in flight.
      // Named here rather than silently dropped — see the GAP-13 TR for the
      // full scope note.
      const scrolledAway = (window.scrollY || 0) > window.innerHeight * 0.55;
      this._scrollSkip = scrolledAway && this.warp.mode === "idle";
      if (this._scrollSkip) this._scrollFrameParity ^= 1;
      else this._scrollFrameParity = 0;
      // GAP-21: adaptive quality governor — was boot-once (B5); now demotes/
      // promotes on sustained frame-time pressure, matching space-engine.js.
      this._tickGovernor(performance.now(), scrolledAway);

      this._tickWarp(camera);
      this._tickMilkyWay();
      this._tickTrails();
      this._tickNebula(camera, engine);
      this._tickShip(camera, engine);
      this._tickAsteroids();
      this._tickStations(camera, engine); // GAP-11
      shootMat.setFloat("uTime", performance.now() / 1000);
      const bodyT = this._reduced ? 0 : performance.now() / 1000;
      this._bodyMat?.setFloat("uTime", bodyT);
      this._photoMat?.setFloat("uTime", bodyT);
      // GAP-14: aim readout, throttled to every 8th frame — matches
      // space-engine.js's `this._frame % 8 === 0` exactly. Reads the
      // camera's ACTUAL current forward direction (idle drift, free-look,
      // or warp chase-look all converge here) rather than tracking a
      // separate yaw/pitch source of truth, so it is correct regardless of
      // which of those is driving orientation this frame.
      this._frameCount = (this._frameCount + 1) | 0;
      if (this._frameCount % 8 === 0) {
        const fwd = quatRotate(this._camQuat, BABYLON_FORWARD);
        const ra = (((Math.atan2(fwd[1], fwd[0]) / D2R) % 360) + 360) % 360;
        const dec = Math.asin(Math.max(-1, Math.min(1, fwd[2]))) / D2R;
        emit("cosmos:aim", { ra, dec, warp: this.warp.mode });
      }
      // GAP-13: skip every other draw once scrolled away and idle — ticks
      // above still ran (camera/warp state must stay correct so travel
      // triggered while scrolled resumes cleanly), only the GPU draw itself
      // is skipped.
      if (!this._scrollSkip || this._scrollFrameParity === 0) {
        scene.render();
        this.renderFrames++; // engine-side proof the scene is actually drawing
      }
      if (first) {
        first = false;
        emit("cosmos:progress", { loaded: field.count, total: field.count });
        emit("cosmos:ready", {});
      }
    });

    this._ro = new ResizeObserver(() => {
      engine.resize();
      pushViewport(); // px-sized billboards depend on the render target size
      const vp = new Vector2(engine.getRenderWidth(), engine.getRenderHeight());
      this._bodyMat?.setVector2("uViewport", vp);
      this._photoMat?.setVector2("uViewport", vp);
      this._emberMat?.setVector2("uViewport", vp); // GAP-07
      this._resizeNebula(engine); // half-res producer tracks the target size
    });
    this._ro.observe(this);

    const badge = document.createElement("div");
    badge.textContent = this._badgeText();
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
    this._badge = badge; // GAP-21: kept live so tier changes update the label
  }

  /** Builds the corner debug badge text from current instance state — a
   * standalone method so GAP-21's governor can refresh the tier substring
   * after a live demote/promote without duplicating the format string. */
  private _badgeText(): string {
    return (
      `BABYLON ${(this.backend ?? "").toUpperCase()} · ${this.starCount.toLocaleString()} STARS` +
      `${this.starSource === "procedural" ? " (PLACEHOLDER)" : ""}` +
      ` · ${this._bodyCount + this._photoBodyCount} BODIES (${this._photoBodyCount} PHOTO)` +
      ` · ${this._quality.name.toUpperCase()} · PF-09 B6`
    );
  }

  disconnectedCallback() {
    this._ro?.disconnect();
    this._engine?.dispose();
  }

  /** Render diagnostics — used by CI's pixel/geometry assertions and handy on
   * the owner's devices during the B1 gate measurement. */
  sceneStats() {
    const m = this._stars;
    const shoot = this._shootMesh;
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
      // B3: shooting-star particle diagnostics.
      shootMeshReady: shoot ? shoot.isReady(true) : false,
      shootTotalVertices: shoot ? shoot.getTotalVertices() : -1,
      shootTotalIndices: shoot ? shoot.getTotalIndices() : -1,
      shootMaterialReady: shoot?.material
        ? shoot.material.isReady(shoot)
        : false,
      // GAP-01/GAP-02: curated celestial body diagnostics.
      bodyCount: this._bodyCount,
      bodyMeshReady: this._bodyMesh ? this._bodyMesh.isReady(true) : false,
      bodyMaterialReady: this._bodyMesh?.material
        ? this._bodyMesh.material.isReady(this._bodyMesh)
        : false,
      photoBodyCount: this._photoBodyCount,
      photoBodyMeshReady: this._photoMesh
        ? this._photoMesh.isReady(true)
        : false,
      photoBodyMaterialReady: this._photoMesh?.material
        ? this._photoMesh.material.isReady(this._photoMesh)
        : false,
      photoBodyTextureReady: this._photoTex?.isReady() ?? false,
      // GAP-03: Milky Way band diagnostics.
      bandReady: this._bandReady,
      bandFade: Math.round(this._bandFadeAmt * 1000) / 1000,
      bandTextureReady: this._bandTex?.isReady() ?? false,
      bandMeshReady: this._bandMesh ? this._bandMesh.isReady(true) : false,
      // GAP-04: constellation figure diagnostics.
      constellationSegments: this._conCount,
      constellationMeshReady: this._conMesh
        ? this._conMesh.isReady(true)
        : false,
      // GAP-05: warp star trail diagnostics.
      trailWarpSpeed: Math.round(this._trailWarpSpeed * 1000) / 1000,
      trailVisible: this._trailMesh?.isVisible ?? false,
      trailMeshReady: this._trailMesh ? this._trailMesh.isReady(true) : false,
      // B3: volumetric nebula diagnostics.
      nebulaMode: this._nebulaMode,
      nebulaVolumes: NEBULA_VOLUMES.length,
      nebulaTexWidth: this._nebulaW,
      nebulaTexHeight: this._nebulaH,
      nebulaProducerReady:
        this._nebulaMode === "compute"
          ? (this._nebulaCS?.isReady() ?? false)
          : (this._nebulaProc?.isReady() ?? false),
      nebulaCompositeReady:
        this._nebulaMat && this._nebulaMesh
          ? this._nebulaMat.isReady(this._nebulaMesh)
          : false,
      // destination-gated reveal factors, by NEBULA_VOLUMES order
      nebulaReveal: this._nebulaReveal.map((x) => Math.round(x * 1000) / 1000),
      // B3 ship track diagnostics.
      shipState: this._shipState,
      shipTier: this._shipTier,
      shipVisible: Math.round(this._shipVisible * 1000) / 1000,
      plumeReady:
        this._plumeMat && this._plumeMesh
          ? this._plumeMat.isReady(this._plumeMesh)
          : false,
      shimmerReady: this._shimmer?.getEffect()?.isReady() ?? false,
      // B4 step 1: asteroid-field diagnostics.
      physicsMode: this._physicsMode,
      asteroidCount: this._asteroidInstances.length,
      physicsBodies: this._asteroidBodies.length,
      // first body's live position (rounded) — lets E2E prove real motion
      asteroidSample: this._asteroidInstances[0]
        ? [
            Math.round(this._asteroidInstances[0].position.x * 100) / 100,
            Math.round(this._asteroidInstances[0].position.y * 100) / 100,
            Math.round(this._asteroidInstances[0].position.z * 100) / 100,
          ]
        : null,
      // B4 step 2: proximity-slowdown diagnostics. warpSlowMin persists past
      // arrival so E2E can prove a belt crossing eased the journey.
      warpSlow: Math.round(this._warpSlow * 1000) / 1000,
      warpSlowMin: Math.round(this._warpSlowMin * 1000) / 1000,
      // B4 step 3+4: impact-shake / docking-contact diagnostics.
      collisionWired: this._collisionWired,
      impactCount: this._impactCount,
      shakeAmp: Math.round(this._shakeAmp * 1000) / 1000,
      // B5: the resolved quality tier and its key applied budgets.
      qualityTier: this._quality.name,
      haloAmp: this._quality.haloAmp,
      shootCount: this._quality.shootingStars,
    };
  }

  // --- GAP-01/GAP-02: curated celestial bodies ---

  /** Builds both billboard passes over `this.bodies` (already placed by
   * placeBody at this point): a procedural per-type beacon mesh (GAP-01,
   * every body) and, for the subset with a real atlas cell, a photographic
   * mesh sampling the shipped atlas.jpg (GAP-02). See celestial-bodies.ts's
   * header for the full design rationale and the implementation guardrail
   * this follows. */
  private async _setupCelestialBodies(
    scene: Scene,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
  ) {
    let atlasMap: AtlasMap | null = null;
    try {
      const res = await fetch("/assets/atlas-map.json");
      if (res.ok) atlasMap = (await res.json()) as AtlasMap;
    } catch (e) {
      // Same fallback philosophy as loadStarField: a missing/broken atlas map
      // degrades every body to procedural rather than blanking anything.
      console.warn(
        "[babylon-engine] atlas-map fetch failed, all bodies render procedurally",
        e,
      );
    }

    const { procedural, photo } = partitionCelestialBodies(
      this.bodies,
      atlasMap,
    );
    this._bodyCount = procedural.length;
    this._photoBodyCount = photo.length;

    const bb = buildProceduralBodyBillboards(
      procedural.map((b) => ({
        id: b.e.id,
        pos: b.pos,
        t: b.e.t ?? "star",
        r: b.e.r ?? "common",
        c: b.e.c ?? null,
        sp: b.e.sp ?? null,
      })),
    );
    const bodyMesh = new Mesh("celestialBodies", scene);
    this._bodyMesh = bodyMesh;
    const bodyVd = new VertexData();
    bodyVd.positions = bb.positions;
    bodyVd.indices = bb.indices;
    bodyVd.applyToMesh(bodyMesh, false);
    bodyMesh.setVerticesBuffer(
      new VertexBuffer(engine, bb.meta, "bodyMeta", false, false, 4),
    );
    bodyMesh.alwaysSelectAsActiveMesh = true;
    const bodyMat = new ShaderMaterial(
      "celestialBodies",
      scene,
      { vertex: "ijBody", fragment: "ijBody" },
      {
        attributes: ["position", "bodyMeta"],
        uniforms: [
          "view",
          "projection",
          "uViewport",
          "uTime",
          "uBeta",
          "uGamma",
          "uWarpDir",
        ],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    bodyMat.backFaceCulling = false;
    bodyMat.alphaMode = Constants.ALPHA_ADD;
    bodyMat.setVector2(
      "uViewport",
      new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
    );
    bodyMesh.material = bodyMat;
    this._bodyMat = bodyMat;

    if (photo.length === 0) return;

    const pb = buildPhotoBodyBillboards(
      photo.map((b) => ({
        id: b.e.id,
        pos: b.pos,
        t: b.e.t ?? "nebula",
        r: b.e.r ?? "common",
        sp: b.e.sp ?? null,
        cell: b.cell,
        index: b.index,
      })),
    );
    const photoMesh = new Mesh("celestialBodyPhotos", scene);
    this._photoMesh = photoMesh;
    const photoVd = new VertexData();
    photoVd.positions = pb.positions;
    photoVd.indices = pb.indices;
    photoVd.applyToMesh(photoMesh, false);
    photoMesh.setVerticesBuffer(
      new VertexBuffer(engine, pb.cells, "photoCell", false, false, 4),
    );
    photoMesh.setVerticesBuffer(
      new VertexBuffer(engine, pb.meta, "photoMeta", false, false, 4),
    );
    photoMesh.alwaysSelectAsActiveMesh = true;
    const photoMat = new ShaderMaterial(
      "celestialBodyPhotos",
      scene,
      { vertex: "ijPhotoBody", fragment: "ijPhotoBody" },
      {
        attributes: ["position", "photoCell", "photoMeta"],
        uniforms: [
          "view",
          "projection",
          "uViewport",
          "uTime",
          "uBeta",
          "uWarpDir",
        ],
        samplers: ["uTex"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    photoMat.backFaceCulling = false;
    // Additive, matching space-engine.js's single global blend state
    // (SRC_ALPHA, ONE) for every pass — the vignette/disc falloff is baked
    // into COLOUR (not relied on via alpha) precisely so additive blending
    // hides the quad's hard edges against the near-black background rather
    // than drawing a visible rectangle.
    photoMat.alphaMode = Constants.ALPHA_ADD;
    photoMat.setVector2(
      "uViewport",
      new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
    );
    photoMesh.material = photoMat;
    this._photoMat = photoMat;

    // Not awaited: Babylon loads the texture in the background and reports
    // readiness via isReady(); the mesh renders untextured until it lands,
    // exactly like the ship GLB's own async-not-awaited load.
    const tex = new Texture("/assets/atlas.jpg", scene);
    this._photoTex = tex;
    photoMat.setTexture("uTex", tex);
  }

  // --- GAP-03: Milky Way band ---

  /** Builds the background sphere + material; the texture itself is filled
   * in progressively by `_tickMilkyWay` (see milky-way.ts's header for why
   * this can't run in one synchronous call). */
  private _setupMilkyWay(scene: Scene, backend: "webgpu" | "webgl2") {
    const mesh = new Mesh("milkyWay", scene);
    this._bandMesh = mesh;
    const vd = CreateSphereVertexData({
      diameter: MILKY_WAY_SPHERE_RADIUS * 2,
      segments: 24,
    });
    vd.applyToMesh(mesh, false);
    // Renders behind everything regardless of draw order — the same
    // mechanism Babylon's own scene.createDefaultSkybox() uses, not a
    // rendering-group/depth-write special case.
    mesh.infiniteDistance = true;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;

    const mat = new ShaderMaterial(
      "milkyWay",
      scene,
      { vertex: "ijMilkyWay", fragment: "ijMilkyWay" },
      {
        attributes: ["position", "uv"],
        uniforms: [
          "world",
          "view",
          "projection",
          "uFade",
          "uBeta",
          "uGamma",
          "uWarpDir",
        ],
        samplers: ["uTex"],
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.backFaceCulling = false; // the camera sits inside the sphere
    mat.setFloat("uFade", 0);
    mesh.material = mat;
    this._bandMat = mat;

    // WebGPU regression fix (found verifying TR-058 live, pre-existing since
    // GAP-03/TR-057): this mesh sets alwaysSelectAsActiveMesh, so it draws
    // starting frame 1 — but the real equirect texture isn't built until
    // _tickMilkyWay's chunked loop finishes (~26 frames later). A
    // ShaderMaterial with a declared `uTex` sampler and NO texture bound at
    // all makes material.isReady() return true (the shader compiled fine)
    // while WebGPU's bind-group construction has no resource for that
    // binding — a hard, uncaught `GPUBindGroupEntry.resource` exception that
    // kills scene.render() for the WHOLE frame (every mesh after this one in
    // draw order never renders either). WebGL2 only warns, so this was
    // invisible on that backend. Fixed by binding a real (tiny, 1x1)
    // placeholder texture immediately — swapped for the built texture in
    // _tickMilkyWay, matching how the photo-body/nebula textures already
    // avoid this class of bug (a real Texture object exists from the start,
    // even before its content is ready).
    const placeholder = RawTexture.CreateRGBATexture(
      new Uint8Array([1, 1, 3, 255]),
      1,
      1,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    mat.setTexture("uTex", placeholder);
    this._bandPlaceholderTex = placeholder;

    this._bandBuf = new Uint8Array(MILKY_WAY_WIDTH * MILKY_WAY_HEIGHT * 4);
  }

  /** Chunked texture build (MILKY_WAY_ROWS_PER_CHUNK rows/frame — the
   * benchmarked full-grid cost, ~300ms+, would stall many frames if done in
   * one call) followed by a slow fade-in once the single upload lands. */
  private _tickMilkyWay() {
    if (!this._bandReady) {
      if (!this._bandBuf) return;
      const end = Math.min(
        MILKY_WAY_HEIGHT,
        this._bandRow + MILKY_WAY_ROWS_PER_CHUNK,
      );
      for (; this._bandRow < end; this._bandRow++) {
        buildMilkyWayRow(
          this._bandBuf,
          this._bandRow,
          MILKY_WAY_WIDTH,
          MILKY_WAY_HEIGHT,
        );
      }
      if (this._bandRow >= MILKY_WAY_HEIGHT) {
        this._bandReady = true;
        const tex = RawTexture.CreateRGBATexture(
          this._bandBuf,
          MILKY_WAY_WIDTH,
          MILKY_WAY_HEIGHT,
          this._scene ?? null,
          true,
          false,
          Texture.TRILINEAR_SAMPLINGMODE,
        );
        this._bandTex = tex;
        this._bandMat?.setTexture("uTex", tex);
        this._bandPlaceholderTex?.dispose();
        this._bandPlaceholderTex = undefined;
      }
      return;
    }
    if (this._bandFadeAmt < 1) {
      this._bandFadeAmt = Math.min(
        1,
        this._bandFadeAmt + (this._reduced ? 1 : 0.012),
      );
      this._bandMat?.setFloat("uFade", this._bandFadeAmt);
    }
  }

  // --- GAP-04: constellation figures ---

  private _setupConstellations(scene: Scene, backend: "webgpu" | "webgl2") {
    const lines = buildConstellationLines(
      this.bodies.map((b) => ({ fig: b.e.fig })),
      CONSTELLATION_RADIUS,
    );
    this._conCount = lines.count;
    if (lines.count === 0) return;

    const mesh = new Mesh("constellations", scene);
    this._conMesh = mesh;
    const vd = new VertexData();
    vd.positions = lines.positions;
    // Non-indexed line list — an identity index array so this mesh follows
    // the same indexed-draw path every other custom mesh here uses, rather
    // than relying on Babylon's less-exercised unindexed-draw fallback.
    const indices = new Uint32Array(lines.count * 2);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    vd.indices = indices;
    vd.applyToMesh(mesh, false);
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;

    const mat = new ShaderMaterial(
      "constellations",
      scene,
      { vertex: "ijConstellation", fragment: "ijConstellation" },
      {
        attributes: ["position"],
        uniforms: ["view", "projection", "uColor"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.fillMode = Material.LineListDrawMode;
    // Matches space-engine.js's static figure colour exactly; alpha is
    // scaled live by (1 - beta) in _pushAberration — GAP-06 closes the
    // "relativistic transit fade deferred" note this comment used to carry.
    mat.setColor4("uColor", new Color4(0.55, 0.61, 0.88, 0.34));
    mesh.material = mat;
    this._conMat = mat;
    mesh.setEnabled(this._showConstellations); // GAP-12
  }

  // --- GAP-05: warp star trails ---

  private _setupStarTrails(
    scene: Scene,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
    field: StarField,
  ) {
    const trails = buildStarTrails(field);
    if (trails.count === 0) return;

    const mesh = new Mesh("starTrails", scene);
    this._trailMesh = mesh;
    const vd = new VertexData();
    vd.positions = trails.positions;
    const indices = new Uint32Array(trails.vertexCount);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    vd.indices = indices;
    vd.applyToMesh(mesh, false);
    mesh.setVerticesBuffer(
      new VertexBuffer(engine, trails.meta, "trailMeta", false, false, 2),
    );
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isVisible = false; // gated per-frame by _tickTrails

    const mat = new ShaderMaterial(
      "starTrails",
      scene,
      { vertex: "ijStarTrail", fragment: "ijStarTrail" },
      {
        attributes: ["position", "trailMeta"],
        uniforms: [
          "view",
          "projection",
          "uCam",
          "uCamPrev",
          "uWarp",
          "uBeta",
          "uWarpDir",
        ],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.fillMode = Material.LineListDrawMode;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;
    this._trailMat = mat;
  }

  /** Advances the lagged "previous camera" and gates/fades the trail mesh —
   * matches space-engine.js's per-frame trail update exactly (see
   * star-trails.ts's header for the view-space correction this needs on
   * Babylon, where `view` already bakes in camera translation). */
  private _tickTrails() {
    if (!this._trailMesh || !this._trailMat) return;
    this._trailWarpSpeed = advanceTrailCamera(
      this.cam,
      this._camPrevTrail,
      this._reduced,
    );
    const visible = trailsVisible(
      this._trailWarpSpeed,
      this._reduced,
      this._quality.name !== "lite",
    );
    this._trailMesh.isVisible = visible;
    if (!visible) return;
    this._trailMat.setVector3(
      "uCam",
      new Vector3(this.cam[0], this.cam[1], this.cam[2]),
    );
    this._trailMat.setVector3(
      "uCamPrev",
      new Vector3(
        this._camPrevTrail[0],
        this._camPrevTrail[1],
        this._camPrevTrail[2],
      ),
    );
    this._trailMat.setFloat("uWarp", trailFade(this._trailWarpSpeed));
  }

  // --- volumetric nebulae (B3) ---

  /** Builds the tier-gated producer + the shared composite triangle.
   *
   * WebGPU: a ComputeShader raymarches into a half-res rgba8 storage texture
   * each frame (dispatch in _tickNebula). WebGL2: a ProceduralTexture runs
   * the GLSL twin of the same raymarch into an RTT of the same size at
   * refreshRate 1. Either way the composite ShaderMaterial just samples one
   * texture — the tier split never leaks past the producer. */
  private _setupNebula(
    scene: Scene,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
  ) {
    // B5: resolution and step counts scale with the quality budget
    const texScale = this._quality.nebulaTexScale;
    const w = Math.max(4, Math.round(engine.getRenderWidth() * texScale));
    const h = Math.max(4, Math.round(engine.getRenderHeight() * texScale));
    this._nebulaW = w;
    this._nebulaH = h;
    const computeSteps = Math.max(
      8,
      Math.round(NEBULA_MARCH.stepsCompute * this._quality.nebulaStepScale),
    );
    const fragmentSteps = Math.max(
      6,
      Math.round(NEBULA_MARCH.stepsFragment * this._quality.nebulaStepScale),
    );

    let tex: BaseTexture;
    if (backend === "webgpu") {
      tex = RawTexture.CreateRGBAStorageTexture(
        null,
        w,
        h,
        scene,
        false,
        false,
        Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
      );
      const cs = new ComputeShader(
        "ijNebula",
        engine,
        { computeSource: nebulaWgslCompute(NEBULA_VOLUMES, computeSteps) },
        {
          bindingsMapping: {
            params: { group: 0, binding: 0 },
            outTex: { group: 0, binding: 1 },
          },
        },
      );
      // Field order and sizes must match the WGSL Params struct exactly —
      // each vec3 + f32 pair packs into one 16-byte slot on both sides.
      const ubo = new UniformBuffer(engine, undefined, undefined, "ijNebula");
      ubo.addUniform("camPos", 3);
      ubo.addUniform("uTanFov", 1);
      ubo.addUniform("camRight", 3);
      ubo.addUniform("uAspect", 1);
      ubo.addUniform("camUp", 3);
      ubo.addUniform("uTime", 1);
      ubo.addUniform("camFwd", 3);
      ubo.addUniform("pad0", 1);
      ubo.addUniform("uReveal", 4);
      ubo.update(); // create the GPU buffer before the first dispatch binds it
      cs.setUniformBuffer("params", ubo);
      cs.setStorageTexture("outTex", tex);
      this._nebulaCS = cs;
      this._nebulaUbo = ubo;
      this._nebulaMode = "compute";
    } else {
      // B5: overwrite the module-top default registration with the
      // tier-scaled step count before the effect compiles (the top-level
      // registration remains the safe pre-boot default)
      ShaderStore.ShadersStore["ijNebulaFragmentShader"] = nebulaGlslFragment(
        NEBULA_VOLUMES,
        fragmentSteps,
      );
      const proc = new ProceduralTexture(
        "ijNebula",
        { width: w, height: h },
        "ijNebula", // → ShadersStore["ijNebulaFragmentShader"]
        scene,
        undefined,
        false,
      );
      proc.refreshRate = 1; // re-render every frame (camera-dependent)
      this._nebulaProc = proc;
      this._nebulaMode = "fragment";
      tex = proc;
    }
    this._nebulaTex = tex;

    // Fullscreen triangle (covers clip space with one primitive — no seam,
    // no second triangle). Positions are already clip-space; the vertex
    // shader passes them through untransformed.
    const mesh = new Mesh("nebulaComposite", scene);
    const vd = new VertexData();
    vd.positions = [-1, -1, 0, 3, -1, 0, -1, 3, 0];
    vd.indices = [0, 1, 2];
    vd.applyToMesh(mesh, false);
    mesh.alwaysSelectAsActiveMesh = true;
    const mat = new ShaderMaterial(
      "nebulaComposite",
      scene,
      { vertex: "ijNebulaComposite", fragment: "ijNebulaComposite" },
      {
        attributes: ["position"],
        uniforms: [],
        samplers: ["uNebulaTex"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.setTexture("uNebulaTex", tex);
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;
    this._nebulaMat = mat;
    this._nebulaMesh = mesh;
  }

  /** Per-frame producer update: camera ray basis from the same _camQuat that
   * drives the real camera, so the raymarch and the mesh render agree on the
   * view exactly. uTime pins to 0 under reduced motion — the gas holds still
   * but stays visible (a static sky feature, not an animation). */
  /** Per-frame destination-gated reveal factors (owner direction: invisible
   * through accel, fade in during the DECEL burn, swell to full at stop).
   * Deterministic ramps while warping-to/arrived-at a volume; damped fade-out
   * otherwise. Reduced motion snaps (arrived → 1, else 0) — no slow fades. */
  private _updateNebulaReveal(nowMs: number) {
    const w = this.warp;
    const arrivedIdx = NEBULA_VOLUMES.findIndex((v) => v.id === this.arrivedId);
    if (arrivedIdx >= 0) {
      if (this._nebulaArriveId !== this.arrivedId) {
        this._nebulaArriveId = this.arrivedId;
        this._nebulaArriveAt = nowMs;
      }
    } else {
      this._nebulaArriveId = null;
    }
    for (let i = 0; i < NEBULA_VOLUMES.length; i++) {
      const vol = NEBULA_VOLUMES[i];
      if (this._reduced) {
        this._nebulaReveal[i] = arrivedIdx === i ? 1 : 0;
        continue;
      }
      if (arrivedIdx === i) {
        this._nebulaReveal[i] = nebulaRevealTarget(
          null,
          (nowMs - this._nebulaArriveAt) / 1000,
        );
      } else if (w.mode === "warp" && w.target?.e.id === vol.id) {
        // integrated progress (B4 step 2) — the same k the camera flies
        this._nebulaReveal[i] = nebulaRevealTarget(w.prog ?? 0, null);
      } else {
        this._nebulaReveal[i] = expDamp(
          this._nebulaReveal[i],
          0,
          NEBULA_REVEAL.fadeOutLambda,
          this._dtS,
        );
      }
    }
  }

  private _tickNebula(camera: FreeCamera, engine: AbstractEngine) {
    if (!this._nebulaMode) return;
    this._updateNebulaReveal(performance.now());
    const rv = this._nebulaReveal;
    const q = this._camQuat;
    const right = quatRotate(q, [1, 0, 0]);
    const up = quatRotate(q, UP_AXIS);
    const fwd = quatRotate(q, BABYLON_FORWARD);
    const tanFov = Math.tan(camera.fov / 2);
    const aspect =
      engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    const timeS = this._reduced ? 0 : performance.now() / 1000;

    if (this._nebulaMode === "compute" && this._nebulaCS && this._nebulaUbo) {
      const ubo = this._nebulaUbo;
      ubo.updateFloat3("camPos", this.cam[0], this.cam[1], this.cam[2]);
      ubo.updateFloat("uTanFov", tanFov);
      ubo.updateFloat3("camRight", right[0], right[1], right[2]);
      ubo.updateFloat("uAspect", aspect);
      ubo.updateFloat3("camUp", up[0], up[1], up[2]);
      ubo.updateFloat("uTime", timeS);
      ubo.updateFloat3("camFwd", fwd[0], fwd[1], fwd[2]);
      ubo.updateFloat("pad0", 0);
      ubo.updateFloat4("uReveal", rv[0], rv[1], rv[2], rv[3]);
      ubo.update();
      // dispatch() returns false until the pipeline is ready — harmless to
      // call every frame; the composite just samples last frame's texels.
      this._nebulaCS.dispatch(
        Math.ceil(this._nebulaW / 8),
        Math.ceil(this._nebulaH / 8),
        1,
      );
    } else if (this._nebulaProc) {
      const [sPos, sRight, sUp, sFwd] = this._nebulaScratch;
      const proc = this._nebulaProc;
      proc.setVector3(
        "uCamPos",
        sPos.copyFromFloats(this.cam[0], this.cam[1], this.cam[2]),
      );
      proc.setVector3(
        "uCamRight",
        sRight.copyFromFloats(right[0], right[1], right[2]),
      );
      proc.setVector3("uCamUp", sUp.copyFromFloats(up[0], up[1], up[2]));
      proc.setVector3("uCamFwd", sFwd.copyFromFloats(fwd[0], fwd[1], fwd[2]));
      proc.setFloat("uTanFov", tanFov);
      proc.setFloat("uAspect", aspect);
      proc.setFloat("uTime", timeS);
      proc.setVector4(
        "uReveal",
        this._nebulaScratch4.copyFromFloats(rv[0], rv[1], rv[2], rv[3]),
      );
    }
  }

  /** The half-res producer tracks render-target size. Storage textures can't
   * resize in place — recreate and rebind on the compute tier; the
   * ProceduralTexture RTT resizes directly on the fallback tier. */
  private _resizeNebula(engine: AbstractEngine) {
    if (!this._nebulaMode) return;
    const texScale = this._quality.nebulaTexScale; // B5 budget
    const w = Math.max(4, Math.round(engine.getRenderWidth() * texScale));
    const h = Math.max(4, Math.round(engine.getRenderHeight() * texScale));
    if (w === this._nebulaW && h === this._nebulaH) return;
    this._nebulaW = w;
    this._nebulaH = h;
    if (this._nebulaMode === "compute" && this._nebulaCS && this._scene) {
      this._nebulaTex?.dispose();
      const tex = RawTexture.CreateRGBAStorageTexture(
        null,
        w,
        h,
        this._scene,
        false,
        false,
        Constants.TEXTURE_BILINEAR_SAMPLINGMODE,
      );
      this._nebulaTex = tex;
      this._nebulaCS.setStorageTexture("outTex", tex);
      this._nebulaMat?.setTexture("uNebulaTex", tex);
    } else if (this._nebulaProc) {
      this._nebulaProc.resize({ width: w, height: h }, false);
    }
  }

  // --- GAP-21: adaptive quality governor ---

  /** One governor sample per frame. `stepGovernor` (babylon-tiers.ts) is the
   * pure, unit-tested step; this method owns only the per-instance state and
   * hands off to `_applyQualityTier` on an actual tier change. `scrolled`
   * mirrors space-engine.js's demote-threshold widening while off-hero
   * (25 ms normally, 42 ms scrolled) — reuses the render loop's own
   * `scrolledAway` signal (GAP-13) rather than recomputing it. */
  private _tickGovernor(now: number, scrolled: boolean) {
    if (this._govLastT != null) {
      const dtMs = now - this._govLastT;
      const budgetMs = scrolled ? 42 : 25;
      const { state, tier } = stepGovernor(
        this._govState,
        dtMs,
        budgetMs,
        this._quality.name,
      );
      this._govState = state;
      if (tier !== this._quality.name) this._applyQualityTier(tier);
    }
    this._govLastT = now;
  }

  /** Applies a governor-selected tier to every knob that's cheap to change
   * live: the star-halo uniform, the nebula producer's render-target
   * resolution (`_resizeNebula` already exists for canvas-resize), and the
   * heat-shimmer post-process (created/torn down whole, matching how B5
   * gates it at boot). Shooting-star particle count, the nebula raymarch
   * step count, and the Havok asteroid-body count stay fixed post-boot —
   * each is baked into a buffer or a compiled shader pipeline at setup time,
   * and rebuilding them live (rebinding the belt's physics bodies in
   * particular) is real scope this pass deliberately does not take on. Named
   * here rather than silently dropped, per this repo's proportionality
   * convention — see the implementing TR. */
  private _applyQualityTier(next: QualityTierName) {
    const budget = QUALITY_BUDGETS[next];
    this._quality = budget;
    // GAP-21 hardening: every GPU-resource side effect below runs inside
    // engine.runRenderLoop's callback — an uncaught throw here doesn't just
    // fail this tier change, it can abort the WHOLE frame partway through
    // and, worse, kill the render loop's own rAF chain outright (nothing
    // downstream schedules the next frame if this one throws), which is a
    // far worse regression than a skipped live knob. Each op is isolated so
    // one GPU failure (a mid-flight texture/post-process dispose under real
    // load — SwiftShader-class rendering makes this far likelier than it
    // looks on capable hardware) can't take the others, or the frame, down
    // with it.
    try {
      this._starMat?.setFloat("uHaloAmp", budget.haloAmp);
    } catch (e) {
      console.warn("[babylon-engine] GAP-21: halo uniform update failed", e);
    }
    const engine = this._engine;
    const camera = this._camera;
    try {
      if (engine) this._resizeNebula(engine);
    } catch (e) {
      console.warn("[babylon-engine] GAP-21: nebula resize failed", e);
    }
    try {
      if (budget.shimmer && !this._shimmer && camera && engine) {
        this._createShimmer(camera, engine, this.backend ?? "webgl2");
      } else if (!budget.shimmer && this._shimmer) {
        this._disposeShimmer();
      }
    } catch (e) {
      console.warn("[babylon-engine] GAP-21: shimmer toggle failed", e);
    }
    try {
      if (this._badge) this._badge.textContent = this._badgeText();
    } catch (e) {
      console.warn("[babylon-engine] GAP-21: badge update failed", e);
    }
  }

  // --- ship track (B3: hull + thrusters + shimmer + docking polish) ---

  /** Loads the tiered GLB (craft-tier.ts's audited quality policy — URL param
   * → stored override → device signals; "off" respected) and builds the plume
   * mesh and shimmer post-pass. Async and failure-tolerant: a missing GLB
   * marks shipState "failed" and the scene flies on camera-only, exactly as
   * it has since B2. See babylon-ship.ts for the coordinate convention. */
  private async _setupShip(
    scene: Scene,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
    camera: FreeCamera,
  ) {
    let stored: string | null = null;
    try {
      stored = window.localStorage.getItem(CRAFT_QUALITY_STORAGE_KEY);
    } catch {
      /* storage blocked — fall through to device signals */
    }
    const urlCraft = new URLSearchParams(window.location.search).get("craft");
    const storedCraft = parseStoredQuality(stored);
    let tier = resolveCraftAttribute(
      urlCraft,
      storedCraft,
      readTierSignals(window),
    );
    // GAP-12: the `craft` HTML attribute is a markup-level default — it only
    // applies when neither the URL param nor a stored override is present,
    // keeping this repo's stated resolution order (CLAUDE.md: URL -> stored
    // -> device policy -> default) intact and inserting the attribute as a
    // page-author layer just above the device-auto policy, the same relative
    // position space-engine.js's own `craft` attribute occupies (it has no
    // URL/stored layering at all — the attribute IS the whole policy there).
    if (!urlCraft && !storedCraft && this._craftAttr !== null) {
      tier = this._craftAttr === "off" ? null : this._craftAttr;
    }
    if (!tier) {
      this._shipState = "off";
      return;
    }
    this._shipTier = tier;
    this._shipState = "loading";
    // GAP-15: mirrors space-engine.js's `_loadCraft` exactly — three
    // transitions (loading/ready/error), each pairing `dataset.craftState`
    // with the matching cosmos:craft emit so SpaceScene.tsx's landing gate
    // (`state.ready && state.craftDone`) is asset-driven instead of falling
    // through to its 2.5s grace-timer fallback on every load.
    this.dataset.craftState = "loading";
    emit("cosmos:craft", { state: "loading", tier });
    try {
      const [{ ImportMeshAsync }, , { MeshoptCompression }] = await Promise.all(
        [
          import("@babylonjs/core/Loading/sceneLoader"),
          // side-effect: registers the glTF 2.0 loader plugin
          import("@babylonjs/loaders/glTF/2.0"),
          import("@babylonjs/core/Meshes/Compression/meshoptCompression"),
        ],
      );
      // The craft GLBs are meshopt-compressed (build-craft-assets.mjs).
      // Babylon fetches the decoder from cdn.babylonjs.com by default, which
      // this site's CSP (script-src 'self') rightly blocks — serve the SAME
      // decoder from our origin instead (public/assets/craft/, copied from
      // the meshoptimizer package the asset pipeline already depends on; the
      // CSP's existing 'wasm-unsafe-eval' covers its WASM instantiation).
      MeshoptCompression.Configuration.decoder.url =
        "/assets/craft/meshopt_decoder.js";
      const result = await ImportMeshAsync(
        `/assets/craft/sci-fi-fighter-${tier}.glb`,
        scene,
      );
      if (!this._scene) return; // disposed while loading

      // Normalize the hierarchy to a unit box inside a wrapper whose +Z is
      // the nose (Babylon's RH→LH glTF conversion negates the unit-ship -Z
      // nose onto +Z — babylon-ship.ts header).
      const root = result.meshes[0];
      const { min, max } = root.getHierarchyBoundingVectors(true);
      const size = Math.max(max.x - min.x, max.y - min.y, max.z - min.z) || 1;
      const wrapper = new TransformNode("ship", scene);
      wrapper.rotationQuaternion = new Quaternion();
      const inner = new TransformNode("shipInner", scene);
      inner.parent = wrapper;
      const s = 1 / size;
      inner.scaling.setAll(s);
      inner.position.set(
        -((min.x + max.x) / 2) * s,
        -((min.y + max.y) / 2) * s,
        -((min.z + max.z) / 2) * s,
      );
      root.parent = inner;
      // World scale: the live engine's own apparent-size conversion at the
      // chase depth, clamped to a sane band in case the legacy constants
      // drift (verified visually on real hardware, TR-047).
      this._shipScale = Math.min(
        2,
        Math.max(0.2, shipScaleFactor() * SHIP_WARP_SCALE),
      );
      wrapper.scaling.setAll(this._shipScale);
      wrapper.setEnabled(false); // hidden until a journey starts
      this._ship = wrapper;
      this._shipMeshes = result.meshes.filter((m) => m.getTotalVertices() > 0);
      for (const m of this._shipMeshes) {
        m.isPickable = false;
        m.visibility = 0;
      }

      // Thruster plume: reuses ship-dynamics' crossed-quad cone builder and
      // phase functions verbatim; per-frame CPU rebuild is 36 verts (the
      // live engine does the same every frame).
      plumeBuffersForWrapper(
        plumeFlareLength(plumeParamsIdle(this._reduced, 0)),
        this._plumeScratch,
        this._plumePos,
        this._plumeMeta,
      );
      const pm = new Mesh("plume", scene);
      const vd = new VertexData();
      vd.positions = this._plumePos;
      vd.indices = plumeIndices();
      vd.applyToMesh(pm, true);
      pm.setVerticesBuffer(
        new VertexBuffer(engine, this._plumeMeta, "plumeMeta", true, false, 2),
      );
      pm.parent = wrapper;
      pm.isPickable = false;
      pm.alwaysSelectAsActiveMesh = true;
      const pMat = new ShaderMaterial(
        "plume",
        scene,
        { vertex: "ijPlume", fragment: "ijPlume" },
        {
          attributes: ["position", "plumeMeta"],
          uniforms: ["worldViewProjection", "uTime", "uThrottle", "uAlpha"],
          needAlphaBlending: true,
          shaderLanguage:
            backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
        },
      );
      pMat.setFloat("uTime", 0);
      pMat.setFloat("uThrottle", 0);
      pMat.setFloat("uAlpha", 0);
      pMat.backFaceCulling = false;
      pMat.disableDepthWrite = true;
      pMat.alphaMode = Constants.ALPHA_ADD;
      pm.material = pMat;
      this._plumeMesh = pm;
      this._plumeMat = pMat;

      // GAP-07: ember sparks — fixed-capacity billboard mesh, NOT parented
      // to the wrapper (unlike the plume): each ember resolves to a world
      // position once at spawn (see _tickShip) and steps in true world space
      // thereafter, so it needs its own view/projection like the star/body
      // billboards, not the wrapper's worldViewProjection. See
      // babylon-ship.ts's header for why.
      const em = new Mesh("embers", scene);
      const emVd = new VertexData();
      emVd.positions = this._emberPos;
      emVd.indices = emberIndices();
      emVd.applyToMesh(em, true);
      em.setVerticesBuffer(
        new VertexBuffer(engine, this._emberMeta, "emberMeta", true, false, 2),
      );
      em.isPickable = false;
      em.alwaysSelectAsActiveMesh = true;
      const emMat = new ShaderMaterial(
        "embers",
        scene,
        { vertex: "ijEmber", fragment: "ijEmber" },
        {
          attributes: ["position", "emberMeta"],
          uniforms: ["view", "projection", "uViewport"],
          needAlphaBlending: true,
          shaderLanguage:
            backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
        },
      );
      emMat.setVector2(
        "uViewport",
        new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
      );
      emMat.backFaceCulling = false;
      emMat.disableDepthWrite = true;
      emMat.alphaMode = Constants.ALPHA_ADD;
      em.material = emMat;
      this._emberMesh = em;
      this._emberMat = emMat;

      // Heat-shimmer refraction post-pass (the F3-deferred pass): uIntensity
      // 0 degenerates to a plain copy whenever the ship is hidden. B5: the
      // lite tier skips the pass entirely (a fullscreen post-process is real
      // bandwidth on the ≥30 fps floor devices).
      if (!this._quality.shimmer) {
        this._shipState = "ready";
        this.dataset.craftState = "ready";
        emit("cosmos:craft", { state: "ready", tier });
        return;
      }
      this._createShimmer(camera, engine, backend);

      this._shipState = "ready";
      this.dataset.craftState = "ready";
      emit("cosmos:craft", { state: "ready", tier });
    } catch (e) {
      console.warn("[babylon-engine] ship GLB load failed", e);
      this._shipState = "failed";
      this.dataset.craftState = "error";
      emit("cosmos:craft", { state: "error", tier });
    }
  }

  /** Builds the heat-shimmer post-process. Factored out of `_setupShip` so
   * GAP-21's governor can also call it — re-enabling shimmer on a live
   * promote needs the exact same PostProcess wiring `_setupShip` used at
   * boot. */
  private _createShimmer(
    camera: FreeCamera,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
  ) {
    const pp = new PostProcess(
      "ijShimmer",
      "ijShimmer",
      ["uCenter", "uIntensity", "uTime", "uAspect"],
      null,
      1.0,
      camera,
      undefined,
      engine,
      false,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
    );
    pp.onApply = (effect) => {
      const st = this._shimmerState;
      effect.setFloat2("uCenter", st.cx, st.cy);
      effect.setFloat("uIntensity", st.intensity);
      effect.setFloat("uTime", this._reduced ? 0 : performance.now() / 1000);
      effect.setFloat("uAspect", st.aspect);
    };
    this._shimmer = pp;
  }

  /** GAP-21: tears down the heat-shimmer post-process on a live demote to
   * a tier whose budget has `shimmer: false` — the fullscreen pass is real
   * bandwidth, so a struggling device needs it gone, not just dimmed. */
  private _disposeShimmer() {
    this._shimmer?.dispose();
    this._shimmer = undefined;
    this._shimmerState.intensity = 0;
  }

  /** Per-frame ship choreography. The wrapper flies at the same virtual-ship
   * position the chase camera has trailed since B2 step 4 — the camera keeps
   * its existing math, the hull simply materialises at the position it was
   * always chasing. Flip-and-burn: flipPhase(k) swings the hull 180° across
   * the HUD's flip window, so the decel burn is a genuine retro burn (plume
   * toward the destination — which is also when the nebula reveal starts).
   * Docking polish: on arrival the hull holds its berth pose, then fades as
   * the dossier takes over (dockFade). */
  private _tickShip(camera: FreeCamera, engine: AbstractEngine) {
    if (this._shipState !== "ready" || !this._ship) return;
    if (!this._showShip) {
      // GAP-12: `ship="off"` — force-hidden regardless of warp/dock state.
      if (this._ship.isEnabled()) this._ship.setEnabled(false);
      this._shimmerState.intensity = 0;
      return;
    }
    const now = performance.now();
    const tS = now / 1000;
    const w = this.warp;
    let target = 0;
    let plume: PlumeParams | null = null;

    if (w.mode === "aim" && w.from) {
      target = 1;
      plume = plumeParamsIdle(this._reduced, tS);
      const fwd = quatRotate(this._camQuat, BABYLON_FORWARD);
      this._ship.position.set(
        w.from[0] + fwd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + fwd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + fwd[2] * SHIP_VIEW_DEPTH,
      );
      // the launch turn previews on the hull exactly as it does on the camera
      this._shipQuat = this._camQuat;
      this._shipDockId = null;
    } else if (w.mode === "warp" && w.dir && w.from && w.to) {
      target = 1;
      // integrated progress (B4 step 2) — hull, camera, HUD, and reveal all
      // read the one k that _tickWarp advanced this frame
      const k = w.prog ?? 0;
      plume = plumeParamsForWarp(k, this._reduced, tS);
      const e = warpEase(k);
      const wd = w.dir;
      this._ship.position.set(
        w.from[0] + (w.to[0] - w.from[0]) * e + wd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + (w.to[1] - w.from[1]) * e + wd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + (w.to[2] - w.from[2]) * e + wd[2] * SHIP_VIEW_DEPTH,
      );
      const base = quatFromUnitVectors(BABYLON_FORWARD, wd);
      const f = this._reduced ? (k > 0.5 ? 1 : 0) : flipPhase(k);
      this._shipQuat =
        f > 0
          ? quatMultiply(base, quatFromAxisAngle([1, 0, 0], Math.PI * f))
          : base;
      this._shipDockId = null;
    } else if (this.arrivedId) {
      // docking polish: hold the berth pose, then hand off to the dossier
      if (this._shipDockId !== this.arrivedId) {
        this._shipDockId = this.arrivedId;
        this._shipDockAt = now;
        // B4 step 4: capture the berth pose — the contact-spring settle
        // displaces the hull along the approach axis relative to this base
        this._dockBase = [
          this._ship.position.x,
          this._ship.position.y,
          this._ship.position.z,
        ];
      }
      const since = (now - this._shipDockAt) / 1000;
      target = this._reduced ? 0 : dockFade(since);
      plume = plumeParamsIdle(this._reduced, tS);
      if (!this._reduced && this._dockBase && this._dockDir) {
        const s = dockSettleOffset(since);
        this._ship.position.set(
          this._dockBase[0] + this._dockDir[0] * s,
          this._dockBase[1] + this._dockDir[1] * s,
          this._dockBase[2] + this._dockDir[2] * s,
        );
      }
    } else {
      this._shipDockId = null;
    }

    // GAP-07: idle hull bob — a gentle sinusoidal drift so a parked/aiming
    // ship doesn't read as frozen. Ported in spirit rather than literal NDC
    // units (space-engine.js bobs a 2D sprite's screen Y; this ship is a
    // real 3D mesh) — scaled to the ship's own apparent size so the bob
    // reads consistently at any warp distance, offset along the camera's
    // local "up" so it always looks vertical regardless of viewing angle.
    // Gated off during "warp" exactly like the live engine's own
    // `reduced || warping` check.
    if (!this._reduced && w.mode !== "warp" && this._ship) {
      const bobAmp = SHIP_BOB_WORLD * this._shipScale;
      const bob = Math.sin(tS * 1.4) * bobAmp;
      const up = quatRotate(this._camQuat, UP_AXIS);
      this._ship.position.set(
        this._ship.position.x + up[0] * bob,
        this._ship.position.y + up[1] * bob,
        this._ship.position.z + up[2] * bob,
      );
    }

    this._shipVisible = this._reduced
      ? target
      : expDamp(this._shipVisible, target, 8, this._dtS);
    const vis = this._shipVisible;
    const on = vis > 0.01;
    if (this._ship.isEnabled() !== on) this._ship.setEnabled(on);
    if (!on) {
      this._shimmerState.intensity = 0;
      return;
    }

    const q = this._shipQuat;
    this._ship.rotationQuaternion?.set(q[0], q[1], q[2], q[3]);
    for (const m of this._shipMeshes) m.visibility = vis;

    const p = plume ?? plumeParamsIdle(this._reduced, tS);
    plumeBuffersForWrapper(
      plumeFlareLength(p),
      this._plumeScratch,
      this._plumePos,
      this._plumeMeta,
    );
    this._plumeMesh?.updateVerticesData(
      VertexBuffer.PositionKind,
      this._plumePos,
    );
    this._plumeMesh?.updateVerticesData("plumeMeta", this._plumeMeta);
    const throttle = plumeThrottle(p);
    this._plumeMat?.setFloat("uTime", this._reduced ? 0 : tS);
    this._plumeMat?.setFloat("uThrottle", throttle);
    this._plumeMat?.setFloat("uAlpha", plumeAlpha(p) * vis);

    // GAP-07: ember sparks — a burst on burn start/stop (14/8, matching
    // space-engine.js exactly), drifting back off the nozzles and fading.
    // Reduced motion drops the burst entirely, same as the live engine's own
    // `if (!this.reduced)` gate.
    const burning = p.burning;
    if (!this._reduced) {
      const started = burning && !this._burnPrev;
      const stopped = !burning && this._burnPrev;
      if (started || stopped) {
        const n = started ? EMBER_BURST_START : EMBER_BURST_STOP;
        const q = this._shipQuat;
        const scale = this._shipScale;
        const shipPos = this._ship.position;
        for (let i = 0; i < n && this._embers.length < MAX_EMBERS; i++) {
          const { pos, vel } = spawnEmberLocal();
          // unit-ship (nose −Z) -> wrapper space (nose +Z), matching
          // plumeBuffersForWrapper's Z negation, then into world space.
          const wp = quatRotate(q, [pos[0], pos[1], -pos[2]]);
          const wv = quatRotate(q, [vel[0], vel[1], -vel[2]]);
          this._embers.push({
            x: shipPos.x + wp[0] * scale,
            y: shipPos.y + wp[1] * scale,
            z: shipPos.z + wp[2] * scale,
            vx: wv[0] * scale,
            vy: wv[1] * scale,
            vz: wv[2] * scale,
            life: 0.7 + Math.random() * 0.5,
          });
        }
      }
    }
    this._burnPrev = burning;
    if (this._embers.length) {
      const live: Ember[] = [];
      for (const e of this._embers) if (stepEmber(e, this._dtS)) live.push(e);
      this._embers = live;
    }
    emberBillboards(this._embers, this._emberPos, this._emberMeta);
    this._emberMesh?.updateVerticesData(
      VertexBuffer.PositionKind,
      this._emberPos,
    );
    this._emberMesh?.updateVerticesData("emberMeta", this._emberMeta);

    // shimmer anchor: mean nozzle point (unit-ship stern +Z → wrapper -Z),
    // projected onto the screen with the same camera basis the raymarch uses
    let nx = 0,
      ny = 0,
      nz = 0;
    for (const [ex, ey, ez] of PLUME_ENGINES) {
      nx += ex;
      ny += ey;
      nz += -ez;
    }
    const inv = this._shipScale / PLUME_ENGINES.length;
    const local: [number, number, number] = [nx * inv, ny * inv, nz * inv];
    const lw = quatRotate(q, local);
    const wx = this._ship.position.x + lw[0] - this.cam[0];
    const wy = this._ship.position.y + lw[1] - this.cam[1];
    const wz = this._ship.position.z + lw[2] - this.cam[2];
    const right = quatRotate(this._camQuat, [1, 0, 0]);
    const up = quatRotate(this._camQuat, UP_AXIS);
    const fwd = quatRotate(this._camQuat, BABYLON_FORWARD);
    const cz = wx * fwd[0] + wy * fwd[1] + wz * fwd[2];
    if (cz <= 0.05) {
      this._shimmerState.intensity = 0;
      return;
    }
    const cx = wx * right[0] + wy * right[1] + wz * right[2];
    const cy = wx * up[0] + wy * up[1] + wz * up[2];
    const tanFov = Math.tan(camera.fov / 2);
    const aspect =
      engine.getRenderWidth() / Math.max(1, engine.getRenderHeight());
    this._shimmerState.cx = 0.5 + (cx / (cz * tanFov * aspect)) * 0.5;
    this._shimmerState.cy = 0.5 + (cy / (cz * tanFov)) * 0.5;
    this._shimmerState.aspect = aspect;
    this._shimmerState.intensity = throttle * vis;
  }

  // --- B4 step 1: Havok asteroid field ---

  /** Builds the tier-gated asteroid belt and brings Havok up lazily.
   *
   * Render side first (works on every tier): ROCK_BASE_COUNT seeded-displaced
   * icosphere "rocks", instanced per body, lit by a dim hemispheric light
   * (the scene's first light — custom-shader layers ignore it; the PBR hull
   * benefits). Physics side second, gated: WASM SIMD is Havok's floor — below
   * it (or on init failure, or under reduced motion) the SAME field renders
   * with kinematic drift and no live physics, exactly as the plan specifies.
   * Everything is async and failure-tolerant: physics can never blank the
   * sky. */
  private async _setupPhysics(scene: Scene) {
    this._physicsMode = "loading";
    try {
      await this._setupPhysicsInner(scene);
    } catch (e) {
      // NOTHING here may strand the mode at "loading" — a throw anywhere
      // (mesh building included) lands in a terminal state the E2E polls can
      // see, and the sky flies on without the field.
      console.warn("[babylon-engine] asteroid field setup failed", e);
      this._physicsMode = "failed";
    }
  }

  private async _setupPhysicsInner(scene: Scene) {
    const count = this._quality.asteroids; // B5 budget (was ad-hoc craft signals)
    const field = buildAsteroidField(count, 7);
    this._asteroidField = field;

    const light = new HemisphericLight(
      "ambient",
      new Vector3(0.3, 1, 0.2),
      scene,
    );
    light.intensity = 0.8;
    light.groundColor = new Color3(0.1, 0.1, 0.16);

    const rockMat = new StandardMaterial("rock", scene);
    rockMat.diffuseColor = new Color3(0.55, 0.5, 0.45);
    rockMat.specularColor = new Color3(0.05, 0.05, 0.05);

    const bases: Mesh[] = [];
    for (let b = 0; b < ROCK_BASE_COUNT; b++) {
      const vd = CreateIcoSphereVertexData({ radius: 1, subdivisions: 2 });
      displaceRockVertices(vd.positions as Float32Array, b + 11);
      VertexData.ComputeNormals(vd.positions, vd.indices, vd.normals);
      const mesh = new Mesh(`rock${b}`, scene);
      vd.applyToMesh(mesh);
      mesh.material = rockMat;
      mesh.isVisible = false; // only the instances render
      mesh.isPickable = false;
      bases.push(mesh);
    }
    for (let i = 0; i < field.count; i++) {
      const inst = bases[field.baseIndex[i]].createInstance(`ast${i}`);
      inst.position.set(
        field.positions[i * 3],
        field.positions[i * 3 + 1],
        field.positions[i * 3 + 2],
      );
      inst.scaling.setAll(field.scales[i]);
      inst.rotationQuaternion = new Quaternion();
      inst.isPickable = false;
      this._asteroidInstances.push(inst);
    }

    if (this._reduced || !wasmSimdSupported()) {
      // static (reduced) or kinematic-drift (no SIMD) visual tier
      this._asteroidPos = field.positions.slice();
      this._asteroidVel = this._reduced
        ? new Float32Array(field.count * 3)
        : field.linVel.slice();
      this._physicsMode = "visual";
      return;
    }

    try {
      const [havokFactory, { HavokPlugin }, { PhysicsAggregate }, shapeTypes] =
        await Promise.all([
          import("@babylonjs/havok"),
          import("@babylonjs/core/Physics/v2/Plugins/havokPlugin"),
          import("@babylonjs/core/Physics/v2/physicsAggregate"),
          import("@babylonjs/core/Physics/v2/IPhysicsEnginePlugin"),
          // side-effect: augments Scene with enablePhysics
          import("@babylonjs/core/Physics/joinedPhysicsEngineComponent"),
        ]);
      // Emscripten factory: point it at the Vite-emitted same-origin wasm —
      // never a CDN (ADR-0005's stance; CSP wasm-unsafe-eval covers it).
      const havok = await (
        havokFactory.default as unknown as (o: {
          locateFile: () => string;
        }) => Promise<unknown>
      )({ locateFile: () => havokWasmUrl });
      if (!this._scene) return; // disposed while loading
      const plugin = new HavokPlugin(true, havok);
      // zero gravity: space — the belt-pull herding force is applied per
      // frame in _tickAsteroids, not via global gravity
      scene.enablePhysics(new Vector3(0, 0, 0), plugin);
      for (let i = 0; i < field.count; i++) {
        const agg = new PhysicsAggregate(
          this._asteroidInstances[i],
          shapeTypes.PhysicsShapeType.SPHERE,
          {
            mass: field.masses[i],
            restitution: ASTEROID_BELT.restitution,
            radius: field.scales[i],
          },
          scene,
        );
        agg.body.setLinearVelocity(
          new Vector3(
            field.linVel[i * 3],
            field.linVel[i * 3 + 1],
            field.linVel[i * 3 + 2],
          ),
        );
        agg.body.setAngularVelocity(
          new Vector3(
            field.angVel[i * 3],
            field.angVel[i * 3 + 1],
            field.angVel[i * 3 + 2],
          ),
        );
        // B4 step 3: impulse-driven camera shake — the solver's own collision
        // impulse (with distance falloff to the camera) drives the amplitude
        agg.body.setCollisionCallbackEnabled(true);
        agg.body.getCollisionObservable().add((ev) => {
          if (this._reduced) return; // shake is motion — reduced motion opts out
          const p = ev.point;
          const dist = p
            ? Math.hypot(
                p.x - this.cam[0],
                p.y - this.cam[1],
                p.z - this.cam[2],
              )
            : IMPACT_SHAKE.referenceDist * 4;
          const amp = impactShakeAmplitude(ev.impulse, dist);
          if (amp > 0) {
            this._shakeAmp = Math.min(
              IMPACT_SHAKE.maxAmp,
              this._shakeAmp + amp,
            );
            this._impactCount++;
          }
        });
        this._asteroidBodies.push(agg.body);
      }
      this._collisionWired = true;
      this._physicsMode = "havok";
    } catch (e) {
      console.warn("[babylon-engine] Havok init failed, visual-only field", e);
      this._asteroidPos = field.positions.slice();
      this._asteroidVel = field.linVel.slice();
      this._physicsMode = "visual";
    }
  }

  /** Per-frame field upkeep. Havok tier: apply the weak belt-pull force
   * (accel × mass at the body's position) so the field stays herded and
   * keeps colliding; Havok itself integrates. Visual tier: Euler drift with
   * the same pull, no collisions. Reduced motion: static (zero velocities —
   * the loop below is then a no-op on positions). */
  /** GAP-06: pushes uBeta/uGamma/uWarpDir to every material that carries the
   * aberrate()/Doppler port (stars, curated bodies, photo billboards, warp
   * trails, the Milky Way band). Reuses one scratch Vector3 so this — called
   * every render-loop frame — allocates nothing. */
  private _warpDirScratch = new Vector3(0, 0, 1);
  private _conColorScratch = new Color4(0.55, 0.61, 0.88, 0.34);
  private _pushAberration(wd: readonly [number, number, number]) {
    const beta = this._beta;
    const gamma = beta > 0 ? 1 / Math.sqrt(1 - beta * beta) : 1;
    this._warpDirScratch.copyFromFloats(wd[0], wd[1], wd[2]);
    const mats: (ShaderMaterial | undefined)[] = [
      this._starMat,
      this._bodyMat,
      this._photoMat,
      this._trailMat,
      this._bandMat,
    ];
    for (const m of mats) {
      if (!m) continue;
      m.setFloat("uBeta", beta);
      m.setFloat("uGamma", gamma);
      m.setVector3("uWarpDir", this._warpDirScratch);
    }
    // Constellation figures fade during relativistic transit — matches
    // space-engine.js's `uColor(..., 0.34 * (1 - beta))` exactly. No
    // aberration/Doppler on this pass (out of GAP-06's scope per the gap
    // analysis; see _setupConstellations), just the alpha term.
    if (this._conMat) {
      this._conColorScratch.a = 0.34 * (1 - beta);
      this._conMat.setColor4("uColor", this._conColorScratch);
    }
  }

  private _tickAsteroids() {
    if (this._physicsMode === "havok") {
      const f = this._asteroidField;
      if (!f) return;
      // B4 step 2: the warping ship ploughs through the field — bodies near
      // the virtual-ship position get a mass-scaled outward push
      const sw = this.warp.mode === "warp" ? this._shipWorld : null;
      for (let i = 0; i < this._asteroidBodies.length; i++) {
        const p = this._asteroidInstances[i].position;
        const [ax, ay, az] = beltPullAccel(p.x, p.y, p.z);
        const m = f.masses[i];
        this._asteroidPull.set(ax * m, ay * m, az * m);
        this._asteroidBodies[i].applyForce(this._asteroidPull, p);
        if (sw) {
          const [fx, fy, fz] = passageDeflectForce(
            sw[0],
            sw[1],
            sw[2],
            p.x,
            p.y,
            p.z,
            m,
          );
          if (fx !== 0 || fy !== 0 || fz !== 0) {
            this._asteroidPull.set(fx, fy, fz);
            this._asteroidBodies[i].applyForce(this._asteroidPull, p);
          }
        }
      }
    } else if (
      this._physicsMode === "visual" &&
      !this._reduced &&
      this._asteroidPos &&
      this._asteroidVel &&
      this._asteroidField
    ) {
      const pos = this._asteroidPos;
      visualDriftStep(
        pos,
        this._asteroidVel,
        this._asteroidField.count,
        this._dtS,
      );
      for (let i = 0; i < this._asteroidInstances.length; i++) {
        this._asteroidInstances[i].position.set(
          pos[i * 3],
          pos[i * 3 + 1],
          pos[i * 3 + 2],
        );
      }
    }
  }

  /* --- GAP-08/GAP-10: free-look input ------------------------------------
   *
   * space-engine.js binds pointer/keyboard directly in `_bindPointer`/
   * `_bindKeys`. Ported onto the canvas (pointer) and the host custom
   * element (keyboard + the a11y attributes keyboard nav needs) respectively
   * — the canvas itself stays out of the tab order (see the tabIndex=-1 note
   * in _boot), so `this` (the <babylon-scene> element) is the correct
   * keyboard-focus target, matching the live engine's own `this.tabIndex=0`
   * on itself, not its internal canvas. */
  private _bindPointer(canvas: HTMLCanvasElement) {
    canvas.addEventListener("pointerdown", (ev) => {
      this._dragStart = {
        x: ev.clientX,
        y: ev.clientY,
        yaw: this._yaw,
        pitch: this._pitch,
        t: performance.now(),
      };
      this._dragMoved = 0;
      this._dragging = true;
      canvas.setPointerCapture(ev.pointerId);
    });
    canvas.addEventListener("pointermove", (ev) => {
      const d = this._dragStart;
      if (d) {
        const dx = ev.clientX - d.x,
          dy = ev.clientY - d.y;
        this._dragMoved = Math.max(
          this._dragMoved,
          Math.abs(dx) + Math.abs(dy),
        );
        this._yaw = d.yaw - dx * FREE_LOOK_DRAG_K;
        this._pitch = Math.max(
          -FREE_LOOK_PITCH_LIMIT,
          Math.min(FREE_LOOK_PITCH_LIMIT, d.pitch + dy * FREE_LOOK_DRAG_K),
        );
        this._velYaw = 0;
        this._velPitch = 0;
      } else {
        this._pick(ev.clientX, ev.clientY, canvas);
      }
    });
    const up = (ev: PointerEvent) => {
      this._dragging = false;
      const d = this._dragStart;
      if (!d) return;
      const dt = performance.now() - d.t;
      if (this._dragMoved < 6 && dt < 600)
        this._click(ev.clientX, ev.clientY, canvas);
      this._dragStart = null;
    };
    canvas.addEventListener("pointerup", up);
    canvas.addEventListener("pointercancel", () => {
      this._dragging = false;
      this._dragStart = null;
    });
    canvas.addEventListener("pointerleave", () => {
      if (this._hoverId) {
        this._hoverId = null;
        emit("cosmos:unhover", {});
        canvas.style.cursor = "crosshair";
      }
    });
  }

  private _bindKeys() {
    this.tabIndex = 0;
    this.setAttribute("role", "application");
    this.setAttribute(
      "aria-label",
      "Interactive star chart. Arrow keys look around, Enter travels to the target nearest screen centre, H returns home.",
    );
    this.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft") {
        this._velYaw = Math.max(-KEY_YAW_MAX, this._velYaw - KEY_YAW_ACCEL);
      } else if (k === "ArrowRight") {
        this._velYaw = Math.min(KEY_YAW_MAX, this._velYaw + KEY_YAW_ACCEL);
      } else if (k === "ArrowUp") {
        this._velPitch = Math.min(
          KEY_PITCH_MAX,
          this._velPitch + KEY_PITCH_ACCEL,
        );
      } else if (k === "ArrowDown") {
        this._velPitch = Math.max(
          -KEY_PITCH_MAX,
          this._velPitch - KEY_PITCH_ACCEL,
        );
      } else if (k === "Enter") {
        if (this._hoverId) this.travelTo(this._hoverId);
        else this._travelToNearestCenter();
      } else if (k === "h" || k === "H") {
        this.goHome();
      } else return;
      e.preventDefault();
    });
  }

  /** Enter-with-no-hover: travel to whichever body/station sits nearest
   * screen centre — matches space-engine.js's `_bindKeys` Enter branch,
   * which sweeps `this.bodies.concat(this.stations)` reading their
   * per-frame-projected `.sx/.sy`. This path doesn't keep bodies projected
   * every frame (see `_projectBody`'s header), so it projects fresh, once,
   * for this discrete user action. */
  private _travelToNearestCenter() {
    const camera = this._camera;
    const engine = this._engine;
    if (!camera || !engine) return;
    const rectW = engine.getRenderWidth() / (window.devicePixelRatio || 1);
    const rectH = engine.getRenderHeight() / (window.devicePixelRatio || 1);
    const cxp = rectW / 2,
      cyp = rectH / 2;
    const basis = this._cameraBasis(camera, engine);
    let best: BabylonBody | null = null;
    let bd = Infinity;
    for (const b of this.bodies.concat(this.stations)) {
      const p = this._projectBody(b.pos, basis, rectW, rectH);
      if (!p.vis) continue;
      const d2 = (p.sx - cxp) * (p.sx - cxp) + (p.sy - cyp) * (p.sy - cyp);
      if (d2 < bd) {
        bd = d2;
        best = b;
      }
    }
    if (best) this.travelTo(best.e.id);
  }

  /** Camera right/up/forward basis + lens constants, computed once per
   * pick/projection call and threaded through rather than recomputed per
   * body — the same `quatRotate(camQuat, axis)` idiom `_tickNebula` already
   * uses for its raymarch camera uniforms. */
  private _cameraBasis(camera: FreeCamera, engine: AbstractEngine) {
    const q = this._camQuat;
    return {
      camPos: this.cam,
      right: quatRotate(q, [1, 0, 0]),
      up: quatRotate(q, UP_AXIS),
      fwd: quatRotate(q, BABYLON_FORWARD),
      tanFov: Math.tan(camera.fov / 2),
      aspect: engine.getRenderWidth() / Math.max(1, engine.getRenderHeight()),
    };
  }

  /* --- GAP-11/GAP-09: screen-space projection ----------------------------
   *
   * Ports space-engine.js's `_projectBodies` (76px edge-clamp for off-view
   * markers) using this camera's own right/up/forward basis and FOV instead
   * of the live engine's raw proj/view float arrays — same algorithm
   * (view-space position -> perspective divide -> NDC -> screen px, with an
   * edge-clamped fallback for off-view targets), expressed through the
   * quaternion-basis convention this file already uses elsewhere rather than
   * introducing Babylon's Matrix API as a second, differently-conventioned
   * way to do the same job.
   *
   * Deliberately NOT re-run for every curated body every frame (unlike the
   * live engine, which projects `this.bodies` unconditionally each frame for
   * its 34px hit-test): curated bodies already render as real GPU billboards
   * on this path (GAP-01/GAP-02) — nothing DOM-side reads their sx/sy — so
   * the ~2,700-body sweep only has a consumer at pick time (pointermove,
   * throttled by the browser's own event rate) and on the discrete Enter-key
   * action above, not the render loop. Only station markers (7 items, a real
   * per-frame DOM consumer via SpaceScene.tsx) are projected every frame —
   * see `_tickStations`. This keeps the render loop's per-frame allocation
   * at zero while still projecting every body a user could actually pick. */
  private _projectBody(
    pos: readonly [number, number, number],
    basis: ReturnType<BabylonScene["_cameraBasis"]>,
    rectW: number,
    rectH: number,
  ): { vis: boolean; sx: number; sy: number; ex: number; ey: number } {
    const { camPos, right, up, fwd, tanFov, aspect } = basis;
    const dx = pos[0] - camPos[0],
      dy = pos[1] - camPos[1],
      dz = pos[2] - camPos[2];
    const vx = right[0] * dx + right[1] * dy + right[2] * dz;
    const vy = up[0] * dx + up[1] * dy + up[2] * dz;
    const vz = fwd[0] * dx + fwd[1] * dy + fwd[2] * dz;
    const margin = 76;
    let sx = 0,
      sy = 0,
      vis = false;
    if (vz > 0.01) {
      const ndcX = vx / (vz * tanFov * aspect);
      const ndcY = vy / (vz * tanFov);
      vis = ndcX > -1.1 && ndcX < 1.1 && ndcY > -1.1 && ndcY < 1.1;
      sx = (ndcX * 0.5 + 0.5) * rectW;
      sy = (-ndcY * 0.5 + 0.5) * rectH;
    }
    let ex: number, ey: number;
    if (vis) {
      ex = sx;
      ey = sy;
    } else {
      const ang = Math.atan2(vy, vx);
      ex = rectW / 2 + Math.cos(ang) * (rectW / 2 - margin);
      ey = rectH / 2 - Math.sin(ang) * (rectH / 2 - margin);
    }
    return { vis, sx, sy, ex, ey };
  }

  /** GAP-11: station markers only (7 items) — cheap enough, and the only
   * consumer that needs a live per-frame value (SpaceScene.tsx's sprite
   * `tick()` reads `en.stations[i].vis/.sx/.sy/.ex/.ey` every animation
   * frame). Mutates the station BabylonBody objects in place, matching the
   * SpaceEngineElement contract's shape (station identity is stable; only
   * these fields change). */
  private _tickStations(camera: FreeCamera, engine: AbstractEngine) {
    if (!this.stations.length) return;
    const rectW = engine.getRenderWidth() / (window.devicePixelRatio || 1);
    const rectH = engine.getRenderHeight() / (window.devicePixelRatio || 1);
    const basis = this._cameraBasis(camera, engine);
    for (const s of this.stations) {
      const p = this._projectBody(s.pos, basis, rectW, rectH);
      s.vis = p.vis as false; // BabylonBody's `vis` type is a `false` literal (see its header) — the
      // interface predates live projection; widening it is a bigger surface
      // change than this gap warrants, so the runtime value is written
      // through the same field regardless. Consumers read it as a boolean
      // (SpaceScene.tsx's `b.vis ?`), which is unaffected by the TS literal.
      s.sx = p.sx;
      s.sy = p.sy;
      s.ex = p.ex;
      s.ey = p.ey;
    }
  }

  /* --- GAP-09/GAP-16: hover picking --------------------------------------
   *
   * Ports space-engine.js's `fieldInfo`/`_pickField`/`_pick`/`_click`
   * verbatim in spirit: a 34px body pick first, falling back to a ~0.6° cone
   * test against the raw field-star catalog (throttled to every other pick
   * attempt — that test is O(starCount), same as the live engine's reason
   * for throttling it). */
  fieldInfo(i: number) {
    const f = this._field;
    if (!f || i == null || i < 0 || i >= f.count) return null;
    const x = f.positions[i * 3],
      y = f.positions[i * 3 + 1],
      z = f.positions[i * 3 + 2];
    const r = Math.hypot(x, y, z) || 1;
    const ra = (((Math.atan2(y, x) / D2R + 360) % 360) + 360) % 360;
    const dec = Math.asin(Math.max(-1, Math.min(1, z / r))) / D2R;
    const { type, colour } = unpackTypeAndColour(f.meta[i * 2 + 1]);
    return {
      ra,
      dec,
      ly: type > 0 ? Math.pow(10, (r - 150) / 128) - 1.5 : r * 3.9,
      mg: 12.5 - f.meta[i * 2] * 14,
      ci: colour * 255,
      type,
    };
  }

  private _pickField(
    x: number,
    y: number,
    rectW: number,
    rectH: number,
    basis: ReturnType<BabylonScene["_cameraBasis"]>,
  ): number {
    const f = this._field;
    if (!f || !f.count) return -1;
    const { camPos, right, up, fwd, tanFov, aspect } = basis;
    const ndcX = ((x / rectW) * 2 - 1) * tanFov * aspect;
    const ndcY = -((y / rectH) * 2 - 1) * tanFov;
    let ux = right[0] * ndcX + up[0] * ndcY + fwd[0];
    let uy = right[1] * ndcX + up[1] * ndcY + fwd[1];
    let uz = right[2] * ndcX + up[2] * ndcY + fwd[2];
    const rl = Math.hypot(ux, uy, uz) || 1;
    ux /= rl;
    uy /= rl;
    uz /= rl;
    const [cx, cy, cz] = camPos;
    let best = -1,
      bestScore = 0.99989; // ~0.6 deg cone, matches space-engine.js exactly
    for (let i = 0; i < f.count; i++) {
      const sx = f.positions[i * 3] - cx,
        sy = f.positions[i * 3 + 1] - cy,
        sz = f.positions[i * 3 + 2] - cz;
      const dt = sx * ux + sy * uy + sz * uz;
      if (dt <= 0) continue;
      const c2 = (dt * dt) / (sx * sx + sy * sy + sz * sz);
      if (c2 > bestScore) {
        bestScore = c2;
        best = i;
      }
    }
    return best;
  }

  private _pick(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    const camera = this._camera,
      engine = this._engine;
    if (!camera || !engine) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left,
      y = clientY - rect.top;
    const rectW = engine.getRenderWidth() / (window.devicePixelRatio || 1);
    const rectH = engine.getRenderHeight() / (window.devicePixelRatio || 1);
    const basis = this._cameraBasis(camera, engine);
    let best: BabylonBody | null = null;
    let bd2 = 34 * 34;
    for (const b of this.bodies) {
      const p = this._projectBody(b.pos, basis, rectW, rectH);
      b.vis = p.vis as false;
      b.sx = p.sx;
      b.sy = p.sy;
      b.ex = p.ex;
      b.ey = p.ey;
      if (!p.vis) continue;
      const dx = p.sx - x,
        dy = p.sy - y,
        d2 = dx * dx + dy * dy;
      if (d2 < bd2) {
        bd2 = d2;
        best = b;
      }
    }
    let id: string | null = best ? best.e.id : null;
    if (!id) {
      this._fp = (this._fp + 1) | 0;
      if (this._fp % 2 === 0) {
        const fi = this._pickField(x, y, rectW, rectH, basis);
        if (fi >= 0) id = "fs-" + fi;
      } else if (this._hoverId && String(this._hoverId).indexOf("fs-") === 0) {
        id = this._hoverId; // hold between throttled picks
      }
    }
    const hx = best ? best.sx! + rect.left : clientX,
      hy = best ? best.sy! + rect.top : clientY;
    if (id !== this._hoverId) {
      this._hoverId = id;
      canvas.style.cursor = id ? "pointer" : "crosshair";
      if (id) emit("cosmos:hover", { id, x: hx, y: hy });
      else emit("cosmos:unhover", {});
    } else if (id) {
      emit("cosmos:hover", { id, x: hx, y: hy });
    }
  }

  private _click(clientX: number, clientY: number, canvas: HTMLCanvasElement) {
    this._pick(clientX, clientY, canvas);
    if (this._hoverId) this.travelTo(this._hoverId);
  }

  // --- travel (B2 steps 3-4) ---

  travelTo(id: string, quiet?: boolean) {
    // GAP-19: no-WebGPU/WebGL2 fallback — mirrors space-engine.js's `noGL`
    // branch exactly (space-engine.js:1471-1478). `!this._engine` is true
    // only when `_boot`'s createEngine() threw and returned early (CLAUDE.md
    // #6's no-WebGL/DOM-fallback policy) — no render loop ever started, so
    // nothing would tick `_beginWarp`'s state machine forward; the warp would
    // stall in "aim" forever and cosmos:arrive would never fire, breaking
    // navigation for a no-WebGL visitor. Fast-path an immediate arrival
    // instead, same 250ms grace the archived engine uses so the UI doesn't
    // feel instantaneous-to-the-point-of-broken.
    if (!this._engine) {
      this.arrivedId = id;
      emit("cosmos:select", { id, quiet: true });
      setTimeout(() => emit("cosmos:arrive", { id, quiet: true }), 250);
      return;
    }
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
    if (!this._engine) {
      // GAP-19: no-WebGL fallback — mirrors space-engine.js:1531-1536.
      this.arrivedId = null;
      emit("cosmos:home", {});
      return;
    }
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

  // fieldInfo(i) is implemented above, near the rest of the GAP-09/GAP-16
  // hover-picking methods — kept together with _pick/_pickField rather than
  // here with the other SpaceEngineElement contract methods.

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
      prog: 0,
    };
    this._warpSlow = 1;
    this._warpSlowMin = 1;
    this._dockBase = null;
    this._dockDir = null;
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
    const rawDt =
      this._lastFrameMs != null ? (now - this._lastFrameMs) / 1000 : 1 / 60;
    const dt = Math.min(SHIP_MAX_DT, rawDt);
    this._lastFrameMs = now;
    this._dtS = dt; // consumed by _tickNebula's reveal fade-out damping
    // Warp-progress integration must track WALL CLOCK (capped only against
    // tab sleeps), not the SHIP_MAX_DT-clamped dt — clamped integration
    // silently stretches journeys whenever frames run long (slow devices,
    // loaded CI), which the arrival-timing E2E tests caught immediately.
    this._dtWarpS = Math.min(0.5, rawDt);

    // GAP-08/GAP-10: keyboard look inertia — integrated every frame
    // regardless of warp mode, matching space-engine.js's velYaw/velPitch
    // (set by _bindKeys' arrow-key handlers, decayed continuously rather
    // than snapping to zero, so a tap keeps a little glide).
    this._yaw += this._velYaw;
    this._pitch = Math.max(
      -FREE_LOOK_PITCH_LIMIT,
      Math.min(FREE_LOOK_PITCH_LIMIT, this._pitch + this._velPitch),
    );
    this._velYaw *= KEY_LOOK_DAMP;
    this._velPitch *= KEY_LOOK_DAMP;
    if (Math.abs(this._velYaw) < 1e-5) this._velYaw = 0;
    if (Math.abs(this._velPitch) < 1e-5) this._velPitch = 0;

    const w = this.warp;
    if (w.mode === "idle") {
      // Ambient idle-at-home drift now folds into free-look yaw (rather than
      // composing a separate axis-angle rotation onto _camQuat directly) so
      // that a visitor who has already dragged/looked around keeps their own
      // orientation — drift resumes from wherever they left off, not from a
      // fixed axis unrelated to free-look.
      if (
        !this._reduced &&
        !this._dragging &&
        Math.hypot(this.cam[0], this.cam[1], this.cam[2]) < 1
      ) {
        this._yaw += IDLE_DRIFT_RATE * dt;
      }
      this._camQuat = quatFromUnitVectors(
        BABYLON_FORWARD,
        freeLookDir(this._yaw, this._pitch),
      );
    }
    if (w.mode === "aim") {
      if (now - (w.start ?? now) >= (w.aimDur ?? AIM_DUR_MS)) {
        w.mode = "warp";
        w.warpStart = now;
      } else if (this._dragging) {
        // GAP-08: "drag input stays authoritative over the look" — even
        // during the pre-launch aim turn.
        this._camQuat = quatFromUnitVectors(
          BABYLON_FORWARD,
          freeLookDir(this._yaw, this._pitch),
        );
      } else if (w.dir) {
        const targetQ = quatFromUnitVectors(BABYLON_FORWARD, w.dir);
        this._camQuat = this._reduced
          ? targetQ
          : quatDamp(this._camQuat, targetQ, CHASE_LOOK_LAMBDA, dt);
      }
    }
    if (w.mode === "warp" && w.to && w.from && w.dir) {
      const warpDur = w.warpDur ?? WARP_MIN_MS;
      const wd = w.dir;
      // B4 step 2: k is INTEGRATED, not wall-clock — the belt's local density
      // at the virtual ship's position eases the journey (proximity slowdown
      // feeding the B2 velocity profile). Reduced motion keeps the fixed
      // short profile exactly as TR-042 shipped it (slow factor pinned to 1).
      const k0 = w.prog ?? 0;
      const e0 = warpEase(k0);
      const px =
        w.from[0] + (w.to[0] - w.from[0]) * e0 + wd[0] * SHIP_VIEW_DEPTH;
      const py =
        w.from[1] + (w.to[1] - w.from[1]) * e0 + wd[1] * SHIP_VIEW_DEPTH;
      const pz =
        w.from[2] + (w.to[2] - w.from[2]) * e0 + wd[2] * SHIP_VIEW_DEPTH;
      this._warpSlow = this._reduced
        ? 1
        : warpSlowFactor(beltDensityAt(px, py, pz));
      if (this._warpSlow < this._warpSlowMin)
        this._warpSlowMin = this._warpSlow;
      const k = advanceWarpProgress(k0, this._dtWarpS, warpDur, this._warpSlow);
      w.prog = k;
      const e = warpEase(k);
      const shipW: [number, number, number] = [
        w.from[0] + (w.to[0] - w.from[0]) * e + wd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + (w.to[1] - w.from[1]) * e + wd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + (w.to[2] - w.from[2]) * e + wd[2] * SHIP_VIEW_DEPTH,
      ];
      this._shipWorld = shipW; // consumed by the deflection pass
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
      if (this._dragging) {
        // GAP-08: drag stays authoritative mid-warp; chase-look yields.
        this._camQuat = quatFromUnitVectors(
          BABYLON_FORWARD,
          freeLookDir(this._yaw, this._pitch),
        );
      } else {
        const targetQ = quatFromUnitVectors(BABYLON_FORWARD, [
          lx / ll,
          ly / ll,
          lz / ll,
        ]);
        this._camQuat = this._reduced
          ? targetQ
          : quatDamp(this._camQuat, targetQ, CHASE_LOOK_LAMBDA, dt);
      }

      if (k >= 1) {
        w.mode = "idle";
        this._shipWorld = null;
        this._warpSlow = 1; // warpSlowMin persists until the next launch
        this.cam = [w.to[0], w.to[1], w.to[2]]; // land exactly on the invariant
        if (w.home) {
          this.arrivedId = null;
          emit("cosmos:home", {});
        } else if (w.target) {
          this.arrivedId = w.target.e.id;
          // B4 step 4 — docking contact: a gentle impulse as the ship berths.
          // The camera feels it through the shake system; the hull's sprung
          // settle rides _tickShip's dock branch along this approach axis.
          if (!this._reduced && w.dir) {
            this._shakeAmp = Math.min(
              IMPACT_SHAKE.maxAmp,
              this._shakeAmp + DOCK_CONTACT.bumpAmp,
            );
            this._dockDir = [w.dir[0], w.dir[1], w.dir[2]];
          }
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

    // GAP-06: relativistic beta from the brachistochrone profile — matches
    // space-engine.js's `this._beta = min(0.88, 0.88*dsdk*0.5)` inside its
    // own warp branch, `this._beta *= 0.86` (floored at 0.004) otherwise.
    // `w.dir` persists on the warp object after a journey ends (mode flips
    // to "idle" but the object itself isn't replaced until the next launch),
    // so it's always a valid last-used direction for the decaying tail.
    if (this._reduced) {
      this._beta = 0;
    } else if (w.mode === "warp" && w.prog != null) {
      const kb = w.prog;
      this._beta = Math.min(
        0.88,
        0.88 * (kb < 0.5 ? 4 * kb : 4 * (1 - kb)) * 0.5,
      );
    } else {
      this._beta *= 0.86;
      if (this._beta < 0.004) this._beta = 0;
    }
    this._pushAberration(w.dir ?? [0, 0, 1]);

    const q = camera.rotationQuaternion;
    if (q)
      q.set(
        this._camQuat[0],
        this._camQuat[1],
        this._camQuat[2],
        this._camQuat[3],
      );
    camera.position.set(this.cam[0], this.cam[1], this.cam[2]);

    // B4 step 3: impact shake rings down on the CAMERA OBJECT only — this.cam
    // (the engine's canonical position, asserted exactly-on-target by the
    // arrival E2E) is never polluted by shake offsets.
    if (this._shakeAmp > 0.001) {
      const [ox, oy] = shakeOffset(this._shakeAmp, now / 1000);
      const right = quatRotate(this._camQuat, [1, 0, 0]);
      const up = quatRotate(this._camQuat, UP_AXIS);
      camera.position.set(
        this.cam[0] + right[0] * ox + up[0] * oy,
        this.cam[1] + right[1] * ox + up[1] * oy,
        this.cam[2] + right[2] * ox + up[2] * oy,
      );
      this._shakeAmp = expDamp(this._shakeAmp, 0, IMPACT_SHAKE.decayLambda, dt);
    } else if (this._shakeAmp !== 0) {
      this._shakeAmp = 0;
    }
  }
}

if (!customElements.get("babylon-scene"))
  customElements.define("babylon-scene", BabylonScene);
