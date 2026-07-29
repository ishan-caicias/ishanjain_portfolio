# PF-11 D5 + D6 code review — foundation check before the rest of the delivery plan

**Date:** 2026-07-29 · **Reviewer:** Procyon (REVIEW mode) · **Scope:** the uncommitted working
tree implementing PF-11 D5.2/D5.3/D5.4 and D6.2/D6.6/D6.7, recorded in
[TR-108](../test-reports/TR-108.md) / [TR-109](../test-reports/TR-109.md).
**Nature:** a review record, not a decision — nothing here was changed. Owner's call on each item.

> **✅ RESOLVED, same day — [TR-110](../test-reports/TR-110.md).** The owner directed "implement
> all 10 fixes". All ten are fixed, each with a regression test where one was possible: 828/828
> unit (+23, all additive — no existing assertion weakened), lint/typecheck/build/budget/docs
> green, budgets unmoved. Two findings changed on contact with measurement and are recorded in
> TR-110 rather than quietly adjusted here: **finding 9** was settled by re-measuring rather than
> picking a side (Aldebaran 0.9639, m42 0.0002 — the docs' 0.96 was right, the source comment's
> 0.97 was wrong, and m42's recorded ~0.0001 was itself slightly off), and **finding 6** was
> resolved by correcting the RULE rather than the code, because CLAUDE.md #22 turned out to be
> factually wrong about what `src/data/celestial/*.js` is. The sentence above — "nothing here was
> changed" — describes this document at the time of review and is left standing per this repo's
> corrections-are-additive convention. E2E was left for the owner to run manually; TR-110 lists
> exactly which specs the fixes expose.

## Independent verification performed

| Check                                              | Result                                                                                  |
| -------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `npm run test` re-run from the working tree        | **805/805 pass**, 48 files, 15.6 s — matches TR-109's claim                             |
| `npm run docs:check`                               | clean, no drift                                                                         |
| Both shader twins re-read for the D6.2 basis block | GLSL and WGSL are line-parallel with identical identifiers (CLAUDE.md #4, #5 satisfied) |
| Every modified test's justification                | Each carries a named, inline CLAUDE.md #15 reason; **no assertion was loosened**        |
| Finding 1 below                                    | Reproduced with a throwaway RTL test (written, run, deleted)                            |

E2E (161/161, 31.9 min) and `budget:check` were **not** re-run here — they are taken from TR-109
as reported.

## What is genuinely strong

Worth stating plainly, because it sets the bar for what follows:

- **D6.2's basis change is the best piece of work in the tree.** Rotate-in / rotate-out with the
  translation ordered correctly on each side, vectors deliberately taking rotation-only, the
  duplicated obliquity constant pinned against `asteroid-kepler.mjs` to 12 decimals by a test,
  and `heliocentricRadius`'s required-zero-change used as the correctness proof. The
  translate-vs-rotate ordering bug being caught mid-implementation and recorded is exactly right.
- **Retiring the m42 showcase route instead of retuning `ASTEROID_BELT.center` to fake the old
  crossing back** is the single most valuable judgement call in the session. Moving to Aldebaran
  because Taurus is genuinely zodiacal is the honest fix; the alternative would have re-introduced
  the fitted-coincidence class the slice existed to remove.
- **`destination-search.ts` is well-factored** — pure, data-in/data-out, no React or engine
  coupling, and `withClassEntries` deliberately keeps D5.2 free of D5.3 coupling.
- **`patch-atlas.mjs`'s "one genuinely free macro-cell, confirmed blank by byte-size measurement"
  and the mozjpeg-quality-90 reasoning** are measurement, not assertion.
- **Documentation discipline is exemplary.** D6.7's strikethrough-plus-forward-pointer correction,
  the delivery-plan slice notes, the reverted "IN TRANSIT" label recorded rather than dropped.

## Findings

### 1 — HIGH · After Escape, the search box goes dead until blur/refocus

`src/components/islands/space/MissionControlBar.tsx:130`

`setOpen(true)` fires on focus (`:132`) and on Arrow Up/Down (`:75`, `:82`) — **never on
`onChange`**. So: focus → type → Escape (closes the list and clears `cmd`) → keep typing, and
no listbox ever reappears. The visitor is left typing into a box that shows nothing. Reproduced:

```
listbox after Escape+type: STILL CLOSED (bug)
```

The 6 new E2E specs don't cover it because none of them types _after_ an Escape. One-line fix:
`setOpen(true)` inside the `onChange` handler.

### 2 — MEDIUM · `nearestOfType` allocates an object per iteration, and its own doc says it doesn't

`src/lib/star-catalog.ts:131`

The doc comment claims "a typed-array scan with no per-iteration allocation." The loop body is
`const { type } = unpackTypeAndColour(field.meta[i * 2 + 1])` — `unpackTypeAndColour` returns a
fresh `{ type, colour }` object every call. Over the loaded field (~200k+ records) × 7 class rows
on a cold camera epoch, that is millions of short-lived objects per cold search keystroke.

`Math.floor(field.meta[i * 2 + 1])` is the type byte directly — one line removes both the
allocation and the false claim. (Keep `unpackTypeAndColour` as the tested round-trip helper; it's
the _use inside the hot loop_ that's wrong.)

This is the highest leverage-to-effort fix in the set.

### 3 — MEDIUM · D6.2 introduced per-frame allocation in the render loop

`src/lib/babylon-asteroids.ts:59, 75, 459, 485, 526`

`toBeltSpace`/`fromBeltSpace` return fresh tuples. Consequences in hot paths:

- `beltPullAccel` (`:459`) now allocates **two** arrays per call, was one — and it is called once
  per rock per frame from `visualDriftStep` (`:493`) and from the Havok force loop
  (`babylon-engine.ts:5292`).
- `beltDensityAt` (`:526`) now allocates **one** array per call, previously **zero** — and during
  warp it is called once for the point sample plus up to 25× per frame inside
  `minSlowAlongSegment`.

Honest magnitude: at the 64-body physics subset this is on the order of a few thousand small
short-lived arrays per second, gated behind `_beltPhysicsAwake`. Not a crisis. But CLAUDE.md's
own convention is "no per-frame allocation in the render loop," this is newly introduced by a
slice whose stated cost was "the same math in a different basis," and it compounds against D7's
memory/runtime optimisation phase coming next. Fix is mechanical: inline the six multiply-adds as
scalars inside those three functions (or take out-params), leaving the exported pure helpers
untouched for the tests that pin them.

### 4 — MEDIUM · `getFeaturedSuggestions()` runs unconditionally on every SpaceScene render

`src/components/islands/SpaceScene.tsx:1244` → `destination-search.ts:172`

`featuredEntries` builds `new Map(index.entries.map(...))` over the full ~4,834-entry index —
allocating an intermediate array of 4,834 two-element arrays plus a Map — to look up **six**
hard-coded ids. It runs on every render, at the ~7.5 renders/s idle rate this file's own comment
documents, **even when the console has never been focused**.

Its two siblings, `searchSuggestions` and `searchTotalMatches`, both correctly short-circuit on
`if (!cmd.trim())` with a comment explaining exactly why. The featured path missed that guard.
And `getSearchState()` already caches an equivalent `byId` map — `featuredEntries` rebuilds it
from scratch. Two small changes (accept the cached map; only compute when the list is actually
about to be shown) remove essentially all of it.

### 5 — MEDIUM · `patch-atlas.mjs` default mode generation-losses the whole atlas

`scripts/patch-atlas.mjs:121-165`, exposed as `npm run assets:atlas`

Default mode (no flags) calls `apply(PATCHES)` unconditionally. Compositing forces a full
4096×4096 mozjpeg re-encode and the file is rewritten **even when `toAdd` is empty** — so a second
run re-encodes an already-lossy JPEG, degrading all ~260 already-shipped cells and churning the
committed binary. The header's "NEVER DELETES" guarantee is honoured; idempotency is not, and the
mode a human is most likely to type by hand is the unsafe one.

`--if-stale` (what `assets:sync` and CI use) is correct and safe. Suggested: make default mode
skip the write when nothing changed, or state the degradation explicitly in the header and in the
`assets:atlas` script's own description.

### 6 — LOW · `celestial-catalog.js` was hand-edited, against CLAUDE.md #22

The Io/Europa ra/dec swap edits `src/data/celestial/celestial-catalog.js` directly. CLAUDE.md #22
names `src/data/celestial/*.js` as never-hand-edited. Defensible in substance — that file's own
header describes it as _101 curated bodies_, not generated output, and TR-109 records the edit
openly. But D5.4 in the same session took the opposite route for the same class of change (a new
overlay module, `celestial-missing-moons.js`), so the tree now contains both precedents.

Rule and practice currently disagree, which is precisely the drift class this repo treats as a
defect. Resolve one way or the other: either route curated overrides through an overlay, or amend
#22 to distinguish _generated_ catalogs from the _curated_ base file. It's a one-line CLAUDE.md
change if the latter.

### 7 — LOW · `MissionControlBar.tsx` has no unit test

D5.2 added ~60 lines of stateful keyboard/ARIA logic — open state, `activeIndex` wraparound,
Enter's `?? list[0]` fallback, Escape delegation — to a component that sits inside vitest's
80%-coverage `include` scope (`src/components/islands/**`) and has **zero** unit tests. All of
D5.2's coverage is 6 E2E specs on a 32-minute suite. Finding 1 above was caught in a 20-line RTL
test in about two seconds; no E2E spec caught it.

Related, pre-existing: `npm run test` is `vitest run` with no `--coverage`, so those 80%
thresholds aren't actually enforced by the gate.

Given CLAUDE.md #26/#27's verification-economics rules — written after a slice where 67% of the
time was the E2E suite running — pushing this class of logic down to unit tests is the highest
compounding return available before D7–D9.

### 8 — LOW · `search()` and `totalMatches()` each run a full independent scan

`destination-search.ts:144, 155` · `SpaceScene.tsx:1242-1243`

Both call `rankAll` end-to-end, and both run per render with a live query — plus a third call from
the funnel keystroke record. With `withClassEntries`' 4,841-element array spread in front of each,
that is three full ranks and three full spreads per keystroke.

The comment defending a second scan is right that the count must not be derived from a _capped_
list. It does not require a second _scan_: rank once, use `.length` and `.slice(0, limit)` off the
same result.

### 9 — TRIVIAL · One measured number, two values

Aldebaran's peak belt density is `~0.97` in `babylon-asteroids.ts`'s ORIENTATION note and in
`engine-select.spec.ts`; `~0.96` in TR-109, the delivery plan, and the realism review. This repo
treats measured numbers as load-bearing — pick one.

### 10 — TRIVIAL · `.claude-flow/` is prettier-ignored but not git-ignored

Added to `.prettierignore` only. It will sit in `git status` permanently and is one `git add -A`
from being committed. Local harness state belongs in `.gitignore` (or a global gitignore), not in
`.prettierignore`.

## Verdict

**The foundation is sound.** Nothing here blocks D7–D9. D6.2 in particular is work this repo can
build on with confidence, and the documentation trail is better than most production codebases
manage.

The findings cluster into one theme worth naming: **the D5 UI slice is measurably less rigorous
than the D6 engine slice.** D6.2 got a mid-implementation bug caught, a cross-module constant
test, both shader twins, and an Astra audit. D5.2 got six E2E specs, no unit test, a reachable
dead-state, and three separate unguarded per-render costs in a component the file's own comments
show the author knew re-renders 7.5×/s. That asymmetry — engine work held to a higher standard
than chrome work — is the thing to correct before D9 ships a whole new Render Console UI.

Suggested order if any of this gets acted on:

1. Finding 1 (one line, user-visible dead state)
2. Finding 2 (one line, largest measurable win)
3. Findings 4 + 8 (same file, same sitting)
4. Finding 3 (before D7 starts measuring memory)
5. Finding 7 (unit-test `MissionControlBar`; pays for itself immediately at D9)
6. Findings 5, 6, 9, 10 (hygiene)
