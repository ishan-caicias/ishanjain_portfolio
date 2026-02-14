Overview
Production-ready, animated portfolio for Ishan (Sydney, AU) with astronomy theme. Single-page Astro site with React islands for interactivity. Backend-leaning full-stack engineer profile with fintech risk/fraud experience.

Tech Stack
LayerChoiceRationaleFrameworkAstro 5.x (stable)Static-first, islands architecture, proven stableStylingTailwindCSS v4 (CSS-first @theme)Modern, no config file needed, CSS variablesInteractiveReact 19 islands (hydrated on demand)Only 4 components need JSAnimationCSS animations (primary) + Motion (React islands)Lightweight; Motion only where neededTestingVitest + React Testing Library + PlaywrightUnit + E2E coverageLint/FormatESLint (flat config) + PrettierModern ESLint configCIGitHub ActionsLint → Type check → Unit test → Build → E2EDeployNetlify (static adapter)Simple, free tier, auto-deploysTypesTypeScript strictVia astro/tsconfigs/strict
Theme Tokens (Royal Blue + Gold + Pine Green)
--color-royal-50:  #e8eaf6
--color-royal-100: #c5cae9
--color-royal-200: #9fa8da
--color-royal-300: #7986cb
--color-royal-400: #5c6bc0
--color-royal-500: #3f51b5
--color-royal-600: #303f9f
--color-royal-700: #283593
--color-royal-800: #1a237e
--color-royal-900: #0d1257
--color-gold-400:  #ffd54f
--color-gold-500:  #ffc107
--color-gold-600:  #ffab00
--color-pine-500:  #2e7d32
--color-pine-600:  #1b5e20
--color-surface:   #0a0e27  (deep space background)
--color-surface-elevated: #111638
--color-text:      #e8eaf6
--color-text-muted:#9fa8da

File Tree
ishanjain_portfolio/
├── .github/
│   └── workflows/
│       └── ci.yml
├── public/
│   ├── hubble/
│   │   ├── data.json              # 6 curated entries
│   │   └── images/                # 6 small WebP images (~50KB each)
│   │       ├── pillars-of-creation.webp
│   │       ├── carina-nebula.webp
│   │       ├── deep-field.webp
│   │       ├── orion-nebula.webp
│   │       ├── whirlpool-galaxy.webp
│   │       └── eagle-nebula.webp
│   ├── fonts/
│   │   ├── inter-var.woff2
│   │   └── space-grotesk-var.woff2
│   ├── favicon.svg
│   ├── og-image.png               # OpenGraph preview image
│   └── resume.pdf                 # Placeholder
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Header.astro       # Fixed nav, smooth scroll links
│   │   │   ├── Footer.astro       # SVG earth surface + engineer silhouette
│   │   │   └── SkipLink.astro     # Skip to main content (a11y)
│   │   ├── sections/
│   │   │   ├── Hero.astro
│   │   │   ├── Credibility.astro
│   │   │   ├── Experience.astro
│   │   │   ├── Achievements.astro
│   │   │   ├── Projects.astro
│   │   │   ├── Skills.astro
│   │   │   ├── Writing.astro
│   │   │   └── Contact.astro
│   │   ├── islands/               # React islands (client:visible / client:idle)
│   │   │   ├── Starfield.tsx      # Canvas particle system
│   │   │   ├── AstronautMascot.tsx# Floating SVG mascot
│   │   │   ├── StarModal.tsx      # Hubble image modal
│   │   │   └── MissionControl.tsx # Footer quick-links panel
│   │   └── ui/                    # Reusable Astro components
│   │       ├── Badge.astro
│   │       ├── Card.astro
│   │       ├── SectionHeading.astro
│   │       └── TimelineItem.astro
│   ├── content/                   # Typed data objects
│   │   ├── experience.ts
│   │   ├── achievements.ts
│   │   ├── projects.ts
│   │   └── skills.ts
│   ├── layouts/
│   │   └── BaseLayout.astro       # HTML shell, meta, fonts, global CSS
│   ├── pages/
│   │   ├── index.astro            # Single page assembling all sections
│   │   └── robots.txt.ts          # Dynamic robots.txt endpoint
│   ├── styles/
│   │   └── global.css             # TailwindCSS v4 imports + @theme tokens
│   ├── types/
│   │   └── index.ts               # Shared TypeScript interfaces
│   └── utils/
│       └── hubble.ts              # Load local dataset, optional NASA API fetch
├── tests/
│   ├── unit/
│   │   ├── StarModal.test.tsx
│   │   ├── MissionControl.test.tsx
│   │   └── hubble-utils.test.ts
│   └── e2e/
│       ├── navigation.spec.ts
│       ├── star-interaction.spec.ts
│       └── accessibility.spec.ts
├── docs/
│   ├── architecture.md
│   └── diagrams/
│       ├── sitemap.mmd
│       ├── component-flow.mmd
│       └── ci-pipeline.mmd
├── astro.config.mjs
├── tsconfig.json
├── vitest.config.ts
├── playwright.config.ts
├── package.json
├── .prettierrc
├── eslint.config.js
├── netlify.toml
└── README.md

