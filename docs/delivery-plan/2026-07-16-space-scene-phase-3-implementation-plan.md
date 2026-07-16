# Space Scene Phase 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add accessible constellation-debris travel stations to the hero, with reduced-motion and no-WebGL navigation parity.

**Architecture:** Starfield and ShipRenderer remain decorative. A station registry and travel helper provide the data and decisions; SpaceScene owns selection, announcement, scrolling, and cancellation. Hero creates the z-index contract: canvases, stations, then readable hero content.

**Tech Stack:** Astro 5, React 19, TypeScript, Three.js, Vitest, React Testing Library, Playwright, axe-playwright.

---

## File structure

| Path                                             | Responsibility                                                    |
| ------------------------------------------------ | ----------------------------------------------------------------- |
| `src/components/islands/space/stations.ts`       | Immutable station definitions and lookup.                         |
| `src/components/islands/space/spaceTravel.ts`    | Pure normal/reduced-motion travel decision.                       |
| `src/components/islands/space/SpaceStations.tsx` | Semantic constellation-debris navigation.                         |
| `src/components/islands/space/SpaceFallback.tsx` | Visible no-WebGL navigation panel.                                |
| `src/components/islands/space/webglSupport.ts`   | WebGL support check.                                              |
| `src/components/islands/SpaceScene.tsx`          | Selection, live status, scroll, cancellation, renderer lifecycle. |
| `tests/e2e/space-scene.integration.spec.ts`      | Flag-on keyboard, reduced-motion, and no-WebGL behavior.          |

### Task 1: Define stations and travel decisions

**Files:** Create `src/components/islands/space/stations.ts`, `src/components/islands/space/spaceTravel.ts`, `tests/unit/space/stations.test.ts`, and `tests/unit/space/spaceTravel.test.ts`.

- [ ] **Step 1: Write the failing station-registry test.**

```ts
expect(spaceStations.map((station) => station.id)).toEqual([
  "experience",
  "projects",
  "contact",
]);
expect(getSpaceStation("projects")).toMatchObject({
  targetId: "projects",
  accessibleName: "Travel to Projects station",
  visual: "cargo-fragment",
});
expect(getSpaceStation("unknown")).toBeUndefined();
```

- [ ] **Step 2: Run `npm run test -- tests/unit/space/stations.test.ts`; expect a missing-module failure.**

- [ ] **Step 3: Implement the registry.**

```ts
export const spaceStations = [
  {
    id: "experience",
    label: "Experience",
    targetId: "experience",
    visual: "relay-satellite",
    accessibleName: "Travel to Experience station",
  },
  {
    id: "projects",
    label: "Projects",
    targetId: "projects",
    visual: "cargo-fragment",
    accessibleName: "Travel to Projects station",
  },
  {
    id: "contact",
    label: "Contact",
    targetId: "contact",
    visual: "communications-buoy",
    accessibleName: "Travel to Contact station",
  },
] as const;

export function getSpaceStation(id: string) {
  return spaceStations.find((station) => station.id === id);
}
```

- [ ] **Step 4: Run the station test; expect PASS.**

- [ ] **Step 5: Write the failing normal/reduced-motion travel test.**

```ts
expect(createSpaceTravel("projects", false)).toEqual({
  phase: "warp",
  scrollBehavior: "smooth",
  departureMessage: "Travelling to Projects.",
  arrivalMessage: "Arrived at Projects.",
});
expect(createSpaceTravel("contact", true)).toEqual({
  phase: "idle",
  scrollBehavior: "auto",
  departureMessage: "Travelling to Contact.",
  arrivalMessage: "Arrived at Contact.",
});
```

- [ ] **Step 6: Run `npm run test -- tests/unit/space/spaceTravel.test.ts`; expect a missing-export failure.**

- [ ] **Step 7: Implement `createSpaceTravel(stationId, reducedMotion)` with the object shape above. Resolve the station through `getSpaceStation` and throw `Error("Unknown space station: <id>")` when absent.**

- [ ] **Step 8: Run both Task 1 tests; expect PASS. Commit with `feat: define accessible space travel stations`.**

### Task 2: Render constellation controls and normal travel

**Files:** Create `src/components/islands/space/SpaceStations.tsx`; modify `src/components/islands/SpaceScene.tsx`, `src/components/sections/Hero.astro`, and `tests/unit/SpaceScene.test.tsx`.

- [ ] **Step 1: Write the failing scene test.**

```tsx
expect(
  screen.getByRole("navigation", { name: "Space stations" }),
).toBeInTheDocument();
expect(
  screen.getByRole("button", { name: "Travel to Projects station" }),
).toBeInTheDocument();
expect(screen.getByTestId("ship-overlay")).toHaveClass("pointer-events-none");
```

- [ ] **Step 2: Run `npm run test -- tests/unit/SpaceScene.test.tsx`; expect failure because the station navigation and overlay test id do not exist.**

- [ ] **Step 3: Create `SpaceStations` as `<nav aria-label="Space stations">` mapping the registry to native buttons. Add stable `data-station` values and visual classes `relay-satellite`, `cargo-fragment`, and `communications-buoy`; at widths below 640 px, Tailwind renders the same controls as a compact ordered list.**

- [ ] **Step 4: Change `Hero.astro`: SpaceScene is `absolute inset-0 z-0`, hero copy is `z-30`, station navigation is `z-20`, and canvases remain below all readable content.**

