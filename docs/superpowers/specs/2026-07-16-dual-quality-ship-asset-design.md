# Dual-Quality Ship Asset Design

**Date:** 2026-07-16  
**Status:** Approved for implementation

## Goal

Serve a sharper 2K ship texture asset to capable visitors — including capable flagship phones — while retaining a 1K asset for data-saving and lower-performance environments.

## Asset tiers

| Tier | Asset                 | Intended visitors                                                                      | Constraints                                                                  |
| ---- | --------------------- | -------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Low  | 1K WebP + Meshopt GLB | Data-saver users, low GPU tiers, low-memory devices, and unknown narrow-screen devices | Preserve current 0.42 MiB target and mobile-safe decoded texture allocation. |
| High | 2K WebP + Meshopt GLB | High GPU tiers, including capable phones, plus unknown tablet/desktop visitors         | Expected about 0.86 MiB download and about 90 MB decoded texture allocation. |

The ignored 4K PNG source remains conversion material only. No runtime 4K tier is included in this delivery.

## Selection policy

Select a tier once when `SpaceScene` mounts. Do not hot-swap a successfully loaded model after a viewport resize; this avoids duplicate downloads and visual churn. A later page load applies any changed browser preference. A failed high-tier load may retry the low tier once.

Selection order:

1. A saved explicit visitor choice wins: `High quality` selects 2K and `Data saver` selects 1K. The default is `Auto`.
2. In `Auto`, choose low quality if `navigator.connection?.saveData === true`.
3. In `Auto`, choose low quality if the optional `navigator.deviceMemory` hint is present and below 4 GB.
4. In `Auto`, use `@pmndrs/detect-gpu` with the active WebGL context. A tier of 2 or 3 selects high; tier 0 or 1 selects low.
5. If GPU classification is unavailable, fails, or exceeds a 500 ms non-blocking decision budget, use a deterministic fallback: low below 768 CSS px and high at or above it. Cache only a successful benchmark-backed automatic decision for 30 days; never cache a fallback.

The high asset may fall back once to the low asset if the high download or decode fails. If the low asset also fails, preserve the existing renderer-failure behavior.

## Device signals

| Signal                             | Use                                          | Reliability treatment                                                                                                  |
| ---------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| `@pmndrs/detect-gpu` GPU tier      | Primary Auto-mode quality signal             | Uses a WebGL renderer classification and benchmark data; use as a heuristic, cache it, and retain the fallback policy. |
| `matchMedia("(min-width: 768px)")` | Unknown-GPU fallback breakpoint              | Broadly available and deterministic, but not a performance classification.                                             |
| `navigator.connection?.saveData`   | Respect explicit bandwidth-saving preference | Optional opt-down; absence does not block the high tier.                                                               |
| `navigator.deviceMemory`           | Opt down known low-memory devices            | Optional, coarse, and browser-limited; absence is not interpreted as high-memory proof.                                |
| `navigator.hardwareConcurrency`    | Diagnostic/reporting only                    | Not a GPU or texture-memory measurement; do not use as a selection threshold.                                          |
| `devicePixelRatio`                 | Rendering resolution cap only                | Not a quality-tier signal; high-DPR phones must not automatically receive 2K textures.                                 |
| User agent / platform strings      | Never use                                    | Device class and performance are too easy to misclassify; do not classify named phone models.                          |
| `WEBGL_debug_renderer_info`        | Library implementation detail only           | May be privacy-restricted; do not persist or make first-party policy decisions from the raw renderer string.           |

## Components and data flow

1. `scripts/optimize-ship.mjs` produces named 1K and 2K GLBs from the ignored source with WebP and Meshopt compression.
2. A small pure selector returns `"low"` or `"high"` from injected browser capabilities and visitor preference for deterministic unit tests.
3. A browser-only adapter reads the native signals, performs the bounded GPU-tier lookup, and caches only the chosen tier/expiry — never the raw GPU string.
4. `ShipRenderer` receives the selected asset descriptor, exposes the active quality as a data attribute through `SpaceScene`, and tries the low tier once if high loading fails.
5. `SpaceScene` provides an accessible `Auto` / `High quality` / `Data saver` control persisted in local storage. The dedicated flag-on E2E test verifies high and low selections; unit tests cover preference, data-saver, GPU tier, unknown fallback, caching, and high-to-low retry.

## Error handling and accessibility

- The ship overlay remains `pointer-events: none`; star interactions and page controls are unchanged.
- The selection is decorative and must not prevent hero content from rendering.
- Existing `loading`, `ready`, and `failed` statuses remain. A successful high-to-low fallback reports `ready` with the active low tier.
- Reduced-motion behavior remains outside this quality-tier change and stays scheduled for the later motion phase.

## Verification

- Run low and high optimization commands; verify GLB sizes and required glTF extensions.
- Run focused unit tests before and after implementation (red–green).
- Run type check, lint, both feature-flag builds, default E2E, and dedicated flag-on E2E.
- Manually verify an automatic low decision, an automatic high decision, visitor overrides, and high-to-low fallback at 390×844, 768×1024, and 1440×900.

## Scope boundaries

- No user-agent parsing package or server-side device detection.
- No runtime 4K asset.
- No adaptive reloading during viewport changes.
- No frame-time adaptation in this phase. Phase 4 will use actual rendered frame-time observations to reduce pixel ratio and motion effects when the device struggles.
