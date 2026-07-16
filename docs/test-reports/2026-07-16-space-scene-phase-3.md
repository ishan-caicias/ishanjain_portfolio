# Space Scene Phase 3 Regression Report

Date: 2026-07-16  
Scope: constellation-debris station navigation, reduced-motion parity, no-WebGL fallback, SSR hydration stability, and credits reachability.

## Automated evidence

| Check                                   | Result                                                                                                                                             |
| --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run lint`                          | PASS — ESLint and Prettier clean                                                                                                                   |
| `npm run check`                         | PASS — 0 errors; one existing `document.execCommand` deprecation hint in MissionControl                                                            |
| `npm run test`                          | PASS — 18 files, 81 tests                                                                                                                          |
| `npm run build`                         | PASS — rollback/default build                                                                                                                      |
| `PUBLIC_SPACE_SCENE=true npm run build` | PASS — feature-on build; existing Vite warning for the 652.64 kB SpaceScene chunk                                                                  |
| `npm run test:e2e:space-scene`          | PASS — 4 feature-on tests; 1 rollback-only test skipped by the feature flag                                                                        |
| `npm run test:e2e`                      | PASS — 19 tests; 4 feature-on rollout/integration tests skipped in the default rollback configuration; the existing accessibility/axe suite passed |

The feature-gated E2E wrapper now runs both the rollout and Phase 3 integration specs. The integration coverage verifies reduced-motion keyboard travel, arrival announcement, credits reachability, and no-WebGL semantic fallback with no starfield canvas.

Expected non-failing test stderr remains from existing Hubble fallback tests and jsdom's unimplemented canvas context in Starfield unit tests.

## Manual viewport regression

Using the feature-on development build with Playwright checks at 1440×900, 768×1024, and 390×844:

- Hero headline remained visible and three station buttons were present at every viewport.
- Keyboard focus reached a station control; activation retained focus on the selected station.
- With reduced motion enabled after hydration, Projects travel announced `Arrived at Projects.`, kept `data-warp-phase="idle"`, and retained focus on the station.
- With WebGL context creation forced to fail, the fallback panel was visible, all semantic station buttons remained available, and decorative starfield canvases were absent.
- The station layer is above decorative canvases while hero content remains the highest-priority readable layer; selected stations expose `aria-current` and a visible highlight.

## Acceptance notes

- Experience, Projects, and Contact map to their existing section IDs with unique accessible names.
- Normal travel uses smooth scrolling and aim → warp → idle timing; reduced motion uses immediate scrolling and no visual warp phases.
- Capability probing is deferred until after a stable SSR/client initial render, preventing hydration replacement when a browser lacks WebGL.
- Renderer construction/mount failure also switches to the semantic fallback.
- Footer exposes the existing `CreditsPanel` through the `#space-credits` disclosure.

## Follow-up

Phase 4 remains responsible for richer ship banking/thruster cinematics. The current Phase 3 station layer intentionally keeps those effects out of the accessibility and fallback paths.
