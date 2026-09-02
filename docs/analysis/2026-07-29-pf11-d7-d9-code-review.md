# PF-11 D7 + D9 — Code Review

**Reviewer:** Procyon · **Date:** 2026-07-29
**Reviews:** [TR-111](../test-reports/TR-111.md) (D7 memory & runtime) and
[TR-112](../test-reports/TR-112.md) (D9 Render Console), at commit `da57ae9`.
**Trigger:** owner-reported 59 failing E2E specs; review requested before the remaining
delivery-plan items are built on this foundation.

> **✅ RESOLVED, same day — [TR-113](../test-reports/TR-113.md).** Owner directive: apply all
> CRITICAL/HIGH/MEDIUM findings, get the failing tests passing, unblock D8. C1 (the renderer-
> freezing `clearCachedData()` call) and H1-H4 are all fixed; M1-M4 are all fixed. Verified live
> in source at the time of this banner: `clearCachedData()` removed from
> `_applyStarFieldGeometry` only (`src/lib/babylon-engine.ts` ~3185-3212, TR-113's fix comment
> in place), the two genuinely one-shot meshes (SDSS, asteroid-visual) keep theirs. Gate:
> 883/883 unit, **172/172 E2E, ZERO failures** (workers=1, retries=0, 41.8 min) — the suite that
> returned 59 failures against the pre-fix build. This document's CRITICAL/BLOCKED verdict below
> describes the working tree at the time of review and is left standing per this repo's
> corrections-are-additive convention.

---

## Verdict

**BLOCKED.** The 59 E2E failures are **one defect, not fifty-nine** — a single uncaught
exception introduced by D7.1 that permanently freezes the renderer about ten frames into
every page load, on every engine backend. The site does not work in production right now,
not merely in tests.

The defect is one line. The reason it shipped is the more important finding, and it is a
process finding: D7/D9 were recorded as **delivered** with **`READY TO PROCEED`** verdicts
while their E2E suites were written but never executed. 880 green unit tests certified a
build whose render loop dies before the visitor sees anything.

Separately: the D9 code that is _not_ broken is, in places, very good — `render-layers.ts`
is the best-argued new module in this phase. The problems cluster in the UI slice, which is
exactly the asymmetry the [D5/D6 review](2026-07-29-pf11-d5-d6-code-review.md) flagged
before D9 was written.

---

## C1 — CRITICAL · the renderer dies every load (`babylon-engine.ts:3018`)

### What happens

```
TypeError: Cannot read properties of undefined (reading 'boundingSphere')
    at RenderingGroup._RenderSorted
    at RenderingGroup._renderTransparentSorted
    at RenderingGroup.render
    at RenderingManager.render
    at Scene._renderForCamera → Scene.render
    at babylon-engine.…:2372          ← scene.render() inside runRenderLoop
```

`renderFrames` climbs 0 → 10, then freezes permanently. Because the throw happens _before_
`this.renderFrames++` on line 2671, every subsequent frame dies at the same point. Nothing
downstream of a rendered frame ever completes again: the launch ascent never finishes, so
`body.ij-loading` is never cleared; `travelTo` never arrives, so `arrivedId` stays `null`;
Havok bodies never move.

That single fact explains the whole failure list — the `Expected: "sirius" / Received: null`
family (~25 specs), `renderFrames did not advance (before=3, after=3)`, `Havok velocity 0`,
`constellation segments 0`, and the `console-clean` assertions (the exception _is_ the
console output those specs correctly refuse to tolerate).

### Root cause — proven, not inferred

`_applyStarFieldGeometry()` ends with `this._stars.geometry?.clearCachedData()`, added by
D7.1 to free the CPU-side vertex copy. That method is called **twice**: once at boot, and
again when `_loadBonusStarLayers()` merges the bonus catalogs (168,959 → 555,825 stars).
On the second call the mesh's geometry is rebuilt, but the cached position data needed to
compute the new `SubMesh` bounding info is gone, so `getBoundingInfo()` returns `undefined`
and the transparent depth-sort dereferences it.

I proved this rather than reasoning about it:

| Experiment                           | `renderFrames` over 26 s | Advancing?                |
| ------------------------------------ | ------------------------ | ------------------------- |
| As committed                         | 0 → 10 → 10 → 10         | **no**                    |
| `?layers=sdss-field:0,belt-visual:0` | 10 → 10                  | **no**                    |
| `?layers=sdss-field:0`               | 10 → 10                  | **no**                    |
| `?layers=belt-visual:0`              | 10 → 10                  | **no**                    |
| Line 3018 commented out, rebuilt     | 0 → 23 → 33 → **49**     | **yes**, zero page errors |

The layer-disable rows rule out the SDSS and belt meshes (which call `clearCachedData()` on
lines 3201 and 3273 harmlessly — those meshes are built once and never rebuilt). The last
row isolates the defect to line 3018 exactly.

