/* planet-sphere.ts — PF-10 C4: real planetary spheres with real topography.
 *
 * WHAT THIS ADDS, AND WHY IT IS NEW RATHER THAN AN UPGRADE. PF-10's C4 section describes applying
 * elevation "to the existing Mars mesh." No such mesh exists, and none ever has: every curated
 * body in this scene — all 267 with photographic imagery — renders as a BILLBOARD QUAD sampling a
 * 128x128 cell of the shared 4096x4096 `atlas.jpg` (celestial-bodies.ts, GAP-02). A flat sprite
 * cannot have topography. So C4 is the phase that introduces planetary surface rendering, not the
 * phase that enhances it. Owner re-scoped 2026-07-21 after this was measured and reported.
 *
 * DESIGN: ONE DESTINATION-GATED SPHERE, not twenty.
 *
 * The visitor can only ever be at one place. Rather than building a sphere per body — twenty-odd
 * meshes, each holding two 4096x2048 textures, almost all of them off-screen forever — this
 * module drives a SINGLE sphere that is repositioned and re-textured for whichever body is the
 * current destination. That choice follows the reveal mechanism ADR-0004 established for nebulae
 * and TR-072 generalized: the scene already treats "the body you are at" as a first-class state.
 *
 * It also happens to be what makes the phase tractable. GPU memory holds one body's maps instead
 * of twenty; the 267-billboard path is untouched, so there is no regression surface; and the
 * virtual-texture streaming C4.2 adds only ever has one body to stream.
 *
 * EQUIRECTANGULAR UV IS FREE HERE. Babylon's `CreateSphereVertexData` emits exactly the mapping
 * the source maps use (u = longitude/2pi, v = pole-to-pole) — the same convention `milky-way.ts`
 * already depends on and documents. No re-projection anywhere in this feature.
 *
 * TWO CLAUDE.md NON-NEGOTIABLES BIND THIS FILE DIRECTLY, and both are load-bearing rather than
 * ceremonial:
 *
 *   #9 (TR-059) — every declared sampler needs a REAL texture object bound before the mesh first
 *   draws, not before the content is ready. Most bodies here have no height map at all. On WebGPU
 *   an unbound binding is a hard exception while building the bind group, which kills
 *   `scene.render()` for the ENTIRE FRAME, not just this mesh. So `heightTex` is always bound —
 *   to a 1x1 mid-grey placeholder when a body has no elevation data — and `uHasHeight` decides
 *   whether its samples are USED, never whether they happen.
 *
 *   #8 (TR-047) — WGSL `textureSample` must sit in uniform control flow. The height samples are
 *   therefore taken unconditionally and multiplied by `uHasHeight` (0 or 1), rather than being
 *   wrapped in the `if` that would read more naturally. Branching around them would be rejected
 *   by the compiler on WebGPU while working fine on WebGL2 — a twin divergence with no compiler
 *   to catch it.
 */

/** Sphere tessellation. 64 segments gives a silhouette smooth enough that the eye reads a
 * circle rather than a polygon at the closest approach the flight model actually permits, at
 * ~8k triangles — trivial against a scene already drawing 154,662 asteroid billboards. */
export const SPHERE_SEGMENTS = 64;

/** Real physical elevation ranges for the bodies that ship a height map, in kilometres, as
 * (min, max) relief about the mean radius — used to decode the 8-bit greyscale height maps back
 * into real elevation. Mean radii in km alongside, because what matters visually is relief as a
 * FRACTION of radius, and that fraction is tiny for every real body.
 *
 * These are placeholders pending Astra's science brief (docs/analysis/
 * 2026-07-21-planetary-sphere-topography-science-brief.md) — the brief is authoritative for the
 * final numbers and for the exaggeration factor each body should ship with. */
export interface PlanetPhysical {
  /** Mean radius, km. */
  radiusKm: number;
  /** Lowest real elevation relative to the datum, km. */
  reliefMinKm: number;
  /** Highest real elevation relative to the datum, km. */
  reliefMaxKm: number;
  /** Real GEOMETRIC albedo, V band.
   *
   * ASTRA CORRECTION (2026-07-21 brief): this file's first draft used 0.25 for Mars and 0.12 for
   * the Moon. Both are BOND albedos — the fraction of incident light scattered in all directions,
   * which is not the quantity a renderer wants. Geometric albedo (brightness at zero phase
   * against a Lambertian disc) governs how bright the lit hemisphere reads. */
  albedo: number;
  /** Lunar-Lambert coefficient: 0 = pure Lambert, 1 = pure Lommel-Seeliger backscatter.
   *
   * Astra classed plain Lambertian shading on the Moon as BROKEN PHYSICS, not a simplification.
   * Real regolith backscatters: the full Moon is a flat, evenly-lit disc with no limb darkening,
   * and the half Moon is only ~9% as bright as the full Moon rather than the 50% Lambert
   * predicts. Airless bodies (Moon, Mercury) take 1.0; Mars takes 0.55. */
  lunarLambertL: number;
}

export const PLANET_PHYSICAL: Record<string, PlanetPhysical> = {
  mars: {
    radiusKm: 3389.5,
    reliefMinKm: -8.2,
    reliefMaxKm: 21.9,
    albedo: 0.17,
    lunarLambertL: 0.55,
  },
  moon: {
    radiusKm: 1737.4,
    reliefMinKm: -9.1,
    reliefMaxKm: 10.8,
    albedo: 0.136,
    lunarLambertL: 1.0,
  },
  mercury: {
    radiusKm: 2439.7,
    reliefMinKm: -5.4,
    reliefMaxKm: 4.5,
    albedo: 0.142,
    lunarLambertL: 1.0,
  },
};

/** World-space radius the sphere is drawn at.
 *
 * DECLARED, and unavoidably so. Real bodies are not to scale with anything else in this scene:
 * the catalog places bodies by `bodyWorldPosition`'s log-depth compression, so there is no single
 * length unit a "true" planetary radius could even be expressed in. This value is chosen to read
 * as a substantial world on arrival without occluding the HUD — the same class of declared choice
 * as the asteroid rocks' 0.9-3.2 unit radii. */
export const PLANET_SPHERE_RADIUS = 26;

