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
| 2.1   | Adaptive asset quality        | 1K/2K policy is GPU-tier aware, accessible, and fully regression-tested         |
| 3     | Scene integration             | Travel, keyboard operation, reduced motion, and no-WebGL fallback work          |
| 4     | Realism pass                  | Thruster, inertia, and arrival cues meet desktop and mobile acceptance criteria |
| 5     | Release                       | Automated and manual quality gates pass; rollback is verified                   |

## Mandatory regression guardrail

No delivery phase may be marked complete or used as the baseline for the next phase until all of the following checks are run against that phase's code and recorded in `docs/test-reports/YYYY-MM-DD-space-scene-phase-<N>.md`:

1. Unit tests: run the full `npm run test` suite, including the new behavior tests introduced in the phase.
2. Integration checks: run `npm run check` and a production build with every flag state introduced by the phase.
3. E2E tests: run the complete `npm run test:e2e` suite, including the phase-specific browser test.
4. Manual regression: verify the phase's user-visible behavior at desktop (1440×900), tablet (768×1024), and mobile (390×844) viewports, plus keyboard and reduced-motion behavior when relevant.

The report must state the exact commands, pass/fail results, browser and viewport coverage, manual observations, and any known blocker. A failed check blocks the next phase; it must be fixed or explicitly removed from scope through a delivery-plan update.

## File map

| Path                                                       | Responsibility                                          |
| ---------------------------------------------------------- | ------------------------------------------------------- |
| `src/config/features.ts`                                   | Safe-default rollout flag                               |
| `src/components/sections/Hero.astro`                       | Selects existing or new hero                            |
| `src/components/islands/SpaceScene.tsx`                    | React lifecycle, scene state, and custom-engine mount   |
| `src/components/islands/space/ShipRenderer.ts`             | glTF ship, camera-relative transform, and disposal      |
| `src/components/islands/space/shipMotion.ts`               | Testable camera-lag, banking, and thruster calculations |
| `src/components/islands/space/sceneEvents.ts`              | Typed `cosmos:*` event bridge                           |
| `src/content/spaceCredits.ts`                              | Immutable attribution data                              |
| `src/components/islands/space/CreditsPanel.tsx`            | Visible attribution panel                               |
| `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb` | Approved optimized ship asset                           |
| `scripts/optimize-ship.mjs`                                | Repeatable asset conversion and optimization            |
| `tests/unit/space/`                                        | Unit tests for attribution, event parsing, and motion   |
| `tests/e2e/space-scene.spec.ts`                            | E2E, accessibility, fallback, and reduced-motion checks |

### Task 1: Add a guarded rollout switch

**Files:** Create `src/config/features.ts`; modify `src/components/sections/Hero.astro` and `src/components/islands/Starfield.tsx`; create `tests/e2e/space-scene.spec.ts`.

- [x] Write a failing Playwright test that visits `/` without `PUBLIC_SPACE_SCENE`, asserts `[data-testid='starfield']` is visible, and asserts `[data-testid='space-scene']` has count zero.
- [x] Run `npm run build && npm run test:e2e -- tests/e2e/space-scene-rollout.spec.ts`; confirm it fails because the stable hero flag attribute and starfield selector do not exist.
- [x] Create `src/config/features.ts` with `isSpaceSceneEnabled()` and the safe-default `features.spaceScene` value.
- [x] Update `Hero.astro` to expose `data-space-scene={String(features.spaceScene)}` while retaining `<Starfield client:load />` for both flag states. Do not import `SpaceScene` until Task 3 creates it; Task 3 will replace this temporary safe fallback with the guarded branch.
- [x] Add `data-testid="starfield"` to the current canvas and reserve `data-testid="space-scene"` for the new island root.
- [x] Re-run the focused E2E test; it passes. `docs/test-reports/2026-07-16-space-scene-phase-0.md` records that all mandatory Phase 0 quality gates pass.

### Task 2: Acquire, optimize, and credit the default ship

**Files:** Create `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb`, `scripts/optimize-ship.mjs`, `src/content/spaceCredits.ts`, `src/components/islands/space/CreditsPanel.tsx`, and `tests/unit/space/credits.test.tsx`.

- [x] Use the selected `Sci-Fi Aircraft | Spaceship Fighter` source asset. Use `resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb` as the conversion input because GLB packages the scene and its textures into one browser-friendly source file; keep it ignored by Git with the supplied license material.
- [x] Add an immutable credit record with title `Sci-Fi Aircraft | Spaceship Fighter`, author `valterjherson1`, the validated Sketchfab URL, CC BY 4.0 URL, and the exact modification note: “Converted to GLB and optimized for web delivery.”
- [x] Write a failing React Testing Library test that asserts the panel renders the title, source link, CC BY 4.0 link, and modification note.
- [x] Add `scripts/optimize-ship.mjs` to invoke `gltf-transform optimize` with 1024 px WebP texture compression and Meshopt geometry compression from `resources/spaceship/sci-fi_aircraft__spaceship_fighter.glb` to `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb`.
- [x] Run `node scripts/optimize-ship.mjs`; output is 0.42 MiB and passes the 2 MiB limit. The 1024 px texture ceiling keeps the estimated decoded texture allocation appropriate for mobile browser delivery.
- **Texture policy:** The ignored source asset retains its original 4K textures only as conversion material. The shipped GLB intentionally uses a single 1024 px WebP texture cap for every device; any capability-based high-quality tier requires a separately budgeted follow-up and must not be added to this delivery.
- [x] Implement `CreditsPanel` from the credit record and run `npm run test -- tests/unit/space/credits.test.tsx`; the test passes. Full Phase 1 quality evidence is recorded in `docs/test-reports/2026-07-16-space-scene-phase-1.md`.

