# CI E2E model: curated smoke subset, local machine is the real gate

Date: 2026-07-25 (Procyon). Supersedes
[2026-07-25-e2e-shard-matrix.md](2026-07-25-e2e-shard-matrix.md) the same day it was first
verified. Verified in [TR-106](../test-reports/TR-106.md).

## What happened

[TR-105](../test-reports/TR-105.md) fixed the real reason CI E2E had never passed: Git LFS
assets were never fetched, so CI built from pointer stubs. With that fixed, the 4-shard matrix
ran against a **correct** build for the first time (run 30151830432 → 30156141504) and came back
**13 real failures** across 6 files: `ascent`, `camera-zoom`, `craft-ship`,
`d64-owner-bugfixes`, `engine-select`, `frame-ladder`. Every one is a timeout/margin miss —
`d64-owner-bugfixes.spec.ts:254` literally exceeded its 150-second test timeout mid-arrival.
GitHub's free `ubuntu-latest` runners (2 vCPU) cannot software-render this scene's real travel
sequences fast enough to hold timeouts calibrated on the owner's 16-core machine.

**A scan of the last 20 CI runs found E2E had failed on every single one**, going back weeks —
this was never caused by sharding or by any change in this session. The LFS fix produced the
first-ever green E2E job in this repo's CI history (shard 4, 34/34 clean).

## The decision

Given that, the owner chose: **CI runs a small, fast, proven-clean smoke subset; the local
machine remains the full 150-test pre-push gate** (CLAUDE.md #25 is unaffected — the full gate
is still required before a slice is "done", it's just not also the CI check).

This replaces the 4-shard matrix (which existed only to fit the full 150 tests inside CI's
practical time budget) with a single unsharded job:

```
tests/e2e/accessibility.spec.ts    tests/e2e/perf-budgets.spec.ts
tests/e2e/craft-assets.spec.ts     tests/e2e/webgpu-hardware.spec.ts (fails open/skips in CI)
tests/e2e/page-load-console.spec.ts tests/e2e/funnel.spec.ts
tests/e2e/navigation.spec.ts       tests/e2e/planet-pixels.spec.ts
                                    tests/e2e/load-progress.spec.ts
```

**Selection criterion, not vibes:** every file above had **zero failures** in the real
30156141504 run, except `load-progress.spec.ts` — its 2 failures were a separate, unrelated bug
(below), not a hardware-ceiling miss. ~39 of 150 tests; confirmed locally at 39/39 passed in
2.6 min before pushing.

**Explicitly excluded, and why:** `ascent`, `camera-zoom`, `craft-ship`, `d64-owner-bugfixes`,
`engine-select`, `frame-ladder` are real, valuable regression coverage that this hardware
cannot run reliably — excluding them from CI is not a coverage decision, it's a hardware-fit
decision. They keep running locally, in full, on every pre-push gate. If
[Lever B](../test-reports/TR-105.md) (a test-boot flag skipping the 3 heavy background layers)
lands and lightens these files' per-boot cost, some may become CI-viable again — worth
re-checking then, not assumed now.

## A second, unrelated bug fixed in the same pass

`load-progress.spec.ts:143` does `sizeOf("public/assets/stars-hip.png")` — a direct
`fs.statSync` against **this job's own checkout**, not the downloaded `dist/` artifact. The
`build` job's checkout got the TR-105 LFS fix; this job's checkout did not, so it read
pointer-stub sizes (263 bytes) while the live served page (built from the LFS-fixed `dist`)
correctly reported real bytes (2,891,934) — a mismatch, but not the hardware-ceiling class of
failure above. Fixed by giving the smoke job the same LFS+cache checkout pattern as `build`/
`lint`. Grepped all 9 smoke files for `fs.readFileSync`/`statSync`/`sizeOf` — only this one
file does direct disk reads, so no other file needed the same check.

## What this does not change

- The **full 150-test local gate stays required** before any slice is called done (CLAUDE.md
  #25) — this is a CI-scope decision, not a test-coverage or quality-bar decision.
- `workers: 1` is unaffected either locally or in CI (TR-105's re-measurement already closed
  that question independently — parallelism is unsafe on the current scene weight regardless of
  where it runs).
- No branch-protection ruleset needed updating: `main` has **no branch protection configured**
  (`gh api repos/.../branches/main/protection` → 404). The prior doc's whole "preserve the
  required-check name" concern was moot from the start — noted there as a superseding
  correction, not deleted.

## Verification status

Pushed and watched to completion in [TR-106](../test-reports/TR-106.md) — the first genuinely
green CI run in this repo's history.
