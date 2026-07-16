# Space Scene Phase 3 Integration Design

**Date:** 2026-07-16
**Status:** Approved design awaiting written-spec review

## Goal

Turn the hero from a decorative ship scene into an accessible constellation-navigation entry point. Normal visitors retain the current starfield and ship experience while using floating station objects to travel to key portfolio sections. Reduced-motion and no-WebGL visitors receive the same destinations without visual travel effects.

## Chosen interface

Use **constellation debris** inside the hero:

| Destination | Target        | Visual station object | Accessible name                |
| ----------- | ------------- | --------------------- | ------------------------------ |
| Experience  | `#experience` | Relay satellite       | `Travel to Experience station` |
| Projects    | `#projects`   | Cargo fragment        | `Travel to Projects station`   |
| Contact     | `#contact`    | Communications buoy   | `Travel to Contact station`    |

The station objects occupy the clear space around the ship. They are not positioned over the headline or existing CTA links. The existing hero content remains visually and interactively dominant.

## Layering and responsive behavior

1. Existing starfield canvas: decorative background.
2. Existing ship canvas: decorative, `pointer-events: none`.
3. Station navigation: an interactive absolute overlay with an explicit `Space stations` navigation label.
4. Hero copy and CTA links: the highest-priority readable content.

At desktop and tablet widths, each station is a compact labelled debris button placed around the ship. At the 390 px mobile viewport, the same three semantic buttons become an ordered compact list below the hero CTA area. They are not hidden behind the canvases or dependent on hover.

## Travel behavior

Selecting a native station button — by pointer, Enter, or Space — follows this sequence:

1. Set the selected station and announce `Travelling to <destination>.` in an `aria-live="polite"` region.
2. Set the existing scene state to `aim`, then `warp` for normal-motion visitors. The selected station gains a short visual active state; Phase 4 will add ship banking, plume, and arrival cinematics to these same states.
3. Scroll the destination section into view with `behavior: "smooth"` for normal-motion visitors.
4. Announce `Arrived at <destination>.`, set the scene back to `idle`, and leave keyboard focus on the activated station. Do not move focus into a content section automatically.

The travel controller is a small testable module. It resolves a station by identifier, produces valid announcements, and selects `smooth` or `auto` scrolling from the reduced-motion setting. It owns timer cancellation so an unmounted scene cannot announce a stale arrival.

## Reduced-motion and fallback paths

`matchMedia("(prefers-reduced-motion: reduce)")` is read on mount and listened to for changes. The island exposes `data-reduced-motion="true"` when active. In that mode, a station still announces and scrolls, but uses immediate scrolling and does not enter `aim` or `warp` visual states.

`SpaceScene` checks whether WebGL can be created before mounting decorative renderers. If unavailable, or if the ship renderer fails to initialise, render a visible `Space navigation` fallback panel containing the same three native station buttons and brief explanatory text. The fallback is usable without either canvas. The existing feature flag remains the full rollback switch.

## Credits and boundaries

Add a footer link to an in-page Space Credits panel so attribution remains reachable without discovering the hero scene. Phase 3 does not add ship inertia, real thruster effects, camera movement, model hot swapping, or user-agent detection; those remain Phase 4 or prior completed work.

## Testing and regression gate

- Unit-test station lookup, safe target handling, normal/reduced-motion travel decisions, and cancellation.
- Unit-test reduced-motion state and fallback rendering using injected browser capability seams.
- Add flag-on Playwright coverage that emulates reduced motion, activates Projects with Enter, verifies the live arrival announcement and `data-reduced-motion="true"`, and tests the no-WebGL fallback.
- Run the mandatory Phase 3 gate: lint, Astro check, full unit suite, both production builds, full default E2E, flag-on E2E, and manual desktop 1440×900, tablet 768×1024, and mobile 390×844 checks. Record exact results in `docs/test-reports/2026-07-16-space-scene-phase-3.md`.

## Acceptance criteria

- Each destination is available as a labelled keyboard-operable button in normal and no-WebGL modes.
- Normal visitors see the current starfield and ship plus constellation debris; travel shows selection and live status before smooth scrolling.
- Reduced-motion visitors receive immediate scroll and announcements without travel-state animation.
- No-WebGL visitors receive visible semantic navigation rather than an empty visual layer.
- Headline, CTA links, existing quality control, and the feature-flag rollback remain usable.
