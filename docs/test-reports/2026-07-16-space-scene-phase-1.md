# Space Scene Phase 1 Test Report

**Date:** 2026-07-16  
**Phase:** 1 — licensed optimized ship asset  
**Status:** Passed — Phase 2 is unblocked.

## Scope delivered

- Added an immutable attribution record and a tested `CreditsPanel` component for the selected `Sci-Fi Aircraft | Spaceship Fighter` model by `valterjherson1`.
- Added a repeatable `scripts/optimize-ship.mjs` pipeline using glTF-Transform 4.4.1, WebP texture compression capped at 1024 px, Meshopt geometry compression, and a 2 MiB hard output limit.
- Generated `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb` from the ignored, licensed 43.52 MB source GLB.

## Test-first evidence

| Test                                | Red result                                                      | Green result                                                                      |
| ----------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| `tests/unit/space/credits.test.tsx` | Failed to resolve `CreditsPanel`, because it did not yet exist. | Passed after implementing the immutable credit record and accessible panel links. |

## Asset validation

| Check       | Result                                                                                                                                                       |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Source      | `resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb` — 43.52 MB, retained ignored with its supplied CC BY 4.0 license material.                      |
| Output      | `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb` — 441.85 KB / 0.42 MiB.                                                                           |
| Size gate   | Pass — below the 2 MiB maximum.                                                                                                                              |
| Geometry    | 21,375 uploaded vertices; `EXT_meshopt_compression` and `KHR_mesh_quantization` are required.                                                                |
| Textures    | Four 1024×1024 WebP textures using `EXT_texture_webp`; this limits decoded texture allocation to an estimated 22.36 MB instead of about 89.48 MB at 2048 px. |
| Attribution | Exact source, author, CC BY 4.0 URL, and modification note are represented in `src/content/spaceCredits.ts`.                                                 |

## Automated regression results

| Category                    | Command                                             | Result                                                                      |
| --------------------------- | --------------------------------------------------- | --------------------------------------------------------------------------- |
| Focused unit                | `npm run test -- tests/unit/space/credits.test.tsx` | Pass — 1 test.                                                              |
| Full lint gate              | `npm run lint`                                      | Pass — ESLint and Prettier pass.                                            |
| Type integration            | `npm run check`                                     | Pass — 0 errors; 1 existing `document.execCommand` deprecation hint.        |
| Full unit                   | `npm run test`                                      | Pass — 6 files, 27 tests. Existing jsdom Canvas notices remain non-failing. |
| Production build (flag off) | `npm run build`                                     | Pass.                                                                       |
| Production build (flag on)  | `PUBLIC_SPACE_SCENE=true npm run build`             | Pass.                                                                       |
| Full E2E                    | `npm run test:e2e -- --reporter=dot`                | Pass — 19 tests.                                                            |

The first full E2E attempt could not launch Playwright's expected Chromium binary after the dependency installation refreshed the local modules. `npm exec playwright install chromium` restored the matching browser, and the subsequent full E2E run passed.

## Manual regression

| Viewport / behavior | Result                                                                                                                                  |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop 1440×900    | Hero, navigation, Starfield, and CTAs render; `data-space-scene="false"`; no console errors.                                            |
| Tablet 768×1024     | Hero and fallback Starfield render without clipping or overlap; no console errors.                                                      |
| Mobile 390×844      | Compact navigation, hero copy, stacked CTAs, and fallback Starfield render correctly after fonts settle; no console errors.             |
| Keyboard            | Skip-to-content link was uniquely available and activated with Enter; no console errors.                                                |
| Reduced motion      | Phase 1 introduces no runtime scene motion, so current behavior is unchanged. Motion-specific regression remains mandatory for Phase 4. |

## Phase-gate decision

All mandatory quality checks pass. The optimized model is below the network-size cap, attribution is tested, and the fallback experience is unchanged. Phase 2 may begin.