/** Angular width of the surface patch the camera can actually see, in degrees.
 *
 * NOT a tuning constant — a derived property of the scene, and the number the whole C4.2
 * resolution analysis rests on. The camera parks at a FIXED `ARRIVE_STANDOFF` (38) from a
 * PLANET_SPHERE_RADIUS (26) sphere with no zoom anywhere in the engine, which pins the visible
 * patch at 23.5° across. `tests/unit/planet-vt.test.ts` recomputes it from those two constants,
 * so if either moves the test re-derives rather than silently inheriting a stale figure. */
export const PLANET_PATCH_DEG = 23.5;

/** Vertical exaggeration applied to the height-derived surface normals.
 *
 * ASTRA CORRECTION — 1.0, where this file's first draft had 12.
 *
 * The draft reasoned that since real relief is a tiny fraction of a planet's radius (Olympus Mons
 * is 0.65% of Mars's), exaggeration must be mandatory or the topography "may as well not exist".
 * That conflates two things. Relief is invisible on the SILHOUETTE — Astra measured that Mars
 * must render 2,260 px across before topography bends the limb by a single pixel — but shading
 * depends on SLOPE, which is scale-free and already vivid at true scale. Exaggerating the normals
 * buys a sub-pixel limb nobody can see, and corrupts the shading across the whole disc, which is
 * the part you actually look at. Astra puts >= 3.0 in lie territory.
 *
 * The visual tell that a scene has overdone this: real planetary limbs are clean arcs in every
 * spacecraft image ever taken. If you can see mountains on the edge, it is wrong. */
export const PLANET_ELEV_SCALE = 1;

/** Geometric albedos for the surface-only bodies, so each sphere reads at its real brightness
 * rather than at whatever exposure its source texture happened to be captured with. Astra's
 * brief; bodies absent here fall back to a neutral default. */
export const PLANET_ALBEDO: Record<string, number> = {
  venus: 0.689,
  io: 0.63,
  europa: 0.67,
  ganymede: 0.43,
  titan: 0.22,
  pluto: 0.6,
  ceres: 0.09,
  jupiter: 0.538,
  saturn: 0.499,

  /* PF-10 C4 CLOSEOUT (2026-07-21) — the three bodies the first pass skipped outright.
   *
   * THESE THREE VALUES EXCEED 1.0 AND THAT IS NOT AN ERROR. Geometric albedo is brightness at
   * zero phase against a perfect Lambertian disc, and the inner Saturnian icy satellites really
   * do beat that reference: they are continuously resurfaced by fresh E-ring ice grains, and
   * their regoliths show an extremely strong coherent-backscatter opposition surge (Verbiscer et
   * al. 2007). Tethys at 1.229 is among the most reflective surfaces in the solar system.
   *
   * The renderer must not "fix" this by clamping to 1. Clamping would flatten the single most
   * distinctive real fact about these bodies — that they are conspicuously brighter than the
   * Moon, Mars or Ceres sitting beside them in the same scene. */
  dione: 0.998,
  rhea: 0.949,
  tethys: 1.229,

  /** Earth — and this is the one entry in this table that is NOT the body's geometric albedo.
   *
   * ASTRA, ranked #6 in the Earth brief's broken-physics table: Earth's real geometric albedo is
   * 0.434, and putting it here would be **the right number in the wrong place**. Earth is the
   * first body in this scene rendered as TWO layers — a surface and a cloud deck — and 0.434 is
   * the composite of both. Applying it to the surface *and* compositing clouds over it counts the
   * clouds twice: the planet renders ~2x too bright, and worse, the ocean/cloud contrast collapses
   * because the ocean has been lifted to cloud brightness.
   *
   * The surface takes Earth's **clear-sky** geometric albedo, 0.15 / 0.705 = 0.213; the cloud
   * layer supplies the rest. Astra closed the budget two independent ways: from literature,
   * (1 - 0.67)*0.213 + 0.67*0.55 = 0.439 against the real 0.434 (1%); and from the shipped cloud
   * map's own solid-angle-weighted mean byte, (1 - 0.2428)*0.213 + 0.2428*1.0 = 0.404 (7%). */
  earth: 0.213,
};

/** Lunar-Lambert coefficient for bodies not in `PLANET_PHYSICAL`. Absent = the 0.55 default.
 *
 * Earth is 0, i.e. pure Lambert, and Astra classes reusing Mars's 0.55 or the Moon's 1.0 as
 * BROKEN PHYSICS by mechanism: the Lommel-Seeliger term models **shadow hiding in porous,
 * sharp-grained regolith**, and there is no regolith on Earth's visible surface. Water has no
 * pore structure; a cloud is a multiple-scattering droplet slab. Applying a regolith law to an
 * ocean is the same class of error as lighting a radar map (TR-078 Part 2) — a real formula
 * applied to a surface whose physics it does not describe.
 *
 * Honest about the magnitude: at this scene's arrival geometry the choice changes the render by
 * 0% at frame centre and at most 8.6% at the frame edge. It is fixed because it is free, and it
 * becomes a 37-67% error the moment the arrival phase ever changes. */
export const PLANET_LUNAR_L: Record<string, number> = {
  earth: 0.0,

  /* The three icy satellites take 1.0, and Astra was explicit that the 0.55 fallback they were
   * getting is BROKEN PHYSICS rather than merely imprecise: 0.55 is MARS's coefficient, and Mars
   * has an atmosphere. These are airless bodies with porous regolith — the same case as the Moon
   * and Mercury, which already take 1.0. */
  dione: 1.0,
  rhea: 1.0,
  tethys: 1.0,
};

/** Bodies that must NEVER be rendered as a sphere, however much texture data exists for them.
 *
 * OWNER DECISION (2026-07-21), on Astra's advice, recorded as a standing RULE rather than a
 * deferral: Phobos and Deimos are the most famously irregular bodies in the pack — Phobos is
 * roughly 27x22x18 km and visibly a battered potato. Sphering them would be broken physics in the
 * most literal sense: the shape IS the science. They stay billboards permanently.
 *
 * This list is enforced rather than merely honoured by omission. The pipeline is data-driven — a
 * body becomes spherical the moment the texture manifest contains it — so without an explicit
 * block, adding `phobos-high.jpg` to the pipeline later would silently sphere a potato. */
export const NEVER_SPHERE = new Set(["phobos", "deimos"]);

/** Real sidereal rotation periods, seconds. Negative = retrograde (Venus really does spin
 * backwards). Astra's brief supplied these; they matter because the RATIOS between them are real
 * even though the absolute rate is time-accelerated below. */
