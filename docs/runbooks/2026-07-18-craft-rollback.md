# Runbook — Ship-v2 Craft Rollback

**Since:** P5 rollout ([TR-020](../test-reports/TR-020.md)) — the textured craft is default-on
via the auto device policy.

## Built-in safety nets (no action needed)

- **Any craft failure → wireframe automatically.** Load errors, CSP/WASM blocks (old Safari),
  context loss, missing GLB — the engine emits `cosmos:craft {state:"error"}` and keeps the
  gold wireframe. Never a blank ship.
- **No-WebGL browsers** get the DOM fallback, unchanged (E2E-proven).

## Per-visitor opt-out (support answer)

- Data & Licenses dialog → **Ship model quality → Off** (persists on their device), or
- append `?craft=off` to the URL (one visit).

## Site-wide rollback (redeploy, ~1 line)

In `src/lib/craft-tier.ts`, `resolveCraftAttribute`: change the final
`return resolveCraftTier(signals);` back to `return null;` — that restores the pre-P5
default-off behaviour (flags and stored overrides keep working). Then update the two
deliberately-flipped tests (`tests/unit/craft-tier.test.ts` "default-on since P5",
`tests/e2e/craft-ship.spec.ts` "default page loads the craft") and redeploy.

Full revert of the feature is a git revert of the ship-v2 range — but prefer the one-line
default flip; the wireframe path has stayed fully intact behind it by design.

## Post-rollback verification

`npm run build && npm run test:e2e` — the suite is flag-agnostic apart from the two named
specs above.
