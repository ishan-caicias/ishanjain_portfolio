# Graphics & Physics Engine Adoption — Evaluation

**Date:** 2026-07-18 · **Status:** Evaluation complete, decision pending owner choice.
Adopting any option below **supersedes ADR-0002** (zero runtime 3D dependencies — the basis of
the custom `space-engine`). No ADR is written until the owner picks a path.

**Owner goals:** (1) maximum realistic rendering/physics/cinematics · (2) extreme performance ·
(3) responsive across desktop, mobile, and tablet browsers.

## Platform baseline (2026-07)

WebGPU now ships in every major browser: Chrome/Edge 113+ (Android in 121+), Safari 26 on
macOS/iOS/iPadOS (Sep 2025), Firefox 141+ (Windows) / 145 (macOS ARM). Coverage is approaching
ubiquity but a WebGL2 fallback remains mandatory for the tail — which all candidate engines
provide automatically.

## Rendering / animation engines

| Engine          | Size (core, gz)                            | WebGPU state                                                                                   | Animation & cinematics                                                                          | Physics story                  | License                        | Verdict                                                                                                             |
| --------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| **Babylon.js**  | ~1.4 MB (tree-shakeable `@babylonjs/core`) | Most advanced: native WGSL (8.0), volumetric lighting on compute (9.0), Gaussian splatting     | Fullest built-in: animation state machines, retargeting, camera rigs, node materials, audio, XR | **Havok integrated**           | MIT                            | **Primary candidate** — best match for goal 1 as one coherent stack                                                 |
| **Three.js**    | ~168 KB                                    | `WebGPURenderer` production since r171 (Sep 2025); TSL compiles one shader source to WGSL+GLSL | Core clips/mixer only; cinematics via community (theatre.js); r3f fits our React islands        | Bring-your-own (Rapier/Jolt)   | MIT                            | **Lean alternative** — best match for goals 2–3 and incremental migration                                           |
| **PlayCanvas**  | small builds                               | Maturing, not the default renderer                                                             | Editor-centric workflow (proprietary cloud editor); engine is MIT                               | Ammo integration (legacy tier) | Engine MIT, editor proprietary | Not recommended: its advantage is the editor pipeline, which doesn't fit this repo's code-first Astro workflow      |
| **Godot (web)** | large wasm                                 | n/a (WebGL2 export)                                                                            | Full engine, but…                                                                               | Built-in                       | MIT                            | **Disqualified for web embed**: SharedArrayBuffer/COOP-COEP requirements and long-standing iOS Safari load failures |

## Physics engines

| Engine              | Tech               | Perf (public benchmarks)                                                                                         | Size (approx)      | Coupling                                                                                | Verdict                                            |
| ------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------- | ------------------ | --------------------------------------------------------------------------------------- | -------------------------------------------------- |
| **Rapier**          | Rust → WASM (SIMD) | 2,000+ bodies @60fps; SIMD builds 2–5× faster than its 2024 releases — fastest broadly-verified in-browser today | ~500 KB compressed | Renderer-agnostic; first-class Three.js ecosystem                                       | **Best standalone choice**                         |
| **Havok**           | C++ → WASM         | Comparable to Rapier; ~20× the old Ammo backend                                                                  | wasm module        | Effectively **Babylon-only** (no documented standalone API); needs WASM SIMD, iOS ≥16.4 | **Best if and only if Babylon is chosen**          |
| **Jolt**            | C++ → WASM         | AAA pedigree (Horizon Forbidden West); early claims of ~2× Rapier on large scenes                                | wasm + JS wrapper  | `JoltPhysics.js` bindings younger; API mostly exposed; r3f/Babylon wrappers exist       | **Watch-list** — revisit maturity in 2026 H2       |
| Cannon-es / Ammo.js | JS / emscripten    | ~500 / ~1,000 bodies @60fps                                                                                      | small / medium     | —                                                                                       | Legacy tier — not competitive with the three above |