### Task 3: Build and validate the hybrid ship proof of concept

**Files:** Create `src/components/islands/SpaceScene.tsx`, `src/components/islands/space/ShipRenderer.ts`, `src/components/islands/space/sceneEvents.ts`, and `tests/unit/space/sceneEvents.test.ts`.

- [x] Add `WarpPhase` as the literal union `"aim" | "warp" | "flip" | "decel" | "idle"`, and add `readWarpEvent(event)` that returns `null` unless `detail.phase` is a string and `detail.t` is a number.
- [x] Write a failing unit test with `new CustomEvent("cosmos:warp", { detail: { phase: "warp" } })`; it returns `null` because timing data is absent.
- [x] Run `npm run test -- tests/unit/space/sceneEvents.test.ts`; observe the expected missing-module failure, then PASS after implementation.
- [x] Implement `ShipRenderer` with camera-relative forward offset `3.2`, upward offset `-0.7`, and base pitch `-0.08` radians. It disposes loaded geometry, material textures, renderer, context, canvas, and observers. Responsive portrait scaling retains the required offsets while preserving CTA legibility.
- [x] Mount Starfield and a ship-only canvas overlay in `SpaceScene`; the overlay computes `pointer-events: none`, preserving existing Starfield input. The renderer is intentionally static and on-demand until the later motion phase.
- [x] Run flag-on build and dedicated flag-on E2E/manual regression. The existing Starfield has no free-look or warp controls to preserve at this phase; the validated event bridge is reserved for later interaction work. Full Phase 2 evidence is recorded in `docs/test-reports/2026-07-16-space-scene-phase-2.md`.

### Task 3.1: Deliver adaptive 1K/2K ship quality

**Files:** Create `src/components/islands/space/shipQuality.ts`, `src/components/islands/space/shipQualityDetection.ts`, and `tests/unit/space/shipQuality.test.ts`; modify `package.json`, `package-lock.json`, `scripts/optimize-ship.mjs`, `src/components/islands/SpaceScene.tsx`, `src/components/islands/space/ShipRenderer.ts`, `tests/unit/SpaceScene.test.tsx`, `tests/unit/space/shipRendererLifecycle.test.ts`, and `tests/e2e/space-scene-rollout.spec.ts`; create `public/space/ships/sci-fi-aircraft-spaceship-fighter-1k.glb` and `public/space/ships/sci-fi-aircraft-spaceship-fighter-2k.glb`; remove the superseded unqualified GLB.

- [x] **Step 1: Write the failing selector tests.**

```ts
expect(
  selectShipQuality({
    preference: "auto",
    saveData: false,
    isNarrowViewport: true,
    gpuTier: 3,
  }),
).toBe("high");
expect(
  selectShipQuality({
    preference: "auto",
    saveData: false,
    isNarrowViewport: false,
    gpuTier: 1,
  }),
).toBe("low");
expect(
  selectShipQuality({
    preference: "auto",
    saveData: true,
    isNarrowViewport: false,
  }),
).toBe("low");
expect(
  selectShipQuality({
    preference: "high",
    saveData: true,
    isNarrowViewport: true,
  }),
).toBe("high");
```

- [x] **Step 2: Run `npm run test -- tests/unit/space/shipQuality.test.ts`; confirm it fails because `shipQuality.ts` does not exist.**

- [x] **Step 3: Implement the pure quality policy and preference persistence.**

```ts
export const shipAssets = {
  low: {
    quality: "low",
    url: "/space/ships/sci-fi-aircraft-spaceship-fighter-1k.glb",
  },
  high: {
    quality: "high",
    url: "/space/ships/sci-fi-aircraft-spaceship-fighter-2k.glb",
  },
} as const;

export function selectShipQuality(input: ShipQualityInput): ShipQuality {
  if (input.preference === "high") return "high";
  if (
    input.preference === "data-saver" ||
    input.saveData ||
    (input.deviceMemory !== undefined && input.deviceMemory < 4)
  )
    return "low";
  if (input.gpuTier !== undefined) return input.gpuTier >= 2 ? "high" : "low";
  return input.isNarrowViewport ? "low" : "high";
}
```

- [x] **Step 4: Run the focused selector tests and confirm PASS.**

- [x] **Step 5: Add `@pmndrs/detect-gpu`, then write failing browser-adapter tests for an automatic tier-3 high decision, a 500 ms timeout fallback, and a valid 30-day cache.**

```bash
npm install @pmndrs/detect-gpu
npm run test -- tests/unit/space/shipQuality.test.ts
```