export const ROTATION_PERIOD_S: Record<string, number> = {
  mercury: 5067360, // 58.646 d
  venus: -20996760, // 243.025 d, retrograde
  moon: 2360591.5, // 27.322 d, synchronous with its orbit
  mars: 88642.66, // 24h 37m 22s — famously close to Earth's
  jupiter: 35730, // 9h 55m 30s (System III)
  saturn: 38362, // 10h 39m 22s
  io: 152853.5,
  europa: 306822,
  ganymede: 618153,
  titan: 1377648,
  pluto: -551856.7, // 6.387 d, retrograde
  ceres: 32667, // 9h 4m 27s

  // PF-10 C4 closeout. All three are tidally locked, so the sidereal rotation period IS the
  // orbital period — which is why they are long: these are days-per-rotation worlds, and at
  // ROTATION_TIME_ACCEL they turn slowly and visibly rather than spinning.
  // ASTRA CORRECTION: dione was first entered as 236429, which does not match the 2.736915 d
  // this very comment cited — an arithmetic slip of 40.5 s caught by checking the number against
  // its own stated source rather than against a second source.
  dione: 236469.5, // 2.736915 d, synchronous
  rhea: 390373.5, // 4.518212 d, synchronous
  tethys: 163106.1, // 1.887802 d, synchronous
  // SIDEREAL, not the 86400 s solar day — the difference is ~4 minutes and it is the sidereal
  // figure that governs rotation against the fixed stars, which is what this scene renders.
  earth: 86164.0905,
};

/** Rotation time acceleration — DELIBERATELY SEPARATE from the asteroid belt's TIME_ACCEL of 4e5.
 *
 * ASTRA: sharing the belt's constant here is not marginal, it is absurd. At 4e5 Mars would spin
 * at 4.5 revolutions per SECOND — 27.1° per frame at 60 fps, past the Nyquist limit, so it would
 * visibly alias BACKWARDS. Jupiter would manage 67° per frame.
 *
 * At 1e3 Mars takes ~89 s per revolution and Jupiter ~36 s: slow enough to read as a turning
 * world rather than a spinning top, fast enough to be perceptible while you are parked at it.
 * Because it is a single scalar, every real period RATIO is preserved exactly — Jupiter really
 * does finish a day in a quarter the time Mars takes.
 *
 * DECLARED, and stated plainly: the scene now runs two clocks 400x apart. The belt is on
 * geological time; the planets are on something closer to human time. Both are declared rather
 * than hidden, and neither is visible in the same frame as the other. */
export const ROTATION_TIME_ACCEL = 1e3;

/** Rotation angle (radians) for a body at wall-clock `tS`. Zero for bodies with no real period,
 * and zero under reduced motion (the caller passes tS = 0). */
export function rotationAngle(bodyId: string, tS: number): number {
  const period = ROTATION_PERIOD_S[bodyId];
  if (!period || tS === 0) return 0;
  return ((2 * Math.PI) / period) * tS * ROTATION_TIME_ACCEL;
}

/** Shape of `public/assets/planets/manifest.json`, emitted by scripts/build-planet-textures.mjs. */
export interface PlanetTierSet {
  base: string;
  high: string;
  /** Only present for bodies with a real 8192-wide source — see the pipeline's TIERS note. */
  ultra?: string;
}
export interface PlanetManifestEntry {
  surface: PlanetTierSet;
  /** An 8-bit greyscale elevation map the shader DIFFERENTIATES into slopes. */
  height: PlanetTierSet | null;
  /** A pre-baked tangent-space normal map the shader consumes DIRECTLY.
   *
   * PF-10 C4 CLOSEOUT (2026-07-21). `height` and `normal` are mutually exclusive across the
   * entire source pack — a genuine property of the data, not a convention imposed here — which
   * is why the shader can gate them against each other with one `uHasNormal` and needs no
   * precedence rule.
   *
   * Preferring a baked normal over a height map is the same finding `build-planet-vt.mjs` rests
   * on: 8-bit quantization is catastrophic under differentiation (it terraces the surface) and
   * benign under direct consumption. Nine bodies shipped as smooth spheres through TR-076/078
   * with real relief data sitting unused in the pack, because the first pass read "ships a
   * height map" as the test for "has real elevation". It is not. */
  normal?: PlanetTierSet | null;
  /** Earth only: real city lights, composited on the night side. */
  night?: PlanetTierSet | null;
  /** Earth only: the real cloud deck, on its own advection. */
  cloud?: PlanetTierSet | null;
  /** Earth only: ocean/land specular mask. */
  specular?: PlanetTierSet | null;
}
export interface PlanetManifest {
  generated: string;
  tiers: Record<string, { width: number; quality: number }>;
  bodies: Record<string, PlanetManifestEntry>;
}

/** Real relief as a fraction of the body's own radius. This is the number that explains why
 * every planetary visualization ever made exaggerates elevation: Olympus Mons, the tallest
 * relief in the solar system, is 0.65% of Mars's radius. At true scale a sphere is a sphere. */
export function reliefFraction(p: PlanetPhysical): number {
  return (p.reliefMaxKm - p.reliefMinKm) / p.radiusKm;
}

/** Direction from a body toward the Sun, in world space.
 *
 * Real, not a lighting convenience: `bodyWorldPosition` places every catalog body relative to
 * Sol at the world origin, so the vector from a body to the Sun is simply the negated, normalized
 * body position. A planet's lit hemisphere therefore faces genuinely sunward, and the terminator
 * falls where it really would for a viewer at that body's catalog position. */
export function sunDirectionFrom(
  bodyPos: readonly [number, number, number],
): [number, number, number] {
  const [x, y, z] = bodyPos;
  const len = Math.hypot(x, y, z);
  if (len < 1e-6) return [0, 0, 1]; // at Sol itself: arbitrary but stable
  return [-x / len, -y / len, -z / len];
}

/** Whether a catalog entry is a body a sphere should be built for.
 *
 * Deliberately data-driven rather than a hardcoded id list: an entry qualifies when the shipped
 * planet-texture manifest has real surface imagery for it. That keeps this in step with
 * `scripts/build-planet-textures.mjs` automatically — adding a body to the pipeline makes it
 * spherical with no code change here. */