## The honest physics question

The current scene has **zero rigid-body needs** — no collisions, no constraints; the flight
model is deliberate cinematic kinematics (springs + quaternion damping, PF-08). A physics
engine pays for itself only alongside **new interactive content**: asteroid/debris fields the
ship deflects, docking contact, landing-gear touch, impulse-driven camera shake. Recommendation:
adopt physics _with_ the content phase that uses it, not before.

## Migration reality (either engine path)

- The differentiating custom work — 168k-star GPU streaming, photometric star shaders,
  relativistic aberration/Doppler, catalog picking — has no off-the-shelf equivalent and ports
  as custom shader materials / point clouds in either engine. The engine buys PBR, shadows,
  post-processing, GLTF animation, cinematics tooling — not the sky.
- The PF-07 "shell Δ ≤ +50 KB" budget dies under any adoption; a new performance budget
  (startup time + fps tiers per device class) replaces it.
- Wireframe/no-WebGL fallback and reduced-motion parity must be re-implemented as engine-level
  policies (both candidates support WebGL2 fallback automatically).

## Recommended decision frame

- **Goal 1 dominant (max realism/cinematics, batteries included):** Babylon.js + Havok —
  one MIT, Microsoft-backed stack; heaviest payload; biggest single rewrite.
- **Goals 2–3 dominant (leanest, best mobile floor, incremental):** Three.js (WebGPURenderer +
  TSL) + Rapier — ~670 KB combined vs multi-MB; react-three-fiber matches the existing React
  islands; cinematics assembled from theatre.js et al.
- **Either way:** phase as a **PF-09 spike** — rebuild the hero scene in the candidate stack
  behind an `?engine=` flag, A/B on real desktop + mid-range Android + iPhone, then write the
  superseding ADR from measured startup/fps data rather than vendor claims.

---

## Addendum (2026-07-18): Babylon+Havok space/time cost & interactive-content mapping

Owner selected Path 1 (Babylon + Havok) for scoping. Numbers below are **measured** for the
current build and **estimated** (public data, not yet measured in this repo) for Babylon.

### Current footprint — measured

| What                    | Measured                                                                                         |
| ----------------------- | ------------------------------------------------------------------------------------------------ |
| Engine JS (gzipped)     | **~28 KB** (`space-engine` 18 KB + `craft-loader` 10 KB)                                         |
| Total site JS (gzipped) | **~258 KB** (incl. celestial catalogs ~180 KB raw, MissionControl/React/motion, SpaceScene)      |
| GPU/wire asset payload  | **~7.8 MB** (`atlas.jpg` 3.5 MB, `stars-hip.png` 2.0 MB, `deep.png` 0.87 MB, 2K craft 1.0 MB)    |
| Runtime workload        | 168,959 star point-sprites + ~2,525 curated bodies, tier-adaptive, hand-tuned WebGL1, ≤~8 passes |

The engine layer is _extraordinarily_ lean — 28 KB for a single-draw-call 168k-point cloud is
near the theoretical floor. This is the number Babylon has to justify replacing.

### Projected Babylon+Havok footprint — estimated

| What                           | Estimate                                                                                                          | Δ vs today                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Babylon core (tree-shaken)     | **~600–900 KB gz** (PBR + particles + node material; fuller builds ~1.4 MB)                                       | engine layer **~20–30×**, site JS ~1.0–1.2 MB                  |
| Havok WASM (physics phase)     | **~0.5 MB gz**, async, deferred until content needs it                                                            | +0.5 MB only on physics pages                                  |
| Site JS total                  | **~0.9–1.2 MB gz** (renderer phase) → **~1.4–1.7 MB** with Havok                                                  | **~4–6×** the current 258 KB                                   |
| Assets (sky textures/catalogs) | ~unchanged — the 7.8 MB is _our_ data, not the engine's                                                           | ≈0                                                             |
| Startup                        | +engine init + WGSL compile + (deferred) WASM instantiate                                                         | **+~100–300 ms on mid mobile**; ~amortized on desktop (cached) |
| Runtime fps                    | Sky: wash-to-slightly-worse (already optimal). Ship/particles/nebulae/physics: **substantially better on WebGPU** | Net win _where the new content is_, neutral on the old sky     |

