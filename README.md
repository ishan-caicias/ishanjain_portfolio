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
│   ├── islands/         # React islands (SpaceScene, AstronautMascot, MissionControl)
│   │   └── space/       # Space scene chrome (HUD, dossiers, station sprites, etc.)
│   └── ui/              # Reusable components (Badge, Card, etc.)
├── content/             # Typed data (experience, skills, etc.)
├── data/celestial/      # Ported Hipparcos/Gaia/SDSS catalog data
├── lib/                 # WebGL space-engine (custom element) + render helpers
├── layouts/             # BaseLayout with SEO + meta
├── pages/               # index.astro + robots.txt
├── styles/              # global.css with theme tokens
└── types/               # Shared TypeScript interfaces
```

See [docs/architecture.md](docs/architecture.md) and
[docs/delivery-plan/PF-07-space-portfolio-webgl.md](docs/delivery-plan/PF-07-space-portfolio-webgl.md)
for detailed architecture documentation.

## Interactive Features

- **Space Scene**: A WebGL star-flight hero (168K+ real Hipparcos/Gaia/SDSS objects) with
  relativistic warp travel between portfolio sections, each docked to a real celestial object.
  Degrades to a static CSS starfield with full navigation if WebGL is unavailable.
- **Classic View Toggle**: Switches between the space scene's travel mode and a traditional
  scrolling page at any time.
- **Astronaut Mascot**: Floating SVG that drifts toward active sections (desktop only)
- **Mission Control**: Footer panel with quick links (Resume, LinkedIn, GitHub, Copy Bio)

All interactive elements respect `prefers-reduced-motion` and are keyboard accessible.

## Testing

### Unit Tests

```bash
npm run test           # Run once
npm run test:watch     # Watch mode
```

Tests cover: MissionControl (open/close/copy bio) and space-scene helpers (`src/lib/spaceHelpers.ts`).

### E2E Tests

```bash
npm run build          # Build first
npm run test:e2e       # Run Playwright tests
```

Tests cover: navigation, the space scene (mount, travel, dossiers, WebGL fallback, reduced motion), accessibility (axe-core scan).

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
