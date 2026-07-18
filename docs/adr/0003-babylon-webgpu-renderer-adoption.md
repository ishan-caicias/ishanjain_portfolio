# ADR 0003 — Adopt Babylon.js + WebGPU as the Renderer (Conditional)

**Date:** 2026-07-18
**Status:** Accepted — **conditional**. Supersedes [ADR-0002](0002-in-engine-glb-ship-renderer.md)'s
zero-runtime-3D-dependency stance for the renderer layer **only as far as desktop evidence
supports**; the current WebGL1 engine remains the shipping default until the mobile condition
below is discharged.
**Context:** PF-09 [B0](../test-reports/TR-027.md) / [B1](../test-reports/TR-028.md) spike,
[WGSL + point-sprite finding](../test-reports/TR-029.md),
[gate instrument corrections](../test-reports/TR-032.md) & [TR-033](../test-reports/TR-033.md),
[gate measurement record](../validation-checklist/2026-07-18-pf09-b1-gate-measurement.md).

## Decision

**Proceed to B2 (cinematic flight port) on Babylon.js + WebGPU.** Babylon becomes the _development_
target for the renderer; it does **not** become the default engine, and the current engine is not
retired, until the mobile performance condition is measured on real hardware.

## What the evidence actually supports

| Dimension                | Evidence                                                             | Verdict           |
| ------------------------ | -------------------------------------------------------------------- | ----------------- |
| Bundle (Babylon, gz)     | **329 KB** tree-shaken, CI-measured (from 1.1 MB barrel)             | ✅ GO (≤ ~900 KB) |
| Default-path regression  | **260 KB gz unchanged** — Babylon is fully lazy behind `?engine=`    | ✅ GO             |
| Desktop render fps       | Babylon **140** vs current **142** (budget 60) — parity, 2.3× budget | ✅ GO             |
| Desktop startup          | Babylon **1070 ms** vs current **1357 ms** — Babylon _faster_        | ✅ GO             |
| Functional correctness   | 168,959-star field draws; 92 unit / 52 E2E green incl. pixel proof   | ✅ GO             |
| **Mobile fps / startup** | **UNMEASURED** — no physical iPhone or Android available             | ⚠️ **OPEN**       |
| WebGPU on real hardware  | Probable on desktop but **unconfirmed** (see condition 2)            | ⚠️ **OPEN**       |

Desktop rows are from real hardware (Windows, 16 cores) and are the basis of this decision.

## Why "conditional" and not a plain GO

The iPhone and Android rows in the gate record were taken with **Chrome DevTools device
emulation**, confirmed by the owner. Emulation changes viewport and user-agent but continues to
run on the desktop GPU at desktop refresh — which is why those rows reported 135–144 fps, above
any iPhone panel's 120 Hz ceiling. They are therefore **not** performance measurements.

What emulation _did_ validate is real and worth keeping: the scene mounts, renders and behaves
correctly at phone viewports with no errors. That is a functional/layout result, not a perf one,
and it is recorded as such.

A plain GO would assert that Babylon meets its mobile budgets. Nothing measured supports that
claim, and mobile is precisely where a 330 KB engine, ~23 MB of billboard vertex data and a
168k-star field are most likely to fail. Recording an unmeasured dimension as passed would
convert a known unknown into a false certainty.

## Conditions to discharge before Babylon becomes the default (B5/B6)

1. **Real-device mobile measurement.** At minimum one physical Android (Chrome remote debugging via
   `chrome://inspect` is free and sufficient) and ideally one iPhone. `RENDER FPS` must meet
   ≥ 40 (mid Android) / 60 (iPhone) with `renderFrames` advancing and the overlay's device line
   showing genuine phone hardware. Cloud device labs (BrowserStack et al.) are an acceptable
   substitute.
2. **Confirm the WebGPU backend actually ran.** The gate table's `Backend` column was pre-filled
   from the template, not observed. Read the on-canvas badge: `BABYLON WEBGPU · …` confirms the
   WGSL twin executed on real hardware for the first time (a genuine de-risking); `WEBGL2` means
   the WGSL path is still unproven and the fps figure is a WebGL2 number.
3. **Billboard memory reduction** (~23 MB vs the live engine's ~2.7 MB) — matrix-backed thin
   instances or a compute-driven path — before shipping to memory-constrained phones.

If condition 1 fails on real hardware, this ADR is revisited: the current engine stays default and
we cherry-pick isolated Babylon upgrades rather than completing the migration. That path remains
cheap because the dual-engine seam (B0) keeps both renderers live behind one flag.

## Consequences

- **Accepted:** ADR-0002's "zero runtime 3D dependencies" no longer holds for the renderer layer.
  `@babylonjs/core` (MIT, US-jurisdiction) is a runtime dependency, reaching the client only via a
  lazy chunk on `?engine=babylon`.
- **Accepted:** the PF-07 "shell Δ ≤ +50 KB" byte budget is retired in favour of the per-device
  performance budgets in the [PF-09 plan](../delivery-plan/PF-09-babylon-havok-realism.md).
- **Preserved:** the custom engine's differentiating work (168k-star streaming, photometric and
  relativistic shaders, catalog picking) is _ported_, never discarded — and WebGPU's lack of
  `gl_PointSize` means the star technique itself must change (TR-029), which is now the largest
  single item in B2's estimate.
- **Preserved:** the current engine remains default and fully supported throughout B2–B5, so the
  live site carries no risk from this decision.
- **Risk carried forward:** mobile performance is unknown. It is tracked as the primary open risk
  on PF-09 and gates the B6 cutover, not B2 development.

## Alternatives considered

- **Plain GO on emulated data** — rejected: asserts an unmeasured claim.
- **Block B2 until hardware is available** — rejected: the owner has no iPhone, desktop evidence is
  genuinely strong (parity fps, better startup, bundle well under budget), and the dual-engine seam
  makes proceeding reversible at near-zero cost.
- **Abandon the migration** — rejected: no measured evidence against Babylon; the only failing
  dimension is unmeasured, not failed.
