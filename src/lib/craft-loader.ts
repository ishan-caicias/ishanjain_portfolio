/* craft-loader.ts — purpose-built loader/renderer for the PF-07 ship-v2 craft GLBs.
 *
 * NOT a general glTF loader. It implements exactly the asset shape produced by
 * scripts/build-craft-assets.mjs and pinned by tests/unit/craft-assets.test.ts:
 * one mesh / one primitive / one material / no animations, with
 * EXT_meshopt_compression + KHR_mesh_quantization geometry and EXT_texture_webp
 * textures. Any other shape is a hard error — the pipeline and this loader
 * change together (see docs/test-strategy/2026-07-17-craft-asset-integrity.md).
 *
 * Split in two so the parse half is unit-testable in Node:
 *   parseCraftGlb(bytes)  — pure: GLB container → decoded attribute/index/image
 *                           data + composed model matrix. No DOM, no GL.
 *   CraftShip             — browser half: GL buffers/textures/program + draw().
 */
import { MeshoptDecoder } from "meshoptimizer/decoder";

/* ---------- minimal glTF JSON shapes (only what this asset uses) ---------- */
interface GltfAccessor {
  bufferView: number;
  componentType: number;
  normalized?: boolean;
  count: number;
  type: "SCALAR" | "VEC2" | "VEC3" | "VEC4";
}
interface GltfMeshoptExt {
  buffer: number;
  byteOffset?: number;
  byteLength: number;
  byteStride: number;
  count: number;
  mode: "ATTRIBUTES" | "TRIANGLES" | "INDICES";
  filter?: string;
}
interface GltfBufferView {
  byteOffset?: number;
  byteLength: number;
  extensions?: { EXT_meshopt_compression?: GltfMeshoptExt };
}
interface GltfNode {
  children?: number[];
  mesh?: number;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  matrix?: number[];
}
interface GltfTextureRef {
  index: number;
}
interface GltfJson {
  accessors: GltfAccessor[];
  bufferViews: GltfBufferView[];
  nodes: GltfNode[];
  images: { bufferView: number; mimeType: string }[];
  textures: { extensions?: { EXT_texture_webp?: { source: number } } }[];
  materials: {
    pbrMetallicRoughness?: {
      baseColorTexture?: GltfTextureRef;
      metallicRoughnessTexture?: GltfTextureRef;
    };
    emissiveTexture?: GltfTextureRef;
    normalTexture?: GltfTextureRef;
    occlusionTexture?: GltfTextureRef;
    emissiveFactor?: [number, number, number];
  }[];
  meshes: {
    primitives: {
      attributes: Record<string, number>;
      indices: number;
      material: number;
    }[];
  }[];
  extensionsUsed?: string[];
}

export interface CraftAttribute {
  /** Decoded interleaved-per-attribute bytes, ready for gl.bufferData. */
  data: Uint8Array;
  /** gl componentType (BYTE/SHORT/UNSIGNED_SHORT…), from the accessor. */
  componentType: number;
  normalized: boolean;
  /** Components per vertex (3 for VEC3…). */
  size: number;
  /** Bytes per vertex in `data` (meshopt stride, may include padding). */
  byteStride: number;
}
export interface ParsedCraft {
  vertexCount: number;
  indexCount: number;
  indices: Uint8Array;
  indexComponentType: number;
  attributes: {
    position: CraftAttribute;
    normal: CraftAttribute;
    tangent: CraftAttribute;
    uv: CraftAttribute;
  };
  images: { bytes: Uint8Array; mime: string }[];
  /** Image index per material role (occlusion shares the MR texture: occ = .r). */
  roles: {
    baseColor: number;
    emissive: number;
    normal: number;
    occlusionMR: number;
  };
  /** Column-major: node transform + center/unit-box normalization (parity with the OBJ path). */
  model: Float32Array;
  /** Column-major 3x3 rotation-only part of the node transform, for normals. */
  normalRot: Float32Array;
}

