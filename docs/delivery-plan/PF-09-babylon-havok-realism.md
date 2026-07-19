# PF-09 Babylon + Havok Realism Engine

**Date:** 2026-07-18
**Status:** **B0–B6 DELIVERED — cutover executed 2026-07-19; B6 not yet closed.** The default
engine is Babylon ([ADR-0006](../adr/0006-babylon-default-cutover.md) Accepted,
[TR-053](../test-reports/TR-053.md)/[TR-054](../test-reports/TR-054.md)). GAP-01/GAP-02 from the
[cutover gap analysis](../analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md) — curated
destination bodies and the photographic DSO layer were not rendered on the Babylon path — are
**resolved** ([TR-056](../test-reports/TR-056.md), 2026-07-20). **One item remains before B6
closes: the post-flip owner device pass** (checklist §A, accepted risk at flip — needs the
owner's physical iPad/mid-Android hardware, not actionable from this desk). The gap analysis
itself still lists ~23 smaller, lower-severity gaps (station sprites, field-star hover,
free-look drag, and others) that are tracked follow-ups, not B6 blockers.
_Phase history below is append-only; read it as a record, not as current state._

B0 complete ([TR-027](../test-reports/TR-027.md)) · **B1 gate decided:
CONDITIONAL GO** ([ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md)) on desktop evidence ·
**mobile condition DISCHARGED 2026-07-19** on real Android (Babylon 60 fps / 678 ms vs current
60 fps / 1745 ms, budget ≥ 40 fps · ≤ 4.0 s) — the primary open risk is closed; conditions 2
(WebGPU badge) and 3 (billboard memory) still gate the B6 cutover · **B2 CODE-COMPLETE — all 6
steps done** ([TR-036](../test-reports/TR-036.md), [TR-038](../test-reports/TR-038.md),
[TR-040](../test-reports/TR-040.md), [TR-041](../test-reports/TR-041.md),
[TR-042](../test-reports/TR-042.md)); one exit condition remains open — **owner real-device
fps/startup re-measurement**, same as the B1 gate ([TR-043](../test-reports/TR-043.md) flags the
first attempt's readings as not yet trustworthy). **B3 (volumetric & particle rendering) IN
PROGRESS at owner direction** ([TR-044](../test-reports/TR-044.md)) — starting before that
condition closes, not because it closed. **B3 COMPLETE 2026-07-19** — shooting stars, volumetric
compute-raymarched nebulae with destination-gated reveal, and the owner-unblocked ship track
(GLB hull, flip-and-burn thrusters, heat-shimmer post-pass, docking polish):
[TR-046](../test-reports/TR-046.md), [TR-047](../test-reports/TR-047.md),
[ADR-0004](../adr/0004-volumetric-nebulae-compute-raymarch.md),
[ADR-0005](../adr/0005-babylon-ship-mesh-track.md). **B4 (Havok physics showcase ⭐) COMPLETE
2026-07-19** — lazy same-origin WASM, tier-gated rigid-body asteroid belt, proximity slowdown
integrated into the velocity profile, passage deflection, impulse-driven impact camera shake,
docking contact: [TR-048](../test-reports/TR-048.md), [TR-049](../test-reports/TR-049.md),
[TR-050](../test-reports/TR-050.md). **B5 CODE-COMPLETE 2026-07-19**
([TR-051](../test-reports/TR-051.md)) — unified quality tiers (full/balanced/lite) across every
knob; mobile budget rows gated on the owner's devices. **B6 desk items DONE 2026-07-19**
([TR-052](../test-reports/TR-052.md)) — CI bundle+perf gates, a11y re-audit (real tabindex fix),
cutover checklist + rollback runbook + [ADR-0006](../adr/0006-babylon-default-cutover.md)
(then Proposed). **CUTOVER EXECUTED 2026-07-19** — §B3 dispositioned Option A and the §A device
rows accepted as post-flip risk by owner decision; ADR-0006 Accepted and the default flipped
([TR-053](../test-reports/TR-053.md), [TR-054](../test-reports/TR-054.md)).
**Supersedes:** [ADR-0002](../adr/0002-in-engine-glb-ship-renderer.md) (zero runtime 3D deps) —
conditionally, per [ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md), written at the B1
gate from measured desktop data. _(That condition was discharged 2026-07-19 on real Android;
the legacy WebGL1 engine is now archived behind `?engine=webgl`, not the shipping default.)_
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

**Scope addition (2026-07-19): vertex-index expansion** — ADR-0003 condition 3 folded in here
rather than deferred to B3. The B1 buffer layout stores each star's xyz **four times** (once per
quad corner) plus a 4-float corner attribute, costing ~23 MB against the live engine's ~2.7 MB:

| Buffer      | B1 layout          | Size    |
| ----------- | ------------------ | ------- |
| `positions` | 675,836 × 3 floats | 8.1 MB  |
| `corners`   | 675,836 × 4 floats | 10.8 MB |
| `indices`   | 1,013,754 × Uint32 | 4.1 MB  |

Both the corner offset (`vertex_index % 4`) and the star index (`vertex_index / 4`) are derivable
in-shader from `@builtin(vertex_index)` / `gl_VertexID`, so per-star attributes need storing only
**once**. This is a WebGPU-native technique unavailable in WebGL1 — an upgrade, not a workaround.

**Sequenced this way deliberately** — the buffer path is rewritten _before_ real data lands, so the
catalog is built into the final layout rather than migrated twice:

1. **Vertex expansion** — rewrite the star buffer path + WGSL/GLSL twins; memory measured.
   ✅ **Done 2026-07-19 ([TR-036](../test-reports/TR-036.md))** — 21.9 → 16.8 MiB.
2. **Real catalog swap** — replace `buildStarField`'s seeded-LCG placeholder with the actual
   Gaia/Hipparcos catalog and port the photometric shader.
   ✅ **Done 2026-07-19 ([TR-038](../test-reports/TR-038.md))** — 168,959 records decoded from the
   same PNG-packed assets the live engine streams; both shader twins run the photometric path
   (Pogson → flux → size/alpha) plus all 7 deep-layer classes. Closes the ~6× density gap
   ([TR-037](../test-reports/TR-037.md)). 107 unit · 53 E2E; per-vertex buffer still 2 floats.
3. **Flight model port** — wire the existing pure, unit-tested `ship-dynamics.ts` to a Babylon
   camera (damped spring + quaternion slerp).
   ✅ **Done 2026-07-19 ([TR-040](../test-reports/TR-040.md))** — `travelTo`/`goHome`/`randomBody`
   wired for real: position via damped spring (`SHIP_SPRING_OMEGA`/`ZETA`, reused as-is — a linear
   spring's settle time is distance-independent), orientation via quaternion slerp toward the
   travel direction. Fixed a blocking prerequisite found during inspection: `SpaceScene.tsx`'s
   `engineEl()` only ever queried `space-engine`, so nothing wired into `<babylon-scene>` in steps
   1–2 was reachable from the real UI. 113 unit · 55 E2E, including a new test that drives travel
   through the actual RNG button, not the engine's internals. Chase-camera waypoint choreography,
   launch-turn, arrival framing, and screen-space station projection deliberately deferred to step
   4; distance-scaled pacing to step 5.
4. **Chase camera · launch-at-click · arrival framing** — the PF-08 choreography.
   ✅ **Done 2026-07-19 ([TR-041](../test-reports/TR-041.md))** — step 3's damped-spring stand-in
   replaced with the real eased path + waypoint chase offset (`chaseOffsetAt`/`travelFrame`), a
   launch-at-click orientation preview during "aim," and arrival framing that falls out of the
   chase-look damping rather than needing separate code. Accel/flip/decel + apparent-velocity HUD
   readout ported too — `WarpOverlay` now renders identically on either engine. Camera lands
   exactly on target (`cam(1) = to` by waypoint-table construction, verified to 6 decimal places in
   E2E, not just asserted). 116 unit · 56 E2E.
5. **Distance-scaled travel** — velocity profile keyed off `ly`.
   ✅ **Done 2026-07-19 ([TR-042](../test-reports/TR-042.md))** — new math (`warpDurationForLy`,
   log-scaled and bounded to 1.4–4.2 s), not a port: the live engine hardcodes a fixed warp
   duration regardless of distance, so there was nothing to carry over. Checked against the shipped
   catalog's full range (0 to 13 billion ly) before picking bounds. Same accel-flip-decel curve as
   step 4, stretched over a longer duration for far targets — no new easing shape invented.
6. **Reduced-motion parity.**
   ✅ **Done 2026-07-19 ([TR-042](../test-reports/TR-042.md))** — ported directly from
   `space-engine.js`'s `reduced` branches: fixed short durations (200/350 ms, overriding step 5's
   formula entirely), `CHASE_OFFSET_REST` instead of the waypoint offset, snapped (not damped)
   orientation. One-shot `matchMedia` snapshot at boot, matching the live engine's own pattern.

**Exit:** the PF-08 journey reproduces on Babylon, now with distance-driven pacing; star memory
materially below the B1 figure; suite green. All three conditions ✅. **Re-measure fps/startup
after this phase** — the B1 readings were taken on procedural stars with no ship and are an upper
bound (TR-035) — is the one exit condition still open: it needs the owner's real device, the same
as the B1 gate itself (TR-032/033 established this can't be substituted with CI or desktop-browser
readings). **B2 is code-complete; all six sub-steps shipped and verified
([TR-036](../test-reports/TR-036.md), [TR-038](../test-reports/TR-038.md),
[TR-040](../test-reports/TR-040.md), [TR-041](../test-reports/TR-041.md),
[TR-042](../test-reports/TR-042.md)).**

**Demo-deploy report and fixes, 2026-07-19 ([TR-043](../test-reports/TR-043.md)).** First
real-device readings from the redeployed demo surfaced a genuine defect: desktop WebGPU rendered
**blurry** on HiDPI displays — `adaptToDeviceRatio` was never set on the WebGPU engine (the WebGL2
fallback had it correctly since B1; WebGPUEngine's constructor takes it via `options`, not a
positional arg, and it silently defaulted to `false`). ✅ **Fixed**, verified on real WebGPU
hardware with a simulated HiDPI display. Also fixed: the idle-at-home view was completely frozen —
✅ ported the live engine's ambient idle drift (converted to a frame-rate-independent rate). The
reported "no 360 nav" and "no spaceship" are confirmed **not** regressions — both have been named,
documented scope boundaries since B0/step-3 (TR-040), not features that broke. **The startup
re-measurement condition above remains open**: the owner's desktop (3023 ms) and Android (267 ms)
readings are flagged, not accepted at face value — 267 ms is implausibly fast for the catalog
decode and needs confirmation it was a cold load, matching the rigor TR-032/033 established for the
B1 gate.

### B3 — Volumetric & particle rendering

GPU-particle **thrusters** (retire the F3 plume), GPU-particle **idle shooting stars**,
**volumetric/raymarched nebulae** (WebGPU compute — the "gaseous" look), the **heat-shimmer
refraction post-pass** deferred from F3, and docking-approach polish. Tier-gated: WebGL2 fallback
keeps the simpler billboards.
**Exit:** thrusters/nebulae/shimmer read as real volumetric FX; fallback tier still coherent.

**IN PROGRESS 2026-07-19.** **Sequencing decision, recorded before starting:** three of the five
items — thrusters, heat-shimmer (`space-engine.js` places it explicitly "behind the nozzle"), and
docking-approach polish — are ship-attached, and **no ship mesh exists on the Babylon path yet**
(`craft-loader.ts` is a hand-rolled raw-WebGL loader, not portable to Babylon without its own
build-out; the camera has played the "ship" role throughout B2). These three are **blocked** on an
unscoped Babylon ship-mesh loading track, not silently dropped. Volumetric nebulae (WebGPU compute)
is unblocked but a materially larger effort of its own, deferred to its own increment.

✅ **Idle shooting stars done ([TR-044](../test-reports/TR-044.md))** — new work, not a port (the
live engine has no equivalent at all). Genuinely GPU-driven: every particle's position and fade are
computed in the vertex shader from `uTime` alone, zero per-frame CPU cost, unlike the live engine's
CPU-stepped F3 embers. 140 unit · 61 E2E.

**⚠ Regression, found and fixed same-day ([TR-045](../test-reports/TR-045.md)).** The WGSL twin
used `meta`/`ref` — reserved WGSL keywords — which blanked the **entire scene** (star field
included) on real WebGPU hardware, undetected by TR-044's own verification (`materialReady: true`
reported regardless, since WebGPU shader validation is asynchronous). Owner caught it on the live
demo server. Fixed; the verification gap (no console-error check) is closed in
`webgpu-hardware.spec.ts`.