export function sphereIdFor(
  entry: { id: string; t?: string },
  manifestBodies: Record<string, unknown>,
): string | null {
  if (!entry.id) return null;
  // Catalog ids carry prefixes ("minorplanet-ceres"); the manifest is keyed on the bare name.
  const bare = entry.id.replace(/^[a-z]+-/, "");
  // Irregular bodies are blocked before any manifest lookup — see NEVER_SPHERE.
  if (NEVER_SPHERE.has(entry.id) || NEVER_SPHERE.has(bare)) return null;
  if (manifestBodies[entry.id]) return entry.id;
  if (manifestBodies[bare]) return bare;
  return null;
}

/* ---------- shader twins ------------------------------------------------ */

/* Shared constants, interpolated into both twins from the one TS source so they cannot drift.
 * ELEV_TEXEL is the finite-difference step used to derive surface normals from the height map;
 * it must match the shipped map's texel size or the derived slopes are scaled wrong. */
export const ELEV_SAMPLE_STEP = 1 / 2048;

/** Longitude offset applied when sampling, in UV units.
 *
 * ASTRA finding: the pack's maps put longitude 180°E at u = 0, not the 0°E a reader would assume.
 * Astra pinned this by locating Mars's real extrema — the Hellas basin and the Tharsis rise — in
 * the actual height map rather than trusting the convention. Without the half-turn every body
 * renders with its real features rotated 180° in longitude: still "a planet", but the wrong face
 * toward the Sun.
 *
 * Applied as a plain addition with the sampler in WRAP mode rather than fract() — fract() in a
 * fragment shader introduces a derivative discontinuity that shows up as a one-pixel mip seam. */
export const UV_LONGITUDE_OFFSET = 0.5;

/** Terminator softening half-width on N·L. The Sun is not a point: it subtends 0.350° at Mars and
 * 0.533° at the Moon, so the day/night boundary has a real penumbra — about 3 px on a 1000-px
 * disc. Small, but a hard step there is one of the tells of a fake planet. */
export const TERMINATOR_SOFTEN = 0.005;

/* ---------- Earth: the three terms that make it Earth ------------------------
 *
 * All from Astra's Earth brief (docs/analysis/2026-07-21-earth-sphere-science-brief.md), whose
 * single most consequential measurement is about the CAMERA rather than the planet:
 *
 *   The arrival phase angle is EXACTLY ZERO, for every body, every time. `travelTo` parks the
 *   camera at `bodyPos - dir * ARRIVE_STANDOFF` — i.e. between Sol and the body, on the Sun-body
 *   line — and `sunDirectionFrom` returns `-dir`. So V = L identically, and free-look changes
 *   orientation only. The terminator is 90 degrees from the sub-camera point and the night
 *   hemisphere is 100% occluded.
 *
 * That one fact decides everything below: it is why there are no city lights (they cannot produce
 * a single visible pixel), and why the ocean glint is not optional (the mirror condition is
 * satisfied EXACTLY at the dead centre of the frame — this is the DSCOVR/EPIC geometry, where the
 * glint is a published, daily-photographed Earth signature).
 *
 * It also forced an additive correction to the C4.1 brief, which named "real phases and a real
 * terminator" as C4's honest headline. True of the physics of a sphere; false of this scene's
 * arrival geometry. No body in this scene ever shows a phase. Recorded there, not edited away.
 */

/** Rayleigh optical depth at sea level per RGB band (650 / 550 / 450 nm), Bodhaine et al. 1999,
 * tau proportional to lambda^-4.09.
 *
 * OMITTING THIS TERM IS BROKEN PHYSICS, and it is the largest honesty problem in the Earth
 * feature — larger than anything about clouds or lights. Astra measured the day map's ocean at
 * RGB (2, 5, 20) of 255. That is a correct measurement of what the WATER does, and it is nothing
 * like what EARTH looks like: between **74% and 87% of the light you see over open ocean from
 * space is scattered air**, not water. The Blue Marble product has it removed on purpose, because
 * it is a SURFACE product. Rendering it raw does not simplify Earth — it renders the wrong
 * object, a picture of the sea's reflectance presented as a picture of the planet. */
export const RAYLEIGH_TAU_RGB: readonly [number, number, number] = [
  0.0491, 0.0973, 0.2211,
];

/** Maritime background aerosol, spectrally flat, weak backscatter. */
export const AEROSOL_TAU = 0.08;

/** Cox & Munk (1954) sea-surface slope variance: sigma2 = 0.003 + 0.00512 * W, at the real
 * global-mean ocean surface wind of 7.0 m/s (scatterometer climatology, 6.6-7.0). Gives an RMS
 * slope of 11.15 degrees, a peak glint 2.26x a Lambertian ocean, and a half-power radius of
 * 209 px on a 1080p frame. */
export const OCEAN_SIGMA2 = 0.03884;

/** Fresnel reflectance at normal incidence for seawater, n = 1.339 at 550 nm. */
export const OCEAN_F0 = 0.02101;

/** Lunar-Lambert coefficient for the CLOUD layer — not the surface's 0.
 *
 * Astra: Chandrasekhar's exact solution for reflection from a conservative multiple-scattering
 * slab has the same FORM as Lommel-Seeliger, by a completely different mechanism (single-scatter
 * albedo of cloud droplets at 550 nm is ~0.9999, not shadow hiding in regolith). Same formula,
 * different physics, and the coefficient that fits is ~0.9. */
export const CLOUD_LUNAR_L = 0.9;

/** Cloud shell altitude as a fraction of Earth's radius — 5 km / 6371 km.
 *
 * TRUE SCALE, and this is where Venus's precedent must NOT be copied. TR-078 declared the Venus
 * deck unrepresentable because the whole 70 km column is 0.097 world units at radius 26. Earth's
 * clouds are drawn at 5 km = 0.0204 wu, which is 24-237 depth quanta at this camera — comfortably
 * representable. Astra ranks reusing Venus's 2 x 1.012 shell radius as BROKEN PHYSICS #5: it puts
 * the deck at 76.5 km, in the MESOSPHERE, and produces ~19 px of false cloud/surface parallax at
 * the frame edge against a true-scale 1.3 px.
 *
 * DECLARED SIMPLIFICATION, with its cost measured rather than waved at: the clouds are composited
 * in this fragment shader rather than drawn on a second shell mesh, which forfeits exactly that
 * true-scale 1.3 px of parallax on a 2397 px disc — 0.05%. What it buys is no second mesh, no
 * alpha-ordering, and no depth-precision exposure. The altitude constant is kept because it is
 * what makes the forfeit quantifiable. */