/* ---------- small column-major mat4 helpers (same convention as space-engine) ---------- */
function mul4(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const o = new Array<number>(16);
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) {
      o[c * 4 + r] =
        a[r] * b[c * 4] +
        a[4 + r] * b[c * 4 + 1] +
        a[8 + r] * b[c * 4 + 2] +
        a[12 + r] * b[c * 4 + 3];
    }
  return o;
}
function nodeLocalMatrix(n: GltfNode): number[] {
  if (n.matrix) return n.matrix.slice();
  const [tx, ty, tz] = n.translation ?? [0, 0, 0];
  const [qx, qy, qz, qw] = n.rotation ?? [0, 0, 0, 1];
  const [sx, sy, sz] = n.scale ?? [1, 1, 1];
  const x2 = qx + qx,
    y2 = qy + qy,
    z2 = qz + qz;
  const xx = qx * x2,
    xy = qx * y2,
    xz = qx * z2,
    yy = qy * y2,
    yz = qy * z2,
    zz = qz * z2,
    wx = qw * x2,
    wy = qw * y2,
    wz = qw * z2;
  // column-major TRS
  return [
    (1 - (yy + zz)) * sx,
    (xy + wz) * sx,
    (xz - wy) * sx,
    0,
    (xy - wz) * sy,
    (1 - (xx + zz)) * sy,
    (yz + wx) * sy,
    0,
    (xz + wy) * sz,
    (yz - wx) * sz,
    (1 - (xx + yy)) * sz,
    0,
    tx,
    ty,
    tz,
    1,
  ];
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

function decodeBufferView(
  json: GltfJson,
  bin: Uint8Array,
  bvIndex: number,
): Uint8Array {
  const bv = json.bufferViews[bvIndex];
  const ext = bv.extensions?.EXT_meshopt_compression;
  if (!ext) {
    const off = bv.byteOffset ?? 0;
    return bin.slice(off, off + bv.byteLength);
  }
  const source = bin.subarray(
    ext.byteOffset ?? 0,
    (ext.byteOffset ?? 0) + ext.byteLength,
  );
  const target = new Uint8Array(ext.count * ext.byteStride);
  MeshoptDecoder.decodeGltfBuffer(
    target,
    ext.count,
    ext.byteStride,
    source,
    ext.mode,
    ext.filter,
  );
  return target;
}

const COMPONENTS: Record<GltfAccessor["type"], number> = {
  SCALAR: 1,
  VEC2: 2,
  VEC3: 3,
  VEC4: 4,
};

export async function parseCraftGlb(bytes: ArrayBuffer): Promise<ParsedCraft> {
  await MeshoptDecoder.ready;
  const dv = new DataView(bytes);
  if (dv.getUint32(0, true) !== GLB_MAGIC || dv.getUint32(4, true) !== 2) {
    throw new Error("craft-loader: not a GLB v2 container");
  }
  let offset = 12;
  let json: GltfJson | null = null;
  let bin: Uint8Array | null = null;
  while (offset < dv.getUint32(8, true)) {
    const len = dv.getUint32(offset, true);
    const type = dv.getUint32(offset + 4, true);
    const body = new Uint8Array(bytes, offset + 8, len);
    if (type === CHUNK_JSON)
      json = JSON.parse(new TextDecoder().decode(body)) as GltfJson;
    else if (type === CHUNK_BIN) bin = body;
    offset += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json || !bin) throw new Error("craft-loader: missing JSON or BIN chunk");

  const prim = json.meshes[0]?.primitives[0];
  if (json.meshes.length !== 1 || !prim) {
    throw new Error("craft-loader: expected exactly one mesh/primitive");
  }

  const readAttr = (semantic: string): CraftAttribute => {
    const accessorIndex = prim.attributes[semantic];
    if (accessorIndex === undefined)
      throw new Error(`craft-loader: missing ${semantic}`);
    const acc = json.accessors[accessorIndex];
    const bv = json.bufferViews[acc.bufferView];
    const stride = bv.extensions?.EXT_meshopt_compression?.byteStride;
    if (!stride)
      throw new Error(`craft-loader: ${semantic} is not meshopt-compressed`);
    return {
      data: decodeBufferView(json, bin, acc.bufferView),
      componentType: acc.componentType,
      normalized: acc.normalized === true,
      size: COMPONENTS[acc.type],
      byteStride: stride,
    };
  };

  const position = readAttr("POSITION");
  const attributes = {
    position,
    normal: readAttr("NORMAL"),
    tangent: readAttr("TANGENT"),
    uv: readAttr("TEXCOORD_0"),
  };
  const idxAcc = json.accessors[prim.indices];
  const indices = decodeBufferView(json, bin, idxAcc.bufferView);

  // Composed node transform for the mesh node (parent chain).
  const meshNodeIndex = json.nodes.findIndex((n) => n.mesh === 0);
  const parentOf = new Map<number, number>();
  json.nodes.forEach((n, i) => n.children?.forEach((c) => parentOf.set(c, i)));
  let nodeMatrix = nodeLocalMatrix(json.nodes[meshNodeIndex]);
  for (
    let p = parentOf.get(meshNodeIndex);
    p !== undefined;
    p = parentOf.get(p)
  ) {
    nodeMatrix = mul4(nodeLocalMatrix(json.nodes[p]), nodeMatrix);
  }

  // Bounding box of node-transformed positions (KHR_mesh_quantization SHORT-normalized),
  // then center + scale to the same unit box the wireframe OBJ path uses.
  const vertexCount = json.accessors[prim.attributes.POSITION].count;
  const pos = new DataView(
    position.data.buffer,
    position.data.byteOffset,
    position.data.byteLength,
  );
  const mn = [Infinity, Infinity, Infinity];
  const mx = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < vertexCount; i++) {
    const base = i * position.byteStride;
    const lx = Math.max(pos.getInt16(base, true) / 32767, -1);
    const ly = Math.max(pos.getInt16(base + 2, true) / 32767, -1);
    const lz = Math.max(pos.getInt16(base + 4, true) / 32767, -1);
    const m = nodeMatrix;
    const wx = m[0] * lx + m[4] * ly + m[8] * lz + m[12];
    const wy = m[1] * lx + m[5] * ly + m[9] * lz + m[13];
    const wz = m[2] * lx + m[6] * ly + m[10] * lz + m[14];
    if (wx < mn[0]) mn[0] = wx;
    if (wx > mx[0]) mx[0] = wx;
    if (wy < mn[1]) mn[1] = wy;
    if (wy > mx[1]) mx[1] = wy;
    if (wz < mn[2]) mn[2] = wz;
    if (wz > mx[2]) mx[2] = wz;
  }
  const ctr = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2];
  const span = Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) || 1;
  const k = 1 / span;
  const normalize = [
    k,
    0,
    0,
    0,
    0,
    k,
    0,
    0,
    0,
    0,
    k,
    0,
    -ctr[0] * k,
    -ctr[1] * k,
    -ctr[2] * k,
    1,
  ];
  const model = new Float32Array(mul4(normalize, nodeMatrix));

  // Rotation-only part of the node transform (uniform scale → normalize columns).
  const normalRot = new Float32Array(9);
  for (let c = 0; c < 3; c++) {
    const cx = nodeMatrix[c * 4],
      cy = nodeMatrix[c * 4 + 1],
      cz = nodeMatrix[c * 4 + 2];
    const l = Math.hypot(cx, cy, cz) || 1;
    normalRot[c * 3] = cx / l;
    normalRot[c * 3 + 1] = cy / l;
    normalRot[c * 3 + 2] = cz / l;
  }

  const material = json.materials[0];
  const imageOf = (ref: GltfTextureRef | undefined, name: string): number => {
    const source =
      ref && json.textures[ref.index]?.extensions?.EXT_texture_webp?.source;
    if (source === undefined)
      throw new Error(`craft-loader: material lacks WebP ${name} texture`);
    return source;
  };
  const roles = {
    baseColor: imageOf(
      material.pbrMetallicRoughness?.baseColorTexture,
      "baseColor",
    ),
    emissive: imageOf(material.emissiveTexture, "emissive"),
    normal: imageOf(material.normalTexture, "normal"),
    occlusionMR: imageOf(
      material.pbrMetallicRoughness?.metallicRoughnessTexture,
      "metallicRoughness",
    ),
  };
  const images = json.images.map((img) => ({
    bytes: decodeBufferView(json, bin, img.bufferView),
    mime: img.mimeType,
  }));

  return {
    vertexCount,
    indexCount: idxAcc.count,
    indices,
    indexComponentType: idxAcc.componentType,
    attributes,
    images,
    roles,
    model,
    normalRot,
  };
}

