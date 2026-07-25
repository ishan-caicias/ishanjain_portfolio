# E2E Suite Performance & Staleness Audit

Date: 2026-07-25 (Procyon)

Triggered by: the Playwright suite has grown from 12.8 min (TR-081, 87 tests) to **42.2 min
(TR-103, 153 tests, workers=1, 0 failures)** — the "nearly 40 min" the owner flagged. This audit
answers two questions: (1) what can be optimised, including dependency/version upgrades, and
(2) does the suite carry stale test cases against PF-07…PF-11's current state. Analysis only —
no code changed in this pass.

## 1. Why the suite got this slow

The trend across every recorded `npm run test:e2e` line in `docs/test-reports/`, all at the same
`--workers=1` config:

| TR     | Tests | Minutes | s/test |
| ------ | ----- | ------- | ------ |
| TR-081 | 87    | 12.8    | 8.8    |
| TR-086 | 108   | 15.2    | 8.4    |
| TR-088 | 113   | 22.1    | 11.7   |
| TR-091 | 119   | 23.0    | 11.6   |
| TR-092 | 119   | 26.4    | 13.3   |
| TR-097 | 129   | 36.8    | 17.1   |
| TR-103 | 153   | 42.2    | 16.5   |

Test count grew 76% (87→153); runtime grew 230% (12.8→42.2 min). **TR-091→TR-092 is the cleanest
isolation: same 119 tests, +15% slower with zero tests added** — that's pure per-boot cost growth
from the scene itself. PF-10/11 added the SDSS DR18 deep field, the real 154,662-object Gaia DR3
belt, bonus star layers (catalog now 555,825+ objects), the GD-1 trail, and NGC2000 billboards —
all decoded on every full-scene test. Two compounding causes:

**A. No shared boot across tests.** There is no `globalSetup`/`globalTeardown` in
[`playwright.config.ts`](../../playwright.config.ts) and no `storageState` reuse anywhere in
`tests/e2e/`. Every full-scene test does its own cold `page.goto` → catalog fetch/decode →
GLB ship load → Havok WASM init → shader compile. `tests/e2e/engine-select.spec.ts` alone is
1936 lines / 32 tests, and **28 of the 32 independently boot the scene from scratch** — TR-087
measured this one file at 6.4 of a 13.8-minute run (46%) when the suite was smaller; at current
scene weight its absolute cost is higher still. Several of its PF-10 data-source checks
(clusters, NGC2000, GD-1, minor planets — lines ~1375–1900) each re-boot the whole catalog to
read one more `window.CELESTIAL_*_COUNT`, where 2–3 merged tests would do.

**B. `workers: 1` was calibrated at a much lighter scene and never re-measured.** The
[`playwright.config.ts:8-18`](../../playwright.config.ts) comment cites "~2-3 extra minutes per
full run" for dropping workers 4→1, sourced from TR-018/TR-052. Per-test cost has since roughly
doubled (8.8s → 16.5s/test) and the suite is nearly 2× bigger — that comment is stale and is
currently understating the true worker-count cost by an order of magnitude. It needs a dated
re-measurement (CLAUDE.md #26: an instrument/calibration needs revalidating before being trusted
at a new scale), not a change made on the strength of this audit's guess.

**C. CI runs the whole suite as one job, one runner, no sharding.** `.github/workflows/ci.yml:86-102`'s
`e2e` job is a single `ubuntu-latest` runner with no GPU (SwiftShader software rendering) and no
`--shard`. Playwright has supported duration-aware `--shard` since 1.49; the repo is already on
`@playwright/test ^1.61.1` (ahead of the 1.59 release found in a live search — **no Playwright
version upgrade is needed**, the feature is already available and unused).

**D. One self-diagnosed, unapplied fix already sits in the codebase.** `frame-ladder.spec.ts:45-54`'s
own comment states its ~100ms `sceneStats()` polling starves `requestAnimationFrame` under
SwiftShader, inflating wall-clock **~4×** against engine time (cites TR-089/TR-094 for the
factor) — this is the single 240s-ceiling test in the suite and the fix (widen the poll interval)
was identified but never applied.