### The comment that documents the bug

Lines 3012–3014 assert the precise safety property that turns out to be false:

> `setVerticesData`/`setVerticesBuffer` … always build a fresh Geometry rather than reuse
> the cleared one, **so clearing here cannot break the next bonus-layer rebuild.**

A fresh `Geometry` is indeed built — but the _bounding info_ is not reconstructible from it
once the cached positions are gone. This was a reasoned assumption about third-party
internals, written confidently, never executed. It is a good argument for the repo's own
"read what the failing system actually says" rule.

### Fix options (owner's call — I have not applied any)

1. **Drop `clearCachedData()` from `_applyStarFieldGeometry` only** (keep it on the two
   one-shot meshes). Costs back the star mesh's CPU copy; restores rendering. Smallest,
   safest, and the variant I actually verified green.
2. **Call `mesh.refreshBoundingInfo()` / set an explicit `BoundingInfo`** after the rebuild,
   then clear. Keeps D7.1's memory win but depends on the same class of internals assumption
   that just failed — needs a real E2E assertion either way.
3. **Clear only on the final merge** (skip on the boot call, clear after the last rebuild).
   Keeps most of the win, but "last" is not currently a knowable state.

Whichever is chosen, the E2E assertion this class needs is _"`renderFrames` still advances
30 s after the bonus merge lands"_ — no such assertion exists today.

---

## H1 — HIGH · the crashing layer is the one that cannot be switched off

`_loadBonusStarLayers()` is deliberately **not** gated on `_layerState["bonus-stars"]`
(babylon-engine.ts:2684–2686), because that layer is `implemented: false` — it is merged
into the base star mesh. So the exact code path that kills the renderer has no runtime
escape hatch: no URL param, no console toggle, no tier disables it.

Meanwhile the Render Console renders `bonus-stars` as a **checked, disabled** checkbox. A
visitor on a struggling machine sees a control implying the 387k-vertex layer is on and
cannot act on it. Honest labelling ("MERGED INTO STAR FIELD, NOT YET INDEPENDENT") is good;
shipping the crash path with no lever is not. Recommend a `?layers=bonus-stars:0` escape
hatch that short-circuits the merge, independent of the C1 fix — it would also have made
C1 diagnosable in one URL instead of four builds.

## H2 — HIGH · the gate was reported as passed while unrun

CLAUDE.md #25 is explicit: a slice ends with the full gate green _and_ a manual regression
pass, and "a slice with failing or unrun tests is not done". TR-111 and TR-112 both record
**`OVERALL: READY TO PROCEED`**, and the delivery plan marks D7 and D9 **delivered**, with
`npm run test:e2e → NOT RUN`.

