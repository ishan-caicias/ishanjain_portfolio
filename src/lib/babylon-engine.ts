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
 */
import { Engine } from "@babylonjs/core/Engines/engine";
import type { AbstractEngine } from "@babylonjs/core/Engines/abstractEngine";
import { Scene } from "@babylonjs/core/scene";
import { Vector3 } from "@babylonjs/core/Maths/math.vector";
import { Color4 } from "@babylonjs/core/Maths/math.color";
import { FreeCamera } from "@babylonjs/core/Cameras/freeCamera";
import { Mesh } from "@babylonjs/core/Meshes/mesh";
import { VertexData } from "@babylonjs/core/Meshes/mesh.vertexData";
import { VertexBuffer } from "@babylonjs/core/Buffers/buffer";
import { ShaderMaterial } from "@babylonjs/core/Materials/shaderMaterial";
import { ShaderLanguage } from "@babylonjs/core/Materials/shaderLanguage";
import { ShaderStore } from "@babylonjs/core/Engines/shaderStore";
import { Constants } from "@babylonjs/core/Engines/constants";
import {
  buildStarBillboards,
  buildStarField,
  LIVE_STAR_COUNT,
} from "./star-field";

const emit = (name: string, detail: unknown) =>
  window.dispatchEvent(new CustomEvent(name, { detail }));

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

ShaderStore.ShadersStore["ijStarVertexShader"] = `
precision highp float;
attribute vec3 position;     // star centre (world)
attribute vec2 starMeta;     // x = size, y = colour t
uniform mat4 view;
uniform mat4 projection;
uniform float uScale;
varying vec2 vCorner;
varying float vT;
void main(){
  // Quad corner derived from the vertex id rather than stored (B2 vertex
  // expansion): c=0..3 -> (-1,-1) (1,-1) (1,1) (-1,1). gl_VertexID is the
  // post-index-fetch vertex index, so this is correct for indexed draws.
  int c = gl_VertexID % 4;
  vec2 corner = vec2((c == 1 || c == 2) ? 1.0 : -1.0, (c >= 2) ? 1.0 : -1.0);
  vec4 centre = view * vec4(position, 1.0);
  centre.xy += corner * (starMeta.x * uScale);   // billboard in view space
  gl_Position = projection * centre;
  vCorner = corner;
  vT = starMeta.y;
}`;
ShaderStore.ShadersStore["ijStarFragmentShader"] = `
precision highp float;
varying vec2 vCorner;
varying float vT;
vec3 ramp(float t){
  vec3 c0=vec3(0.61,0.69,1.0), c2=vec3(0.97,0.97,1.0),
       c4=vec3(1.0,0.82,0.63), c5=vec3(1.0,0.80,0.44);
  if(t<0.4) return mix(c0,c2,t/0.4);
  if(t<0.8) return mix(c2,c4,(t-0.4)/0.4);
  return mix(c4,c5,(t-0.8)/0.2);
}
void main(){
  float d = length(vCorner);
  if(d > 1.0) discard;
  float a = exp(-d*d*4.0);
  gl_FragColor = vec4(ramp(vT), a);
}`;

