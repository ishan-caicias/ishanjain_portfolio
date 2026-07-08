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
├── lib/             → WebGL space-engine (custom element) + render helpers
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

1. **SpaceScene** (`client:load`) - Mounts the `<space-engine>` WebGL custom element (168K+
   real Hipparcos/Gaia/SDSS objects), plus the always-visible chrome under
   `islands/space/` (HUD, mission control bar, hover tooltip, warp overlay, collector-card
   and section-overlay dossiers, station sprites). Loaded immediately as it's the hero
   background. Degrades to a static CSS starfield (`_domFallback()` in `space-engine.js`)
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
                    SpaceScene dynamically imports space-engine.js +
                    celestial-*.js catalog data (client-only, browser APIs)
                                          ↓
                    <space-engine> mounts, emits cosmos:* events
                    (progress, ready, hover, select, warp, arrive, home)
                                          ↓
                    SpaceScene listens and drives HUD/dossier/overlay state;
                    header nav links warp via document-level click delegation
```

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

### E2E Tests (Playwright)

Focus on integration and user journeys:

- **Navigation**: Section scrolling (classic view), mobile menu, skip link
- **Space Scene**: Mount + live catalog data, travel-mode-by-default, nav-link warp →
  dossier open/close, RNG travel, travel/scroll mode toggle, WebGL fallback, reduced motion
- **Accessibility**: axe-core scan, heading hierarchy, keyboard navigation, semantic landmarks

### Why Not Test Astro Components?

Astro components render to static HTML at build time. Testing them would effectively be testing Astro's compiler. Instead, E2E tests verify the rendered output in a real browser.

## Performance Considerations

- **Zero JS by default**: Astro ships no JavaScript for static sections
- **Islands architecture**: React bundles are code-split per component
- **WebGL space engine**: Adaptive quality tiers, DPR clamp, and a no-WebGL DOM fallback;
  the ~7MB initial texture/catalog payload lazy-loads DSO imagery only on arrival (the
  bulk of the 38MB asset folder never loads unless visited) - see
  [delivery-plan/PF-07-space-portfolio-webgl.md](delivery-plan/PF-07-space-portfolio-webgl.md)
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

## CI Pipeline

See [diagrams/ci-pipeline.mmd](diagrams/ci-pipeline.mmd) for the visual flow.

Jobs run in this order:

1. **Lint** (ESLint + Prettier) - parallel with Typecheck and Unit Tests
2. **Typecheck** (astro check) - parallel with Lint and Unit Tests
3. **Unit Tests** (Vitest) - parallel with Lint and Typecheck
4. **Build** (astro build) - depends on all above passing
5. **E2E Tests** (Playwright) - depends on Build, uses built artefacts