The TRs are commendably honest that E2E did not run — the problem is that the verdict and
the plan status were issued anyway. Two of the written-but-unrun specs
(`render-console.spec.ts`'s `sdssGalaxyCount > 0` poll, `frame-ladder.spec.ts`) fail within
30 seconds against this build. The gate was not merely skipped; it was skipped _and_
reported as satisfied, which is the failure mode the repo's documentation contract exists
to prevent.

Worth stating plainly because it generalises: **880 unit tests cannot detect a dead render
loop.** No jsdom test instantiates WebGPU/WebGL, so this entire defect class is invisible to
the suite that was run. Unit-green is not evidence about rendering, and the D7/D9 TRs treat
it as though it were.

## H3 — HIGH · "RESET TO AUTO" does not reset to auto

`RenderConsole.tsx:118–127` removes `ij-layers` from `localStorage`, then calls
`applyPreset(currentTier)` → `apply()` → the engine's `setLayers()`, which
**unconditionally re-persists the full resolved state** (`babylon-engine.ts:2186–2196`).
The key is deleted and immediately rewritten.

The live session looks correct, so this passes a casual manual check. The damage is on the
_next_ load: the visitor is now pinned to an explicit stored override of the tier they
happened to be on, and no longer follows the device tier — the exact opposite of the
control's label, and it silently defeats ADR-0010's "tiers are the default, never the
ceiling" premise for anyone who clicks it. Fix: give the engine a `setLayers(config, {
persist: false })` path, or re-resolve from tier defaults and skip persistence.

---

## Medium

**M1 · `gaia-tiny` is displayed as ON.** `RenderConsole.tsx:247–255` renders _every_
`implemented: false` row as `checked disabled`. That is right for `star-field` and
`bonus-stars` (genuinely always on) and wrong for `gaia-tiny`, whose default is `false`
everywhere and whose data does not exist. The panel asserts 2.55M stars are rendering.
Its own spec, `render-console.spec.ts:209`, is titled _"renders as a disabled, always-off
row"_ but only asserts `toBeDisabled()` — it never checks the box is unchecked, so the test
passes over the contradiction. Split the branch on "always on" vs "unavailable".

**M2 · `render-console.spec.ts:53` fails on a healthy build.**
`getByText('DATA & LICENSES ▸')` resolves to two nodes (the mobile menu's
`[data-mobile-menu-action="credits"]` item and the HUD button) → strict-mode violation.
Independent of C1. Scope it to the HUD, e.g.
`page.getByRole('button', { name: 'DATA & LICENSES ▸' }).and(page.locator(':not([data-mobile-menu-action])'))`
or a dedicated test id.

**M3 · `belt-physics` count input is unbounded.** `min={0}` with no `max`
(`RenderConsole.tsx:256–266`); the value flows to `setLayers` and becomes a Havok body
budget. Typing `100000` asks for ~2,000× the `full` tier budget on the main thread. Clamp
to a documented ceiling — the registry already knows the per-tier numbers.

**M4 · the documented `layers` attribute path doesn't work at boot.**
`attributeChangedCallback` handles `layers` (2155–2169), but `connectedCallback`
unconditionally overwrites `_layerState` from `resolveLayers(url, storage, tier)` at 2387
without consulting the attribute. An attribute set _before_ connection — the
"future markup-driven default" the comment describes — is silently discarded. Specs set it
after mount, so this is latent rather than live.

## Low

**L1 · `serializeLayersParam` is dead code with a doc claiming otherwise.** Its header says
it is "used by the panel's _copy a link with these settings_ affordance"; that affordance
does not exist. Only its own unit test imports it. Either ship the affordance (it is a
genuinely nice touch for a console like this) or drop the claim.

**L2 · Engine version banner logs twice per load.** `Babylon.js v8.56.2 - WebGPU1 engine`
appeared 2× per navigation in the live browser. Possibly benign Babylon behaviour, possibly
a double engine construction. **Unverified** — flagged for a 5-minute check, not asserted.

---

## What is good — and should be kept as the pattern

Not everything here is a defect, and the parts that are right are worth naming so the fix
doesn't regress them.

- **`render-layers.ts` is exemplary.** Pure, DOM-free, Babylon-free, fully unit-testable,
  and its header does something rare: it states that the defaults are _current shipped
  behaviour made visible_, **not** measured recommendations, precisely so a later reader
  cannot mistake them for D0.3 output. That is the documentation contract working.
- **The `implemented: false` mechanism is the right call.** Rendering unavailable layers as
  honestly disabled rows, rather than faking or hiding them, is consistent with D1's honesty
  contract. M1 is a bug in one branch of it, not an argument against it.
- **`catalog-decode.worker.ts` is correct and well-scoped.** Request-id tagging, transferable
  zero-copy return, error routed back as a message rather than an unhandled rejection,
  termination on `disconnectedCallback`, and a clear written rationale for why only SDSS
  moved off-thread. CSP already covered `worker-src`.
- **The registry↔engine↔panel split holds.** The panel talks to the engine only through
  `sceneStats()`/`setLayers()`, and `cosmos:layers` carries full resolved state so the UI
  never diffs optimistically. That is the right seam and it scales to D8's layers.
- **The budget raise was handled properly** — 1215 → 1225 KB with the cause named inline in
  `budgets.config.mjs` and in the same commit, measured at 1210.7 KB.
- **D7.5's `mergeStarFields`** is a real win (no re-parse of the base catalog per bonus
  merge), and the `getVertexBuffer("starMeta")?.dispose()` leak fix at 3002 is a genuine,
  well-evidenced catch.

---

## Recommended order of work

1. Fix **C1** (option 1 is verified green) and add the missing "frames still advance after
   the bonus merge" E2E assertion.
2. Run the **full** gate — `npm run build && npm run test && npm run test:e2e &&
npm run budget:check` — and fix **M2** (which fails independently of C1). Expect further
   real failures to surface only once the renderer lives; today they are all masked.
3. Fix **H3** and **M1** — both are honesty defects in a feature whose entire premise is
   honesty.
4. Add the **H1** escape hatch.
5. Supersede TR-111/TR-112's `READY TO PROCEED` verdicts with a new TR recording the real
   result (corrections are additive here — do not edit the verdicts away), and re-open the
   D7/D9 status in the delivery plan until the gate is genuinely green.
6. Then **M3**, **M4**, **L1**.

## Scope of this review

Read: the full `da57ae9` diff for D7/D9 source, `render-layers.ts`, `RenderConsole.tsx`,
`catalog-decode.worker.ts`, the D7 hot paths in `babylon-engine.ts`, both new E2E specs,
TR-111, TR-112, `budgets.config.mjs`. Executed: `preflight.spec.ts` in isolation (7/8, the
failure being C1), two purpose-built diagnostic probes, and one rebuilt variant to isolate
line 3018. **Not** executed: the full E2E suite, unit suite (re-verified by neither count
nor run this session — TR-111/112's 880 figure is unchallenged, and irrelevant to C1), and
no real-device measurement. The working tree and `dist/` were restored to `da57ae9` state
after the probe build.
