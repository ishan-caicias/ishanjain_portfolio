# Ishan Jain — Portfolio

Production-ready portfolio website with an astronomy theme, built with Astro, React islands, and TailwindCSS.

## Quick Start

```bash
npm install
npm run dev        # Start dev server at localhost:4321
```

## Scripts

| Command               | Description                         |
| --------------------- | ----------------------------------- |
| `npm run dev`         | Start development server            |
| `npm run build`       | Production build to `dist/`         |
| `npm run preview`     | Preview production build locally    |
| `npm run check`       | Run Astro type checking             |
| `npm run lint`        | Run ESLint + Prettier check         |
| `npm run lint:fix`    | Auto-fix lint and formatting issues |
| `npm run format`      | Format all files with Prettier      |
| `npm run test`        | Run unit tests (Vitest)             |
| `npm run test:watch`  | Run unit tests in watch mode        |
| `npm run test:e2e`    | Run E2E tests (Playwright)          |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI    |

## Tech Stack

- **Framework**: [Astro](https://astro.build) 5.x (static output)
- **Interactive Islands**: [React](https://react.dev) 19 (hydrated on demand)
- **Styling**: [TailwindCSS](https://tailwindcss.com) v4 (CSS-first `@theme`)
- **Animation**: CSS animations + [Motion](https://motion.dev) (React islands)
- **Testing**: [Vitest](https://vitest.dev) + [React Testing Library](https://testing-library.com) + [Playwright](https://playwright.dev)
- **CI**: GitHub Actions (lint → typecheck → unit test → build → E2E)
- **Deploy**: Netlify (static)

## Project Structure

```
src/
├── components/
│   ├── layout/          # Header, Footer, SkipLink
│   ├── sections/        # Hero, Credibility, Experience, etc.
│   ├── islands/         # React islands (Starfield, StarModal, etc.)
│   └── ui/              # Reusable components (Badge, Card, etc.)
├── content/             # Typed data (experience, skills, etc.)
├── layouts/             # BaseLayout with SEO + meta
├── pages/               # index.astro + robots.txt
├── styles/              # global.css with theme tokens
├── types/               # Shared TypeScript interfaces
└── utils/               # Hubble data loader + helpers
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Interactive Features

- **Starfield**: Canvas-based particle system with parallax and twinkling stars
- **Clickable Stars**: Golden stars open a modal with real Hubble telescope images
- **Astronaut Mascot**: Floating SVG that drifts toward active sections (desktop only)
- **Mission Control**: Footer panel with quick links (Resume, LinkedIn, GitHub, Copy Bio)

All interactive elements respect `prefers-reduced-motion` and are keyboard accessible.

### Space scene rollout

The constellation-debris travel scene is guarded by `PUBLIC_SPACE_SCENE`:

```bash
PUBLIC_SPACE_SCENE=true npm run dev
```

The default is `false`, which preserves the original Starfield hero for a safe
rollback. Set the variable to `false` to return to that hero without removing
the new scene code or assets.

When enabled, visitors can activate the Experience, Projects, and Contact
debris stations with a pointer, Enter, or Space. The scene announces departure
and arrival through an accessible live region, scrolls to the selected section,
and keeps focus on the activated station. Reduced-motion users receive the
same semantic navigation with immediate travel and no interpolated animation.

### Ship quality policy

The ship keeps its original uploaded geometry while using two browser-ready
GLBs selected from capability signals:

- **1K** (`sci-fi-aircraft-spaceship-fighter-1k.glb`, about 0.42 MiB) for data
  saver preferences, low GPU tiers, low-memory devices, and narrow/unknown
  devices.
- **2K** (`sci-fi-aircraft-spaceship-fighter-2k.glb`, about 0.85 MiB) for
  capable GPU tiers and wider screens.

Visitors can override the automatic choice with the **Ship visual quality**
selector. The ignored source retains 4K textures for conversion only; no 4K
runtime asset is shipped. If WebGL or the selected asset fails, the scene
falls back to semantic station links without decorative canvases.

The footer's **Space credits** disclosure identifies the ship title, author,
source, CC BY 4.0 license, and the conversion/optimization change.

## Hubble Images

The star modal uses a local dataset of real NASA/Hubble images. Images are public domain.

To download the images for local development:

1. Visit the source URLs listed in `public/hubble/data.json`
2. Download each image and save as WebP format (~50-80KB) in `public/hubble/images/`
3. Suggested tool: `cwebp` or any image converter

The modal degrades gracefully if images are missing, showing a text-only fallback.

### Optional: NASA APOD API

Set `PUBLIC_NASA_API_KEY` in a `.env` file to optionally fetch from NASA's Astronomy Picture of the Day API. This is purely additive — the local dataset is always available.

## Environment Variables

| Variable              | Required | Description                                                                                            |
| --------------------- | -------- | ------------------------------------------------------------------------------------------------------ |
| `PUBLIC_NASA_API_KEY` | No       | NASA API key for APOD integration                                                                      |
| `PUBLIC_SPACE_SCENE`  | No       | Set to `true` to enable the constellation-debris travel scene; defaults to the original Starfield hero |

## Testing

### Unit Tests

```bash
npm run test           # Run once
npm run test:watch     # Watch mode
```

Tests cover: StarModal (open/close/fallback), MissionControl (open/close/copy bio), Hubble data loading.

### E2E Tests

```bash
npm run build          # Build first
npm run test:e2e       # Run Playwright tests
```

Tests cover: navigation, star interaction, accessibility (axe-core scan).

The feature-gated space-scene suite builds and tests the enabled experience:

```bash
npm run test:e2e:space-scene
```

It covers station travel, keyboard and reduced-motion behavior, adaptive ship
quality, no-WebGL fallback, credits reachability, and the flag-off rollback.

### First-time E2E setup

```bash
npx playwright install chromium
```

## Deploy

Configured for Netlify with `netlify.toml`. Push to `main` triggers auto-deploy.

Build settings:

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 20

## License

All rights reserved. Content and design are personal portfolio materials.
