# PF-09 Babylon + Havok Realism Engine

**Date:** 2026-07-18
**Status:** IN PROGRESS — B0 complete ([TR-027](../test-reports/TR-027.md)) · **B1 gate decided:
CONDITIONAL GO** ([ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md)) on desktop evidence;
mobile unmeasured and gating the B6 cutover, not B2 · **B2 next**.
**Supersedes:** [ADR-0002](../adr/0002-in-engine-glb-ship-renderer.md) (zero runtime 3D deps) —
conditionally, per [ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md), written at the B1
gate from measured desktop data. The current engine remains the shipping default until the
mobile condition is discharged.
**Basis:** [Graphics/physics engine evaluation + Babylon cost addendum](../architecture/2026-07-18-graphics-physics-engine-evaluation.md),
building on PF-08 ([DELIVERED](PF-08-flight-v3.md), 67 unit / 48 E2E).

## Decision: PF-09 and PF-10 are combined into one plan

The owner asked whether the renderer phase (PF-09) and the physics phase (PF-10) should merge.
**They do — as one delivery plan with a hard go/no-go gate after the spike (B1).** Rationale:

- **One portfolio narrative.** "I rebuilt a bespoke WebGL1 engine on Babylon+WebGPU and added
  AAA-grade Havok physics" is a single, stronger story than two disconnected efforts. The owner
  explicitly wants Havok as a showcase piece, so it is planned in from the start, not deferred to
  a maybe-later plan.
- **Measure-before-commit is preserved, not lost.** B1 is a real gate: if the Babylon renderer
  can't hit the mobile fps floor inside the bundle budget, B2+ do not start and the superseding
  ADR is _not_ written — we keep the current engine and cherry-pick upgrades instead. Combining
  the plans does **not** mean committing to physics before the renderer is proven.

So: one plan, seven phases (B0–B6), one gate (after B1), Havok as a named showcase phase (B4).

## Goals (owner, carried from the evaluation)

1. Maximum realistic rendering, physics, and cinematics.
2. Extreme performance — pushed as far as the platform allows.
3. Responsive across desktop, mobile, and tablet browsers.

## Budgets & platform (replacing the retired PF-07 ≤+50 KB shell budget)

Per-device-class **performance budgets** replace the byte budget (the byte budget cannot survive
a 20–30× engine-layer increase — that trade is the whole point, see the evaluation addendum):

| Device class              | Sustained fps floor | Startup to first interactive | Notes                          |
| ------------------------- | ------------------- | ---------------------------- | ------------------------------ |
| Desktop (WebGPU)          | 60                  | ≤ 2.5 s                      | Full quality tier              |
| iPad / tablet (WebGPU)    | 60                  | ≤ 3.0 s                      | Full-minus tier                |
| Mid Android (WebGPU)      | ≥ 40                | ≤ 4.0 s                      | Reduced particles/physics tier |
| No WebGPU (WebGL2)        | ≥ 30                | ≤ 4.0 s                      | Fallback tier, no compute FX   |
| No WebGL / reduced-motion | n/a                 | instant                      | Static/DOM fallback (kept)     |

Bundle target: engine JS ≤ ~900 KB gz (renderer), Havok ~0.5 MB gz **lazy-loaded only on the
physics surface**. Zero Chinese-jurisdiction hosted dependencies (inherited security rule).

## Phases

### B0 — Foundations & dual-engine scaffold

