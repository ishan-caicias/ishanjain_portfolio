# E2E shard matrix — preserving the "E2E Tests" required status check

> **⚠ SUPERSEDED (2026-07-25, later same day — TR-106).** The shard matrix this doc describes
> was replaced by a curated CI smoke subset the same day it was first verified. Left in place,
> not deleted, per this repo's additive-correction rule — the reasoning below (workers:1 vs.
> sharding being orthogonal) is still correct and may matter again if CI hardware ever changes.
> See [2026-07-25-e2e-ci-smoke-subset.md](2026-07-25-e2e-ci-smoke-subset.md) for what replaced
> it and why. Also: **the branch-protection concern below never applied** — `main` has no
> branch protection configured at all (confirmed via `gh api .../branches/main/protection` →
> 404 "Branch not protected"), so the `e2e-summary` aggregator job was solving a problem that
> didn't exist. Harmless (it worked as designed), just unnecessary.

Date: 2026-07-25 (Procyon). Implements recommendation #1 of
[the same-day E2E performance audit](../analysis/2026-07-25-e2e-suite-performance-and-staleness-audit.md);
verified in [TR-104](../test-reports/TR-104.md).

## Decision

`.github/workflows/ci.yml`'s single `e2e` job (which ran the full ~150-test Playwright suite
serially on one `ubuntu-latest` runner, ~42-48 min) is now a 4-way `strategy.matrix.shard`
running `npx playwright test --shard=${{ matrix.shard }}/${{ strategy.job-total }}` on 4 separate
runners. `workers: 1` stays in effect **inside** each shard (`playwright.config.ts`, unchanged) —
sharding and local worker-count are orthogonal: `workers:1` exists to stop N workers
time-slicing ONE GPU on ONE machine (TR-018/TR-052); shards run on separate machines with no
shared GPU, so that failure mode doesn't apply across shards.

## The branch-protection problem this solves for

Converting a job to a matrix changes its GitHub check name from `"E2E Tests"` to 4 names like
`"E2E Tests (1/4)"`, `"E2E Tests (2/4)"`, etc. Any existing branch-protection rule requiring the
single `"E2E Tests"` status check would break the moment this shipped, with no warning short of
the next PR failing to merge. This is the same class of problem TR-034 already solved for
`docs:check`/`assets:verify` (added as steps inside the existing `lint`/`build` jobs rather than
new jobs, specifically to avoid this).

**Fix:** a new `e2e-summary` job (`needs: e2e`, `if: always()`) is named `"E2E Tests"` — the
exact name the old single job had — and fails if any shard's result wasn't `"success"`. Branch
protection continues requiring the same name; the shards underneath it are an implementation
detail.

## What this does not change

- Local `npm run test:e2e` still runs the whole suite serially, `workers: 1`, on one machine —
  unaffected by this change, and not expected to get faster from it (see TR-104's honest
  discussion of why the local number went up, not down, in the same pass this shipped in).
- No branch-protection ruleset itself was edited (out of scope for a repo-local change — that
  lives in GitHub's UI/settings, per [the 2026-07-19 Node runtime & branch protection
  doc](2026-07-19-node-runtime-and-branch-protection.md)'s pattern). If the org's ruleset
  explicitly lists `"E2E Tests"` by name, no action is needed; if it was somehow pointed at the
  old job id (`e2e`) rather than its display name, that would need updating separately —
  unconfirmed from this session, flagged for the owner to check in GitHub's settings.

## Verification status

The shard matrix has been validated for YAML correctness and local reasoning only. **It has not
yet run in real GitHub Actions** — that first real run is what actually tests whether 4 shards
bring CI wall-clock from ~42 min toward the estimated ~11-15 min, since that benefit is
structurally unmeasurable on a local single-machine run (see TR-104).
