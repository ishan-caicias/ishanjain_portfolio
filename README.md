# Ishan Jain — Portfolio

An interactive, gamified software-engineering portfolio with an astronomy theme: fly a ship
through a real star catalog and warp between portfolio sections docked to real celestial
objects. Built with Astro islands, React, TailwindCSS, and a real-time 3D space engine.

## Quick Start

```bash
npm install
npm run dev        # Start dev server at localhost:4321
```

## Scripts

| Command                 | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `npm run dev`           | Start development server                       |
| `npm run build`         | Lint + typecheck + production build to `dist/` |
| `npm run preview`       | Preview production build locally               |
| `npm run check`         | Run Astro type checking                        |
| `npm run lint`          | Run ESLint + Prettier check                    |
| `npm run lint:fix`      | Auto-fix lint and formatting issues            |
| `npm run format`        | Format all files with Prettier                 |
| `npm run test`          | Run unit tests (Vitest)                        |
| `npm run test:watch`    | Run unit tests in watch mode                   |
| `npm run test:coverage` | Unit tests with coverage thresholds            |
| `npm run test:e2e`      | Run E2E tests (Playwright; build first)        |
| `npm run test:e2e:ui`   | Run E2E tests with Playwright UI               |
| `npm run assets:craft`  | Rebuild the tiered ship GLB assets             |
| `npm run budget:check`  | CI bundle-size gate (needs `dist/`)            |
| `npm run docs:check`    | Documentation-drift gate (indexes, links)      |

## Tech Stack

- **Framework**: [Astro](https://astro.build) 7 (static output, islands architecture)
- **Interactive Islands**: [React](https://react.dev) 19 (hydrated on demand)
- **Styling**: [TailwindCSS](https://tailwindcss.com) v4 (CSS-first `@theme` tokens)
- **3D — shipping default**: [Babylon.js](https://www.babylonjs.com) 8 on **WebGPU** (WebGL2
  fallback) — 168,959 real Hipparcos/Gaia/SDSS objects as photometric billboards, volumetric
  compute-raymarched nebulae, GLB ship with thruster/shimmer FX, and a
  [Havok](https://www.havok.com) physics asteroid field (lazy WASM)
- **3D — archived legacy**: bespoke WebGL1 engine (`src/lib/space-engine.js` custom element),
  still shipped behind `?engine=webgl` as the cutover rollback lever
- **Animation**: CSS animations + [Motion](https://motion.dev) (React islands)
- **Testing**: [Vitest](https://vitest.dev) + React Testing Library + [Playwright](https://playwright.dev)
- **CI**: GitHub Actions (lint → typecheck → unit test → build → E2E)
- **Deploy**: Netlify (static, Node 22)

## The Dual-Engine Seam

The Babylon.js + WebGPU + Havok engine **is the default as of the PF-09 B6 cutover**
([ADR-0006](docs/adr/0006-babylon-default-cutover.md), 2026-07-19):

- **Default** — the Babylon path: WebGPU-first with WebGL2 fallback, photometric star
  billboards, destination-gated volumetric nebulae (WebGPU compute raymarch / WebGL2 fragment
  fallback), the GLB ship with flip-and-burn thrusters + heat shimmer, the Havok asteroid belt
  with proximity slowdown/deflection/impact shake, and full/balanced/lite quality tiers.
- `?engine=webgl` — the **archived** legacy WebGL1 engine, kept fully functional for one
  release as the rollback lever.
- `?perf=1` — on-screen perf telemetry (`window.__ijPerf()`), used for all performance claims.
- `?craft=1k|2k|off` — ship-quality override; `?tier=full|balanced|lite` — quality-tier
  override (auto device-tiered otherwise).

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
├── data/celestial/      # PNG-packed Hipparcos/Gaia/SDSS catalog data (generated)
├── lib/                 # Engines + pure modules:
│   │                    #   babylon-engine.ts (Babylon/WebGPU — the default)
│   │                    #   space-engine.js (WebGL1 — archived, ?engine=webgl)
│   │                    #   ship-dynamics, star-field/catalog, nebula-field,
│   │                    #   babylon-ship, babylon-asteroids, craft-tier, engine-select
├── layouts/             # BaseLayout with SEO + meta
├── pages/               # index.astro + robots.txt
├── styles/              # global.css with theme tokens
└── types/               # Shared TypeScript interfaces
```

Deep documentation lives in `docs/`: delivery plans (`docs/delivery-plan/`), numbered ADRs
(`docs/adr/`), and per-increment test reports (`docs/test-reports/`) — the docs tree is the
project's source of truth for decisions and verification history.

## Interactive Features

- **Space Scene**: star-flight hero with warp travel between portfolio sections, each docked to
  a real celestial object. Degrades to a static CSS starfield with full navigation if WebGL is
  unavailable.
- **Cinematic flight** (default Babylon path): chase-camera journeys with accel/flip/decel
  burns, a GLB fighter with layered thruster plume + heat shimmer, volumetric nebulae that
  reveal on approach, and a rigid-body asteroid belt with idle collisions (Havok).
- **Curated destinations**: every catalog body renders as a type-shaded beacon (star, planet,
  nebula, galaxy, cluster, deep field), with real NASA/ESA photographic imagery and lit rotating
  globes for the 267-body atlas-mapped subset.
- **Sky backdrop**: a procedural Milky Way band, constellation figures for named star patterns,
  and radial star-streak trails during warp.
- **Known post-cutover deltas**: the Babylon path still has no field-star hover, station sprite
  markers, or free-look drag — tracked in
  [the cutover gap analysis](docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md).
  `?engine=webgl` still has them.
- **Classic View Toggle**: switch between travel mode and a traditional scrolling page.
- **Astronaut Mascot**: floating SVG that drifts toward active sections (desktop only).
- **Mission Control**: footer panel with quick links (Resume, LinkedIn, GitHub, Copy Bio).

All interactive elements respect `prefers-reduced-motion` and are keyboard accessible
(axe-core-scanned in E2E).

## Testing

```bash
npm run test           # Unit (Vitest, jsdom; 80% coverage thresholds)
npm run build          # E2E prerequisite — Playwright serves the built dist/
npm run test:e2e       # E2E (Playwright, chromium)
```

The suite spans both engines: pure-math modules (flight dynamics, star photometry, nebula
raymarch mirrors, plume/asteroid builders), scene chrome, navigation, accessibility, reduced
motion, WebGL fallback, and Babylon-path integration (catalog identity, travel choreography,
nebula reveal gating, ship lifecycle, Havok boot + real motion). An opt-in real-hardware spec
(`tests/e2e/webgpu-hardware.spec.ts`, local only) validates the WGSL/WebGPU path on a real GPU
via the installed Chrome. Current counts are recorded per increment in
[docs/test-reports/](docs/test-reports/README.md).

First-time E2E setup: `npx playwright install chromium`

## Deploy

Configured for Netlify with `netlify.toml`. Push to `main` triggers auto-deploy.

- **Build command**: `npm run build`
- **Publish directory**: `dist`
- **Node version**: 22 (engine requirement `>=22.12.0`)

## License

All rights reserved. Content and design are personal portfolio materials.
Third-party asset licenses: see `public/assets/craft/LICENSE.txt` and `public/assets/dso/`.