Add `@babylonjs/core` (+ loaders), stand up a `BabylonScene` island alongside the current
`space-engine`, switchable via `?engine=babylon` (default stays the current engine). Build the
**perf-telemetry harness**: startup timing + rolling fps + device-tier detection, logged for A/B.
No visual parity yet — just two engines mountable behind a flag and a way to measure them.
**Exit:** both engines load behind the flag; telemetry reports startup + fps on demand.
**Outcome (2026-07-18, TR-027):** ✅ Delivered — `engine-select.ts` (`?engine=` resolver, default
webgl), `perf-telemetry.ts` (engine-agnostic `PerfMonitor` → `window.__ijPerf()` + `?perf=1`
overlay), `babylon-engine.ts` (`<babylon-scene>`, minimal WebGL2 scene), SpaceScene post-hydration
swap. Default bundle unchanged (Babylon is a lazy chunk). 80/80 unit · 51/51 E2E. **Measured
finding for B1:** the `@babylonjs/core` barrel import = **1.1 MB gz** (over the ~900 KB budget) —
B1 must use tree-shaken subpath imports + `WebGPUEngine`.

### B1 — Renderer parity spike ⛔ GO / NO-GO GATE

Rebuild the hero scene in Babylon+WebGPU to visual parity: 168k-star point cloud as a custom
`ShaderMaterial` (port the photometric + relativistic aberration/Doppler shaders), the Milky Way
band, curated bodies (PBR globes + photo billboards), and the PBR ship (reuse the existing GLB).
Measure bundle / startup / fps on **real desktop + mid Android + iPhone** against the current
engine. **GATE:** meet the B1 budgets above → write the superseding ADR from measured data,
proceed to B2. Miss them → stop, keep the current engine, record the negative result, and
cherry-pick isolated upgrades instead. _This is the only irreversible commitment point._
**Exit:** parity scene measured on 3 device classes; ADR written; explicit go/no-go recorded.
**GATE DECIDED (2026-07-18): CONDITIONAL GO — [ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md).**
Desktop (real hardware): Babylon **140 fps / 1070 ms** vs current **142 fps / 1357 ms** against a
60 fps floor — parity on fps, _better_ on startup, with the bundle already under budget. Mobile
rows were **DevTools emulation** (owner confirmed, no physical phone) so mobile perf is
**UNMEASURED, not passed**; it gates the B6 cutover rather than B2 development. The current engine
stays default throughout. Conditions to discharge: real-device mobile fps · confirm the badge
reads `BABYLON WEBGPU` (WGSL twin still unproven on hardware) · billboard memory reduction.

**Progress (2026-07-18, TR-028):** ⏳ Spike built & CI-verified; gate awaiting owner devices.
Tree-shaken subpath imports + WebGPU (WebGL2 fallback); 168k-star custom-ShaderMaterial cloud
([star-field.ts](../../src/lib/star-field.ts)). **Bundle GO: 329 KB gz** (from 1.1 MB barrel,
under the ~900 KB budget); default path unchanged. 84 unit · 51 E2E. fps/startup + WebGPU path
require real desktop/Android/iPhone — see the
[gate procedure](../validation-checklist/2026-07-18-pf09-b1-gate-measurement.md). ADR-0002 not
yet superseded (only after a GO reading).
**B1-continued (2026-07-18, TR-029):** ✅ WGSL twin delivered — and it exposed a technique-level
finding: **WebGPU has no `gl_PointSize`**, so the live engine's point-sprite star field cannot
port at all. Stars re-architected as **billboard quads** (one merged indexed mesh; thin instances
rejected — they need a matrix buffer). GLSL + WGSL twins selected by backend. Verified drawing the
full catalog: 1,013,754 active indices, 237,959 lit pixels. 86 unit · 52 E2E · bundle still
330 KB gz. WGSL path itself is unvalidated until a real WebGPU device runs it.

### B2 — Cinematic flight port ("travel feels real")

Re-implement the PF-08 flight model on the Babylon camera/scene: damped-spring + quaternion
orientation, the 30° behind-the-thruster chase, launch-points-at-click, arrival framing. Add
**distance-scaled travel**: near hops are quick; multi-hundred-ly journeys spend longer at cruise
(velocity profile keyed off `ly`), so speed communicates distance. Reduced-motion parity.
**Exit:** the PF-08 journey reproduces on Babylon, now with distance-driven pacing; suite green.

### B3 — Volumetric & particle rendering

