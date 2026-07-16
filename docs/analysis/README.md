# Space Scene Analysis

Date: 2026-07-16

This folder documents the current state of the portfolio codebase and the spaceship-travel prototype, with a focus on three questions:

1. Which Sketchfab ship models are good replacement candidates?
2. Why does the current space-travel experience feel less physical than intended?
3. Would framework or dependency changes materially unlock better rendering?

## Inputs Reviewed

### Root app

- `README.md`
- `package.json`
- `astro.config.mjs`
- `src/components/islands/Starfield.tsx`
- `src/components/islands/AstronautMascot.tsx`
- `src/components/islands/MissionControl.tsx`
- `docs/architecture.md`
- `docs/diagrams/*.mmd`

### Prototype

- `Interactive Outerspace Portfolio/README.md`
- `Interactive Outerspace Portfolio/CLAUDE_CODE_HANDOFF.md`
- `Interactive Outerspace Portfolio/DATA.md`
- `Interactive Outerspace Portfolio/FULL-DATASET-PIPELINE.md`
- `Interactive Outerspace Portfolio/Space Portfolio.dc.html`
- `Interactive Outerspace Portfolio/space-engine.js`
- `Interactive Outerspace Portfolio/assets/ship.obj`

## Output Docs

- [2026-07-16-repo-state-and-space-scene-scope.md](2026-07-16-repo-state-and-space-scene-scope.md)
- [2026-07-16-sketchfab-ship-survey.md](2026-07-16-sketchfab-ship-survey.md)
- [2026-07-16-space-motion-realism-audit.md](2026-07-16-space-motion-realism-audit.md)
- [2026-07-16-rendering-stack-options.md](2026-07-16-rendering-stack-options.md)
- [2026-07-16-validation-record.md](2026-07-16-validation-record.md)

## Headline Conclusions

- The checked-in Astro app does not yet contain the traveling spaceship scene; that logic still lives in the prototype folder.
- The prototype's ship feels partly 2D because the scene mixes a real 3D star renderer with several fixed-screen DOM and clip-space presentation layers.
- The safest replacement path is not "find the most animated Sketchfab file"; it is "pick a legally clean, performance-safe ship with a strong silhouette, then decide whether animation stays procedural or moves to glTF."
- Language and framework upgrades alone will not fix the realism gap. The meaningful unlock is glTF-friendly rendering, not a general Astro or React migration.

See the validation record for the repository state, third-party-source checks, and findings that were intentionally marked unverified rather than treated as facts.
