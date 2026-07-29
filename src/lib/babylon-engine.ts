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
  buildMilkyWayImpostor,
  MilkyWayBandBuilder,
  MILKY_WAY_FRAGMENT_GLSL,
  MILKY_WAY_FRAGMENT_WGSL,
  MILKY_WAY_HEIGHT,
  MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL,
  MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL,
  MILKY_WAY_IMPOSTOR_SIZE,
  MILKY_WAY_IMPOSTOR_VERTEX_GLSL,
  MILKY_WAY_IMPOSTOR_VERTEX_WGSL,
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
  buildGd1TrailMesh,
  GD1_TRAIL_FRAGMENT_GLSL,
  GD1_TRAIL_FRAGMENT_WGSL,
  GD1_TRAIL_VERTEX_GLSL,
  GD1_TRAIL_VERTEX_WGSL,
  orderGd1Stream,
  radialVelocityToColor,
  type Vec3,
} from "./gd1-trail";
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
  minSlowAlongSegment,
  ASTEROID_BELT,
  BELT_ORBIT,
  BELT_OBLIQ_COS,
  BELT_OBLIQ_SIN,
  beltDensityAt,
  beltPullAccelInto,
  buildAsteroidField,
  buildRealAsteroidField,
  displaceRockVertices,
  IMPACT_SHAKE,
  impactShakeAmplitude,
  passageDeflectForceInto,
  ROCK_BASE_COUNT,
  shakeOffset,
  visualDriftStep,
  warpSlowFactor,
  wasmSimdSupported,
  type AsteroidField,
} from "./babylon-asteroids";
// PF-10 C3: real Gaia DR3 asteroids for the physics tier. A generated module (not a fetch) so
// the field can never be half-built because a request was still in flight — see its header.
import { REAL_ASTEROIDS } from "../data/asteroids-dr3-physics";
// PF-10 C4: real planetary spheres. See planet-sphere.ts for why there is exactly one sphere.
import {
  PLANET_ALBEDO,
  PLANET_LUNAR_L,
  exposureTermsFor,
  homeOrbitPosition,
  HOME_ORBIT_PERIOD_S,
  HOME_ORBIT_RADIUS,
  SUN_RA_DEG,
  SUN_DEC_DEG,
  PLANET_ELEV_SCALE,
  PLANET_PATCH_DEG,
  rotationAngle,
  UV_LONGITUDE_OFFSET,
  PLANET_FRAGMENT_GLSL,
  PLANET_FRAGMENT_WGSL,
  PLANET_PHYSICAL,
  PLANET_SPHERE_RADIUS,
  PLANET_VERTEX_GLSL,
  PLANET_VERTEX_WGSL,
  SPHERE_SEGMENTS,
  sphereIdFor,
  sunDirectionFrom,
  type PlanetManifest,
} from "./planet-sphere";
// PF-10 C4.2: virtual-texture streaming for planetary elevation detail.
import {
  VT_BODIES,
  VT_TILE_PX,
  levelForViewport,
  patchRect,
  subCameraUV,
  type PatchRect,
} from "./planet-vt";
import { composeAtlas, rectChanged } from "./planet-vt-stream";
import type {
  CatalogDecodeRequest,
  CatalogDecodeResponse,
} from "../workers/catalog-decode.worker";
// PF-11 D1.3: the launch-from-Earth ascent curves (pure; Astra §4 physics, Vega motion-spec).
import {
  ASCENT_DURATION_MS,
  ascentStateAt,
  LIMB_GLOW_RGB,
  LIMB_SHELL_FACTOR,
  LIMB_VERTEX_GLSL,
  LIMB_FRAGMENT_GLSL,
  LIMB_VERTEX_WGSL,
  LIMB_FRAGMENT_WGSL,
} from "./ascent";
// PF-10 C4.2: the Venus cloud descent. See venus-descent.ts for Astra's shader-fork mandate.
import {
  CLOUD_CONTRAST_SCALE,
  VENUS_DESCENT_S,
  cloudAdvection,
  cloudOpacity,
  descentAltitudeKm,
  descentIlluminance,
  descentTint,
  flatLightAmount,
  VENUS_CLOUD_VERTEX_GLSL,
  VENUS_CLOUD_FRAGMENT_GLSL,
  VENUS_CLOUD_VERTEX_WGSL,
  VENUS_CLOUD_FRAGMENT_WGSL,
} from "./venus-descent";
import type { StarField } from "./star-field";
import {
  buildStarBillboards,
  buildStarField,
  LIVE_STAR_COUNT,
  mergeStarFields,
} from "./star-field";
import {
  CATALOG_CHUNKS,
  decodeStarCatalog,
  unpackTypeAndColour,
  nearestOfType,
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
  topTwoReveal,
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
  LAYERS_STORAGE_KEY,
  resolveLayers,
  type LayerId,
} from "./render-layers";
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
  WARP_ACCEL_END,
  WARP_DECEL_START,
  FLIP_ROT_START,
  FLIP_ROT_END,
} from "./babylon-ship";
import {
  ARRIVE_STANDOFF,
  PLANET_ARRIVE_STANDOFF,
  clampZoomDistance,
  dampScalar,
  ZOOM_STEP,
  ZOOM_LAMBDA,
  bodyWorldPosition,
  CHASE_LOOK_AHEAD,
  CHASE_LOOK_LAMBDA,
  CHASE_OFFSET_REST,
  chaseOffsetAt,
  cursorRayDir,
  flightInputPolicy,
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
  raySphereDist,
  frameLadderFade,
  figureVisibility,
  furnitureVisibility,
  localFieldVisibility,
  SHIP_MAX_DT,
  SHIP_VIEW_DEPTH,
  SHIP_WARP_SCALE,
  shipScaleFactor,
  stepEmber,
  travelFrame,
  warpDurationForLy,
  advanceWarpV4,
  warpEaseV4,
  warpFlipRate,
  warpFovMult,
  warpSpeedNorm,
  WARP_MIN_MS,
  type Ember,
} from "./ship-dynamics";
// PF-11 D1.1: real byte progress for every boot-path and post-ready fetch.
import {
  fetchWithProgress,
  isBootCritical,
  StageAggregator,
  type LoadStage,
  type StageProgress,
} from "./load-progress";

const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

/* PF-11 D1.1 — the honesty contract's transport.
 *
 * `cosmos:stage` is ADDITIVE and does not touch `cosmos:progress`, whose
 * {loaded,total} payload the HUD and the E2E suite already depend on (the
 * event bus is shared by both engines and its existing shapes never change
 * silently). Everything the pre-flight dossier (D1.2) shows derives from these
 * events — real bytes off a ReadableStream reader, real record counts, real
 * completion signals — never a timed animation. */
const emitStage = (p: StageProgress) => emit("cosmos:stage", p);

/** Completion signal for a boot stage that downloads nothing (engine init, first
 * rendered frame). Zero bytes is the honest reading for these — they are
 * checkpoints, not transfers — so the dossier renders them as a checklist line
 * rather than a byte bar. */
const emitStageDone = (stage: LoadStage) =>
  emitStage({
    stage,
    loadedBytes: 0,
    totalBytes: 0,
    done: true,
    bootCritical: isBootCritical(stage),
  });

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
/** PF-11 D6.4 / R16 — home-orbit angular rate, rad/s, derived from the declared 180 s screen-time
 * period rather than written as a magic number. Real 400 km LEO is 92.7 min; the ~31x compression
 * is a declared license (see HOME_ORBIT_PERIOD_S). */
const HOME_ORBIT_RATE = (2 * Math.PI) / HOME_ORBIT_PERIOD_S;

/** PF-11 D1.3 — the scene's vacuum-black clear colour (kept in sync with the `scene.clearColor`
 * set in `_boot`), as the target the ascent sky-colour lerp converges to. A module const so the
 * lerp and the restore-on-handback agree by construction. */
const SPACE_BLACK_RGB: readonly [number, number, number] = [
  0.003, 0.004, 0.012,
];

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

/* --- PF-11 D4.2: field-object travel target -----------------------------
 *
 * Extracted pure because the two things it does are exactly the two ways this port could fail
 * silently, and neither is visible in a passing render:
 *
 *  - the `fs-<i>` parse and bounds check (a NaN or an out-of-range index would index
 *    `undefined` coordinates and fly the ship to `[NaN,NaN,NaN]`); and
 *  - the **3-float stride**. `space-engine.js`'s `fieldF` is 4 floats per star, Babylon's
 *    `_field.positions` is 3 — the implementation plan prescribed porting the legacy code,
 *    and a verbatim `i*4` port reads a neighbouring star's coordinates and quietly flies
 *    somewhere plausible-looking but wrong. A test pins the stride so it cannot drift back.
 *
 * `ly` is deliberately NOT computed here — it belongs to `fieldInfo`'s dual depth convention
 * (linear for the base HIP field, log-depth for PF-10's bonus layers), and reimplementing that
 * is the duplication this whole slice is avoiding. See `_fieldBody`. */
export function fieldStarTarget(
  id: string,
  positions: Float32Array,
  count: number,
): {
  index: number;
  pos: [number, number, number];
  dir: [number, number, number];
} | null {
  if (!id.startsWith("fs-")) return null;
  const index = parseInt(id.slice(3), 10);
  if (!Number.isInteger(index) || index < 0 || index >= count) return null;
  const pos: [number, number, number] = [
    positions[index * 3],
    positions[index * 3 + 1],
    positions[index * 3 + 2],
  ];
  // A star exactly at the camera origin has no direction to fly along; `|| 1` mirrors the
  // legacy engine's own guard rather than emitting a NaN direction.
  const L = Math.hypot(pos[0], pos[1], pos[2]) || 1;
  return { index, pos, dir: [pos[0] / L, pos[1] / L, pos[2] / L] };
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

/** PF-11 D7.4: max rate for the `cosmos:warp` DOM CustomEvent that drives WarpOverlay's React
 * state during an active warp — audited at full frame rate (up to 60 Hz) driving a setState on
 * every single frame. 10 Hz matches load-progress.ts's `STAGE_PROGRESS_MAX_HZ` precedent for the
 * same class of "real data, but far more UI churn than a visible readout needs" throttle. Phase
 * transitions (accel -> flip -> decel) always emit immediately regardless — see
 * `_lastWarpEmitPhase`. */
const WARP_EVENT_MIN_INTERVAL_MS = 1000 / 10;

/** B3: shared cycle length (seconds) for the shooting-star particles — each
 * particle repeats endlessly at its own phase offset within this cycle (see
 * shooting-stars.ts). Long enough that particles don't feel synchronized,
 * short enough that the sky doesn't read as empty for long stretches. */
const SHOOTING_STAR_CYCLE_S = 5;

/** PF-11 D2.2 — the external-galaxy impostor's CONSTANT distance from the
 * CAMERA (see _updateImpostor's header for why camera-relative: the band
 * skybox is an opaque depth-writing shell at 2000 from the camera, so any
 * world-fixed placement can drift beyond it and depth-fail). 1500 keeps it
 * inside the shell with margin while sitting beyond every world object the
 * camera can park at (deepest curated/SDSS placements ≈ 1360). */
const IMPOSTOR_DIST = 1500;

/** PF-11 D3.2 — RCS attitude puffs (Vega SHOT-BRIEF). Small, short-lived,
 * lateral: they must read as cold gas turning the ship, not as engine fire. */
const RCS_PUFF_COUNT = 5;
const RCS_PUFF_SPEED = 0.25;
const RCS_PUFF_SPREAD = 0.06;
const RCS_PUFF_LIFE = 0.45;

/** idle: parked. aim: launch-turn preview before the burn (position holds).
 * warp: the eased chase-camera flight itself. ascent (PF-11 D1.3): the
 * launch-from-Earth title sequence, a rails climb from the surface to the home
 * vantage. Mirrors space-engine.js's warp.mode values so the host (WarpOverlay,
 * HUD) needs no engine-specific branching. */
type WarpMode = "idle" | "aim" | "warp" | "ascent";

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
  /** PF-11 D1.3: ascent progress, RAW 0..1 wall-clock fraction (the eased `k`
   * is derived from it in `_tickAscent`). Separate from `prog` so the ascent
   * and a warp can never share integration state. */
  ascentProg?: number;
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
async function loadChunkRGB(
  url: string,
  // PF-11 D1.1: when a stage sink is supplied the transfer streams through a
  // ReadableStream reader so real bytes reach the dossier; without one this
  // stays the exact plain fetch it has always been (the decode half below is
  // untouched either way).
  progress?: { stage: LoadStage; sink: (p: StageProgress) => void },
): Promise<Uint8Array> {
  const blob = progress
    ? await fetchWithProgress(url, progress.stage, progress.sink)
    : await (await fetch(url)).blob();
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
 * taken so a silent downgrade cannot masquerade as the real catalog. Also
 * returns the raw decoded RGB chunks (not just the merged field) so a later
 * bonus-layer merge (see `_loadBonusStarLayers`) can re-decode them alongside
 * new chunks without re-fetching/re-decoding the base catalog's images. */
async function loadStarField(
  // PF-11 D1.1: both catalog chunks report into ONE `star-catalog` stage — the
  // aggregator sums them so the dossier's counter never jumps backwards when
  // the second chunk starts.
  agg?: StageAggregator,
): Promise<{
  field: StarField;
  source: "catalog" | "procedural";
  baseChunks: Uint8Array[] | null;
}> {
  try {
    const chunks = await Promise.all(
      CATALOG_CHUNKS.map((u) =>
        loadChunkRGB(
          u,
          agg ? { stage: "star-catalog", sink: agg.sink(u) } : undefined,
        ).catch((e) => {
          // A missing deep layer degrades; a missing base catalog does not.
          if (u === CATALOG_CHUNKS[0]) throw e;
          console.warn(`[babylon-engine] optional chunk ${u} failed`, e);
          return new Uint8Array(0);
        }),
      ),
    );
    const field = decodeStarCatalog(chunks);
    if (field.count === 0) throw new Error("catalog decoded to zero records");
    return { field, source: "catalog", baseChunks: chunks };
  } catch (e) {
    console.warn("[babylon-engine] star catalog failed, using placeholder", e);
    return {
      field: buildStarField(LIVE_STAR_COUNT),
      source: "procedural",
      baseChunks: null,
    };
  }
}

/* PF-10 C1: bonus background-layer chunks — white dwarfs (eDR3, TR-063/065), CNS5 nearby stars,
 * Oort cloud dust — proven Track B (PNG-pack) mechanisms (TR-063/065) wired into real rendering
 * here for the first time. Deliberately NOT part of CATALOG_CHUNKS: those load synchronously
 * before the first frame and gate cosmos:ready, and white dwarfs alone is a real ~5.4 MB asset
 * (359,073 real records) — eagerly blocking startup on that would directly threaten the
 * PF-09/PF-10 startup budgets (≤2.5-4.0s by device class). These fetch AFTER cosmos:ready fires
 * instead (see `_loadBonusStarLayers`), a real progressive-enhancement merge into the already-
 * visible star mesh, matching the same non-blocking philosophy already used for the ship GLB and
 * the Milky Way band's chunked texture build. Order matters: CNS5 first (smallest, most likely
 * useful even under network pressure), Oort cloud second, the cluster background layer third,
 * white dwarfs last (largest).
 *
 * `clusters-bg.png` (PF-10 C1, 12,065 records — see scripts/gaia-clusters-pngpack.mjs) merges
 * the MWSC + Hunt-Reffert 2023 + OCDR2 catalogs, minus the 35 already-curated named clusters
 * (celestial-clusters.js, deduped by real sky position + distance, not name matching). Object
 * type byte 1 ("cluster: soft glow, no PSF core" — ijStarFragmentShader) renders every point
 * exactly the same way the 35 curated clusters already do, just without a per-object dossier.
 */
const BONUS_CATALOG_CHUNKS = [
  "assets/cns5.png",
  "assets/oortcloud.png",
  "assets/clusters-bg.png",
  "assets/whitedwarfs-edr3.png",
] as const;

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
const float CI_UNPACK_SCALE = ${(256 / 255).toFixed(8)};
const float ORBIT_OMEGA_K = ${BELT_ORBIT.omegaK.toFixed(4)};
const float ORBIT_MIN_R = ${BELT_ORBIT.minRadius.toFixed(1)};
const float ORBIT_SUN_Z = ${ASTEROID_BELT.center[2].toFixed(1)};
// PF-11 D6.2: belt-local (ecliptic-aligned) <-> world (equatorial) basis — the same rotation
// babylon-asteroids.ts's toBeltSpace/fromBeltSpace apply, baked as constants (matching this
// module's existing style for ORBIT_SUN_Z above) rather than a uniform, since the obliquity
// never changes at runtime.
const float ORBIT_OBLIQ_COS = ${BELT_OBLIQ_COS.toFixed(7)};
const float ORBIT_OBLIQ_SIN = ${BELT_OBLIQ_SIN.toFixed(7)};`;

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
uniform float uTime;         // PF-10 C3: belt orbital clock (0 = frozen)
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
  // PF-10 C3: real Keplerian orbital motion for the DR3 asteroid belt (type 6 only — every
  // other layer this shader serves is at rest relative to the scene). Rate comes from Kepler's
  // third law applied to the speck's own distance from the Sun, so it costs no per-vertex data;
  // see babylon-asteroids.ts's BELT_ORBIT for the derivation and what is declared about it.
  // ty is hoisted here and reused by the orbital block AND the size/colour branches further
  // down, which used to recompute it. That matters more than it looks: this material is shared
  // with the SDSS layer's 14.5M vertices, so a redundant floor() is 14.5M redundant floor()s
  // per frame. Measured — see TR-075 Part 4.
  float ty = floor(starMeta.y);
  vec3 orbited = position;
  if (uTime > 0.0 && ty > 5.5 && ty < 6.5) {
    // PF-11 D6.2: position in — subtract the Sun's fixed world-Z placement FIRST (ORBIT_SUN_Z
    // is a world-frame translation applied AFTER rotation when baking real data, mirroring
    // eclipticToWorld exactly, so undoing it correctly means translating BEFORE rotating here),
    // then undo the obliquity rotation about world X (babylon-asteroids.ts's toBeltSpace).
    float rz0 = position.z - ORBIT_SUN_Z;
    float lx = position.x;
    float ly = position.y * ORBIT_OBLIQ_COS + rz0 * ORBIT_OBLIQ_SIN;
    float lz = -position.y * ORBIT_OBLIQ_SIN + rz0 * ORBIT_OBLIQ_COS;
    // TRUE heliocentric distance — the Sun sits at belt-local (0,0,0) now that ORBIT_SUN_Z is
    // already subtracted above. Using the planar radius instead overstates the rate by up to
    // +189% for the real objects inclined past 40 degrees (Astra, orbital-motion brief).
    float rOrb = length(vec3(lx, ly, lz));
    if (rOrb > ORBIT_MIN_R) {
      float ang = ORBIT_OMEGA_K * inversesqrt(rOrb*rOrb*rOrb) * uTime;
      float cs = cos(ang), sn = sin(ang);
      float rx = lx*cs - ly*sn, ry = lx*sn + ly*cs, rz = lz;
      // Position out: rotate belt-local -> world (fromBeltSpace's exact rotation), THEN
      // re-apply the Sun's world-Z translation.
      orbited = vec3(rx, ry*ORBIT_OBLIQ_COS - rz*ORBIT_OBLIQ_SIN, ORBIT_SUN_Z + ry*ORBIT_OBLIQ_SIN + rz*ORBIT_OBLIQ_COS);
    }
  }
  vec4 centre = view * vec4(orbited, 1.0);
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

  vType = ty; // hoisted above, before the orbital block — one floor() per vertex, not two
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
uniform float uLayerFade;   // PF-11 D2: per-layer frame-ladder fade (1 = fully present)
void main(){
  float d = length(vCorner);
  if(d > 1.0) discard;
  float ty = floor(vType + 0.5);
  float a;
  if (ty > 0.5 && ty < 1.5)      { a = exp(-d*d*2.6)*0.80; }  // cluster: soft glow, no PSF core
  else if (ty > 2.5 && ty < 3.5) { a = exp(-d*d*4.0)*0.85; }  // galaxy smudge
  else if (ty > 5.5 && ty < 6.5) { a = exp(-d*d*9.0)*0.70; }  // DR3 asteroid: tight, no bloom
  else if (ty > 6.5)             { a = exp(-d*d*3.2)*0.55; }  // oort dust grain
  else { a = exp(-d*d*6.0) + vHalo*exp(-d*3.0)*0.18; }        // stellar PSF + bloom
  gl_FragColor = vec4(vColor, a*vAlpha*uLayerFade);
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
uniform uTime : f32;
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vAlpha : f32;
varying vType : f32;
varying vHalo : f32;

const MIN_QUAD_PX : f32 = 1.5;
const CI_UNPACK_SCALE : f32 = ${(256 / 255).toFixed(8)};
const ORBIT_OMEGA_K : f32 = ${BELT_ORBIT.omegaK.toFixed(4)};
const ORBIT_MIN_R : f32 = ${BELT_ORBIT.minRadius.toFixed(1)};
const ORBIT_SUN_Z : f32 = ${ASTEROID_BELT.center[2].toFixed(1)};
// PF-11 D6.2: line-for-line twin of the GLSL ORBIT_OBLIQ constants above.
const ORBIT_OBLIQ_COS : f32 = ${BELT_OBLIQ_COS.toFixed(7)};
const ORBIT_OBLIQ_SIN : f32 = ${BELT_OBLIQ_SIN.toFixed(7)};

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
  // PF-10 C3: line-for-line twin of the GLSL orbital-motion block above.
  // ty hoisted, exactly as in the GLSL twin — see that comment for why it is load-bearing.
  let ty : f32 = floor(vertexInputs.starMeta.y);
  var orbited : vec3<f32> = vertexInputs.position;
  if (uniforms.uTime > 0.0 && ty > 5.5 && ty < 6.5) {
    // PF-11 D6.2: line-for-line twin of the GLSL basis-change block above.
    let rz0 : f32 = vertexInputs.position.z - ORBIT_SUN_Z;
    let lx : f32 = vertexInputs.position.x;
    let ly : f32 = vertexInputs.position.y * ORBIT_OBLIQ_COS + rz0 * ORBIT_OBLIQ_SIN;
    let lz : f32 = -vertexInputs.position.y * ORBIT_OBLIQ_SIN + rz0 * ORBIT_OBLIQ_COS;
    let rOrb : f32 = length(vec3<f32>(lx, ly, lz));
    if (rOrb > ORBIT_MIN_R) {
      let ang : f32 = ORBIT_OMEGA_K * inverseSqrt(rOrb*rOrb*rOrb) * uniforms.uTime;
      let cs : f32 = cos(ang);
      let sn : f32 = sin(ang);
      let rx : f32 = lx*cs - ly*sn;
      let ry : f32 = lx*sn + ly*cs;
      let rz : f32 = lz;
      orbited = vec3<f32>(
        rx,
        ry*ORBIT_OBLIQ_COS - rz*ORBIT_OBLIQ_SIN,
        ORBIT_SUN_Z + ry*ORBIT_OBLIQ_SIN + rz*ORBIT_OBLIQ_COS);
    }
  }
  var centre : vec4<f32> = uniforms.view * vec4<f32>(orbited, 1.0);
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

  // ty is the one hoisted above (WGSL would reject a redeclaration in the same scope anyway).
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
uniform uLayerFade : f32;   // PF-11 D2: per-layer frame-ladder fade (1 = fully present)

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d : f32 = length(fragmentInputs.vCorner);
  if (d > 1.0) { discard; }
  let ty : f32 = floor(fragmentInputs.vType + 0.5);
  var a : f32;
  if (ty > 0.5 && ty < 1.5) { a = exp(-d * d * 2.6) * 0.80; }
  else if (ty > 2.5 && ty < 3.5) { a = exp(-d * d * 4.0) * 0.85; }
  else if (ty > 5.5 && ty < 6.5) { a = exp(-d * d * 9.0) * 0.70; }
  else if (ty > 6.5) { a = exp(-d * d * 3.2) * 0.55; }
  else { a = exp(-d * d * 6.0) + fragmentInputs.vHalo * exp(-d * 3.0) * 0.18; }
  fragmentOutputs.color = vec4<f32>(fragmentInputs.vColor, a * fragmentInputs.vAlpha * uniforms.uLayerFade);
}`;

// PF-10 C4: planetary sphere twins. Kept in planet-sphere.ts rather than inline here because,
// unlike the star/shoot shaders, these are consumed by pure helpers with JS mirrors the unit
// tests drive directly.
ShaderStore.ShadersStore["ijPlanetVertexShader"] = PLANET_VERTEX_GLSL;
ShaderStore.ShadersStore["ijPlanetFragmentShader"] = PLANET_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijPlanetVertexShader"] = PLANET_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijPlanetFragmentShader"] = PLANET_FRAGMENT_WGSL;
// PF-11 D1.3: the launch-ascent limb-glow rim.
ShaderStore.ShadersStore["ijLimbVertexShader"] = LIMB_VERTEX_GLSL;
ShaderStore.ShadersStore["ijLimbFragmentShader"] = LIMB_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijLimbVertexShader"] = LIMB_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijLimbFragmentShader"] = LIMB_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijVenusCloudVertexShader"] = VENUS_CLOUD_VERTEX_GLSL;
ShaderStore.ShadersStore["ijVenusCloudFragmentShader"] =
  VENUS_CLOUD_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijVenusCloudVertexShader"] =
  VENUS_CLOUD_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijVenusCloudFragmentShader"] =
  VENUS_CLOUD_FRAGMENT_WGSL;

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
// PF-11 D2.2: the external-galaxy impostor (a camera-facing textured disc).
ShaderStore.ShadersStore["ijImpostorVertexShader"] =
  MILKY_WAY_IMPOSTOR_VERTEX_GLSL;