GPU-particle **thrusters** (retire the F3 plume), GPU-particle **idle shooting stars**,
**volumetric/raymarched nebulae** (WebGPU compute — the "gaseous" look), the **heat-shimmer
refraction post-pass** deferred from F3, and docking-approach polish. Tier-gated: WebGL2 fallback
keeps the simpler billboards.
**Exit:** thrusters/nebulae/shimmer read as real volumetric FX; fallback tier still coherent.

### B4 — Havok physics showcase ⭐ (the portfolio centrepiece)

Lazy-load Havok on the travel surface. Deliver, as the marquee interactive piece:

- **Asteroid / debris fields** with real rigid-body collisions.
- **Proximity slowdown** — the ship eases through a field (density-field steering feeding the B2
  velocity profile), _and_ its passage **deflects debris** (Havok impulses).
- **Idle random asteroid collisions** — bodies drift and collide when the screen is idle.
- **Impulse-driven camera shake** on nearby impacts.
- **Docking contact** — a gentle constraint/impulse as the ship berths at a station.

Tier-gated body counts (desktop full, mobile reduced); Havok needs WASM SIMD (iOS ≥ 16.4) — below
that, the field renders visually without live physics.
**Exit:** collisions, deflection, proximity slowdown, and impact shake all live and tier-scaled.

### B5 — Responsiveness & quality tiers

Formalize the per-device tiers from the budget table: WebGPU→WebGL2 fallback, adaptive
particle/physics budgets, touch/pointer parity across desktop/tablet/mobile, reduced-motion and
no-WebGL paths carried forward from the current engine as first-class policies.
**Exit:** all five device classes meet their budget row; fallbacks verified on real devices.

### B6 — Harden & rollout

Perf budgets enforced in CI (startup + fps regression gates), accessibility re-audit,
`?engine=babylon` → default cutover, archive the WebGL1 engine behind a flag for one release
before removal. Security/deploy checklist.
**Exit:** Babylon default on all classes; old engine archived; CI guards the budgets.

## Creative exploration (candidate stretch ideas — pick per phase, not all)

Beyond the owner's list, the Babylon+WebGPU+Havok stack cheaply unlocks:

- **Gravitational lensing** around the black hole (post-process distortion).
- **Ship-cast real-time light** spilling onto nearby asteroids/nebulae as it passes.
- **Debris wake** — a turbulent trail the ship leaves through a field.
- **Depth-of-field focus pull** on arrival (cinematic rack focus onto the dossier body).
- **Audio-reactive thrusters** (Web Audio) — subtle rumble/attack tied to burn.
- **Grab-an-asteroid** — pointer-drag a body and watch it collide (physics as play).
- **Constellation reveal** — lines connect as the ship transits a figure.
- **Parallax occlusion** — foreground bodies eclipse background stars correctly.

These are logged as a menu, not committed scope; each is a small B3/B4 add if the budget allows.

## Constraints carried forward

Reduced-motion parity · WebGL2 + no-WebGL fallbacks preserved · every phase lands with unit + E2E
coverage per the established pattern · no Chinese-jurisdiction hosted deps · the differentiating
custom sky work (streaming, photometry, relativity, picking) is _ported_, never discarded.

## Risks

| Risk                                                 | Mitigation                                                                       |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Babylon misses the mobile fps/bundle budget          | **B1 is a hard gate** — no commitment until measured on real devices             |
| Engine-layer 20–30× JS increase hurts mobile startup | Tier-gated feature loading; Havok lazy-loaded only on the physics view           |
| Physics feels gimmicky rather than cinematic         | Kinematic where feel matters (chase, docking); Havok for genuine collisions only |
| Havok WASM SIMD unsupported (old iOS)                | Field renders visually without live physics below iOS 16.4                       |
| Big rewrite stalls the live site                     | Current engine stays default until B6; all work behind `?engine=`                |
| Scope creep from the creative menu                   | Menu is explicitly non-committed; each idea is an opt-in small add               |
