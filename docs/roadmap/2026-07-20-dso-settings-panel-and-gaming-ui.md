# Future concept — DSO settings control panel + gaming-oriented UI (likely PF-11)

**Date:** 2026-07-20
**Status:** Forward-looking note, not a delivery plan. Captured so the motivation behind PF-10's
scale doesn't get lost between sessions — not scoped, sequenced, or estimated yet.

## What the owner described

The reason PF-10 goes after the _full_ size of each dataset (all 154,787 real asteroids, the
full 12,190-cluster catalog even though most render as an instanced layer, SDSS DR18 at 3.6M
galaxies) rather than a curated minimum is that the next delivery plan is expected to add a
**settings control panel**: a UI surface where a visitor can select/deselect which DSO
categories render (clusters, galaxies, nebulae, white dwarfs, the asteroid belt, ...) and
control the rendered count per category. The scale target for PF-10 exists so that panel has
real inventory to control — under-fetching now would mean re-running the C0–C4 pipeline work
later just to give the panel something to toggle.

Scope as described, to capture faithfully rather than pre-design:

- Per-category show/hide toggles for DSOs (clusters on/off, galaxies on/off, etc.)
- Per-category count/density control (how many of each category render, likely tied into the
  existing quality-tier system rather than replacing it)
- A broader "gaming-oriented" UI tidy-up — described as making the chrome feel more like game
  controls than a web dashboard
- Explicitly "richer for users across various platforms" — implies this is not a desktop-only
  panel; needs the same responsive/touch/reduced-motion discipline as the rest of the scene

## Why this belongs in roadmap, not delivery-plan, yet

PF-10 hasn't shipped the data the panel would control. A settings UI for categories that don't
exist yet has nothing to test against. Per this repo's PLAN discipline (confirm scope from real
state, not from an aspiration), a PF-11 delivery plan should wait until at least PF-10's C1
(missing objects) is code-complete, so the panel's acceptance criteria can be written against
real rendered categories rather than a guess.

## Open questions for whenever PF-11 is actually scoped

- Does the panel persist choices (localStorage, matching the existing `?tier=`/stored-override
  pattern) or is it session-only?
- Does per-category count control interact with the existing quality-tier budgets (full/
  balanced/lite), or is it a fully independent axis a visitor can push past what a tier would
  normally allow — and if so, what stops a low-end device from being handed a config it can't
  render?
- Scope boundary: is this purely a rendering-visibility control, or does it also gate which
  categories are _travelable_ (curated dossier bodies), separate from the ambient instanced
  layers?

No action needed on this file until PF-10 is further along — revisit at that point rather than
letting it go stale here.