// Babylon-flavoured WGSL twin (vertexInputs / uniforms / vertexOutputs …).
ShaderStore.ShadersStoreWGSL["ijStarVertexShader"] = `
attribute position : vec3<f32>;
attribute starMeta : vec2<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uScale : f32;
varying vCorner : vec2<f32>;
varying vT : f32;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  // Corner derived from the vertex index, not stored (B2 vertex expansion).
  // Babylon injects @builtin(vertex_index) into VertexInputs as vertexIndex.
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let corner : vec2<f32> = vec2<f32>(
    select(-1.0, 1.0, c == 1u || c == 2u),
    select(-1.0, 1.0, c >= 2u));
  var centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  let s : f32 = vertexInputs.starMeta.x * uniforms.uScale;
  centre = vec4<f32>(
    centre.x + corner.x * s,
    centre.y + corner.y * s,
    centre.z,
    centre.w);
  vertexOutputs.position = uniforms.projection * centre;
  vertexOutputs.vCorner = corner;
  vertexOutputs.vT = vertexInputs.starMeta.y;
}`;
ShaderStore.ShadersStoreWGSL["ijStarFragmentShader"] = `
varying vCorner : vec2<f32>;
varying vT : f32;

fn ramp(t : f32) -> vec3<f32> {
  let c0 = vec3<f32>(0.61, 0.69, 1.0);
  let c2 = vec3<f32>(0.97, 0.97, 1.0);
  let c4 = vec3<f32>(1.0, 0.82, 0.63);
  let c5 = vec3<f32>(1.0, 0.80, 0.44);
  if (t < 0.4) { return mix(c0, c2, t / 0.4); }
  if (t < 0.8) { return mix(c2, c4, (t - 0.4) / 0.4); }
  return mix(c4, c5, (t - 0.8) / 0.2);
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let d : f32 = length(fragmentInputs.vCorner);
  if (d > 1.0) { discard; }
  let a : f32 = exp(-d * d * 4.0);
  fragmentOutputs.color = vec4<f32>(ramp(fragmentInputs.vT), a);
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
      const engine = new WebGPUEngine(canvas, { antialias: true });
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
  private _warned = false;

  // --- SpaceEngineElement contract surface (host-read; B2 fills travel) ---
  bodies: unknown[] = [];
  stations: unknown[] = [];
  cam: [number, number, number] = [0, 0, 0];
  arrivedId: string | null = null;
  warp: { mode: "idle" | "aim" | "warp" } = { mode: "idle" };
  backend: "webgpu" | "webgl2" | null = null;
  starCount = 0;
  /** Frames this engine has actually rendered (read by the perf harness). */
  renderFrames = 0;

  connectedCallback() {
    if (this._init) return;
    this._init = true;
    void this._boot();
  }

  private async _boot() {
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

    const field = buildStarField(LIVE_STAR_COUNT);
    const bb = buildStarBillboards(field);
    this.starCount = field.count;

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
        uniforms: ["view", "projection", "uScale"],
        needAlphaBlending: true,
        shaderLanguage:
          backend === "webgpu" ? ShaderLanguage.WGSL : ShaderLanguage.GLSL,
      },
    );
    mat.setFloat("uScale", 1.6);
    mat.backFaceCulling = false;
    mat.alphaMode = Constants.ALPHA_ADD;
    mesh.material = mat;

    let spin = 0;
    let first = true;
    engine.runRenderLoop(() => {
      spin += 0.0004;
      camera.rotation.y = spin; // slow drift so fps reflects real redraw
      scene.render();
      this.renderFrames++; // engine-side proof the scene is actually drawing
      if (first) {
        first = false;
        emit("cosmos:progress", { loaded: field.count, total: field.count });
        emit("cosmos:ready", {});
      }
    });

    this._ro = new ResizeObserver(() => engine.resize());
    this._ro.observe(this);

    const badge = document.createElement("div");
    badge.textContent = `BABYLON ${backend.toUpperCase()} · ${field.count.toLocaleString()} STARS · PF-09 B1`;
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
      activeMeshes: this._scene?.getActiveMeshes().length ?? -1,
      meshReady: m ? m.isReady(true) : false,
      activeIndices: this._scene?.getActiveIndices() ?? -1,
      totalVertices: m ? m.getTotalVertices() : -1,
      totalIndices: m ? m.getTotalIndices() : -1,
      materialReady: m?.material ? m.material.isReady(m) : false,
    };
  }

  // --- contract stubs (PF-09 B2 wires real travel) ---
  travelTo() {
    this._notWired("travelTo");
  }
  goHome() {
    this._notWired("goHome");
  }
  randomBody() {
    this._notWired("randomBody");
  }
  setStations() {}
  fieldInfo() {
    return null;
  }

  private _notWired(m: string) {
    if (!this._warned) {
      this._warned = true;
      console.info(`[babylon-engine] ${m}() — travel wiring lands in PF-09 B2`);
    }
  }
}

if (!customElements.get("babylon-scene"))
  customElements.define("babylon-scene", BabylonScene);
