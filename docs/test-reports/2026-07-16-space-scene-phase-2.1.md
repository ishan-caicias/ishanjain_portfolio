# Space Scene Phase 2.1 Regression Report

**Date:** 2026-07-16
**Phase:** 2.1 — Adaptive 1K/2K ship quality
**Result:** Passed

## Delivered behavior

- The 1K and 2K WebP/Meshopt ship assets are named explicitly and selected once per page load.
- Auto mode honours data saver and known low memory, then uses a bounded GPU benchmark classification. A benchmark result at tier 2 or 3 selects 2K even on a narrow flagship phone; tier 0 or 1 selects 1K.
- Classification is limited to 500 ms, uses a detached WebGL probe that is released in all completion paths, and uses self-hosted benchmark data. Only successful benchmark classifications are cached for 30 days; fallbacks are not cached.
- Visitors can save `Auto`, `High quality`, or `Data saver`. A selection announces that it applies on the next page load, deliberately avoiding a second model download or visual swap during the current visit.
- A failed 2K load retries the 1K asset exactly once. Raw GPU strings, user agents, DPR, and hardware-concurrency values are not stored or used as quality policy inputs.

## Automated regression

| Check                    | Command                                           | Result                                                                                                        |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Lint and formatting      | `npm run lint`                                    | Passed — ESLint clean and all matched files formatted.                                                        |
| Type/integration check   | `npm run check`                                   | Passed — 0 errors, 0 warnings; one existing `document.execCommand` deprecation hint in `MissionControl.tsx`.  |
| Unit tests               | `npm run test`                                    | Passed — 12 files, 58 tests. Existing expected fallback/jsdom diagnostics were printed without test failures. |
| Default production build | `npm run build`                                   | Passed.                                                                                                       |
| Flag-on production build | `$env:PUBLIC_SPACE_SCENE = 'true'; npm run build` | Passed. The existing client chunk warning remains: `SpaceScene` is 647.58 kB minified / 168.56 kB gzip.       |
| Default E2E              | `npm run test:e2e`                                | Passed — 19 passed, 2 expected feature-flag skips.                                                            |
| Flag-on E2E              | `npm run test:e2e:space-scene`                    | Passed — 2 passed, 1 expected rollback-path skip.                                                             |
| Asset inspection         | `npx gltf-transform inspect` for both named GLBs  | Passed — both use `EXT_meshopt_compression` and `EXT_texture_webp`, with 21,375 uploaded vertices.            |

## Asset budget

| Asset                                      | Compressed transfer | Texture ceiling | Estimated decoded texture allocation |
| ------------------------------------------ | ------------------: | --------------: | -----------------------------------: |
| `sci-fi-aircraft-spaceship-fighter-1k.glb` |            0.42 MiB |         1024 px |                         about 22 MiB |
| `sci-fi-aircraft-spaceship-fighter-2k.glb` |            0.86 MiB |         2048 px |                         about 90 MiB |

## Manual regression

Manual checks used the flag-on local build with no console errors.

| Viewport          | Checks                                                                          | Observation                                                                                                                                           |
| ----------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Desktop           | Auto selection, native quality control, change announcement, no in-session swap | Auto reached `ready` with the 2K asset. Choosing Data saver announced the next-load policy while the active 2K model remained ready.                  |
| Tablet — 768×1024 | Persisted High quality choice                                                   | The control saved High quality; after reload, the 2K asset reached `ready`.                                                                           |
| Mobile — 390×844  | Explicit High quality and Data saver choices, hero legibility                   | High quality reached `ready` without obscuring the hero title. Data saver announced the next-load policy; after reload, the 1K asset reached `ready`. |

The quality control is a labelled native select and is keyboard-operable. Full accessibility E2E, including keyboard accessibility coverage, passed in the default suite.

## Review record

- Specification review: approved after verifying assets, policy, preference persistence, retry behavior, and detector fallbacks.
- Code-quality review: approved after adding blocked-storage handling, next-load-only switching, detached probe release, self-hosted abortable benchmark loading, and non-benchmark viewport fallback coverage.

## Known follow-up

- The flag-on `SpaceScene` JavaScript chunk remains above Vite's 500 kB warning threshold. This was already identified for the later release/performance phase; the adaptive-quality work does not add a continuous render loop.
