/* celestial-bodies.ts — GAP-01/GAP-02: curated celestial bodies on the
 * Babylon path (docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
 *
 * The gap analysis found that `window.CELESTIAL` — the portfolio's actual
 * destinations — is loaded into travel-target coordinates only; no mesh,
 * sprite, or billboard is ever created for a curated body. This module is
 * the render side of that data: two billboard-quad passes over the same
 * `bodyWorldPosition` coordinates `babylon-engine.ts` already computes.
 *
 * Per the gap analysis's implementation guardrail: `space-engine.js` is
 * archived-in-place and frozen, so this is a PORT of its per-type appearance
 * rules into a new, Babylon-side pure module — not a shared import from the
 * archived engine (that file is a plain script, not a module, and this repo's
 * own precedent for the same situation is `ship-dynamics.ts`'s `raDecToDir`:
 * "duplicated deliberately rather than refactoring the live/default-path
 * engine for this"). Within the Babylon path, both passes below reuse the
 * SAME billboard-quad primitive as `star-field.ts` (corner derived from the
 * vertex id, quad offset in clip space) rather than inventing a second
 * geometry technique — that is the DRY target this pass actually controls.
 *
 * Pass 1 — PROCEDURAL beacons (GAP-01): every `window.CELESTIAL` entry that
 * has no atlas cell renders as a per-type shaded quad — star (diffraction
 * spikes), planet/moon (lit disc), nebula (lobed cloud), galaxy (disc +
 * nucleus), globular/open cluster, deep field, black hole (photon ring) —
 * ported verbatim from `space-engine.js`'s STAR_VS/STAR_FS `uMode>0.5`
 * branch (its "beacon" mode for curated bodies, as opposed to the field-star
 * mode the same shader also drives).
 *
 * Pass 2 — PHOTOGRAPHIC billboards (GAP-02): the curated subset with a real
 * cell in the shipped `public/assets/atlas.jpg` + `atlas-map.json` (267
 * bodies — the same pre-composed atlas the archived engine's "fast path"
 * already uses, self-hosted, CSP-clean) renders as a textured billboard:
 * NASA/ESA imagery for DSOs (vignette + Hubble-flow redshift tint by depth),
 * a lit rotating globe for planets/moons, plus Saturn's ring band. Ported
 * from PHOTO_VS/PHOTO_FS.
 *
 * Deliberately NOT ported in this pass (named, not silently dropped — see
 * TR-056): the archived engine's SLOW-PATH runtime atlas composition (this
 * module only consumes the pre-built atlas already on disk), the dynamic
 * close-up billboard fetched on arrival, and relativistic aberration/Doppler
 * on bodies (that needs the flight model's velocity wired to a body pass,
 * the same GAP-06 dependency already named in the gap analysis for stars).
 */
import { CORNERS, cornerFromVertexId } from "./star-field";

// re-exported so a caller/tests can rely on one source for the winding table
export { CORNERS, cornerFromVertexId };

/* ---------- pure appearance derivation (ported from _buildBodies) -------- */

/** Beacon size boost by catalog rarity. Matches space-engine.js's `_buildBodies`
 * table exactly (`{common:60, uncommon:90, rare:130, epic:180, legendary:235}`,
 * default 90 for an unrecognised rarity). */
export const RARITY_SIZE_BOOST: Record<string, number> = {
  common: 60,
  uncommon: 90,
  rare: 130,
  epic: 180,
  legendary: 235,
};
const DEFAULT_SIZE_BOOST = 90;

export function sizeBoostForRarity(rarity: string | null | undefined): number {
  return (rarity && RARITY_SIZE_BOOST[rarity]) || DEFAULT_SIZE_BOOST;
}

/** Procedural type code (0-8), matching space-engine.js's `TC` table exactly.
 * `cluster` needs the entry's spectral/description string to split globular
 * (4) from open (5) — the same `/globular/i` test the archived engine uses. */
export const PROCEDURAL_TYPE: Record<string, number> = {
  star: 0,
  planet: 1,
  moon: 1,
  dwarf: 1,
  nebula: 2,
  galaxy: 3,
  deepfield: 6,
  constellation: 7,
  blackhole: 8,
};
const GLOBULAR_CLUSTER = 4;
const OPEN_CLUSTER = 5;

export function proceduralTypeCode(
  t: string,
  spectralOrDesc: string | null | undefined,
): number {
  if (t === "cluster") {
    return /globular/i.test(spectralOrDesc || "")
      ? GLOBULAR_CLUSTER
      : OPEN_CLUSTER;
  }
  return PROCEDURAL_TYPE[t] ?? 0;
}

/** Rough hue -> Planckian-ramp position `t` (0..1), matching space-engine.js's
 * `_buildBodies` heuristic exactly: blue -> 0.12, white -> 0.45 (default),
 * amber -> 0.66/0.72, red -> 0.9, keyed off the entry's own hex colour. */
export function hexToRampT(hex: string | null | undefined): number {
  const c = hex || "#ffd54f";
  const rr = parseInt(c.slice(1, 3), 16) || 0;
  const gg = parseInt(c.slice(3, 5), 16) || 0;
  const bb = parseInt(c.slice(5, 7), 16) || 0;
  if (bb > rr + 20) return 0.12;
  if (rr > bb + 60) return gg > 150 ? 0.72 : 0.9;
  if (rr > bb + 15) return 0.66;
  return 0.45;
}