ShaderStore.ShadersStore["ijImpostorFragmentShader"] =
  MILKY_WAY_IMPOSTOR_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijImpostorVertexShader"] =
  MILKY_WAY_IMPOSTOR_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijImpostorFragmentShader"] =
  MILKY_WAY_IMPOSTOR_FRAGMENT_WGSL;
ShaderStore.ShadersStore["ijConstellationVertexShader"] =
  CONSTELLATION_VERTEX_GLSL;
ShaderStore.ShadersStore["ijConstellationFragmentShader"] =
  CONSTELLATION_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijConstellationVertexShader"] =
  CONSTELLATION_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijConstellationFragmentShader"] =
  CONSTELLATION_FRAGMENT_WGSL;
// PF-10 C1: GD-1 connected-trail visual — see gd1-trail.ts's header.
ShaderStore.ShadersStore["ijGd1TrailVertexShader"] = GD1_TRAIL_VERTEX_GLSL;
ShaderStore.ShadersStore["ijGd1TrailFragmentShader"] = GD1_TRAIL_FRAGMENT_GLSL;
ShaderStore.ShadersStoreWGSL["ijGd1TrailVertexShader"] = GD1_TRAIL_VERTEX_WGSL;
ShaderStore.ShadersStoreWGSL["ijGd1TrailFragmentShader"] =
  GD1_TRAIL_FRAGMENT_WGSL;
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
  /** The camera's resting field of view (rad), captured once at construction —
   * the base the PF-11 D3.1 warp FOV breathing widens around. This is the
   * runtime FreeCamera FOV (~0.8 rad), deliberately NOT SHIP_BASE_FOV (70°,
   * a ship-mesh scale constant): breathing around the latter would snap the
   * lens on warp start. */
  private _baseFov = 0;
  /** PF-11 D3.2 (ADR-0011): in-window k-rate multiplier for the current
   * journey — slows k across the flip window so it lasts FLIP_MIN_MS of screen
   * time. 1 = no dilation (reduced motion, or a journey already long enough). */
  private _flipRate = 1;
  /** Relight shoulder expressed in k for the current journey (~0.3 s of
   * wall-clock, capped so a short hop compresses it rather than eating the
   * brake). Feeds `plumeParamsForWarp`'s eased burn envelope. */
  private _relightK = 0.08;
  private _stars?: Mesh;
  private _starMat?: ShaderMaterial;
  // --- PF-11 D2: frame ladder (sky honesty by destination) ---
  /** `_starMat` clone on the main 168,959-star field; carries the local-galaxy
   * collapse fade (D2.2). The base `_starMat` stays with SDSS at fade 1. */
  private _localMat?: ShaderMaterial;
  /** `_starMat` clone on the DR3 asteroid belt; carries the furniture fade (D2.1). */
  private _beltMat?: ShaderMaterial;
  /** Live 0..1 fades, driven per frame from the warp state by `_updateFrameLadder`. */
  private _furnitureFade = 1;
  private _localFieldFade = 1;
  private _furnitureFadeFrom = 1;
  private _furnitureFadeTo = 1;
  private _localFadeFrom = 1;
  private _localFadeTo = 1;
  /** Constellation-figure dissolve (D2.3) — separate, nearer threshold
   * (ly 50→500) than `_localFieldFade`'s extragalactic collapse; multiplies
   * into `_conMat`'s alpha alongside it in `_pushAberration`. */
  private _figureFade = 1;
  private _figureFadeFrom = 1;
  private _figureFadeTo = 1;
  /** False once the belt has faded out — belt Havok forces/shake sleep (D2.1). */
  private _beltPhysicsAwake = true;
  /** External-galaxy impostor (D2.2): a license-clean procedural disc that
   * appears toward home once the local field collapses at an extragalactic
   * arrival (Astra §1). */
  private _impostorMesh?: Mesh;
  private _impostorMat?: ShaderMaterial;
  private _impostorTex?: RawTexture;
  private _impostorVisible = false;
  /** Direction (unit, toward the destination) and real distance (ly) of the
   * last extragalactic target — the impostor sits astern of it, sized by the
   * true angular subtense. */
  private _farDestDir: [number, number, number] = [0, 0, -1];
  private _farDestLy = 0;
  private _shootMesh?: Mesh;
  // --- GAP-01/GAP-02: curated celestial bodies ---
  private _bodyMesh?: Mesh;
  private _bodyMat?: ShaderMaterial;
  private _photoMesh?: Mesh;
  private _photoMat?: ShaderMaterial;
  private _photoTex?: Texture;
  private _bodyCount = 0;
  private _photoBodyCount = 0;
  /** PF-10 C4.2: keeps the streamed elevation-detail atlas in step with where the camera is
   * actually looking.
   *
   * Cheap every frame, expensive only when the visible TILE RECT changes — which for a rotating
   * body is on the order of once per tile-width of rotation, not once per frame. Everything here
   * is additive: the sphere is already correct before any tile arrives, so a slow or failed
   * stream costs detail and nothing else. */
  private _tickPlanetVt(
    key: string,
    bodyPos: readonly [number, number, number],
    spin: number,
  ) {
    const vt = VT_BODIES[key];
    const mat = this._planetMat;
    if (!vt || !mat) return;

    // Which level this viewport actually needs — the whole reason level 5 is not shipped is that
    // this function can never ask for it (see planet-vt.ts's measured table).
    const needed = Math.min(
      window.innerHeight * (window.devicePixelRatio || 1),
      4320,
    );
    const level = Math.min(
      vt.maxLevel,
      levelForViewport(PLANET_PATCH_DEG, needed),
    );
    const uv = subCameraUV(this.cam, bodyPos, spin);
    // The shader samples at tUV = vUV + UV_LONGITUDE_OFFSET, so the rect must be computed in that
    // same shifted space or the atlas would land half a world away from where it is sampled.
    const rect = patchRect(
      [(uv[0] + UV_LONGITUDE_OFFSET) % 1, uv[1]],
      PLANET_PATCH_DEG,
      level,
    );
    if (!rectChanged(this._planetVtRect, rect)) return;
    this._planetVtRect = rect;

    const pending = key;
    void composeAtlas(rect, `/assets/planets/vt/${key}`, VT_TILE_PX)
      .then((atlas) => {
        // Guarded on BOTH the body and the rect: an arrival elsewhere, or a rotation past the
        // next tile boundary, invalidates an atlas that is still composing.
        if (
          !atlas ||
          this._planetBodyId !== pending ||
          this._planetVtRect !== rect ||
          !this._planetMat
        ) {
          return;
        }
        // PF-11 D7.4: `toDataURL("image/png")` synchronously PNG-encodes a canvas up to
        // 4096x4096x4 = 64 MB on the main thread, and `new Texture(dataUrl, scene)` then
        // decodes that PNG straight back into pixels to upload — a pure round trip through a
        // codec neither side needed. Reading the canvas' own ImageData and uploading it
        // directly skips both the encode and the decode; `getContext("2d")` on an
        // already-2D canvas (composeAtlas required one to draw the tiles) always returns the
        // same context, so the toDataURL path below is an unreached defensive fallback only.
        const atlasCtx = atlas.canvas.getContext("2d");
        const tex = atlasCtx
          ? RawTexture.CreateRGBATexture(
              atlasCtx.getImageData(
                0,
                0,
                atlas.canvas.width,
                atlas.canvas.height,
              ).data,
              atlas.canvas.width,
              atlas.canvas.height,
              this._scene ?? null,
              true,
              true,
            )
          : new Texture(atlas.canvas.toDataURL("image/png"), this._scene);
        tex.wrapU = Texture.CLAMP_ADDRESSMODE;
        tex.wrapV = Texture.CLAMP_ADDRESSMODE;
        this._planetMat.setTexture("detailTex", tex);
        this._planetMat.setVector4(
          "uDetailRect",
          new Vector4(rect.uv[0], rect.uv[1], rect.uv[2], rect.uv[3]),
        );
        this._planetMat.setFloat("uHasDetail", 1);
        this._planetDetailTex?.dispose();
        this._planetDetailTex = tex;
        this._planetVtLoaded = atlas.loaded;
      })
      .catch(() => {
        /* detail is additive; a failure leaves the base surface exactly as it was */
      });
  }

  /** PF-10 C4.2: the Venus cloud descent.
   *
   * Played as a PARAMETER rather than a camera move, and that is a real constraint rather than a
   * shortcut: at PLANET_SPHERE_RADIUS = 26 the entire 70 km cloud deck is 0.097 world units
   * thick, so a literally-scaled descent would translate the camera by a tenth of a unit and put
   * both shells inside each other's depth precision. Wall-clock progress therefore maps onto REAL
   * ALTITUDE (venus-descent.ts), and every visual — cloud opacity, illuminant colour,
   * illuminance, and the lighting fork — keys off that altitude. The altitudes and their ordering
   * are real; only their mapping to world units is declared.
   *
   * Reduced motion holds the descent at its end state rather than animating: you arrive already
   * below the deck, looking at the surface, which is the informative frame. */
  private _tickVenusDescent(
    key: string,
    bodyPos: readonly [number, number, number],
    mat: ShaderMaterial,
  ) {
    if (key !== "venus" || !this._venusDescentStart) return;
    const elapsed = (performance.now() - this._venusDescentStart) / 1000;
    const t = this._reduced ? 1 : Math.min(1, elapsed / VENUS_DESCENT_S);
    const altKm = descentAltitudeKm(t);
    this._venusAltitudeKm = altKm;

    // Astra's core mandate: below the deck a RADAR map must not be lit directionally.
    mat.setFloat("uFlatLight", flatLightAmount(altKm));
    mat.setFloat("uFlatLevel", descentIlluminance(altKm));
    const [tr, tg, tb] = descentTint(altKm);
    mat.setVector3("uFlatTint", this._venusTintScratch.set(tr, tg, tb));

    const cloud = this._venusCloud;
    const cloudMat = this._venusCloudMat;
    if (!cloud || !cloudMat) return;
    const op = cloudOpacity(altKm);
    cloud.isVisible = op > 0.001;
    cloud.position.set(bodyPos[0], bodyPos[1], bodyPos[2]);
    cloudMat.setFloat("uOpacity", op);
    // Real 100 m/s super-rotation at REAL time 1.0x — on the 1e3 rotation clock this would be
    // 100 km/s, i.e. 0.033c (Astra).
    cloud.rotation.y = this._reduced ? 0 : cloudAdvection(elapsed);
  }

  // --- GAP-03: Milky Way band ---
  private _bandMesh?: Mesh;
  private _bandMat?: ShaderMaterial;
  private _bandTex?: RawTexture;
  /** 1x1 stand-in bound until the real equirect texture finishes building —
   * see _setupMilkyWay's WebGPU regression note. Disposed once swapped out. */
  private _bandPlaceholderTex?: RawTexture;
  /** PF-11 D0.1: owns the row cursor + RGBA buffer, sliced by time budget.
   * Driven from the render loop AND the `_bandBuildTimer` chain below. */
  private _bandBuilder?: MilkyWayBandBuilder;
  /** Pending `setTimeout(0)` build slice — the between-frames driver that
   * decouples total build wall-time from frame delivery. Cleared on dispose. */
  private _bandBuildTimer?: ReturnType<typeof setTimeout>;
  /** PF-11 D3.3: pending `setTimeout(0)` that launches a queued retarget one
   * task after arrival. Cleared on dispose, same reason as the band timer. */
  private _retargetTimer?: ReturnType<typeof setTimeout>;
  private _bandReady = false;
  private _bandFadeAmt = 0;
  // --- GAP-04: constellation figures ---
  private _conMesh?: Mesh;
  private _conMat?: ShaderMaterial;
  private _conCount = 0;
  // --- PF-10 C1: GD-1 connected-trail visual ---
  private _gd1Mesh?: Mesh;
  private _gd1SegmentCount = 0;
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
   * swells at arrival — see nebula-field.ts NEBULA_REVEAL). Sized to
   * NEBULA_VOLUMES.length, not a fixed 4 — the 2026-07-20 amendment made
   * the volume count arbitrary; only the GPU-side uniform footprint (the
   * top-2 nonzero entries, computed per frame below) stays fixed. */
  private _nebulaReveal: number[] = NEBULA_VOLUMES.map(() => 0);
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
  /** PF-11 D7.4: last flare length the plume geometry was rebuilt for. Under normal motion
   * `plumeFlareLength` includes a continuous `sin(t*…)` jitter term (deliberate — it is the
   * idle-breathing/burn-flicker visual), so this rarely repeats and rarely skips anything; the
   * real payoff is reduced motion, where the jitter term is dropped and the value holds exactly
   * constant for as long as the phase doesn't change (`null` forces the first frame to build). */
  private _lastPlumeFlareLen: number | null = null;
  private _shimmer?: PostProcess;
  // --- GAP-07: ember sparks ---
  private _embers: Ember[] = [];
  /** PF-11 D3.2: live main-drive envelope (1 burn … 0 cut) — exposed for E2E. */
  private _burnEnv = 1;
  /** PF-11 D3.2: one-shot latches for the two RCS bursts (rotation start/end),
   * reset per journey in `_beginWarp`. */
  private _rcsFired: [boolean, boolean] = [false, false];
  /** Bursts queued by the flip choreography, drained by `_emitRcsPuffs` in the
   * ember pass (where the hull pose and scale are already in hand). */
  private _rcsPending = 0;
  private _burnPrev = false;
  private _emberMesh?: Mesh;
  private _emberMat?: ShaderMaterial;
  private _emberPos = new Float32Array(MAX_EMBERS * 4 * 3);
  private _emberMeta = new Float32Array(MAX_EMBERS * 4 * 2);
  /** PF-11 D7.4: the ember buffer was rebuilt and re-uploaded to the GPU every frame even
   * with zero live embers (the common case — bursts are momentary). -1 forces the first
   * frame to build regardless. */
  private _lastEmberCount = -1;
  /** Shimmer uniforms staged by _tickShip, pushed in the post-process's
   * onApply (the effect object is only valid there). */
  private _shimmerState = { cx: 0.5, cy: 0.5, intensity: 0, aspect: 1 };
  // --- B4 step 1: Havok asteroid field ---
  /** havok = live rigid bodies; visual = kinematic drift (no SIMD, init
   * failure, or reduced motion — the plan's render-without-physics tier). */
  private _physicsMode: "off" | "loading" | "havok" | "visual" | "failed" =
    "off";
  /** PF-11 D7.5: the dynamically-imported `PhysicsMotionType` enum, captured once when Havok
   * initialises so `_setBeltPhysicsAwake` can call `setMotionType` without a second import.
   * `typeof import(...)` is a type-space-only reference — it costs nothing in the bundle; the
   * one runtime import stays exactly where it already was, inside `_setupPhysicsInner`. */
  private _physicsMotionType?: typeof import("@babylonjs/core/Physics/v2/IPhysicsEnginePlugin").PhysicsMotionType;
  private _asteroidField?: AsteroidField;
  private _asteroidInstances: InstancedMesh[] = [];
  private _asteroidBodies: PhysicsBody[] = [];
  /** Scratch position/velocity for the visual-only integrator. */
  private _asteroidPos?: Float32Array;
  private _asteroidVel?: Float32Array;
  private _asteroidPull = new Vector3();
  /** 2026-07-29 code review, finding 3 — reused destination for `beltPullAccelInto` in the
   * per-frame Havok force loop, so that loop allocates nothing per rock. */
  private _beltPullScratch = new Float64Array(3);
  /** PF-11 D7.4 — same reuse for `passageDeflectForceInto`, the loop's other per-rock tuple
   * allocation (only live during an in-progress warp, but still a per-frame allocation the
   * render loop should not make). */
  private _deflectScratch = new Float64Array(3);
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
  /** PF-11 D5.3 — memoizes `nearestFieldOfType`'s O(f.count) scan per coarse camera-position
   * "epoch" (world units rounded to a 5-unit grid): the search console re-derives its class
   * rows on every keystroke, but "the nearest white dwarf" changes far slower than that — only
   * when the ship has actually moved a meaningful distance, not every render. */
  private _classEpochCache: {
    epoch: string;
    byType: Map<number, number>;
  } | null = null;
  /* PF-10 C1: base-catalog raw RGB chunks (stars-hip.png + deep.png, already fetched+decoded
   * at boot), retained so a bonus-layer merge can re-decode them alongside new chunks in one
   * decodeStarCatalog call instead of re-fetching/re-decoding the base catalog's images. Null
   * when the base catalog itself fell back to the procedural field (nothing real to merge with,
   * and no reason to make the placeholder pretend otherwise). */
  private _baseCatalogRgb: Uint8Array[] | null = null;
  /** Guards `_loadBonusStarLayers` to run at most once per boot. */
  private _bonusLayersRequested = false;
  /** PF-10 C2: the SDSS DR18 galaxy field — a SEPARATE mesh from `_stars` (log-depth-scaled
   * positions, incompatible with the star field's linear-ly convention; see ADR-0007's
   * consequences and `scripts/gaia-sdss18-pngpack.mjs`'s header). Shares `_starMat` (the
   * `ijStar` material is already generic on the object-type byte; galaxies are type 3). */
  private _sdssMesh?: Mesh;
  private _sdssGalaxyCount = 0;
  /** Guards `_loadSdssGalaxyLayer` to run at most once per boot. */
  private _sdssLayerRequested = false;
  /** PF-11 D7.3: lazily created, reused for every decode request this engine instance makes
   * (today, only the one SDSS fetch). Never explicitly terminated — it is exactly as long-lived
   * as the `<babylon-scene>` element itself, and `dispose()` below tears it down with everything
   * else. */
  private _catalogWorker?: Worker;
  private _catalogWorkerReqId = 0;
  /** PF-10 C3: the full real Gaia DR3 asteroid belt — again a SEPARATE mesh from `_stars`
   * (belt-frame world units, not the star field's light-year convention). Shares `_starMat`;
   * object-type byte 6. The bounded Havok subset is a different thing entirely — see
   * `_setupPhysicsInner`. */
  private _asteroidVisualMesh?: Mesh;
  private _asteroidVisualCount = 0;
  /** Guards `_loadAsteroidVisualLayer` to run at most once per boot. */
  private _asteroidLayerRequested = false;
  // --- PF-10 C4: the single destination-gated planet sphere ---
  private _planetMesh?: Mesh;
  private _planetMat?: ShaderMaterial;
  private _planetManifest: PlanetManifest | null = null;
  /** Which body the sphere is currently dressed as; null when hidden. */
  private _planetBodyId: string | null = null;
  private _planetSurfaceTex?: Texture;
  /** PF-10 C4 closeout: pre-baked relief for the nine normal-mapped bodies. */
  private _planetNormalTex?: Texture;
  /** The neutral-normal (128,128,255) 1x1 bound whenever a body ships no relief — see TR-059. */
  private _planetFlatNormalTex?: Texture;
  /** Black 1x1 for the cloud/specular samplers on every body that is not Earth. */
  private _planetBlackTex?: Texture;
  private _planetCloudTex?: Texture;
  private _planetNightTex?: Texture;
  /** CLAUDE.md #23: keeps Babylon's canvas out of the tab order no matter when its deferred
   * input setup re-stamps tabindex. Disconnected on teardown. */
  private _tabIndexGuard?: MutationObserver;
  /** PF-11 D6.4 / R16: armed on arriving home, cleared on any departure. */
  private _homeOrbit = false;
  private _homeOrbitPhase = 0;
  /** TR-103 zoom feature (Vega SHOT-BRIEF, owner-requested): the parked target's world
   * position (curated body, `fs-` field object) that zoom dollies toward/away from —
   * null when not usefully defined (mid-warp, or in the home orbit, which has its own
   * radius-based system below and doesn't need a fixed bearing since the orbit itself
   * continuously changes bearing by design). Set at arrival (`_tickWarp`'s k>=1
   * branch), read only while `warp.mode === "idle"`. */
  private _parkedTargetPos: [number, number, number] | null = null;
  /** Unit vector from `_parkedTargetPos` TO the camera, fixed at arrival and untouched
   * by free-look (which only ever changes `_yaw`/`_pitch`/`_camQuat` — the VIEW
   * direction — never camera position). Zoom dollies along this fixed bearing, so it
   * composes with free-look instead of fighting it: looking around never changes where
   * the camera stands, zooming never changes which way the visitor was looking. */
  private _camBearing: [number, number, number] = [0, 0, 1];
  /** Current and target standoff distance for the zoom feature — eased toward the
   * target every idle frame (`dampScalar`, snapped instantly under reduced motion,
   * matching this repo's existing `_reduced` convention for driven camera values).
   * Reset to the real arrival distance at every fresh arrival/home-orbit re-arm, so a
   * zoom level from one body never carries over to the next. */
  private _zoomDist = ARRIVE_STANDOFF;
  private _zoomTargetDist = ARRIVE_STANDOFF;
  /** The distance THIS arrival actually used (== `PLANET_ARRIVE_STANDOFF`,
   * `ARRIVE_STANDOFF`, or `HOME_ORBIT_RADIUS`) — a fixed reference for
   * `clampZoomDistance`'s bounds, set once at arrival and never itself changed by
   * zooming. Kept separate from `_zoomTargetDist`, which DOES change with every zoom
   * step — clamping a moving value against itself would let the ceiling/floor drift
   * away with every step instead of bounding the zoom range. */
  private _zoomRestDist = ARRIVE_STANDOFF;
  /** Whether the current parked target is planet/moon/dwarf-class — selects which of
   * `clampZoomDistance`'s two floor policies applies (absolute near-clip-safe margin
   * for a real rendered sphere, vs. a fraction of resting distance for a point-like
   * DSO/star/field object, which has nothing physical to collide with). */
  private _zoomIsPlanet = false;
  /** Bug fix (owner-reported, post-D6.4): the home orbit's per-frame "aim at the planet"
   * driver used to run every frame the visitor wasn't actively mid-drag — including the
   * very next frame after a drag ENDED — so releasing a drag snapped the view straight
   * back to Earth, making it look like dragging did nothing. `true` once the visitor has
   * looked around at all since the orbit was last (re)armed; from then on the auto-aim
   * stays off for the rest of this orbit, matching how free-look already behaves
   * everywhere else in the scene (drag persists after release). The camera's ORBITAL
   * POSITION is unaffected either way — R16 only asked for the ship to keep moving around
   * Earth, never for the view to be locked onto it. */
  private _homeLookOverridden = false;
  /** PF-11 D1.3: the launch ascent's own progress (0..1 raw wall-clock fraction), mirrored on
   * `warp.ascentProg`; kept as a field too so `sceneStats` and the skip path can read it. */
  private _ascentProg = 0;
  /** The limb-glow shell (fresnel rim just outside Earth), visible only during the ascent's
   * 80-120 km beat. Lazily built on the first ascent. */
  private _limbMesh?: Mesh;
  private _limbMat?: ShaderMaterial;
  private _planetSpecularTex?: Texture;
  private _planetHeightTex?: Texture;
  /** TR-059: a real 1x1 texture bound to BOTH samplers before the mesh can draw. */
  private _planetPlaceholderTex?: RawTexture;
  /** Reused so the per-frame camera push allocates nothing (frame-budget rule). */
  private _camScratch = new Vector3();
  /** Which surface tier is bound -- "high" until the ultra upgrade lands. */
  private _planetSurfaceTier: "base" | "high" | "ultra" = "high";
  /** Current rotation angle, exposed for E2E. */
  private _planetSpin = 0;
  /** PF-10 C4.2 streamer state. */
  private _planetVtRect: PatchRect | null = null;
  private _planetVtLoaded = 0;
  private _planetDetailTex?: Texture;
  /** PF-10 C4.2 Venus descent state. */
  private _venusCloud?: Mesh;
  private _venusCloudMat?: ShaderMaterial;
  private _venusDescentStart = 0;
  private _venusAltitudeKm = 0;
  private _venusTintScratch = new Vector3();
  /** Last value pushed to the belt's orbital `uTime`. Exposed in sceneStats so the
   * reduced-motion contract is assertable as BEHAVIOUR (the clock stays 0) rather than only as
   * shader source text — the positions themselves are computed on the GPU and invisible to JS. */
  private _beltOrbitClock = 0;
  // --- GAP-06: relativistic aberration + Doppler ---
  /** Brachistochrone-profile beta (v/c), integrated from warp.prog exactly
   * like space-engine.js's `this._beta` — ramps with the accel/decel curve
   * during warp, decays 0.86x/frame otherwise. */
  private _beta = 0;
  // --- PF-11 D7.4: cosmos:warp -> React throttle ---
  /** `performance.now()` of the last `cosmos:warp` DOM dispatch. Internal engine state (warp
   * progress, β, camera) still updates every frame regardless of this — only the CustomEvent
   * that drives React's WarpOverlay setState is throttled, per the audited finding that this
   * was firing (and re-rendering React) at full frame rate during every warp. */
  private _lastWarpEmitMs = 0;
  /** Last emitted `phase` string — a phase CHANGE always emits immediately regardless of the
   * throttle window below, so the accel/flip/decel transition the HUD and the E2E suite key
   * off can never be coalesced away by unlucky timing (the flip window is the narrowest, ~6%
   * of a typical journey). */
  private _lastWarpEmitPhase: "accel" | "flip" | "decel" | null = null;
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
  /** PF-11 D7.4: id -> body, built once in `connectedCallback` alongside `bodies` itself (which
   * never mutates after boot). Every by-id lookup against the curated catalog should use this
   * instead of `bodies.find(...)`. */
  private _bodyById = new Map<string, BabylonBody>();
  stations: BabylonBody[] = [];
  cam: [number, number, number] = [0, 0, 0];
  arrivedId: string | null = null;
  /** PF-11 D3.3 (ADR-0010) — the destination picked DURING a journey, launched
   * the moment that journey lands. Public because it is display state: the HUD
   * badge and the Where-To console's mid-warp row both render from it, and a
   * queue nobody can see would be the silent no-op this slice exists to kill.
   * Last selection wins; `goHome` (abort or otherwise) clears it. */
  queuedTargetId: string | null = null;
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

  // --- PF-11 D9.1: Render Console layer state ---
  /** Resolved once at boot (URL `?layers=` -> localStorage -> tier default, via
   * `resolveLayers`) and updated live by `setLayers()`/the `layers` attribute. Every id in
   * `LAYERS` is always present. Layers marked `implemented: false` in the registry
   * (`star-field`, `bonus-stars`, `gaia-tiny`) have their state tracked here for
   * forward-compatibility but `_applyLayerToggle` does nothing for them today. */
  private _layerState: Record<LayerId, boolean | number> = resolveLayers(
    null,
    null,
    "balanced",
  );
  /** `nebula-volumes`/`milky-way-band` have no existing on/off flag of their own (unlike
   * `constellations`, which already had `_showConstellations`) — these back the new toggle. */
  private _nebulaLayerEnabled = true;
  private _bandLayerEnabled = true;

  // --- GAP-12: HTML attribute parity with space-engine.js's
  // observedAttributes/attributeChangedCallback (density/constellations/
  // ship/craft) ---
  static get observedAttributes() {
    return ["density", "constellations", "ship", "craft", "layers"];
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
    } else if (name === "layers") {
      // PF-11 D9.1: mirrors the `?layers=` URL param's own format so a spec (or a future
      // markup-driven default) can set the same string either way. Malformed JSON is ignored
      // rather than thrown — an attribute value is easier to typo than a URL param, and this
      // must never be the reason the scene fails to boot.
      if (!value) return;
      try {
        const parsed = JSON.parse(value) as Partial<
          Record<LayerId, boolean | number>
        >;
        this.setLayers(parsed);
      } catch (e) {
        console.warn("[babylon-engine] malformed layers attribute", e);
      }
    }
  }

  /** PF-11 D9.1: the Render Console's engine-side surface. Merges `config` into the current
   * layer state and applies only the ids that actually changed (a `setLayers({})` or a repeat
   * of the current value is a no-op, not a redundant fetch/dispose/toggle). Always emits
   * `cosmos:layers` with the FULL resolved state afterward — even a no-op call — so a UI that
   * calls this speculatively (e.g. applying a preset) can trust the event as the source of
   * truth rather than diffing its own optimistic state. */
  setLayers(config: Partial<Record<LayerId, boolean | number>>) {
    for (const entry of Object.entries(config)) {
      const id = entry[0] as LayerId;
      const value = entry[1];
      if (value === undefined || this._layerState[id] === value) continue;
      this._layerState[id] = value;
      this._applyLayerToggle(id, value);
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(
          LAYERS_STORAGE_KEY,
          JSON.stringify(this._layerState),
        );
      } catch {
        // Private-browsing/storage-full — the in-memory state above is still correct for this
        // session; only cross-session persistence is lost.
      }
    }
    emit("cosmos:layers", { ...this._layerState });
  }

  /** Whether `id`'s CURRENT resolved state means "on" — `false` and `0` both read as off (a
   * `0` chunk-prefix is `gaia-tiny`'s "nothing enabled yet" state, once D8 ships it), any
   * other number or `true` reads as on. Centralised so `_applyLayerToggle` and
   * `_updateFrameLadder`'s `belt-physics` gate can't drift apart on what "on" means. */
  private _layerOn(id: LayerId): boolean {
    const v = this._layerState[id];
    return v !== false && v !== 0;
  }

  /** Applies the IMMEDIATE effect of one layer's new value. `belt-physics` and `planet-hires`
   * have no entry here — both are read LIVE where they're consulted (`_updateFrameLadder`
   * combines `belt-physics` with the existing D2.1 distance fade every frame; `_tickPlanetSphere`
   * reads `planet-hires` each time a body is dressed) rather than needing a push here.
   * `star-field`/`bonus-stars`/`gaia-tiny` are intentionally absent — see their `implemented:
   * false` registry entries for why each one specifically can't be toggled today. */
  private _applyLayerToggle(id: LayerId, value: boolean | number) {
    const on = value !== false && value !== 0;
    switch (id) {
      case "sdss-field": {
        const scene = this._scene;
        const engine = this._engine;
        if (on) {
          if (this._sdssMesh) this._sdssMesh.setEnabled(true);
          else if (!this._sdssLayerRequested && scene && engine) {
            void this._loadSdssGalaxyLayer(scene, engine);
          }
        } else {
          // PF-11 D9.1 exit criteria: disabling a heavy layer should actually release its
          // GPU/CPU geometry, not just hide it — re-enabling re-fetches (usually HTTP-cache-
          // absorbed), the same trade D7.2's texture-departure disposal already accepted.
          this._sdssMesh?.dispose();
          this._sdssMesh = undefined;
          this._sdssGalaxyCount = 0;
          this._sdssLayerRequested = false;
        }
        break;
      }
      case "belt-visual": {
        const scene = this._scene;
        const engine = this._engine;
        if (on) {
          if (this._asteroidVisualMesh)
            this._asteroidVisualMesh.setEnabled(true);
          else if (!this._asteroidLayerRequested && scene && engine) {
            void this._loadAsteroidVisualLayer(scene, engine);
          }
        } else {
          this._asteroidVisualMesh?.dispose();
          this._asteroidVisualMesh = undefined;
          this._asteroidVisualCount = 0;
          this._asteroidLayerRequested = false;
        }
        break;
      }
      case "nebula-volumes": {
        this._nebulaLayerEnabled = on;
        this._nebulaMesh?.setEnabled(on);
        break;
      }
      case "gd1-trail": {
        this._gd1Mesh?.setEnabled(on);
        break;
      }
      case "constellations": {
        // Same effect the pre-existing `constellations` HTML attribute already produces —
        // this is the second way to reach it, not a competing mechanism.
        this._showConstellations = on;
        this._conMesh?.setEnabled(on);
        break;
      }
      case "milky-way-band": {
        // No direct setEnabled — _tickMilkyWay already drives visibility via `uFade`
        // (boot ramp x the D2.2 extragalactic-collapse fade); this just adds a third
        // multiplicand to that same product, read every tick.
        this._bandLayerEnabled = on;
        break;
      }
      default:
        break; // belt-physics, planet-hires (read live), star-field/bonus-stars/gaia-tiny (not implemented)
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
      // PF-11 D1.1/D1-AC7: the no-WebGL visitor's dossier must not hang waiting
      // for stages that will never run. Close every boot-critical stage here so
      // the pre-flight surface resolves to the DOM fallback promptly, rather
      // than stalling and then arming LAUNCH over a scene that cannot start.
      emitStageDone("engine-init");
      emitStageDone("star-catalog");
      emitStageDone("atlas-map");
      emitStageDone("first-frame");
      emit("cosmos:progress", { loaded: 0, total: 0 });
      emit("cosmos:ready", {});
      return;
    }
    this._engine = engine;
    this.backend = backend;
    emitStageDone("engine-init");

    // B6 accessibility re-audit fix: Babylon's engine sets tabindex="1" on
    // its canvas — a POSITIVE tabindex that hijacks the page tab order
    // (canvas would focus before the skip link; axe flags it serious). This
    // path has no canvas-level keyboard interaction (all input rides the
    // shared chrome), so the canvas leaves the tab order entirely.
    canvas.tabIndex = -1;

    // PF-11 D6.4 HARDENING (CLAUDE.md #23, TR-088). The line above and the per-frame re-assert
    // at the top of the render loop still leave one window open, and the render loop's own
    // comment records it happening once already: Babylon's deferred pointer setup can re-stamp
    // tabindex="1" BEFORE the first frame ever runs, and an axe scan landing in that window sees
    // a serious violation. Nothing about when that window opens is under this code's control —
    // it is whenever Babylon's lazy input setup happens to fire — so a MutationObserver closes it
    // rather than another timing guess. An accessibility contract must not depend on frame
    // pacing, which is exactly what moving the re-assert to the top of the frame was already
    // trying to say; this finishes the thought.
    this._tabIndexGuard?.disconnect();
    this._tabIndexGuard = new MutationObserver(() => {
      if (canvas.tabIndex !== -1) canvas.tabIndex = -1;
    });
    this._tabIndexGuard.observe(canvas, {
      attributes: true,
      attributeFilter: ["tabindex"],
    });

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
    // PF-11 D9.1: resolved AFTER _quality so its tier default is the one that actually
    // booted (backend + device + ?tier= all folded in already), same resolution order as
    // every other override this file has (?layers= URL -> localStorage -> tier default).
    this._layerState = resolveLayers(
      new URLSearchParams(window.location.search).get("layers"),
      typeof localStorage !== "undefined"
        ? localStorage.getItem(LAYERS_STORAGE_KEY)
        : null,
      this._quality.name,
    );
    this._nebulaLayerEnabled = this._layerState["nebula-volumes"] !== false;
    this._bandLayerEnabled = this._layerState["milky-way-band"] !== false;
    // `constellations` already had its own attribute-driven flag (GAP-12) — the layer state
    // just becomes a second way to set the SAME flag, at boot rather than only post-boot.
    this._showConstellations = this._layerState["constellations"] !== false;

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
    // PF-11 D3.1: remember the resting FOV — the base the warp lens breathes
    // around (see _baseFov). Captured before any warp can widen it.
    this._baseFov = camera.fov;

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
    // PF-11 D7.4: `this.bodies` is fixed for the life of this element (assigned exactly once,
    // here) — an id->body Map built once now turns every by-id lookup below from an O(bodies)
    // `.find` into O(1), including `_tickPlanetSphere`'s, which runs every frame.
    this._bodyById = new Map(this.bodies.map((b) => [b.e.id, b]));

    // PF-11 D1.1: the largest boot-critical download (2.02 + 0.87 MB), and the
    // one the pre-flight dossier spends most of its time showing. No try/finally
    // is needed to guarantee the stage closes: `loadStarField` cannot throw — it
    // catches internally and degrades to the procedural field — so this line is
    // reached on every path, including a total asset failure, and the stage
    // always ends with a real record count.
    const catalogStage = new StageAggregator("star-catalog", emitStage);
    const { field, source, baseChunks } = await loadStarField(catalogStage);
    catalogStage.finish(field.count);
    this.starSource = source;
    this._baseCatalogRgb = baseChunks;

    // one merged indexed mesh of billboard quads (see star-field.ts for why
    // neither point sprites nor thin instances are usable here)
    const mesh = new Mesh("stars", scene);
    this._stars = mesh;
    this._applyStarFieldGeometry(field, engine);
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
          "uTime",
          "uLayerFade",
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
    // PF-10 C3: the belt's orbital clock. Must be initialised even under reduced motion —
    // an unbound sampler-or-uniform is the TR-059 class of failure, and 0 is also exactly the
    // reduced-motion contract (a frozen but correctly-placed belt, not a missing one).
    mat.setFloat("uTime", 0);
    // PF-11 D2: fully present by default. The base material stays at 1 (SDSS,
    // which shares it, must never fade — Astra §1); the belt and local-field
    // clones below carry the destination-keyed fade.
    mat.setFloat("uLayerFade", 1);
    const pushViewport = () =>
      mat.setVector2(
        "uViewport",
        new Vector2(engine.getRenderWidth(), engine.getRenderHeight()),
      );
    pushViewport();
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_ADD;
    this._starMat = mat; // GAP-06: aberration/Doppler uniforms pushed here
    // PF-11 D2.2: the 168,959-star local field collapses at extragalactic
    // arrivals (Astra §1). Its own clone so `uLayerFade` differs from SDSS's
    // (which stays on the base `mat` at 1) and the belt's. Clones share the
    // compiled program; per-clone uniforms are cheap. Created here, right after
    // the base is fully configured, so it inherits uSize/uHaloAmp/uViewport/
    // uTime/uLayerFade=1 at clone time (see _pushAberration / resize / uTime
    // fan-out for the per-frame uniforms it must keep receiving too).
    const localMat = mat.clone("ijStarLocal");
    localMat.backFaceCulling = false;
    localMat.alphaMode = Constants.ALPHA_ADD;
    this._localMat = localMat;
    mesh.material = localMat;
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
    this._setupImpostor(scene, backend); // PF-11 D2.2
    this._setupConstellations(scene, backend);
    this._setupStarTrails(scene, engine, backend, field);
    // PF-10 C4: the planet sphere. Built hidden; revealed by _tickPlanetSphere on arrival.
    this._setupPlanetSphere(scene, backend);
    // PF-10 C1: GD-1 connected-trail visual — see gd1-trail.ts's header.
    this._setupGd1Trail(scene, engine, backend);

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
      this._updateFrameLadder(); // PF-11 D2 — before band/asteroids read the fades
      this._tickMilkyWay();
      this._tickTrails();
      this._tickNebula(camera, engine);
      this._tickShip(camera, engine);
      this._tickAsteroids();
      this._tickPlanetSphere(); // PF-10 C4
      this._tickStations(camera, engine); // GAP-11
      shootMat.setFloat("uTime", performance.now() / 1000);
      const bodyT = this._reduced ? 0 : performance.now() / 1000;
      this._bodyMat?.setFloat("uTime", bodyT);
      this._photoMat?.setFloat("uTime", bodyT);
      // PF-10 C3: the DR3 belt's orbital clock. Shares `bodyT`'s reduced-motion contract
      // exactly — pinned to 0, which the shader reads as "do not rotate", so the belt holds
      // still at its real snapshot positions rather than vanishing (non-negotiable #24: every
      // visual feature defines its reduced-motion behaviour, and "frozen" is this one's).
      // Only type-6 vertices consult it; the stars, galaxies, Oort and white-dwarf layers
      // sharing this material are unaffected.
      this._starMat?.setFloat("uTime", bodyT);
      // PF-11 D2: the belt/local-field clones share the same orbital clock (the
      // belt clone's type-6 vertices consult it; the local clone's do not, but
      // keeping all three in lockstep costs nothing and avoids a divergent belt).
      this._beltMat?.setFloat("uTime", bodyT);
      this._localMat?.setFloat("uTime", bodyT);
      this._beltOrbitClock = bodyT;
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
        // PF-11 D1.1: the last boot-critical stage, and the one that means what
        // `cosmos:ready` only implies — a frame has genuinely been drawn. Emitted
        // BEFORE cosmos:ready so a dossier listening to both sees the stage close
        // first and never renders "ready" over an unfinished checklist.
        emitStageDone("first-frame");
        emit("cosmos:ready", {});
        // PF-10 C1: kick off the bonus background-layer fetch only after the first real frame
        // has rendered — never awaited, never gating cosmos:ready itself. Not gated on
        // `_layerState["bonus-stars"]` — see render-layers.ts's `implemented: false` note,
        // this layer isn't independently toggleable yet.
        void this._loadBonusStarLayers();
        // PF-10 C2 / PF-11 D9.1: SDSS DR18 galaxy field — same non-blocking philosophy, own
        // mesh, now gated on the resolved layer state so a visitor who disabled it (or loaded
        // with `?layers=sdss-field:0`) never pays for the 47 MB fetch at all.
        if (this._layerState["sdss-field"] !== false) {
          void this._loadSdssGalaxyLayer(scene, engine);
        }
        // PF-10 C3 / PF-11 D9.1: the full 154,662-object real DR3 asteroid belt — likewise own
        // mesh, likewise never in front of the startup budget, likewise layer-gated.
        if (this._layerState["belt-visual"] !== false) {
          void this._loadAsteroidVisualLayer(scene, engine);
        }
      }
    });

    this._ro = new ResizeObserver(() => {
      engine.resize();
      pushViewport(); // px-sized billboards depend on the render target size
      const vp = new Vector2(engine.getRenderWidth(), engine.getRenderHeight());
      // PF-11 D2: the frame-ladder clones size their billboards off uViewport too.
      this._localMat?.setVector2("uViewport", vp);
      this._beltMat?.setVector2("uViewport", vp);
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
    this._tabIndexGuard?.disconnect();
    this._tabIndexGuard = undefined;
    // PF-11 D0.1: the band build's between-frames driver outlives the render
    // loop unless it is cancelled here — a timer callback firing after
    // engine.dispose() would build rows for a scene that no longer exists.
    if (this._bandBuildTimer !== undefined) {
      clearTimeout(this._bandBuildTimer);
      this._bandBuildTimer = undefined;
    }
    this._bandBuilder = undefined;
    // PF-11 D3.3: same class of hazard — a queued retarget must not launch a
    // warp into a scene that has been disposed.
    if (this._retargetTimer !== undefined) {
      clearTimeout(this._retargetTimer);
      this._retargetTimer = undefined;
    }
    this.queuedTargetId = null;
    // PF-11 D7.3: the decode worker outlives nothing on its own — it has no timers or
    // observables of its own to leak, but an un-terminated Worker keeps its thread (and this
    // engine instance, via its closure) alive past disconnect.
    this._catalogWorker?.terminate();
    this._catalogWorker = undefined;
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
      // PF-11 D9.1: the Render Console's resolved layer state, mirrored for E2E — a plain copy
      // (not a live reference) so a caller can't accidentally mutate engine state through it.
      layers: { ...this._layerState },
      // PF-10 C2: SDSS DR18 galaxy field diagnostics (separate mesh, see _loadSdssGalaxyLayer).
      sdssGalaxyCount: this._sdssGalaxyCount,
      sdssMeshReady: this._sdssMesh ? this._sdssMesh.isReady(true) : false,
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
      // PF-11 D0.1: rows built so far / 512 — lets a test watch the build
      // ADVANCE (the liveness signal) rather than only observing its end
      // state, and is the honest progress source D1.1's dossier will read.
      bandProgress: this._bandReady ? 1 : (this._bandBuilder?.progress ?? 0),
      // PF-11 D2.2: the EFFECTIVE band opacity — the boot fade-in modulated by
      // the extragalactic collapse (`_localFieldFade`), matching the actual
      // `uFade` uniform. 1 in-galaxy, 0 at an SDSS/NBG arrival. (`_localFieldFade`
      // is 1 everywhere else, so this is unchanged for all in-galaxy travel.)
      bandFade:
        Math.round(this._bandFadeAmt * this._localFieldFade * 1000) / 1000,
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
      // PF-11 D3.1: the live camera FOV (rad) so E2E can prove the warp lens
      // breathes (widens mid-warp) and relaxes to _baseFov at arrival. The
      // breathing multiplier over base is the assertable speed cue.
      fov: this._camera ? Math.round(this._camera.fov * 100000) / 100000 : 0,
      baseFov: Math.round(this._baseFov * 100000) / 100000,
      // PF-11 D3.2: flip choreography diagnostics. `flipRate` < 1 means the
      // screen-time floor is dilating k across the window; `burnEnv` is the
      // eased main-drive envelope (1 burn … 0 cut) so E2E can prove the drive
      // actually cuts across the flip and relights on the brake.
      flipRate: Math.round(this._flipRate * 10000) / 10000,
      burnEnv: Math.round(this._burnEnv * 1000) / 1000,
      // PF-10 C1: GD-1 connected-trail diagnostics.
      gd1TrailSegments: this._gd1SegmentCount,
      gd1TrailMeshReady: this._gd1Mesh ? this._gd1Mesh.isReady(true) : false,
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
      // PF-10 C3: real-catalog belt diagnostics. `asteroidRealSource` is the honest signal an
      // E2E can assert on — it distinguishes real Gaia DR3 bodies from the procedural fallback,
      // which "asteroidCount" alone cannot (both produce the same tier-budgeted count).
      asteroidRealSource:
        REAL_ASTEROIDS.bodies.length > 0 ? "gaia-dr3" : "procedural",
      asteroidRealEpoch: REAL_ASTEROIDS.epoch,
      asteroidCatalogSize: REAL_ASTEROIDS.sourceCount,
      asteroidVisualCount: this._asteroidVisualCount,
      // PF-10 C3 follow-up: the belt's orbital clock. > 0 means the 154,662 specks are orbiting;
      // exactly 0 is the reduced-motion contract (frozen at real snapshot positions).
      // PF-10 C4: planet-sphere diagnostics.
      planetSphereBody: this._planetBodyId,
      planetSphereVisible: this._planetMesh?.isVisible ?? false,
      planetSphereReady:
        this._planetMesh && this._planetMat
          ? this._planetMat.isReady(this._planetMesh)
          : false,
      planetSurfaceTier: this._planetSurfaceTier,
      venusAltitudeKm: Math.round(this._venusAltitudeKm * 10) / 10,
      venusCloudVisible: this._venusCloud?.isVisible ?? false,
      planetVtLevel: this._planetVtRect ? this._planetVtRect.level : -1,
      planetVtTiles: this._planetVtLoaded,
      planetSpin: Math.round(this._planetSpin * 1000) / 1000,
      planetBodiesAvailable: this._planetManifest
        ? Object.keys(this._planetManifest.bodies).length
        : 0,
      asteroidOrbitClock: Math.round(this._beltOrbitClock * 100) / 100,
      asteroidVisualReady:
        this._asteroidVisualMesh && this._beltMat
          ? this._beltMat.isReady(this._asteroidVisualMesh)
          : false,
      // PF-11 D2: the frame ladder — destination-keyed layer fades. `furnitureFade`
      // (belt/glare) is ~1 in the solar system, 0 at any DSO; `localFieldFade`
      // (band/star field/figures) is 1 inside the galaxy, 0 at extragalactic
      // arrivals; `figureFade` (D2.3) is the figures' own nearer ly 50→500
      // dissolve, independent of `localFieldFade`; `impostorVisible` flips
      // true when the external-galaxy sprite shows; `beltPhysicsAwake` is the
      // Havok sleep signal (D2.1/D7.5).
      furnitureFade: Math.round(this._furnitureFade * 1000) / 1000,
      localFieldFade: Math.round(this._localFieldFade * 1000) / 1000,
      figureFade: Math.round(this._figureFade * 1000) / 1000,
      beltPhysicsAwake: this._beltPhysicsAwake,
      // PF-11 D7.5: proves the Havok bodies THEMSELVES actually stopped being simulated, not
      // just that our own force-application loop skipped — -1 when physics isn't Havok-backed
      // (visual/off/loading/failed tiers have no motion type to read at all).
      beltBodiesStatic:
        this._physicsMode === "havok" && this._physicsMotionType
          ? this._asteroidBodies.every(
              (b) => b.getMotionType() === this._physicsMotionType!.STATIC,
            )
          : -1,
      impostorVisible: this._impostorVisible,
      impostorTextureReady: this._impostorTex?.isReady() ?? false,
      // B4 step 2: proximity-slowdown diagnostics. warpSlowMin persists past
      // arrival so E2E can prove a belt crossing eased the journey.
      warpSlow: Math.round(this._warpSlow * 1000) / 1000,
      warpSlowMin: Math.round(this._warpSlowMin * 1000) / 1000,
      // B4 step 3+4: impact-shake / docking-contact diagnostics.
      collisionWired: this._collisionWired,
      impactCount: this._impactCount,
      shakeAmp: Math.round(this._shakeAmp * 1000) / 1000,
      // B5: the resolved quality tier and its key applied budgets.
      // PF-11 D6.4 / R16 — the home reveal + orbit, for E2E. `homePhaseDeg` is recomputed from
      // the live camera and sun vectors rather than reported as the constant it should be, so the
      // test proves the 90 degree hold instead of restating it.
      homeOrbit: this._homeOrbit,
      homeOrbitPhaseDeg:
        Math.round(((this._homeOrbitPhase * 180) / Math.PI) * 10) / 10,
      // Bug fix regression guard, for E2E: true once the visitor has dragged since the
      // orbit was armed, at which point the auto-aim-at-planet driver permanently stops
      // overriding their look for the rest of this orbit.
      homeLookOverridden: this._homeLookOverridden,
      // PF-11 D1.3 — the launch ascent, for E2E.
      ascentMode: this.warp.mode === "ascent",
      ascentProg: Math.round(this._ascentProg * 1000) / 1000,
      limbVisible: this._limbMesh?.isVisible ?? false,
      homePhaseDeg: (() => {
        const r = Math.hypot(this.cam[0], this.cam[1], this.cam[2]);
        if (r < 1e-6) return null;
        const d2r = Math.PI / 180;
        const sr = SUN_RA_DEG * d2r,
          sd = SUN_DEC_DEG * d2r;
        const dot =
          (this.cam[0] / r) * (Math.cos(sd) * Math.cos(sr)) +
          (this.cam[1] / r) * (Math.cos(sd) * Math.sin(sr)) +
          (this.cam[2] / r) * Math.sin(sd);
        return (
          Math.round((Math.acos(Math.max(-1, Math.min(1, dot))) / d2r) * 100) /
          100
        );
      })(),
      qualityTier: this._quality.name,
      haloAmp: this._quality.haloAmp,
      shootCount: this._quality.shootingStars,
    };
  }

  // --- PF-10 C1: bonus background-layer merge (white dwarfs, CNS5, Oort cloud) ---

  /** (Re)builds the star mesh's geometry (positions/indices/starMeta) from a StarField,
   * updating `this.starCount`/`this._field` to match. Shared by the initial boot setup and the
   * post-boot bonus-layer merge below — same billboard-quad construction either way, only the
   * source field differs. Requires `this._stars` to already exist (the mesh itself, its
   * material, and `mesh.alwaysSelectAsActiveMesh` are set up once at boot and never rebuilt). */
  private _applyStarFieldGeometry(field: StarField, engine: AbstractEngine) {
    if (!this._stars) return;
    const bb = buildStarBillboards(field);
    const vd = new VertexData();
    vd.positions = bb.positions;
    vd.indices = bb.indices;
    vd.applyToMesh(this._stars, false);
    // On a rebuild (the bonus-layer merge calls this a second time), the mesh already owns a
    // "starMeta" GPU buffer from the initial boot — setVerticesBuffer REPLACES the reference on
    // the mesh but does not dispose the old WebGL/WebGPU buffer object itself, leaking it. A
    // single leaked buffer of this size was measured this session to visibly degrade subsequent
    // frame time (a 350ms warp taking 4+ real seconds under SwiftShader) — real GPU resource
    // pressure, not a cosmetic leak. Explicitly disposed before the replacement is created.
    this._stars.getVertexBuffer("starMeta")?.dispose();
    this._stars.setVerticesBuffer(
      new VertexBuffer(engine, bb.meta, "starMeta", false, false, 2),
    );
    this.starCount = field.count;
    this._field = field;
    // PF-11 D7.1: this mesh is never scene-picked (isPickable=false, see boot setup) — the
    // custom `_pick`/`_pickField` screen-space search reads `_field` above, a plain typed
    // array independent of the GPU geometry — so the CPU-side vertex/index copy Babylon
    // retains after upload (~54-361 MB across the merged/bonus field) serves no purpose once
    // this frame's buffers are on the GPU. `setVerticesData`/`setVerticesBuffer` (used by
    // `vd.applyToMesh` and the call above) always build a fresh Geometry rather than reuse the
    // cleared one, so clearing here cannot break the next bonus-layer rebuild. Trade-off,
    // undocumented until now: a lost WebGL context can no longer restore this mesh's real data
    // (Babylon's `_rebuild()` falls back to an empty same-size buffer without a CPU cache) —
    // accepted for a portfolio site with no existing context-restore recovery path either way.
    this._stars.geometry?.clearCachedData();
  }

  /** Resolves once `this.warp.mode === "idle"`, polling once per animation frame, capped at
   * `maxWaitMs` so a stuck/perpetual warp state can never block the bonus-layer merge forever
   * (the merge still matters even if the visitor never stops moving; it just accepts the
   * collision risk past the cap rather than silently never running). */
  private _waitForWarpIdle(maxWaitMs = 8000): Promise<void> {
    return new Promise((resolve) => {
      const start = performance.now();
      const check = () => {
        if (
          this.warp.mode === "idle" ||
          performance.now() - start > maxWaitMs
        ) {
          resolve();
          return;
        }
        requestAnimationFrame(check);
      };
      check();
    });
  }

  /** PF-11 D7.3: hands an already-fetched image Blob to the catalog-decode worker and resolves
   * with its billboard-ready output. Lazily creates one worker per engine instance and reuses it
   * for every call (today, only the SDSS layer) — `disconnectedCallback` terminates it. Requests
   * are tagged with an incrementing id so a response can never be mismatched to the wrong call,
   * even though only one call is ever in flight today (the `_sdssLayerRequested` guard already
   * prevents re-entry) — the same defensive-not-currently-load-bearing discipline the VT
   * streamer's pending/rect identity checks already use. */
  private _decodeCatalogInWorker(blob: Blob): Promise<{
    positions: Float32Array;
    meta: Float32Array;
    indices: Uint32Array;
    vertexCount: number;
    count: number;
  }> {
    if (!this._catalogWorker) {
      this._catalogWorker = new Worker(
        new URL("../workers/catalog-decode.worker.ts", import.meta.url),
        { type: "module" },
      );
    }
    const worker = this._catalogWorker;
    const id = ++this._catalogWorkerReqId;
    return new Promise((resolve, reject) => {
      const onMessage = (ev: MessageEvent<CatalogDecodeResponse>) => {
        if (ev.data.id !== id) return;
        worker.removeEventListener("message", onMessage);
        if (ev.data.ok) resolve(ev.data);
        else reject(new Error(ev.data.error));
      };
      worker.addEventListener("message", onMessage);
      worker.postMessage({ id, blob } satisfies CatalogDecodeRequest);
    });
  }

  /** Fetches the 3 proven-but-previously-unwired Track B bulk populations (TR-063/065: white
   * dwarfs, CNS5, Oort cloud — real PNG-pack assets, real object-type bytes already understood
   * by the shipped shader: 0=star, 3 handled separately for galaxies, 7=oort dust grain) and
   * merges them into the already-visible star mesh. Called once, AFTER cosmos:ready — these are
   * real bulk assets (white dwarfs alone ~5.4 MB, 359,073 records) and fetching them before the
   * first frame would directly threaten the PF-09/PF-10 startup budgets (≤2.5-4.0s by device
   * class), the same reasoning this file already applies to the ship GLB and Milky Way texture.
   * A fetch/decode failure on any chunk degrades gracefully — the base catalog stays exactly as
   * it was, never a blank sky or a crash, matching `loadStarField`'s own fallback philosophy. */
  private async _loadBonusStarLayers() {
    if (this._bonusLayersRequested) return;
    this._bonusLayersRequested = true;
    if (!this._engine || !this._stars || !this._baseCatalogRgb) return;
    // PF-10 owner direction (2026-07-20, TR-067): build the IDEAL STATE for every device first
    // — desktop as the baseline, tiers/modes/settings introduced LATER from real extended device
    // testing, not preemptively. This deliberately REVERSES TR-066's tier gate, which restricted
    // white dwarfs to "full" tier from a SwiftShader/software-rendering measurement (CI's
    // emulated GPU, not a real device) — a reasonable worst-case proxy at the time, but real
    // Android hardware (mid-tier + flagship, now available for this plan) is the correct
    // instrument per CLAUDE.md's own "measure, don't assert" rule, not a software rasterizer.
    // ALL bonus layers now merge on every tier; the tier-gate mechanism (chunkUrls) is kept,
    // set to a no-op today, ready to be re-armed with real thresholds once real-device numbers
    // land — never reintroduced blind.
    const chunkUrls = BONUS_CATALOG_CHUNKS;
    // PF-11 D1.1: ~5.8 MB across four chunks, all summed into one `bonus-layers`
    // stage. NOT boot-critical — the dossier shows these as "STREAMING IN
    // BACKGROUND" and LAUNCH never waits on them.
    const bonusStage = new StageAggregator("bonus-layers", emitStage);
    try {
      const bonusRgb = await Promise.all(
        chunkUrls.map((u) =>
          loadChunkRGB(u, {
            stage: "bonus-layers",
            sink: bonusStage.sink(u),
          }).catch((e) => {
            console.warn(`[babylon-engine] bonus star layer ${u} failed`, e);
            return new Uint8Array(0);
          }),
        ),
      );
      // PF-11 D7.5: decode ONLY the new bonus chunks — `this._field` already holds the base
      // catalog's decoded positions/meta from boot (guaranteed non-null: `_baseCatalogRgb`
      // non-null, checked above, only happens alongside a successful real-catalog decode), so
      // re-running `decodeStarCatalog` over the base bytes again would just re-parse ~168,959
      // already-known-good records for nothing. `mergeStarFields` is plain concatenation.
      const bonusField = decodeStarCatalog(bonusRgb);
      if (bonusField.count === 0 || !this._field) return; // every bonus chunk failed
      const merged = mergeStarFields(this._field, bonusField);
      // Real finding, not a test-timing nicety: rebuilding billboard geometry for 500k+ merged
      // records and re-uploading new GPU vertex buffers is genuine main-thread + GPU work — on
      // SwiftShader (CI/software rendering) large enough to visibly stall an in-flight warp if
      // the rebuild happens to land mid-travel. Waiting for the ship to be idle first (network
      // fetch + decode already happened above; only the expensive geometry/GPU step is gated)
      // means the one-time enhancement never competes with an active flight for frame time.
      await this._waitForWarpIdle();
      this._applyStarFieldGeometry(merged, this._engine);
      bonusStage.finish(merged.count);
      emit("cosmos:bonus-stars", { total: merged.count });
    } catch (e) {
      console.warn(
        "[babylon-engine] bonus star layers failed, keeping base catalog",
        e,
      );
    } finally {
      // Idempotent — a no-op after the success path's record-carrying finish
      // above. Present for the two paths that skip it: the `return` when every
      // chunk failed, and the catch. A background stage that never closes would
      // sit in the dossier as permanently "STREAMING" long after the engine
      // gave up on it.
      bonusStage.finish();
      // PF-11 D7.6: this method runs at most once (`_bonusLayersRequested` above) and this is
      // its last read of `_baseCatalogRgb` on every exit path (success, the early "every bonus
      // chunk failed" return, and the catch) — the ~2.4 MB base-catalog RGB chunks it retains
      // serve no purpose for the rest of the session once this merge attempt is over.
      this._baseCatalogRgb = null;
    }
  }

  /** PF-10 C2: fetches and renders the SDSS DR18 galaxy field (real 3,637,836 records, TR-066/
   * TR-067) — a SEPARATE mesh from `_stars` for the reason ADR-0007's consequences section
   * states explicitly: SDSS's real comoving distances (32.6M-28.86B ly) are baked as log-depth-
   * compressed positions (`scripts/gaia-sdss18-pngpack.mjs`'s `bodyDepth()` port), incompatible
   * with `_stars`'s linear-light-year convention — merging the two into one `decodeStarCatalog`
   * call would silently corrupt whichever layer's convention doesn't match. Reuses `_starMat`
   * (the `ijStar` shader material is already generic on the object-type byte; type 3 = "galaxy
   * smudge" is a real, existing branch). A real ~47 MB asset — fetched only after
   * `cosmos:ready`, idle-gated before the geometry build, same non-blocking philosophy as
   * `_loadBonusStarLayers`. PF-10 owner direction (TR-067): ship the full real dataset now
   * (ideal-state-first, desktop baseline) — no tier gate here yet, pending real Android
   * measurement (mid-tier + flagship) to inform one later, not a preemptive guess. */
  private async _loadSdssGalaxyLayer(scene: Scene, engine: AbstractEngine) {
    if (this._sdssLayerRequested) return;
    this._sdssLayerRequested = true;
    // PF-11 D1.1: 47.1 MB — by far the largest single transfer the site makes, and
    // the one whose real progress matters most to a visitor on a slow link. Not
    // boot-critical: it streams behind an already-interactive scene.
    const sdssStage = new StageAggregator("sdss-field", emitStage);
    const sdssUrl = "assets/sdss18.png";
    try {
      // PF-11 D7.3: the fetch (with its real byte progress into the dossier) stays on the main
      // thread; decode + billboard-build — the actual CPU cost, ~5 sequential O(n) passes over
      // 3.64M records measured pre-slice — move to `catalog-decode.worker.ts`.
      const blob = await fetchWithProgress(
        sdssUrl,
        "sdss-field",
        sdssStage.sink(sdssUrl),
      );
      const bb = await this._decodeCatalogInWorker(blob);
      if (bb.count === 0) return;
      await this._waitForWarpIdle();
      const mesh = new Mesh("sdssGalaxies", scene);
      const vd = new VertexData();
      vd.positions = bb.positions;
      vd.indices = bb.indices;
      vd.applyToMesh(mesh, false);
      mesh.setVerticesBuffer(
        new VertexBuffer(engine, bb.meta, "starMeta", false, false, 2),
      );
      mesh.alwaysSelectAsActiveMesh = true;
      mesh.material = this._starMat ?? null;
      this._sdssMesh = mesh;
      this._sdssGalaxyCount = bb.count;
      // PF-11 D7.1: one-shot mesh, never rebuilt or picked (galaxies aren't in
      // `this.bodies` or `_field` — see the star mesh's clearCachedData note). ~361 MB
      // of CPU-side vertex/index arrays freed for the largest layer this site ships.
      mesh.geometry?.clearCachedData();
      sdssStage.finish(bb.count);
      emit("cosmos:sdss-galaxies", { total: bb.count });
    } catch (e) {
      console.warn("[babylon-engine] SDSS galaxy layer failed", e);
    } finally {
      sdssStage.finish(); // idempotent; closes the zero-count and error paths
    }
  }

  /** PF-10 C3: fetches and renders the FULL real Gaia DR3 asteroid belt — 154,662 real objects,
   * each at the position its own real Keplerian elements put it at the stated snapshot date
   * (`scripts/gaia-asteroids-pngpack.mjs`). This is the "visual layer" half of C3's two-tier
   * split: every one of these traces to a catalog record, but none of them is a physics body —
   * 154,662 Havok rigid bodies is ~3,200x the tier budget and simply not possible in a 16.6 ms
   * frame. The bounded physics subset is built separately in `_setupPhysicsInner`, from the same
   * real catalog.
   *
   * A SEPARATE mesh from `_stars`, for the same reason `_loadSdssGalaxyLayer` is: this layer's
   * positions are baked in the belt's own world-unit scale (1 AU = 63 units, ecliptic in the
   * scene's X-Y plane), not the star field's linear-light-year convention — merging them into one
   * `decodeStarCatalog` call would silently corrupt whichever convention lost. Reuses `_starMat`;
   * object-type byte 6 ("DR3 asteroid") was already a real branch in both shader twins' vertex
   * stage, and C3 adds the matching tight, bloom-free fragment branch.
   *
   * Fetched after `cosmos:ready` and idle-gated before the geometry build, exactly like the other
   * two bulk layers — a 2.0 MB asset must never sit in front of the startup budget, and the
   * one-time geometry upload must never compete with an in-flight warp. A failure here leaves the
   * scene exactly as it was: the physics belt is already visible and independent of this layer. */
  private async _loadAsteroidVisualLayer(scene: Scene, engine: AbstractEngine) {
    if (this._asteroidLayerRequested) return;
    this._asteroidLayerRequested = true;
    // PF-11 D1.1: 2.08 MB, post-ready, not boot-critical.
    const beltStage = new StageAggregator("asteroid-belt", emitStage);
    const beltUrl = "assets/asteroids-dr3.png";
    try {
      const rgb = await loadChunkRGB(beltUrl, {
        stage: "asteroid-belt",
        sink: beltStage.sink(beltUrl),
      });
      const field = decodeStarCatalog([rgb]);
      if (field.count === 0) return;
      await this._waitForWarpIdle();
      const bb = buildStarBillboards(field);
      const mesh = new Mesh("asteroidBelt", scene);
      const vd = new VertexData();
      vd.positions = bb.positions;
      vd.indices = bb.indices;
      vd.applyToMesh(mesh, false);
      mesh.setVerticesBuffer(
        new VertexBuffer(engine, bb.meta, "starMeta", false, false, 2),
      );
      mesh.alwaysSelectAsActiveMesh = true;
      // PF-11 D2.1: the belt is solar-system furniture — it fades out by
      // ~0.1 ly departure (Astra §2: it subtends 16 mas from M42). Its own
      // `_starMat` clone so `uLayerFade` is the furniture fade, independent of
      // the star field and SDSS. Clone inherits the base's current uSize/
      // uHaloAmp/uViewport/uTime; the per-frame fan-outs keep it in sync.
      if (this._starMat) {
        const beltMat = this._starMat.clone("ijStarBelt");
        beltMat.backFaceCulling = false;
        beltMat.alphaMode = Constants.ALPHA_ADD;
        this._beltMat = beltMat;
        mesh.material = beltMat;
      } else {
        mesh.material = null;
      }
      this._asteroidVisualMesh = mesh;
      this._asteroidVisualCount = field.count;
      // PF-11 D7.1: one-shot mesh, never rebuilt or picked. ~15 MB of CPU-side
      // vertex/index arrays freed (see the star mesh's clearCachedData note for the
      // WebGL-context-loss trade-off this and the SDSS layer now share).
      mesh.geometry?.clearCachedData();
      beltStage.finish(field.count);
      emit("cosmos:asteroid-belt", { total: field.count });
    } catch (e) {
      console.warn("[babylon-engine] DR3 asteroid visual layer failed", e);
    } finally {
      beltStage.finish(); // idempotent; closes the zero-count and error paths
    }
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
    // PF-11 D1.1: small (11 KB) but boot-critical — LAUNCH waits on it, so it is
    // reported like everything else rather than silently. `finish()` is in the
    // `finally` precisely BECAUSE this path degrades gracefully: a 404 or parse
    // failure still ends the stage, or the dossier would stall forever on a
    // scene that had already recovered and moved on.
    const atlasStage = new StageAggregator("atlas-map", emitStage);
    const atlasUrl = "/assets/atlas-map.json";
    try {
      const blob = await fetchWithProgress(
        atlasUrl,
        "atlas-map",
        atlasStage.sink(atlasUrl),
      );
      atlasMap = JSON.parse(await blob.text()) as AtlasMap;
    } catch (e) {
      // Same fallback philosophy as loadStarField: a missing/broken atlas map
      // degrades every body to procedural rather than blanking anything.
      console.warn(
        "[babylon-engine] atlas-map fetch failed, all bodies render procedurally",
        e,
      );
    } finally {
      atlasStage.finish();
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
    //
    // PF-11 D1.1 — the ONE named asset deliberately left without a
    // `cosmos:stage` reader, recorded here rather than silently skipped.
    // atlas.jpg is 3.5 MB and real, but Babylon's `Texture` performs its own
    // internal fetch and exposes only completion (`onLoadObservable`), never
    // byte progress. Reporting it would mean re-routing this load through
    // `fetchWithProgress` and handing Babylon a blob: URL — which this site's
    // CSP does already permit (`img-src`/`connect-src` carry blob: precisely
    // for the texture path) — but that changes how the GAP-02 photographic
    // body layer loads, and that deserves its own slice and its own
    // verification rather than riding along inside the instrumentation slice.
    // The `atlas-photo` LoadStage exists in load-progress.ts ready for it.
    const tex = new Texture("/assets/atlas.jpg", scene);
    this._photoTex = tex;
    photoMat.setTexture("uTex", tex);
  }

  // --- PF-10 C4: real planetary spheres with real topography ---

  /** Builds the single destination-gated planet sphere. See planet-sphere.ts's header for why
   * there is exactly one and not one per body.
   *
   * Both samplers get a REAL texture object here, before the mesh can ever draw — the height
   * sampler's placeholder is not a nicety but CLAUDE.md non-negotiable #9 (TR-059): on WebGPU an
   * empty binding throws while building the bind group and kills `scene.render()` for the entire
   * frame. Most bodies ship no elevation at all, so this path is the common case, not the edge. */
  private _setupPlanetSphere(scene: Scene, backend: "webgpu" | "webgl2") {
    const mesh = new Mesh("planetSphere", scene);
    const vd = CreateSphereVertexData({
      diameter: 2,
      segments: SPHERE_SEGMENTS,
    });
    vd.applyToMesh(mesh, false);
    mesh.isPickable = false;
    mesh.isVisible = false; // revealed only on arrival at a body with real imagery
    this._planetMesh = mesh;

    const mat = new ShaderMaterial(
      "planetSphere",
      scene,
      { vertex: "ijPlanet", fragment: "ijPlanet" },
      {
        attributes: ["position", "normal", "uv"],
        uniforms: [
          "world",
          "view",
          "projection",
          "uSunDir",
          "uHasHeight",
          "uHasNormal",
          "uHasCloud",
          "uAtmosphere",
          "uElevScale",
          "uAlbedo",
          "uLunarL",
          "uSurgeB0",
          "uHasNight",
          "uCamPos",
          "uDetailRect",
          "uHasDetail",
          "uFlatLight",
          "uFlatTint",
          "uFlatLevel",
        ],
        samplers: [
          "surfaceTex",
          "heightTex",
          "normalTex",
          "detailTex",
          "cloudTex",
          "specularTex",
          "nightTex",
        ],
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );

    // 1x1 placeholders for BOTH samplers — see the method comment. Mid-grey for height means
    // "flat" once uHasHeight gates it to zero anyway, so a body with no elevation reads as a
    // smooth sphere rather than as noise.
    const flat = RawTexture.CreateRGBATexture(
      new Uint8Array([128, 128, 128, 255]),
      1,
      1,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    mat.setTexture("surfaceTex", flat);
    mat.setTexture("heightTex", flat);
    // TR-059 again, and this one is the easiest of the three to forget: the detail sampler is
    // unbound for the entire life of every body that has no virtual texture at all (10 of 12).
    mat.setTexture("detailTex", flat);

    // PF-10 C4 CLOSEOUT — the normal sampler needs its OWN placeholder, and it is the one case
    // in this material where the shared mid-grey would be actively wrong rather than merely
    // gated. A normal map is decoded as `rgb * 2 - 1`, so (128,128,128) decodes to the ZERO
    // vector, not to "no change"; the neutral normal is (128,128,255) — straight up. The shader
    // survives either way (`max(nrm.z, 0.05)` keeps the normalize finite and `uHasNormal` gates
    // the blend), but binding a placeholder that means what it says is the difference between
    // code that is correct and code that is accidentally not broken.
    const flatNormal = RawTexture.CreateRGBATexture(
      new Uint8Array([128, 128, 255, 255]),
      1,
      1,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    mat.setTexture("normalTex", flatNormal);
    mat.setFloat("uHasNormal", 0);
    this._planetFlatNormalTex = flatNormal;

    // Earth's two extra maps (PF-10 C4 closeout). BLACK, not the shared mid-grey, and the reason
    // is the same TR-059 discipline one level of care further on: a mid-grey specular mask would
    // put half an ocean's worth of Cox-Munk glint on Mars, and a mid-grey cloud map would fog
    // every airless body in the scene with a 50% white haze. Both are gated to zero anyway
    // (`uHasCloud`, and `oceanMask` multiplies the glint directly), but a placeholder whose value
    // would be catastrophic if a gate were ever dropped is a latent defect, not a spare.
    const black = RawTexture.CreateRGBATexture(
      new Uint8Array([0, 0, 0, 255]),
      1,
      1,
      scene,
      false,
      false,
      Texture.NEAREST_SAMPLINGMODE,
    );
    mat.setTexture("cloudTex", black);
    mat.setTexture("specularTex", black);
    // PF-11 D6.4: bound black from boot, per #9 — a declared sampler needs a REAL texture object
    // before the mesh ever draws, and on WebGPU an empty binding kills the whole frame.
    mat.setTexture("nightTex", black);
    mat.setFloat("uHasCloud", 0);
    mat.setFloat("uAtmosphere", 0);
    this._planetBlackTex = black;
    mat.setFloat("uHasDetail", 0);
    mat.setVector4("uDetailRect", new Vector4(0, 0, 1, 1));
    mat.setFloat("uFlatLight", 0);
    mat.setFloat("uFlatLevel", 1);
    mat.setVector3("uFlatTint", new Vector3(1, 1, 1));
    mat.setFloat("uHasHeight", 0);
    mat.setFloat("uElevScale", 0);
    mat.setFloat("uAlbedo", 0.3);
    mat.setFloat("uLunarL", 0.55);
    // PF-11 D6.1: no surge until a real body is dressed. 0 makes surge(alpha) == 1 identically,
    // so the placeholder sphere is unaffected by the phase term.
    mat.setFloat("uSurgeB0", 0);
    mat.setFloat("uHasNight", 0);
    mat.setVector3("uSunDir", new Vector3(0, 0, 1));
    mat.setVector3("uCamPos", new Vector3(0, 0, 0));
    this._planetPlaceholderTex = flat;
    mesh.material = mat;
    this._planetMat = mat;

    // The manifest is small and drives which bodies are sphere-capable at all; a failure here
    // simply means no body ever goes spherical, and every one keeps its existing billboard.
    // PF-10 C4.2: the Venus cloud shell — a second, slightly larger sphere carrying the real
    // cloud map. Built once, hidden unless the descent is running.
    const cloud = new Mesh("venusCloud", scene);
    CreateSphereVertexData({
      diameter: 2 * 1.012,
      segments: SPHERE_SEGMENTS,
    }).applyToMesh(cloud, false);
    cloud.isPickable = false;
    cloud.isVisible = false;
    cloud.scaling.setAll(PLANET_SPHERE_RADIUS);
    this._venusCloud = cloud;

    const cloudMat = new ShaderMaterial(
      "venusCloud",
      scene,
      { vertex: "ijVenusCloud", fragment: "ijVenusCloud" },
      {
        attributes: ["position", "uv"],
        uniforms: [
          "world",
          "view",
          "projection",
          "uOpacity",
          "uTint",
          "uContrast",
        ],
        samplers: ["cloudTex"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    // TR-059: bound before the mesh can ever draw, even though it is hidden at boot.
    cloudMat.setTexture("cloudTex", flat);
    cloudMat.setFloat("uOpacity", 0);
    // Measured: the shipped map's contrast is 20.5% against a real 1-3%, because it is a UV map
    // presented as if it were visible light. Flattened to the real figure (venus-descent.ts).
    cloudMat.setFloat("uContrast", CLOUD_CONTRAST_SCALE);
    cloudMat.setVector3("uTint", new Vector3(0.85, 0.69, 0.55));
    cloudMat.backFaceCulling = false;
    cloud.material = cloudMat;
    this._venusCloudMat = cloudMat;
    const cloudTex = new Texture("/assets/planets/venus-cloud.jpg", scene);
    cloudTex.wrapU = Texture.WRAP_ADDRESSMODE;
    cloudMat.setTexture("cloudTex", cloudTex);

    void fetch("/assets/planets/manifest.json")
      .then((r) => (r.ok ? r.json() : null))
      .then((m: PlanetManifest | null) => {
        this._planetManifest = m;
      })
      .catch(() => {
        this._planetManifest = null;
      });
  }

  /** PF-11 D7.2: releases the real per-body textures (surface, height, normal, cloud, night,
   * specular, plus any in-flight VT detail atlas) when the sphere departs a body with no next
   * body queued. Earth alone was measured at ≈683 MB VRAM with mips retained indefinitely,
   * across every body ever visited in a session — this is the fix.
   *
   * Every sampler is rebound to its shared 1x1 placeholder (`_planetPlaceholderTex`/
   * `_planetFlatNormalTex`/`_planetBlackTex`, built once in `_setupPlanetSphere`) rather than
   * left pointing at a disposed object — CLAUDE.md #9 (TR-059): a declared sampler needs a
   * real texture bound before the mesh next draws, disposed-and-still-bound included. The
   * trade this accepts: returning to the same body re-fetches its textures from scratch
   * (usually absorbed by the browser HTTP cache, not re-decoded from nothing) rather than
   * keeping them warm — the point of this method is that nothing stays warm while unseen. */
  private _disposePlanetBodyTextures() {
    this._planetSurfaceTex?.dispose();
    this._planetSurfaceTex = undefined;
    this._planetHeightTex?.dispose();
    this._planetHeightTex = undefined;
    this._planetNormalTex?.dispose();
    this._planetNormalTex = undefined;
    this._planetCloudTex?.dispose();
    this._planetCloudTex = undefined;
    this._planetNightTex?.dispose();
    this._planetNightTex = undefined;
    this._planetSpecularTex?.dispose();
    this._planetSpecularTex = undefined;
    this._planetDetailTex?.dispose();
    this._planetDetailTex = undefined;
    this._planetVtRect = null;
    this._planetVtLoaded = 0;
    this._planetSurfaceTier = "high";
    const mat = this._planetMat;
    if (!mat) return;
    if (this._planetPlaceholderTex) {
      mat.setTexture("surfaceTex", this._planetPlaceholderTex);
      mat.setTexture("heightTex", this._planetPlaceholderTex);
      mat.setTexture("detailTex", this._planetPlaceholderTex);
    }
    if (this._planetFlatNormalTex) {
      mat.setTexture("normalTex", this._planetFlatNormalTex);
    }
    if (this._planetBlackTex) {
      mat.setTexture("cloudTex", this._planetBlackTex);
      mat.setTexture("specularTex", this._planetBlackTex);
      mat.setTexture("nightTex", this._planetBlackTex);
    }
    mat.setFloat("uHasHeight", 0);
    mat.setFloat("uHasNormal", 0);
    mat.setFloat("uHasCloud", 0);
    mat.setFloat("uAtmosphere", 0);
    mat.setFloat("uHasNight", 0);
    mat.setFloat("uHasDetail", 0);
  }

  /** Destination gating for the planet sphere, called per frame.
   *
   * Mirrors `_tickNebula`'s arrival-keyed structure rather than inventing a second "what am I at"
   * mechanism: when `arrivedId` changes to a body the manifest has real imagery for, the sphere
   * moves to that body's already-computed world position, its real textures are fetched, and it
   * becomes visible. Any other destination hides it and the billboard path carries on untouched.
   *
   * Texture loads are fire-and-forget for the same reason the ship GLB and Milky Way texture are:
   * a 1-2 MB surface map must never sit in front of a frame. Until it lands the sphere draws with
   * the placeholder — a plain grey ball, visibly "loading" rather than broken. */
  private _tickPlanetSphere() {
    const mesh = this._planetMesh;
    const mat = this._planetMat;
    if (!mesh || !mat) return;

    const manifest = this._planetManifest;
    const arrived = this.arrivedId;
    if (!manifest) {
      if (this._planetBodyId !== null) this._disposePlanetBodyTextures();
      mesh.isVisible = false;
      this._planetBodyId = null;
      return;
    }

    /* PF-11 D6.4 — THE HOME REVEAL. Earth is deliberately NOT a catalog body and must never
     * become one: this catalog's frame is geocentric, so Earth's direction is 0/0 and its
     * distance is 0, and `bodyDepth(0)` would place it deeper than Neptune (Astra, Earth brief
     * §B3). It is the origin. So the sphere gets a second, body-less path that keys on being at
     * home rather than on `arrivedId`, and everything downstream — the re-dress block, the
     * rotation, the per-frame camera uniform — is shared.
     *
     * The payoff is the phase angle. Every `travelTo` arrival is pinned to 0.000°, because the
     * camera parks on the Sun-body line and `sunDirectionFrom` returns the negated body
     * direction: V = L, forced, which is why no other body in this scene can show a terminator.
     * At the origin the vectors decouple, and the home vantage is chosen at quadrature — exactly
     * 90.0000°, unit-asserted from the Sun's own catalog entry. */
    const atHome = this._isAtHomeVantage();
    const homeReveal = !arrived && atHome && !!manifest.bodies.earth;

    const body = arrived ? this._bodyById.get(arrived) : undefined;
    const key = homeReveal
      ? "earth"
      : body
        ? sphereIdFor(body.e, manifest.bodies)
        : null;
    if (!key || (!body && !homeReveal)) {
      if (this._planetBodyId !== null) this._disposePlanetBodyTextures();
      mesh.isVisible = false;
      this._planetBodyId = null;
      return;
    }
    // Origin for the home reveal; the body's real catalog position otherwise.
    const spherePos: [number, number, number] = body ? body.pos : [0, 0, 0];

    if (this._planetBodyId !== key) {
      this._planetBodyId = key;
      this._planetSurfaceTier =
        this._quality.planetTexture === "base" ? "base" : "high";
      // Detail belongs to the previous body; drop it before anything else so a stale atlas can
      // never be sampled against a new body's UVs.
      this._planetVtRect = null;
      this._planetVtLoaded = 0;
      mat.setFloat("uHasDetail", 0);
      // PF-10 C4.2: arriving at Venus starts the cloud descent; arriving anywhere else clears it
      // and restores ordinary lit rendering.
      this._venusDescentStart = key === "venus" ? performance.now() : 0;
      if (key !== "venus") {
        mat.setFloat("uFlatLight", 0);
        mat.setFloat("uFlatLevel", 1);
        if (this._venusCloud) this._venusCloud.isVisible = false;
      }
      const entry = manifest.bodies[key];
      const phys = PLANET_PHYSICAL[key];

      // Real sun direction for this body's real catalog position — see planet-sphere.ts.
      //
      // PF-11 D6.4: at the origin `sunDirectionFrom` CANNOT be used — its own guard returns the
      // documented "arbitrary but stable" [0,0,1] fallback for a zero-length input, which would
      // put the terminator wherever that happens to land. The home reveal reads the Sun's OWN
      // catalog entry instead (ra 250 / dec -20.5, a real geocentric solar position), which is
      // both the honest datum and the thing that makes the 90° vantage computable.
      const [sx, sy, sz] = homeReveal
        ? raDecToDir(SUN_RA_DEG, SUN_DEC_DEG)
        : sunDirectionFrom(spherePos);
      mat.setVector3("uSunDir", new Vector3(sx, sy, sz));
      // Astra's real geometric albedos: PLANET_PHYSICAL for the three bodies with elevation,
      // PLANET_ALBEDO for the surface-only ones, neutral default otherwise.
      //
      // PF-11 D6.1: that geometric albedo is now SPLIT rather than sent whole. For the four
      // bodies whose published value is an opposition-surge peak (Tethys, Dione, Rhea, Moon) the
      // shader gets the surge-free base and the coefficient separately, and multiplies them back
      // together in the phase function — recovering the real geometric albedo exactly at alpha=0
      // and nowhere else, which is the only place it was ever valid. Every other body passes
      // through with surgeB0 = 0 and is arithmetically unchanged.
      const geometricAlbedo = phys?.albedo ?? PLANET_ALBEDO[key] ?? 0.3;
      const { baseAlbedo, surgeB0 } = exposureTermsFor(key, geometricAlbedo);
      mat.setFloat("uAlbedo", baseAlbedo);
      mat.setFloat("uSurgeB0", surgeB0);
      // Airless bodies backscatter (Lommel-Seeliger); atmospheres tend toward Lambert. Bodies
      // without a measured coefficient get Mars's 0.55 rather than a hard 0 or 1.
      // PLANET_LUNAR_L overrides the default for bodies with no PLANET_PHYSICAL entry — Earth
      // takes 0 (pure Lambert), because Lommel-Seeliger models shadow hiding in regolith and
      // there is no regolith on an ocean (Astra, Earth brief §1.2).
      mat.setFloat(
        "uLunarL",
        phys?.lunarLambertL ?? PLANET_LUNAR_L[key] ?? 0.55,
      );
      // Elevation only applies where the body genuinely ships a height map.
      mat.setFloat("uHasHeight", entry.height ? 1 : 0);
      mat.setFloat("uElevScale", entry.height ? PLANET_ELEV_SCALE : 0);

      mesh.position.set(spherePos[0], spherePos[1], spherePos[2]);
      mesh.scaling.setAll(PLANET_SPHERE_RADIUS);

      // PF-11 D6.3.2: the ladder's FIRST RUNG is now tier-chosen. `lite` takes the 2048-wide
      // `base` tier — which the pipeline has baked and shipped since C4 while the engine only
      // ever fetched `high`, so 6.58 MB of assets have been downloaded by nobody (the delivery
      // plan's B5 item, finally consumed). `balanced`/`full` still start at `high`.
      const ladder = this._quality.planetTexture;
      const firstFile =
        ladder === "base" ? entry.surface.base : entry.surface.high;
      const surface = new Texture(`/assets/planets/${firstFile}`, this._scene);
      // WRAP is load-bearing, not a default: the shader adds UV_LONGITUDE_OFFSET to u without
      // fract(), so sampling relies on the sampler wrapping past 1.0 (see planet-sphere.ts).
      surface.wrapU = Texture.WRAP_ADDRESSMODE;
      mat.setTexture("surfaceTex", surface);
      this._planetSurfaceTex?.dispose();
      this._planetSurfaceTex = surface;
      this._planetSurfaceTier = ladder === "base" ? "base" : "high";

      // PROGRESSIVE UPGRADE (PF-10 C4.2). The `high` tier lands fast and gets the body on
      // screen; `ultra` is 4-6 MB — worth waiting for, but not worth staring at a grey ball for.
      // The measured reason it exists at all: at the FIXED arrival distance the visible surface
      // patch is 23.5 degrees across, so a 4096 map supplies only ~268 texels for a 1080-px
      // viewport — a 4x magnification. 8192 halves that. The swap is guarded on the body not
      // having changed mid-fetch, or arriving elsewhere would paint the wrong planet.
      //
      // PF-11 D6.3.2: gated on the tier reaching `ultra-progressive`. Below that the upgrade is
      // not merely skipped — it is never FETCHED, which is the whole point on a constrained
      // device: the 4-6 MB download was previously unconditional regardless of tier.
      // PF-11 D9.1: the Render Console's `planet-hires` toggle is a SECOND gate on top of the
      // tier ceiling — a visitor on `full` who explicitly disabled it never pays for the ultra
      // fetch either, read live here rather than pushed through `_applyLayerToggle` (this only
      // takes effect on the NEXT body dressed, not the one currently on screen — an accepted v1
      // limitation, recorded in the TR, since retroactively dropping an already-loaded texture
      // would need its own departure-style disposal path).
      const ultraFile =
        ladder === "ultra-progressive" && this._layerOn("planet-hires")
          ? entry.surface.ultra
          : undefined;
      if (ultraFile) {
        const pending = key;
        const ultra = new Texture(`/assets/planets/${ultraFile}`, this._scene);
        ultra.wrapU = Texture.WRAP_ADDRESSMODE;
        ultra.onLoadObservable.addOnce(() => {
          if (this._planetBodyId !== pending || !this._planetMat) {
            ultra.dispose();
            return;
          }
          this._planetMat.setTexture("surfaceTex", ultra);
          this._planetSurfaceTex?.dispose();
          this._planetSurfaceTex = ultra;
          this._planetSurfaceTier = "ultra";
        });
      }

      if (entry.height) {
        const height = new Texture(
          `/assets/planets/${entry.height.high}`,
          this._scene,
        );
        height.wrapU = Texture.WRAP_ADDRESSMODE;
        mat.setTexture("heightTex", height);
        this._planetHeightTex?.dispose();
        this._planetHeightTex = height;
      } else if (this._planetPlaceholderTex) {
        // Back to the placeholder — never left bound to the PREVIOUS body's elevation, which
        // would silently paint Mars's canyons onto a body that has none.
        mat.setTexture("heightTex", this._planetPlaceholderTex);
      }

      // PF-10 C4 CLOSEOUT: pre-baked relief for the nine bodies whose pack data is a normal map.
      // Mutually exclusive with `height` across the whole pack, so the two uniforms can never
      // both be 1 — asserted by tests/unit/planet-asset-pipeline.test.ts rather than assumed.
      mat.setFloat("uHasNormal", entry.normal ? 1 : 0);
      if (entry.normal) {
        // `ultra` where the source justified one, else `high` — the same resolution argument the
        // surface tier rests on applies unchanged to its relief.
        const normal = new Texture(
          `/assets/planets/${entry.normal.ultra ?? entry.normal.high}`,
          this._scene,
        );
        normal.wrapU = Texture.WRAP_ADDRESSMODE;
        mat.setTexture("normalTex", normal);
        this._planetNormalTex?.dispose();
        this._planetNormalTex = normal;
      } else if (this._planetFlatNormalTex) {
        // Same discipline as the height path above: never left bound to the PREVIOUS body's
        // relief, which would carve Europa's ridges into a body that has none.
        mat.setTexture("normalTex", this._planetFlatNormalTex);
      }

      // Earth's cloud deck and ocean mask (PF-10 C4 closeout). PF-11 D6.3.4: `uAtmosphere` now
      // reads a REAL per-body manifest flag instead of inferring itself from the cloud map's
      // presence — the proxy this call site's own comment asked to replace. The two happen to
      // agree today (Earth is the only body with either), which is exactly why the proxy survived
      // this long and exactly why it had to go before a second body made them disagree silently.
      mat.setFloat("uHasCloud", entry.cloud ? 1 : 0);
      mat.setFloat("uAtmosphere", entry.atmosphere ? 1 : 0);
      if (entry.cloud) {
        const cloud = new Texture(
          `/assets/planets/${entry.cloud.ultra ?? entry.cloud.high}`,
          this._scene,
        );
        cloud.wrapU = Texture.WRAP_ADDRESSMODE;
        mat.setTexture("cloudTex", cloud);
        this._planetCloudTex?.dispose();
        this._planetCloudTex = cloud;
      } else if (this._planetBlackTex) {
        mat.setTexture("cloudTex", this._planetBlackTex);
      }
      // PF-11 D6.4: city lights. Only Earth ships a night map, and it is capped at `high`
      // (MAP_TIER_CAP) so there is no `ultra` to prefer.
      if (entry.night) {
        const night = new Texture(
          `/assets/planets/${entry.night.high ?? entry.night.base}`,
          this._scene,
        );
        night.wrapU = Texture.WRAP_ADDRESSMODE;
        mat.setTexture("nightTex", night);
        this._planetNightTex?.dispose();
        this._planetNightTex = night;
        mat.setFloat("uHasNight", 1);
      } else if (this._planetBlackTex) {
        // Same hazard the ocean mask has: a stale night map would paint another body's cities
        // across whatever came next, since the term is gated by uHasNight, not by body id.
        mat.setTexture("nightTex", this._planetBlackTex);
        mat.setFloat("uHasNight", 0);
      }
      if (entry.specular) {
        const spec = new Texture(
          `/assets/planets/${entry.specular.ultra ?? entry.specular.high}`,
          this._scene,
        );
        spec.wrapU = Texture.WRAP_ADDRESSMODE;
        mat.setTexture("specularTex", spec);
        this._planetSpecularTex?.dispose();
        this._planetSpecularTex = spec;
      } else if (this._planetBlackTex) {
        // Leaving the previous body's ocean mask bound would scatter Cox-Munk sunglint across
        // whatever body came next — the glint is multiplied by this mask, not by a body flag.
        mat.setTexture("specularTex", this._planetBlackTex);
      }
    }
    // The Lommel-Seeliger term needs the real emission angle, so the camera moves this uniform
    // every frame rather than only on arrival.
    mat.setVector3(
      "uCamPos",
      this._camScratch.set(this.cam[0], this.cam[1], this.cam[2]),
    );
    // Real sidereal rotation on its OWN clock -- 1e3, not the belt's 4e5, which would spin Mars
    // past Nyquist and alias it backwards (see ROTATION_TIME_ACCEL). Reduced motion passes 0,
    // which the helper reads as "hold still": the body keeps its real orientation, it just stops
    // turning.
    mesh.rotation.y = rotationAngle(
      key,
      this._reduced ? 0 : performance.now() / 1000,
    );
    this._planetSpin = mesh.rotation.y;
    mesh.isVisible = true;
    this._tickPlanetVt(key, spherePos, mesh.rotation.y);
    this._tickVenusDescent(key, spherePos, mat);
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

    this._bandBuilder = new MilkyWayBandBuilder();
    // PF-11 D0.1: start the between-frames driver immediately, so the build
    // progresses even before (or without) the first rendered frame.
    this._scheduleBandBuild();
  }

  /** PF-11 D0.1 — the between-frames half of the band build.
   *
   * Before this, the build ran ONLY inside the render loop, so its wall-time
   * scaled with 1/fps: at the ~1-3 fps a loaded SwiftShader CI run delivers,
   * the 512-row grid took tens of seconds and produced the "bandReady never
   * true" E2E failure class (TR-080 root cause; delivery plan D0.1).
   *
   * This chain runs build slices BETWEEN frames. Measured honestly (TR-081),
   * it is a supporting driver, not the fix: while the scene renders, the page
   * main thread is saturated and a self-rescheduling `setTimeout(0)` gets only
   * ~10 callbacks in 5 seconds — about one per frame. What it uniquely buys is
   * the case where rAF does NOT run at all (a backgrounded tab), where it is
   * the only driver. The wall-clock guarantee lives in the builder's deadline
   * pacing. Self-terminating: the chain stops once the builder reports done. */
  private _scheduleBandBuild() {
    if (this._bandBuildTimer !== undefined) return;
    if (!this._bandBuilder || this._bandReady) return;
    this._bandBuildTimer = setTimeout(() => {
      this._bandBuildTimer = undefined;
      this._buildBandSlice();
      this._scheduleBandBuild();
    }, 0);
  }

  /** One time-budgeted slice of the band texture build, finishing with the
   * single upload + placeholder swap (TR-059 / non-negotiable #9) whenever
   * the last row lands. Safe to call from either driver: the builder owns the
   * shared row cursor, so neither driver repeats the other's work. */
  private _buildBandSlice() {
    const builder = this._bandBuilder;
    if (!builder || this._bandReady) return;
    // The deadline yields to an in-flight warp. Deadline pacing spends MORE
    // frame time the slower the machine is — exactly the wrong trade during
    // the one sequence the visitor is watching frame by frame, and the same
    // reasoning `_waitForWarpIdle` already applies to the bulk layers. Idle
    // frames get the paced slice; warping frames get the plain 6 ms budget
    // and the band simply lands a little later.
    if (!builder.buildSlice(this.warp.mode === "idle")) return;
    this._bandReady = true;
    if (this._bandBuildTimer !== undefined) {
      clearTimeout(this._bandBuildTimer);
      this._bandBuildTimer = undefined;
    }
    const tex = RawTexture.CreateRGBATexture(
      builder.buf,
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
    // PF-11 D7.6: `builder.buf` (the ~2 MB CPU-side equirect RGBA buffer) has now been
    // uploaded to `tex` — the builder itself, and the buffer it retains, serve no further
    // purpose (`bandProgress`'s `_bandReady` short-circuit above never reads it again).
    this._bandBuilder = undefined;
  }

  /** Per-frame entry point: one build slice while the texture is still being
   * assembled (TR-059's frames-keep-producing contract — the band build must
   * never be the reason frames stop), then a slow fade-in once the single
   * upload lands. */
  /* --- PF-11 D2: the frame ladder (sky honesty by destination) --- */

  /** Builds the external-galaxy impostor (D2.2): a camera-facing quad with a
   * PROCEDURAL galaxy-disc texture (license-clean — see milky-way.ts's header
   * on why the photographic pano cannot ship). Hidden until an extragalactic
   * arrival. The texture is bound synchronously at creation — a declared
   * sampler needs a real resource before the mesh can ever draw (#9). */
  private _setupImpostor(scene: Scene, backend: "webgpu" | "webgl2") {
    const mesh = new Mesh("mwImpostor", scene);
    // Unit quad in the XY plane; billboardMode turns it to face the camera.
    const vd = new VertexData();
    vd.positions = [-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0];
    vd.uvs = [0, 0, 1, 0, 1, 1, 0, 1];
    vd.indices = [0, 1, 2, 0, 2, 3];
    vd.applyToMesh(mesh, false);
    mesh.billboardMode = Mesh.BILLBOARDMODE_ALL;
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isVisible = false;

    const mat = new ShaderMaterial(
      "mwImpostor",
      scene,
      { vertex: "ijImpostor", fragment: "ijImpostor" },
      {
        attributes: ["position", "uv"],
        uniforms: ["worldViewProjection", "uFade"],
        samplers: ["uTex"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_COMBINE;
    mat.setFloat("uFade", 0);
    const tex = RawTexture.CreateRGBATexture(
      buildMilkyWayImpostor(),
      MILKY_WAY_IMPOSTOR_SIZE,
      MILKY_WAY_IMPOSTOR_SIZE,
      scene,
      true, // mipmaps — the sprite is minified hard at its real angular size
      false,
      Texture.TRILINEAR_SAMPLINGMODE,
    );
    tex.hasAlpha = true;
    mat.setTexture("uTex", tex);
    mesh.material = mat;
    this._impostorMesh = mesh;
    this._impostorMat = mat;
    this._impostorTex = tex;
  }

  /** Drives the destination-keyed frame-ladder fades from the live warp state.
   * Called each frame after `_tickWarp` (so `prog` is fresh) and before the
   * band/asteroid ticks read the results. */
  private _updateFrameLadder() {
    const w = this.warp;
    // k: 0 while aiming (fades hold at their start), the integrated warp
    // progress during the burn, 1 once arrived/idle/ascending (fades at target).
    const k = w.mode === "warp" ? (w.prog ?? 0) : w.mode === "aim" ? 0 : 1;
    this._furnitureFade = frameLadderFade(
      this._furnitureFadeFrom,
      this._furnitureFadeTo,
      k,
      this._reduced,
    );
    this._localFieldFade = frameLadderFade(
      this._localFadeFrom,
      this._localFadeTo,
      k,
      this._reduced,
    );
    // D2.3: the figure dissolve (ly 50→500) — a separate, nearer schedule
    // than the local-field collapse above; both are read by _pushAberration.
    this._figureFade = frameLadderFade(
      this._figureFadeFrom,
      this._figureFadeTo,
      k,
      this._reduced,
    );
    this._beltMat?.setFloat("uLayerFade", this._furnitureFade);
    this._localMat?.setFloat("uLayerFade", this._localFieldFade);
    // Belt Havok sleeps once the belt is gone (D2.1). The band's own uFade is
    // handled in _tickMilkyWay, the constellation alpha in _pushAberration —
    // both read `_localFieldFade` (and, for the figures, `_figureFade`) directly.
    // PF-11 D9.1: the Render Console's `belt-physics` toggle is a SECOND, independent gate —
    // both the distance fade AND the layer state must want it awake for it to actually run.
    // A visitor who explicitly disabled belt physics stays disabled even parked at Mars; the
    // fade alone never overrides that preference.
    this._setBeltPhysicsAwake(
      this._furnitureFade > 0 && this._layerOn("belt-physics"),
    );
    this._updateImpostor();
  }

  /** PF-11 D7.5: `_tickAsteroids`'s existing `!_beltPhysicsAwake` guard (D2.1) already skips
   * OUR per-frame force-application loop while the belt is faded — but Havok's own solver was
   * still stepping and integrating every one of those bodies regardless, since skipping our
   * force loop doesn't stop the physics WORLD from simulating them. Setting every body STATIC
   * on fade-out actually halts that (Babylon's own docs: "unaffected by forces or collisions"),
   * and DYNAMIC on fade-in resumes it — this is the "measured refinement" `_tickAsteroids`'s own
   * comment named as deferred to this slice.
   *
   * Only touches the bodies when the awake state actually FLIPS (called every frame from
   * `_updateFrameLadder`, and `setMotionType` is a real Havok call per body, not a flag write —
   * looping 100+ bodies every single frame just to re-set the same value would be its own waste). */
  private _setBeltPhysicsAwake(awake: boolean) {
    if (awake === this._beltPhysicsAwake) return;
    this._beltPhysicsAwake = awake;
    if (this._physicsMode !== "havok" || !this._physicsMotionType) return;
    const motion = awake
      ? this._physicsMotionType.DYNAMIC
      : this._physicsMotionType.STATIC;
    for (const body of this._asteroidBodies) body.setMotionType(motion);
  }

  /** Places, sizes and reveals the external-galaxy impostor from the live
   * `_localFieldFade`. It fades in as the local field collapses, sits astern of
   * the extragalactic target, and is sized by that target's real angular
   * subtense (Astra §1/§5: a 30-kpc disc → ~10' from 32.6 Mly), floored to a
   * visible minimum — the same declared-license overbrightness the belt carries.
   *
   * POSITION IS CAMERA-RELATIVE, at a constant `IMPOSTOR_DIST` from the camera
   * each frame (Fable-5 review fix, TR-090 addendum). The first implementation
   * parked it at 0.9 × the band radius from the WORLD ORIGIN — but the band
   * skybox is CAMERA-centred (`infiniteDistance`, an opaque depth-writing shell
   * at a constant 2000 from the camera), and at an nbg arrival the camera sits
   * ~1040 units out on the destination side, putting the impostor ~2840 from
   * the camera: beyond the shell, so every fragment DEPTH-FAILED behind the
   * band. State said visible; zero pixels — the B4 class. Camera-anchoring is
   * also the honest physics: an object tens of Mly away has zero parallax
   * across any in-scene camera motion, the same reasoning as the band's own
   * infiniteDistance. The E2E now asserts PIXELS (aimAt("impostor") +
   * screenshot), not just the state flag, so this class cannot recur silently. */
  private _updateImpostor() {
    const mesh = this._impostorMesh;
    const mat = this._impostorMat;
    if (!mesh || !mat) return;
    const appear = 1 - this._localFieldFade; // 0 in-galaxy … 1 fully collapsed
    const visible = appear > 0.001;
    this._impostorVisible = visible;
    if (mesh.isVisible !== visible) mesh.isVisible = visible;
    if (!visible) return;
    mat.setFloat("uFade", appear);
    // Astern of the target, a fixed distance from the CAMERA — always inside
    // the band shell (2000) and the far plane (6000), never occluded.
    const D = IMPOSTOR_DIST;
    mesh.position.set(
      this.cam[0] - this._farDestDir[0] * D,
      this.cam[1] - this._farDestDir[1] * D,
      this.cam[2] - this._farDestDir[2] * D,
    );
    // 2·atan(R_MW / d), R_MW ≈ 15 kpc = 48,930 ly, floored so the honest ~10'
    // subtense still reads on screen (declared license, like the belt exposure).
    const MW_HALF_LY = 48930;
    const IMPOSTOR_MIN_HALF = 45;
    const theta =
      2 * Math.atan(MW_HALF_LY / Math.max(this._farDestLy, MW_HALF_LY));
    const half = Math.max(D * Math.tan(theta / 2), IMPOSTOR_MIN_HALF);
    mesh.scaling.set(half, half, half);
  }

  private _tickMilkyWay() {
    if (!this._bandReady) {
      this._buildBandSlice();
      return;
    }
    if (this._bandFadeAmt < 1) {
      this._bandFadeAmt = Math.min(
        1,
        this._bandFadeAmt + (this._reduced ? 1 : 0.012),
      );
    }
    // PF-11 D2.2: the band's effective opacity is the boot fade-in modulated by
    // the extragalactic collapse — it shrinks to nothing at an SDSS/NBG arrival
    // (`_localFieldFade` → 0) and restores on the way home. The launch ascent
    // owns `uFade` while it runs (it fades the band in with altitude), so this
    // must not clobber it. `_localFieldFade` is 1 for every in-galaxy target,
    // so this is a no-op change everywhere except extragalactic travel.
    if (this.warp.mode !== "ascent") {
      // PF-11 D9.1: `_bandLayerEnabled` is a third multiplicand alongside the boot ramp and
      // the D2.2 extragalactic collapse — 1 unless the Render Console (or `?layers=`) turned
      // this layer off, in which case the whole product is forced to 0 regardless of the
      // other two.
      this._bandMat?.setFloat(
        "uFade",
        this._bandLayerEnabled ? this._bandFadeAmt * this._localFieldFade : 0,
      );
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

  // --- PF-10 C1: GD-1 connected-trail visual ---

  /** Real radial velocity, parsed from the catalog entry's already-formatted
   * display string (e.g. "-181.7 km/s") — celestial-gd1.js is a generated/
   * verbatim-ported data file (CLAUDE.md non-negotiable #22, never hand-
   * edited), so re-extracting the real number from its one existing field
   * is the smallest coherent way to get it, rather than regenerating the
   * whole file for a second raw-numeric field. parseFloat correctly ignores
   * the trailing unit text; real coverage is 0 missing across all 1,365
   * stars (checked directly against the source VOTable before designing
   * this feature). */
  private _parseGd1RadialVelocity(st: readonly [string, string, number][]) {
    const row = st.find(([label]) => label === "Radial velocity");
    if (!row) return null;
    const n = Number.parseFloat(row[1]);
    return Number.isFinite(n) ? n : null;
  }

  /** Builds the static connected-trail line mesh for GD-1's 1,365 real
   * member stars — see gd1-trail.ts's header and the Astra science brief
   * (docs/analysis/2026-07-20-gd1-connected-trail-science-brief.md) for the
   * real astrophysics: stars are ordered by a great-circle fit to their own
   * real (ra, dec) positions (NOT catalog row order, which is confirmed
   * arbitrary), then coloured along the line by real radial velocity — a
   * genuine, literature-standard GD-1 diagnostic, not decoration. Reuses
   * each star's ALREADY-COMPUTED world position from `this.bodies` (built
   * via the same `bodyWorldPosition` every travelable body uses), so the
   * trail's vertices land exactly on the existing rendered points, never
   * drifting from them. */
  private _setupGd1Trail(
    scene: Scene,
    engine: AbstractEngine,
    backend: "webgpu" | "webgl2",
  ) {
    const positionById = new Map<string, Vec3>();
    for (const b of this.bodies) positionById.set(b.e.id, b.pos);

    const stars: { id: string; ra: number; dec: number; rv: number }[] = [];
    for (const e of window.CELESTIAL ?? []) {
      if (!e.id.startsWith("gd1-member-")) continue;
      const rv = this._parseGd1RadialVelocity(e.st);
      if (rv == null || !positionById.has(e.id)) continue; // honest skip, not fabricated
      stars.push({ id: e.id, ra: e.ra, dec: e.dec, rv });
    }
    if (stars.length < 2) return; // nothing to connect

    let rvMin = Infinity;
    let rvMax = -Infinity;
    for (const s of stars) {
      if (s.rv < rvMin) rvMin = s.rv;
      if (s.rv > rvMax) rvMax = s.rv;
    }

    const order = orderGd1Stream(stars);
    const orderedPositions = order.map((i) => positionById.get(stars[i].id)!);
    const orderedColors = order.map((i) =>
      radialVelocityToColor(stars[i].rv, rvMin, rvMax),
    );
    const trail = buildGd1TrailMesh(orderedPositions, orderedColors);
    this._gd1SegmentCount = trail.count;
    if (trail.count === 0) return;

    const mesh = new Mesh("gd1Trail", scene);
    this._gd1Mesh = mesh;
    const vd = new VertexData();
    vd.positions = trail.positions;
    const indices = new Uint32Array(trail.count * 2);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
    vd.indices = indices;
    vd.applyToMesh(mesh, false);
    mesh.setVerticesBuffer(
      new VertexBuffer(engine, trail.colors, "gd1Color", false, false, 3),
    );
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;

    const mat = new ShaderMaterial(
      "gd1Trail",
      scene,
      { vertex: "ijGd1Trail", fragment: "ijGd1Trail" },
      {
        attributes: ["position", "gd1Color"],
        uniforms: ["view", "projection"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.fillMode = Material.LineListDrawMode;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;
    // PF-11 D9.1: honour a layer state resolved (URL/localStorage/tier) before boot reached
    // here — e.g. `?layers=gd1-trail:0`.
    mesh.setEnabled(this._layerState["gd1-trail"] !== false);
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
      ubo.addUniform("uVolumeA", 1);
      ubo.addUniform("uRevealA", 1);
      ubo.addUniform("uVolumeB", 1);
      ubo.addUniform("uRevealB", 1);
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
    // PF-11 D9.1: honour a layer state resolved before boot reached here.
    mesh.setEnabled(this._nebulaLayerEnabled);
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
    // 2026-07-20 amendment: at most 2 volumes ever matter at once (the
    // current destination + the one just departed, still fading) — see
    // topTwoReveal's doc comment. -1 as a volume index never matches any
    // real 0-based `i` in the generated per-volume reveal comparison.
    const { volA, revealA, volB, revealB } = topTwoReveal(this._nebulaReveal);
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
      ubo.updateFloat("uVolumeA", volA);
      ubo.updateFloat("uRevealA", revealA);
      ubo.updateFloat("uVolumeB", volB);
      ubo.updateFloat("uRevealB", revealB);
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
      proc.setFloat("uVolumeA", volA);
      proc.setFloat("uRevealA", revealA);
      proc.setFloat("uVolumeB", volB);
      proc.setFloat("uRevealB", revealB);
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
      // PF-11 D2: keep the frame-ladder clones' halo budget in lockstep.
      this._localMat?.setFloat("uHaloAmp", budget.haloAmp);
      this._beltMat?.setFloat("uHaloAmp", budget.haloAmp);
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
    // PF-11 D1.1. Declared out here so the `finally` below can close it on every
    // exit path. Note there is deliberately NO stage when `?craft=off` resolves
    // above — a download that never happens should not appear in the dossier at
    // all, rather than appear and instantly complete.
    const craftStage = new StageAggregator("craft-glb", emitStage);
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
      // PF-11 D1.1: ImportMeshAsync has always accepted an `onProgress`; the
      // loading-stages audit found it simply unused, so the tiered GLB was one
      // of the assets the old HUD could not report at all. Babylon's own
      // ISceneLoaderProgressEvent carries the real XHR numbers — no second
      // fetch, no wrapper — with `lengthComputable` false meaning "no
      // Content-Length", which maps exactly onto our null total.
      const craftUrl = `/assets/craft/sci-fi-fighter-${tier}.glb`;
      const craftSink = craftStage.sink(craftUrl);
      const result = await ImportMeshAsync(craftUrl, scene, {
        onProgress: (ev) =>
          craftSink({
            stage: "craft-glb",
            loadedBytes: ev.loaded,
            totalBytes: ev.lengthComputable ? ev.total : null,
            done: false,
            bootCritical: false,
          }),
      });
      // The TRANSFER is complete the moment ImportMeshAsync resolves; the mesh
      // normalisation, plume and shimmer work below is local. Closing the stage
      // here rather than at the end of the method keeps the dossier's meaning
      // exact — it reports downloads, not scene-graph assembly.
      craftStage.finish();
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
    } finally {
      // Idempotent safety net for the failure path (a 404 GLB throws before the
      // finish above ever runs) — a stage left open would sit in the dossier as
      // permanently streaming while the scene has already flown on camera-only.
      craftStage.finish();
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
      // PF-11 D3.2: the eased cutoff/relight envelope rides along additively —
      // reduced motion passes no relightK, keeping the original boolean plume.
      plume = plumeParamsForWarp(k, this._reduced, tS, this._relightK);
      this._burnEnv = plume.env ?? 1;
      // PF-11 D3.2: hull position uses the same v4 profile as the camera, so
      // ship and chase can never disagree about where the ship is.
      const e = warpEaseV4(k, this._flipRate, WARP_ACCEL_END, WARP_DECEL_START);
      const wd = w.dir;
      this._ship.position.set(
        w.from[0] + (w.to[0] - w.from[0]) * e + wd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + (w.to[1] - w.from[1]) * e + wd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + (w.to[2] - w.from[2]) * e + wd[2] * SHIP_VIEW_DEPTH,
      );
      const base = quatFromUnitVectors(BABYLON_FORWARD, wd);
      const f = this._reduced ? (k > 0.5 ? 1 : 0) : flipPhase(k);
      // PF-11 D3.2: RCS puffs at the two ends of the rotation — the thrusters
      // that START the spin and the counter-pair that STOP it. One-shot per
      // journey each, reusing the ember buffer (no new mesh/material).
      if (!this._reduced) {
        if (!this._rcsFired[0] && k >= FLIP_ROT_START) {
          this._rcsFired[0] = true;
          this._rcsPending++;
        }
        if (!this._rcsFired[1] && k >= FLIP_ROT_END) {
          this._rcsFired[1] = true;
          this._rcsPending++;
        }
      }
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
    // PF-11 D7.4: rebuild + re-upload the plume geometry only when the flare length that
    // drives it actually changed — see _lastPlumeFlareLen's own comment for why this mostly
    // matters under reduced motion, where the shape genuinely holds steady between phases.
    const flareLen = plumeFlareLength(p);
    if (flareLen !== this._lastPlumeFlareLen) {
      this._lastPlumeFlareLen = flareLen;
      plumeBuffersForWrapper(
        flareLen,
        this._plumeScratch,
        this._plumePos,
        this._plumeMeta,
      );
      this._plumeMesh?.updateVerticesData(
        VertexBuffer.PositionKind,
        this._plumePos,
      );
      this._plumeMesh?.updateVerticesData("plumeMeta", this._plumeMeta);
    }
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
    if (this._rcsPending > 0) this._emitRcsPuffs();
    if (this._embers.length) {
      const live: Ember[] = [];
      for (const e of this._embers) if (stepEmber(e, this._dtS)) live.push(e);
      this._embers = live;
    }
    // PF-11 D7.4: bursts are momentary — most frames have zero live embers, and re-uploading
    // an all-empty buffer forever after the burst ends was pure waste. Rebuild + upload
    // whenever there's anything live (positions genuinely move every frame) OR the count just
    // dropped to zero (the one frame that must clear whatever was still showing).
    if (this._embers.length || this._lastEmberCount !== 0) {
      emberBillboards(this._embers, this._emberPos, this._emberMeta);
      this._emberMesh?.updateVerticesData(
        VertexBuffer.PositionKind,
        this._emberPos,
      );
      this._emberMesh?.updateVerticesData("emberMeta", this._emberMeta);
    }
    this._lastEmberCount = this._embers.length;

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
    // PF-10 C3: the belt's physics bodies are now REAL Gaia DR3 asteroids — real positions and
    // real Keplerian velocities, baked at a stated snapshot date (see asteroids-dr3-physics.ts).
    // `buildAsteroidField`'s procedural torus survives only as the fallback for an empty catalog;
    // it is never the shipping path. Body COUNT is unchanged — the tier budget is a frame-time
    // fact, not a data one, so the real catalog changes which rocks exist, not how many.
    const field = REAL_ASTEROIDS.bodies.length
      ? buildRealAsteroidField(REAL_ASTEROIDS, count, 7)
      : buildAsteroidField(count, 7);
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
      // PF-11 D1.1: 2.09 MB, and previously invisible to any progress UI —
      // Emscripten fetches the .wasm itself, inside the factory, where nothing
      // could observe it. Streaming it here first and handing over the buffer
      // via `wasmBinary` makes those bytes real to the dossier.
      //
      // This does NOT double-fetch, and that was verified in the vendored
      // runtime rather than assumed (TR-081's lesson about probing before
      // building on an assumption): HavokPhysics_es.js reads
      // `wasmBinary=Module["wasmBinary"]` and its `getBinarySync` returns
      // `new Uint8Array(wasmBinary)` before any network path is considered, so
      // the buffer short-circuits the internal fetch entirely.
      //
      // `locateFile` is KEPT alongside it, deliberately: if a future Havok bump
      // ever stops honouring `wasmBinary`, the factory silently falls back to
      // fetching — which must still resolve to our same-origin Vite-emitted
      // URL and never a CDN (ADR-0005's stance; CSP wasm-unsafe-eval covers it).
      // Losing progress reporting is an acceptable degradation; losing the
      // origin guarantee is not.
      const havokStage = new StageAggregator("havok-wasm", emitStage);
      let wasmBinary: ArrayBuffer | undefined;
      try {
        const wasmBlob = await fetchWithProgress(
          havokWasmUrl,
          "havok-wasm",
          havokStage.sink(havokWasmUrl),
        );
        wasmBinary = await wasmBlob.arrayBuffer();
      } catch (e) {
        // Not fatal: dropping the prefetch just returns Havok to fetching the
        // binary itself through locateFile, exactly as it did before D1.1.
        console.warn(
          "[babylon-engine] Havok wasm prefetch failed, falling back to locateFile",
          e,
        );
      } finally {
        havokStage.finish();
      }
      const havok = await (
        havokFactory.default as unknown as (o: {
          locateFile: () => string;
          wasmBinary?: ArrayBuffer;
        }) => Promise<unknown>
      )({ locateFile: () => havokWasmUrl, wasmBinary });
      if (!this._scene) return; // disposed while loading
      const plugin = new HavokPlugin(true, havok);
      // zero gravity: space — the belt-pull herding force is applied per
      // frame in _tickAsteroids, not via global gravity
      scene.enablePhysics(new Vector3(0, 0, 0), plugin);
      // PF-11 D7.5: same already-imported module `shapeTypes` reads PhysicsShapeType from —
      // captured once here so _setBeltPhysicsAwake can toggle motion type with no further import.
      this._physicsMotionType = shapeTypes.PhysicsMotionType;
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
          if (!this._beltPhysicsAwake) return; // PF-11 D2.1: no phantom shake from a faded belt
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
  /** PF-11 D7.4: applies aberration/Doppler uniforms to one material, or does nothing for a
   * clone that hasn't been created yet (`_beltMat`/`_bandMat` land post-boot). Factored out of
   * `_pushAberration` so that per-frame call — every frame, unconditionally, from `_tickWarp` —
   * no longer builds a fresh 7-element array just to iterate it once. */
  private _setAberrationUniforms(
    m: ShaderMaterial | undefined,
    beta: number,
    gamma: number,
  ) {
    if (!m) return;
    m.setFloat("uBeta", beta);
    m.setFloat("uGamma", gamma);
    m.setVector3("uWarpDir", this._warpDirScratch);
  }

  private _pushAberration(wd: readonly [number, number, number]) {
    const beta = this._beta;
    const gamma = beta > 0 ? 1 / Math.sqrt(1 - beta * beta) : 1;
    this._warpDirScratch.copyFromFloats(wd[0], wd[1], wd[2]);
    this._setAberrationUniforms(this._starMat, beta, gamma);
    // PF-11 D2: the frame-ladder clones share the same aberration/Doppler
    // uniforms as the base — they differ only in `uLayerFade`.
    this._setAberrationUniforms(this._localMat, beta, gamma);
    this._setAberrationUniforms(this._beltMat, beta, gamma);
    this._setAberrationUniforms(this._bodyMat, beta, gamma);
    this._setAberrationUniforms(this._photoMat, beta, gamma);
    this._setAberrationUniforms(this._trailMat, beta, gamma);
    this._setAberrationUniforms(this._bandMat, beta, gamma);
    // Constellation figures fade during relativistic transit — matches
    // space-engine.js's `uColor(..., 0.34 * (1 - beta))` exactly. No
    // aberration/Doppler on this pass (out of GAP-06's scope per the gap
    // analysis; see _setupConstellations), just the alpha term. PF-11 D2.2:
    // the figures also collapse with the rest of the local field at an
    // extragalactic arrival (they are parallax accidents of local stars —
    // Astra §1), so the alpha is additionally scaled by `_localFieldFade`.
    // D2.3: a SEPARATE, much nearer dissolve (ly 50→500, `_figureFade`) —
    // the figures stop being honest for an in-galaxy destination long
    // before the whole local field collapses at EXTRAGALACTIC_LY.
    if (this._conMat) {
      this._conColorScratch.a =
        0.34 * (1 - beta) * this._localFieldFade * this._figureFade;
      this._conMat.setColor4("uColor", this._conColorScratch);
    }
  }

  /** PF-11 D3.2 — RCS attitude-thruster puffs for the flip (Vega's beat sheet).
   *
   * A pitch rotation is produced by a COUPLE: two thrusters firing in opposite
   * lateral directions at opposite ends of the hull. Both ends are emitted
   * here as one burst; the choreography fires a burst to start the rotation
   * and a counter-burst to stop it. Reuses the ember buffer and its existing
   * mesh/material — no new draw call, no new asset (#1). */
  private _emitRcsPuffs() {
    if (!this._ship) {
      this._rcsPending = 0;
      return;
    }
    const bursts = this._rcsPending;
    this._rcsPending = 0;
    const q = this._shipQuat;
    const scale = this._shipScale;
    const shipPos = this._ship.position;
    for (let b = 0; b < bursts; b++) {
      // Two nozzles of the couple: fore (+Z) pushing +Y, aft (−Z) pushing −Y.
      for (const end of [1, -1] as const) {
        for (let i = 0; i < RCS_PUFF_COUNT; i++) {
          if (this._embers.length >= MAX_EMBERS) break;
          const spread = () => (Math.random() - 0.5) * RCS_PUFF_SPREAD;
          // Local: at the hull end, venting laterally (±Y) away from the hull.
          const lp: [number, number, number] = [
            spread(),
            end * 0.05,
            end * 0.22,
          ];
          const lv: [number, number, number] = [
            spread(),
            end * RCS_PUFF_SPEED,
            spread(),
          ];
          const wp = quatRotate(q, lp);
          const wv = quatRotate(q, lv);
          this._embers.push({
            x: shipPos.x + wp[0] * scale,
            y: shipPos.y + wp[1] * scale,
            z: shipPos.z + wp[2] * scale,
            vx: wv[0] * scale,
            vy: wv[1] * scale,
            vz: wv[2] * scale,
            life: RCS_PUFF_LIFE,
          });
        }
      }
    }
  }

  private _tickAsteroids() {
    // PF-11 D2.1: when the belt has faded out (any DSO/extragalactic
    // destination) its physics sleeps — Astra §2: stepping belt physics while
    // parked at an SDSS galaxy is pure waste, and the belt is invisible anyway.
    // Skipping the force loop below is the low-risk half of that sleep; the collision
    // callback is likewise gated (below) so invisible rocks never shake the camera.
    // PF-11 D7.5: Havok itself now actually stops integrating these bodies too —
    // `_setBeltPhysicsAwake` (called from `_updateFrameLadder`) sets every body STATIC on the
    // same fade-out this flag reflects, DYNAMIC again on fade-in. This early return stays: even
    // with the bodies STATIC, there is no reason to run the per-rock loop below at all.
    if (!this._beltPhysicsAwake) return;
    if (this._physicsMode === "havok") {
      const f = this._asteroidField;
      if (!f) return;
      // B4 step 2: the warping ship ploughs through the field — bodies near
      // the virtual-ship position get a mass-scaled outward push
      const sw = this.warp.mode === "warp" ? this._shipWorld : null;
      for (let i = 0; i < this._asteroidBodies.length; i++) {
        const p = this._asteroidInstances[i].position;
        // 2026-07-29 code review, finding 3: the `Into` variant writes into the reused
        // `_beltPullScratch` — the tuple-returning `beltPullAccel` allocated once per rock per
        // frame in this loop. Same math, same function; see babylon-asteroids.ts's own note.
        beltPullAccelInto(p.x, p.y, p.z, this._beltPullScratch);
        const m = f.masses[i];
        this._asteroidPull.set(
          this._beltPullScratch[0] * m,
          this._beltPullScratch[1] * m,
          this._beltPullScratch[2] * m,
        );
        this._asteroidBodies[i].applyForce(this._asteroidPull, p);
        if (sw) {
          // PF-11 D7.4: `Into` variant, same reasoning as beltPullAccelInto above — this branch
          // is live for every rock for the whole duration of a warp through the belt.
          passageDeflectForceInto(
            sw[0],
            sw[1],
            sw[2],
            p.x,
            p.y,
            p.z,
            m,
            this._deflectScratch,
          );
          const fx = this._deflectScratch[0];
          const fy = this._deflectScratch[1];
          const fz = this._deflectScratch[2];
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
  /** TR-103 zoom feature (Vega SHOT-BRIEF): applies one zoom step (positive = in,
   * negative = out; fractional/large values from a wheel delta are fine) as a
   * MULTIPLICATIVE change to the TARGET distance — the eased approach toward that
   * target happens once per idle frame in `_tickWarp`, not here, so a fast burst of
   * wheel/key input compounds smoothly against a moving spring target rather than
   * fighting it. A safe no-op unless genuinely parked with something to zoom
   * relative to (mid-warp/ascent/aim, or parked with neither a target nor the home
   * orbit armed — shouldn't happen, but this guard makes it inert rather than
   * undefined if it ever does). */
  private _adjustZoom(steps: number) {
    if (this.warp.mode !== "idle") return;
    if (!this._homeOrbit && !this._parkedTargetPos) return;
    const raw = this._zoomTargetDist * Math.pow(1 - ZOOM_STEP, steps);
    this._zoomTargetDist = clampZoomDistance(
      raw,
      this._zoomIsPlanet,
      this._zoomRestDist,
    );
  }

  private _bindPointer(canvas: HTMLCanvasElement) {
    // TR-103 zoom feature: wheel-to-zoom, parked states only (a no-op mid-warp is
    // handled inside _adjustZoom itself, but preventDefault only when it could
    // actually do something, so page/section scroll is never blocked for no reason).
    canvas.addEventListener(
      "wheel",
      (ev) => {
        if (this.warp.mode !== "idle") return;
        ev.preventDefault();
        // Natural mapping: scrolling "down" (positive deltaY) zooms out, matching
        // every map/inspection-camera convention a visitor already knows.
        this._adjustZoom(-ev.deltaY / 100);
      },
      { passive: false },
    );
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
        // Bug fix: once the visitor has actually looked around, the home orbit's
        // automatic aim-at-planet driver must stop overriding them on release — see the
        // field's own doc comment for why this exists.
        this._homeLookOverridden = true;
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
      "Interactive star chart. Arrow keys look around, Enter travels to the target nearest screen centre, H returns home, plus and minus zoom in and out.",
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
      } else if (k === "+" || k === "=") {
        // TR-103 zoom feature: '=' is the unshifted key '+' shares on most layouts —
        // accepting both means a visitor doesn't need Shift held for zoom-in.
        this._adjustZoom(1);
      } else if (k === "-" || k === "_") {
        this._adjustZoom(-1);
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

  /** PF-11 D5.3 — nearest field-catalog entry of a given deep-layer population byte
   * (`FIELD_TYPES` in spaceHelpers.ts: 1=OC, 2=WD, 3=SDSS, 4=GD-1, 5=EXO, 6=AST, 7=OORT) to the
   * ship's current position, for the search console's "A WHITE DWARF · NEAREST INSTANCE"-style
   * class rows. Returns the field index (pass to `travelTo("fs-"+i)` via D4.2's already-shipped
   * branch) or -1 if the field isn't loaded yet or has no member of that type. The actual scan
   * is `star-catalog.ts`'s pure `nearestOfType` (unit-tested off-GPU, same reasoning TR-097
   * used for `raySphereDist`); this method's own job is only the per-camera-epoch memoization
   * (see `_classEpochCache`), since it runs once per class row on every search keystroke, not
   * once per frame. */
  nearestFieldOfType(typeByte: number): number {
    const f = this._field;
    if (!f || !f.count) return -1;
    const [cx, cy, cz] = this.cam;
    const epoch = `${Math.round(cx / 5)},${Math.round(cy / 5)},${Math.round(cz / 5)}`;
    if (!this._classEpochCache || this._classEpochCache.epoch !== epoch) {
      this._classEpochCache = { epoch, byType: new Map() };
    }
    const cached = this._classEpochCache.byType.get(typeByte);
    if (cached !== undefined) return cached;
    const result = nearestOfType(f, typeByte, this.cam);
    this._classEpochCache.byType.set(typeByte, result);
    return result;
  }

  /** PF-11 D6.4 bug fix: the planet sphere occludes ray-based picking, or `Infinity` when
   * nothing is currently rendered there. See ship-dynamics.ts's header comment for why this
   * exists — the picker below is screen-space-nearest, not depth-aware, so without this a
   * solid sphere on screen was invisible to hit-testing and DSOs "behind" it stayed
   * hoverable/clickable through it. */
  private _planetOcclusionDist(
    camPos: readonly [number, number, number],
    dir: readonly [number, number, number],
  ): number {
    const mesh = this._planetMesh;
    if (!mesh || !mesh.isVisible) return Infinity;
    const p = mesh.position;
    return raySphereDist(camPos, dir, [p.x, p.y, p.z], PLANET_SPHERE_RADIUS);
  }

  private _pickField(
    dir: readonly [number, number, number],
    camPos: readonly [number, number, number],
  ): number {
    const f = this._field;
    if (!f || !f.count) return -1;
    const [ux, uy, uz] = dir;
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
    const dir = cursorRayDir(
      x,
      y,
      rectW,
      rectH,
      basis.right,
      basis.up,
      basis.fwd,
      basis.tanFov,
      basis.aspect,
    );
    // PF-11 D6.4 bug fix: the same cursor ray the field pick below uses, tested against
    // the planet sphere once per pick rather than once per candidate.
    const occDist = this._planetOcclusionDist(basis.camPos, dir);
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
    if (best) {
      // The sphere occludes this candidate only if it's genuinely further away than the
      // sphere's near surface along (approximately) the same ray — a body within the 34px
      // hit radius is close enough in screen space that the cursor's own ray is a fair
      // proxy for the body's, at a 26-world-unit sphere's scale.
      const dx = best.pos[0] - basis.camPos[0],
        dy = best.pos[1] - basis.camPos[1],
        dz = best.pos[2] - basis.camPos[2];
      if (Math.hypot(dx, dy, dz) > occDist) best = null;
    }
    let id: string | null = best ? best.e.id : null;
    if (!id) {
      this._fp = (this._fp + 1) | 0;
      if (this._fp % 2 === 0) {
        // Field stars sit at real catalog distances, always far beyond the 26-unit
        // sphere — any finite occlusion distance means the sphere is nearer than any
        // star could be, so skip the field pick outright rather than compute it and
        // then discard it.
        const fi =
          occDist === Infinity ? this._pickField(dir, basis.camPos) : -1;
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

  /** PF-11 D4.2 — synthesize a travel target for a field/deep-layer object (`fs-<i>`).
   *
   * Ports space-engine.js:1482-1497. The ~168,883 hoverable field objects (base HIP field plus
   * PF-10's WD/SDSS/OC/GD-1/EXO/AST/OORT layers) are billboard instances in one GPU mesh, not
   * `bodies` entries — so `travelTo` could never resolve one and silently returned, even though
   * the hover tooltip was showing `CLICK TO TRAVEL ▸` over it. Synthesizing a body here (never
   * pushing it into `this.bodies`, exactly as the legacy engine keeps it local) lets the whole
   * select→warp→arrive→vista→card path run unchanged, which is what revives
   * `entryForFieldStar` on the default engine.
   *
   * TWO DELIBERATE DIVERGENCES FROM THE LEGACY SOURCE, both because Babylon's field is not the
   * field space-engine.js had:
   *
   * 1. `positions` is 3 floats per star here, not the legacy `fieldF`'s 4 — a verbatim `i*4`
   *    port would read a neighbouring star's coordinates and fly somewhere else entirely.
   *    Pinned by a test on `fieldStarTarget`, which owns that parse/stride contract.
   * 2. `ly` comes from `fieldInfo(i)`, NOT the implementation plan's prescribed legacy `L*3.9`.
   *    For the base HIP field (type 0) `fieldInfo` returns exactly `r * 3.9`, so the two engines
   *    agree wherever both have data — which is what the plan's instruction was actually for.
   *    But PF-10's bonus layers are LOG-DEPTH-scaled (`fieldInfo`'s `type > 0` branch), and
   *    `L*3.9` would report an SDSS galaxy at ~2,000 ly instead of ~1e9. That is not cosmetic:
   *    `lyTotal` drives `warpDurationForLy`, `localFieldVisibility` and `_farDestLy`, so the
   *    literal port would have left D2.2's extragalactic collapse and its impostor dead for
   *    precisely the deep-field objects they exist to serve — and would have made the arrival
   *    card (which reads `fieldInfo` via `entryForFieldStar`) disagree with the journey the
   *    visitor just flew. `fieldInfo` is the same source the tooltip and card already read, so
   *    routing through it makes them agree by construction rather than by coincidence.
   */
  private _fieldBody(id: string): BabylonBody | undefined {
    const f = this._field;
    if (!f) return undefined;
    const t = fieldStarTarget(id, f.positions, f.count);
    if (!t) return undefined;
    const fi = this.fieldInfo(t.index);
    if (!fi) return undefined;
    return {
      e: { id, ra: fi.ra, dec: fi.dec, ly: fi.ly },
      pos: t.pos,
      dir: t.dir,
      vis: false,
    };
  }

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
      this._bodyById.get(id) ??
      this.stations.find((x) => x.e.id === id) ??
      // PF-11 D4.2: resolved BEFORE the D3.3 policy gate below, so a field object picked
      // mid-journey QUEUES like any other destination instead of falling out the `!b` return
      // as a fresh silent no-op. The queue drain re-enters `travelTo`, which re-synthesizes.
      this._fieldBody(id);
    if (!b) return; // unknown id — nothing to queue or fly to
    // PF-11 D3.3 (ADR-0010): picking a destination mid-journey used to be a
    // silent no-op. It now QUEUES — the pick is remembered, announced, and
    // launched on arrival. Last selection wins, so a visitor who changes their
    // mind three times mid-warp gets the third body, not the first.
    const policy = flightInputPolicy(this.warp.mode, "travel");
    if (policy === "ignore") return; // ascent: the cinematic owns the camera
    if (policy === "queue") {
      this.queuedTargetId = id;
      emit("cosmos:retarget-queued", { id, quiet: !!quiet });
      return;
    }
    if (this.arrivedId === id) {
      emit("cosmos:arrive", { id, quiet: !!quiet }); // already parked — open dossier
      return;
    }
    const dir = b.dir;
    // TR-103 (Vega SHOT-BRIEF): planet/moon/dwarf bodies get the larger, decoupled
    // PLANET_ARRIVE_STANDOFF — everything else (stars, DSOs, stations, fs- field
    // objects, all of which are "star"-typed per entryForFieldStar) keeps the
    // original ARRIVE_STANDOFF, untouched.
    const standoff =
      b.e.t === "planet" || b.e.t === "moon" || b.e.t === "dwarf"
        ? PLANET_ARRIVE_STANDOFF
        : ARRIVE_STANDOFF;
    const to: [number, number, number] = [
      b.pos[0] - dir[0] * standoff,
      b.pos[1] - dir[1] * standoff,
      b.pos[2] - dir[2] * standoff,
    ];
    this.arrivedId = null;
    this._beginWarp(b, to, false, !!quiet, b.e.ly ?? 0);
    emit("cosmos:select", { id, quiet: !!quiet });
  }

  /** PF-11 D6.4 — is the camera in (or arriving at) the home orbit?
   *
   * ONE predicate, deliberately, because the old `|cam| < 1` test appeared in TWO places that had
   * to agree — `goHome`'s early-return and `_tickWarp`'s idle-drift branch — and redefining home
   * in only one of them would have made `goHome` re-warp out of its own orbit forever. */
  private _isAtHomeVantage(): boolean {
    if (this.arrivedId) return false;
    // Requires the orbit to be ARMED, not merely "somewhere near the origin", and the difference
    // is not pedantic: at boot the camera sits at [0,0,0], which is INSIDE a sphere of radius 26.
    // A radius-only predicate revealed Earth there — camera inside the planet, and ~2.5 MB of
    // Earth textures fetched during startup on every single page load, competing with the
    // boot-critical set D1.1 measures. The delivery plan's own wording is "Earth goHome reveal";
    // arriving home is the trigger, and `_homeOrbit` is exactly that state.
    if (!this._homeOrbit) return false;
    const r = Math.hypot(this.cam[0], this.cam[1], this.cam[2]);
    return r <= HOME_ORBIT_RADIUS + 1;
  }

  /** Where a `goHome` warp actually lands: the orbit's phase-0 point (the spec'd ra 160 / dec 0
   * vantage), not the origin — which is now inside the Earth sphere. */
  private _homeArrivalPoint(): [number, number, number] {
    return homeOrbitPosition(0);
  }

  /** PF-11 D1.3 — build the limb-glow shell lazily on the first ascent. A sphere just outside the
   * Earth sphere, additive, with a fresnel rim (see ascent.ts) so it reads as a thin blue arc on
   * the silhouette. No sampler, so no TR-059 placeholder concern. */
  private _setupLimbGlow() {
    if (this._limbMesh || !this._scene || !this._engine) return;
    const scene = this._scene;
    const backend = this.backend === "webgpu" ? "webgpu" : "webgl2";
    const mesh = new Mesh("ascentLimb", scene);
    CreateSphereVertexData({
      diameter: PLANET_SPHERE_RADIUS * LIMB_SHELL_FACTOR * 2,
      segments: SPHERE_SEGMENTS,
    }).applyToMesh(mesh, false);
    mesh.isPickable = false;
    mesh.alwaysSelectAsActiveMesh = true;
    mesh.isVisible = false;
    mesh.position.set(0, 0, 0); // Earth's sphere sits at the origin (the home reveal)
    const mat = new ShaderMaterial(
      "ascentLimb",
      scene,
      { vertex: "ijLimb", fragment: "ijLimb" },
      {
        attributes: ["position", "normal"],
        uniforms: [
          "world",
          "view",
          "projection",
          "uCamPos",
          "uSunDir",
          "uLimb",
          "uColor",
        ],
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.backFaceCulling = false;
    mat.disableDepthWrite = true;
    mat.alphaMode = Constants.ALPHA_ADD;
    mat.needAlphaBlending = () => true;
    const [sr, sg, sb] = raDecToDir(SUN_RA_DEG, SUN_DEC_DEG);
    mat.setVector3("uSunDir", new Vector3(sr, sg, sb));
    mat.setVector3("uColor", new Vector3(...LIMB_GLOW_RGB));
    mat.setFloat("uLimb", 0);
    mesh.material = mat;
    this._limbMesh = mesh;
    this._limbMat = mat;
  }

  /** PF-11 D1.3 — start the launch-from-Earth ascent (the D6.4 goHome reveal played forward).
   * Called from `SpaceScene`'s LAUNCH handler. Under reduced motion / no-WebGL this is an INSTANT
   * cut straight to the home vantage; otherwise it runs the ~8 s rails climb. */
  beginAscent() {
    // No-WebGL: nothing to animate — just tell the host the cinematic is "done" so it reveals
    // the console (the DOM fallback has no scene, mirroring goHome's no-engine branch).
    if (!this._engine) {
      emit("cosmos:ascent-done", {});
      return;
    }
    // Never interrupt a real journey with a launch cinematic.
    if (
      this.warp.mode === "warp" ||
      this.warp.mode === "aim" ||
      this.warp.mode === "ascent"
    )
      return;
    this.arrivedId = null;
    this.queuedTargetId = null; // D3.3: a launch cinematic starts from a clean slate
    // Arming the home orbit is what makes `_tickPlanetSphere` reveal Earth at the origin
    // (`_isAtHomeVantage` gates on it) — the ascent renders that same sphere throughout.
    this._homeOrbit = true;
    this._homeOrbitPhase = 0;
    this._homeLookOverridden = false;

    if (this._reduced) {
      // Instant cut: land at the home vantage, restore the sky/band, no climb (D1-AC6).
      this.warp = { mode: "idle" };
      const [hx, hy, hz] = this._homeArrivalPoint();
      this.cam[0] = hx;
      this.cam[1] = hy;
      this.cam[2] = hz;
      this._endAscentVisuals();
      emit("cosmos:ascent-done", {});
      return;
    }

    this._setupLimbGlow();
    this._ascentProg = 0;
    this.warp = { mode: "ascent", ascentProg: 0 };
  }

  /** Restore the sky colour and band fade to their at-home (space) state. Shared by the reduced-
   * motion cut, the skip path, and the normal completion. */
  private _endAscentVisuals() {
    if (this._scene) {
      this._scene.clearColor.r = SPACE_BLACK_RGB[0];
      this._scene.clearColor.g = SPACE_BLACK_RGB[1];
      this._scene.clearColor.b = SPACE_BLACK_RGB[2];
    }
    this._bandFadeAmt = 1;
    this._bandMat?.setFloat("uFade", 1);
    if (this._limbMesh) this._limbMesh.isVisible = false;
    this._limbMat?.setFloat("uLimb", 0);
  }

  /** PF-11 D1.3 — one ascent frame. Writes `this.cam`/`this._camQuat` (committed by `_tickWarp`'s
   * tail) and drives the sky colour, band fade and limb glow off the pure `ascent.ts` curves. */
  private _tickAscent() {
    const w = this.warp;
    // Progress on WALL CLOCK, not the clamped physics dt — the D6.4 orbit lesson: a screen-time
    // quantity clamped to SHIP_MAX_DT stretches on slow devices. `_dtWarpS` is set at the top of
    // `_tickWarp` this same frame.
    this._ascentProg = Math.min(
      1,
      this._ascentProg + (this._dtWarpS * 1000) / ASCENT_DURATION_MS,
    );
    w.ascentProg = this._ascentProg;

    const s = ascentStateAt(this._ascentProg, SPACE_BLACK_RGB);

    // Camera: recede radially along the home-vantage sight-line, always looking at the origin.
    const [ux, uy, uz] = this._homeArrivalPoint(); // = homeOrbitPosition(0), length HOME_ORBIT_RADIUS
    const ulen = Math.hypot(ux, uy, uz) || 1;
    this.cam[0] = (ux / ulen) * s.standoff;
    this.cam[1] = (uy / ulen) * s.standoff;
    this.cam[2] = (uz / ulen) * s.standoff;
    // Aim at the planet: same construction the idle home-orbit driver uses, so the handoff to
    // idle is seamless (it recomputes _yaw/_pitch from cam every frame anyway).
    const len = s.standoff || 1;
    this._pitch = Math.asin(Math.max(-1, Math.min(1, -this.cam[1] / len)));
    this._yaw = Math.atan2(-this.cam[0] / len, -this.cam[2] / len);
    this._camQuat = quatFromUnitVectors(
      BABYLON_FORWARD,
      freeLookDir(this._yaw, this._pitch),
    );

    // Sky colour: mutate the existing Color4 (no per-frame allocation).
    if (this._scene) {
      this._scene.clearColor.r = s.sky[0];
      this._scene.clearColor.g = s.sky[1];
      this._scene.clearColor.b = s.sky[2];
    }
    // Band (and, through the darkening background, the additive star field) rise with altitude.
    this._bandFadeAmt = s.starFade;
    this._bandMat?.setFloat("uFade", s.starFade);
    // Limb glow: visible only in the 80-120 km beat.
    if (this._limbMesh) this._limbMesh.isVisible = s.limb > 0.001;
    this._limbMat?.setFloat("uLimb", s.limb);
    this._limbMat?.setVector3(
      "uCamPos",
      this._camScratch.set(this.cam[0], this.cam[1], this.cam[2]),
    );

    if (this._ascentProg >= 1) {
      // Handoff: become the home orbit at phase 0, seamlessly (standoff already matches). Mirrors
      // the k>=1 home branch in the warp block.
      this._endAscentVisuals();
      w.mode = "idle";
      this._homeOrbit = true;
      this._homeOrbitPhase = 0;
      this._homeLookOverridden = false;
      emit("cosmos:ascent-done", {});
    }
  }

  /** PF-11 D1.3 — jump the ascent to its end (the SKIP affordance / any input during the climb).
   * A snap-to-end, not a fade, so an impatient visitor is never shown a second animation. */
  skipAscent() {
    if (this.warp.mode !== "ascent") return;
    this._ascentProg = 1;
    // Land exactly where a completed ascent would, and hand off this same tick.
    const [hx, hy, hz] = this._homeArrivalPoint();
    this.cam[0] = hx;
    this.cam[1] = hy;
    this.cam[2] = hz;
    this._endAscentVisuals();
    this.warp = { mode: "idle" };
    this._homeOrbit = true;
    this._homeOrbitPhase = 0;
    this._homeLookOverridden = false;
    emit("cosmos:ascent-done", {});
  }

  goHome(quiet?: boolean) {
    if (!this._engine) {
      // GAP-19: no-WebGL fallback — mirrors space-engine.js:1531-1536.
      this.arrivedId = null;
      this.queuedTargetId = null;
      emit("cosmos:home", {});
      return;
    }
    // PF-11 D3.3 (ADR-0010): HOME mid-journey is an ABORT, not a no-op. The
    // journey under way is abandoned where the ship currently is and a fresh
    // home-bound warp launches from that exact point — `_beginWarp` reads
    // `this.cam`, which `_tickWarp` keeps integrated every frame, so the abort
    // inherits the live position by construction rather than by bookkeeping.
    // The new warp resets k=0, so the ship plays a full accel/flip/brake home
    // (D3.2's choreography) instead of a cut.
    const policy = flightInputPolicy(this.warp.mode, "home");
    if (policy === "ignore") return; // ascent: never interrupt the launch cinematic
    if (policy === "abort") {
      const abandonedId = this.warp.target?.e.id ?? null;
      this.queuedTargetId = null; // an abort discards the queue, it doesn't inherit it
      this.arrivedId = null;
      emit("cosmos:abort", { toHome: true, abandonedId, quiet: !!quiet });
      this._beginWarp(undefined, this._homeArrivalPoint(), true, !!quiet, 0);
      return;
    }
    // PF-11 D6.4 / R16: "already home" USED to mean |cam| < 1, i.e. parked at the origin. Home is
    // now an ORBIT at ARRIVE_STANDOFF, so that test would be false at every point of it and every
    // press would re-warp out of the orbit and back. The predicate moves with the definition.
    if (this._isAtHomeVantage()) return; // already home (in the home orbit)
    this.arrivedId = null;
    this.queuedTargetId = null;
    this._beginWarp(undefined, this._homeArrivalPoint(), true, !!quiet, 0);
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

  /** PF-11 D0.2 — harness-only camera bearing override (delivery plan handoff
   * B4: "five sessions of engine-state-correct-but-no-pixels"). Root cause:
   * on arrival the camera lands at the correct standoff (`this.cam = w.to`,
   * `_beginWarp`/the k>=1 branch above), but `_tickWarp`'s idle branch always
   * re-derives orientation from `_yaw`/`_pitch` via `freeLookDir` — nothing
   * ever points those at the body, so the sphere sits outside the frame on
   * every harness, programmatic or through the real UI. Reuses the exact
   * free-look state the drag path already writes (`_yaw`/`_pitch` — see
   * GAP-08/GAP-10 above) rather than inventing a second orientation
   * mechanism, so the very next render-loop tick picks it up with no new
   * code path to validate.
   *
   * Gated behind `?testhooks` so this can never become a product feature by
   * accident — the guard is checked here, not by the caller, so the method
   * is a safe no-op if a spec forgets the query param. Inverts `freeLookDir`
   * (world-space `[cos(pitch)*sin(yaw), sin(pitch), cos(pitch)*cos(yaw)]`)
   * for the direction from the camera's current position to the body's
   * already-computed world position (`this.bodies[].pos` — the same field
   * `travelTo` reads), rather than assuming the caller already arrived
   * along the Sun-body line: this also aims correctly mid-aim or from
   * free-look, not only exactly at rest on arrival. */
  aimAt(bodyId: string): boolean {
    if (!new URLSearchParams(window.location.search).has("testhooks"))
      return false;
    // PF-11 D2.2 (review addendum): "impostor" aims at the external-galaxy
    // sprite's live world position — the pixel-proof hook for the depth-
    // occlusion class this slice's review caught (state said visible, every
    // fragment depth-failed behind the band shell). Same guard, same fields.
    let pos: readonly [number, number, number];
    if (bodyId === "impostor") {
      const m = this._impostorMesh;
      if (!m || !m.isVisible) return false;
      pos = [m.position.x, m.position.y, m.position.z];
    } else {
      // PF-11 D4.2: `fs-<i>` resolves through the same synthesis `travelTo` uses, so a spec
      // can aim at a field object and then drive the REAL hover→click path (CLAUDE.md #18)
      // instead of calling `travelTo` directly and proving only that the method exists.
      // Field objects are billboard instances, never `bodies` entries, so the ?? is the only
      // way this hook can reach the ~168,883 objects D4.2 makes travelable.
      const b = this._bodyById.get(bodyId) ?? this._fieldBody(bodyId);
      if (!b) return false;
      pos = b.pos;
    }
    const dx = pos[0] - this.cam[0];
    const dy = pos[1] - this.cam[1];
    const dz = pos[2] - this.cam[2];
    const len = Math.hypot(dx, dy, dz) || 1;
    const ux = dx / len,
      uy = dy / len,
      uz = dz / len;
    this._pitch = Math.asin(Math.max(-1, Math.min(1, uy)));
    this._yaw = Math.atan2(ux, uz);
    return true;
  }

  private _beginWarp(
    target: BabylonBody | undefined,
    to: [number, number, number],
    home: boolean,
    quiet: boolean,
    lyTotal: number,
  ) {
    // PF-11 D6.4: leaving home ends the orbit. _beginWarp is the one entry point every
    // journey passes through, including goHome itself (which re-arms on arrival above).
    this._homeOrbit = false;
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
    // PF-11 D3.2 (ADR-0011): the flip screen-time floor. Reduced motion is
    // exempt (fixed-short profile, instant hull swap — #24), so it keeps r=1.
    this._flipRate = this._reduced
      ? 1
      : warpFlipRate(warpDur, WARP_ACCEL_END, WARP_DECEL_START);
    this._rcsFired = [false, false];
    // ~0.3 s of relight shoulder (Astra §3.2) in k-units of the BRAKE segment,
    // capped at 0.08 so short journeys compress the shoulder instead of
    // spending most of the brake ramping the drive back up.
    this._relightK = Math.min(0.08, 0.3 / (Math.max(1, warpDur) / 1000));
    // PF-11 D2: capture the frame-ladder fade endpoints for this journey. `from`
    // is the live value (correct even mid-transition, e.g. a retarget); `to` is
    // the destination's own visibility. goHome passes lyTotal 0 → both restore
    // to 1. The schedule (front-loaded out over accel, back-loaded in over
    // decel) lives in frameLadderFade; `_updateFrameLadder` drives it by `prog`.
    this._furnitureFadeFrom = this._furnitureFade;
    this._furnitureFadeTo = furnitureVisibility(lyTotal);
    this._localFadeFrom = this._localFieldFade;
    this._localFadeTo = localFieldVisibility(lyTotal);
    this._figureFadeFrom = this._figureFade;
    this._figureFadeTo = figureVisibility(lyTotal);
    // Remember an extragalactic target so the impostor can sit astern of it,
    // sized by its real distance, and persist there after arrival.
    if (this._localFadeTo === 0) {
      this._farDestDir = [
        this.warp.dir![0],
        this.warp.dir![1],
        this.warp.dir![2],
      ];
      this._farDestLy = lyTotal;
    }
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
      // TR-103 zoom feature (Vega SHOT-BRIEF): ease toward the target distance every
      // idle frame. Reduced motion snaps instantly — this is direct user manipulation,
      // not an ambient move, but per this repo's existing `_reduced` convention for
      // driven camera values (chase-look, home-orbit aim), easing is skipped so a zoom
      // step can't read as ambient camera motion under that preference.
      this._zoomDist = this._reduced
        ? this._zoomTargetDist
        : dampScalar(this._zoomDist, this._zoomTargetDist, ZOOM_LAMBDA, dt);
      // PF-11 D6.4 / owner requirement R16 — THE HOME ORBIT. Home used to mean "parked at the
      // origin", and the origin is inside the Earth sphere this slice reveals there, so home now
      // means "in a slow orbit around it" (see _isAtHomeVantage for the predicate both this and
      // goHome share).
      //
      // The orbit axis is the SUN DIRECTION, and that is the load-bearing choice rather than a
      // convenience: orbiting about the Sun-Earth line moves the camera all the way around the
      // planet while holding the phase angle at exactly 90°, so the terminator, the twilight
      // band and the city lights stay in frame for the whole revolution. Orbiting about any
      // other axis would swing the lighting through full and new phases and lose the one thing
      // this vantage exists for.
      if (this._homeOrbit) {
        // WALL-CLOCK dt, not the SHIP_MAX_DT-clamped one — the same distinction the warp
        // integration draws twenty lines below, and for the same reason. The orbit phase is a
        // PROGRESS quantity (a 180 s period the visitor experiences in real seconds), not a
        // physics step, so clamping it silently stretches the period on any machine running
        // below 20 fps. Measured before this line existed: 1.5° in 6 s under SwiftShader against
        // the 12° the declared period calls for — exactly the 8x the clamp implies at ~2.5 fps.
        if (!this._reduced)
          this._homeOrbitPhase += HOME_ORBIT_RATE * this._dtWarpS;
        // TR-103: zoom's eased distance IS the orbit radius — homeOrbitPosition's pure
        // scale-by-radius construction (planet-sphere.ts) keeps the 90° phase invariant
        // exactly regardless of radius, so zooming during the home orbit can never
        // disturb the terminator-hold R16 depends on.
        const [px, py, pz] = homeOrbitPosition(
          this._homeOrbitPhase,
          this._zoomDist,
        );
        this.cam[0] = px;
        this.cam[1] = py;
        this.cam[2] = pz;
        // Look at the planet, not along a free-look bearing — the camera is in orbit, so
        // its aim follows its position, UNTIL the visitor actually looks around: bug fix
        // (owner-reported) — this used to re-aim at the planet on the very first
        // non-dragging frame after EVERY drag release, so releasing a drag snapped the
        // view straight back to Earth and made free-look look broken. `_homeLookOverridden`
        // latches true on the first real drag since the orbit was (re)armed and this
        // block simply stops running for the rest of that orbit — the ORBIT ITSELF (the
        // position update above) is unaffected, matching R16 (the ship keeps moving
        // around Earth) without also locking the view to it.
        if (!this._dragging && !this._homeLookOverridden) {
          const len = Math.hypot(px, py, pz) || 1;
          this._pitch = Math.asin(Math.max(-1, Math.min(1, -py / len)));
          this._yaw = Math.atan2(-px / len, -pz / len);
        }
      } else if (
        // Ambient idle-at-home drift now folds into free-look yaw (rather than
        // composing a separate axis-angle rotation onto _camQuat directly) so
        // that a visitor who has already dragged/looked around keeps their own
        // orientation — drift resumes from wherever they left off, not from a
        // fixed axis unrelated to free-look.
        !this._reduced &&
        !this._dragging &&
        Math.hypot(this.cam[0], this.cam[1], this.cam[2]) < 1
      ) {
        this._yaw += IDLE_DRIFT_RATE * dt;
      }
      // TR-103 zoom feature: dolly along the FIXED bearing set at arrival — never the
      // free-look view direction, which is exactly what keeps zoom and free-look from
      // fighting each other (looking around never moves the camera; zooming never
      // changes which way it's pointed). A no-op every frame the visitor hasn't
      // touched zoom, since `_zoomDist` then already equals the arrival distance and
      // this just re-derives the same position `this.cam` already holds.
      if (!this._homeOrbit && this._parkedTargetPos) {
        const p = this._parkedTargetPos;
        const b = this._camBearing;
        this.cam = [
          p[0] + b[0] * this._zoomDist,
          p[1] + b[1] * this._zoomDist,
          p[2] + b[2] * this._zoomDist,
        ];
      }
      this._camQuat = quatFromUnitVectors(
        BABYLON_FORWARD,
        freeLookDir(this._yaw, this._pitch),
      );
    }
    if (w.mode === "ascent") {
      this._tickAscent();
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
      // PF-11 D3.2 (ADR-0011): v4 trapezoid position. `_flipRate` slows k
      // inside the flip window to buy the screen-time floor; the profile's
      // coast slope compensates by exactly 1/r, so world velocity is
      // continuous across both window edges (no lurch). The advance is
      // PIECEWISE at the window boundaries (advanceWarpV4, review fix) so a
      // single dt-capped frame can never jump the whole window — the TR-081
      // flip-skip class stays dead at ANY frame rate, not just typical ones.
      const e0 = warpEaseV4(
        k0,
        this._flipRate,
        WARP_ACCEL_END,
        WARP_DECEL_START,
      );
      const px =
        w.from[0] + (w.to[0] - w.from[0]) * e0 + wd[0] * SHIP_VIEW_DEPTH;
      const py =
        w.from[1] + (w.to[1] - w.from[1]) * e0 + wd[1] * SHIP_VIEW_DEPTH;
      const pz =
        w.from[2] + (w.to[2] - w.from[2]) * e0 + wd[2] * SHIP_VIEW_DEPTH;
      this._warpSlow = this._reduced
        ? 1
        : warpSlowFactor(beltDensityAt(px, py, pz));
      const k = advanceWarpV4(
        k0,
        this._dtWarpS,
        warpDur,
        this._warpSlow,
        this._flipRate,
        WARP_ACCEL_END,
        WARP_DECEL_START,
      );
      w.prog = k;
      const e = warpEaseV4(k, this._flipRate, WARP_ACCEL_END, WARP_DECEL_START);
      const shipW: [number, number, number] = [
        w.from[0] + (w.to[0] - w.from[0]) * e + wd[0] * SHIP_VIEW_DEPTH,
        w.from[1] + (w.to[1] - w.from[1]) * e + wd[1] * SHIP_VIEW_DEPTH,
        w.from[2] + (w.to[2] - w.from[2]) * e + wd[2] * SHIP_VIEW_DEPTH,
      ];
      this._shipWorld = shipW; // consumed by the deflection pass
      // PF-11 D3.2: warpSlowMin is recorded over the SEGMENT traversed this
      // frame, not the endpoint — under SwiftShader load a frame can step
      // ~140 world units and straddle the whole belt tube, and the point
      // sample silently missed it (see minSlowAlongSegment). The point sample
      // above still drives the per-frame feedback; only the record is
      // segment-accurate.
      if (!this._reduced) {
        const segMin = minSlowAlongSegment(
          px,
          py,
          pz,
          shipW[0],
          shipW[1],
          shipW[2],
        );
        if (segMin < this._warpSlowMin) this._warpSlowMin = segMin;
      }
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
        // PF-11 D3.1: the warp lens relaxes to rest at arrival. At k=1 dsdk=0
        // so the breathing is already at base — this is a no-op guard that also
        // covers the reduced-motion path, which never widened it.
        camera.fov = this._baseFov;
        if (w.home) {
          this.arrivedId = null;
          // PF-11 D6.4 / R16: arm the orbit at phase 0, which is exactly the vantage the warp
          // just landed on — so the orbit BEGINS at the spec'd ra 160 / dec 0 view rather than
          // snapping somewhere else on the circle.
          this._homeOrbit = true;
          this._homeOrbitPhase = 0;
          this._homeLookOverridden = false;
          // TR-103 zoom feature: reset fresh on every new home arrival — a zoom level
          // from a prior orbit (or a body visited before goHome) shouldn't carry over.
          // No fixed bearing needed here: the orbit's own position update below already
          // recomputes bearing every frame by design (that's the whole orbit).
          this._parkedTargetPos = null;
          this._zoomIsPlanet = false;
          this._zoomDist = HOME_ORBIT_RADIUS;
          this._zoomTargetDist = HOME_ORBIT_RADIUS;
          this._zoomRestDist = HOME_ORBIT_RADIUS;
          emit("cosmos:home", {});
        } else if (w.target) {
          this.arrivedId = w.target.e.id;
          // TR-102 (owner-reported): arrival used to leave orientation wherever the
          // chase-look quatDamp above had converged to — a function of the TRAVEL
          // direction (wd), not the direction from the now-snapped standoff point to
          // the body itself. Position lands correctly (this.cam = w.to, above), but
          // nothing ever pointed the camera AT what it just landed next to, so the
          // body could sit off to the side or fully out of frame — and dismissing the
          // vista/card never re-aims either (SpaceScene deliberately leaves the camera
          // untouched on dismiss, so a bad arrival aim persisted through both). This is
          // exactly the vector math the `?testhooks`-only `aimAt()` method already used
          // (see its own comment above), now made real for every arrival rather than
          // only reachable from a harness. Sets `_yaw`/`_pitch` so later idle-branch
          // frames stay consistent, AND `_camQuat` directly so this exact frame renders
          // correctly with no one-tick pop.
          {
            const dx = w.target.pos[0] - this.cam[0];
            const dy = w.target.pos[1] - this.cam[1];
            const dz = w.target.pos[2] - this.cam[2];
            const len = Math.hypot(dx, dy, dz) || 1;
            const ux = dx / len,
              uy = dy / len,
              uz = dz / len;
            this._pitch = Math.asin(Math.max(-1, Math.min(1, uy)));
            this._yaw = Math.atan2(ux, uz);
            this._camQuat = quatFromUnitVectors(BABYLON_FORWARD, [ux, uy, uz]);
            // TR-103 zoom feature: bearing is the OPPOSITE of the aim direction just
            // computed (target -> camera here, camera -> target above) — fixed at
            // arrival, untouched by free-look (which only ever writes _yaw/_pitch/
            // _camQuat, never camera position). `len` is exactly the standoff
            // travelTo actually used for this body, so zoom starts exactly where
            // arrival left it, not at some independently-guessed default.
            this._camBearing = [-ux, -uy, -uz];
            this._parkedTargetPos = w.target.pos;
            this._zoomIsPlanet =
              w.target.e.t === "planet" ||
              w.target.e.t === "moon" ||
              w.target.e.t === "dwarf";
            this._zoomDist = len;
            this._zoomTargetDist = len;
            this._zoomRestDist = len;
          }
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
        // PF-11 D3.3 (ADR-0010): drain a retarget queued mid-journey. Deferred
        // by a task and NEVER called inline: `travelTo` replaces `this.warp`
        // wholesale, while the rest of this tick still reads the local `w` for
        // β, aberration and the camera write below — launching here would run
        // the tail of an old frame against a brand-new journey's state. The
        // handle is cancelled in `disconnectedCallback` for the same reason the
        // band-build timer is (D0.1): a callback that outlives the engine.
        if (this.queuedTargetId) {
          const next = this.queuedTargetId;
          this.queuedTargetId = null;
          // Already here — the queue asked for the body this journey just
          // landed on (a retarget back to the original destination). Clearing
          // it IS the whole action; re-flying would be a no-op warp and would
          // re-fire cosmos:arrive over the dossier that just opened.
          if (next !== this.arrivedId) {
            clearTimeout(this._retargetTimer);
            this._retargetTimer = setTimeout(() => {
              this._retargetTimer = undefined;
              this.travelTo(next);
            }, 0);
          }
        }
      } else {
        // brachistochrone accel/flip/decel readout — matches the live
        // engine's WarpOverlay contract exactly (same k thresholds, same vC
        // formula), so the transit HUD reads identically on either engine.
        // PF-11 D3.2 (ADR-0011): normalized world speed replaces the old dsdk
        // triangle. It HOLDS 1 across the coast/flip window — a ship with its
        // engines cut does not slow down, and under the triangle every cue
        // sagged through exactly the window where the narrative says "coast".
        const dsdk = warpSpeedNorm(k, WARP_ACCEL_END, WARP_DECEL_START) * 2;
        // PF-11 D3.1: FOV breathes with apparent speed — widest at the k=0.5
        // peak, relaxing to base as the ship brakes (the missing speed cue,
        // ported from the legacy engine). Off under reduced motion. Driven by
        // the SAME dsdk as β and the streaks, so no cue can disagree.
        camera.fov = this._reduced
          ? this._baseFov
          : this._baseFov * warpFovMult(dsdk);
        // Phase labels sourced from the SHARED hull-choreography thresholds
        // (babylon-ship.ts) so the HUD label boundaries can never drift from
        // flipPhase — and D3.2's window widening is then a one-place change.
        const wphase: "accel" | "flip" | "decel" =
          k < WARP_ACCEL_END
            ? "accel"
            : k < WARP_DECEL_START
              ? "flip"
              : "decel";
        const lyTotal = w.lyTotal ?? 0;
        const vC =
          lyTotal > 0 ? (lyTotal * dsdk) / (warpDur / 1000) / 3.1688e-8 : 0;
        // PF-11 D7.4: throttled to WARP_EVENT_MIN_INTERVAL_MS, except a phase change always
        // emits immediately — see _lastWarpEmitPhase's own comment for why that carve-out
        // exists. Internal state above (β, FOV, warp.prog) is computed every frame regardless;
        // only this DOM dispatch (and the React re-render it drives) is rate-limited.
        const phaseChanged = wphase !== this._lastWarpEmitPhase;
        if (
          phaseChanged ||
          now - this._lastWarpEmitMs >= WARP_EVENT_MIN_INTERVAL_MS
        ) {
          this._lastWarpEmitMs = now;
          this._lastWarpEmitPhase = wphase;
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
      // PF-11 D3.2: β follows the v4 normalized speed (peak 0.88 preserved),
      // so aberration holds through the coast instead of sagging at the flip.
      this._beta =
        0.88 * warpSpeedNorm(w.prog, WARP_ACCEL_END, WARP_DECEL_START);
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