✅ **Volumetric/raymarched nebulae done 2026-07-19 ([TR-046](../test-reports/TR-046.md),
[ADR-0004](../adr/0004-volumetric-nebulae-compute-raymarch.md))** — the owner-selected increment,
executed as planned (INSPECT confirmed the live engine's nebulae are 2D billboard sprites — new
work, not a port; `3feature` Strategy Gate run first). Four raymarched gas volumes anchored at
real catalog nebulae (m42, ngc7293, veil, rosette — `travelTo` flies _into_ them), tier-gated per
the exit criterion: **WebGPU = compute-shader raymarch** into a half-res storage texture (40
steps), **WebGL2 = the same march as a ProceduralTexture fragment pass** (18 steps), one shared
fullscreen composite. All constants baked into generated GLSL/WGSL sources from one TS module
(`nebula-field.ts`), reserved-WGSL-word-guarded per TR-045. Real-hardware verification with
screenshots this time (the TR-044 gap): compute tier confirmed on real WebGPU, console clean,
~118 fps. One real defect found by the suite, not the owner: tree-shaken Babylon needs the
`engine.computeShader` side-effect extension explicitly imported — without it the render loop
died at boot (fixed, recorded in TR-046/ADR-0004). Visual tuning is a first pass — knobs in
`NEBULA_MARCH`, owner taste pass expected. 164 unit · 62 E2E.