- [x] **Step 6: Implement `detectShipQuality()` with `getGPUTier()`, `Promise.race()` against 500 ms, `matchMedia("(min-width: 768px)")`, `navigator.connection?.saveData`, optional `navigator.deviceMemory`, and expiry-based local-storage caching. Do not store the detected GPU string. Re-run focused tests and confirm PASS.**

- [x] **Step 7: Write a failing renderer lifecycle test proving a high asset error loads the low asset exactly once, then implement an asset descriptor constructor argument and retry-once behavior. Run `npm run test -- tests/unit/space/shipRendererLifecycle.test.ts`; confirm PASS.**

- [x] **Step 8: Write a failing `SpaceScene` test for `data-ship-quality`, the accessible quality selector, and a saved visitor override. Implement asynchronous selection before mounting `ShipRenderer`, render `<label><select aria-label="Ship visual quality">`, and persist changes. Run `npm run test -- tests/unit/SpaceScene.test.tsx`; confirm PASS.**

- [x] **Step 9: Produce both assets and verify the delivery footprint.**

```bash
node scripts/optimize-ship.mjs --quality low
node scripts/optimize-ship.mjs --quality high
npx gltf-transform inspect public/space/ships/sci-fi-aircraft-spaceship-fighter-1k.glb
npx gltf-transform inspect public/space/ships/sci-fi-aircraft-spaceship-fighter-2k.glb
```

Expected: each GLB uses WebP textures and `EXT_meshopt_compression`; low remains at or below 2 MiB and high remains at or below 3 MiB. Remove `public/space/ships/sci-fi-aircraft-spaceship-fighter.glb` only after both named assets exist.

- [x] **Step 10: Extend flag-on Playwright coverage to assert an explicit `High quality` selection loads 2K and `Data saver` loads 1K. Run `npm run test:e2e:space-scene`; confirm PASS.**

- [x] **Step 11: Run the mandatory Phase 2.1 guardrail: `npm run lint`, `npm run check`, `npm run test`, default and flag-on production builds, `npm run test:e2e`, and `npm run test:e2e:space-scene`. Manually test Auto, High quality, and Data saver at 1440×900, 768×1024, and 390×844, including keyboard operation and the high-to-low fallback. Record exact evidence in `docs/test-reports/2026-07-16-space-scene-phase-2.1.md`.**

- [x] **Step 12: Commit the code, assets, amended policy, delivery plan, and Phase 2.1 report with `feat: adapt ship quality to GPU capability`.**

### Task 4: Add mass cues and real thruster phases

**Files:** Create `src/components/islands/space/shipMotion.ts` and `tests/unit/space/shipMotion.test.ts`; modify `src/components/islands/space/ShipRenderer.ts`.

- [x] Write a failing unit test proving a one-frame response from bank `0` to target `0.8` is greater than `0` and less than `0.8`.
- [x] Write a failing unit test proving the `warp` plume value is greater than the `idle` plume value.
- [x] Implement `nextShipMotion(state, targetBank, dt, phase)` with a critically damped response: acceleration is `28 * (targetBank - bank) - 10.6 * bankVelocity`; update velocity and bank using `dt`.
- [x] Map plume values deterministically: `warp=1`, `decel=0.8`, `aim=0.45`, and `idle=0.25`.
- [x] Apply bank to the ship transform and plume to emissive/nozzle intensity. Run `npm run test -- tests/unit/space/shipMotion.test.ts`; expect PASS.
- [x] At 1440×900, 768×1024, and 390×844, verify route changes show aim → warp → idle phases and bounded banking. With reduced motion enabled, disable interpolation and use idle intensity. Evidence is recorded in `docs/test-reports/2026-07-16-space-scene-phase-4.md`.

### Task 5 (Phase 3): Complete interaction, accessibility, and fallback parity

Detailed Phase 3 implementation steps are recorded in `docs/delivery-plan/2026-07-16-space-scene-phase-3-implementation-plan.md`; its mandatory evidence report is `docs/test-reports/2026-07-16-space-scene-phase-3.md`.

**Files:** Modify `src/components/islands/SpaceScene.tsx`, `src/components/islands/space/CreditsPanel.tsx`, `src/components/layout/Footer.astro`, and `tests/e2e/space-scene.spec.ts`.

- [x] Write a failing E2E test that emulates reduced motion, visits the flag-on scene, activates the Projects station via Enter, observes arrival confirmation, and asserts `data-reduced-motion="true"` on the island root.
- [x] Implement each station as a semantic button with a unique accessible name such as “Travel to Projects station.”
- [x] Announce changes with a visually hidden `aria-live="polite"` element that renders the current travel state.
- [x] When WebGL initialization fails, render the section-navigation and content fallback rather than an empty canvas. Make the credits panel reachable from the footer.
- [x] Run the Phase 3 unit, build, and feature-gated E2E evidence recorded in `docs/test-reports/2026-07-16-space-scene-phase-3.md`. Commit with `feat: make space scene accessible and attributable`.

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
- The user-selected `Sci-Fi Aircraft | Spaceship Fighter` is confirmed CC BY and has a browser-suitable GLB source; its ignored source asset will be optimized before use.
