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
│   └── ui/          → Reusable presentational primitives
├── content/         → Domain data objects (typed, importable)
├── layouts/         → Page-level HTML templates
├── pages/           → Route definitions
├── styles/          → Design tokens and global CSS
├── types/           → Shared TypeScript interfaces
└── utils/           → Helper functions
```

### Component Boundaries

| Layer | Rendering | JS Shipped | Purpose |
|-------|-----------|------------|---------|
| `sections/` | Server (Astro) | None | Static content sections |
| `ui/` | Server (Astro) | None | Reusable UI primitives |
| `layout/` | Server (Astro) | Minimal inline | Page shell (nav has inline scroll handler) |
| `islands/` | Client (React) | Per-island bundle | Interactive features |

### React Islands

Only 4 components ship JavaScript to the client:

1. **Starfield** (`client:load`) — Canvas particle system. Loaded immediately as it's the hero background.
2. **AstronautMascot** (`client:idle`) — Floating SVG mascot. Hydrated when browser is idle.
3. **StarModal** (`client:idle`) — Hubble image modal. Hydrated when browser is idle, listens for custom events.
4. **MissionControl** (`client:visible`) — Footer quick-links panel. Hydrated when scrolled into view.

## Data Flow

```
content/*.ts  →  sections/*.astro  →  Server-rendered HTML
                                          ↓
                                    Static HTML page
                                          ↓
                              React islands hydrate on demand
                                          ↓
                              Starfield emits CustomEvent("starclick")
                                          ↓
                              StarModal listens and opens
                                          ↓
                              Fetches /hubble/data.json (local dataset)
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

- **StarModal**: Open/close mechanics, fallback handling, event system
- **MissionControl**: Panel toggle, keyboard accessibility, clipboard API
- **hubble.ts**: Data loading, error handling, fallback data

### E2E Tests (Playwright)

Focus on integration and user journeys:

- **Navigation**: Section scrolling, mobile menu, skip link
- **Star Interaction**: Custom event flow, modal content, close mechanisms
- **Accessibility**: axe-core scan, heading hierarchy, keyboard navigation, semantic landmarks

### Why Not Test Astro Components?

Astro components render to static HTML at build time. Testing them would effectively be testing Astro's compiler. Instead, E2E tests verify the rendered output in a real browser.

## Performance Considerations

- **Zero JS by default**: Astro ships no JavaScript for static sections
- **Islands architecture**: React bundles are code-split per component
- **Canvas starfield**: Single canvas element, no per-star DOM nodes
- **requestAnimationFrame**: Throttled to 60fps, paused when tab is hidden
- **prefers-reduced-motion**: Disables all animations, renders static starfield
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
1. **Lint** (ESLint + Prettier) — parallel with Typecheck and Unit Tests
2. **Typecheck** (astro check) — parallel with Lint and Unit Tests
3. **Unit Tests** (Vitest) — parallel with Lint and Typecheck
4. **Build** (astro build) — depends on all above passing
5. **E2E Tests** (Playwright) — depends on Build, uses built artefacts
