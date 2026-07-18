# CI/CD — Node Runtime Policy & `main` Branch Protection

**Date:** 2026-07-19 · **Context:** [TR-034](../test-reports/TR-034.md)

## Node runtime policy

Astro 7 requires **Node ≥ 22.12.0**. Before this change the version was pinned independently in two
places, both at `20`, with nothing asserting the floor — so both CI and the Netlify preview failed
on a runtime guard before any code was compiled, on every push for three days.

**The version now has one declared source and three consumers that must agree:**

| Location                   | Value       | Role                                            |
| -------------------------- | ----------- | ----------------------------------------------- |
| `package.json` `engines`   | `>=22.12.0` | **The declaration.** The floor everything obeys |
| `.nvmrc`                   | `22`        | Local dev — `nvm use` picks it up               |
| `.github/workflows/ci.yml` | `22`        | All five CI jobs                                |
| `netlify.toml`             | `"22"`      | Preview + production deploys                    |

### Why 22 and not 24

Local development runs Node 24.15, so 24 would match dev exactly. 22 was chosen anyway:

- It is **Active LTS** and the best-supported Netlify runtime — and a Netlify deploy failure is one
  of the two symptoms being fixed here, so the conservative choice is the right one.
- It **is** the declared floor, so CI exercises the minimum supported version. Anything that works
  only because the developer is ahead of the floor gets caught in CI rather than by a user.

Raising the floor later is a four-file change — and the `engines` field makes any drift loud
(`npm ci` warns when the runtime is below the declared minimum).

### Action versions

`actions/checkout` and `actions/setup-node` moved v4 → v5. v4 targets the Node 20 runtime, which
GitHub now force-runs on Node 24 and annotates on every job. Cosmetic today; a hard break when the
compatibility shim is withdrawn.

## `main` branch protection

Source of truth: [`.github/rulesets/main-protection.json`](../../.github/rulesets/main-protection.json)
(see [its README](../../.github/rulesets/README.md) for the apply procedure).

| Rule                      | Effect                                                     |
| ------------------------- | ---------------------------------------------------------- |
| `deletion`                | `main` cannot be deleted                                   |
| `non_fast_forward`        | `main` cannot be force-pushed                              |
| `required_linear_history` | Squash or rebase only — no merge commits                   |
| `pull_request`            | Nothing reaches `main` outside a PR                        |
| `required_status_checks`  | All five CI jobs green, on a branch up to date with `main` |

### The self-approval constraint

GitHub does not allow a pull request author to approve their own PR. On a **solo repository**,
`required_approving_review_count: 1` therefore produces a branch that can never be merged into —
every PR blocks on an approval that is impossible to give, leaving bypass as the only route. A rule
that must be bypassed to work is not protection.

`0` is set instead. For a solo maintainer this still delivers the intent — _nothing lands on `main`
without my say-so and a green build_:

- direct pushes, force-pushes and deletion are blocked outright,
- every change arrives as a PR with a reviewable diff,
- the merge button stays disabled until all five jobs pass,
- unresolved review threads block the merge.

Raise to `1` the moment a second maintainer joins — at that point it becomes enforceable.

### Coupling risk to watch

The five required `context` values are **CI job names**, matched as strings. Renaming a job in
`ci.yml` without re-importing the ruleset leaves PRs waiting forever on a check that no longer
reports. Rename in both places, together.

`bypass_actors` is empty — no silent admin override. The owner can still edit the ruleset in
Settings, so this is not a lock-out.

## Not yet verified

The corrected workflow had not executed on a GitHub runner at the time of writing, and the ruleset
had not been imported. Both are confirmed by the next push, not by this document.
