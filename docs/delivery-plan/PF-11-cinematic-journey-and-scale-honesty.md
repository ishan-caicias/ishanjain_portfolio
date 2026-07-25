# PF-11 Cinematic Journey & Scale Honesty — intro cinematic, frame ladder, flight v4, console/cards UX, PF-10 closeout, performance

**Date:** 2026-07-22
**Status:** ~~DRAFT — awaiting owner confirmation before IMPLEMENT~~ **CONFIRMED
(owner, 2026-07-22, later same day)** — six of the seven open decisions taken and one new
requirement added (the **Render Console**, phase D9): see the Decisions log below and
[ADR-0010](../adr/0010-owner-decisions-render-console.md). ~~D6.2 (belt frame) remains the one
open decision.~~ **D6.2 approved hours later, same day: GO on re-expression (ADR-0010
update) — ALL owner decisions are now taken.** IMPLEMENT starts at D0.
**Implementation companion (bidirectional — for coding agents):**
[docs/implementation/PF-11-implementation-plan.md](../implementation/PF-11-implementation-plan.md)
holds the full technical detail per phase; each phase below links to its implementation
section and each implementation section links back here:
[D0](../implementation/PF-11-implementation-plan.md#d0--trustworthy-instruments) ·
[D1](../implementation/PF-11-implementation-plan.md#d1--pre-flight-launch) ·
[D2](../implementation/PF-11-implementation-plan.md#d2--frame-ladder) ·
[D3](../implementation/PF-11-implementation-plan.md#d3--flight-model-v4) ·
[D4](../implementation/PF-11-implementation-plan.md#d4--arrival--cards) ·
[D5](../implementation/PF-11-implementation-plan.md#d5--where-to-console-v2) ·
[D6](../implementation/PF-11-implementation-plan.md#d6--pf-10-debt-closeout) ·
[D7](../implementation/PF-11-implementation-plan.md#d7--memory--runtime-optimisation) ·
[D8](../implementation/PF-11-implementation-plan.md#d8--gaia-dr3-tiny-full-field) ·
[D9](../implementation/PF-11-implementation-plan.md#d9--render-console)
**Basis:**
[Astra science brief — sky frames & travel](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md) ·
[PF-10 plan](PF-10-gaia-dataset-realism.md) ·
[C4 closeout handoff](../checkpoint/2026-07-22-pf10-c4-closeout-handoff.md) ·
codebase audit (10 parallel investigations, 2026-07-22, findings inlined below) ·
[docs/research/](../research/) (Gaia Sky ecosystem + texture licensing research) ·
**experience-design inputs (binding on D1/D4/D5):**
[experience review](../experience-design/2026-07-22-pf11-experience-review.md) +
[UX research plan](../experience-design/2026-07-22-pf11-ux-research-plan.md) — the research
plan's 19 acceptance criteria (D1-AC1..7, D4-AC1..6, D5-AC1..6) are ADOPTED as exit criteria
for their slices, and its top-2 risk validations (LAUNCH-gate hallway test, dossier-vs-spinner
probe) run BEFORE D1.3's cinematic is fully built

**Owner requirements captured (2026-07-22), mapped to slices:**

| #   | Owner requirement                                                                                                                                                                                                     | Slice                                                                                 |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| R1  | External libraries/engines allowed where they help UX/perf                                                                                                                                                            | Standing policy (see Constraints)                                                     |
| R2  | Intro cinematic + dossier with REAL loading status; launch button; ship launches from Earth; Where-To console appears on 2nd third of screen                                                                          | D1                                                                                    |
| R3  | Milky Way should read correctly from Moon/planets — validate with Astra                                                                                                                                               | D2 (Astra: ACCURATE as-is inside the galaxy; see brief)                               |
| R4  | Band + belt visible regardless of destination — is this correct?                                                                                                                                                      | D2 (Astra: belt NO beyond ~10 AU; band NO at extragalactic arrivals)                  |
| R5  | Physics of travel into/out of the solar system — revisit with Astra                                                                                                                                                   | D2 + D3 (frame ladder + cue physics)                                                  |
| R6  | Decel doesn't slow, abrupt flip; travel animation must be graceful/cinematic/realistic                                                                                                                                | D3                                                                                    |
| R7  | Babylon vs legacy arrival difference; card missing; click-anywhere/spacebar exits dossier, ship stays                                                                                                                 | D4 (root cause: fs-* travel is a silent no-op on Babylon; vista has NO dismiss input) |
| R8  | Collector card vs hover card mixed up? Audit                                                                                                                                                                          | D4 (audited 2026-07-22: NO content mix-up — real defects are listed in D4)            |
| R9  | Rename RNG and SOL buttons meaningfully                                                                                                                                                                               | D5                                                                                    |
| R10 | All travelable DSOs searchable in the Where-To console                                                                                                                                                                | D5                                                                                    |
| R11 | Spaceship travel physics audited and fixed                                                                                                                                                                            | D3 (+ Astra brief §3, post-implementation REALISM-AUDIT)                              |
| R12 | Gaia DR3 Tiny (2.55M stars) background-field replacement — promoted from PF-10's out-of-scope list                                                                                                                    | D8                                                                                    |
| R13 | Memory/runtime optimisation; space/time complexity matters                                                                                                                                                            | D7                                                                                    |
| R14 | Vertical slicing, thorough testing incl. manual regression per slice                                                                                                                                                  | Method (below) + CLAUDE.md #25                                                        |
| R15 | **Render Console** (owner, 2026-07-22): a dossier-format settings panel to multi-select which DSO/celestial layers render, per the machine's capability — frictionless UX; tiers become default presets, not ceilings | D9 (+ ADR-0010)                                                                       |
| R16 | On Return Home, the spaceship orbits Earth (owner, 2026-07-22, attached to the D5.1 approval)                                                                                                                         | D6.4 home-orbit sub-scope (spec'd in the implementation plan)                         |

## Decisions log (owner, 2026-07-22 — recorded in [ADR-0010](../adr/0010-owner-decisions-render-console.md))

| Decision            | Resolution                                                                                                                                                                                                            |
| ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D3.3 mid-warp input | **`goHome` = warp ABORT (flip-early-and-brake home); `travelTo` mid-warp = retarget QUEUE (launches on arrival). HUD feedback in both cases.**                                                                        |
| D6.1 exposure model | **Reinhard response curve** (never clips; the compressed 9.0:1→2.9:1 Tethys:Moon ratio is a declared license). Opposition-surge move into `refl` still lands first.                                                   |
| D6.2 belt frame     | ~~No decision yet — remains open.~~ **GO on re-expression (owner, 2026-07-22, later same day): belt model + data move to the obliquity-inclined basis; m42 route re-tuned; Kirkwood regression must pass unchanged.** |
| D6.5 asset weight   | **Unblocked from D0.3.** The trim question dissolves into D9: heavy layers become opt-in, fetch-on-enable downloads; ADR-0009 byte gates remain; a boot-critical download budget is added.                            |
| D5.1 control names  | **`RANDOM JUMP ▸` / `◂ RETURN HOME` approved** (card's `◂ RETURN TO SOL` converges too). Plus R16: home = Earth orbit.                                                                                                |
| D4.4 card content   | **Owner-approved generated drafts, grounded in official sources** (NASA/ESA/IAU/literature; citations recorded per card; licensing rules per docs/research).                                                          |
| D8.1 DR3 Tiny scope | **ALL 2,552,302 stars ship** — as a D9 layer (chunked, fetch-on-enable); D0.3 sets per-device _defaults_, not caps.                                                                                                   |

## Goals (owner, unchanged)

1. Maximum realistic rendering, physics, and cinematics — with every departure from reality a
   **declared** license, never an accident (Astra's four-tier taxonomy governs).
2. Extreme performance — measured on real devices, never assumed.
3. Native-feeling responsiveness across desktop, tablet, and mobile.

## Method — vertical slices with a hard per-slice gate

Every slice below is a **vertical slice**: engine + UI + data + both shader twins (where
shaders are touched) + reduced-motion + no-WebGL behaviour + unit tests + E2E + docs, delivered
end-to-end before the next slice starts. Per CLAUDE.md **#25** (added 2026-07-22), each slice
ends with:

1. `npm run build && npm run test && npm run test:e2e && npm run budget:check` — green, exact
   counts recorded in the slice's TR;
2. a **manual regression checklist** on the built preview (`npm run preview`): boot
   console-clean → travel near (Moon/Mars) → travel far (M42) → arrival dossier open/dismiss →
   Where-To search → classic-view toggle → reduced-motion pass — plus the slice's own feature
   checks;
3. realism slices additionally get an **Astra REALISM-AUDIT** (docs/analysis/) before the TR
   closes.

**Strategy Gate:** no PF-11 feature scorecard exists; the milestone-type card
(`docs/llm/llm-strategy-scorecard-5milestone.md`) governs, same recorded exception PF-09 B0 and
PF-10 took. Re-run per-slice against the 3feature card when a slice enters IMPLEMENT.

## Constraints (standing)

- External libraries are allowed (owner R1) **subject to**: no `@babylonjs/core` barrel, no
  CDN/CSP violations (ADR-0005), no Chinese-jurisdiction hosted deps, bundle/asset budgets
  (`budgets.config.mjs`) hold, and an ADR for any new runtime dependency.
- **Licensing tripwire (research-confirmed 2026-07-22):** gaiasky.space site content is
  CC-BY-**NC**; the Gaia Sky black-hole shader is CC-BY-**NC-SA** — never port either. Gaia Sky
  _original datasets_ are CC-BY ("Gaia Sky (Toni Sagristà, ARI/ZAH)" credit); Gaia data itself
  follows ESA/DPAC terms ("ESA/Gaia/DPAC"). Per-asset licenses verified before any new texture
  ships — see [docs/research/texture-sources-public-domain.md](../research/texture-sources-public-domain.md).
- Corrections are additive; TR per slice; ADR per decision; this plan's history is load-bearing.

---

## Phase D0 — Trustworthy instruments (first, because everything else is measured through them)

### D0.1 Frame-production liveness root cause (closes handoff C7) — ✅ partially advanced 2026-07-22

The E2E cumulative-load failure class (80/87 → count drifting, membership rotating) is
frame-production liveness under load. TR-080 (2026-07-22) root-caused and fixed the two
owner-reported failures — the 30s default test ceiling predates PF-10 scene scale, and a
dead-code `goHome` "reset" masked a 4s poll calibrated for a lighter scene — and the full
suite now passes 86/87 with the one remaining failure A/B-confirmed as this cumulative-load
class (passes in isolation, error log shows the awaited state present at timeout).

**Remaining scope:** decouple the Milky Way band's 20-rows-per-frame build from frame delivery
(time-budgeted or idle-callback chunks — build wall-time must not scale with 1/fps; keep the
TR-059 placeholder-texture discipline and the frames-keep-producing regression spec green);
audit the other frame-coupled builders (SDSS mesh build, bonus-layer merge) for the same
pattern; re-run the full suite ×3 under deliberate load and record the count.
**Exit:** 3 consecutive full-suite runs green under load; TR documents the mechanism.

**✅ DELIVERED 2026-07-22 — [TR-081](../test-reports/TR-081.md).** The band build is now
**deadline-paced**: each slice builds at least the rows owed to finish the grid by an 8 s
wall-clock deadline at the cadence it is actually being driven at, capped at 50 ms so
frames still outrank the band. Measured `bandReady` under a loaded SwiftShader run:
16.4 s → 14.0 s, and — the point — insensitive to fps, where the old 26-rendered-frame
build was unbounded as fps fell. **The implementation plan's prescribed mechanism was
disproved by measurement and corrected additively**: a `setTimeout(0)` chain gets only
~10 callbacks in 5 s on this page (the render loop saturates the main thread), so timers
alone made the build _slower_ (65 s). The other three bulk builders were audited: none is
per-frame chunked — each blocks a single frame, which is D7.3's worker scope, recorded not
changed.

### D0.2 Pixel-proof for planet spheres (closes handoff B4)

Five sessions of engine-state-correct-but-no-pixels. Add a harness-only camera bearing override
(e.g. `?lookat=body` or a `sceneStats`-adjacent test hook) so `page.screenshot()` can actually
frame the sphere (CLAUDE.md #11 — screenshots, never `drawImage`). Then capture the first-ever
pixel confirmations of Mars/Moon/Earth-class arrivals and wire one into E2E as a
non-blank-region assertion.
**Exit:** a committed screenshot per sphered body class; one pixel assertion in CI.

**✅ DELIVERED 2026-07-22 — [TR-082](../test-reports/TR-082.md).** Root cause: the camera lands
at the right standoff on arrival, but nothing ever re-aimed its **bearing** —
`_tickWarp`'s idle branch re-derives orientation from free-look `_yaw`/`_pitch`, never pointed at
the body. Shipped `aimAt(bodyId)` (gated `?testhooks`) inverting `freeLookDir` to set those two
fields at the body's world position; the existing render loop does the rest, no new rendering
path. `tests/e2e/planet-pixels.spec.ts` screenshots the canvas and asserts luminance + variance
floors for Mars and Moon; both reference screenshots committed
(`docs/test-reports/assets/pf11-d0.2-{mars,moon}.png`) and viewed by eye — the first genuine
pixel confirmation either sphere has ever received. Earth-class is deferred to D6.4 (Earth is
unreachable until its home-orbit reveal lands), as this slice's own exit note anticipated. Full
gate: 561/561 unit · 88/89 E2E (the one failure is D3.2's already-documented GAP-17 flip-window
flake, unrelated) · budgets green.

### D0.3 ADR-0008 real-device pass (owner-involved; unblocks D6.5, D6.1 tier calibration, D8)

Desktop + owner's mid-tier and flagship Android (tablet if available), cold loads on the built
preview with `?perf=1`: RENDER FPS, startupMs, device signature — the measurement-discipline
validity checks apply (reject `renderFps > displayHz`, repeated device blocks, `startupMs < 300`).
This also supersedes/closes PF-09's still-OPEN B6 device gate (TR-068/069 recorded MIXED) or
records why not.
**Exit:** a TR with per-device numbers; the asset-weight and tier-gating decisions (D6.5, D6.3)
become decidable; PF-09 B6 status resolved either way.

**✅ DELIVERED 2026-07-22 — [TR-083](../test-reports/TR-083.md), round 3 of the B6 device pass.**
Real numbers on all 3 owner-available device classes (desktop, mid-tier Android Galaxy S20 FE,
flagship Android Galaxy S24 Ultra), LAN-served build (`--host`), validity checks applied, none
rejected. Result: the flagship-underperforms-mid-tier anomaly TR-068/069 found reproducible
across 2 rounds **reversed** this round — S24 Ultra 60fps (its best reading by far, up from
28-37fps) now beats S20 FE's steady 45fps, and both clear the ≥40fps mid-Android floor together
for the first time. Desktop improved to 45-52fps but still misses its 60fps target. The
ENGINE/TIER/device-signature overlay line remains uncaptured for a third consecutive round, so
the reversal's cause (tier resolution vs backend vs device/session state) is not confirmed —
recorded honestly as a real, unexplained result, not a closed hypothesis. **PF-09 B6's §A gate is
NOT unilaterally closed** (A2 iPad and A4 WebGL2-fallback remain untested, A1 desktop still
fails) — consistent with TR-068/069's standard applied the same way on a third round. D0.3's own
exit criterion (real per-device numbers feeding D6.3/D8/D9.4) is satisfied regardless.

## Phase D1 — Intro cinematic: real loading dossier → launch from Earth (owner R2)

**Audited baseline (2026-07-22):** there is NO splash today — SSR content is CSS-hidden
(`body.ij-loading`, 9s CSS failsafe); `cosmos:progress` fires exactly once ({loaded, total}
after the first rendered frame); the HUD's "STREAMING CHUNK" bar sits at 0% then jumps; **no
fetch on the Babylon path exposes byte progress** (plain `fetch()`/`blob()`, no
`ReadableStream` readers; `ImportMeshAsync.onProgress` unused). `cosmos:ready` guarantees only
"one frame rendered + billboards placed" — not shaders validated, not textures, not ship, not
physics, not any post-ready bulk layer.

### D1.1 Real progress instrumentation (the honesty contract)

ReadableStream byte-progress readers on every boot-path and post-ready fetch (stars-hip 2.02 MB,
deep 0.87 MB, atlas-map, craft GLB tiers, Havok WASM 2.09 MB, then sdss18 47.1 MB, belt 2.08 MB,
bonus PNGs, atlas.jpg); per-stage `cosmos:progress` events with `{stage, loadedBytes,
totalBytes, records?}`; stage-completion signals for the non-fetch stages (engine init, shader
first-frame, band build rows, mesh builds). **The dossier must derive from these signals only —
a timed animation is the instrument-fabrication defect this repo already refuses (Astra brief
§4; CLAUDE.md measurement discipline).**
**Exit:** unit tests on the progress reader; an E2E asserting monotone byte progress totals
match asset sizes on disk.

**✅ DELIVERED 2026-07-22 — [TR-084](../test-reports/TR-084.md).** `src/lib/load-progress.ts`
(`fetchWithProgress` over the `ReadableStream` reader + `StageAggregator` for the multi-URL
stages) and the new **additive** `cosmos:stage` event; `cosmos:progress` untouched and now
E2E-guarded against silent shape change. Nine stages wired, seven of them real transfers —
and **every reported total equals its file's real size on disk byte-for-byte** (star-catalog
2,891,934 · atlas-map 11,624 · craft-glb 1,068,460 · havok-wasm 2,094,566 · bonus-layers
5,793,682 · sdss-field 47,125,068 · asteroid-belt 2,084,121). Two assets were previously
unobservable by ANY progress UI: Havok's 2.09 MB WASM (Emscripten fetches it inside the
factory — solved by streaming it and handing over `wasmBinary`, with the vendored runtime
probed to confirm no double fetch) and the craft GLB (`ImportMeshAsync.onProgress` had simply
never been passed). `budgets.config.mjs` gains **`bootCriticalDownloadKB: 2900`**, the first
ceiling here measured in what a visitor waits for, unit-asserted against real on-disk bytes.
Three scope points recorded additively in the implementation plan rather than resolved
silently: the plan's prose names two emitters its own type block omits (band progress already
has a real signal from D0.1), `atlas-photo` is deliberately deferred (Babylon's `Texture`
exposes no byte progress), and D1-AC1 belongs to D1.2 because it asserts a _visible_ surface.
Full gate: **572/572 unit · 93/93 E2E** (fully green) · budgets green (JS +1.1 KB).

### D1.2 The PRE-FLIGHT dossier UI

A **PRE-FLIGHT · SYSTEMS CHECK** loading surface (the experience review's name — "dossier"
is already overloaded across three UIs; also better fiction), replacing the bare CSS-hidden
state, per the review's S0–S4 state machine: **identity block first** (name + role in the
hero hierarchy — the recruiter learns whose portfolio this is in the first 2 seconds), live
stage checklist with real byte/record counters (counters may ease toward the latest real
value, never ahead of it), engine line (real, from the probe), and a **LAUNCH ▸** button
(subcopy `ENTER PORTFOLIO · FLIGHT MODE`) that arms when a genuinely _minimal_ boot-critical
set is ready — post-ready bulk layers shown honestly as "STREAMING IN BACKGROUND", and a
degraded S1e state (`STALLED` + `PROCEED ANYWAY ▸`) instead of an infinite wait.
**Skip affordances are mandatory scope, not polish** (research plan risk #1, 20/25): a
`SKIP INTRO` link during loading, Esc/Space/click + `SKIP ▸` during the ascent, and a
returning-visitor bypass (`sessionStorage`) — reduced motion must not be the only fast path.
**Mobile scroll mode never waits** (preserves today's instant-clear semantics); pre-flight
exists only in travel mode. Reduced-motion: static dossier, text-only updates. No-WebGL:
resolves to the DOM fallback with navigation intact, LAUNCH never shown armed over a scene
that cannot start.
**Exit:** adopted criteria **D1-AC1..7** (research plan §4) + axe-clean + the 9s CSS
failsafe / 8s hard-timer semantics preserved or consciously replaced (documented in the TR).

**✅ DELIVERED 2026-07-23 — [TR-085](../test-reports/TR-085.md).** New `PreFlight.tsx` +
`preflight-state.ts` (pure state machine/stall detection) + shared `focus-utils.ts` (D4.3
reuses it). Identity renders on mount, ahead of arming; LAUNCH disabled ("ARMING… N%") until
every boot-critical `cosmos:stage` closes, then auto-focuses; SKIP INTRO available from mount
(the plan's own "SKIP INTRO link during loading" wording, not the state diagram's S2-only
reading — recorded as a judgment call in the TR); a stall (10s silent boot-critical stage)
shows PROCEED ANYWAY; a `sessionStorage` returning-visitor bypass skips the dossier from the
render initializer so it never flashes. The **9s CSS failsafe is preserved verbatim** as a
value but its condition was corrected by real E2E evidence: it was firing during entirely
normal loading (craft alone is calibrated up to 45s) and had to be scoped to
`:not(.ij-preflight-mounted)` so it only ever fires on a genuine hydration failure. Unit tests
caught a real focus-management bug before any browser ran it; the E2E suite caught the
failsafe collision and one further class (5 named test changes, all one root cause:
`#ij-preflight` structurally shares its screen region with `#ij-mission-bar` by design). Full
gate: 595/595 unit · 100/101 E2E (the one failure is D3.2's already-documented GAP-17 flake) ·
budgets green. No dedicated Astro/SSR shell was built (scope call, recorded in the TR) — every
other scene-chrome surface in this codebase is React-only too.

### D1.4 First-party funnel instrumentation (`?funnel=1`)

The research plan's §3 design: a ~50-line `cosmos:*`-bus session recorder (localStorage ring
buffer, hard size cap), a debug overlay behind `?funnel=1` following the existing
escape-hatch resolution order, and a COPY DIAGNOSTICS button emitting one JSON blob (funnel
timeline + perf-telemetry device signature). **No analytics services — ever** (ADR-0005/CSP
posture; the absence of tracking is itself a credential). Blob validity discipline mirrors
perf-telemetry's (reject non-monotone timestamps / repeated device blocks).

**✅ DELIVERED 2026-07-23 — [TR-086](../test-reports/TR-086.md).** New `src/lib/funnel.ts`
(`FunnelRecorder`, ring-buffer localStorage persistence, `resolveFunnelOverlay` mirroring
`resolveEngine`'s URL→stored→default shape, derived-flag helpers for all three research-plan
metrics) + `FunnelOverlay.tsx` (the debug panel — zero runtime `style` props, unlike the
pre-existing `?perf=1` overlay it sits beside). The recorder always runs
(`window.__ijFunnel()`, same convention as `__ijPerf()`); only the visible overlay is gated.
Milestones wired at the real `cosmos:*` listeners/UI callbacks already in `SpaceScene.tsx`.
**Two real bugs found before/during VERIFY:** a React error #310 hooks-order crash (a new
effect sat after a pre-existing `if (!engineReady) return null` early exit — fixed by recording
synchronously inside the existing `onCmdChange` callback instead of adding an effect), and
`cosmos:warp` proving structurally unable to detect its own start (`cosmos:select`'s own handler
already sets `state.warp` before the first `cosmos:warp` tick — the `travel` milestone moved
there instead). Also found and **documented, not fixed**, a pre-existing z-index click
interception between `#ij-mission-bar` and `ArrivalVista`'s button row — handed to D4.1, whose
vista-dismissal rework replaces that whole interaction. Naming decision recorded: the recorder
stores repeatable action names (`travel`, `search-keystroke`, `vista-dismissed`, …) rather than
the plan's literal `first-X` labels — `firstEventTime()` recovers that exact semantic on demand,
while `vista-dismissed` needed every occurrence for the accidental-warp detector to work at all.
Full gate: **619/619 unit · 107/108 E2E** (the one failure is D3.2's already-documented GAP-17
flake, confirmed unrelated via 3 isolation runs) · budgets green (JS +1.4 KB).

### D1.3 Launch cinematic + console reveal

Pressing LAUNCH plays the Earth-surface → space ascent (Astra keyframes: barometric sky-colour
`exp(−h/8.5 km)`, star reveal as sky luminance drops (~50–80 km), limb ring at the Kármán
altitude — the one geometry where a blue limb IS honestly in frame), hands off to the standard
warp choreography, and reveals the Where-To console at its **canonical 54vh second-third
dock** — the experience review found the codebase already answers the placement question
(`global.css` at-home dock); formalise `top: clamp(45vh, 54vh, calc(66vh − bar height))` and
animate the reveal _into that exact dock_ so post-launch and post-`goHome` states are
identical. **Mobile travel mode: bottom-docked** (`env(safe-area-inset-bottom)`) — a
mid-screen input collides with the virtual keyboard; "second third" is a desktop/tablet
spec. Skippable at every moment (D1.2). Pairs with the Earth `goHome` reveal (D6.4) — the
same sphere, launch is the reveal played forward. Declared license: ~8 s for a ~8 min ascent;
colour/altitude physics real.
**Gate before full build:** the research plan's two cheapest validations (LAUNCH-gate
hallway test ×5, dossier-vs-spinner probe) — either can re-scope this slice.
**Exit:** manual regression + Astra REALISM-AUDIT; D1-AC2/AC3/AC6 (keyboard chain, skip
visibility, reduced-motion = instant cut with console visible); E2E asserts the sequence
completes and the console container takes focus (container, not input — mobile keyboard).

**✅ DELIVERED 2026-07-23 — [TR-089](../test-reports/TR-089.md)** (MOTION-SPEC:
[ascent motion-spec](../experience-design/2026-07-23-pf11-d1.3-ascent-motion-spec.md); REALISM-AUDIT:
[ascent review](../analysis/2026-07-23-pf11-d1.3-ascent-realism-review.md)). LAUNCH plays an ~8 s
radial climb from Earth's surface to the home vantage — sky `exp(−h/8.5)` blue→black, stars in at
~50–80 km, a fresnel-rim limb glow across the Kármán line — then hands off SEAMLESSLY into the D6.4
home orbit and reveals the console into the 54vh dock. **It is the D6.4 reveal played forward**: the
ascent's end standoff is unit-asserted equal to the home standoff, so LAUNCH and `goHome` land the
identical frame. New pure `ascent.ts` (curves + limb shader twins), `warp.mode = "ascent"` driven on
wall-clock dt, a skippable-at-every-moment `AscentSkip` overlay, reduced-motion instant cut. Astra:
no BROKEN PHYSICS in what shipped; the carried-forward α=90° Earth photometry is now **escalated**
(two features depend on it — wants Astra's numbers before the next Earth change). The pre-build UX
gate (hallway ×5, dossier-vs-spinner) is owner-run and flagged, not blocking the code.
**Note on the request framing:** D1.3 was asked to unblock D1.4, but D1.4 shipped earlier (TR-086);
the plan's sequencing is "D6.4 must precede D1.3", and D6.4 (TR-088) is what actually unblocked
this. D1.3 now completes Phase D1's cinematic arc.

**✅ ESCALATION CLOSED 2026-07-24 — [TR-092](../test-reports/TR-092.md).** The carried-forward
α=90° Earth photometry (the one open item above) is computed and fixed: Astra's disc integration
of the shipped shader math found Earth rendering **×1.50 too bright at quadrature** (Φ(90°)=0.354
vs the measured 0.236, Mallama 2017's EPOXI-fitted phase curve). The surface constants both stand
(L=0 mechanism-correct at all phases; 0.213's α=0 anchor corroborated) — the gap was the cloud
slab's missing Mie forward-scattering deficit, closed with one solved constant
(`CLOUD_QUAD_DEFICIT = 0.539`, exactly 1 at α=0 so every travelTo arrival is bit-identical; ledger
L18; derivation in the [Earth brief Addendum 3](../analysis/2026-07-21-earth-sphere-science-brief.md)).
**Phase D1 now has no open items.**

## Phase D2 — The frame ladder: sky honesty by destination (owner R3/R4/R5)

**Audited baseline:** the band is a camera-locked `infiniteDistance` skybox with **zero**
destination awareness; both belt halves are world-resident and never hidden — the visual mesh
is `alwaysSelectAsActiveMesh` (never frustum-culled) with a 1 px size floor and no distance
fade, so it renders as a faint ring even parked at the deepest SDSS-scale bodies; Havok steps
every frame regardless of camera distance. Astra verdicts: band ACCURATE everywhere inside the
galaxy (identical from Moon/Mars/Pluto is correct physics); belt beyond ~tens of AU and the
360° band at extragalactic arrivals are BROKEN PHYSICS.

### D2.1 Solar-system furniture gating

Fade belt visual + sleep Havok + solar glare/planet billboards on destination `ly` (fade start
ly > 0.001 ≈ 63 AU, gone by ly ≈ 0.1), keyed to warp progress k so the fade is part of the
cinematic. Havok sleeping is also a measured perf win (D7.5). Reduced motion: state swaps at
arrival, no animated fade. Both shader twins (any fade uniform in the shared `ijStar`
material path must be twin-parallel).
**Exit:** E2E asserts belt stats visible at Mars, absent at M42; Kirkwood regression spec
unaffected at home; Astra audit.

**✅ DELIVERED 2026-07-23 (with D2.2) — [TR-090](../test-reports/TR-090.md).** Belt visual +
Havok sleep are keyed on the destination `ly` + warp `k` through `_beltMat`'s `uLayerFade`
(a `_starMat` clone); `beltPhysicsAwake` flips false past ~0.1 ly and `_tickAsteroids` skips the
force loop + the collision-shake callback (no phantom shake from invisible rocks). The E2E asserts
belt physics awake at Mars / asleep at M42; the Kirkwood regression is untouched (the belt DATA is
unchanged — only its fade + physics gate). Sun/planet-billboard glare is NOT individually faded
(shared-material mesh, no per-body channel) and the deeper Havok integration-halt is D7.5's —
both recorded honestly in the [realism audit](../analysis/2026-07-23-pf11-d2-frame-ladder-realism-review.md).

### D2.2 Extragalactic collapse + external Milky Way

At NEARGALCAT/SDSS-scale destinations (destination ly ≥ ~1e6): band + local star field +
constellations fade during warp; an external-galaxy impostor (single lit disc sprite, angular
size from real distance — ~10′ at 32.6 Mly) appears toward the origin direction. Texture from
the deferred photographic Milky Way skybox pack **after** its license verifies (research doc;
Risinger pano is credited without a printed license string — verify before shipping, else use a
procedural impostor derived from the existing band texture).
**Exit:** travel to an NBG galaxy shows no 360° band; return home restores it; license ledger
entries recorded; Astra audit. Legibility mitigation (research plan risk #5): one HUD line at
extragalactic arrival — e.g. `LOCAL FIELD BELOW RESOLUTION · MILKY WAY ASTERN` — so the
collapse reads as physics, never as a rendering bug; usability probe T7 confirms zero
participants misread it.

**✅ DELIVERED 2026-07-23 (with D2.1) — [TR-090](../test-reports/TR-090.md).** At destination
`ly ≥ 1e6` the band (`uFade × _localFieldFade`), the merged local star field (`_localMat`'s
`uLayerFade`) and the constellation figures (`_conMat` alpha × `_localFieldFade`) collapse together
during warp, and a **procedural, license-clean** external-galaxy impostor (its own `ijImpostor`
shader twins, texture from the band's own tone model — the Risinger pano's licence is unverified so
it is NOT shipped) appears astern, sized by the target's real angular subtense floored to a visible
minimum. HUD line `LOCAL FIELD BELOW RESOLUTION · MILKY WAY ASTERN` at extragalactic arrival. E2E:
travel to nbg-a0554-07 → `bandFade` 0 + `impostorVisible` true; goHome restores. License-ledger
entries L12 (procedural impostor) + L13 (size floor) recorded in the
[sky-frames brief addendum](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md#addendum--license-ledger-entries-added-by-d21d22-2026-07-23-tr-090);
[Astra audit](../analysis/2026-07-23-pf11-d2-frame-ladder-realism-review.md). The usability probe T7
is an owner-run human study, flagged not blocking. **D2.3** (constellation dissolve at ly 50–500 +
the full 4-entry ledger) remains — the figures here fade only as part of the extragalactic collapse.

### D2.3 Constellation dissolve + license ledger

Fade constellation figures past destination ly ≈ 50–500 (they are parallax accidents — Astra
brief §1). Record the four ledger entries the brief proposes (belt overbrightness ~10⁶×;
seconds-scale warps; band/figure persistence during in-galaxy travel; intro timing compression).
**Exit:** ledger lives in the realism map / analysis doc; E2E covers figure fade.

**✅ DELIVERED 2026-07-23 — [TR-091](../test-reports/TR-091.md).** The figures now dissolve on
their own `ly 50→500` schedule (`_figureFade`, independent of D2.2's extragalactic collapse),
driven through the same fade-scheduler pattern D2.1/D2.2 established — full at Mars, partial at
Polaris (433 ly), gone by M42 (1,344 ly). The full 4-entry ledger the brief proposed is now
formalised (L14-L17) as a dated addendum on the
[science brief](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md#addendum--the-full-4-entry-ledger-completed-by-d23-2026-07-23-astra),
cross-referencing the two entries already ledgered elsewhere (L9 intro timing at D1.3, L1
Reinhard compression at D6.1) rather than duplicating them. Astra's
[REALISM-AUDIT](../analysis/2026-07-23-pf11-d2-frame-ladder-realism-review.md#realism-audit--d23-constellation-dissolve-2026-07-23-astra)
grades the split-schedule mechanism ACCURATE and the `ly 50→500` window itself DECLARED LICENSE
(L17, new) — real constellation-figure stars span roughly 80 to 2,600 ly, so a single scene-wide
constant is necessarily a documented approximation, not a per-figure-derived threshold; the
audit's numbers appendix computes the parallax order-of-magnitude for a near (Ursa Major) and a
far (Orion) figure to show why. **Phase D2 is now complete.**

## Phase D3 — Flight model v4: graceful, legible deceleration (owner R6/R11)

**Audited baseline:** velocity profile is a pure triangle (`warpEase` derivative — no cruise);
the flip is eased but compressed into k∈[0.47,0.53] = **84–252 ms wall-clock**; hull and camera
share the identical eased translation so relative motion encodes only the chase-offset
derivative — and during decel the waypoint table pulls the camera **closer** (back-distance
3.5 → 2.2 across k 0.8–0.92), _enlarging_ the ship while braking; decel cues are only parallax,
trail fade, aberration decay, and the HUD number; the legacy FOV breathing was never ported;
`travelTo`/`goHome` silently no-op mid-warp (both engines).

### D3.1 Deceleration legibility

Drive every speed cue from d(warpEase)/dk (streak length, aberration β, plume intensity — some
already are) **and add the two cues perception actually uses** (Astra §3.2): destination
angular-size growth with visible closure-rate ease-out, and a chase offset that opens distance
during braking instead of closing it (rework the waypoint table's decel segment). Port or
consciously decline the legacy FOV breathing (recorded either way). HUD label semantics
(ACCELERATION BURN / FLIP & BURN / BRAKING BURN) must match what the picture shows.

**✅ DELIVERED 2026-07-24 — [TR-093](../test-reports/TR-093.md)** (Vega
[SHOT-BRIEF](../experience-design/2026-07-24-pf11-d3.1-deceleration-legibility-motion-spec.md) +
[MOTION-AUDIT](../experience-design/2026-07-24-pf11-d3.1-deceleration-legibility-motion-review.md)).
The chase no longer looms the ship while braking: the decel waypoints open to a pull-back
(back 5.8 at k=0.72) then monotone-settle to arrival framing, staying ≥ SHIP_VIEW_DEPTH the whole
brake so the ship never exceeds arrival size before k=1 (the old table dived to 2.2 — 37% oversize
mid-brake). The **legacy FOV breathing is ported** (`warpFovMult`, +6% at the k=0.5 speed peak,
relaxing to rest, off under reduced motion) — driven off the same `dsdk` as β and the streaks so no
cue disagrees; the SHOT-BRIEF caught that the breathing base must be the camera's runtime 0.8-rad
FOV, not `SHIP_BASE_FOV`. Streaks + β confirmed already derivative-driven; plume cutoff/relight is
D3.2. HUD decel label → **BRAKING BURN**, and `wphase` now sources the shared
`WARP_ACCEL_END`/`WARP_DECEL_START` constants so D3.2's window-widening is a one-place change. Every
existing `chaseOffsetAt` test passes unchanged; the FOV cue-proof rides the stable chase-camera E2E
(not the flaky GAP-17, which D3.2 fixes). Astra ledger confirmation deferred to the post-D3 full
REALISM-AUDIT.

### D3.2 Flip choreography

Widen the flip to k∈[0.44,0.56] (~12% of journey, screen-time floor ≥ 1.5 s on non-reduced
paths — duration floor logic, not just k-window), C²-continuous hull rotation, plume cutoff at
flip start / relight at flip end (thrust must visibly oppose motion after the flip), RCS puff
sprites at rotation start/end, camera holds its line while the hull rotates in-frame.
Reduced motion keeps the current instant swap.

**Evidence added 2026-07-22 ([TR-081](../test-reports/TR-081.md)):** the missing duration floor
is measurable, not only a legibility judgement. `cosmos:warp` fires once per rendered frame and
polaris's flip window is ~195 ms of wall clock, so a single frame longer than that **skips the
`flip` phase entirely** — the GAP-17 spec's intermittent `indexOf("flip") === -1` failure. A
visitor on that frame rate never sees a flip either. The duration floor fixes both.

**✅ DELIVERED 2026-07-24 — [TR-094](../test-reports/TR-094.md)** ([ADR-0011](../adr/0011-warp-velocity-profile-v4.md)
· Vega [SHOT-BRIEF](../experience-design/2026-07-24-pf11-d3.2-flip-choreography-motion-spec.md)).
The design pass found the implementation plan's prescribed floor formula **arithmetically
backwards** (it fired on every journey and would have set every warp to 12.5 s) — corrected in
ADR-0011 and superseded in the implementation plan. What shipped instead: the **v4 trapezoid
profile** with a genuine constant-velocity coast across the widened `[0.44, 0.56]` window (the
old triangle made every speed cue _sag_ through an engines-off coast), the floor delivered by an
in-window k-rate multiplier whose coast-slope compensation keeps world velocity **continuous** at
both edges, and `warpSpeedNorm` replacing the `dsdk` triangle so β, the D3.1 FOV breath and the
HUD velocity all **hold peak through the flip**. Choreography per Vega's five beats: eased burn
cutoff → drift beat → **C² smootherstep rotation** across a `[0.465, 0.545]` sub-window with RCS
puff couples at its ends → settle beat → retro relight. The blast-radius sweep caught a hidden
fourth threshold consumer (`NEBULA_REVEAL.decelStart`, re-keyed 0.53 → 0.56, else the gas reveals
mid-rotation). **Journeys grow ~1.0–1.3 s and home roughly doubles (1.4 → 2.7 s)** — the
unavoidable cost of a fixed wall-clock floor, owner-flagged, tunable via `FLIP_MIN_MS`.

### D3.3 Mid-warp input policy — ✅ DECIDED (owner, 2026-07-22, ADR-0010)

Today a warp is unabortable (silent no-ops — discovered fixing TR-080's dead-code reset).
**Decision: `goHome` mid-warp ABORTS the journey** (early flip + brake onto a home-bound
path — choreography spec in the implementation plan), and **`travelTo` mid-warp QUEUES a
retarget** (HUD `RETARGET QUEUED · {name}`, launched on arrival; last-selection-wins).
Never a silent no-op again — both paths give immediate HUD feedback, and the Where-To
console's mid-warp state (D5.2) reflects the queue.
**Exit for D3:** E2E flight-sequence specs updated (named test changes); Astra REALISM-AUDIT
of the full journey; manual regression near+far; reduced-motion parity.

**✅ ENGINE STATE MACHINE DELIVERED 2026-07-24 — [TR-095](../test-reports/TR-095.md).** The
decision is one pure module (`flightInputPolicy(mode, request)` → proceed/queue/abort/ignore) so
the engine, the HUD badge and the D5.2 console read the same verdict instead of re-deriving three
copies of a mode disjunction. Abort inherits the ship's live position by construction
(`_beginWarp` already reads the integrated `this.cam`) and replays a full D3.2 accel/flip/brake
home; `queuedTargetId` is public display state on the element (optional on the
`SpaceEngineElement` contract — the archived engine has no queue and keeps its no-op by design);
the queue drains one task after arrival, never inline. `ascent` is now the **only** surviving
no-op, and it is named `"ignore"` rather than left to fall through a mode list. The slice also
fixed a pre-existing UI defect it would have made worse: `sectionTravelRef` was consumed by the
next arrival whatever it was, so a nav click during a warp opened the section over the wrong body
— it now carries `{id, sec}` and matches.

**⚠ NOT the phase exit on its own — two D3.3 items remain open.** (1) **HUD strings are
deliberately not in this slice** (owner direction): the engine emits `cosmos:abort` /
`cosmos:retarget-queued` and exposes the queue, but nothing listens yet, so the policy is correct
and still **visually silent** — `ABORTING · RETURNING HOME` and `RETARGET QUEUED · {name}` land in
the follow-up pass, and only then is "never a silent no-op" actually met. (2) The abort's
**velocity discontinuity** — restarting the profile at `k=0` drops world speed to zero at the
press and opens with a 900 ms `aim` hold — is implemented exactly as the implementation plan
specified and pre-accepted, but it is the same class as R6 and is flagged for a Vega SHOT-BRIEF in
a D3 polish pass rather than tuned silently. The Astra REALISM-AUDIT of the full journey is still
outstanding.

**✅ HUD/CONSOLE STRINGS DELIVERED 2026-07-24 (Sonnet 5 follow-up) — [TR-096](../test-reports/TR-096.md).**
Item (1) above is closed: `ABORTING · RETURNING HOME` renders as a one-shot pill
(`NavNotice`/`SceneState.notice`, auto-clears after 2.2s) and `RETARGET QUEUED · {name}` as a
persistent badge (`SceneState.queuedTargetId`) independent of the notice's own lifetime — the
two answer different questions ("did my press register?" vs "is something still queued?") and
needed two separate pieces of state, not one. The mission console's `WHERE TO ▸` label swaps to
`QUEUED ▸ {NAME}` for the same duration as the badge — a minimal string-level acknowledgement,
**not** the D5.2 combobox rewrite the console's own richer mid-warp reflection is scoped to
(that surface doesn't exist yet). Clearing the persistent badge needed three separate listener
sites, because the DOM event stream doesn't give one signal for "the queue is gone" — the queued
journey launching (`cosmos:select`), the same-id no-op arrival case TR-095 introduced, and an
abort discarding it. "Never a silent no-op" is now actually true end to end.
**Still open:** item (2) (the abort's velocity discontinuity, unrelated to strings), the Astra
REALISM-AUDIT, and — new, named honestly rather than left implicit — **owner-eyes visual
confirmation**, which this harness could not perform in either pass (TR-096: the Browser-pane
harness never composites a frame in this environment; confirmed via real DOM-state assertions
instead, which is not the same as a human looking at it).

## Phase D4 — Arrival & cards (owner R7/R8)

**Audited baseline (settles R8):** three cards exist and are **not** content-mixed —
HoverTooltip (hover vitals CTA), ArrivalVista (arrival overlay + "OPEN COLLECTOR CARD ▸"),
CollectorCard (full dossier: stats bars, field note, sky lore). Curated-body event flows are
engine-identical. The real defects: (a) Babylon `travelTo` has **no `fs-` branch** — the
~168,883 hoverable field/deep-layer objects (WD/SDSS/OC/GD-1/EXO/AST/OORT ids) show "CLICK TO
TRAVEL ▸" then silently no-op, so their synthesized collector cards are dead code on the
default engine (this is the owner-perceived "babylon doesn't show the card" seam); (b)
ArrivalVista has **no dismiss input** — not Escape, not spacebar, not click; clicks pass
through to the canvas and can launch a NEW warp (the exact opposite of "dismiss and stay");
(c) stale hover tooltip persists under the card modal; (d) "dossier" naming is overloaded
across three UIs; (e) NGC2000 cards render a literal `[[TODO: content pass…]]`.

### D4.1 Vista dismissal (owner-specified) — ✅ DELIVERED 2026-07-25 ([TR-098](../test-reports/TR-098.md)):

click-anywhere / spacebar / Escape → vista closes, ship stays parked (pure React state —
`arrivedId` and camera untouched). Experience-review decisions ADOPTED: vista root is now a
real `role="dialog"` surface (pointer-events-auto, container focused on mount, focus restored
on dismissal), raised above `#ij-mission-bar`'s z-index so a dismissing click cannot fall
through and launch travel (the TR-086 root cause); **the 5.5 s auto-timeout is REMOVED**; a
visible hint line `CLICK ANYWHERE OR PRESS SPACE TO RESUME FLIGHT` (touch variant swaps the
dead hover copy); Space at dialog level dismisses while Space on the focused card button
activates it (correct native semantics); a global Escape stack (new `useEscapeStack`,
`focus-utils.ts`) ordered card → vista → suggestions → sectionOpen, replacing the old
close-everything-at-once handler; a 300 ms post-dismiss click-swallow window closes the
D4-AC2 double-click gap; **the card does NOT auto-open on arrival** (unchanged — the vista is
the cinematic payoff; the card keeps its two entrances, with the button strengthened). Escape
handled exclusively by the global stack, not also inside `ArrivalVista` itself (a documented
deviation from the implementation plan's literal phrasing — see TR-098). D4.2/D4.3/D4.4 remain
open, as scoped.

### D4.2 Field-object travel parity — ✅ DELIVERED 2026-07-25 ([TR-099](../test-reports/TR-099.md)):

implemented the `fs-` branch in Babylon `travelTo` (synthesized target, full
select→warp→arrive→vista→card flow, reviving `entryForFieldStar` on the default path). Two
real defects in the implementation plan's own prescribed port caught before shipping: the
legacy `fieldF` array is 4 floats/record, Babylon's `_field.positions` is 3 (a verbatim port
reads a neighbouring star); and the plan's prescribed `ly: L*3.9` disagrees with `fieldInfo`'s
own log-depth convention for PF-10's typed bonus layers by orders of magnitude, which would
have left D2.2's extragalactic collapse dead for exactly the deep-field objects it exists to
serve. Shipped routes `ly` through `fieldInfo` itself instead — the same source the tooltip
and card already read. Implementation plan corrected in place (superseded, not edited away).
The tooltip CTA and the click outcome never disagree (D4-AC4).

### D4.3 Card polish — ✅ DELIVERED 2026-07-25 ([TR-099](../test-reports/TR-099.md)):

hover cleared explicitly at both card-open sites AND `HoverTooltip` gated on
`!cardId && !vista` (belt-and-suspenders); "dossier" naming pass (the collector card is never
called that outside its own "dossier" visual-style option, which is a separate, pre-existing,
plan-endorsed concept — "dossier" itself stays reserved for section overlays); vestigial
`e.r === "field"` ternary removed; CollectorCard gained a real focus trap (new `trapFocus`,
`focus-utils.ts`) + focus move/restore on open/close, matching the `aria-modal` it already
claimed; style dots now have a real 24px hit target (WCAG 2.5.8) with `aria-label`/
`aria-pressed`; stat-bar decoration marked `aria-hidden`. Reuses D4.1's `moveFocusTo`/
`restoreFocusTo`/`useEscapeStack` rather than re-authoring them (a documented deviation from
this item's literal `moveFocus(el, restoreTo)` naming — see TR-099).

### D4.4 Content pass — ✅ BATCH 1 DELIVERED 2026-07-25 ([TR-099](../test-reports/TR-099.md)), owner-approved same day:

the 25 deferred cluster field-notes + lore, **owner-approved GENERATED drafts, grounded in
official sources** — every card's facts trace to NASA/ESA/refereed literature/mission
archives (source list per card in
[docs/analysis/2026-07-25-card-content-sources.md](../analysis/2026-07-25-card-content-sources.md));
numerical facts (distance/age/magnitude) reused the catalog's own already-hand-verified `"st"`
values rather than re-deriving them. New override-only `celestial-content-overlay.js`
(CLAUDE.md #22 — never hand-edits the generated `celestial-clusters.js`), sequenced strictly
after the base-catalog `Promise.all` in SpaceScene's import chain (not inside it — import
order within one `Promise.all` is not guaranteed).

**Batch 2 (41 NGC2000 nebula entries) — ✅ DELIVERED 2026-07-25** (drafted
[TR-100](../test-reports/TR-100.md), owner-approved and wired
[TR-101](../test-reports/TR-101.md)): all 41 ids researched (identities live-search-verified,
not blind guesses), written into a new sibling `celestial-content-overlay-ngc2000.js` + 6 new
unit tests, full source list in
[docs/analysis/2026-07-25-ngc2000-card-content-sources.md](../analysis/2026-07-25-ngc2000-card-content-sources.md).
Sequenced as its own `.then()` after batch 1's overlay in `SpaceScene.tsx`'s import chain (kept
as a separate module rather than added to batch 1's own file, since that file was already
wired live — a shared file would have shipped batch 2 without a separate approval gate). Two
data-quality findings flagged, not fixed (generated catalog, out of scope):
`ngc2000-crescent-nebula`'s own `ly` value is ~3 orders of magnitude off the real object's
distance; `ngc2000-butterfly-nebula`/`ngc2000-bug-nebula` looked like a pipeline duplicate but
are confirmed two different real objects (M2-9 vs NGC 6302) sharing a nickname. Total JS
budget raised 1200→1205 KB gz (`budgets.config.mjs`, TR-101) to absorb the deliberate content
growth.

**`isFarField` field-object defect — ✅ FIXED 2026-07-25 ([TR-100](../test-reports/TR-100.md)):**
the HUD's `MILKY WAY ASTERN` line was driven off a catalog-only lookup that always missed
`fs-` (field-object) ids, silently reporting every field arrival as near regardless of true
distance — unreachable before D4.2, reachable (and wrong) since. Fixed by routing through
`entryFor()`'s existing `fs-` fallback; new E2E coverage closes the "unverifiable by test" gap
this item was flagged with.

**Exit:** adopted criteria **D4-AC1..6** (incl. the double-click/rapid-click no-warp
assertion) + axe-clean + manual regression — D4.1's TR-098 and D4.2-4/TR-099 close all six.
**Phase D4 is now fully complete** except the one standing item across the whole phase —
owner-eyes manual regression (see TR-101's Known limitations — attempted again this pass too,
same standing Browser-pane constraint, new repro evidence recorded in TR-100).

## Phase D5 — Where-To console v2 (owner R9/R10)

**Audited baseline:** search reads `window.CELESTIAL` — all 4,829 catalog bodies ARE searchable;
missing are the 7 nav stations (About/Projects/… — travelable, never searchable), all fs-*
field objects, and a handful of referenced-but-absent bodies (Mimas, Iapetus, Phobos, Triton,
Charon); ids aren't matched ("ngc7293" fails where "ngc 7293" works); matching is unranked
substring with a hard `.slice(0,6)` — exact full-name matches can be buried; RNG =
`randomBody()` (uniform over 4,829), SOL = `goHome()`.

### D5.1 Meaningful controls — ✅ DELIVERED 2026-07-24 ([TR-097](../test-reports/TR-097.md))

**`RANDOM JUMP ▸` / `◂ RETURN HOME` approved** (the card's `◂ RETURN TO SOL` converges to
`◂ RETURN HOME` for one-phrase-per-action). The label-comprehension test (D5-AC5) still runs
as a post-approval sanity check — if it fails 4/5, that's new evidence brought back to the
owner, not a silent revert. Sub-400px compressed variants (`JUMP ▸` / `◂ HOME`) with full
text in `aria-label`/`title`; E2E updates are named test changes.
**Attached owner requirement (R16): `◂ RETURN HOME` ends in an Earth ORBIT, not a static
park** — the home state becomes a slow orbit around the revealed Earth sphere (implemented
with D6.4's reveal; orbital spec and constants in the
[implementation plan](../implementation/PF-11-implementation-plan.md#d64-earth-gohome-reveal--home-orbit-r16)).

**Approved 2026-07-22, implemented 2026-07-24** — the owner flagged the still-live `RNG`/`SOL`
labels a full two days after ADR-0010 recorded the decision; the gap was a delivery miss, not a
re-litigation. Shipped exactly the approved names, plus the compressed sub-400px variants and
the CollectorCard convergence as specced. **`SectionOverlay.tsx` carried the identical
`◂ RETURN TO SOL` string and was updated too** — not named in this entry originally, but the
same "one-phrase-per-action" rationale applies uniformly; leaving it would have shipped a new
inconsistency in the act of fixing an old one. D5-AC5 (the post-approval label-comprehension
check) has not run yet — recorded open in the TR, not silently skipped.

### D5.2 Search v2: index = catalog bodies + **stations (badged `STATION`, ranked above sky

objects at equal tier — the recruiter's actual goal)** + ids + designations; ranked matching
(prefix > word-start > substring > id); result cap ~10, scrollable, honest truncation
(`12 MATCHES · SHOWING 10`); **Enter travels to the ACTIVE (top-ranked) option**; empty-query
**FEATURED list** ("NOTABLE DESTINATIONS", 5–6 curated incl. ≥1 portfolio station); explicit
no-match state (`NO CONTACT · TRY "ORION" OR "SATURN"`); **mid-warp feedback** (`IN TRANSIT ·
ARRIVING AT {dest}`) — never a silent no-op, whatever D3.3 decides. The combobox ARIA
pattern (`combobox`/`listbox`/`aria-activedescendant`) IS the keyboard-nav work item — one
implementation, spec'd together.

### D5.3 Field-object classes in search — decision slice: expose class-level entries

(`A WHITE DWARF · NEAREST INSTANCE`, visually distinct) rather than 168k rows; depends on D4.2.

### D5.4 Missing-body audit: either add catalog entries for referenced-but-absent bodies

(Mimas, Iapetus, Phobos, Triton, Charon probed absent) or remove the references (each
recorded; Phobos/Deimos stay under the NEVER_SPHERE rule regardless).
**Exit:** adopted criteria **D5-AC1..6** (exact-name rank-1 corpus, stations travelable via
search, the nothing-travelable-is-unsearchable audit test, keyboard loop, label gate, real
phone check); every travelable destination reachable through search (R10 satisfied
literally); mobile suggestion list verified above the soft keyboard (and the
bottom-dock-opens-upward check — possible live bug folded in here).

## Phase D6 — PF-10 debt closeout (from the plan tail + handoff B/C sections)

| Slice | Item                                                                                                                                                                                             | Source                       | Note                                                                                                                                                           |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D6.1  | Exposure model: move opposition surge into `refl`, then apply the **Reinhard curve (DECIDED — owner 2026-07-22, ADR-0010)**; ratio compression declared in the license ledger                    | handoff B2                   | **✅ DELIVERED 2026-07-23 — [TR-087](../test-reports/TR-087.md)** (shipped with D6.3; see the note below the table)                                            |
| D6.2  | Belt 23.44° frame — **GO on inclined-basis re-expression (owner, 2026-07-22)**: model math into the ecliptic basis, `--frame equatorial` data regen, m42 route re-tune, Astra audit closes       | handoff C4 / TR-074          | steps: [implementation plan D6.2](../implementation/PF-11-implementation-plan.md#d62-belt-frame-re-expression--go); sequence after/with D2.1 (same code paths) |
| D6.3  | C4.3: terminator self-shadowing, tier gating (consume the shipped-but-unfetched 6.58 MB base tier), sRGB decode fix (B8 — CLAUDE.md #10 compliance), `uAtmosphere` per-body flag (B6)            | PF-10 C4.3, handoff B5/B6/B8 | **✅ DELIVERED 2026-07-23 — [TR-087](../test-reports/TR-087.md)** (all four sub-items)                                                                         |
| D6.4  | Earth `goHome` reveal at 90° phase (terminator, city lights, twilight band — resurrects the deleted night-light assets), feeding D1.3                                                            | handoff B1/C6                | **✅ DELIVERED 2026-07-23 — [TR-088](../test-reports/TR-088.md)** · D1.3 is now unblocked                                                                      |
| D6.5  | Asset-weight decision — **RESOLVED VIA D9 (owner 2026-07-22, ADR-0010)**: ultra/VT stay in the repo as opt-in fetch-on-enable layers; ADR-0009 gates remain; boot-critical download budget added | handoff C3, ADR-0009/0010    | no longer blocked on D0.3 (D0.3 now calibrates D9 defaults)                                                                                                    |
| D6.6  | C8 atlas cells for Tethys/Dione/Rhea; C9 Jupiter-moon offset ranks (Io most-separated in catalog, least in reality)                                                                              | handoff C8/C9                | C8 needs an atlas edit path — atlas is vendored, so a documented regeneration/patch pipeline first                                                             |
| D6.7  | Additive correction of the PF-10 plan header's "221 MB" (actual 256.01/256.34 MB)                                                                                                                | audit finding                | corrections-are-additive                                                                                                                                       |

**✅ D6.1 + D6.3 DELIVERED 2026-07-23 — [TR-087](../test-reports/TR-087.md)** (REALISM-AUDIT:
[exposure realism review](../analysis/2026-07-23-pf11-d6.1-exposure-realism-review.md)). They
shipped as ONE slice because the implementation plan requires it — adding D6.3.1's sRGB decode
moves every number the D6.1 Reinhard decision was priced against, so landing them apart would have
meant tuning the exposure twice and discarding the first answer.

The slice measured before it changed anything, and the instrument reproduced Astra's independent
A2.3 table to three decimals before any derived number was trusted. It then found **eight clipping
bodies, not the six the brief's table listed** — Saturn (1.500) and Jupiter (1.207) were never in
it, because A2.3 sampled nine of the sixteen shipped bodies. Recorded additively, not as a
contradiction.

Shipped: the opposition surge relocated into the phase function (reconstructing each published
geometric albedo EXACTLY at zero phase — unit-asserted, which is what makes it a relocation rather
than a re-grade; Mars deliberately excluded because its surge coefficient is negative); Reinhard
before a single output encode; the exposure gain **solved** from 3.6 to 1.9 so Moon (−2.8%) and
Mars (−0.5%) hold their appearance while nothing clips at all; a tier-aware ladder that finally
consumes the 2048 base tier on `lite` and stops the unconditional 4-6 MB ultra fetch below the top
tier; relief self-shadowing (declared SIMPLIFIED); and a real per-body `atmosphere` flag replacing
the cloud-map-presence proxy. Declared license: the true 9.04:1 Tethys:Moon ratio renders at
3.38:1 post-curve.

**✅ D6.4 DELIVERED 2026-07-23 — [TR-088](../test-reports/TR-088.md)** (REALISM-AUDIT:
[Earth home review](../analysis/2026-07-23-pf11-d6.4-earth-home-realism-review.md)). Earth is
revealed by `goHome` at the world origin, parked at ra 160 / dec 0 = **90.0000° phase** — the only
geometry in this scene that can show a terminator, since every `travelTo` arrival is pinned to
0.000° by construction. The night lights ship after two phases of principled refusal, on the exact
precondition their own reckoning entry named. The R16 orbit takes the **Sun direction as its axis**,
which makes the 90° phase a conserved quantity rather than a starting condition. Three real defects
were found and fixed on the way (boot-time reveal with the camera inside the planet; an 8×-slow
orbit from the clamped `dt`; a CLAUDE.md #23 tabindex violation now closed with a MutationObserver).
**One item carried forward, flagged by the realism audit:** Earth's `PLANET_LUNAR_L` and albedo were
both fitted at α = 0 and are now rendered at α = 90°, which the Earth brief predicts is a 37-67%
error — Astra's numbers wanted before D1.3 builds the ascent on this same geometry.

**⚠ TWO OWNER-REPORTED BUGS FOUND AND FIXED 2026-07-24 — [TR-097](../test-reports/TR-097.md).**
TR-088's own verification carried no drag or occlusion assertion, and both bugs were latent from
delivery: (1) the home-orbit's per-frame auto-aim re-derived the camera's look direction on every
non-dragging frame — including the frame immediately after a drag ENDED — so releasing a drag
snapped the view straight back to Earth (R16's orbital _position_ was always correct; only the
forced re-_aim_ was the bug). Fixed with `_homeLookOverridden`, latched on the first real drag
per orbit. (2) The hover/click picker (`_pick`/`_pickField`) is a screen-space nearest-point
search with no real depth test — harmless before D6.4 put a solid, freely-lookable-around sphere
on screen. Fixed with a ray/sphere occlusion test (`raySphereDist`, ship-dynamics.ts, unit-tested)
run once per pick. Both confirmed via new E2E coverage
(`tests/e2e/d64-owner-bugfixes.spec.ts`) — see the TR for a genuine test-harness finding
(Playwright's `page.mouse` API hangs against this specific idle scene state; fixed by dispatching
real `PointerEvent`s directly rather than working around it).

**Still open in D6:** D6.2 (belt frame), D6.6, D6.7.

## Phase D7 — Memory & runtime optimisation (owner R13; audited opportunities, ranked)

Measured before/after via `perf-telemetry` + browser memory tooling; each slice records real
numbers, not assertions. No behavioural change is acceptable collateral — full gate per slice.

| Slice | Opportunity (audited 2026-07-22)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Expected win                                                                              |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------- |
| D7.1  | Babylon retains every CPU-side vertex array (`Buffer._data`, `Geometry._indices`); `geometry.clearCachedData()` never called. Safe here: custom meshes unpickable, picking uses the separate `_field` copy                                                                                                                                                                                                                                                                                                         | **~430 MB heap** across SDSS (361 MB) + merged stars (54 MB) + belt (15 MB)               |
| D7.2  | Planet textures: ultra (8192²) fetched unconditionally regardless of tier; nothing disposed on departure (Earth ≈ 683 MB VRAM with mips)                                                                                                                                                                                                                                                                                                                                                                           | tier-aware fetch + departure disposal; hundreds of MB VRAM on low tiers                   |
| D7.3  | SDSS decode: 5 sequential main-thread O(n) passes, ~500 MB transient peak; RGBA→RGB strip pass exists only for 15-byte indexing                                                                                                                                                                                                                                                                                                                                                                                    | stride-aware RGBA reader (−1 pass, −52 MB) + move decode to a Worker (transferable)       |
| D7.4  | Render-loop allocation sweep: per-asteroid fresh arrays (`beltPullAccel`/`passageDeflectForce`), fresh tuples from `quatRotate`/`travelFrame`/`_projectBody`, `_pushAberration` array-per-frame (under a comment claiming zero allocation), **per-frame `cosmos:warp` CustomEvent driving React setState at frame rate during warp**, O(4829) `bodies.find` per frame in `_tickPlanetSphere`, unconditional plume/ember re-uploads, VT streamer `toDataURL` re-encoding a 64 MB canvas every ~2.8 s parked at Mars | steadier frame time; honours the no-per-frame-allocation rule the loop currently violates |
| D7.5  | Havok stepping while belt is invisible/faded (with D2.1); bonus-layer merge re-decodes the base catalog and rebuilds all 541k billboards                                                                                                                                                                                                                                                                                                                                                                           | CPU per frame at DSO destinations; one-off boot cost                                      |
| D7.6  | Retained one-shot buffers (`_bandBuf` 2 MB, `_baseCatalogRgb` 2.4 MB)                                                                                                                                                                                                                                                                                                                                                                                                                                              | small, free                                                                               |

**Exit per slice:** measured deltas in the TR; heap/VRAM snapshots; no console errors on both
backends (TR-045/059 discipline); E2E green.

## Phase D8 — Gaia DR3 Tiny background field (owner R12 — the 15× conversation, now scoped)

**Inventory (audited):** `resources/gaia_datasets/catalog-gaia-dr3-tiny` — 2,552,302 stars,
206.5 MB, Gaia Sky **OctreeLoader** binary (a sixth local serialization; reader needed). At the
shipped 15-byte layout: ~36.5 MiB raw → ~31–42 MiB PNG-pack asset (13–15× today's 2.76 MiB
star download) and **~15.1× the vertex stage** (10.2M verts vs 676k — billboard quads, no
`gl_PointSize` on WebGPU). Gaia Sky's own ecosystem ships graduated cuts (646k "best" → 15.13M
default) — precedent for tiered cuts rather than all-or-nothing.

**✅ SCOPE DECIDED (owner, 2026-07-22, ADR-0010): ALL 2,552,302 stars ship** — not a
decimated cut. Delivery mechanism is the D9 Render Console: the full field is a toggleable,
chunked, fetch-on-enable layer; D0.3's real-device data sets the per-device _default_
(on/off/partial-chunk-count), never a hard cap.

- **D8.1 ADR first** (this is the "own budget/ADR conversation" PF-10 promised): chunking
  design — magnitude-sorted chunked asset so the layer streams in brightness order and any
  device can stop at its default prefix while the panel offers the rest (the existing
  `_applyDensity` index-trim lever is the runtime knob); asset-budget raise is a deliberate
  ADR-0009 ceiling decision under the new boot-critical-download framing (the layer is never
  boot-critical).
- **D8.2 Pipeline:** OctreeLoader reader (`scripts/lib/`), dedupe against the shipped
  Hipparcos-based field (the tiny pack _includes_ all Hipparcos stars — overlap must be
  deduped by source id, not position), magnitude-sorted PNG-pack emit; unit-tested round-trip
  against the production decoder (C0 discipline).
- **D8.3 Implementation** as a D9 layer; E2E asserts full-count enable, chunked partial
  enable, and per-device defaults; budget gates raised deliberately; real-device
  re-measurement closes the phase.
  **Depends on D9 (layer mechanism) + D0.3 (defaults only).** Ships last.

## Phase D9 — Render Console: user-configurable layer rendering (ADR-0010)

**Owner requirement (R15, 2026-07-22):** a dossier-format settings control panel where the
visitor multi-selects which DSO/celestial layers render, matched to their machine's
capability — a machine that can handle complex graphics but not all layers at once lets the
visitor switch between what they want to see. **Architectural consequence: automatic device
tiers become the _default preset_, not the ceiling.**

→ Full technical design:
[implementation plan D9](../implementation/PF-11-implementation-plan.md#d9--render-console).

- **D9.1 Layer registry + engine surface:** a typed registry of toggleable layers (star
  field, bonus layers, SDSS DR18, belt visual, belt Havok physics, NGC2000 volumes, GD-1
  trail, constellation figures, Milky Way band, planet hi-res/VT textures, DR3 Tiny) with
  per-layer cost metadata (bytes, vertices), a `setLayers()`/attribute engine API following
  the existing `observedAttributes` pattern, enable = lazy fetch-on-first-enable (ADR-0007
  post-boot discipline), disable = hide + dispose/sleep semantics (with D7's lifecycle work).
- **D9.2 The panel UI:** dossier-format dialog (`RENDER CONSOLE`, matching the DATA &
  LICENSES precedent), multi-select with honest per-layer cost labels and live measured fps
  (perf-telemetry made user-facing — "measure, don't assert" as UX), presets row
  (LITE / BALANCED / FULL / EVERYTHING) seeded from the device policy, persistence in
  `localStorage` (`ij-layers`) with the standard resolution order (URL `?layers=` → stored →
  device default), shared focus utility (D4.3), full a11y.
- **D9.3 Budget reframing:** `budgets.config.mjs` gains a **boot-critical download budget**
  (what a default visitor fetches before LAUNCH arms); ADR-0009's repo-weight gates remain;
  per-layer byte labels in the panel must match the budget data (single source).
- **D9.4 Defaults calibration** from D0.3's real-device pass (per-device preset selection),
  recorded in a TR.
  **Exit:** every layer toggles live without reload; disable actually releases (heap/VRAM
  measured); persistence + URL override verified; E2E per layer class; reduced-motion +
  no-WebGL contracts defined; manual regression on a real phone.

## Sequencing

```
D0.1 → (unblocks trustworthy full-suite runs for every later slice)
D0.2 → (unblocks D1.3/D2/D6.4 visual verification)
D0.3 → owner-scheduled; now calibrates D9 presets + D6.3 tier gating + D8 defaults
       (no longer gates the asset-weight decision — ADR-0010)
D1 → D2 → D3 → D4 → D5   (the visitor-facing arc, in owner priority order; D2 and D3 share
                           warp-cinematic surface area — land D2 first, it defines the fades
                           D3 choreographs around)
D6, D7 run as parallel engineering tracks between UX slices (D6.4 must precede D1.3;
D7.5 lands with D2.1; the D7.4 cosmos:warp→React-setState throttle lands BEFORE D1/D4's
new overlay surfaces add React work to the warp path — experience-review cross-note;
D7.1/D7.2's dispose/lifecycle work is D9.1's foundation — land before D9)
D9 after D7's lifecycle groundwork → D8 last (D8 ships as a D9 layer).
```

## Out of scope for PF-11

- GPS live-TLE constellation (unchanged ADR-0005 conflict).
- Summing multiple SDSS releases (DR18 only, unchanged).
- Planck CMB all-sky plates (stays a recorded deferral; revisit post-D8).
- Multiplayer/backend features of any kind.

## Open owner decisions collected in one place

**Updated 2026-07-22 (later same day):** items 1, 2, 4, 5, 6 and 7 of the original list are
DECIDED — see the Decisions log above and
[ADR-0010](../adr/0010-owner-decisions-render-console.md). The original list is left below,
struck through where resolved, per the corrections-are-additive convention.

1. ~~D3.3 mid-warp input policy~~ — **decided: goHome abort + travelTo retarget queue.**
2. ~~D6.1 exposure model~~ — **decided: Reinhard curve.**
3. ~~D6.2 belt frame: keep declared 23.44° offset or re-express the belt model — STILL
   OPEN.~~ — **decided (2026-07-22, later same day): GO on re-expression.**
4. ~~D6.5 asset weight~~ — **decided: resolved via D9 opt-in layers; unblocked from D0.3.**
5. ~~D5.1 final control names~~ — **decided: `RANDOM JUMP ▸` / `◂ RETURN HOME`, plus R16
   (Earth orbit at home).**
6. ~~D4.4 card content authorship~~ — **decided: owner-approved generated drafts grounded in
   official sources.**
7. ~~D8.1 DR3 Tiny per-tier star counts~~ — **decided: all 2.55M ship as a D9 layer; D0.3
   sets defaults only.**

Remaining open: ~~**D6.2** (belt frame), plus~~ **none — D6.2 decided later the same day
(GO).** What remains are the two small calibration decisions that arrive with data rather
than taste — D9.4 per-device default presets (after D0.3) and the D1 boot-critical download
budget value (set with the first D1.1 measurement).