/* ---------- photographic eligibility + size (ported from _buildPhotoQuads) */

/** Types the archived engine's photographic layer ever draws. Deliberately
 * excludes star/constellation/blackhole even if `img` were ever set on one —
 * matches `PHOTO_T` in space-engine.js exactly (it simply has no such keys). */
export const PHOTO_TYPE: Record<string, number> = {
  planet: 1,
  moon: 1,
  dwarf: 1,
  nebula: 2,
  galaxy: 3,
  cluster: 4, // globular/open split applied the same way as the procedural pass
  deepfield: 6,
};

export interface AtlasCell {
  /** [u, v, du, dv] — normalised UV rect within atlas.jpg. */
  cell: [number, number, number, number];
}
export type AtlasMap = Record<string, [number, number, number, number]>;

/** Deliberately NOT `Pick<CelestialEntry, ...>`: `BabylonBody.e` in
 * babylon-engine.ts carries these same three fields OPTIONALLY (a nav
 * station's synthetic entry has none of them), while `CelestialEntry` itself
 * carries them required. Optional fields here accept both — a type with
 * `Pick`'s required keys would reject the optional shape at the call site. */
export interface MinimalCatalogEntry {
  id: string;
  t?: string;
  img?: string | null;
}

export function isPhotoEligible(
  e: MinimalCatalogEntry,
  atlasMap: AtlasMap | null | undefined,
): boolean {
  return !!(
    e.img &&
    atlasMap &&
    atlasMap[e.id] &&
    e.t != null &&
    PHOTO_TYPE[e.t] != null
  );
}

/** Photo-quad size boost: per-type base, then a rarity multiplier — matches
 * space-engine.js's `_buildPhotoQuads` exactly (legendary x1.3 EXCEPT the
 * rotating-globe type 1, uncommon x0.72, common x0.52). */
export function photoSizeBoost(typeCode: number, rarity: string): number {
  const base =
    typeCode === 1
      ? 1.5
      : typeCode === 2
        ? 3.4
        : typeCode === 3
          ? 3.2
          : typeCode === 4
            ? 2.5
            : typeCode === 5
              ? 2.7
              : 2.1;
  let boost = base;
  if (rarity === "legendary" && typeCode !== 1) boost *= 1.3;
  if (rarity === "uncommon") boost *= 0.72;
  if (rarity === "common") boost *= 0.52;
  return boost;
}

/** Deterministic per-body rotation seed (0..1), matching space-engine.js's
 * index-hash exactly so a given catalog ordering renders identically. */
export function seedForIndex(i: number): number {
  return (((i * 2654435761) >>> 0) % 1000) / 1000;
}

/* ---------- procedural (beacon) billboard geometry ------------------------ */

export interface ProceduralBodySource {
  id: string;
  pos: [number, number, number];
  t: string;
  r: string;
  c: string | null;
  sp: string | null;
}

export interface ProceduralBodyBillboards {
  /** body centre xyz, repeated per corner (verts * 3). */
  positions: Float32Array;
  /** rampT, typeCode, sizeBoost, seed — repeated per corner (verts * 4). Corner
   * itself is NOT stored, matching star-field.ts's B2 vertex-expansion
   * convention: both shader twins derive it from the vertex id. */
  meta: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  count: number;
}

export function buildProceduralBodyBillboards(
  bodies: readonly ProceduralBodySource[],
): ProceduralBodyBillboards {
  const count = bodies.length;
  const vertexCount = count * 4;
  const positions = new Float32Array(vertexCount * 3);
  const meta = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(count * 6);
  bodies.forEach((b, i) => {
    const rampT = hexToRampT(b.c);
    const typeCode = proceduralTypeCode(b.t, b.sp);
    const size = sizeBoostForRarity(b.r);
    const seed = seedForIndex(i);
    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      positions[v * 3] = b.pos[0];
      positions[v * 3 + 1] = b.pos[1];
      positions[v * 3 + 2] = b.pos[2];
      meta[v * 4] = rampT;
      meta[v * 4 + 1] = typeCode;
      meta[v * 4 + 2] = size;
      meta[v * 4 + 3] = seed;
    }
    const o = i * 6;
    indices[o] = v0;
    indices[o + 1] = v0 + 1;
    indices[o + 2] = v0 + 2;
    indices[o + 3] = v0;
    indices[o + 4] = v0 + 2;
    indices[o + 5] = v0 + 3;
  });
  return { positions, meta, indices, vertexCount, count };
}

/* ---------- photographic billboard geometry -------------------------------- */

export interface PhotoBodySource {
  id: string;
  pos: [number, number, number];
  t: string;
  r: string;
  sp: string | null;
  cell: [number, number, number, number];
  index: number; // original catalog index, for the seed hash
}

export interface PhotoBodyBillboards {
  /** body centre xyz, repeated per corner (verts * 3). */
  positions: Float32Array;
  /** atlas cell [u, v, du, dv], repeated per corner (verts * 4). */
  cells: Float32Array;
  /** [sizeBoost, typeCode(+0.5 ring flag), seed, rarityTypeBoost] — repeated
   * per corner (verts * 4), the same four quantities space-engine.js packs
   * into its `aMisc` attribute, same order. Corner is derived from the vertex
   * id (as in the procedural pass); the ring ellipse x-stretch is applied to
   * that derived corner in-shader from the ring flag on typeCode, so no fifth
   * slot is needed for it (space-engine.js bakes `ex` into a stored quad
   * instead, because it isn't deriving the corner from the vertex id at all). */
  meta: Float32Array;
  indices: Uint32Array;
  vertexCount: number;
  count: number;
}