✅ **B3 COMPLETE 2026-07-19 ([TR-047](../test-reports/TR-047.md),
[ADR-0005](../adr/0005-babylon-ship-mesh-track.md)).** Two closing moves, both owner-directed:
**(1)** the nebula gas is now **destination-gated** (owner defect report: it appeared during the
acceleration burn) — invisible until the decel burn, fades in from the HUD's own decel threshold,
swells to full as the ship stops, damped fade-out on departure (ADR-0004 amendment; verified
with staged real-hardware screenshots). **(2)** The **ship-mesh track was unblocked by the owner**
and delivered, carrying the three blocked items: the tiered `sci-fi-fighter` GLB loads via
`@babylonjs/loaders` under the existing craft-tier policy and flies at the virtual-ship position
the chase camera has trailed since B2 — with a real 180° **flip-and-burn** at the HUD's flip
window; **thrusters** reuse ship-dynamics' F3 plume system verbatim (GLSL/WGSL twins, baked
colours); the **heat-shimmer refraction post-pass** (deferred from F3) anchors at the nozzle's
screen position; **docking-approach polish** holds the berth pose then fades the hull as the
dossier opens. Two CSP interactions surfaced and resolved deliberately (self-hosted meshopt
decoder; `connect-src blob:` — see ADR-0005 + docs/security), and one real WGSL
uniform-control-flow violation was caught by the TR-045 console gate before any owner report.
**Exit criterion met:** thrusters/nebulae/shimmer read as real volumetric FX on the WebGPU tier
(real-hardware journey screenshots, ~118 fps, clean console); the WebGL2 fallback runs the same
ship/plume/shimmer plus the fragment-raymarch nebulae — coherent, CI-verified. 185 unit · 64 E2E.

