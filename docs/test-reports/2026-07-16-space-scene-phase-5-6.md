# Space Scene Phases 5–6 Release Report

Date: 2026-07-16  
Scope: release quality gates, measured payloads, rollback verification, browser
regression, documentation, and rendering-stack decision.

## Automated evidence

| Command                                 | Result                                                                                          |
| --------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `npm run lint`                          | PASS — ESLint and Prettier checks completed successfully.                                       |
| `npm run check`                         | PASS — 0 errors; one existing MissionControl `document.execCommand` deprecation hint remains.   |
| `npm run test`                          | PASS — 19 files, 87 tests.                                                                      |
| `npm run build`                         | PASS — default/rollback production build.                                                       |
| `PUBLIC_SPACE_SCENE=true npm run build` | PASS — feature-on production build; existing Vite warning for the 655.70 kB `SpaceScene` chunk. |
| `npm run test:e2e`                      | PASS — 19 tests passed; 4 feature-on tests skipped because the default flag is off.             |
| `npm run test:e2e:space-scene`          | PASS — 4 feature-on tests passed; 1 rollback-only test skipped by the feature-on flag.          |

The E2E suites were run against Playwright Chromium. Existing Hubble fallback
stderr and jsdom's unimplemented canvas-context message are expected and
non-blocking.

## Delivery measurements

- 1K runtime GLB: `441,852` bytes (`0.42 MiB`).
- 2K runtime GLB: `896,768` bytes (`0.85 MiB`).
- Both assets retain the uploaded geometry and use WebP textures plus Meshopt
  compression.
- Feature-on preview initial shell network capture: `943,634` bytes
  (`0.900 MiB`) across document, scripts, styles, fonts, and images,
  excluding the separately fetched GLB.
- The largest GLB and initial shell are below the delivery budgets of 2 MiB
  and 10 MiB respectively.

## Manual regression

Feature-on Playwright Chromium checks covered:

- **1440×900:** hero headline, all three constellation-debris stations, ship,
  quality selector, travel phases, and footer credits were present without
  overlap.
- **768×1024:** station controls remained reachable and readable; travel and
  adaptive quality selection completed.
- **390×844:** the compact ordered station list remained usable; hero CTAs and
  focus targets stayed visible.
- Normal travel produced `aim → warp → idle`; selected-station focus was
  retained and arrival was announced.
- Reduced motion announced arrival, used immediate scrolling, and held the
  `idle` phase without interpolated animation.
- Forced WebGL/renderer failure removed decorative canvases while retaining
  semantic station links and section navigation.
- The footer Space credits disclosure exposed the title, author, source URL,
  CC BY 4.0 link, and conversion/optimization note.
- `PUBLIC_SPACE_SCENE=false` restored the original Starfield hero and removed
  the scene island.

## Release decision

Keep the Astro 5 + custom starfield + Three.js ship-focused hybrid (validated
Option B). It satisfies the measured asset and payload budgets and passes all
available automated, accessibility, fallback, and viewport checks. The
feature flag remains the rollback control for the first release cycle.

## Known warnings and blockers

- The feature-on build reports a Vite chunk-size warning for the 655.70 kB
  `SpaceScene` chunk; it is non-failing and should be monitored for future
  code-splitting work.
- Safari physical-device validation was not available in this Windows
  environment.
- Sustained 50+ FPS on an agreed mid-tier Android/iOS handset was not measured
  here. Treat that as a follow-up performance validation, not as a claim made
  by this report.
- WebGL context-loss recovery is covered by renderer-failure/fallback behavior;
  a physical context-loss gesture on Safari remains part of the follow-up
  device matrix.
