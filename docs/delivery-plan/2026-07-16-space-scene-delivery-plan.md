# Space Scene Delivery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current hero’s star-click interaction with an accessible, performant space-travel scene using a confirmed CC BY ship, while retaining the existing site as a tested rollback path.

**Architecture:** Keep the prototype’s custom WebGL renderer as the star-field authority. Mount it in a React island and add a small glTF-focused ship renderer beside it; only consider a full scene-graph rewrite if this hybrid proof fails explicit performance or integration limits. Astro remains responsible for the page shell and the rollout flag.

**Tech Stack:** Astro 5.17.x, React 19.2.x, TypeScript 5.9.x, the existing custom WebGL engine, Three.js plus `@gltf-transform/cli` and `meshoptimizer` after compatibility validation, Vitest, Playwright, axe-playwright.

---

## Release gates

| Phase | Outcome                       | Gate                                                                            |
| ----- | ----------------------------- | ------------------------------------------------------------------------------- |
| 0     | Baseline and feature flag     | Existing tests, type check, lint, and production build pass unchanged           |
| 1     | Licensed optimized ship asset | Attribution record exists; optimized glTF is 2 MB or less                       |
| 2     | Hybrid proof of concept       | Textured ship renders camera-relative without breaking the custom star renderer |
| 3     | Scene integration             | Travel, keyboard operation, reduced motion, and no-WebGL fallback work          |
| 4     | Realism pass                  | Thruster, inertia, and arrival cues meet desktop and mobile acceptance criteria |
| 5     | Release                       | Automated and manual quality gates pass; rollback is verified                   |

## File map

| Path                                              | Responsibility                                          |
| ------------------------------------------------- | ------------------------------------------------------- |
| `src/config/features.ts`                          | Safe-default rollout flag                               |
| `src/components/sections/Hero.astro`              | Selects existing or new hero                            |
| `src/components/islands/SpaceScene.tsx`           | React lifecycle, scene state, and custom-engine mount   |
| `src/components/islands/space/ShipRenderer.ts`    | glTF ship, camera-relative transform, and disposal      |
| `src/components/islands/space/shipMotion.ts`      | Testable camera-lag, banking, and thruster calculations |
| `src/components/islands/space/sceneEvents.ts`     | Typed `cosmos:*` event bridge                           |
| `src/content/spaceCredits.ts`                     | Immutable attribution data                              |
| `src/components/islands/space/CreditsPanel.tsx`   | Visible attribution panel                               |
| `public/space/ships/scifi-spaceship-star-gun.glb` | Approved optimized ship asset                           |
| `scripts/optimize-ship.mjs`                       | Repeatable asset conversion and optimization            |
| `tests/unit/space/`                               | Unit tests for attribution, event parsing, and motion   |
| `tests/e2e/space-scene.spec.ts`                   | E2E, accessibility, fallback, and reduced-motion checks |

### Task 1: Add a guarded rollout switch

**Files:** Create `src/config/features.ts`; modify `src/components/sections/Hero.astro` and `src/components/islands/Starfield.tsx`; create `tests/e2e/space-scene.spec.ts`.

- [ ] Write a failing Playwright test that visits `/` without `PUBLIC_SPACE_SCENE`, asserts `[data-testid='starfield']` is visible, and asserts `[data-testid='space-scene']` has count zero.
- [ ] Run `npm run build && npm run test:e2e -- tests/e2e/space-scene.spec.ts`; expect the test to fail because the stable starfield selector does not exist.
- [ ] Create `src/config/features.ts` with `export const features = { spaceScene: import.meta.env.PUBLIC_SPACE_SCENE === "true" } as const;`.
- [ ] Update `Hero.astro` so `features.spaceScene` renders `<SpaceScene client:load />` and the false branch retains `<Starfield client:load />`.
- [ ] Add `data-testid="starfield"` to the current canvas and reserve `data-testid="space-scene"` for the new island root.
- [ ] Re-run the focused E2E test; expect PASS. Commit with `feat: add guarded space scene rollout`.

### Task 2: Acquire, optimize, and credit the default ship

**Files:** Create `public/space/ships/scifi-spaceship-star-gun.glb`, `scripts/optimize-ship.mjs`, `src/content/spaceCredits.ts`, `src/components/islands/space/CreditsPanel.tsx`, and `tests/unit/space/credits.test.tsx`.

- [ ] Download only the confirmed `SCIFI SpaceShip Star Gun` asset and retain the downloaded license material with the source asset outside the web payload.
- [ ] Add an immutable credit record with title `SCIFI SpaceShip Star Gun`, author `hellatze`, the validated Sketchfab URL, CC BY 4.0 URL, and the exact modification note: “Converted to GLB and optimized for web delivery.”
- [ ] Write a failing React Testing Library test that asserts the panel renders the title, source link, CC BY 4.0 link, and modification note.
- [ ] Add `scripts/optimize-ship.mjs` to invoke `gltf-transform optimize` with WebP texture compression and Meshopt geometry compression from `assets/source/scifi-spaceship-star-gun.glb` to `public/space/ships/scifi-spaceship-star-gun.glb`.
- [ ] Run `node scripts/optimize-ship.mjs`; accept only output at or below 2 MB. If larger, reduce source texture resolution once and repeat the command.
- [ ] Implement `CreditsPanel` from the credit record, run `npm run test -- tests/unit/space/credits.test.tsx`, expect PASS, and commit with `feat: add credited optimized ship asset`.

### Task 3: Build and validate the hybrid ship proof of concept

