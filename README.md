# Ishan Jain — Portfolio

Production-ready portfolio website with an astronomy theme, built with Astro, React islands, and TailwindCSS.

## Quick Start

```bash
npm install
npm run dev        # Start dev server at localhost:4321
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build to `dist/` |
| `npm run preview` | Preview production build locally |
| `npm run check` | Run Astro type checking |
| `npm run lint` | Run ESLint + Prettier check |
| `npm run lint:fix` | Auto-fix lint and formatting issues |
| `npm run format` | Format all files with Prettier |
| `npm run test` | Run unit tests (Vitest) |
| `npm run test:watch` | Run unit tests in watch mode |
| `npm run test:e2e` | Run E2E tests (Playwright) |
| `npm run test:e2e:ui` | Run E2E tests with Playwright UI |

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

| Variable | Required | Description |
|----------|----------|-------------|
| `PUBLIC_NASA_API_KEY` | No | NASA API key for APOD integration |

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