export const CLOUD_SHELL_FACTOR = 1.000785;

const PLANET_SHADER_CONSTANTS = `
const float ELEV_STEP = ${ELEV_SAMPLE_STEP.toFixed(8)};
const float LON_OFFSET = ${UV_LONGITUDE_OFFSET.toFixed(4)};
const float TERM_SOFTEN = ${TERMINATOR_SOFTEN.toFixed(5)};
const float PI = 3.14159265;
const vec3 RAYLEIGH_TAU = vec3(${RAYLEIGH_TAU_RGB.map((v) => v.toFixed(5)).join(", ")});
const float AEROSOL_TAU = ${AEROSOL_TAU.toFixed(4)};
const float OCEAN_SIGMA2 = ${OCEAN_SIGMA2.toFixed(6)};
const float OCEAN_F0 = ${OCEAN_F0.toFixed(6)};
const float CLOUD_L = ${CLOUD_LUNAR_L.toFixed(3)};`;

export const PLANET_VERTEX_GLSL = `
precision highp float;
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform mat4 world;
uniform mat4 view;
uniform mat4 projection;
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vWorldPos;
${PLANET_SHADER_CONSTANTS}
void main(){
  vec4 wp = world * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  // The sphere is built at the origin then translated, so the object-space position IS the
  // outward radial direction — no normal matrix needed, and no non-uniform scale is ever applied.
  vNormal = normalize(mat3(world) * normal);
  vUV = uv;
  gl_Position = projection * view * wp;
}`;