B2's own open exit condition (owner real-device fps/startup re-measurement, flagged
not-yet-trustworthy in TR-043) remains separately open — unchanged by B3's completion.

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

**Step 1 DONE 2026-07-19 ([TR-048](../test-reports/TR-048.md)):** ✅ Havok live — `@babylonjs/havok`
lazy WASM served same-origin (never a CDN, ADR-0005 stance), tier-gated procedural asteroid belt
(48/20 bodies via the craft-tier device policy) with real rigid-body collisions, seeded rock
geometry, weak spine-circle herding so the zero-g field stays coherent and keeps colliding
(**idle random asteroid collisions: delivered**), and the mandated no-SIMD/reduced-motion visual
tier (same field, kinematic drift, no live physics). Scene gains its first light (dim
hemispheric). Verified on real WebGPU hardware: 48 bodies, measured motion, clean console;
198 unit · 65 E2E. **Staged next:** step 2 proximity slowdown + passage deflection; step 3
collision events → impact camera shake; step 4 docking-contact constraint.

**Step 2 DONE 2026-07-19 ([TR-049](../test-reports/TR-049.md)):** ✅ **proximity slowdown** —
warp progress is now INTEGRATED (`dk = dt/warpDur × slowFactor(beltDensity)`), so local field
density genuinely feeds the B2 velocity profile; `warp.prog` became the single source of k for
camera/hull/HUD/nebula-reveal alike. ✅ **passage deflection** — the warping ship ploughs nearby
rocks aside with mass-scaled Havok forces. Belt deliberately reoriented (X–Y plane, axis Z) so
the m42 showcase route crosses its tube dead-centre — E2E asserts the crossing via the
engine-captured `warpSlowMin`. Real-hardware proof: slow 0.783 live mid-crossing, min 0.463,
wall clock 4.74 s vs warpDur 3.59 s (the belt genuinely costs time). Two real defects caught by
the suite in-run (clamped-dt journey stretch on slow devices; the original Y-axis belt was
crossed by almost no route); the chase-camera E2E was pinned to Polaris (declared — random RNG
targets made phase timing non-deterministic once journeys became route-dependent). 206 unit ·
65 E2E. **Remaining:** step 3 impact camera shake; step 4 docking contact.

