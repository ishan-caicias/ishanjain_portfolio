# GitHub Rulesets

> ⚠️ **Committing this JSON does not protect anything.** A ruleset only takes effect once it is
> imported into GitHub's repository settings. The file here is the version-controlled source of
> truth so the configuration is reviewable and reproducible — not the live enforcement.

## `main-protection.json`

Protects the default branch (`main`). Applying it closes GitHub's
_"Your main branch isn't protected"_ warning.

| Rule                      | Effect                                                         |
| ------------------------- | -------------------------------------------------------------- |
| `deletion`                | `main` cannot be deleted                                       |
| `non_fast_forward`        | `main` cannot be force-pushed                                  |
| `required_linear_history` | No merge commits — squash or rebase only                       |
| `pull_request`            | Nothing reaches `main` except through a PR                     |
| `required_status_checks`  | All five CI jobs must pass, on a branch up to date with `main` |

### Why `required_approving_review_count` is `0`

**GitHub does not allow you to approve your own pull request.** On a solo repository, requiring
1 approval would make `main` permanently unmergeable — every PR would sit blocked until the rule
was bypassed, which makes the rule theatre rather than protection.

`0` still gives full gatekeeping for a solo maintainer:

- nothing lands on `main` without a PR,
- nothing merges until all five CI jobs are green,
- every unresolved review comment blocks the merge
  (`required_review_thread_resolution`),
- the merge button is still yours to click, deliberately, after reading the diff.

If a second maintainer ever joins, raise this to `1` — at that point it becomes enforceable and
meaningful.

### Applying it

Via the UI: **Settings → Rules → Rulesets → New ruleset → Import a ruleset**, then select this
file.

Or via the CLI:

```bash
gh api --method POST /repos/:owner/:repo/rulesets \
  --input .github/rulesets/main-protection.json
```

To update an existing ruleset, list them and PUT to the id:

```bash
gh api /repos/:owner/:repo/rulesets --jq '.[] | "\(.id)\t\(.name)"'
gh api --method PUT /repos/:owner/:repo/rulesets/<id> \
  --input .github/rulesets/main-protection.json
```

`bypass_actors` is deliberately empty — no one, including an admin, bypasses the checks silently.
As repository owner you can still edit or disable the ruleset in Settings if you ever need an
emergency escape hatch, so this is not a lock-out risk.

### Keeping the status-check contexts honest

The five `context` values must match the `name:` of each job in
[`../workflows/ci.yml`](../workflows/ci.yml). **Renaming a CI job silently breaks the gate** — the
old context never reports, so the PR waits forever on a check that no longer exists. Rename in
both places, and re-import this ruleset.
