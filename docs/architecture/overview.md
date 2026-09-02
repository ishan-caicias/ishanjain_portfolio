# Architecture Documentation

## Overview

This portfolio is a single-page static site built with Astro's islands architecture. The majority of the page is server-rendered HTML with zero JavaScript. Interactive components are hydrated as React islands only where needed.

## Frontend Domain-Driven Design

The codebase is organised by **domain** rather than by technical layer:

```
src/
├── components/
│   ├── layout/      → Shell components (Header, Footer, SkipLink)
│   ├── sections/    → Content domain sections (Hero, Experience, etc.)
│   ├── islands/     → Interactive React components (client-side hydrated)
│   │   └── space/   → Space scene chrome (HUD, dossiers, station sprites, etc.)
│   └── ui/          → Reusable presentational primitives
├── content/         → Domain data objects (typed, importable)
├── data/celestial/  → Ported Hipparcos/Gaia/SDSS catalog data
├── lib/             → Both 3D engines behind the dual-engine seam, + pure render/
│                       flight/photometry modules (see "The Dual-Engine Seam" below)
├── layouts/         → Page-level HTML templates
├── pages/           → Route definitions
├── styles/          → Design tokens and global CSS
└── types/           → Shared TypeScript interfaces
```

### Component Boundaries

| Layer       | Rendering      | JS Shipped        | Purpose                                    |
| ----------- | -------------- | ----------------- | ------------------------------------------ |
| `sections/` | Server (Astro) | None              | Static content sections                    |
| `ui/`       | Server (Astro) | None              | Reusable UI primitives                     |
| `layout/`   | Server (Astro) | Minimal inline    | Page shell (nav has inline scroll handler) |
| `islands/`  | Client (React) | Per-island bundle | Interactive features                       |

### React Islands

Three top-level islands ship JavaScript to the client:

1. **SpaceScene** (`client:load`) - Resolves which engine to mount via `engine-select.ts`
   and mounts either `<babylon-scene>` (the default) or `<space-engine>` (archived), plus
   the always-visible chrome under `islands/space/` (HUD, mission control bar, hover
   tooltip, warp overlay, collector-card and section-overlay dossiers, station sprites).
   Loaded immediately as it's the hero background. Degrades to a static CSS starfield
   if WebGL is unavailable, with navigation still functional.
2. **AstronautMascot** (`client:idle`) - Floating SVG mascot. Hydrated when browser is idle.
3. **MissionControl** (`client:visible`) - Footer quick-links panel. Hydrated when scrolled into view.

## Data Flow

```
content/*.ts  →  sections/*.astro  →  Server-rendered HTML
                                          ↓
                                    Static HTML page
                                          ↓
                              React islands hydrate on demand
                                          ↓
                    SpaceScene resolves the engine (engine-select.ts) and
                    dynamically imports babylon-engine.ts (default) or
                    space-engine.js (?engine=webgl), + celestial-*.js
                    catalog data (client-only, browser APIs)
                                          ↓
                    <babylon-scene> or <space-engine> mounts, emits cosmos:*
                    events (progress, ready, select, warp, arrive, home —
                    plus aim, hover, unhover, craft on the legacy engine only)
                                          ↓
                    SpaceScene listens and drives HUD/dossier/overlay state;
                    header nav links warp via document-level click delegation
```

## The Dual-Engine Seam

`src/lib/engine-select.ts` is the single decision point. Resolution order — **URL param →
stored override → default** — mirrors `craft-tier.ts` and the quality-tier resolver.

| Path            | Element                                 | Backend                 | Status                                                                                       |
| --------------- | --------------------------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| default         | `<babylon-scene>` (`babylon-engine.ts`) | WebGPU, WebGL2 fallback | **Shipping** since the PF-09 B6 cutover ([ADR-0006](../adr/0006-babylon-default-cutover.md)) |
| `?engine=webgl` | `<space-engine>` (`space-engine.js`)    | WebGL1                  | **Archived in place** — fully functional for one release as the rollback lever               |

