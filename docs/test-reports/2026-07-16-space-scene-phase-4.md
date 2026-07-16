# Space Scene Phase 4 Regression Report

Date: 2026-07-16  
Scope: inertial ship banking, phase-driven thruster/emissive cues, reduced-motion behavior, renderer lifecycle, and travel-phase synchronization.

## Automated evidence

| Check                                   | Result                                                                               |
| --------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run test`                          | PASS — 19 files, 87 tests                                                            |
| `npm run lint`                          | PASS — ESLint and Prettier clean                                                     |
| `npm run check`                         | PASS — 0 errors; one existing MissionControl `document.execCommand` deprecation hint |
| `npm run build`                         | PASS — rollback/default build                                                        |
| `PUBLIC_SPACE_SCENE=true npm run build` | PASS — feature-on build; existing Vite warning for the 655.70 kB SpaceScene chunk    |
| `npm run test:e2e`                      | PASS — 19 tests; 4 feature-on tests skipped in the default rollback configuration    |
| `npm run test:e2e:space-scene`          | PASS — 4 feature-on tests; 1 rollback-only test skipped by the feature flag          |

Expected non-failing stderr remains from existing Hubble fallback tests and jsdom's unimplemented canvas context in Starfield unit tests.

## Manual viewport regression

A feature-on development build was exercised at 1440×900, 768×1024, and 390×844 with Playwright browser checks:

- Three station controls and the hero headline were present at all three viewports.
- After hydration, activating Projects produced `data-warp-phase` values `aim`, `warp`, then `idle` at each viewport.
- Keyboard focus remained on the selected Projects station after activation.
- Reduced-motion mode announced `Arrived at Projects.` and held `data-warp-phase="idle"`; no interpolation frames were scheduled.
- Forced WebGL failure retained the semantic station fallback and removed decorative canvases, as covered by the feature-on E2E suite.

## Acceptance notes

- `nextShipMotion` uses the specified critically damped coefficients (`28` and `10.6`) and clamps invalid/out-of-range values.
- Plume mappings are deterministic: warp `1`, decel `0.8`, aim `0.45`, idle `0.25`.
- `ShipRenderer` applies bounded local Z-axis bank while preserving the existing X-axis base pitch and camera-relative framing.
- RAF scheduling starts only for active normal-motion phases and is cancelled on disposal, failure, or reduced-motion transitions.
- Existing high-to-low asset retry, no-WebGL fallback, credits, pointer-event, and renderer disposal behavior remain covered by the prior phase suites.

## Follow-up

Phase 5 remains the release gate for measured payload/FPS evidence, browser matrix verification, and rollback sign-off.
