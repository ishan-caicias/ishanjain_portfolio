# Space Scene Phase 2 Test Report

**Date:** 2026-07-16  
**Phase:** 2 — hybrid ship proof of concept  
**Status:** Passed — Phase 3 is unblocked.

## Scope delivered

- Added a flag-gated `SpaceScene` island that keeps the proven Starfield active beneath a ship-only WebGL overlay.
- Added a Three.js `ShipRenderer` with GLTFLoader and MeshoptDecoder support for the optimized ship GLB, a capped device-pixel ratio, on-demand rendering, explicit resource disposal, and camera-relative placement.
- Added the typed `cosmos:warp` bridge with the exact five valid phases; it validates event detail without introducing Phase 3 travel controls.
- Added a dedicated, cross-platform flag-on E2E gate and CI step. It builds under `PUBLIC_SPACE_SCENE=true`, disallows reuse of a stale local server, requires a ready ship, and asserts no uncaught page errors.

## Test-first and review evidence

| Behaviour                                     | Red result                                              | Green result                                                                                 |
| --------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `readWarpEvent()` rejects a missing timestamp | Module did not exist.                                   | 3 event-parser tests pass.                                                                   |
| Hybrid island layering                        | `SpaceScene` did not exist.                             | Starfield, overlay mount, lifecycle, failure, and event-cleanup tests pass.                  |
| Static renderer lifecycle                     | Test observed an unwanted `requestAnimationFrame` call. | Renderer draws only on initialization, model load, and resize; lifecycle cleanup tests pass. |
| Flag-on rollout                               | Test initially served a false-built `dist`.             | Flag-aware server build and dedicated gate pass with exact `ready` status.                   |
| Portrait framing                              | `getResponsiveShipScale` did not exist.                 | Portrait model-load and subsequent desktop resize both apply the expected scale.             |

An independent specification review and two code-quality review cycles approved the implementation. The final review also verified the mobile scale is exercised through the real GLTF-load and ResizeObserver paths.

## Performance and texture policy

| Measure                | Result                                                                                                                                                                                      |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime GLB            | 0.42 MiB; four 1024×1024 WebP textures, Meshopt geometry.                                                                                                                                   |
| Source textures        | Four ignored 4096×4096 PNG textures; retained only as conversion input.                                                                                                                     |
| Runtime texture policy | 1024 px WebP is the deliberate single quality tier for all devices. A 4K/adaptive tier is out of scope pending separate network, GPU-memory, and acceptance-budget work.                    |
| Ship render loop       | On-demand only; no perpetual animation frame while Phase 2 ship motion is static.                                                                                                           |
| Client chunk           | `SpaceScene` is 635.71 kB minified / 163.53 kB gzip. Vite emits its standard over-500 kB warning; the scene is flag-gated and the figure is recorded for later Phase 6 payload measurement. |

## Automated regression results

| Category                   | Command                                 | Result                                                                                                            |
| -------------------------- | --------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Full lint                  | `npm run lint`                          | Pass — ESLint and Prettier pass.                                                                                  |
| Type integration           | `npm run check`                         | Pass — no errors; the existing `document.execCommand` deprecation hint remains.                                   |
| Full unit                  | `npm run test`                          | Pass — 10 files, 40 tests. Existing jsdom Canvas notices and intentional Hubble fallback logs remain non-failing. |
| Production build, flag off | `npm run build`                         | Pass.                                                                                                             |
| Production build, flag on  | `PUBLIC_SPACE_SCENE=true npm run build` | Pass; records the Vite chunk-size warning above.                                                                  |
| Default E2E rollback       | `npm run test:e2e -- --reporter=dot`    | Pass — `test-results/.last-run.json` recorded no failed tests.                                                    |
| Dedicated flag-on E2E      | `npm run test:e2e:space-scene`          | Pass — clean flag-on build/preview; `test-results/.last-run.json` recorded no failed tests.                       |

## Manual regression

| Viewport / behaviour | Result                                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop 1440×900     | Flag is `true`; Starfield and ready ship render with no console errors.                                                                               |
| Tablet 768×1024      | Ready ship and Starfield render without overlap or console errors.                                                                                    |
| Mobile 390×844       | Responsive ship scale reduces from 0.6 to about 0.301; the fully visible ship no longer spans the CTA area, and CTA legibility is retained.           |
| Keyboard             | Skip-to-content link is uniquely available and activated with Enter; no console errors.                                                               |
| Existing star input  | Ship overlay computes `pointer-events: none`; the Starfield remains visible beneath it and default Star interaction E2E passes.                       |
| Reduced motion       | Phase 2 adds no ship motion. The existing Starfield behavior remains unchanged; Phase 4 must add and test the scene-specific reduced-motion behavior. |

## Phase-gate decision

All mandatory Phase 2 gates pass. The flag-on hybrid proof renders a ready, camera-relative ship while retaining the interactive Starfield and the flag-off rollback route. Phase 3 may begin.
