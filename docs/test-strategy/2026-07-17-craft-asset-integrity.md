# Test Strategy — Craft Asset Integrity Layer (PF-07 ship-v2)

**Date:** 2026-07-17
**Introduced by:** Phase 0 ([TR-014](../test-reports/TR-014.md))

## What This Layer Protects

The ship-v2 feature depends on two committed binary GLBs that are **build artefacts of an
offline pipeline** whose 255 MB source input is git-ignored. Nothing in the normal build would
notice if they were corrupted, regenerated with wrong settings, over budget, or missing — until
the P1 renderer failed at runtime. This layer makes those failures test failures instead.

## Layers

| Layer                     | File                                | Covers                                                                                                                                                                                                                                                                                           |
| ------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unit/integration (vitest) | `tests/unit/craft-assets.test.ts`   | GLB container validity (magic/version/length), per-tier byte budgets (0.6 / 1.2 MiB), the **P1 loader contract** (1 mesh, 1 primitive, 1 material, 0 animations, exact per-tier vertex counts, all-WebP textures, exactly the 3 extensions the loader implements), CC-BY-4.0 attribution content |
| E2E (Playwright)          | `tests/e2e/craft-assets.spec.ts`    | Assets actually served by the built site (Astro `public/` → `dist/` copy), correct magic bytes, budget-conform transfer size, license file served                                                                                                                                                |
| Pipeline self-check       | `npm run assets:craft` (`--verify`) | Determinism: double-build sha256 comparison; budget enforcement at build time (non-zero exit)                                                                                                                                                                                                    |

## The Loader-Contract Principle

The unit tests pin the **exact** `extensionsUsed` set. If a future pipeline change introduces a
new extension (e.g. Draco, KTX2), the test fails — deliberately. The P1 in-engine loader is
purpose-built for this known asset shape; any change to that shape must be a conscious,
coordinated change to both pipeline and loader, not a silent drift.

## LFS-Pointer Awareness

CI checks out without `lfs: true`, so every LFS-stored binary (the existing images and now the
GLBs) is a ~130-byte pointer stub there. Both test layers detect the pointer prefix
(`version https://git-lfs.github.com/spec/v1`) and skip binary assertions with an explicit
message, running fully on dev machines. This mirrors the de-facto behaviour of the existing
image assets on CI rather than inventing a new CI posture mid-phase. Revisit at P5 (HARDEN):
either enable `lfs: true` on CI (bandwidth-quota trade-off) or accept dev-side-only binary
validation permanently.
