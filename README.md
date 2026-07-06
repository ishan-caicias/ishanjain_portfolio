# Ishan Jain - Portfolio

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
└── utils/               # Hero DSO data loader + helpers
```

See [docs/architecture.md](docs/architecture.md) for detailed architecture documentation.

## Interactive Features

- **Starfield**: Canvas-based particle system with parallax and twinkling stars
- **Clickable Stars**: Golden stars reveal a real deep-sky-object photo in the hero background
- **Astronaut Mascot**: Floating SVG that drifts toward active sections (desktop only)
- **Mission Control**: Footer panel with quick links (Resume, LinkedIn, GitHub, Copy Bio)

All interactive elements respect `prefers-reduced-motion`. Star discovery itself is mouse-driven
(canvas hit-testing, no keyboard equivalent yet); the reveal's dismiss control and credit/license
link are fully keyboard accessible once a reveal is open.

## Hero Deep-Sky-Object Images

Clicking a gold star reveals a real astrophotography image of that object, sourced from Wikimedia
Commons and pre-filtered to Public Domain / CC0 / CC BY licenses only (see
`scripts/hero/rejected.json` for what was excluded and why). A small persistent credit line -
with a license link when required - stays visible while a reveal is active.

To regenerate the shipped dataset (`public/hero-dso/manifest.json` + `public/hero-dso/images/*.webp`)
from the license-vetted sources in `scripts/hero/source/`:

```bash
node scripts/hero/build-hero-dso.mjs
```

This dedupes objects catalogued under both a Messier and NGC number and converts the survivors to
WebP. Raw source images aren't committed (see `.gitignore`); only the per-object `.attribution.json`
provenance files and the build script are.

### Optional: NASA APOD API

Set `PUBLIC_NASA_API_KEY` in a `.env` file to optionally fetch from NASA's Astronomy Picture of the Day API via `src/utils/nasaApod.ts`. This is unrelated to the hero star-click feature and not currently wired into any UI.

## Environment Variables

| Variable              | Required | Description                       |
| --------------------- | -------- | --------------------------------- |
| `PUBLIC_NASA_API_KEY` | No       | NASA API key for APOD integration |

## Testing

### Unit Tests

```bash
npm run test           # Run once
npm run test:watch     # Watch mode
```

Tests cover: HeroBackgroundReveal (reveal/dismiss/fallback), MissionControl (open/close/copy bio), hero DSO manifest loading.

### E2E Tests

```bash
npm run build          # Build first
npm run test:e2e       # Run Playwright tests
```

Tests cover: navigation, star interaction, accessibility (axe-core scan).

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