Both engines implement the same contract: the `cosmos:*` event bus and the imperative
`travelTo` / `goHome` / `randomBody` / `setStations` surface that `SpaceScene` drives. They are
**not** at feature parity — the Babylon path's known gaps are registered in
[the cutover gap analysis](../analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
Rollback procedure: [engine-cutover runbook](../runbooks/2026-07-19-engine-cutover-rollback.md).

Babylon-path modules: `babylon-engine.ts` (scene, stars, warp state machine),
`babylon-ship.ts` (hull, plume, shimmer), `babylon-asteroids.ts` (Havok belt),
`babylon-tiers.ts` (full/balanced/lite budgets), `nebula-field.ts` (volumetric raymarch,
GLSL/WGSL twins), plus engine-agnostic `ship-dynamics.ts`, `star-field.ts`,
`star-catalog.ts`, `perf-telemetry.ts`.

## Theme System

Theme tokens are defined in `src/styles/global.css` using TailwindCSS v4's `@theme` directive. This creates CSS custom properties that can be used throughout the application:

- **Royal Blue scale** (50–900): Primary brand colour
- **Gold accents** (300–600): Highlight and emphasis
- **Pine Green** (400–600): Secondary / nature accent
- **Surface colours**: Deep space backgrounds
- **Text colours**: Primary, muted, dim

All tokens are available as Tailwind utility classes (e.g., `text-gold-400`, `bg-surface`).

## Testing Strategy

### Unit Tests (Vitest + React Testing Library)

Focus on React islands since they contain the interactive logic:

- **MissionControl**: Panel toggle, keyboard accessibility, clipboard API
- **spaceHelpers.ts**: Pure computation logic extracted from the space scene (formatting,
  rarity colours, field-star dossier synthesis) so it's testable independent of React/WebGL
- **Pure engine modules**: flight dynamics, star photometry/billboard packing, catalog
  decode, nebula raymarch mirrors, plume/asteroid builders, tier + craft + engine
  resolvers — all engine-agnostic and testable without a GPU

Shader source is unit-tested as **strings** (both GLSL and WGSL twins) — this is what
catches reserved-identifier and twin-divergence defects that no compiler cross-checks.

### E2E Tests (Playwright)

Focus on integration and user journeys:

- **Navigation**: Section scrolling (classic view), mobile menu, skip link
- **Space Scene**: Mount + live catalog data, travel-mode-by-default, nav-link warp →
  dossier open/close, RNG travel, travel/scroll mode toggle, WebGL fallback, reduced motion
- **Engine seam**: default mounts Babylon, `?engine=webgl` mounts the archived engine,
  catalog identity, tier resolution, nebula/ship/Havok integration, pixel proofs
- **Accessibility**: axe-core scan on **both** engine paths, heading hierarchy, keyboard
  navigation, semantic landmarks
- **Console hygiene**: `page-load-console.spec.ts` is the only spec listening from
  navigation start — the regression guard for CSP violations and dead directives
- **Real hardware**: `webgpu-hardware.spec.ts` (local only, `channel: "chrome"`) validates
  the WGSL/WebGPU path on a real GPU; skips when no adapter is available

Current counts live in [../test-reports/README.md](../test-reports/README.md), not here —
counts drift, indexes don't.

### Why Not Test Astro Components?

Astro components render to static HTML at build time. Testing them would effectively be testing Astro's compiler. Instead, E2E tests verify the rendered output in a real browser.

## Performance Considerations

- **Zero JS by default**: Astro ships no JavaScript for static sections
- **Islands architecture**: React bundles are code-split per component
- **Quality tiers**: the Babylon path resolves `full`/`balanced`/`lite` once at boot from
  backend + device signals (`babylon-tiers.ts`), gating star halo, shooting-star count,
  nebula raymarch steps, asteroid count and the shimmer pass; the archived WebGL engine
  has its own adaptive governor. Both clamp DPR and keep a no-WebGL DOM fallback - see
  [../delivery-plan/PF-07-space-portfolio-webgl.md](../delivery-plan/PF-07-space-portfolio-webgl.md)
- **Lazy payloads**: Babylon core, `@babylonjs/loaders`, the Havok WASM and the craft GLBs
  are lazy chunks reached only on their own path; DSO imagery loads only on arrival
- **CI budget gates**: `npm run budget:check` enforces total JS, largest-single-chunk (the
  barrel-import canary) and WASM ceilings; `tests/e2e/perf-budgets.spec.ts` guards
  CI-class startup/fps regression — neither substitutes for per-device budget rows
- **requestAnimationFrame**: Paused/throttled when tab is hidden
- **prefers-reduced-motion**: Halves/shortens engine animation durations and clamps every
  DC-layer CSS keyframe via a blanket rule in `global.css`
- **Font strategy**: Self-hosted variable fonts with `font-display: swap`
- **Image lazy loading**: All images use `loading="lazy"`

## Accessibility

- Skip link for keyboard users
- Semantic HTML landmarks (`<main>`, `<nav>`, `<footer>`)
- Focus trap in modal dialogs
- `aria-label` on icon-only buttons and decorative elements
- `aria-expanded` on toggle controls
- `prefers-reduced-motion` respected globally
- All interactive elements keyboard-navigable
- Colour contrast meets WCAG AA for text elements

## Security

Being a static site (`output: "static"`), the deployed artefact has no server logic, auth, or
user input, so hardening is browser-enforced:

- **Content-Security-Policy**: hash-based, via Astro's native `security.csp` (`astro.config.mjs`).
  Astro auto-hashes its own bundled/inline scripts and styles, so `script-src`/`style-src` use
  `'self'` + hashes with **no `'unsafe-inline'`**. Emitted as a per-page `<meta>` on
  `build`/`preview` (not `astro dev`).
- **Response headers**: `public/_headers` (Netlify/Cloudflare Pages) — `nosniff`, HSTS,
  `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP.
- **Static-CSS discipline**: inline `<style>` must not be injected at runtime (it can't be hashed
  by the CSP) — put such CSS in `global.css` instead. React islands must also never SSR a
  `style="…"` attribute; style attributes are never coverable by hashes (TR-016).
- **Scoped capability directives**, each with recorded rationale — do not strip:
  `script-src 'self' 'wasm-unsafe-eval'` (meshopt WASM, not JS eval),
  `connect-src 'self' blob:` and `worker-src 'self' blob:` (Babylon unpacks GLB textures to
  blob URLs and fetches them on the WebGPU path — omitting this loads the hull
  geometry-less on WebGPU only, while WebGL2 passes), `img-src 'self' data: blob:`.
- **`astro.config.mjs` is the single source of CSP truth.** `public/_headers` deliberately
  carries no CSP; `netlify.toml`'s commented header-CSP is a standing hazard that must
  mirror astro.config if ever enabled.

Full OWASP audit and rationale: [`../security/`](../security/). Upgrade decisions:
[`../adr/0001-dependency-and-framework-upgrade.md`](../adr/0001-dependency-and-framework-upgrade.md).

## CI Pipeline

See [diagrams/ci-pipeline.mmd](diagrams/ci-pipeline.mmd) for the visual flow.

Jobs run in this order:

1. **Lint** (ESLint + Prettier) - parallel with Typecheck and Unit Tests
2. **Typecheck** (astro check) - parallel with Lint and Unit Tests
3. **Unit Tests** (Vitest) - parallel with Lint and Typecheck
4. **Build** (astro build) - depends on all above passing
5. **E2E Tests** (Playwright) - depends on Build, uses built artefacts
