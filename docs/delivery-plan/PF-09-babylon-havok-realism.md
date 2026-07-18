# PF-09 Babylon + Havok Realism Engine

**Date:** 2026-07-18
**Status:** PLANNED — awaiting owner approval to start B0.
**Supersedes:** [ADR-0002](../adr/0002-in-engine-glb-ship-renderer.md) (zero runtime 3D deps) —
_conditionally_, at the B1 gate, from measured data. A new ADR is written at B1, not before.
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

### B1 — Renderer parity spike ⛔ GO / NO-GO GATE

Rebuild the hero scene in Babylon+WebGPU to visual parity: 168k-star point cloud as a custom
`ShaderMaterial` (port the photometric + relativistic aberration/Doppler shaders), the Milky Way
band, curated bodies (PBR globes + photo billboards), and the PBR ship (reuse the existing GLB).
Measure bundle / startup / fps on **real desktop + mid Android + iPhone** against the current
engine. **GATE:** meet the B1 budgets above → write the superseding ADR from measured data,
proceed to B2. Miss them → stop, keep the current engine, record the negative result, and
cherry-pick isolated upgrades instead. _This is the only irreversible commitment point._
**Exit:** parity scene measured on 3 device classes; ADR written; explicit go/no-go recorded.

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