export const PLANET_FRAGMENT_GLSL = `
precision highp float;
uniform sampler2D surfaceTex;
uniform sampler2D heightTex;
uniform sampler2D normalTex;  // PF-10 C4 closeout: pre-baked tangent-space relief
uniform float uHasNormal;     // 1 = this body ships a real normal map, 0 = placeholder bound
uniform vec3 uSunDir;      // world-space unit vector from the body toward the Sun
uniform float uHasHeight;  // 1 = this body ships real elevation, 0 = placeholder bound
uniform float uElevScale;  // vertical exaggeration (1.0 = true scale, see PLANET_ELEV_SCALE)
uniform float uAlbedo;     // real GEOMETRIC albedo
uniform float uLunarL;     // Lunar-Lambert coefficient: 1 = airless backscatter, 0 = Lambert
uniform vec3 uCamPos;      // world-space camera, for the emission-angle term
uniform sampler2D detailTex;  // PF-10 C4.2: streamed VT normal atlas for the visible patch
uniform vec4 uDetailRect;     // [u0,v0,u1,v1] of the map that atlas covers
uniform float uHasDetail;     // 1 = a real atlas is bound, 0 = placeholder
uniform float uFlatLight;     // PF-10 C4.2 Venus fork: 1 = flat shadowless illuminant
uniform vec3 uFlatTint;       // real Venera illuminant when the fork is engaged
uniform float uFlatLevel;     // relative illuminance under the deck
uniform sampler2D cloudTex;   // PF-10 C4 closeout, Earth: real cloud coverage/reflectance product
uniform sampler2D specularTex;// Earth: real ocean/land mask, 70.06% ocean as measured
uniform float uHasCloud;      // 1 = a real cloud map is bound
uniform float uAtmosphere;    // 1 = this body has an atmosphere the Rayleigh term applies to
varying vec2 vUV;
varying vec3 vNormal;
varying vec3 vWorldPos;
${PLANET_SHADER_CONSTANTS}
void main(){
  // Longitude origin correction — see UV_LONGITUDE_OFFSET. Sampler is in WRAP mode, so no
  // fract() is needed and the derivative stays continuous across the seam.
  vec2 tUV = vec2(vUV.x + LON_OFFSET, vUV.y);
  vec3 surface = texture2D(surfaceTex, tUV).rgb;

  // TR-047: these four samples are taken UNCONDITIONALLY and gated by multiplication, never by
  // branching — see this file's header. The cost of sampling a 1x1 placeholder is nil.
  float hL = texture2D(heightTex, tUV - vec2(ELEV_STEP, 0.0)).r;
  float hR = texture2D(heightTex, tUV + vec2(ELEV_STEP, 0.0)).r;
  float hD = texture2D(heightTex, tUV - vec2(0.0, ELEV_STEP)).r;
  float hU = texture2D(heightTex, tUV + vec2(0.0, ELEV_STEP)).r;

  // Tangent frame for an equirectangular sphere, derived analytically rather than stored: the
  // geometric normal is radial, east is perpendicular to it and the polar axis, north completes
  // the basis. Degenerate exactly at the poles, where the cross product is stabilised below.
  vec3 N = normalize(vNormal);
  vec3 east = cross(vec3(0.0, 1.0, 0.0), N);
  float eastLen = length(east);
  east = eastLen > 1e-4 ? east / eastLen : vec3(1.0, 0.0, 0.0);
  vec3 north = cross(N, east);

  // Slope from central differences, scaled by the declared exaggeration. The v term is negated
  // because texture v runs pole-to-pole against the north basis vector.
  float dHdu = (hR - hL) * uElevScale * uHasHeight;
  float dHdv = (hU - hD) * uElevScale * uHasHeight;
  vec3 perturbed = normalize(N - east * dHdu + north * dHdv);

  // PF-10 C4 CLOSEOUT: pre-baked relief, for the nine bodies whose pack data is a NORMAL map
  // rather than a height map. Consumed directly instead of differentiated — which is not a
  // shortcut but the strictly better path, and the same finding build-planet-vt.mjs rests on:
  // 8-bit quantization is catastrophic under differentiation (it terraces the surface into
  // visible steps) and benign under direct consumption.
  //
  // The height and normal maps are MUTUALLY EXCLUSIVE across the entire source pack — a real
  // property of the data, not a convention imposed here — so these two paths can be gated against
  // each other with one uniform and need no precedence rule. Sampled unconditionally and gated by
  // multiplication per TR-047; the sampler always has a real texture bound per TR-059, and its
  // placeholder is the neutral normal (128,128,255) rather than the mid-grey the other samplers
  // use, because mid-grey decodes to a ZERO vector here rather than to "no change".
  vec3 nrm = texture2D(normalTex, tUV).rgb * 2.0 - 1.0;
  vec3 nrmWorld = normalize(east * nrm.x + north * nrm.y + N * max(nrm.z, 0.05));
  perturbed = normalize(mix(perturbed, nrmWorld, uHasNormal));

  // PF-10 C4.2: streamed high-resolution detail. The visible tile set is a contiguous RECTANGLE
  // (see planet-vt.ts), so the atlas lookup is one subtract-and-divide with no indirection table.
  // Sampled unconditionally per TR-047 and gated by multiplication; the sampler always has a real
  // texture bound per TR-059. The "inside" term fades detail out at the atlas edge rather than
  // clipping it, so the boundary of the streamed region is never a visible line.
  vec2 rectSize = uDetailRect.zw - uDetailRect.xy;
  vec2 dUV = (tUV - uDetailRect.xy) / max(rectSize, vec2(1e-6));
  vec3 detail = texture2D(detailTex, clamp(dUV, 0.0, 1.0)).rgb * 2.0 - 1.0;
  vec2 edge = min(dUV, 1.0 - dUV);
  float inside = smoothstep(0.0, 0.04, min(edge.x, edge.y)) * uHasDetail;
  // Detail normals are tangent-space (x=east, y=north, z=up); rotate into the surface frame and
  // blend by that same term. Reconstructing rather than replacing keeps the base elevation's large-scale
  // shape and adds the streamed level's fine structure on top.
  vec3 detailWorld = normalize(east * detail.x + north * detail.y + perturbed * max(detail.z, 0.05));
  perturbed = normalize(mix(perturbed, detailWorld, inside));

  // LUNAR-LAMBERT reflectance. Plain Lambert here is BROKEN PHYSICS for airless bodies (Astra):
  // real regolith backscatters, which is why the full Moon is a flat evenly-lit disc with no limb
  // darkening, and why the half Moon is ~9% as bright as the full Moon rather than Lambert's 50%.
  //   I = albedo * ( 2 L mu0 / (mu0 + mu) + (1 - L) mu0 )
  // The Lommel-Seeliger term needs the EMISSION angle mu as well as the incidence angle mu0,
  // which is why this shader takes a camera position at all.
  vec3 viewDir = normalize(uCamPos - vWorldPos);
  float mu0 = max(dot(perturbed, normalize(uSunDir)), 0.0);
  float mu = max(dot(perturbed, viewDir), 0.0);
  float refl = 2.0 * uLunarL * mu0 / max(mu0 + mu, 1e-4) + (1.0 - uLunarL) * mu0;

  // Real terminator penumbra — the Sun is a disc, not a point (TERM_SOFTEN).
  float dayside = smoothstep(-TERM_SOFTEN, TERM_SOFTEN, dot(normalize(vNormal), normalize(uSunDir)));
  // A dim ambient term keeps the night side legible rather than pure black — a real night side is
  // lit by starlight and, for the Moon, earthshine; this stands in for that without modelling it.
  vec3 lit = surface * uAlbedo * (refl * dayside * 3.6 + 0.06);

  // ---- EARTH (PF-10 C4 closeout). Three terms, each with a named mechanism, per Astra's brief.
  // Every one is sampled/computed unconditionally and gated by multiplication (TR-047); the two
  // samplers always have a real texture bound (TR-059), black for bodies that have neither.
  //
  // 1. OCEAN GLINT — Cox-Munk slope distribution in Torrance-Sparrow form. Not decoration: at this
  // scene's zero arrival phase the mirror condition H = normalize(L+V) is satisfied EXACTLY at the
  // dead centre of the frame, which is the DSCOVR/EPIC geometry where ocean glint is a published,
  // daily-photographed feature. Astra: omitting it is the departure from reality, not adding it.
  // The map carries no baked glint (Blue-Marble products mask it out), so this is purely additive.
  float oceanMask = texture2D(specularTex, tUV).r;
  vec3 Hv = normalize(normalize(uSunDir) + viewDir);
  float cosTh = max(dot(perturbed, Hv), 1e-4);
  float cos2Th = cosTh * cosTh;
  float tan2 = (1.0 - cos2Th) / cos2Th;
  float slopeP = exp(-tan2 / OCEAN_SIGMA2) / (PI * OCEAN_SIGMA2 * cos2Th * cos2Th);
  float cosI = max(dot(Hv, viewDir), 0.0);
  float fres = OCEAN_F0 + (1.0 - OCEAN_F0) * pow(1.0 - cosI, 5.0);
  // The 1/(4 mu0 mu) denominator diverges at the terminator, where the single-scattering
  // microfacet form is invalid anyway — clamped rather than allowed to blow up.
  float glint = oceanMask * fres * slopeP / (4.0 * max(mu0 * mu, 0.02));
  // BRDF -> this shader's units: a Lambertian albedo A has BRDF A/PI, so multiplying by PI puts
  // the glint on the same scale as uAlbedo before the shared exposure factor.
  lit += vec3(glint * PI) * mu0 * 3.6 * dayside;

  // 2. RAYLEIGH + AEROSOL — single scattering, real optical depths, real lambda^-4.09 colour and
  // the real phase function. See RAYLEIGH_TAU_RGB: omitting this is the feature's biggest honesty
  // problem, because the ocean in the surface map is RGB (2,5,20) and most of the blue you see
  // from orbit never reaches the water at all. No texture tap, and the cheapest term here.
  float cosT = dot(-normalize(uSunDir), viewDir);
  float phaseR = 0.75 * (1.0 + cosT * cosT);
  float airDenom = 4.0 * max(mu * mu0, 0.05);
  vec3 air = (RAYLEIGH_TAU * phaseR + vec3(AEROSOL_TAU * 0.3)) / airDenom;
  lit += air * uAtmosphere * mu0 * 3.6 * dayside;

  // 3. CLOUDS — composited here rather than on a second shell mesh (see CLOUD_SHELL_FACTOR for
  // the declared 1.3 px of forfeited parallax). Alpha is the map byte RAW, not sRGB-decoded, and
  // the cloud is WHITE: Astra settled that from the map itself, since raw alpha x white
  // reproduces Earth's real geometric albedo to 7% while sRGB-decoding misses by 33%. Contrast is
  // NOT flattened — that was the right fix for Venus, whose map is a UV image at 20.5% contrast
  // against a real 1-3%; Earth's clouds really are near-white on near-black.
  // The deck is LOCKED to the surface: Earth's atmosphere co-rotates to 1.3% and laps in 77 days,
  // so an independently spinning shell would be broken physics (Astra's #3) however alive it looks.
  // Compositing over the surface also masks the glint exactly as real DSCOVR imagery shows.
  float cloudA = texture2D(cloudTex, tUV).r * uHasCloud;
  float cloudRefl = 2.0 * CLOUD_L * mu0 / max(mu0 + mu, 1e-4) + (1.0 - CLOUD_L) * mu0;
  vec3 cloudLit = vec3(cloudRefl * dayside * 3.6 + 0.06);
  lit = mix(lit, cloudLit, cloudA);

  // VENUS FORK (PF-10 C4.2). Astra's mandate, and the most important honesty decision in this
  // shader: below the cloud deck a Magellan RADAR map must NOT be lit. Radar brightness is
  // roughness and slope, not reflectance, so a directional Sun plus normal perturbation would
  // manufacture geometry that is not there and then cast convincing light across it. Real Venera
  // images show flat, shadowless orange light with no solar disc and no terminator. So under the
  // deck the surface is presented as an evenly-illuminated radar visualization: no directional
  // term, no perturbed normal, just the real illuminant at the real relative illuminance.
  // NAMED flatLit, NOT flat: the bare word is a reserved interpolation qualifier in GLSL ES 3.0 and the
  // shader fails to compile — which surfaces only as materialReady staying false, with no console
  // error to point at it. This is TR-045's lesson (reserved identifiers blank the scene) arriving
  // from the GLSL side rather than the WGSL side; the WGSL twin was named flatLit from the start
  // and the GLSL one was not, so the twins disagreed and only one of them broke.
  vec3 flatLit = surface * uFlatTint * uFlatLevel;
  gl_FragColor = vec4(mix(lit, flatLit, uFlatLight), 1.0);
}`;