/** Saturn is the one ringed body in the catalog — matches space-engine.js's
 * `_buildPhotoQuads` exactly (`const ring = e.id === "saturn"`). */
export function isRingedBody(id: string): boolean {
  return id === "saturn";
}

export function buildPhotoBodyBillboards(
  bodies: readonly PhotoBodySource[],
): PhotoBodyBillboards {
  const count = bodies.length;
  const vertexCount = count * 4;
  const positions = new Float32Array(vertexCount * 3);
  const cells = new Float32Array(vertexCount * 4);
  const meta = new Float32Array(vertexCount * 4);
  const indices = new Uint32Array(count * 6);
  bodies.forEach((b, i) => {
    const typeCode = proceduralTypeCode(b.t, b.sp);
    const photoType = PHOTO_TYPE[b.t] ?? typeCode;
    const ring = isRingedBody(b.id);
    const sizeB = sizeBoostForRarity(b.r);
    const boost = photoSizeBoost(photoType, b.r);
    const seed = seedForIndex(b.index);
    const v0 = i * 4;
    for (let c = 0; c < 4; c++) {
      const v = v0 + c;
      positions[v * 3] = b.pos[0];
      positions[v * 3 + 1] = b.pos[1];
      positions[v * 3 + 2] = b.pos[2];
      cells[v * 4] = b.cell[0];
      cells[v * 4 + 1] = b.cell[1];
      cells[v * 4 + 2] = b.cell[2];
      cells[v * 4 + 3] = b.cell[3];
      meta[v * 4] = sizeB;
      meta[v * 4 + 1] = photoType + (ring ? 0.5 : 0);
      meta[v * 4 + 2] = seed;
      meta[v * 4 + 3] = boost;
    }
    const o = i * 6;
    indices[o] = v0;
    indices[o + 1] = v0 + 1;
    indices[o + 2] = v0 + 2;
    indices[o + 3] = v0;
    indices[o + 4] = v0 + 2;
    indices[o + 5] = v0 + 3;
  });
  return { positions, cells, meta, indices, vertexCount, count };
}

/* ---------- catalog partition ----------------------------------------------- */

export interface PartitionedBodies<T> {
  procedural: T[];
  photo: (T & { cell: [number, number, number, number]; index: number })[];
}

/** Splits a placed-body list into the procedural and photographic render
 * passes, matching space-engine.js's `_buildBodies`/`_buildPhotoQuads` split
 * exactly: a body is photographic only if it has `img`, an atlas cell, AND a
 * photo-eligible type. Everything else — including every body missing any
 * one of those three — renders procedurally, same as the archived engine. */
export function partitionCelestialBodies<
  T extends {
    pos: [number, number, number];
    e: MinimalCatalogEntry;
  },
>(placed: readonly T[], atlasMap: AtlasMap | null | undefined) {
  const procedural: T[] = [];
  const photo: (T & {
    cell: [number, number, number, number];
    index: number;
  })[] = [];
  placed.forEach((b, index) => {
    if (isPhotoEligible(b.e, atlasMap)) {
      photo.push({ ...b, cell: atlasMap![b.e.id], index });
    } else {
      procedural.push(b);
    }
  });
  return { procedural, photo };
}

/* ============================================================================
 * SHADER TWINS
 *
 * Both passes reuse the star billboard's clip-space quad-offset technique
 * (star-field.ts / babylon-engine.ts's ijStar shaders) and its vertex-id
 * corner derivation — no stored corner attribute, matching the B2 vertex-
 * expansion convention. GLSL and WGSL are kept line-for-line parallel; there
 * is no compiler to check them against each other (TR-044/045), so the pure
 * functions above additionally pin the arithmetic they share off-GPU.
 * ========================================================================= */

/* ---------- pass 1: procedural beacons (ported from STAR_VS/STAR_FS's
 * uMode>0.5 branch — the archived engine's "curated body" mode, distinct
 * from the field-star mode the same shader also drives) -------------------- */

