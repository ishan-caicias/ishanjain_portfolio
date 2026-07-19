# PF-09 B6 — Babylon cutover checklist (security + deploy + measurement)

The gate sheet for flipping `?engine=babylon` to the default. The flip itself is a one-line
change in `engine-select.ts` (`resolveEngine`'s final fallback) **plus** moving
[ADR-0006](../adr/0006-babylon-default-cutover.md) from Proposed → Accepted with the evidence
below attached. Rollback: [engine-cutover runbook](../runbooks/2026-07-19-engine-cutover-rollback.md).

## A. Measurement conditions (owner devices)

> **2026-07-19: §A waived pre-flip by owner decision (ADR-0006)** — the cutover proceeded with
> these rows as ACCEPTED RISK; they are now the standing **post-flip validation** items with
> the same instruments. Rollback levers: `?engine=webgl` + the runbook.

| #   | Condition                                         | Instrument                                                        | Status                                                          |
| --- | ------------------------------------------------- | ----------------------------------------------------------------- | --------------------------------------------------------------- |
| A1  | Desktop WebGPU: 60 fps sustained, startup ≤ 2.5 s | `?engine=babylon&perf=1`, badge `FULL`                            | ☐ (last attempt TR-043: 144 fps ✓, 3.02 s ✗ — needs re-measure) |
| A2  | iPad WebGPU: 60 fps, startup ≤ 3.0 s              | same, cold load                                                   | ☐                                                               |
| A3  | Mid Android WebGPU: ≥ 40 fps, startup ≤ 4.0 s     | same, cold load (TR-043 flagged prior 267 ms reading implausible) | ☐                                                               |
| A4  | WebGL2 fallback: ≥ 30 fps, startup ≤ 4.0 s        | force-disable WebGPU or use a non-WebGPU browser                  | ☐                                                               |
| A5  | No-WebGL / reduced-motion static fallback intact  | existing E2E + one manual check                                   | ☑ (E2E-verified continuously)                                   |

## B. ADR-0003 conditions

| #   | Condition                                                                                                          | Status                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B1  | Real-device mobile fps                                                                                             | ☑ discharged 2026-07-19 (real Android) — re-confirmed by A3 above                                                                                                                                                                         |
| B2  | Badge reads `BABYLON WEBGPU` on device (WGSL path real)                                                            | ☑ discharged + automated (webgpu-hardware.spec)                                                                                                                                                                                           |
| B3  | Billboard-memory reduction — **DISPOSITIONED Option A 2026-07-19 (owner)**: B2 step 1's −24% accepted; revisitable | ☑ recorded in [ADR-0006](../adr/0006-babylon-default-cutover.md) §B3: −5.2 MiB (24%, 21.9→16.8 MiB) accepted as satisfying ADR-0003 condition 3 (GAP-25, 2026-07-20 — Condition and Status cells here previously contradicted each other) |

## C. Security / CSP (pre-deploy)

| #   | Item                                                                                                                                                                                   | Status                                                                                                                                                                                                           |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C1  | `astro.config.mjs` CSP carries `wasm-unsafe-eval` (ADR-0002) + `connect-src 'self' blob:` (ADR-0005)                                                                                   | ☑                                                                                                                                                                                                                |
| C2  | `netlify.toml`'s commented header-CSP does **not** include `connect-src blob:` — if header CSP is ever enabled it MUST mirror astro.config or the ship regresses (TR-047 failure mode) | ☑ fixed (GAP-24, 2026-07-20): the commented line now mirrors astro.config's `connect-src`/`worker-src blob:` and `script-src 'wasm-unsafe-eval'` — still disabled by default, but no longer wrong if uncommented |
| C3  | No CDN dependencies: meshopt decoder self-hosted, Havok WASM same-origin                                                                                                               | ☑ (ADR-0005, TR-048)                                                                                                                                                                                             |
| C4  | No new origins in any directive since the OWASP audit                                                                                                                                  | ☑ (docs/security index)                                                                                                                                                                                          |

## D. CI / quality gates (must be green at flip)

| #   | Item                                                                                                              | Status                                             |
| --- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| D1  | Bundle budgets in CI (`npm run budget:check`: total JS ≤ 1200 KB gz, largest chunk ≤ 300 KB gz, WASM ≤ 700 KB gz) | ☑ wired 2026-07-19 (TR-052)                        |
| D2  | CI perf regression canaries (startup/fps/frames, both engines)                                                    | ☑ `tests/e2e/perf-budgets.spec.ts`                 |
| D3  | Accessibility re-audit incl. Babylon path (axe serious/critical = 0, keyboard chrome)                             | ☑ extended 2026-07-19                              |
| D4  | Full suite green at the flip commit                                                                               | ☑ [TR-054](../test-reports/TR-054.md) (2026-07-19) |

## E. The flip + archival (execute in order)

> **GAP-25 (2026-07-20):** rows 1-4 and 6 below were all actually done at the 2026-07-19 flip
> ([ADR-0006](../adr/0006-babylon-default-cutover.md) Accepted, [TR-053](../test-reports/TR-053.md)/
> [TR-054](../test-reports/TR-054.md)) but this section still read as if the flip were pending —
> exactly the drift class this repo's docs contract calls a defect. Checked off in place, dated,
> rather than silently rewritten. Row 1's "closed" is the §A waiver, not literal closure — the
> owner explicitly accepted §A as risk pre-flip (see the note atop §A), which is a real, recorded
> disposition, not a gap in this checklist.

1. ☑ All A + B rows dispositioned: §A rows accepted as risk by owner decision (see §A note,
   2026-07-19); §B rows discharged/dispositioned (B1-B3 above). ADR-0006 → Accepted with evidence
   links.
2. ☑ `engine-select.ts`: default `"webgl"` → `"babylon"` ([TR-053](../test-reports/TR-053.md)).
3. ☑ E2E expectations re-pointed to the default engine (GAP-17…20, [TR-060](../test-reports/TR-060.md)).
4. ☑ `space-engine.js` stays fully functional behind `?engine=webgl` (archived in place, still
   covered by its own E2E pins).
5. ☐ Deploy; validate live headers (securityheaders.com) + smoke the five device classes — **still
   open**, same underlying gap as checklist §A (GAP-22): needs the owner's actual deploy + physical
   devices, not actionable from this desk.
6. ☑ Timesheet B6 → complete; delivery-plan status header updated; TR written (this checklist itself
   was the one artefact left drifted — fixed by this pass, GAP-25).
