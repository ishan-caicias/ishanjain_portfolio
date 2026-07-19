# Runbook — Babylon engine cutover rollback

**Scenario:** the Babylon default (post-B6 flip) misbehaves in production — perf regression,
device-specific rendering fault, or physics/WASM failure not caught pre-flip.

## Fastest mitigation (no deploy) — per-visitor

Any visitor (or support reply) can force the legacy engine immediately:
`https://ishanjain.dev/?engine=webgl` — the dual-engine seam ships both engines; the URL param
always wins (engine-select.ts resolution order).

## Full rollback (deploy, ~minutes)

1. Revert the flip commit (it is deliberately a one-line default change in
   `src/lib/engine-select.ts` + its named E2E expectation updates — see the
   [cutover checklist](../validation-checklist/2026-07-19-pf09-b6-cutover-checklist.md) §E).
2. `npm run build && npm run test:e2e` locally (the suite asserts the default engine).
3. Push → Netlify auto-deploys `main`.
4. Verify live: default page mounts `<space-engine>`; `?engine=babylon` still available.

## Diagnostics to capture BEFORE rolling back (if at all possible)

- `?perf=1` overlay reading + `window.__ijPerf()` JSON on the failing device.
- `sceneStats()` from `<babylon-scene>` (backend, qualityTier, physicsMode, ready flags).
- Browser console (WebGPU validation errors surface ONLY there — TR-045).
- Device/browser/OS versions. File as a TR the same day (the TR-043 pattern).

## Non-rollback fallbacks to consider first

- Tier override rollout: steer affected classes to `lite` via a targeted fix rather than
  abandoning the cutover (`?tier=` verifies the hypothesis instantly on the failing device).
- `?craft=off` isolates GLB/ship-track faults; `?engine=webgl` isolates engine-wide ones.