✅ **B4 COMPLETE 2026-07-19 ([TR-050](../test-reports/TR-050.md)).** Steps 3–4 delivered:
**impact camera shake** driven by the solver's own collision impulses (inverse-square distance
falloff, capped, reduced-motion-gated, ringing down on the camera object only — the canonical
`cam` stays exact for arrival framing), and **docking contact** — a gentle berthing bump through
the shake system plus a sprung hull settle along the approach axis (impulse+spring flavoured, a
deliberate proportionality call over a Havok constraint pair for a 1.65 s berth beat).
**Exit criterion met:** collisions, deflection, proximity slowdown, and impact shake all live
and tier-scaled (48/20 bodies by device signals; no-SIMD tier renders visually without physics;
reduced motion: static field, no shake) — plus docking contact and idle random collisions.
Real-hardware proof: 22 idle impacts in 12 s, dock bump 0.299 captured at arrival, console
clean. 210 unit · 65 E2E. Owner taste knobs: `IMPACT_SHAKE`, `DOCK_CONTACT`.

### B5 — Responsiveness & quality tiers

Formalize the per-device tiers from the budget table: WebGPU→WebGL2 fallback, adaptive
particle/physics budgets, touch/pointer parity across desktop/tablet/mobile, reduced-motion and
no-WebGL paths carried forward from the current engine as first-class policies.
**Exit:** all five device classes meet their budget row; fallbacks verified on real devices.

**CODE-COMPLETE 2026-07-19 ([TR-051](../test-reports/TR-051.md)) — exit measurement GATED on
owner devices.** One unified tier system (`babylon-tiers.ts`): backend + perf-telemetry's
device class + `?tier=` override resolve a single budget (`full`/`balanced`/`lite`) consumed by
every knob — star halo (the live engine's 0/0.55/1, finally honoured), shooting-star count
(24/16/8), nebula step scale + offscreen resolution, asteroid bodies (48/32/20), shimmer
(skipped on lite). Badge shows the tier for on-device checks. Verified from this desk: real
WebGPU desktop = `full` (hardware spec), WebGL2 = `balanced`/`lite` (real + CI), no-WebGL/
reduced-motion fallbacks (pre-existing E2E). **Open:** iPad + mid-Android budget rows need the
owner's devices (same standing condition as B2's re-measurement; instrument: tier badge +
`?perf=1`). Reduced motion deliberately remains a per-feature contract, not a tier; craft 1k/2k
stays the orthogonal asset axis; runtime-adaptive tier switching deliberately deferred (B6+
candidate). 216 unit · 66 E2E.

### B6 — Harden & rollout

Perf budgets enforced in CI (startup + fps regression gates), accessibility re-audit,
`?engine=babylon` → default cutover, archive the WebGL1 engine behind a flag for one release
before removal. Security/deploy checklist.
**Exit:** Babylon default on all classes; old engine archived; CI guards the budgets.

**Desk items DONE 2026-07-19 ([TR-052](../test-reports/TR-052.md)) — cutover GATED.** Shipped:
CI **bundle-budget gate** (total JS / largest-chunk barrel-canary / WASM, `npm run budget:check`
in the CI build job), CI **perf regression canaries** (both engines; explicitly CI-class, not
device budgets), **accessibility re-audit** extended to the Babylon path — which caught and
fixed a real defect (Babylon stamps `tabindex="1"` on its canvas, hijacking tab order; now −1,
re-asserted post-boot), the **[cutover checklist](../validation-checklist/2026-07-19-pf09-b6-cutover-checklist.md)**,
the **[rollback runbook](../runbooks/2026-07-19-engine-cutover-rollback.md)**, and
**[ADR-0006](../adr/0006-babylon-default-cutover.md) (Proposed — gated)** making the flip a
one-line change + status change with evidence attached. Local E2E made **deterministic**
(workers 1 = CI; 70/70 twice — the TR-018 flake lineage closed). **Open before B6 completes:**
checklist §A (owner device pass — also discharges B2's and B5's conditions), §B3
billboard-memory disposition, then the flip + one release of legacy archival. 216 unit · 70 E2E.

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
