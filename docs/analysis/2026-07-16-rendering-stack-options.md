# Rendering Stack Options

## Current State

### Current app

- The Astro site in `src/` is still the older starfield portfolio.
- The repo is on Astro 5, not Astro 7: `package.json` requests `astro: ^5.2.0` and `package-lock.json` resolves `5.17.1`.
- The current resolved stack is React `19.2.4`, Motion `11.18.2`, TypeScript `5.9.3`, `typescript-eslint` `8.54.0`, and `@astrojs/check` `0.9.6`. These are observations from the lockfile, not a recommendation to upgrade every package.

### Prototype

- The actual spaceship experience is a custom WebGL engine in `Interactive Outerspace Portfolio/space-engine.js`.
- The prototype ship path is OBJ-only and wireframe-oriented today.

## Upgrade Boundaries (Validated 2026-07-16)

`npm view` reported newer major releases for Astro, Motion, and TypeScript. They are not patch upgrades from the actual repository baseline and should not be bundled into the space-scene delivery.

The current peer ranges also make a TypeScript 7 jump inappropriate: `@astrojs/check@0.9.9` accepts TypeScript 5 or 6, while `typescript-eslint@8.64.0` declares `<6.1.0`. Keep the existing TypeScript 5 line for this work. Re-evaluate toolchain upgrades in a separate maintenance change after verifying the complete dependency graph.

## What Will Not Solve The Problem

These changes are low-value for the specific spaceship task:

- Performing a standalone Astro maintenance upgrade
- Upgrading `typescript-eslint` one patch
- Chasing TypeScript 7 early
- Replacing Motion

Those are fine maintenance tasks, but none of them address model loading, animation clips, or scene realism.

## What Actually Unlocks Richer Rendering

### Option A: Stay on the custom engine and improve it

Runtime dependency changes:

- none required

Good for:

- better ship staging
- better thrusters
- better camera inertia
- richer arrival effects
- keeping the current custom shader stack

Limits:

- still no native glTF animation path
- textured/rigged ship support remains bespoke work

### Option B: Keep the custom star engine, but add a ship-focused glTF path

Suggested dependencies:

- `three`
- `@gltf-transform/cli`
- `meshoptimizer`

Pin versions only after the proof of concept selects mutually compatible releases and records them in `package-lock.json`. The earlier exact version pins were not validated as a compatible set for this repository.

Good for:

- importing a real Sketchfab glTF ship
- keeping the prototype star renderer
- adding emissive materials and clip animation just for the ship

Trade-off:

- two rendering mental models at once
- synchronization work between custom WebGL scene state and Three.js ship state

This is the best hybrid path if the ship must become materially richer without rewriting the full experience.

### Option C: Move the experience toward React Three Fiber

Suggested dependencies:

- `three`
- `@react-three/fiber`
- `@react-three/drei`
- `@react-three/postprocessing`
- `postprocessing`

Select and lock a compatible set only if the hybrid proof of concept fails its acceptance criteria; this document intentionally does not present unverified version pins as safe installation commands.

Good for:

- glTF model loading
- animation mixers
- postprocessing
- scene graph composition
- easier world-space relationships between ship, bodies, labels, and effects

Trade-off:

- highest rewrite cost
- likely requires rethinking or porting custom star shaders and data streaming

This is the highest-ceiling path, but it is not the first move I would make just to swap the ship.

## Recommended Path

### Near-term

1. Keep the current Astro 5 / TypeScript 5 baseline during the scene delivery.
2. Choose the replacement ship assuming a better asset path is coming.
3. Schedule toolchain maintenance separately, with fresh compatibility checks.

### Rendering decision

- If the goal is "make the current prototype feel more real quickly," stay on the custom engine and improve staging and effects first.
- If the goal is "use a textured or animated Sketchfab ship properly," add a hybrid glTF path before considering a full R3F migration.

## Final Recommendation

Do not spend this task on a framework rewrite.

The practical sequence is:

1. settle the ship choice,
2. decide whether procedural animation is enough,
3. if not, add glTF-friendly rendering support,
4. only then consider a broader scene-graph migration.

## Validated delivery decision (2026-07-16)

The implemented scene validates **Option B**: retain Astro 5, the custom
starfield renderer, and a Three.js ship-focused hybrid. The selected CC BY ship
loads through the dedicated glTF renderer while the existing starfield remains
the scene background and interaction authority. This preserves the current
portfolio shell, enables procedural travel phases and adaptive 1K/2K assets,
and keeps the flag-off Starfield route available for rollback.

The hybrid path met the measured release limits: the largest runtime GLB is
896,768 bytes (0.85 MiB), and the feature-on initial shell payload measured
943,634 bytes (0.900 MiB), excluding the separately fetched GLB. Unit, type,
build, accessibility, fallback, and Playwright viewport checks are recorded in
the [Phase 5–6 report](../test-reports/2026-07-16-space-scene-phase-5-6.md).

No React Three Fiber migration is justified by this evidence. Option C remains
a future evaluation only if the hybrid renderer fails a later physical-device
performance or scene-composition acceptance test; it is not part of this
delivery.