**Files:** Create `src/components/islands/SpaceScene.tsx`, `src/components/islands/space/ShipRenderer.ts`, `src/components/islands/space/sceneEvents.ts`, and `tests/unit/space/sceneEvents.test.ts`.

- [ ] Add `WarpPhase` as the literal union `"aim" | "warp" | "flip" | "decel" | "idle"`, and add `readWarpEvent(event)` that returns `null` unless `detail.phase` is a string and `detail.t` is a number.
- [ ] Write a failing unit test with `new CustomEvent("cosmos:warp", { detail: { phase: "warp" } })`; it must return `null` because timing data is absent.
- [ ] Run `npm run test -- tests/unit/space/sceneEvents.test.ts`; expect FAIL before the bridge is exported, then PASS after implementation.
- [ ] Implement `ShipRenderer` so its transform is camera-relative: forward offset `3.2`, upward offset `-0.7`, and a base pitch of `-0.08` radians. It must dispose all loaded geometry, material, texture, renderer, and canvas resources.
- [ ] Mount the custom WebGL star engine and a ship-only canvas overlay in `SpaceScene`; the overlay must use `pointer-events: none` so existing star and station interaction remains functional.
- [ ] Run `PUBLIC_SPACE_SCENE=true npm run dev`; verify free-look and warp preserve star interaction while the ship stays camera-relative. Run `npm run build`; expect PASS. Commit with `feat: render gltf ship alongside custom space engine`.

### Task 4: Add mass cues and real thruster phases

**Files:** Create `src/components/islands/space/shipMotion.ts` and `tests/unit/space/shipMotion.test.ts`; modify `src/components/islands/space/ShipRenderer.ts`.

- [ ] Write a failing unit test proving a one-frame response from bank `0` to target `0.8` is greater than `0` and less than `0.8`.
- [ ] Write a failing unit test proving the `warp` plume value is greater than the `idle` plume value.
- [ ] Implement `nextShipMotion(state, targetBank, dt, phase)` with a critically damped response: acceleration is `28 * (targetBank - bank) - 10.6 * bankVelocity`; update velocity and bank using `dt`.
- [ ] Map plume values deterministically: `warp=1`, `decel=0.8`, `aim=0.45`, and `idle=0.25`.
- [ ] Apply bank to the ship transform and plume to emissive/nozzle intensity. Run `npm run test -- tests/unit/space/shipMotion.test.ts`; expect PASS.
- [ ] At 1440×900 and 390×844, verify a route change shows bounded bank lag and that warp/deceleration visibly exceed idle thrust. With reduced motion enabled, disable interpolation and use idle intensity. Commit with `feat: add inertial ship motion and thruster phases`.

### Task 5: Complete interaction, accessibility, and fallback parity

**Files:** Modify `src/components/islands/SpaceScene.tsx`, `src/components/islands/space/CreditsPanel.tsx`, `src/components/layout/Footer.astro`, and `tests/e2e/space-scene.spec.ts`.

- [ ] Write a failing E2E test that emulates reduced motion, visits the flag-on scene, activates the Projects station via Enter, observes arrival confirmation, and asserts `data-reduced-motion="true"` on the island root.
- [ ] Implement each station as a semantic button with a unique accessible name such as “Travel to Projects station.”
- [ ] Announce changes with a visually hidden `aria-live="polite"` element that renders the current travel state.
- [ ] When WebGL initialization fails, render the section-navigation and content fallback rather than an empty canvas. Make the credits panel reachable from the footer.
- [ ] Run `npm run build && npm run test:e2e -- tests/e2e/space-scene.spec.ts`; expect PASS and no axe violations in scene, credits, or fallback paths. Commit with `feat: make space scene accessible and attributable`.

### Task 6: Make the release decision from measured evidence

**Files:** Modify `README.md`, `docs/analysis/2026-07-16-rendering-stack-options.md`, and `docs/analysis/2026-07-16-validation-record.md`.

- [ ] Run `PUBLIC_SPACE_SCENE=true npm run build`; expect a successful build. Record the GLB size and hero’s initial network payload in the validation record.
- [ ] Run `npm run lint && npm run check && npm run test && npm run build && npm run test:e2e`; expect every command to exit zero.
- [ ] Manually verify Chrome, Safari, and a 390×844 Chromium viewport; test WebGL context loss/recovery, no-WebGL fallback, keyboard travel, reduced motion, and credit text against the downloaded asset license.
- [ ] Set `PUBLIC_SPACE_SCENE=false` and verify the old hero renders; this is the release rollback test.
- [ ] Keep the hybrid path only if the GLB is 2 MB or less, the initial hero payload is 10 MB or less, the agreed mid-tier mobile test device sustains 50+ FPS, and all quality checks pass. If any limit remains missed after one texture-resolution reduction, keep the optimized OBJ/wireframe ship and schedule a separate React Three Fiber evaluation; do not start a framework migration in this delivery.
- [ ] Commit the evidence and documentation with `docs: record space scene release validation`.

## Rollback

Set `PUBLIC_SPACE_SCENE=false` to restore `Starfield` without deleting scene code or assets. Do not remove `Starfield.tsx` or `StarModal.tsx` until the flag-on version completes one release cycle with no critical accessibility, performance, or WebGL-recovery regression.

## Plan self-review

- Verified asset selection and attribution map to Task 2.
- World-space staging maps to Task 3; inertia and thrust map to Task 4.
- Overlay dominance, keyboard operation, reduced motion, and fallback map to Task 5.
- Toolchain scope, performance constraints, release proof, and rollback map to Task 6.
- No unverified Sketchfab model is selected; the plan uses the confirmed `SCIFI SpaceShip Star Gun` default.