- [ ] **Step 5: Add `selectedStation`, `travelMessage`, and an `arrivalTimer` ref to SpaceScene. A station action calls `createSpaceTravel`, sets the phase/message, calls `document.getElementById(targetId)?.scrollIntoView({ behavior: scrollBehavior, block: "start" })`, then sets the arrival message after 500 ms for normal motion. Clear the timer before a new action and on unmount.**

- [ ] **Step 6: Add `<p data-testid="space-travel-status" role="status" className="sr-only">` for messages. Do not move focus from the activated button.**

- [ ] **Step 7: Run the focused scene test; expect PASS for all buttons, Projects departure/arrival, smooth scroll, and timer cleanup. Commit with `feat: add constellation station navigation`.**

### Task 3: Add reduced-motion, no-WebGL, and credit parity

**Files:** Create `src/components/islands/space/SpaceFallback.tsx` and `src/components/islands/space/webglSupport.ts`; modify `src/components/islands/SpaceScene.tsx`, `src/components/layout/Footer.astro`, `src/components/islands/space/CreditsPanel.tsx`, and `tests/unit/SpaceScene.test.tsx`.

- [ ] **Step 1: Write the failing fallback test.**

```tsx
render(<SpaceScene webglSupported={false} reducedMotion={true} />);
expect(screen.getByTestId("space-scene")).toHaveAttribute(
  "data-reduced-motion",
  "true",
);
expect(screen.getByTestId("space-scene-fallback")).toBeVisible();
expect(
  screen.getByRole("button", { name: "Travel to Contact station" }),
).toBeVisible();
expect(shipRenderer.mount).not.toHaveBeenCalled();
```

- [ ] **Step 2: Run `npm run test -- tests/unit/SpaceScene.test.tsx`; expect failure because capability props and the fallback panel do not exist.**

- [ ] **Step 3: Implement `isWebGLSupported()` with an unattached canvas and `getContext("webgl", { failIfMajorPerformanceCaveat: true })`. SpaceScene accepts optional `webglSupported` and `reducedMotion` props for tests; otherwise it uses the helper and a `matchMedia("(prefers-reduced-motion: reduce)")` change listener.**

- [ ] **Step 4: Implement SpaceFallback with `data-testid="space-scene-fallback"`, heading `Space navigation`, explanatory text, and shared SpaceStations. Do not mount Starfield or ShipRenderer without WebGL. A ShipRenderer failure switches to this fallback.**

- [ ] **Step 5: Add `data-reduced-motion={String(reducedMotion)}`. Reduced motion uses the `idle` phase, immediate scrolling, and immediate arrival text. Add footer `<details id="space-credits">` with summary `Space credits` and CreditsPanel; preserve its single Ship credits heading and both attribution links.**

- [ ] **Step 6: Run focused fallback, reduced-motion, renderer-failure, and credits tests; expect PASS. Commit with `feat: add accessible scene fallback and credits`.**

### Task 4: Browser coverage and Phase 3 regression gate

**Files:** Create `tests/e2e/space-scene.integration.spec.ts` and `docs/test-reports/2026-07-16-space-scene-phase-3.md`; modify `scripts/run-space-scene-e2e.mjs` and `docs/delivery-plan/2026-07-16-space-scene-delivery-plan.md`.

- [ ] **Step 1: Write the failing reduced-motion E2E test.**

```ts
await page.emulateMedia({ reducedMotion: "reduce" });
await page.goto("/");
const station = page.getByRole("button", {
  name: "Travel to Projects station",
});
await station.press("Enter");
await expect(page.getByTestId("space-scene")).toHaveAttribute(
  "data-reduced-motion",
  "true",
);
await expect(page.getByTestId("space-travel-status")).toHaveText(
  "Arrived at Projects.",
);
```

- [ ] **Step 2: Write the failing no-WebGL E2E test. Before navigation, use `page.addInitScript()` to return `null` for only `webgl` and `webgl2` canvas contexts. Assert `data-testid="space-scene-fallback"` and the Contact station button.**

- [ ] **Step 3: Run `npm run test:e2e:space-scene`; expect the new tests to fail because the dedicated spec is not included.**

- [ ] **Step 4: Update `scripts/run-space-scene-e2e.mjs` to invoke rollout and integration specs. Re-run it; expect PASS.**

- [ ] **Step 5: Run the hard Phase 3 gate: `npm run lint`, `npm run check`, `npm run test`, default build, flag-on build, `npm run test:e2e`, and `npm run test:e2e:space-scene`.**

- [ ] **Step 6: Manually verify 1440×900, 768×1024, and 390×844: readable hero copy, all stations, normal smooth travel, reduced-motion immediate travel, no-WebGL fallback, keyboard activation, footer credits, and `PUBLIC_SPACE_SCENE=false` rollback. Record exact evidence in the Phase 3 report.**

- [ ] **Step 7: Mark Phase 3 complete in the delivery plan and commit browser tests, report, and plan update with `test: validate phase 3 space scene integration`.**

## Plan self-review

- Task 1 defines the exact station and travel APIs consumed by Tasks 2–4.
- Task 2 covers the approved constellation-debris UI, layer hierarchy, normal travel, announcement, and cancellation.
- Task 3 covers reduced-motion/no-WebGL equivalence and reachable attribution.
- Task 4 executes every mandatory Phase 3 regression guardrail.
- Banking, thrusters, camera motion, and richer arrival cinematics remain explicitly reserved for Phase 4.
