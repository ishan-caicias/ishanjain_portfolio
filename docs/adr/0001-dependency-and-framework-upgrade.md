# ADR-0001 — Dependency & Framework Upgrade (incl. TypeScript target)

- **Status:** Accepted
- **Date:** 2026-07-13
- **Deciders:** Repository owner (via decision prompt), Orion
- **Verification:** [TR-010](../test-reports/TR-010.md) · **Security:** [OWASP audit](../security/2026-07-13-owasp-audit-and-hardening.md)

## Context

The project was on Astro 5.17, TypeScript 5.9, Vitest 2, ESLint 9, and React 19.2, with **29 open
npm advisories** (2 critical, 13 high) — including high-severity Astro XSS/SSRF and a critical
Vitest UI file-read/execute. The task was to upgrade to TypeScript 7, bring all other dependencies
to suitable versions, clear CVEs, and harden per OWASP.

Two decisions were non-obvious and are recorded here.

## Decision 1 — TypeScript target: 6.0.3, not 7

TypeScript 7.0.2 is the current `latest` stable tag, but the project's TypeScript-consuming
tooling does not support it:

| Tool                                                     | Peer requirement             | Supports TS 7?                              |
| -------------------------------------------------------- | ---------------------------- | ------------------------------------------- |
| `@astrojs/check` 0.9.9 (the `npm run check` typechecker) | `typescript: ^5 \|\| ^6`     | No                                          |
| `typescript-eslint` 8.63.0 (typed linting)               | `typescript: >=4.8.4 <6.1.0` | No (no released/canary build supports 6.1+) |

Installing TS 7 would break `check` and `lint`. **Decision: upgrade to TypeScript 6.0.3** — the
highest version both tools accept — pinned as **`~6.0.3`** (not `^6.0.3`) so a future 6.1 release
cannot silently violate the `typescript-eslint` `<6.1.0` ceiling.

Alternatives rejected:

- **Force TS 7 via overrides** — breaks the typecheck and typed-lint gates; not production-safe.
- **Stay on 5.9** — leaves the project a full major behind with no upside once 6.0.3 is proven green.

## Decision 2 — Full upgrade (accept breaking majors) to clear all CVEs

The high/critical advisories have no non-breaking fix:

- Astro `<=6.4.5` is vulnerable (6 advisories) → fix requires **Astro 7**.
- The critical Vitest UI advisory → fix requires **Vitest 4**.

**Decision: take all suitable majors** — Astro 5→7, Vitest 2→4, @astrojs/react 4→6, ESLint 9→10,
jsdom 25→29, motion 11→12 — plus all patch/minor updates, targeting **0 known vulnerabilities**.
Node 24 satisfies Astro 7's `>=22.12` and Vitest 4's engine requirements, so no runtime change was
needed.

Alternatives rejected:

- **Security-only** — would still require Astro 7 + Vitest 4; deferring the other majors only
  delays inevitable churn on a small, well-tested codebase.
- **Patch-only (`npm audit fix` without `--force`)** — leaves the Astro XSS/SSRF and critical
  Vitest advisories unresolved. Contradicts the security goal.

## Consequences

- **Positive:** 0 CVEs; modern toolchain; OWASP headers/CSP enabled (see security doc); full suite
  green (8 unit + 30 E2E) under the new stack.
- **Cost:** Prettier 3.9 reflowed 4 markdown docs (formatting only). One small refactor in
  `space-engine.js` (inline `<style>` → `global.css`) was needed for the hash-based CSP.
- **Trade-off:** TypeScript held one major below `latest`.

## Follow-up (TS 7 adoption trigger)

Revisit the TypeScript 7 upgrade when **both** `@astrojs/check` and `typescript-eslint` publish
versions whose peer ranges admit `typescript >= 7`. At that point: bump `typescript` to `^7`,
bump both tools, run `npm run check` + `npm run lint` + full test suite, and supersede this ADR.
