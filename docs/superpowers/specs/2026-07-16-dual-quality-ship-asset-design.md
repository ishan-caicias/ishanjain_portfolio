# Dual-Quality Ship Asset Design

**Date:** 2026-07-16  
**Status:** Approved design awaiting implementation-plan review

## Goal

Serve a sharper 2K ship texture asset to suitable tablet and desktop visitors while retaining the current 1K asset for phones, data-saver users, and known low-memory devices.

## Asset tiers

| Tier | Asset                 | Intended visitors                                                         | Constraints                                                                  |
| ---- | --------------------- | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Low  | 1K WebP + Meshopt GLB | Viewports below 768 CSS px, data-saver users, or known low-memory devices | Preserve current 0.42 MiB target and mobile-safe decoded texture allocation. |
| High | 2K WebP + Meshopt GLB | Viewports at least 768 CSS px without an opt-down signal                  | Expected about 0.86 MiB download and about 90 MB decoded texture allocation. |

The ignored 4K PNG source remains conversion material only. No runtime 4K tier is included in this delivery.

## Selection policy

Select a tier once when `SpaceScene` mounts. Do not hot-swap a loaded model after a viewport resize; this avoids duplicate downloads and visual churn. A later page load applies any changed viewport or browser preference.

Selection order:

1. Choose low quality if `navigator.connection?.saveData === true`.
2. Choose low quality when the viewport does not match `(min-width: 768px)`.
3. Choose low quality if the optional `navigator.deviceMemory` hint is present and below 4 GB.
4. Otherwise choose high quality.

The high asset may fall back once to the low asset if the high download or decode fails. If the low asset also fails, preserve the existing renderer-failure behavior.

## Device signals

| Signal                             | Use                                          | Reliability treatment                                                                   |
| ---------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------------------- |
| `matchMedia("(min-width: 768px)")` | Primary tablet/desktop breakpoint            | Required baseline; broadly available and deterministic.                                 |
| `navigator.connection?.saveData`   | Respect explicit bandwidth-saving preference | Optional opt-down; absence does not block the high tier.                                |
| `navigator.deviceMemory`           | Opt down known low-memory devices            | Optional, coarse, and browser-limited; absence is not interpreted as high-memory proof. |
| `navigator.hardwareConcurrency`    | Diagnostic/reporting only                    | Not a GPU or texture-memory measurement; do not use as a selection threshold.           |
| `devicePixelRatio`                 | Rendering resolution cap only                | Not a quality-tier signal; high-DPR phones must not automatically receive 2K textures.  |
| User agent / platform strings      | Never use                                    | Device class and performance are too easy to misclassify.                               |

## Components and data flow

1. `scripts/optimize-ship.mjs` produces named 1K and 2K GLBs from the ignored source with WebP and Meshopt compression.
2. A small pure selector returns `"low"` or `"high"` from injected browser capabilities for deterministic unit tests.
3. `ShipRenderer` receives the selected asset descriptor, exposes the active quality as a data attribute through `SpaceScene`, and tries the low tier once if high loading fails.
4. The dedicated flag-on E2E test verifies the default desktop selection. Unit tests cover data-saver, phone viewport, low-memory opt-down, unsupported hints, and high-to-low fallback.

## Error handling and accessibility

- The ship overlay remains `pointer-events: none`; star interactions and page controls are unchanged.
- The selection is decorative and must not prevent hero content from rendering.
- Existing `loading`, `ready`, and `failed` statuses remain. A successful high-to-low fallback reports `ready` with the active low tier.
- Reduced-motion behavior remains outside this quality-tier change and stays scheduled for the later motion phase.

## Verification

- Run low and high optimization commands; verify GLB sizes and required glTF extensions.
- Run focused unit tests before and after implementation (red–green).
- Run type check, lint, both feature-flag builds, default E2E, and dedicated flag-on E2E.
- Manually verify 1K phone/data-saver and 2K tablet/desktop selections at 390×844, 768×1024, and 1440×900.

## Scope boundaries

- No user-agent parsing package or server-side device detection.
- No runtime 4K asset.
- No adaptive reloading during viewport changes.
- No motion, travel, or accessibility-control work from later delivery phases.