/* ---------- browser/GL half ---------- */

const CRAFT_VS = `
attribute vec3 aPos; attribute vec3 aNormal; attribute vec4 aTangent; attribute vec2 aUv;
uniform mat4 uMVP; uniform mat3 uNrm;
varying vec3 vN; varying vec3 vT; varying float vTw; varying vec2 vUv;
void main(){
  gl_Position = uMVP * vec4(aPos, 1.0);
  vN = uNrm * aNormal;
  vT = uNrm * aTangent.xyz;
  vTw = aTangent.w;
  vUv = aUv;
}`;

const CRAFT_FS = `
precision mediump float;
uniform sampler2D uBase, uEmi, uNrmTex, uMR;
uniform float uFade, uEmiBoost;
uniform vec3 uRimCol; // P3: arrival-tinted rim (cool in flight, warm parked)
uniform vec3 uRearDir; // PF-08 F0: ship's rear axis (same space as vN)
uniform float uEngineGlow; // PF-08 F0: plume-phase glow intensity
varying vec3 vN; varying vec3 vT; varying float vTw; varying vec2 vUv;
void main(){
  vec3 n = normalize(vN);
  vec3 t = normalize(vT - n * dot(vN, vT));
  vec3 b = cross(n, t) * vTw;
  vec3 tn = texture2D(uNrmTex, vUv).xyz * 2.0 - 1.0;
  vec3 N = normalize(t * tn.x + b * tn.y + n * tn.z);
  // fixed key light, upper-left-front (pre-normalized literal: GLSL ES 1.0
  // forbids non-constant const initializers, and ANGLE enforces that)
  const vec3 L = vec3(-0.3713, 0.6059, 0.7036);
  float diff = max(dot(N, L), 0.0);
  float rim = pow(1.0 - max(N.z, 0.0), 2.4);  // starlight rim toward screen edges
  // TR-021: proper-ish sRGB pipeline. The old curve lit sRGB values directly
  // and pushed the whole midtone band toward white, bleaching the hull's
  // texture detail. Decode (x²) → light in linear → Reinhard (never clips)
  // → encode (sqrt) keeps the dark blue-gray hull and its panel contrast.
  vec3 base = texture2D(uBase, vUv).rgb;
  base *= base;
  float occ = texture2D(uMR, vUv).r;
  vec3 emi = texture2D(uEmi, vUv).rgb;
  emi *= emi;
  // engine glow: warm light on rear-facing surfaces, scaled by burn phase
  float rear = pow(max(dot(N, uRearDir), 0.0), 2.0);
  vec3 lin = base * (0.35 + 1.45 * diff) * occ * 1.35 + emi * uEmiBoost + rim * uRimCol * 0.55
    + base * rear * uEngineGlow * vec3(1.0, 0.42, 0.13) * 2.2;
  lin = lin / (lin + 1.0);
  vec3 col = sqrt(lin);
  // fade drives presence, not raw exposure: the opaque hull dims gently
  // (sqrt), unlike the old additive wireframe where fade was blend alpha.
  gl_FragColor = vec4(col * sqrt(uFade), 1.0);
}`;

