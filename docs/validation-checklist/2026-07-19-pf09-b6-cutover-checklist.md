# PF-09 B6 — Babylon cutover checklist (security + deploy + measurement)

The gate sheet for flipping `?engine=babylon` to the default. The flip itself is a one-line
change in `engine-select.ts` (`resolveEngine`'s final fallback) **plus** moving
[ADR-0006](../adr/0006-babylon-default-cutover.md) from Proposed → Accepted with the evidence
below attached. Rollback: [engine-cutover runbook](../runbooks/2026-07-19-engine-cutover-rollback.md).

## A. Measurement conditions (owner devices — the blocking items)

| #   | Condition                                         | Instrument                                                        | Status                                                          |
| --- | ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| A1  | Desktop WebGPU: 60 fps sustained, startup ≤ 2.5 s | `?engine=babylon&perf=1`, badge `FULL`                            | ☐ (last attempt TR-043: 144 fps ✓, 3.02 s ✗ — needs re-measure) |
| A2  | iPad WebGPU: 60 fps, startup ≤ 3.0 s              | same, cold load                                                   | ☐                                                               |
| A3  | Mid Android WebGPU: ≥ 40 fps, startup ≤ 4.0 s     | same, cold load (TR-043 flagged prior 267 ms reading implausible) | ☐                                                               |
| A4  | WebGL2 fallback: ≥ 30 fps, startup ≤ 4.0 s        | force-disable WebGPU or use a non-WebGPU browser                  | ☐                                                               |
| A5  | No-WebGL / reduced-motion static fallback intact  | existing E2E + one manual check                                   | ☑ (E2E-verified continuously)                                   |

## B. ADR-0003 conditions

| #   | Condition                                               | Status                                                                                                                                                                                                       |
| --- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| B1  | Real-device mobile fps                                  | ☑ discharged 2026-07-19 (real Android) — re-confirmed by A3 above                                                                                                                                            |
| B2  | Badge reads `BABYLON WEBGPU` on device (WGSL path real) | ☑ discharged + automated (webgpu-hardware.spec)                                                                                                                                                              |
| B3  | Billboard-memory reduction                              | ☐ **decision needed**: B2 step 1 delivered −5.2 MiB (24%, 21.9→16.8 MiB); either accept as satisfying the condition (record in ADR-0006) or schedule further reduction (f16/quantized positions) before flip |

## C. Security / CSP (pre-deploy)

| #   | Item                                                                                                                                                                                   | Status                               |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------ |
| C1  | `astro.config.mjs` CSP carries `wasm-unsafe-eval` (ADR-0002) + `connect-src 'self' blob:` (ADR-0005)                                                                                   | ☑                                    |
| C2  | `netlify.toml`'s commented header-CSP does **not** include `connect-src blob:` — if header CSP is ever enabled it MUST mirror astro.config or the ship regresses (TR-047 failure mode) | ☐ standing hazard, re-verify at flip |
| C3  | No CDN dependencies: meshopt decoder self-hosted, Havok WASM same-origin                                                                                                               | ☑ (ADR-0005, TR-048)                 |
| C4  | No new origins in any directive since the OWASP audit                                                                                                                                  | ☑ (docs/security index)              |

## D. CI / quality gates (must be green at flip)

| #   | Item                                                                                                              | Status                             |
| --- | ----------------------------------------------------------------------------------------------------------------- | ---------------------------------- |
| D1  | Bundle budgets in CI (`npm run budget:check`: total JS ≤ 1200 KB gz, largest chunk ≤ 300 KB gz, WASM ≤ 700 KB gz) | ☑ wired 2026-07-19 (TR-052)        |
| D2  | CI perf regression canaries (startup/fps/frames, both engines)                                                    | ☑ `tests/e2e/perf-budgets.spec.ts` |
| D3  | Accessibility re-audit incl. Babylon path (axe serious/critical = 0, keyboard chrome)                             | ☑ extended 2026-07-19              |
| D4  | Full suite green at the flip commit                                                                               | ☐ at flip                          |

## E. The flip + archival (execute in order)

1. ☐ All A + B rows closed; ADR-0006 → Accepted with evidence links.
2. ☐ `engine-select.ts`: default `"webgl"` → `"babylon"` (one line; update its header comment).
3. ☐ E2E expectations that assert the default engine flipped accordingly (named test changes).
4. ☐ `space-engine.js` stays fully functional behind `?engine=webgl` for **one release**
   (archival = still shipped, no longer default); removal is a separate future decision.
5. ☐ Deploy; validate live headers (securityheaders.com) + smoke the five device classes.
6. ☐ Timesheet B6 → complete; delivery-plan status header updated; TR written.
