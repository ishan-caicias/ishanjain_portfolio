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

| Command                       | Description                                                        |
| ----------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                 | Start development server                                           |
| `npm run build`               | Lint + typecheck + production build to `dist/`                     |
| `npm run preview`             | Preview production build locally                                   |
| `npm run check`               | Run Astro type checking                                            |
| `npm run lint`                | Run ESLint + Prettier check                                        |
| `npm run lint:fix`            | Auto-fix lint and formatting issues                                |
| `npm run format`              | Format all files with Prettier                                     |
| `npm run test`                | Run unit tests (Vitest)                                            |
| `npm run test:watch`          | Run unit tests in watch mode                                       |
| `npm run test:coverage`       | Unit tests with coverage thresholds                                |
| `npm run test:e2e`            | Run E2E tests (Playwright; build first)                            |
| `npm run test:e2e:ui`         | Run E2E tests with Playwright UI                                   |
| `npm run assets:craft`        | Rebuild the tiered ship GLB assets                                 |
| `npm run assets:planets`      | Rebuild planet surface textures (needs source pack)                |
| `npm run assets:planets:vt`   | Rebuild the virtual-texture tile pyramids                          |
| `npm run assets:sync`         | Regenerate stale planet/VT assets (auto via `predev`/`prepreview`) |
| `npm run assets:verify`       | Source-free asset gate (auto via `prebuild`, CI)                   |
| `npm run gaia:pipeline`       | Gaia Sky dataset → site-format conversion                          |
| `npm run budget:check`        | CI bundle + asset weight gate (needs `dist/`)                      |
| `npm run budget:check:assets` | Asset-weight-only gate (no build needed; runs in CI's lint job)    |
| `npm run docs:check`          | Documentation-drift gate (indexes, links)                          |

## Tech Stack

- **Framework**: [Astro](https://astro.build) 7 (static output, islands architecture)
- **Interactive Islands**: [React](https://react.dev) 19 (hydrated on demand)
- **Styling**: [TailwindCSS](https://tailwindcss.com) v4 (CSS-first `@theme` tokens)
- **3D — shipping default**: [Babylon.js](https://www.babylonjs.com) 8 on **WebGPU** (WebGL2
  fallback) — a 168,959-star photometric field plus real-catalog bulk layers (SDSS DR18's
  3.64M-galaxy deep field, 359K eDR3 white dwarfs, CNS5, cluster background), a 154,662-object
  Gaia DR3 asteroid belt with Keplerian orbital motion and a
  [Havok](https://www.havok.com) rigid-body physics subset (lazy WASM), volumetric
  compute-raymarched nebulae (NGC2000 catalog), real textured planet spheres with
  virtual-texture topography streaming, and a GLB ship with thruster/shimmer FX
- **3D — archived legacy**: bespoke WebGL1 engine (`src/lib/space-engine.js` custom element),
  still shipped behind `?engine=webgl` as the cutover rollback lever
- **Animation**: CSS animations + [Motion](https://motion.dev) (React islands)
- **Testing**: [Vitest](https://vitest.dev) + React Testing Library + [Playwright](https://playwright.dev)
- **CI**: GitHub Actions (lint → typecheck → unit test → build → E2E smoke subset), CodeQL,
  Dependabot, and a branch-protection ruleset on `main` — see
  [CI/CD & Repo Governance](#cicd--repo-governance) below
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
├── data/celestial/      # Curated celestial catalogs (generated JS modules — never hand-edited;
│                        #   bulk layers ship as PNG-packed assets in public/assets/)
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

- **Pre-flight & launch**: a real-progress loading dossier (byte-accurate, never a timed
  animation) followed by a launch-from-Earth cinematic ascent, revealing Earth's real day/night
  terminator on the way up.
- **Space Scene**: star-flight hero with warp travel between portfolio sections, each docked to
  a real celestial object. Degrades to a static CSS starfield with full navigation if WebGL is
  unavailable.
- **Cinematic flight** (default Babylon path): chase-camera journeys with accel/flip/decel
  burns, a GLB fighter with layered thruster plume + heat shimmer, volumetric nebulae that
  reveal on approach, and a rigid-body asteroid belt with idle collisions (Havok).
- **Frame ladder (sky honesty by destination)**: solar-system furniture (the asteroid belt) and
  the local Milky Way collapse out of view at DSO/extragalactic range, the way the real sky
  actually would, with an external-galaxy impostor standing in beyond the local group.
- **Curated destinations**: 4,800+ charted bodies render as type-shaded beacons (star, planet,
  nebula, galaxy, cluster, deep field), with real NASA/ESA photographic imagery for the
  267-body atlas-mapped subset and real textured, sun-lit, rotating planet spheres (with real
  MOLA/LOLA topography and a Venus cloud-deck descent) for the arrival views of 16 bodies.
- **Where-To console**: a ranked, ARIA-combobox search across the full catalog (bodies,
  stations, and field-star classes), with an arrival dossier card per destination.
- **Render Console**: a settings panel that turns automatic device-quality tiers into
  user-adjustable presets — multi-select which layers render (the SDSS deep field, the DR3
  asteroid belt's visual/physics halves, nebulae, the Milky Way band, and more), each with an
  honest byte/vertex cost label and live measured fps, persisted across visits.
- **Real-data sky**: the star field, asteroid belt, galaxy deep field, star clusters, white
  dwarfs, GD-1 stellar stream, and NGC2000 nebulae all derive from real Gaia/SDSS/survey
  catalogs — real positions, real photometry, real orbital mechanics (the belt's Kirkwood gaps
  emerge from the data, not from a noise function).
- **Sky backdrop**: a procedural Milky Way band, constellation figures for named star patterns,
  and radial star-streak trails during warp.
- **Engine parity**: any remaining Babylon-vs-legacy deltas are tracked in
  [the cutover gap analysis](docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md);
  `?engine=webgl` remains the archived rollback lever.
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

## CI/CD & Repo Governance

- **CI** (`.github/workflows/ci.yml`): lint/format → typecheck → unit tests → build (+ bundle/
  asset budget gate) → an E2E smoke subset (Playwright, chromium). Every job pulls real Git LFS
  asset bytes rather than the ~130-byte pointer stubs a default checkout gets — see the
  workflow's own comments if a job needs asset files it doesn't already fetch them for.
- **CodeQL** (`.github/workflows/codeql.yml`): static security analysis on push/PR to `main`
  and weekly; results surface in the repo's Security tab, not as a required merge check.
- **Dependabot** (`.github/dependabot.yml`): weekly grouped update PRs for npm and GitHub
  Actions dependencies.
- **Branch protection**: `main` requires a PR (no direct pushes), a linear history (squash/
  rebase only), and all five CI jobs green — see [`.github/rulesets/`](.github/rulesets/) for
  the versioned ruleset source and how to re-apply it.
- The **full** local test suite (`npm run build && npm run test && npm run test:e2e &&
npm run budget:check`) remains the authoritative pre-push gate (CLAUDE.md #25) — CI's E2E
  job is a smaller, fast correctness canary, not a replacement for it. See
  [`docs/cicd/`](docs/cicd/README.md) for the full history of why.

## License

All rights reserved. Content and design are personal portfolio materials.
Third-party asset licenses: see `public/assets/craft/LICENSE.txt` and `public/assets/dso/`.