Implementation Steps
Step 1: Scaffold + Tooling + CI + Deploy Config
Files created: package.json, astro.config.mjs, tsconfig.json, eslint.config.js, .prettierrc, vitest.config.ts, playwright.config.ts, .github/workflows/ci.yml, netlify.toml

npm create astro@latest equivalent (manual package.json for control)
Dependencies:

astro, @astrojs/react, @astrojs/sitemap, @astrojs/check
react, react-dom, motion (formerly framer-motion)
tailwindcss, @tailwindcss/vite
Dev: typescript, vitest, @testing-library/react, jsdom, @playwright/test, eslint, eslint-plugin-astro, prettier, prettier-plugin-astro


tsconfig.json extends astro/tsconfigs/strict
GitHub Actions CI:

  jobs: lint → typecheck → unit-test → build → e2e
Uses actions/checkout@v4, actions/setup-node@v4, caches node_modules

netlify.toml: build command npm run build, publish dir dist

Step 2: Base Layout + Theme + Typography + Responsive Grid
Files created: src/styles/global.css, src/layouts/BaseLayout.astro, src/components/layout/Header.astro, src/components/layout/Footer.astro, src/components/layout/SkipLink.astro, src/components/ui/*, public/favicon.svg, public/fonts/*

global.css: TailwindCSS v4 with @import "tailwindcss" + @theme block defining all color tokens, font families, and spacing scale
BaseLayout.astro: <!DOCTYPE html>, <html lang="en">, SEO meta tags (title, description, canonical, OG tags, Twitter card), font preloads, skip link, header, <main>, footer
Header: Fixed top nav with logo ("IJ" monogram), section links (smooth scroll via scroll-behavior: smooth), mobile hamburger menu (CSS-only toggle, no JS needed)
Footer: SVG earth surface horizon illustration, engineer silhouette, MissionControl island slot
Fonts: Inter (body) + Space Grotesk (headings), self-hosted woff2, font-display: swap
Reduced motion: @media (prefers-reduced-motion: reduce) disables all animations globally

Step 3: Content Sections with Tailored Copy
Files created: src/pages/index.astro, src/pages/robots.txt.ts, src/content/*.ts, src/types/index.ts, src/components/sections/*.astro
Hero Section

Headline: "Building reliable systems that move money safely"
Subheading: "Backend-leaning full-stack engineer specialising in fintech risk infrastructure, microservices, and production ownership."
Location badge: "Sydney, AU"
CTA buttons: "View my work" (scroll) + "Get in touch" (scroll to contact)
Starfield canvas behind (React island, client:load)
Astronaut mascot floating (React island, client:idle)

Credibility Section
6 icon-less bullet cards:

.NET Microservices — Event-driven services processing real-time financial decisions
AWS Cloud Infrastructure — Production workloads on ECS, SQS, S3, CloudWatch
PostgreSQL & Data — Complex query optimization, migrations, data integrity
Production Ownership — On-call, incident response, deployment pipelines
Testing & Observability — Comprehensive test suites, structured logging, alerting
CI/CD Pipelines — Automated build, test, deploy workflows across microservices

Experience Timeline
Data in src/content/experience.ts, rendered by Experience.astro using TimelineItem.astro:
typescript[
  {
    role: "Software Engineer",
    company: "Fintech Risk Platform",
    period: "2022 – Present",
    location: "Sydney, AU",
    bullets: [
      "Engineered real-time fraud decisioning services processing transactions across payment and customer lifecycle events",
      "Built and maintained .NET microservices communicating via event-driven architecture (SQS/SNS) with PostgreSQL persistence",
      "Delivered full-traffic cutovers for risk monitoring with zero downtime, achieving 100% transaction coverage",
      "Integrated with external fraud platforms and third-party risk vendors for enriched decisioning signals",
      "Led platform modernisation: .NET version upgrades, security remediation, feature flag rollouts, and defensive programming patterns",
      "Established Playwright end-to-end test suites integrated into CI/CD pipelines across multiple microservices"
    ]
  }
]
Selected Achievements (6 cards)
Data in src/content/achievements.ts:

Real-Time SMS Verification — Designed and delivered end-to-end two-way SMS verification flow for high-risk transaction activity, from API integration to production rollout
Full-Traffic Risk Monitoring — Executed full-traffic cutovers across payment and customer lifecycle monitoring, achieving 100% transaction coverage with zero incidents
Automated Case Management — Built automated case management system providing operations teams a 360-degree view of flagged activity, integrating signals from multiple risk sources
Platform Modernisation — Led .NET framework upgrades and security remediation across microservices, implementing feature flags and defensive programming for safe rollout
Auto-Decisioning Discovery — Drove discovery and design for auto-decisioning improvements via bank-statement classification, taking design ownership from problem framing to solution proposal
E2E Test Infrastructure — Established Playwright test suites integrated into CI/CD pipelines, improving deployment confidence across microservice boundaries

Projects Section
Data in src/content/projects.ts:

Project Kubera (Private, In Progress): Personal finance platform built with Clean Architecture / DDD patterns. React frontend, .NET backend, PostgreSQL. CI/CD pipeline with automated testing. Exploring AI-assisted insights layer with RAG experiments connecting to LLM APIs. Focus: architecture patterns, full-stack ownership, iterative delivery.
Trading Systems R&D (Private): Experimental quantitative trading platform exploring algorithmic strategies. High-level architecture exploration and backtesting infrastructure.
This Portfolio (Open Source): Astro + React islands with astronomy theme. Canvas starfield, interactive Hubble modal, accessible design. Demonstrates frontend craft alongside backend focus.
University Project (single line): Game development project during undergraduate studies.

Skills Section
Organized in categories with Badge.astro:

Backend: C#/.NET, ASP.NET Core, Entity Framework, Microservices, Event-Driven Architecture, REST APIs
Cloud & Infrastructure: AWS (ECS, SQS, SNS, S3, CloudWatch), Docker, Terraform
Data: PostgreSQL, SQL Server, Redis
Testing & Quality: xUnit, Playwright, Vitest, TDD, Integration Testing
CI/CD & DevOps: GitHub Actions, Azure DevOps, Feature Flags, Infrastructure as Code
Frontend: React, TypeScript, HTML/CSS, Astro
AI/ML (Exploring): RAG Patterns, Embeddings, Prompt Engineering, LLM Evaluation
Practices: Clean Architecture, DDD, SOLID, Observability, Incident Response

Writing Section
Placeholder: "Notes and thoughts on engineering — coming soon." With a muted card style.
Contact Section

Heading: "Let's connect"
Copy: "Open to interesting engineering challenges and conversations about fintech, distributed systems, or space."
Buttons: LinkedIn (icon + link), GitHub (icon + link)
No email displayed (privacy)

Step 4: Interactive Elements (React Islands)
Files created: src/components/islands/*.tsx, src/utils/hubble.ts, public/hubble/data.json, public/hubble/images/*
Starfield (client:load)

HTML5 Canvas, renders ~200 stars as small circles with varying opacity/size
Gentle parallax on mouse move (throttled to 60fps via requestAnimationFrame)
Stars twinkle via opacity oscillation
~8 stars are "special" (slightly larger, gold-tinted) — clickable, emit click event
prefers-reduced-motion: static star positions, no animation
Canvas resizes on window resize (debounced)
Performance: single canvas, no DOM elements per star, will-change: auto

Astronaut Mascot (client:idle)

Detailed inline SVG astronaut illustration (~40-50 paths, ~10-15KB)
More realistic style with helmet visor reflection, suit details, tethered cable
Default: floats gently near hero section using CSS @keyframes float
On section hover (via IntersectionObserver + mouse): astronaut "drifts" toward the active section using Motion's animate()
Reduced motion: static position, no float
Mobile: hidden below 768px (too distracting on small screens)

Star Modal (client:visible)

Triggered when user clicks a special star in the Starfield
Loads data from /hubble/data.json (6 entries)
Modal displays: image, title, date, description, credit
Close via X button, Escape key, or backdrop click
Focus trap inside modal (a11y)
Fallback: if image fails to load, show text-only card with description
Optional: if PUBLIC_NASA_API_KEY env var exists, fetch from NASA APOD API; otherwise local only
public/hubble/data.json structure:

json  [
    {
      "id": "pillars-of-creation",
      "title": "Pillars of Creation",
      "date": "2014-06-01",
      "description": "Towering columns of gas and dust in the Eagle Nebula...",
      "imagePath": "/hubble/images/pillars-of-creation.webp",
      "credit": "NASA, ESA, Hubble Heritage Team",
      "sourceUrl": "https://hubblesite.org/..."
    }
  ]

Image sourcing: Real NASA public-domain images from hubblesite.org / nasa.gov
README will include download script/URLs to fetch actual images into public/hubble/images/
Images will be optimized to ~50-80KB each in WebP format
Fallback: if images are missing, the modal shows a styled text-only card with the description

Mission Control (client:visible)

Footer: small engineer silhouette SVG (standing on earth surface)
Click silhouette → panel slides up with quick links:

Download Resume (PDF link)
LinkedIn
GitHub
Copy Bio (copies short bio to clipboard)


Panel animated with Motion AnimatePresence
Keyboard accessible: Enter/Space to open, Escape to close

Step 5: Testing
Files created: tests/unit/*.test.tsx, tests/e2e/*.spec.ts
Unit Tests (Vitest + RTL)

StarModal.test.tsx: renders modal content, closes on Escape, closes on backdrop click, shows fallback on image error, traps focus
MissionControl.test.tsx: opens panel on click, closes on Escape, renders all quick links, copy bio button works
hubble-utils.test.ts: loads local data correctly, handles missing data gracefully

E2E Tests (Playwright)

navigation.spec.ts: all nav links scroll to correct sections, mobile menu opens/closes, header becomes sticky on scroll
star-interaction.spec.ts: clicking a special star opens modal, modal displays content, modal closes correctly
accessibility.spec.ts: axe-core scan of full page (via @axe-core/playwright), keyboard navigation through all interactive elements, skip link works, reduced motion respected

Step 6: Documentation
Files created: README.md, docs/architecture.md, docs/diagrams/*.mmd
README.md

Project overview
Local development: npm install, npm run dev
Build: npm run build, npm run preview
Test: npm run test, npm run test:e2e
Lint: npm run lint, npm run format
Deploy: push to main, Netlify auto-deploys
Environment variables (optional NASA API key)

Architecture Doc

Frontend DDD structure explanation
Component boundaries (Astro static vs React islands)
Data flow: content files → Astro components → rendered HTML
Testing strategy: unit (React islands) + E2E (full page) + a11y
Performance considerations

Mermaid Diagrams

sitemap.mmd: Page structure showing sections and their relationships
component-flow.mmd: Starfield → Star click → StarModal data flow + Astronaut hover targeting
ci-pipeline.mmd: GitHub Actions workflow stages


SEO & Production Checklist

 <title> and <meta name="description"> per page
 OpenGraph and Twitter Card meta tags
 Canonical URL
 sitemap.xml via @astrojs/sitemap
 robots.txt allowing all crawlers
 Semantic HTML (<main>, <nav>, <section>, <article>, <footer>)
 Skip link for keyboard users
 alt text on all images
 aria-label on icon-only buttons
 prefers-reduced-motion respected everywhere
 Font font-display: swap for no FOIT
 Images in WebP, lazy loaded (loading="lazy")
 Favicon (SVG)
 OG image (1200x630 PNG)

Verification Plan

Dev server: npm run dev → site loads at localhost:4321, all sections render
Build: npm run build → clean build, no errors, output in dist/
Preview: npm run preview → production build serves correctly
Lint: npm run lint → zero errors
Type check: npx astro check → zero errors
Unit tests: npm run test → all pass
E2E tests: npm run test:e2e → all pass (navigation, star modal, a11y)
Manual checks: starfield animates at 60fps, astronaut floats, star click opens modal, mission control panel works, mobile responsive, reduced motion mode works
Lighthouse: Performance >90, Accessibility >95, SEO >95, Best Practices >90

Key Files to Modify/Create (Priority Order)

package.json — all dependencies and scripts
astro.config.mjs — integrations, site URL
tsconfig.json — strict TypeScript
src/styles/global.css — theme tokens
src/layouts/BaseLayout.astro — HTML shell + SEO
src/pages/index.astro — main page assembly
src/components/sections/*.astro — all 8 content sections
src/content/*.ts — typed content data
src/components/islands/*.tsx — 4 React interactive components
tests/** — unit + E2E tests
.github/workflows/ci.yml — CI pipeline
netlify.toml — deploy config
docs/** — architecture + diagrams
README.md — project documentation