interface CraftProgram {
  prog: WebGLProgram;
  aPos: number;
  aNormal: number;
  aTangent: number;
  aUv: number;
  u: Record<string, WebGLUniformLocation | null>;
}

export class CraftShip {
  readonly parsed: ParsedCraft;
  private program: CraftProgram | null = null;
  private vbo: Record<
    "position" | "normal" | "tangent" | "uv",
    WebGLBuffer | null
  > | null = null;
  private ibo: WebGLBuffer | null = null;
  private textures: Record<
    "base" | "emissive" | "normal" | "mr",
    WebGLTexture | null
  > | null = null;
  private texturesReady = false;

  constructor(parsed: ParsedCraft) {
    this.parsed = parsed;
  }

  static async load(url: string): Promise<CraftShip> {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`craft-loader: ${url} → HTTP ${res.status}`);
    return new CraftShip(await parseCraftGlb(await res.arrayBuffer()));
  }

  get ready(): boolean {
    return this.program !== null && this.texturesReady;
  }

  /** (Re)create every GL resource — called on first use and after context restore. */
  upload(gl: WebGLRenderingContext): void {
    const p = gl.createProgram();
    const mk = (type: number, src: string) => {
      const s = gl.createShader(type);
      if (!s) throw new Error("craft-loader: createShader failed");
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        throw new Error(
          `craft-loader shader: ${gl.getShaderInfoLog(s) ?? "?"}`,
        );
      }
      return s;
    };
    gl.attachShader(p, mk(gl.VERTEX_SHADER, CRAFT_VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, CRAFT_FS));
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
      throw new Error(`craft-loader link: ${gl.getProgramInfoLog(p) ?? "?"}`);
    }
    const u: Record<string, WebGLUniformLocation | null> = {};
    for (const name of [
      "uMVP",
      "uNrm",
      "uBase",
      "uEmi",
      "uNrmTex",
      "uMR",
      "uFade",
      "uEmiBoost",
      "uRimCol",
      "uRearDir",
      "uEngineGlow",
    ]) {
      u[name] = gl.getUniformLocation(p, name);
    }
    this.program = {
      prog: p,
      aPos: gl.getAttribLocation(p, "aPos"),
      aNormal: gl.getAttribLocation(p, "aNormal"),
      aTangent: gl.getAttribLocation(p, "aTangent"),
      aUv: gl.getAttribLocation(p, "aUv"),
      u,
    };

    const mkVbo = (attr: CraftAttribute): WebGLBuffer | null => {
      const b = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, b);
      gl.bufferData(gl.ARRAY_BUFFER, attr.data, gl.STATIC_DRAW);
      return b;
    };
    const a = this.parsed.attributes;
    this.vbo = {
      position: mkVbo(a.position),
      normal: mkVbo(a.normal),
      tangent: mkVbo(a.tangent),
      uv: mkVbo(a.uv),
    };
    this.ibo = gl.createBuffer();
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);
    gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, this.parsed.indices, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);

    this.texturesReady = false;
    this.textures = { base: null, emissive: null, normal: null, mr: null };
    const roleToTexture: [keyof NonNullable<typeof this.textures>, number][] = [
      ["base", this.parsed.roles.baseColor],
      ["emissive", this.parsed.roles.emissive],
      ["normal", this.parsed.roles.normal],
      ["mr", this.parsed.roles.occlusionMR],
    ];
    void Promise.all(
      roleToTexture.map(async ([role, imageIndex]) => {
        const img = this.parsed.images[imageIndex];
        const bmp = await createImageBitmap(
          new Blob([img.bytes.slice().buffer as ArrayBuffer], {
            type: img.mime,
          }),
          { premultiplyAlpha: "none", colorSpaceConversion: "none" },
        );
        const tex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.texImage2D(
          gl.TEXTURE_2D,
          0,
          gl.RGBA,
          gl.RGBA,
          gl.UNSIGNED_BYTE,
          bmp,
        );
        gl.generateMipmap(gl.TEXTURE_2D); // POT by pipeline construction (1024/2048)
        gl.texParameteri(
          gl.TEXTURE_2D,
          gl.TEXTURE_MIN_FILTER,
          gl.LINEAR_MIPMAP_LINEAR,
        );
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        bmp.close();
        if (this.textures) this.textures[role] = tex;
      }),
    ).then(() => {
      this.texturesReady = true;
    });
  }

  /**
   * Draw the textured craft. `mvp` is the engine's complete wireframe-parity MVP
   * (shift·proj·translate·rot·scale) built for the unit-box ship; `rot` is the
   * ship's pre-scale rotation product, used to light in screen-ish space.
   * Assumes engine state: BLEND enabled (additive), DEPTH_TEST disabled — and
   * restores exactly that on exit.
   */
  draw(
    gl: WebGLRenderingContext,
    mvp: ArrayLike<number>,
    rot: ArrayLike<number>,
    fade: number,
    rimColor: readonly [number, number, number] = [0.55, 0.66, 0.92],
    engineGlow = 0,
  ) {
    const P = this.program;
    if (!P || !this.vbo || !this.textures || !this.texturesReady) return;
    const mvpFinal = mul4(mvp, this.parsed.model);
    // normal matrix = shipRot3 · nodeRot3
    const nr = this.parsed.normalRot;
    const n = new Float32Array(9);
    for (let c = 0; c < 3; c++)
      for (let r = 0; r < 3; r++) {
        n[c * 3 + r] =
          rot[r] * nr[c * 3] +
          rot[4 + r] * nr[c * 3 + 1] +
          rot[8 + r] * nr[c * 3 + 2];
      }

    gl.useProgram(P.prog);
    gl.uniformMatrix4fv(P.u.uMVP, false, new Float32Array(mvpFinal));
    gl.uniformMatrix3fv(P.u.uNrm, false, n);
    gl.uniform1f(P.u.uFade, fade);
    gl.uniform1f(P.u.uEmiBoost, 2.0); // emissive is linearized in-shader now (TR-021)
    gl.uniform3f(P.u.uRimCol, rimColor[0], rimColor[1], rimColor[2]);
    // rear axis = ship-local +Z through the same rotation the normals use
    gl.uniform3f(P.u.uRearDir, n[6], n[7], n[8]);
    gl.uniform1f(P.u.uEngineGlow, engineGlow);
    const texUnits: ["base", "emissive", "normal", "mr"] = [
      "base",
      "emissive",
      "normal",
      "mr",
    ];
    const texUniforms = [P.u.uBase, P.u.uEmi, P.u.uNrmTex, P.u.uMR];
    texUnits.forEach((role, i) => {
      gl.activeTexture(gl.TEXTURE0 + i);
      gl.bindTexture(gl.TEXTURE_2D, this.textures![role]);
      gl.uniform1i(texUniforms[i], i);
    });
    gl.activeTexture(gl.TEXTURE0);

    const a = this.parsed.attributes;
    const bind = (
      loc: number,
      buf: WebGLBuffer | null,
      attr: CraftAttribute,
    ) => {
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(
        loc,
        attr.size,
        attr.componentType,
        attr.normalized,
        attr.byteStride,
        0,
      );
    };
    bind(P.aPos, this.vbo.position, a.position);
    bind(P.aNormal, this.vbo.normal, a.normal);
    bind(P.aTangent, this.vbo.tangent, a.tangent);
    bind(P.aUv, this.vbo.uv, a.uv);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.ibo);

    // opaque hull: depth-tested, normal blending off; scene runs additive with no depth
    gl.disable(gl.BLEND);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.drawElements(
      gl.TRIANGLES,
      this.parsed.indexCount,
      this.parsed.indexComponentType,
      0,
    );
    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);

    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
    [P.aPos, P.aNormal, P.aTangent, P.aUv].forEach((loc) => {
      if (loc >= 0) gl.disableVertexAttribArray(loc);
    });
  }
}