export const PROCEDURAL_BODY_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;     // body centre (world)
attribute vec4 bodyMeta;     // rampT, typeCode, sizeBoost, seed
uniform mat4 view;
uniform mat4 projection;
uniform vec2 uViewport;
uniform float uTime;
varying vec2 vCorner;
varying vec3 vColor;
varying float vType;
varying float vSeed;
vec3 ramp(float t){
  vec3 c0=vec3(0.608,0.690,1.000), c1=vec3(0.792,0.843,1.000), c2=vec3(0.973,0.969,1.000),
       c3=vec3(1.000,0.957,0.918), c4=vec3(1.000,0.824,0.631), c5=vec3(1.000,0.800,0.435);
  if(t<0.2) return mix(c0,c1,t/0.2);
  if(t<0.4) return mix(c1,c2,(t-0.2)/0.2);
  if(t<0.6) return mix(c2,c3,(t-0.4)/0.2);
  if(t<0.8) return mix(c3,c4,(t-0.6)/0.2);
  return mix(c4,c5,(t-0.8)/0.2);
}
void main(){
  int c = gl_VertexID % 4;
  vec2 corner = vec2((c == 1 || c == 2) ? 1.0 : -1.0, (c >= 2) ? 1.0 : -1.0);
  vec4 centre = view * vec4(position, 1.0);
  float dist = length(centre.xyz);

  float ty = bodyMeta.y;
  float boost = 1.0;
  if (ty > 1.5 && ty < 2.5) boost = 2.2;      // nebula
  else if (ty > 2.5 && ty < 3.5) boost = 2.0; // galaxy
  else if (ty > 3.5 && ty < 4.5) boost = 1.8; // globular
  else if (ty > 4.5 && ty < 5.5) boost = 1.8; // open cluster
  else if (ty > 5.5 && ty < 6.5) boost = 1.6; // deep field
  else if (ty > 7.5 && ty < 8.5) boost = 2.3; // black hole
  else if (ty > 0.5 && ty < 1.5) boost = 0.9; // planet disc
  float px = (10.0 + bodyMeta.z*0.05) * (240.0/max(dist,14.0));
  px = clamp(px, 7.0, 110.0) * boost;
  if (ty < 0.5) px *= 1.0 + 0.12*sin(uTime*2.2 + bodyMeta.w*40.0); // star pulse

  vColor = ramp(bodyMeta.x);
  vType = ty;
  vSeed = bodyMeta.w * 6.2831853;

  vec4 clip = projection * centre;
  clip.x += corner.x * px * clip.w / max(uViewport.x, 1.0);
  clip.y += corner.y * px * clip.w / max(uViewport.y, 1.0);
  gl_Position = clip;
  vCorner = corner;
}`;

export const PROCEDURAL_BODY_FRAGMENT_GLSL = `
precision mediump float;
varying vec2 vCorner;
varying vec3 vColor;
varying float vType;
varying float vSeed;
float hash2(vec2 p, float s){ return fract(sin(dot(p, vec2(127.1, 311.7)) + s) * 43758.5453); }
void main(){
  vec2 pc = vCorner;
  float d = length(pc);
  vec3 col = vColor;
  float a = 0.0;
  float ty = floor(vType + 0.5);
  if (ty > 7.5 && ty < 8.5) {
    // BLACK HOLE: photon ring + lensed accretion arcs around a dark interior
    if (d > 1.0) discard;
    float ring = exp(-pow(abs(d - 0.40) * 7.5, 1.7));
    float arc = exp(-pow(abs(length(vec2(pc.x, pc.y*2.7)) - 0.33) * 9.0, 2.0)) * 0.85;
    a = min(1.0, ring * 1.2 + arc);
    a *= smoothstep(0.14, 0.30, d);
    col = mix(vec3(1.0, 0.55, 0.22), vec3(1.0, 0.93, 0.78), ring);
  } else if (ty < 0.5 || ty > 6.5) {
    // STAR (and constellation anchor): bright core + diffraction spikes
    if (d > 1.0) discard;
    float core = exp(-d*d*7.0);
    float spike = max(0.0,1.0-abs(pc.x)*14.0)*max(0.0,1.0-abs(pc.y)*2.2)
                + max(0.0,1.0-abs(pc.y)*14.0)*max(0.0,1.0-abs(pc.x)*2.2);
    a = min(1.0, core*1.2 + spike*0.5*(1.0-d));
    if (ty > 6.5) a *= 0.55;
  } else if (ty < 1.5) {
    // PLANET / MOON: solid lit disc with limb darkening + faint halo
    float disc = smoothstep(0.60, 0.52, d);
    float limb = 1.0 - 0.5*smoothstep(0.1, 0.6, d);
    float shade = 0.45 + 0.55*smoothstep(0.45, -0.35, pc.x + pc.y*0.3);
    col = vColor * limb * shade + vec3(0.05);
    a = disc + exp(-d*d*3.5)*0.10;
  } else if (ty < 2.5) {
    // NEBULA: irregular lobed cloud with ragged edges
    vec2 o1 = vec2(cos(vSeed), sin(vSeed)) * 0.13;
    vec2 o2 = vec2(cos(vSeed+2.4), sin(vSeed+2.4)) * 0.15;
    vec2 o3 = vec2(cos(vSeed+4.5), sin(vSeed+4.5)) * 0.11;
    float g = exp(-dot(pc-o1,pc-o1)*13.0) + exp(-dot(pc-o2,pc-o2)*11.0)
            + exp(-dot(pc-o3,pc-o3)*16.0) + exp(-dot(pc,pc)*9.0)*0.7;
    float ang = atan(pc.y, pc.x);
    g *= 0.72 + 0.28*sin(ang*5.0 + vSeed*3.0);
    a = min(0.92, g*0.5);
    col = mix(vColor, vec3(1.0,0.98,0.95), exp(-d*d*10.0)*0.35);
  } else if (ty < 3.5) {
    // GALAXY: inclined disc + brilliant nucleus
    float ca = cos(vSeed), sa = sin(vSeed);
    vec2 q = vec2(ca*pc.x - sa*pc.y, (sa*pc.x + ca*pc.y) * 3.4);
    float disc = exp(-dot(q,q)*7.0);
    float core = exp(-dot(pc,pc)*70.0);
    a = min(1.0, disc*0.8 + core*1.3);
    col = mix(vColor*0.9, vec3(1.0,0.97,0.9), core);
  } else if (ty < 4.5) {
    // GLOBULAR CLUSTER: dense grainy ball of stars
    float base2 = exp(-d*d*4.5);
    vec2 gp = floor((pc+0.5)*10.0);
    float h = hash2(gp, vSeed*40.0);
    float grain = step(0.5, h) * exp(-d*d*3.0);
    a = min(1.0, base2*0.35 + grain*0.8);
  } else if (ty < 5.5) {
    // OPEN CLUSTER: a scattered handful of member stars
    a = exp(-d*d*3.0) * 0.10;
    vec2 gp = floor((pc+0.5)*5.0);
    float h = hash2(gp, vSeed*40.0);
    vec2 cc = (gp+0.5)/5.0 - 0.5 + (vec2(fract(h*7.3), fract(h*13.7)) - 0.5)*0.14;
    float dd = length(pc-cc)*14.0;
    a += step(0.42, h) * exp(-dd*dd) * smoothstep(1.05, 0.5, d);
    a = min(1.0, a);
  } else {
    // DEEP FIELD: a soft patch peppered with tiny specks
    vec2 gp = floor((pc+0.5)*13.0);
    float h = hash2(gp, vSeed*40.0);
    a = step(0.78, h) * (0.35+0.65*fract(h*5.0)) * smoothstep(0.95, 0.7, max(abs(pc.x),abs(pc.y))*2.0);
    a += exp(-d*d*4.0)*0.05;
  }
  if (a <= 0.004) discard;
  gl_FragColor = vec4(col, a);
}`;

export const PROCEDURAL_BODY_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute bodyMeta : vec4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uViewport : vec2<f32>;
uniform uTime : f32;
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vType : f32;
varying vSeed : f32;

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
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let corner : vec2<f32> = vec2<f32>(
    select(-1.0, 1.0, c == 1u || c == 2u),
    select(-1.0, 1.0, c >= 2u));
  let centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  let dist : f32 = length(centre.xyz);

  let ty : f32 = vertexInputs.bodyMeta.y;
  var boost : f32 = 1.0;
  if (ty > 1.5 && ty < 2.5) { boost = 2.2; }
  else if (ty > 2.5 && ty < 3.5) { boost = 2.0; }
  else if (ty > 3.5 && ty < 4.5) { boost = 1.8; }
  else if (ty > 4.5 && ty < 5.5) { boost = 1.8; }
  else if (ty > 5.5 && ty < 6.5) { boost = 1.6; }
  else if (ty > 7.5 && ty < 8.5) { boost = 2.3; }
  else if (ty > 0.5 && ty < 1.5) { boost = 0.9; }
  var px : f32 = (10.0 + vertexInputs.bodyMeta.z * 0.05) * (240.0 / max(dist, 14.0));
  px = clamp(px, 7.0, 110.0) * boost;
  if (ty < 0.5) {
    px = px * (1.0 + 0.12 * sin(uniforms.uTime * 2.2 + vertexInputs.bodyMeta.w * 40.0));
  }

  vertexOutputs.vColor = ramp(vertexInputs.bodyMeta.x);
  vertexOutputs.vType = ty;
  vertexOutputs.vSeed = vertexInputs.bodyMeta.w * 6.2831853;

  var clip : vec4<f32> = uniforms.projection * centre;
  clip.x = clip.x + corner.x * px * clip.w / max(uniforms.uViewport.x, 1.0);
  clip.y = clip.y + corner.y * px * clip.w / max(uniforms.uViewport.y, 1.0);
  vertexOutputs.position = clip;
  vertexOutputs.vCorner = corner;
}`;