**The honest trade:** Babylon does not make today's sky faster — it can only match a hand-tuned
point cloud. Its payload buys _new capability_ (PBR, GPU particles, volumetric compute, physics,
post-processing) that would otherwise each be hand-written. Pay ~4–6× JS to make the interactive
vision feasible, not to speed up what exists.

### Interactive-content vision → mechanism (what actually needs Havok)

| Desired behaviour                     | Real mechanism                                                            | Needs Havok? |
| ------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| Ship faster/slower by travel distance | Velocity profile scaled by `ly` — pure logic, works **today**             | No           |
| Slow down near asteroid/debris fields | Proximity query into a density volume → speed field (steering)            | No           |
| Idle shooting stars                   | GPU particle emitter (Babylon) or current point pass                      | No           |
| Idle random **asteroid collisions**   | Spawn rigid bodies, let them collide, impulse + camera shake              | **Yes**      |
| Gaseous/volumetric nebulae            | Raymarched node material + volumetric lighting on WebGPU compute          | No (render)  |
| Docking approach                      | Kinematic spring/constraint (cinematic feel favours kinematic over rigid) | Optional     |
| Thrusters                             | GPU particle system + dynamic light                                       | No (render)  |

**Conclusion:** ~5 of 7 desired behaviours are **rendering / logic upgrades** (Babylon + a
steering-speed layer); only **asteroid collisions** (and optionally rigid docking contact)
genuinely require Havok. This validates the phased adoption:

- **PF-09 renderer phase** — Babylon(+WebGPU) rebuild of the hero scene: PBR ship, GPU-particle
  thrusters/shooting-stars, volumetric nebulae, distance-scaled travel + density-field slowdown.
  Delivers the bulk of "feel real" with **zero physics payload**.
- **PF-10 physics phase** — add Havok _only_ for asteroid-field collisions, debris the ship
  deflects, and impulse camera shake. The 0.5 MB WASM loads on the pages that use it.

Tier-gating stays mandatory: Havok needs WASM SIMD (iOS ≥16.4); the bundle increase hits mobile
parse time hardest — keep the WebGL2 + reduced-motion + low-tier fallbacks the current engine
already enforces.

## Sources

- Babylon 8.0: blogs.windows.com/windowsdeveloper/2025/03/27/announcing-babylon-js-8-0 ·
  babylonjs.medium.com/introducing-babylon-js-8-0 · doc.babylonjs.com/setup/support/webGPU
- Engine comparisons: app.cinevva.com/blog/2026-06-09-web-game-engines-2026-comparison ·
  utsubo.com/blog/threejs-vs-babylonjs-vs-playcanvas-comparison ·
  docs.viverse.com/optimization/overview-of-3d-web-rendering-engines
- Three.js WebGPU/TSL: utsubo.com/blog/webgpu-threejs-migration-guide ·
  utsubo.com/blog/threejs-2026-what-changed · github.com/mrdoob/three.js/releases
- Physics: abratabia.com/game-physics/best-web-physics-engine.php · rapier.rs ·
  github.com/jrouwe/JoltPhysics.js · webgamedev.com/physics ·
  mysimulator.uk/content/references/physics-engines-comparison.html
- Godot web: forum.godotengine.org/t/godot-4-3-will-finally-fix-web-builds-no-sharedarraybuffers-required/38885 ·
  github.com/godotengine/godot-proposals/discussions/8896
- WebGPU support: caniuse.com/webgpu · web.dev/blog/webgpu-supported-major-browsers ·
  appdevelopermagazine.com/webgpu-in-ios-26
