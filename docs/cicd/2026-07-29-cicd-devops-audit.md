# CI/CD & devops readiness audit: 3 live gaps found and closed

Date: 2026-07-29 (Procyon). Owner request: verify README/CLAUDE.md/.gitignore are current, add
GitHub CI workflows, ensure base CI/CD & devops readiness, add branch protection for `main`,
and check for gaps rather than assume any of it already works.

## What was checked, and what was actually found

The repo already had `.github/workflows/ci.yml` and a tracked `.github/rulesets/
main-protection.json` (since 2026-07-19) — the instinct going in was "verify, don't rebuild."
Verifying against the LIVE GitHub state (`gh api`, not just reading the tracked files) found
three real, active gaps:

### 1. `main` had ZERO branch protection live, despite the ruleset file existing since 2026-07-19

`gh api repos/.../rulesets` returned `[]`. `gh api repos/.../branches/main/protection` returned
`404 Branch not protected`. `docs/cicd/2026-07-25-e2e-ci-smoke-subset.md`'s own README row had
already recorded this in passing ("moot — `main` has no branch protection configured") but
nothing had gone back to actually apply it. **Fixed:** applied via
`gh api --method POST repos/:owner/:repo/rulesets --input .github/rulesets/main-protection.json`
(ruleset id `19944626`, `enforcement: active`, confirmed live).

### 2. The ruleset's required status check was already stale

`main-protection.json` required a context named `"E2E Tests"`. The actual CI job (since
[TR-106](../test-reports/TR-106.md), 2026-07-25) is named `"E2E Smoke Tests"`. Had the ruleset
been applied as-is, every future PR would have waited forever on a check that will never report
— exactly the failure mode `.github/rulesets/README.md` already warns about, just never caught
because the ruleset had never actually been live to notice it against. **Fixed:** updated the
JSON before applying. New CLAUDE.md non-negotiable #28 records this as a standing rule (job
rename = two-file change, workflow + ruleset).

### 3. CI was live-red on the currently open PR (#6) — a gap this session's own work exposed

`gh run view` on the latest run showed `Unit Tests` failing:

```
AssertionError: expected 132 to be 2081206
AssertionError: expected 133 to be 47125068
```

PF-11 D9.3 (same session, see [TR-112](../test-reports/TR-112.md)) added
`tests/unit/render-layers.test.ts` assertions that `statSync()` real files under
`public/assets/` to cross-check `budgets.config.mjs`'s `layerBytes` against real on-disk sizes.
The `unit-test` CI job's checkout had no Git-LFS pull step — every `*.png` under `public/assets`
is LFS-tracked (`.gitattributes`), so a default checkout gets ~130-byte pointer stubs. This is
the exact class of defect TR-105 already fixed for the `lint`/`build`/`e2e-smoke` jobs (which
all fetch LFS content with a cache-keyed `git lfs pull`) — `unit-test` had simply never needed
real asset bytes before D9.3 reached it. **Fixed:** added the same cache-keyed LFS-pull pattern
to `unit-test`, copied verbatim from the `lint` job.

## Other devops-readiness gaps closed in the same pass

- **No explicit `permissions:` on `ci.yml`** — added `contents: read` at the workflow level
  (least-privilege default; none of the 5 jobs push, comment, or need broader access).
- **No Dependabot** — added `.github/dependabot.yml` (weekly, grouped patch/minor PRs for npm;
  separate weekly group for GitHub Actions versions; TypeScript major-version bumps excluded
  per ADR-0001's deliberate TS 7 deferral).
- **No security scanning** — added `.github/workflows/codeql.yml` (javascript-typescript,
  push/PR to `main` + weekly cron). Free for public repos. Deliberately NOT added to the
  ruleset's required checks — CodeQL is advisory (Security tab), not a merge gate; a real
  finding is a fix to make, not a job to keep re-running until it happens to pass.
- **README.md** was accurate but predated most of PF-11's shipped user-facing features
  (pre-flight/launch cinematic, the frame ladder, the Where-To console, the Render Console) —
  added, plus a new "CI/CD & Repo Governance" section documenting all of the above, plus the
  one missing script (`budget:check:assets`) from the scripts table.
- **`.gitignore`** had no OS/editor-cruft section — added `.DS_Store`/`Thumbs.db`/`desktop.ini`
  (the dev box is Windows per CLAUDE.md, so the Windows entries are the ones that actually
  matter) and blanket `.vscode/`/`.idea/`/swap-file ignores (neither directory exists in the
  repo today, so this is prophylactic, not a removal of anything tracked).

## What was verified, not assumed

- `gh api` queries against the LIVE repo (not just reading tracked JSON) for both the ruleset
  list and classic branch protection — the gap in item 1 above would have been invisible from
  the file tree alone.
- `gh run view` on the actual latest CI run for item 3 — read what the failing system says
  (CLAUDE.md's own standing rule), not a guess about what the LFS gap probably was.
- All three new/changed YAML files (`ci.yml`, `codeql.yml`, `dependabot.yml`) parsed with
  `js-yaml` before being treated as done.
- The ruleset JSON re-validated as parseable JSON before the live `gh api POST`.

## Known limitations / follow-ups

- The fixed `unit-test` LFS-pull step needs a real CI run (the next push to PR #6) to confirm
  it actually resolves the D9.3 test failures — not yet observed green, only reasoned from the
  same pattern that already works in 3 other jobs.
- `strict_required_status_checks_policy: true` on the newly-applied ruleset means a PR must be
  up to date with `main` before merging — expected GitHub behavior, not a new decision, but
  worth knowing the first time it's hit.
- CodeQL is unauthenticated against any bypass/allowlist tuning — first real run may need a
  follow-up pass to silence expected-safe patterns (e.g., the intentional `wasm-unsafe-eval` CSP
  directive) if the default query suite flags any.