export const PROCEDURAL_BODY_FRAGMENT_WGSL = `
varying vCorner : vec2<f32>;
varying vColor : vec3<f32>;
varying vType : f32;
varying vSeed : f32;

fn hash2(p : vec2<f32>, s : f32) -> f32 {
  return fract(sin(dot(p, vec2<f32>(127.1, 311.7)) + s) * 43758.5453);
}

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let pc : vec2<f32> = fragmentInputs.vCorner;
  let d : f32 = length(pc);
  var col : vec3<f32> = fragmentInputs.vColor;
  var a : f32 = 0.0;
  let ty : f32 = floor(fragmentInputs.vType + 0.5);

  if (ty > 7.5 && ty < 8.5) {
    if (d > 1.0) { discard; }
    let ring : f32 = exp(-pow(abs(d - 0.40) * 7.5, 1.7));
    let arc : f32 = exp(-pow(abs(length(vec2<f32>(pc.x, pc.y * 2.7)) - 0.33) * 9.0, 2.0)) * 0.85;
    a = min(1.0, ring * 1.2 + arc);
    a = a * smoothstep(0.14, 0.30, d);
    col = mix(vec3<f32>(1.0, 0.55, 0.22), vec3<f32>(1.0, 0.93, 0.78), ring);
  } else if (ty < 0.5 || ty > 6.5) {
    if (d > 1.0) { discard; }
    let core : f32 = exp(-d * d * 7.0);
    let spike : f32 = max(0.0, 1.0 - abs(pc.x) * 14.0) * max(0.0, 1.0 - abs(pc.y) * 2.2)
                     + max(0.0, 1.0 - abs(pc.y) * 14.0) * max(0.0, 1.0 - abs(pc.x) * 2.2);
    a = min(1.0, core * 1.2 + spike * 0.5 * (1.0 - d));
    if (ty > 6.5) { a = a * 0.55; }
  } else if (ty < 1.5) {
    let disc : f32 = smoothstep(0.60, 0.52, d);
    let limb : f32 = 1.0 - 0.5 * smoothstep(0.1, 0.6, d);
    let shade : f32 = 0.45 + 0.55 * smoothstep(0.45, -0.35, pc.x + pc.y * 0.3);
    col = fragmentInputs.vColor * limb * shade + vec3<f32>(0.05);
    a = disc + exp(-d * d * 3.5) * 0.10;
  } else if (ty < 2.5) {
    let o1 : vec2<f32> = vec2<f32>(cos(fragmentInputs.vSeed), sin(fragmentInputs.vSeed)) * 0.13;
    let o2 : vec2<f32> = vec2<f32>(cos(fragmentInputs.vSeed + 2.4), sin(fragmentInputs.vSeed + 2.4)) * 0.15;
    let o3 : vec2<f32> = vec2<f32>(cos(fragmentInputs.vSeed + 4.5), sin(fragmentInputs.vSeed + 4.5)) * 0.11;
    var g : f32 = exp(-dot(pc - o1, pc - o1) * 13.0) + exp(-dot(pc - o2, pc - o2) * 11.0)
                + exp(-dot(pc - o3, pc - o3) * 16.0) + exp(-dot(pc, pc) * 9.0) * 0.7;
    let ang : f32 = atan2(pc.y, pc.x);
    g = g * (0.72 + 0.28 * sin(ang * 5.0 + fragmentInputs.vSeed * 3.0));
    a = min(0.92, g * 0.5);
    col = mix(fragmentInputs.vColor, vec3<f32>(1.0, 0.98, 0.95), exp(-d * d * 10.0) * 0.35);
  } else if (ty < 3.5) {
    let ca : f32 = cos(fragmentInputs.vSeed);
    let sa : f32 = sin(fragmentInputs.vSeed);
    let q : vec2<f32> = vec2<f32>(ca * pc.x - sa * pc.y, (sa * pc.x + ca * pc.y) * 3.4);
    let disc : f32 = exp(-dot(q, q) * 7.0);
    let core : f32 = exp(-dot(pc, pc) * 70.0);
    a = min(1.0, disc * 0.8 + core * 1.3);
    col = mix(fragmentInputs.vColor * 0.9, vec3<f32>(1.0, 0.97, 0.9), core);
  } else if (ty < 4.5) {
    let base2 : f32 = exp(-d * d * 4.5);
    let gp : vec2<f32> = floor((pc + 0.5) * 10.0);
    let h : f32 = hash2(gp, fragmentInputs.vSeed * 40.0);
    let grain : f32 = step(0.5, h) * exp(-d * d * 3.0);
    a = min(1.0, base2 * 0.35 + grain * 0.8);
  } else if (ty < 5.5) {
    a = exp(-d * d * 3.0) * 0.10;
    let gp : vec2<f32> = floor((pc + 0.5) * 5.0);
    let h : f32 = hash2(gp, fragmentInputs.vSeed * 40.0);
    let cc : vec2<f32> = (gp + 0.5) / 5.0 - 0.5
      + (vec2<f32>(fract(h * 7.3), fract(h * 13.7)) - 0.5) * 0.14;
    let dd : f32 = length(pc - cc) * 14.0;
    a = a + step(0.42, h) * exp(-dd * dd) * smoothstep(1.05, 0.5, d);
    a = min(1.0, a);
  } else {
    let gp : vec2<f32> = floor((pc + 0.5) * 13.0);
    let h : f32 = hash2(gp, fragmentInputs.vSeed * 40.0);
    a = step(0.78, h) * (0.35 + 0.65 * fract(h * 5.0))
      * smoothstep(0.95, 0.7, max(abs(pc.x), abs(pc.y)) * 2.0);
    a = a + exp(-d * d * 4.0) * 0.05;
  }
  if (a <= 0.004) { discard; }
  fragmentOutputs.color = vec4<f32>(col, a);
}`;

