# Repo State And Space Scene Scope

## Executive Summary

The current repository has a split personality:

- The checked-in Astro app under `src/` is still the older starfield-based portfolio.
- The spaceship, warp travel, and section-docking experience live in `Interactive Outerspace Portfolio/`, not in `src/`.

That means replacing the spaceship is not a one-file asset swap in the current app. It is part of a broader prototype-integration decision.

## What Is Actually In The Current App

The shipped Astro code still centers on:

- `src/components/islands/Starfield.tsx`
- `src/components/islands/StarModal.tsx`
- `src/components/islands/AstronautMascot.tsx`
- `src/components/islands/MissionControl.tsx`

`README.md` and `docs/architecture.md` both describe that model: clickable stars open Hubble content, and there is no `SpaceScene` or `space-engine` module in `src/`.

## What Is Actually In The Prototype

The space-travel experience lives in `Interactive Outerspace Portfolio/`:

- `space-engine.js`
- `Space Portfolio.dc.html`
- `celestial-*.js`
- `assets/ship.obj`
- `DATA.md`
- `FULL-DATASET-PIPELINE.md`
- `CLAUDE_CODE_HANDOFF.md`

The prototype README describes a fly-through experience built on 168,883 real objects, warp travel, and a wireframe spaceship:
[Interactive Outerspace Portfolio/README.md](../../Interactive%20Outerspace%20Portfolio/README.md)

The handoff doc is explicit that this prototype is intended to replace the current `Starfield.tsx` and `StarModal.tsx` flow:
[Interactive Outerspace Portfolio/CLAUDE_CODE_HANDOFF.md](../../Interactive%20Outerspace%20Portfolio/CLAUDE_CODE_HANDOFF.md)

## Important Documentation Drift

There are two kinds of drift in the current repo:

1. Product drift
   The current app docs still describe the starfield site, while the desired product direction is the prototype's warp-travel site.

2. Version drift
   The previously reported Astro 7 upgrade was incorrect. Both `README.md` and `package.json` describe the Astro 5 generation: the manifest requests Astro `^5.2.0` and the lockfile resolves `5.17.1`. See the validation record for the complete installed-package snapshot.

## Scope Implication For The Ship Replacement Task

If the goal is to replace the ship inside the actual travel experience, the relevant code is:

- `Interactive Outerspace Portfolio/space-engine.js`
- `Interactive Outerspace Portfolio/Space Portfolio.dc.html`
- `Interactive Outerspace Portfolio/assets/ship.obj`

If the goal is to replace something in the current deployed Astro code, then the repo is not there yet. The current checked-in app still needs the prototype integration step first.

## Recommended Interpretation

The cleanest next-step framing is:

1. Treat the prototype as the source of truth for spaceship and travel analysis.
2. Treat the Astro app as the target shell that will eventually absorb that prototype.
3. Choose the replacement ship and rendering path with that eventual merge in mind, not just with the current `src/` tree in mind.