**E. `waitForTimeout` is not the lever.** 33 occurrences, 80ms–6500ms, mostly legitimate (proving
physics _doesn't_ drift over a real interval, or waiting out a stated animation window per
CLAUDE.md #18's behaviour-not-readiness rule). Total fixed-sleep time is low single digits of
minutes — dwarfed by ~30+ minutes of scene-boot time. Not a meaningful optimisation target.

### Spec files ranked by estimated wall-clock cost

| File                       | Tests | Full-boot tests     | Heaviest ceiling | Note                                                        |
| -------------------------- | ----- | ------------------- | ---------------- | ----------------------------------------------------------- |
| engine-select.spec.ts      | 32    | 28                  | 150s             | TR-087: 6.4 min alone in isolation                          |
| mid-warp-input.spec.ts     | 6     | 6                   | 180s             | heaviest per-test ceilings in suite                         |
| frame-ladder.spec.ts       | 1     | 1                   | 240s             | 5 journeys, rAF-starving poll (self-flagged)                |
| earth-home.spec.ts         | 5     | 5                   | 150s             |                                                             |
| d64-owner-bugfixes.spec.ts | 4     | 4                   | 150s             |                                                             |
| field-travel.spec.ts       | 5     | 5                   | 120s             |                                                             |
| ascent.spec.ts             | 5     | 5                   | 120s             |                                                             |
| vista-dismissal.spec.ts    | 7     | 7                   | 90s              | every test 90s                                              |
| collector-card.spec.ts     | 7     | 7                   | 90s              | every test 90s                                              |
| craft-ship.spec.ts         | 8     | 8                   | 90s              |                                                             |
| camera-zoom.spec.ts        | 5     | 5                   | 90s              |                                                             |
| load-progress.spec.ts      | 4     | 4                   | 90s              |                                                             |
| preflight.spec.ts          | 8     | ~4                  | 45s              | half console/DOM-only                                       |
| space-scene.spec.ts        | 16    | 16 (light each)     | default 30s      | many tests, individually light                              |
| funnel.spec.ts             | 7     | ~3                  | 60s              | mixed                                                       |
| flight-v3.spec.ts          | 4     | 4 (archived engine) | 60s              | pinned `?engine=webgl`, deliberately narrow                 |
| webgpu-hardware.spec.ts    | 3     | 3 (opt-in)          | default          | no real GPU channel in CI — pays boot cost for no CI signal |
| accessibility.spec.ts      | 7     | ~2                  | default          | mostly axe/DOM                                              |
| navigation.spec.ts         | 9     | 0–1                 | default          | light                                                       |
| craft-assets.spec.ts       | 2     | 0                   | default          | static asset checks                                         |
| page-load-console.spec.ts  | 2     | 0                   | default          | console-only                                                |
| perf-budgets.spec.ts       | 1     | 1                   | default          | telemetry read only                                         |
| planet-pixels.spec.ts      | 1     | 1                   | 60s              |                                                             |

## 2. Recommendations (ranked by impact)

1. **Shard the CI `e2e` job across a matrix, keep `workers: 1` inside each shard.** Each shard is
   its own runner with its own single SwiftShader instance, so this doesn't reproduce the
   "N workers time-slicing ONE GPU" flake `workers:1` was fixing (TR-018/TR-052) — that problem
   was about _local_ multi-worker contention on one machine, and a CI matrix has no shared GPU
   across shards. A 4-way `strategy.matrix.shard` + `--shard=${{matrix.shard}}/4` in
   `.github/workflows/ci.yml:86-102`, balanced so `engine-select.spec.ts` doesn't land alone on
   one shard with the other three empty, should bring CI wall-clock from ~42 min toward
   ~11–15 min. This is the highest-impact, lowest-risk change — it touches CI config only, no
   test semantics change.
2. **Re-measure the workers 4→1 tradeoff locally before touching it.** Per CLAUDE.md #26, run a
   controlled A/B (`workers=1` vs a higher count, quiet machine, unchanged `dist/`) and update
   the stale comment with a dated number either way. Do not change the setting on this audit's
   say-so alone — it needs its own calibration run.
3. **Apply the frame-ladder.spec.ts poll-interval fix its own comment already names.** Widening
   the `sceneStats()` poll from ~100ms to 300–500ms should cut this single 240s-ceiling test
   substantially without touching any assertion — the codebase already diagnosed this at
   `frame-ladder.spec.ts:45-54`; nobody had applied it.
4. **Consolidate `engine-select.spec.ts`'s redundant PF-10 data-source boots.** The
   cluster/NGC2000/GD-1/minor-planet checks (~lines 1375–1900) each re-boot the full catalog to
   read one more count global. Merging 2–3 of these into single-boot, multi-assertion tests
   (the GAP-03/04/05 test at line 317 already does this pattern correctly) removes several
   10–20s boots with no loss of assertion coverage.
5. **Drop or gate `webgpu-hardware.spec.ts` out of the default CI run.** It needs a real GPU
   channel CI doesn't install (`ci.yml:101` installs `chromium` only, no `--with-deps chrome`),
   so it pays full boot cost in CI for zero real signal there. `test.skip(!!process.env.CI, …)`
   or moving it to an explicitly-invoked-only path removes dead CI cost without losing local
   coverage.

**No framework/language version upgrade is indicated for the runtime problem.** `@playwright/test
^1.61.1` is already ahead of the latest publicly documented stable (1.59, April 2026) and already
has the sharding feature this audit recommends using. TypeScript stays pinned at `~6.0.3` per
ADR-0001 (upgrading to TS7 breaks `astro check` and typed lint — unrelated to E2E runtime
regardless). Node is pinned `>=22.12.0`; Node 24 is now the active LTS (until 2028) and Node 26
current, but the E2E bottleneck is Chromium/SwiftShader render cost, not the Node runtime — a Node
bump is a reasonable general-modernisation item but would not measurably move the 42-minute
number, so it's out of scope for this specific problem.

## 3. Staleness audit against PF-07…PF-11

Every candidate flagged going in turned out to be **intentionally, self-documentedly still
valid** — the suite has been kept current as part of each vertical slice's delivery gate
(CLAUDE.md #25), not left to drift.

| Spec file                                                                                         | Verdict                              | Reasoning                                                                                                                                                                                                                                                                                                                                                                                         | Action                  |
| ------------------------------------------------------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| `flight-v3.spec.ts`                                                                               | Still valid, by design               | Header documents the GAP-17 disposition (TR-060): deliberately pinned to `?engine=webgl`, testing the archived engine's own synthetic-tick internals with no Babylon equivalent; the one portable test was already forked into `engine-select.spec.ts`. PF-11 D3 (flip v4) only touched the default engine's `babylon-engine.ts`/`ship-dynamics.ts` — nothing here contradicts current behaviour. | Keep                    |
| `d64-owner-bugfixes.spec.ts`                                                                      | Still valid                          | "D64" = PF-11 D6.4 (Earth home-orbit reveal, TR-088). Guards two real regressions (drag-reset, occlusion) in code still live and unmodified since.                                                                                                                                                                                                                                                | Keep                    |
| `engine-select.spec.ts`                                                                           | Still valid — hypothesis disproven   | Only 2 of 32 tests touch `?engine=webgl` at all (default-mounts-Babylon check + rollback-lever boot check). The other 30 are the primary Babylon regression suite (GAP-01..17, PF-10 layers, flip choreography, reduced motion) — not legacy-engine bloat, despite the file's size. Trim opportunity is redundant _boots within_ this file (§2.4 above), not the file's existence or scope.       | Keep, consolidate boots |
| `craft-ship.spec.ts` / `craft-assets.spec.ts`                                                     | Still valid                          | `craft-ship.spec.ts` was already un-pinned from `?engine=webgl` once GAP-15/GAP-12 closed (TR-058); timeout recalibrated for PF-10 load (TR-080). `craft-assets.spec.ts` checks static GLB serving/budgets, pipeline-agnostic.                                                                                                                                                                    | Keep                    |
| `space-scene.spec.ts` vs `field-travel.spec.ts`/`camera-zoom.spec.ts`                             | Partially overlapping, not duplicate | `space-scene.spec.ts` covers general mount/nav/mobile/reduced-motion; `field-travel.spec.ts` covers D4.2 field-object travel parity; `camera-zoom.spec.ts` covers D3-era zoom-standoff. One soft touch-point (post-arrival camera framing) at different granularity, not true duplication.                                                                                                        | Keep all                |
| `vista-dismissal.spec.ts` / `collector-card.spec.ts` / `earth-home.spec.ts` / `preflight.spec.ts` | Still valid, cleanly partitioned     | D4.1 (dismiss mechanics) / D4.3 (focus trap, ARIA) / D6.4 (home reveal) / D1.2 (pre-launch dossier — a different dossier than the arrival card). No stale UI-copy assertions found against current `ArrivalVista.tsx`/`WarpOverlay.tsx`/`SpaceScene.tsx`.                                                                                                                                         | Keep all                |

**No dead/broken assertions found** — every checked literal UI string (`OPEN COLLECTOR CARD`,
`BRAKING BURN`, `RETARGET QUEUED`, `RANDOM JUMP ▸`, `◂ RETURN HOME`, etc.) exists verbatim in
current `src/`. `docs/delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md` and
`docs/test-reports/README.md` confirm D3.1–D3.3 and D4.1–D4.4 test files landed same-day as
their features (TR-093–TR-101), honouring the vertical-slice gate.

**Forward gap, not staleness, worth flagging:** D3.3's Astra REALISM-AUDIT is still outstanding
and D5.2–D5.4 (search v2, field-object search classes, missing-body audit) are undelivered per
the PF-11 plan — `mid-warp-input.spec.ts` and the search-related parts of `navigation.spec.ts`/
`accessibility.spec.ts` should be expected to _gain_ tests next, not shrink.

## 4. Bottom line

The 42-minute runtime is **earned, not accidental** — the suite grew honestly with a scene that
genuinely got heavier (PF-10/11's real datasets), and no meaningful stale coverage was found to
cut. The fix is architectural (CI sharding + fixing one already-diagnosed polling bug +
consolidating a handful of redundant re-boots in one file), not a version upgrade and not a
test-deletion exercise. Estimated combined effect of items 1+3+4 above: roughly 42 min → the
mid-teens per CI run, with local single-machine runs unaffected (sharding is CI-only; workers
stay at 1 locally pending the item-2 re-measurement).

## Open decisions for the owner

- Approve implementing recommendation #1 (CI shard matrix) as its own vertical slice — it's a
  CI-config-only change, low risk, but changes the required-status-check surface
  (`ci.yml`) that CLAUDE.md #34/TR-034 flags as sensitive to branch-protection rule names.
- Approve #3 (frame-ladder poll interval) and #4 (engine-select boot consolidation) as
  test-file edits — both are named/justified per CLAUDE.md #15, but should still land as a
  gated slice with a fresh TR showing the before/after timing, not silently.
- #2 (local workers re-measurement) and #5 (webgpu-hardware CI skip) are low-effort, can be
  bundled into the same slice.