/* ---------- pass 2: photographic billboards (ported from PHOTO_VS/PHOTO_FS,
 * minus travel-velocity aberration — GAP-06's dependency, not yet wired to a
 * body pass on either engine's Babylon path) -------------------------------- */

export const PHOTO_BODY_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;    // body centre (world)
attribute vec4 photoCell;   // atlas cell u, v, du, dv
attribute vec4 photoMeta;   // sizeBoost, typeCode(+0.5 ring flag), seed, rarityTypeBoost
uniform mat4 view;
uniform mat4 projection;
uniform vec2 uViewport;
uniform float uTime;
varying vec2 vLocal;
varying vec4 vCell;
varying float vType;
varying float vZ;
void main(){
  int c = gl_VertexID % 4;
  vec2 corner = vec2((c == 1 || c == 2) ? 1.0 : -1.0, (c >= 2) ? 1.0 : -1.0);
  float tyRaw = photoMeta.y;
  bool ring = fract(tyRaw) > 0.25;
  float ex = ring ? 2.05 : 1.0;
  vec2 local = vec2(corner.x * ex, corner.y);

  float ang = photoMeta.z * 6.283185;
  bool isGlobe = tyRaw < 1.9;
  float rotAng = isGlobe ? 0.0 : ang; // rotating globes spin via uTime in the fragment stage
  float ca = cos(rotAng), sa = sin(rotAng);
  vec2 rotated = vec2(local.x*ca - local.y*sa, local.x*sa + local.y*ca);

  vec4 centre = view * vec4(position, 1.0);
  // cosmological redshift proxy from log-compressed depth (matches
  // space-engine.js's PHOTO_VS exactly: z ~ d / 14.1 Gly) — a function of the
  // body's placement, not of travel velocity, so it needs no aberration wiring.
  vZ = clamp(pow(10.0, (length(position) - 150.0)/128.0) * 7.1e-11, 0.0, 1.3);
  float dist = length(centre.xyz);
  float px = (10.0 + photoMeta.x*0.05) * (240.0/max(dist,14.0));
  px = clamp(px, 12.0, 130.0) * photoMeta.w;

  vec4 clip = projection * centre;
  vec2 vp = max(uViewport, vec2(1.0));
  clip.xy += rotated * (px / vp) * clip.w;
  gl_Position = clip;
  vLocal = local;
  vCell = photoCell;
  vType = tyRaw;
}`;

/* WGSL forbids textureSample() in non-uniform control flow (TR-047): ty is
 * constant across one body's quad but differs between bodies drawn in the
 * same call, so branching on it around the sample is exactly the class TR-047
 * fixed. Both twins therefore compute BOTH candidate UVs, pick one via a
 * select-equivalent (GLSL's ternary costs nothing extra; kept identical to
 * the WGSL twin on purpose), sample ONCE unconditionally, and only branch
 * afterward on the already-sampled colour — never around the sample call. */
export const PHOTO_BODY_FRAGMENT_GLSL = `
precision mediump float;
uniform sampler2D uTex;
uniform float uTime;
varying vec2 vLocal;
varying vec4 vCell;
varying float vType;
varying float vZ;
void main(){
  float ty = vType;
  bool isGlobe = ty < 1.9;
  float r2 = dot(vLocal, vLocal);
  float nz = sqrt(max(0.0, 1.0 - r2));
  float lat = asin(clamp(vLocal.y, -1.0, 1.0));
  float lon = atan(vLocal.x, nz) + uTime*0.06;
  vec2 globeUv = vec2(fract(lon*0.15915494), 0.5 - lat*0.31830988) * 0.96 + 0.02;
  vec2 photoUv = vec2(vLocal.x*0.5 + 0.5, 0.5 - vLocal.y*0.5);
  vec2 uv = vCell.xy + (isGlobe ? globeUv : photoUv) * vCell.zw;
  vec3 tex = texture2D(uTex, uv).rgb; // the ONE unconditional sample

  vec3 col = vec3(0.0);
  float a = 0.0;
  if (isGlobe) {
    // texture-mapped, lit, slowly rotating globe (ring flag: ty fract > 0.25)
    if (r2 < 1.0) {
      vec3 n = vec3(vLocal, nz);
      float diff = max(0.0, dot(n, normalize(vec3(-0.55, 0.30, 0.78))));
      float shade = (0.05 + 1.08*diff) * (0.72 + 0.28*nz);
      col = tex * shade;
      col += vec3(0.30, 0.42, 0.75) * pow(1.0 - nz, 3.0) * diff * 0.4;
      a = smoothstep(1.0, 0.90, r2);
    }
    if (fract(ty) > 0.25) {
      float rr = length(vec2(vLocal.x, vLocal.y*3.6));
      float band = smoothstep(1.16, 1.30, rr) * smoothstep(1.98, 1.78, rr);
      band *= 0.8 + 0.2*sin(rr*36.0);
      float gap = smoothstep(1.50, 1.58, rr) * (1.0 - smoothstep(1.60, 1.68, rr));
      band *= 1.0 - 0.8*gap;
      float ra = band * step(1.0, r2) * 0.5;
      col += vec3(0.82, 0.72, 0.55) * ra;
      a = max(a, ra);
    }
    gl_FragColor = vec4(col, a);
  } else {
    // deep-sky photograph billboard: radial-masked, brightness by type
    float r = length(vLocal);
    float vig = smoothstep(1.0, 0.58, r);
    col = tex * (ty > 5.5 ? 0.95 : 1.12);
    float tyf = floor(ty + 0.5);
    if (vZ > 0.02 && (abs(tyf - 3.0) < 0.1 || abs(tyf - 6.0) < 0.1)) {
      // Hubble-flow redshift: distant galaxies and deep fields shift toward the red
      float rs = clamp(vZ*0.85, 0.0, 0.8);
      col = mix(col, vec3(col.r*1.28 + 0.04, col.g*0.60, col.b*0.34), rs);
    }
    gl_FragColor = vec4(col * vig, 1.0);
  }
}`;

export const PHOTO_BODY_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute photoCell : vec4<f32>;
attribute photoMeta : vec4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
uniform uViewport : vec2<f32>;
uniform uTime : f32;
varying vLocal : vec2<f32>;
varying vCell : vec4<f32>;
varying vType : f32;
varying vZ : f32;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let c : u32 = vertexInputs.vertexIndex % 4u;
  let corner : vec2<f32> = vec2<f32>(
    select(-1.0, 1.0, c == 1u || c == 2u),
    select(-1.0, 1.0, c >= 2u));
  let tyRaw : f32 = vertexInputs.photoMeta.y;
  let ring : bool = fract(tyRaw) > 0.25;
  let ex : f32 = select(1.0, 2.05, ring);
  let local : vec2<f32> = vec2<f32>(corner.x * ex, corner.y);

  let ang : f32 = vertexInputs.photoMeta.z * 6.283185;
  let isGlobe : bool = tyRaw < 1.9;
  let rotAng : f32 = select(ang, 0.0, isGlobe);
  let ca : f32 = cos(rotAng);
  let sa : f32 = sin(rotAng);
  let rotated : vec2<f32> = vec2<f32>(local.x * ca - local.y * sa, local.x * sa + local.y * ca);

  let centre : vec4<f32> = uniforms.view * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vZ = clamp(
    pow(10.0, (length(vertexInputs.position) - 150.0) / 128.0) * 7.1e-11, 0.0, 1.3);
  let dist : f32 = length(centre.xyz);
  var px : f32 = (10.0 + vertexInputs.photoMeta.x * 0.05) * (240.0 / max(dist, 14.0));
  px = clamp(px, 12.0, 130.0) * vertexInputs.photoMeta.w;

  let vp : vec2<f32> = max(uniforms.uViewport, vec2<f32>(1.0, 1.0));
  var clip : vec4<f32> = uniforms.projection * centre;
  clip = vec4<f32>(
    clip.x + rotated.x * (px / vp.x) * clip.w,
    clip.y + rotated.y * (px / vp.y) * clip.w,
    clip.z, clip.w);
  vertexOutputs.position = clip;
  vertexOutputs.vLocal = local;
  vertexOutputs.vCell = vertexInputs.photoCell;
  vertexOutputs.vType = tyRaw;
}`;

