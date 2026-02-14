# Interactive Portfolio Architecture

Layer-by-layer architecture for the interactive portfolio (starfield, ship 3D, HUD, panels, modals, rover footer). Single source of truth for layers and orchestration state; one layer at a time for performance and scalability.

## Layer model

Z-index and pointer-events are defined in **`src/app/layers/layerTokens.ts`** and mirrored as CSS variables in `src/styles/global.css`. Layout and components must use these tokens so stacking and hit-testing stay consistent.

| Layer       | Z-index | Pointer-events | Purpose                          |
|------------|---------|----------------|----------------------------------|
| Starfield  | 0       | none           | Background starfield              |
| Footer     | 10      | none           | Mercury surface / footer band    |
| Ship 3D    | 20      | none (MVP)     | Central spaceship canvas         |
| HUD        | 30      | auto           | AR cards, tooltips, hub controls |
| Panels     | 40      | auto           | Slide-in content panels          |
| Modals     | 50      | auto           | Overlay modals                   |

- **Ship canvas**: Use `pointer-events: auto` only when we need to click the ship; otherwise `none` so clicks pass through to hub/panels.
- **One layer at a time**: Add or change one layer at a time and verify performance before moving on.

## Performance budgets

- **No large textures, no external 3D models, no postprocessing** in the ship MVP.
- **Low draw calls**: Basic materials, no shadows in MVP.
- **DPR**: Ship canvas uses `dpr={[1, 1.5]}`; disable antialias if needed for perf.
- **Deterministic**: No random behavior unless seeded; store holds state only, components run animations and report completion.

## Orchestration store

**Single source of truth**: `src/app/state/orchestratorStore.ts` (vanilla store, no zustand).

- **State**: `activeSection`, `shipState` (`idle` | `opening` | `open` | `closing`), `deployState` (`idle` | `deploying` | `landed` | `flagged`).
- **Actions**: `selectSection(key)`, `closeSection()`, `setShipState(...)` (called by components when animations finish), `requestDeploy()`, `resetDeploy()`.
- **Deterministic**: No timeouts inside the store; components drive animations and call `setShipState` / other setters when done.

## Spaceship MVP

- **Component**: `src/components/spaceship/SpaceshipScene.tsx` (React island).
- **Stack**: `three` + `@react-three/fiber` only; no other 3D libs.
- **Content**: Primitives only (cylinder body, box “doors” per section). Idle: gentle bob + slow yaw. Opening: selected door animates (lerp); on finish, `setShipState('open')` and `onShipOpened(key)`.
- **a11y**: Respect `prefers-reduced-motion` (skip lerp, jump to end state).
- **Integration**: Rendered as a centered layer behind the hub; canvas `pointer-events: none` in MVP.

## One layer at a time workflow

1. **Foundation**: Layer tokens + orchestrator store + ship MVP (this step).
2. **Next**: Wire ship `onShipOpened` to open the corresponding panel; keep starfield/galaxies/rover/footer visuals unchanged until their turn.
3. **Later**: Add or refine one layer at a time (e.g. starfield interaction, then HUD, then rover deploy), each with tests and perf check.

## Testing

- **Unit (Vitest)**: Store behavior (e.g. `selectSection('projects')` sets `activeSection` and `shipState` to `opening`; `closeSection()` resets).
- **E2E (Playwright)**: Visit home with `?ship-debug=1`, click debug “Projects”, assert `[data-testid="ship-state"]` goes idle → opening → open; no console errors.

## Debug UI

Temporary debug UI (dev or `?ship-debug=1`) exposes section buttons and current ship/section state for testing the orchestrator without touching the rest of the UI.