export const PLANET_VERTEX_WGSL = `
attribute position : vec3<f32>;
attribute normal : vec3<f32>;
attribute uv : vec2<f32>;
uniform world : mat4x4<f32>;
uniform view : mat4x4<f32>;
uniform projection : mat4x4<f32>;
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;

const ELEV_STEP : f32 = ${ELEV_SAMPLE_STEP.toFixed(8)};
const PI : f32 = 3.14159265;

@vertex
fn main(input : VertexInputs) -> FragmentInputs {
  let wp : vec4<f32> = uniforms.world * vec4<f32>(vertexInputs.position, 1.0);
  vertexOutputs.vWorldPos = wp.xyz;
  let m : mat3x3<f32> = mat3x3<f32>(
    uniforms.world[0].xyz, uniforms.world[1].xyz, uniforms.world[2].xyz);
  vertexOutputs.vNormal = normalize(m * vertexInputs.normal);
  vertexOutputs.vUV = vertexInputs.uv;
  vertexOutputs.position = uniforms.projection * uniforms.view * wp;
}`;

export const PLANET_FRAGMENT_WGSL = `
varying vUV : vec2<f32>;
varying vNormal : vec3<f32>;
varying vWorldPos : vec3<f32>;
var surfaceTexSampler : sampler;
var surfaceTex : texture_2d<f32>;
var heightTexSampler : sampler;
var heightTex : texture_2d<f32>;
var normalTexSampler : sampler;
var normalTex : texture_2d<f32>;
uniform uHasNormal : f32;
uniform uSunDir : vec3<f32>;
uniform uHasHeight : f32;
uniform uElevScale : f32;
uniform uAlbedo : f32;
uniform uLunarL : f32;
uniform uCamPos : vec3<f32>;
var detailTexSampler : sampler;
var detailTex : texture_2d<f32>;
uniform uDetailRect : vec4<f32>;
uniform uHasDetail : f32;
uniform uFlatLight : f32;
uniform uFlatTint : vec3<f32>;
uniform uFlatLevel : f32;
var cloudTexSampler : sampler;
var cloudTex : texture_2d<f32>;
var specularTexSampler : sampler;
var specularTex : texture_2d<f32>;
uniform uHasCloud : f32;
uniform uAtmosphere : f32;

const ELEV_STEP : f32 = ${ELEV_SAMPLE_STEP.toFixed(8)};
const LON_OFFSET : f32 = ${UV_LONGITUDE_OFFSET.toFixed(4)};
const TERM_SOFTEN : f32 = ${TERMINATOR_SOFTEN.toFixed(5)};
const PI : f32 = 3.14159265;
const RAYLEIGH_TAU : vec3<f32> = vec3<f32>(${RAYLEIGH_TAU_RGB.map((v) => v.toFixed(5)).join(", ")});
const AEROSOL_TAU : f32 = ${AEROSOL_TAU.toFixed(4)};
const OCEAN_SIGMA2 : f32 = ${OCEAN_SIGMA2.toFixed(6)};
const OCEAN_F0 : f32 = ${OCEAN_F0.toFixed(6)};
const CLOUD_L : f32 = ${CLOUD_LUNAR_L.toFixed(3)};

@fragment
fn main(input : FragmentInputs) -> FragmentOutputs {
  // Longitude origin correction — line-for-line twin of the GLSL above.
  let tUV : vec2<f32> = vec2<f32>(fragmentInputs.vUV.x + LON_OFFSET, fragmentInputs.vUV.y);
  let surface : vec3<f32> =
    textureSample(surfaceTex, surfaceTexSampler, tUV).rgb;

  // TR-047: uniform control flow — sampled unconditionally, gated by multiplication.
  let hL : f32 = textureSample(heightTex, heightTexSampler,
    tUV - vec2<f32>(ELEV_STEP, 0.0)).r;
  let hR : f32 = textureSample(heightTex, heightTexSampler,
    tUV + vec2<f32>(ELEV_STEP, 0.0)).r;
  let hD : f32 = textureSample(heightTex, heightTexSampler,
    tUV - vec2<f32>(0.0, ELEV_STEP)).r;
  let hU : f32 = textureSample(heightTex, heightTexSampler,
    tUV + vec2<f32>(0.0, ELEV_STEP)).r;

  let N : vec3<f32> = normalize(fragmentInputs.vNormal);
  var east : vec3<f32> = cross(vec3<f32>(0.0, 1.0, 0.0), N);
  let eastLen : f32 = length(east);
  east = select(vec3<f32>(1.0, 0.0, 0.0), east / eastLen, eastLen > 1e-4);
  let north : vec3<f32> = cross(N, east);

  let dHdu : f32 = (hR - hL) * uniforms.uElevScale * uniforms.uHasHeight;
  let dHdv : f32 = (hU - hD) * uniforms.uElevScale * uniforms.uHasHeight;
  var perturbed : vec3<f32> = normalize(N - east * dHdu + north * dHdv);

  // PF-10 C4 CLOSEOUT — line-for-line twin of the GLSL pre-baked-relief block above.
  let nrm : vec3<f32> =
    textureSample(normalTex, normalTexSampler, tUV).rgb * 2.0 - 1.0;
  let nrmWorld : vec3<f32> =
    normalize(east * nrm.x + north * nrm.y + N * max(nrm.z, 0.05));
  perturbed = normalize(mix(perturbed, nrmWorld, uniforms.uHasNormal));

  // PF-10 C4.2 — line-for-line twin of the GLSL detail block above.
  let rectSize : vec2<f32> = uniforms.uDetailRect.zw - uniforms.uDetailRect.xy;
  let dUV : vec2<f32> = (tUV - uniforms.uDetailRect.xy) / max(rectSize, vec2<f32>(1e-6, 1e-6));
  let detail : vec3<f32> =
    textureSample(detailTex, detailTexSampler, clamp(dUV, vec2<f32>(0.0, 0.0), vec2<f32>(1.0, 1.0))).rgb * 2.0 - 1.0;
  let edge : vec2<f32> = min(dUV, vec2<f32>(1.0, 1.0) - dUV);
  let inside : f32 = smoothstep(0.0, 0.04, min(edge.x, edge.y)) * uniforms.uHasDetail;
  let detailWorld : vec3<f32> =
    normalize(east * detail.x + north * detail.y + perturbed * max(detail.z, 0.05));
  perturbed = normalize(mix(perturbed, detailWorld, inside));

  // LUNAR-LAMBERT reflectance — line-for-line twin of the GLSL above. See that comment for why
  // plain Lambert is broken physics on an airless body.
  let viewDir : vec3<f32> = normalize(uniforms.uCamPos - fragmentInputs.vWorldPos);
  let mu0 : f32 = max(dot(perturbed, normalize(uniforms.uSunDir)), 0.0);
  let mu : f32 = max(dot(perturbed, viewDir), 0.0);
  let refl : f32 =
    2.0 * uniforms.uLunarL * mu0 / max(mu0 + mu, 1e-4) + (1.0 - uniforms.uLunarL) * mu0;

  let dayside : f32 = smoothstep(-TERM_SOFTEN, TERM_SOFTEN,
    dot(normalize(fragmentInputs.vNormal), normalize(uniforms.uSunDir)));
  var lit : vec3<f32> = surface * uniforms.uAlbedo * (refl * dayside * 3.6 + 0.06);

  // ---- EARTH (PF-10 C4 closeout) — line-for-line twin of the GLSL block above. See there for
  // why each term exists; the physics comments are not duplicated, only the code.
  let oceanMask : f32 = textureSample(specularTex, specularTexSampler, tUV).r;
  let Hv : vec3<f32> = normalize(normalize(uniforms.uSunDir) + viewDir);
  let cosTh : f32 = max(dot(perturbed, Hv), 1e-4);
  let cos2Th : f32 = cosTh * cosTh;
  let tan2 : f32 = (1.0 - cos2Th) / cos2Th;
  let slopeP : f32 =
    exp(-tan2 / OCEAN_SIGMA2) / (PI * OCEAN_SIGMA2 * cos2Th * cos2Th);
  let cosI : f32 = max(dot(Hv, viewDir), 0.0);
  let fres : f32 = OCEAN_F0 + (1.0 - OCEAN_F0) * pow(1.0 - cosI, 5.0);
  let glint : f32 = oceanMask * fres * slopeP / (4.0 * max(mu0 * mu, 0.02));
  lit = lit + vec3<f32>(glint * PI) * mu0 * 3.6 * dayside;

  let cosT : f32 = dot(-normalize(uniforms.uSunDir), viewDir);
  let phaseR : f32 = 0.75 * (1.0 + cosT * cosT);
  let airDenom : f32 = 4.0 * max(mu * mu0, 0.05);
  let air : vec3<f32> =
    (RAYLEIGH_TAU * phaseR + vec3<f32>(AEROSOL_TAU * 0.3)) / airDenom;
  lit = lit + air * uniforms.uAtmosphere * mu0 * 3.6 * dayside;

  let cloudA : f32 =
    textureSample(cloudTex, cloudTexSampler, tUV).r * uniforms.uHasCloud;
  let cloudRefl : f32 =
    2.0 * CLOUD_L * mu0 / max(mu0 + mu, 1e-4) + (1.0 - CLOUD_L) * mu0;
  let cloudLit : vec3<f32> = vec3<f32>(cloudRefl * dayside * 3.6 + 0.06);
  lit = mix(lit, cloudLit, cloudA);

  // VENUS FORK — line-for-line twin of the GLSL block above. "flat" is not a reserved WGSL
  // identifier but IS a WGSL interpolation attribute name, so the variable is named flatLit here
  // to keep it unambiguous (TR-045's lesson generalized: prefer the unambiguous name).
  let flatLit : vec3<f32> = surface * uniforms.uFlatTint * uniforms.uFlatLevel;
  fragmentOutputs.color = vec4<f32>(mix(lit, flatLit, uniforms.uFlatLight), 1.0);
}`;

/** JS mirror of the shader's tangent-frame construction, so the arithmetic the twins share has an
 * off-GPU check — the same discipline star-field.ts applies to its billboard corner derivation.
 * Returns [east, north] for a given outward normal. */
export function tangentFrame(
  n: readonly [number, number, number],
): [[number, number, number], [number, number, number]] {
  const len = Math.hypot(n[0], n[1], n[2]) || 1;
  const N: [number, number, number] = [n[0] / len, n[1] / len, n[2] / len];
  // cross([0,1,0], N)
  let east: [number, number, number] = [
    1 * N[2] - 0 * N[1],
    0 * N[0] - 0 * N[2],
    0 * N[1] - 1 * N[0],
  ];
  const el = Math.hypot(east[0], east[1], east[2]);
  east = el > 1e-4 ? [east[0] / el, east[1] / el, east[2] / el] : [1, 0, 0];
  const north: [number, number, number] = [
    N[1] * east[2] - N[2] * east[1],
    N[2] * east[0] - N[0] * east[2],
    N[0] * east[1] - N[1] * east[0],
  ];
  return [east, north];
}