export const PHOTO_BODY_FRAGMENT_WGSL = `
varying vLocal : vec2<f32>;
varying vCell : vec4<f32>;
varying vType : f32;
varying vZ : f32;
var uTex : texture_2d<f32>;
var uTexSampler : sampler;
uniform uTime : f32;

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  let ty : f32 = fragmentInputs.vType;
  let isGlobe : bool = ty < 1.9;
  let r2 : f32 = dot(fragmentInputs.vLocal, fragmentInputs.vLocal);
  let nz : f32 = sqrt(max(0.0, 1.0 - r2));
  let lat : f32 = asin(clamp(fragmentInputs.vLocal.y, -1.0, 1.0));
  let lon : f32 = atan2(fragmentInputs.vLocal.x, nz) + uniforms.uTime * 0.06;
  let globeUv : vec2<f32> =
    vec2<f32>(fract(lon * 0.15915494), 0.5 - lat * 0.31830988) * 0.96 + vec2<f32>(0.02, 0.02);
  let photoUv : vec2<f32> =
    vec2<f32>(fragmentInputs.vLocal.x * 0.5 + 0.5, 0.5 - fragmentInputs.vLocal.y * 0.5);
  let uv : vec2<f32> = fragmentInputs.vCell.xy + select(photoUv, globeUv, isGlobe) * fragmentInputs.vCell.zw;
  let tex : vec3<f32> = textureSample(uTex, uTexSampler, uv).rgb; // the ONE unconditional sample

  var col : vec3<f32> = vec3<f32>(0.0);
  var a : f32 = 0.0;
  if (isGlobe) {
    if (r2 < 1.0) {
      let n : vec3<f32> = vec3<f32>(fragmentInputs.vLocal, nz);
      let diff : f32 = max(0.0, dot(n, normalize(vec3<f32>(-0.55, 0.30, 0.78))));
      let shade : f32 = (0.05 + 1.08 * diff) * (0.72 + 0.28 * nz);
      col = tex * shade;
      col = col + vec3<f32>(0.30, 0.42, 0.75) * pow(1.0 - nz, 3.0) * diff * 0.4;
      a = smoothstep(1.0, 0.90, r2);
    }
    if (fract(ty) > 0.25) {
      let rr : f32 = length(vec2<f32>(fragmentInputs.vLocal.x, fragmentInputs.vLocal.y * 3.6));
      var band : f32 = smoothstep(1.16, 1.30, rr) * smoothstep(1.98, 1.78, rr);
      band = band * (0.8 + 0.2 * sin(rr * 36.0));
      let gap : f32 = smoothstep(1.50, 1.58, rr) * (1.0 - smoothstep(1.60, 1.68, rr));
      band = band * (1.0 - 0.8 * gap);
      let ra : f32 = band * step(1.0, r2) * 0.5;
      col = col + vec3<f32>(0.82, 0.72, 0.55) * ra;
      a = max(a, ra);
    }
    fragmentOutputs.color = vec4<f32>(col, a);
  } else {
    let r : f32 = length(fragmentInputs.vLocal);
    let vig : f32 = smoothstep(1.0, 0.58, r);
    col = tex * select(1.12, 0.95, ty > 5.5);
    let tyf : f32 = floor(ty + 0.5);
    if (fragmentInputs.vZ > 0.02 && (abs(tyf - 3.0) < 0.1 || abs(tyf - 6.0) < 0.1)) {
      let rs : f32 = clamp(fragmentInputs.vZ * 0.85, 0.0, 0.8);
      col = mix(col, vec3<f32>(col.r * 1.28 + 0.04, col.g * 0.60, col.b * 0.34), rs);
    }
    fragmentOutputs.color = vec4<f32>(col * vig, 1.0);
  }
}`;
