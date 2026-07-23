# PF-11 Implementation Plan — technical companion to the delivery plan

**Date:** 2026-07-22 · **Status:** ACTIVE (owner decisions recorded — [ADR-0010](../adr/0010-owner-decisions-render-console.md))
**Delivery plan (scope, requirements, exit criteria):**
[PF-11-cinematic-journey-and-scale-honesty.md](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md)
**Audience:** coding agents executing PF-11 slices. Every phase section links back to its
delivery-plan phase; the delivery plan links here from its header. **The delivery plan owns
WHAT and WHY; this document owns HOW.** If they disagree, the delivery plan wins and the
disagreement is a docs defect to fix in the same turn.

**Standing rules that bind every slice here** (do not re-derive per slice):

- CLAUDE.md non-negotiables, especially: subpath Babylon imports only (#1) + side-effect
  modules for new Babylon features (#2); **both shader twins, line-parallel, no reserved WGSL
  identifiers** (#4/#5); zero-console-output assertions on WebGPU (#6); every sampler bound
  before first draw — placeholder-then-swap (#9); CSP hash-based, no runtime styles (#12);
  no test weakening without named justification (#14/#15); Playwright workers=1 (#16);
  behaviour-not-readiness assertions (#18); per-slice full gate + manual regression (#25).
- Event-bus compatibility: the `cosmos:*` surface is shared by BOTH engines and asserted by
  E2E. New events are additive; existing payload shapes never change silently.
- Per-frame allocation rule: no new allocations in the render loop; slices touching
  `_tick*` methods must leave the loop cleaner than they found it (D7.4 is the sweep).
- Astra pairing: D1.3, D2._, D3._, D6.1, D6.4 end with a REALISM-AUDIT in `docs/analysis/`.
- File references below are accurate as of 2026-07-22 (commit `d8aba0f` + TR-080 test edits);
  line numbers drift — re-grep before editing, treat them as pointers not coordinates.

---

## D0 — Trustworthy instruments

← Delivery plan: [Phase D0](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d0--trustworthy-instruments-first-because-everything-else-is-measured-through-them)

### D0.1 Frame-production liveness (band build decoupling + ready-ceiling recalibration)

**Problem mechanics:** `_tickMilkyWay` (babylon-engine.ts:3029-3069) builds the 1024×512
band texture at `MILKY_WAY_ROWS_PER_CHUNK` (20) rows per rendered frame — ~26 frames total —
so wall-time scales with 1/fps; under a loaded SwiftShader run this is the "bandReady never
true" C7 signature. The craft specs' fixed 20s `data-craft-state="ready"` waits measured
19.1s/14.2s on a QUIET machine (TR-080 addendum) — near-zero margin.

**Steps:**

1. Extract the row-build loop into a **time-budgeted builder**: keep the per-frame entry
   point (TR-059's frames-keep-producing contract), but inside one tick build rows until
   `performance.now() - t0 >= BAND_BUILD_MS_PER_TICK` (start 6 ms), AND schedule additional
   `setTimeout(0)` build slices between frames so total build wall-time is bounded by CPU,
   not frame delivery. `_bandRow`/`_bandBuf` state machine unchanged; the single
   `RawTexture.CreateRGBATexture` upload at completion unchanged (babylon-engine.ts:3044-3049);
   `_bandPlaceholderTex` discipline unchanged (TR-059/#9).
2. Clear the `setTimeout` chain in `disconnectedCallback`/dispose.
3. Audit the two other frame-coupled builders for the same pattern: the SDSS geometry build
   (`_loadSdssGalaxyLayer`, babylon-engine.ts:2344-2365) and the bonus-layer merge
   (`_loadBonusStarLayers`, :2289-2330) — if either chunks per-frame, give it the same
   time-budget treatment; if they block a single frame, leave for D7.3 (worker) and record.
4. Recalibrate the craft specs' 20s ready ceilings (named test change, TR-080's class): a
   shared `CRAFT_READY_TIMEOUT_MS = 45_000` constant in the spec file with the justification
   comment.
5. Liveness proof: run the full suite 3× while a CPU-load generator runs (document the load
   recipe in the TR); all green ×3.

**Tests:** unit — builder completes all 512 rows across simulated slow ticks; TR-059
webgpu-hardware spec stays green untouched. **Files:** `src/lib/babylon-engine.ts`,
`src/lib/milky-way.ts` (`buildMilkyWayRow` unchanged), `tests/e2e/craft-ship.spec.ts`.

#### D0.1 correction — step 1's `setTimeout(0)` chain cannot carry the build (measured 2026-07-22, [TR-081](../test-reports/TR-081.md))

Step 1 above is **half right, and the missing half is the half that mattered.** Implementing
it exactly as written made the band build _slower_, not faster: a 6 ms slice builds ~7 rows
where the old fixed chunk built 20, and the between-frames `setTimeout(0)` chain did not make
up the difference. Probing the built preview under Playwright's chromium/SwiftShader (the
environment the failure class lives in) measured **10 `setTimeout(0)` callbacks in 5 seconds
against 12 rAF callbacks** — the page main thread is saturated by the render loop, so a
self-rescheduling timer chain gets roughly one slot per frame. Timers cannot decouple anything
here. End-to-end: `bandReady` went from ~16 s (baseline, under load) to **~65 s** with
step 1 alone.

**What actually closes the exit criterion** ("build wall-time must not scale with 1/fps") is
pacing the builder against a **wall-clock deadline** (`MILKY_WAY_BUILD_DEADLINE_MS = 8000`):
each slice measures the gap since the previous slice and builds at least the rows still owed
to land the whole grid by the deadline, so a slow driver gets _bigger slices_ instead of a
longer build — bounded above by `MILKY_WAY_BUILD_MAX_SLICE_MS = 50` so TR-059's
frames-keep-producing contract still outranks the deadline. The `setTimeout(0)` chain is
kept (it is the only driver when rAF is suspended — e.g. a backgrounded tab — and it adds
~40-50% more slices under load), but it is not load-bearing. The deadline **yields to an
in-flight warp** (`buildSlice(paced = warp.mode === "idle")`) — pacing spends more frame time
the slower the machine is, which must never bid against the flight sequence.

**Read-across for later slices:** any "move work off the render loop" idea in D7 (D7.3's SDSS
decode, D7.4's sweep) should assume **timers buy nothing on this page** and go straight to a
Worker or to deadline-paced slicing. Measure the scheduling slack before designing around it.

### D0.2 Planet-sphere pixel proof

**Problem:** five sessions of state-correct-but-no-pixels (handoff B4) — every harness keeps
the camera's initial bearing so the sphere is out of frame.

**Steps:**

1. Add a harness hook on the element: `aimAt(bodyId: string)` — sets `_yaw`/`_pitch` (the
   free-look state the drag path already writes, babylon-engine.ts `_yaw`/`_dragging`) so
   the camera looks at the body's world position. Guard: no-op unless
   `new URLSearchParams(location.search).has("testhooks")` — the hook must not become a
   product feature; document in the spec that uses it.
2. E2E: travel to Mars → `aimAt("mars")` → `page.screenshot()` → assert a non-trivial
   pixel-variance region (mean luminance of the centre crop above scene-background level;
   CLAUDE.md #11 — screenshot, never canvas readback).
3. Capture and commit reference screenshots (Mars, Moon, Earth-via-goHome once D6.4 lands)
   under `docs/test-reports/assets/` referenced from the TR.

**Files:** `src/lib/babylon-engine.ts` (hook), new `tests/e2e/planet-pixels.spec.ts`.

### D0.3 Real-device pass (owner-involved)

Procedure per delivery plan; instrument validity checks per CLAUDE.md Measurement
discipline. Output feeds: D9.4 default presets, D6.3 tier gating, D8 defaults, PF-09 B6
closure. Record in its own TR with the raw device-signature lines.

---

## D1 — Pre-flight, launch

← Delivery plan: [Phase D1](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d1--intro-cinematic-real-loading-dossier--launch-from-earth-owner-r2)
· Binding UX inputs: [experience review §D1](../experience-design/2026-07-22-pf11-experience-review.md) + acceptance criteria D1-AC1..7 ([research plan §4](../experience-design/2026-07-22-pf11-ux-research-plan.md))

### D1.1 Real progress instrumentation

**New module `src/lib/load-progress.ts`** (pure, unit-testable):

```ts
export type LoadStage =
  | "engine-init"
  | "star-catalog"
  | "atlas-map"
  | "first-frame"
  | "craft-glb"
  | "havok-wasm"
  | "bonus-layers"
  | "sdss-field"
  | "asteroid-belt"
  | "atlas-photo";
export interface StageProgress {
  stage: LoadStage;
  loadedBytes: number;
  totalBytes: number | null; // null until Content-Length known
  records?: number;
  done: boolean;
  bootCritical: boolean;
}
export function fetchWithProgress(
  url: string,
  stage: LoadStage,
  onProgress: (p: StageProgress) => void,
): Promise<Blob>; // ReadableStream reader; falls back to plain fetch when body is null
```

**Wiring points** (each currently a plain `fetch()`/`blob()`):

| Stage         | Current call site                                                          | Bytes          |
| ------------- | -------------------------------------------------------------------------- | -------------- |
| star-catalog  | `CATALOG_CHUNKS` fetches, star-catalog.ts:74-77 consumption in `_boot`     | 2.02 + 0.87 MB |
| atlas-map     | `_boot` atlas-map.json fetch                                               | small          |
| craft-glb     | `ImportMeshAsync` — use its **unused `onProgress`** (loading-stages audit) | tiered         |
| havok-wasm    | Havok boot (lazy)                                                          | 2.09 MB        |
| bonus-layers  | `_loadBonusStarLayers` babylon-engine.ts:2289                              | ~5.8 MB        |
| sdss-field    | `_loadSdssGalaxyLayer` :2344                                               | 47.1 MB        |
| asteroid-belt | `_loadAsteroidVisualLayer` :2390                                           | 2.08 MB        |

**Event design (additive — do not mutate `cosmos:progress`):** existing
`cosmos:progress {loaded,total}` keeps firing exactly as today (E2E/HUD depend on it). New
event **`cosmos:stage`** with the `StageProgress` payload, one per throttled progress step
(≤ 4 Hz per stage) and one with `done:true`. Non-fetch completions also emit `cosmos:stage`:
engine-init (post `initAsync`/fallback), first-frame (where `cosmos:ready` fires,
babylon-engine.ts:2042), band build done, mesh builds done.

**Boot-critical set** (arms LAUNCH; keep minimal per the experience review): engine-init +
star-catalog + atlas-map + first-frame. Craft/Havok arm-independent ("STREAMING IN
BACKGROUND") unless already done. **`budgets.config.mjs` gains `bootCriticalDownloadKB`**
(D9.3 shares it) asserted by a unit test that sums the boot-critical assets' on-disk sizes.

**Tests:** unit — fetchWithProgress monotonicity, totals = fixture sizes, fallback path;
E2E — D1-AC1 (CDP `Network.emulateNetworkConditions` Fast-3G, first visible progress < 2 s);
totals match `ls` sizes for the three big assets (D1-AC4's automated half).

#### D1.1 notes as built (2026-07-22, [TR-084](../test-reports/TR-084.md)) — three scope points recorded rather than silently resolved

Recorded additively, per this repo's corrections convention; none of them changed the
slice's exit criteria, but a later reader would otherwise find the plan and the code
disagreeing.

1. **The `LoadStage` union is the contract; "band build rows, mesh builds done" are not in
   it.** The event-design paragraph above names those two as `cosmos:stage` emitters, but the
   section's own TypeScript block defines exactly ten stages and neither is among them. Built
   to the type, because band progress **already has a real signal**: D0.1 exposed
   `sceneStats().bandProgress` as a monotone 0→1 fraction and
   [TR-081](../test-reports/TR-081.md) handed it to D1.1 explicitly ("D1.1 should read it
   rather than re-deriving band progress"). D1.2 reads the band from there and the fetch
   stages from `cosmos:stage`. Adding a band `LoadStage` would have created a second source
   of truth for the same number.
2. **`atlas-photo` (atlas.jpg, 3.5 MB) is wired in the type but NOT in the engine** — the one
   asset named in the delivery plan's prose that this slice deliberately left unreported. It
   is absent from the wiring table above, and the reason it stayed absent is mechanical:
   Babylon's `Texture` performs its own internal fetch and exposes only completion, never
   bytes. Reporting it means re-routing that load through `fetchWithProgress` + a blob: URL —
   CSP-clean here (`img-src`/`connect-src` already carry blob: for exactly this path) but a
   real change to how the GAP-02 photographic body layer loads, which deserves its own
   verification rather than riding along inside the instrumentation slice. Comment left at
   the call site; the `atlas-photo` stage stays in the union ready for it.
3. **D1-AC1 belongs to D1.2, not here.** Its wording — "some **visible** progress value
   changes within 2 s of first paint" — is an assertion about a rendered surface, and D1.1
   ships no UI. The E2E delivered here asserts the layer beneath it (monotone byte progress,
   totals equal to real on-disk sizes, every stage closing exactly once); D1-AC1's throttled
   CDP test lands with the dossier that can satisfy it.

### D1.2 PRE-FLIGHT dossier UI

- **New `src/components/islands/space/PreFlight.tsx`**, rendered by `SpaceScene.tsx` while
  in travel mode and not yet launched. The SSR shell (identity block + static stage-list
  skeleton) lives in `Hero.astro` markup so it paints before hydration (no inline styles —
  CSP #12; classes in `global.css`).
- State machine S0–S4 + S1e exactly per the experience review (stall detector: a
  boot-critical stage with no progress event for 10 s → `STALLED` + `PROCEED ANYWAY ▸`).
- Gate wiring: replaces the `body.ij-loading` clear logic in SpaceScene.tsx:177-189 —
  **preserve** the mobile-scroll instant-clear branch and the 9 s CSS failsafe
  (global.css:357-368) verbatim; the 8 s hard timer becomes the S1e stall path (documented
  in the TR as a conscious replacement).
- Skip affordances: `SKIP INTRO` (S1/S2) routes to S4 as soon as boot-critical allows;
  sessionStorage `ij-launched="1"` set on first completed launch → subsequent loads jump to
  S4. Reduced-motion + no-WebGL per delivery plan.
- Focus: shared focus utility (built in D4.3 — if D1 lands first, create
  `src/lib/focus-utils.ts` here and D4 consumes it).

**Tests:** D1-AC2 keyboard chain E2E; D1-AC5 failsafe manual walk; D1-AC7 no-WebGL E2E
(existing forced-fallback pattern in space-scene.spec.ts:129).

#### D1.2 notes as built (2026-07-23, [TR-085](../test-reports/TR-085.md)) — scope calls and two real defects, recorded rather than silently resolved

1. **No Astro/SSR shell was built.** Every other scene-chrome surface in this codebase (HUD,
   WarpOverlay, ArrivalVista) is React-only, hydrating via `client:load` near-instantly;
   duplicating identity markup between Astro and React would itself create a second source of
   truth. PreFlight renders identity on mount instead — no measured gap has shown this matters
   yet, which is the trigger to revisit if one does.
2. **SKIP INTRO is available from mount, not gated on arming.** The experience review's own
   state diagram draws it as an S2-only transition, but both the review's prose ("as soon as
   boot-critical stages allow") and this delivery plan's own D1.2 text ("a `SKIP INTRO` link
   during loading") say otherwise, and the review's risk section names pre-arm availability as
   the explicit mitigation for the 10-20s hotel-Wi-Fi gate risk. Implemented per the prose,
   against the diagram.
3. **The 9s CSS failsafe's VALUE is unchanged**, exactly as instructed above — but its
   _condition_ was not preservable verbatim once measured: the full E2E suite caught it firing
   during entirely normal operation (craft alone is calibrated up to 45s elsewhere in this
   suite), force-revealing content out from under a still-working PreFlight. Fixed by scoping
   to `body.ij-loading:not(.ij-preflight-mounted)` — a body class PreFlight sets on mount — so
   the rule now means exactly what its own comment always claimed ("even if SpaceScene never
   clears ij-loading"), not "even if a visitor hasn't clicked LAUNCH yet."
4. **A real bug in `focus-utils.ts`, caught before any browser ran it:** `moveFocusTo` added
   `tabindex="-1"` unconditionally rather than only when an element needed it to become
   focusable, which would have stamped the attribute onto every naturally-focusable target
   including the LAUNCH button. `focus-utils.test.ts`'s first assertion caught it.
5. **Five named E2E test changes**, all one root cause: `#ij-preflight` structurally shares
   its screen region with `#ij-mission-bar` (RNG button) and the viewport-center coordinate two
   existing free-look-drag tests use — by design, both are "things shown in the lower hero
   area," just at different phases. Fixed by adding a SKIP INTRO dismissal (what a real visitor
   would do) to each affected test, not by changing any assertion.

### D1.3 Launch cinematic

- New engine mode `"ascent"` alongside the warp machine (babylon-engine.ts `warp.mode` —
  extend the union; `_tickWarp` early-returns during ascent; a dedicated `_tickAscent`
  drives it). Sequence (~8 s, every moment skippable → jump-to-end):
  1. Start parked at the Earth sphere (D6.4 reveal geometry, camera near-surface altitude);
  2. climb: altitude h(t) eased 0 → 120 km; **sky colour = existing clear-colour lerped by
     `exp(−h/8.5)` (km)** toward space-black; star-field/band `uFade` ramps in as sky
     luminance falls (reuse the band's boot-fade uniform path, babylon-engine.ts:3029-3069);
  3. limb ring: thin billboard arc visible 80–120 km (the one honest blue-limb geometry —
     Astra brief §4);
  4. handoff: camera eases onto the standard home vista bearing; `cosmos:ascent-done` fires;
     SpaceScene reveals the console into its 54vh dock (CSS transition classes, not JS
     styles).
- Both shader twins for any new uniform; reduced motion: instant cut (no ascent), console
  visible. RCS/audio out of scope.
- **Pre-build gate:** run the two §2 validations (hallway ×5, dossier-vs-spinner) before
  polishing beyond a functional cut; results in the slice TR.

**Astra REALISM-AUDIT after:** sky-colour curve, star-reveal altitude, limb geometry.

#### D1.3 notes as built (2026-07-23, [TR-089](../test-reports/TR-089.md))

Implemented close to the plan, with the geometry re-grounded on D6.4 (which shipped first) and a
few decisions recorded:

1. **The ascent is a RADIAL climb, not a lateral flight** — the plan says "Earth-surface → space
   ascent" without specifying the path. In a geocentric frame "straight up from the surface" IS
   "radially outward from the origin", so the camera recedes along the ra 160 / dec 0 home-vantage
   sight-line from standoff 29 to 38, look-at origin, level horizon, no flip/roll. This is the
   motion-spec's call and it is the honest one (a vertical ascent really holds that line). The end
   standoff is **unit-asserted equal** to `ARRIVE_STANDOFF`/`HOME_ORBIT_RADIUS` so the handoff is a
   pose match, not a cut.
2. **The star field has no fade uniform, so it is NOT driven directly** — only the band's `uFade`
   is (the plan's "reuse the band's boot-fade uniform path"). The star field is additively blended,
   so darkening `scene.clearColor` reveals it naturally, which is both cheaper (no `ijStar` twin
   change) and physically what happens (stars wash out against a bright sky, pop against black).
   Recorded because the plan's "star-field/band uFade ramps in" reads as if the star material has a
   fade hook; it does not.
3. **The limb ring is a fresnel-rim SHELL, not a billboard arc** — the plan says "thin billboard
   arc". A fresnel rim on a sphere just outside Earth gives a real limb glow around the whole
   silhouette, gated to the sunlit hemisphere (`N·sun`) and the 80-120 km window, gone by handoff.
   Declared SIMPLIFIED in the realism audit (ledger L10): it reproduces the arc's appearance
   without the scattering integral.
4. **Progress integrates wall-clock `_dtWarpS`, not the clamped `dt`** — the D6.4 orbit lesson,
   applied pre-emptively this time. A screen-time quantity clamped to `SHIP_MAX_DT` stretches on a
   slow device (measured ~12-14 s on SwiftShader vs ~8 s real) rather than speeding up — better
   long than a strobe-fast cut. This is now true in three places (warp, home orbit, ascent).
5. **Only the real LAUNCH plays the ascent.** SKIP INTRO / PROCEED ANYWAY / returning-visitor pass
   `ascent: false` and reveal instantly — a skip's whole value is speed. Threaded through a new
   `onLaunch(ascent: boolean)` signature (5 button-handler updates in PreFlight).
6. **`cosmos:ascent-done` was already wired** — D1.4 added a defensive listener recording the
   `cinematic-done` funnel milestone. D1.3's emit now makes it fire for real; no change needed
   there, exactly as D1.4's note anticipated.

**Carried forward, ESCALATED:** Earth's α=90° photometry (D6.4's open item) — the realism audit
escalates it because D1.3 is now the second feature on that geometry. It blocks nothing shipped but
should block the next Earth-visual change; wants Astra's numbers.

### D1.4 Funnel (`?funnel=1`)

New `src/lib/funnel.ts` (ring buffer of `{event, t}` for the milestones listed in the
research plan §3; localStorage `ij-funnel`, cap ~64 KB) + `FunnelOverlay.tsx` behind the
URL param (resolution order: URL → stored → off) + COPY DIAGNOSTICS (funnel + the
`window.__ijPerf()` device block). No network, no PII, no third-party — ever.

#### D1.4 notes as built (2026-07-23, [TR-086](../test-reports/TR-086.md)) — one naming

deviation and two real bugs, recorded rather than silently resolved

1. **The recorder stores repeatable action names, not the plan's literal `first-X` labels.**
   The plan names nine milestones as `first-travel`, `first-search-keystroke`, etc.
   `vista-dismissed` structurally needs every occurrence (not just the first) to drive the
   accidental-warp detector against a **later** dismissal, and deduping `travel`/
   `search-keystroke` to one entry each would make that detector and the zero-result-query
   flag unable to see anything past the first session action. Shipped: `funnel.ts` records
   `travel`/`arrival`/`vista-dismissed`/`search-keystroke`/`search-travel` on every occurrence
   (capped at `MAX_EVENTS_PER_SESSION`), while the four genuinely one-shot gate milestones
   (`dossier-visible`/`launch-armed`/`launch-pressed`/`cinematic-done`) dedupe to their first.
   `firstEventTime()` recovers the plan's exact `first-X` semantic on demand.
2. **A React error #310 hooks-order crash, caught before any E2E test could run.** The first
   version recorded `search-keystroke` from a `useEffect` reacting to `state.cmd`/`suggestions`,
   placed in the render body near where `suggestions` is computed — which sits AFTER
   `SpaceScene.tsx`'s pre-existing `if (!engineReady) return null` early exit. That makes the
   hook run conditionally, a Rules-of-Hooks violation invisible until `engineReady` flips true
   mid-session. Every E2E spec failed identically (`waitForSelector("babylon-scene")` timing
   out, no other signal) until a throwaway `page.on("pageerror")` probe surfaced the real error.
   **Fixed** by extracting a top-level `computeSuggestions(cmd)` function and recording
   synchronously inside the existing `onCmdChange` callback — no new hook, and the query/result
   count pairing is now more accurate than an effect racing a stale closure would have been.
3. **`cosmos:warp` cannot detect its own start.** The plan's implicit assumption (record
   `travel` on the first `cosmos:warp` event where `state.warp` is still null) never fires:
   `cosmos:select`'s own handler is what sets `state.warp` to the `"aim"`-phase object, and by
   React's next render that value is already non-null before the first `cosmos:warp` tick ever
   arrives (TR-081: `cosmos:warp` fires once per rendered frame for the whole journey, not once
   at its start). **Fixed** by recording `travel` in `cosmos:select`'s non-quiet branch instead
   — the actual one-shot "a journey started" signal.

Also found, and **deliberately not fixed here**: a pre-existing z-index overlap between
`#ij-mission-bar` (z-62) and `ArrivalVista`'s button row (z-61) that lets a real click on OPEN
COLLECTOR CARD land on the WHERE-TO input instead. No prior spec had ever clicked that button.
Handed to **D4.1**, whose vista-dismissal rework replaces the whole interaction.

---

## D2 — Frame ladder

← Delivery plan: [Phase D2](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d2--the-frame-ladder-sky-honesty-by-destination-owner-r3r4r5)
· Science: [Astra brief §1–2](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md)

**Shared mechanism first (used by all three slices AND D9): per-layer fade.** The belt/SDSS
meshes share `_starMat` today (babylon-engine.ts:2363 `mesh.material = this._starMat`), so a
per-mesh fade needs **material clones with their own `uLayerFade` uniform**:

1. In layer setup, `this._starMat.clone("ijStarBelt")` etc. — one clone per gated layer
   (belt, sdss, bonus-in-main-mesh needs a different route — see D2.2). Clones share
   compiled program; per-clone uniforms are cheap.
2. Add `uLayerFade` (default 1.0) to BOTH twins of the ijStar shader: multiply final alpha.
   GLSL at the fragment output (babylon-engine.ts:~799 region), WGSL twin at :~948 region —
   line-parallel, identifier-identical, not a reserved WGSL word.
3. Engine API: `_setLayerFade(layer: string, fade: number)` writing the clone uniform;
   driven per-frame during warp by `k` and the destination `ly` thresholds.
4. `fade === 0` ⇒ `mesh.setEnabled(false)` (skips draw entirely) and, for the belt, the
   Havok sleep flag (D2.1.3). Re-enable on fade > 0.

### D2.1 Solar-system furniture

- Threshold constants in `src/lib/ship-dynamics.ts` next to `bodyDepth`:
  `FURNITURE_FADE_START_LY = 0.001`, `FURNITURE_GONE_LY = 0.1`.
- During `_tickWarp`, compute `furnitureFade` from destination `w.lyTotal` and progress `k`
  (outbound: fade 1→0 across the accel phase when target beyond threshold; inbound/home:
  0→1 across decel). Reduced motion: set final value at arrival, no ramp.
- Havok sleep: in `_tickAsteroids`, early-return (skip force application AND skip
  `physicsViewer`-class work) when `furnitureFade === 0`; bodies stay in the world (no
  destroy/rebuild churn) but `setMotionType(STATIC)` on sleep / restore on wake — measure
  both approaches, keep the cheaper (D7.5 records numbers).
- Sun glare/planet billboards: the curated-body billboard pass already exists; gate the
  solar-system-subset ids (`ly < 0.01` bodies) by the same fade.
- **E2E:** `sceneStats()` gains `furnitureFade` + `beltPhysicsAwake`; assert Mars=1/awake,
  M42=0/asleep; Kirkwood spec untouched at home.

### D2.2 Extragalactic collapse + impostor

- Trigger: destination `ly ≥ 1e6` (NBG galaxies, hudf, SDSS-scale curated bodies).
- Star field + bonus layers live in ONE merged mesh (`_loadBonusStarLayers` output) — one
  clone/fade covers them. Band: reuse its existing `uFade` (milky-way.ts:190-265) driven by
  the same controller (do NOT add a second uniform).
- Impostor: one billboard quad, texture from the Milky Way skybox pack **only after
  license verification** (docs/research; Risinger pano lacks a printed license — if
  unresolved, generate a procedural impostor by orthographically re-projecting the existing
  band texture into a disc — honest and license-clean). Angular size
  `θ = 2·atan(15 kpc / d)` from the destination's real distance; position: `-normalize(dest.pos)`
  direction at far depth; placeholder texture bound at creation (#9).
- HUD line at arrival: `LOCAL FIELD BELOW RESOLUTION · MILKY WAY ASTERN` (HUD.tsx pattern).
- **E2E:** travel to an NBG body → `bandFade→0`, impostor visible in stats; goHome →
  restored. Astra audit closes.

#### D2.1 + D2.2 notes as built (2026-07-23, [TR-090](../test-reports/TR-090.md)) — scope calls recorded, not silently resolved

Shipped together because they share the `uLayerFade` mechanism (the "shared mechanism first"
note above); one combined slice, one gate, one TR — the same way D6.1+D6.3 landed.

1. **Per-mesh fade is via MATERIAL CLONES, not `onBindObservable`.** The clone approach the plan
   specifies is the WebGPU-safe one: a shared material's UBO is uploaded once, so a per-mesh
   `uLayerFade` set inside `onBind` would give every mesh the last value on WebGPU. `_starMat.clone`
   gives each layer its own UBO. `_localMat` (main field) and `_beltMat` (belt) are the two clones;
   **SDSS stays on the base `_starMat` at fade 1** (Astra §1: it is isotropic and effectively
   infinite — never fades). The clones must receive the same per-frame uniforms as the base: `uTime`
   (fan-out at the existing setFloat), aberration (added to `_pushAberration`'s list), `uViewport`
   (resize handler), `uHaloAmp` (tier change). `sceneStats().asteroidVisualReady` moved to `_beltMat`.
2. **The impostor is a PROCEDURAL disc with its OWN shader twins**, not the band texture
   re-projected. The plan's fallback ("procedural impostor by re-projecting the band") is honoured
   in spirit — `milkyWayImpostorPixel` shares the band's tone model — but built as a standalone
   inclined-disc function (bulge + exponential disc + rim-alpha) so it needs no live band buffer.
   New `ijImpostor` GLSL/WGSL twins mirror the band's proven `textureSample` sampler pattern; a
   `StandardMaterial` was deliberately AVOIDED (bundle #1). Texture bound synchronously at creation
   (#9); mesh `isVisible=false` until an extragalactic arrival.
3. **The band's `uFade` reuse required un-freezing `_tickMilkyWay`.** It previously set `uFade` only
   while the boot ramp was `< 1`. Now it sets `uFade = _bandFadeAmt × _localFieldFade` every frame
   (except during ascent, which owns `uFade`), so the collapse animates and restores. Because
   `_localFieldFade` is 1 for all in-galaxy travel, this is a no-op change everywhere except
   extragalactic — and it makes `sceneStats().bandFade` report the EFFECTIVE opacity, which the E2E
   reads as the collapse signal (0 at nbg).
4. **Constellations fade only as part of the extragalactic collapse here** (`_conMat`'s `uColor`
   alpha × `_localFieldFade` in `_pushAberration`). The plan's D2.3 `ly 50→500` dissolve and the
   full 4-entry ledger are a SEPARATE slice — this slice does not add that threshold. The two
   ledger entries D2.2 _does_ introduce (procedural impostor L12, size-floor L13) are recorded in
   the sky-frames brief's dated addendum, per D2.3's instruction that the ledger lives there.
5. **Sun glare / planet billboards are NOT individually faded** (honest scope cut, realism-audited).
   They render from one shared-material billboard mesh with no per-body fade channel; the dominant
   artefact is the 154k-speck belt ring, which IS gated. Recorded, not dropped.
6. **Havok sleep = skip forces + gate the collision-shake callback** on `_beltPhysicsAwake`
   (avoids phantom camera shake from invisible rocks). Halting integration outright
   (`setMotionType(STATIC)` / zero timestep) is D7.5's measured refinement — recorded, not done, so
   D2.1 stays console-safe and import-light. `beltPhysicsAwake` is the assertable sleep signal.
7. **E2E timing:** the frame-ladder spec proves the collapse RELATIVELY (band `uFade` = ramp ×
   collapse, so it hits exactly 0 at nbg regardless of the slow boot ramp) rather than waiting the
   ramp out; fade-settle polls use a 15s budget (the same SwiftShader-load settle the D0.2/craft
   specs budget for). The impostor WGSL twin's real-hardware draw is added to `webgpu-hardware.spec`
   (an extragalactic hop → `impostorVisible` → console-clean), which fails-open without a real GPU.

### D2.3 Constellation dissolve + ledger

`_conMat` (babylon-engine.ts:1441-1442) gains the same fade uniform pair; thresholds
`ly 50 → 500`. License-ledger entries (4 from the brief + Reinhard ratio compression from
ADR-0010) appended to the Astra brief doc as a dated addendum + referenced from the
realism map.

**Note (D2.2 built the extragalactic half):** the constellation `uColor` alpha is already
multiplied by `_localFieldFade` (the extragalactic collapse) as of TR-090. D2.3 adds the
_separate_ `ly 50→500` per-figure dissolve and completes the 4-entry ledger.

---

## D3 — Flight model v4

← Delivery plan: [Phase D3](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d3--flight-model-v4-graceful-legible-deceleration-owner-r6r11)
· Science: [Astra brief §3](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md)
· Audited mechanics: triangle velocity profile (`warpEase` derivative `dsdk = 4k` / `4(1−k)`),
flip window k∈[0.47,0.53] (babylon-ship.ts:41-52), camera-and-hull share `warpEase(k)`
translation, decel chase back-distance closes 3.5→2.2 (waypoint table), `vC` HUD already
counts down correctly, dt integration `_dtWarpS` capped 0.5 s.

### D3.1 Deceleration legibility

1. **Chase waypoint table decel segment** (babylon-ship.ts `chaseOffsetAt`): rework the
   k>0.53 segment so back-distance OPENS (3.5 → ~5.0 → settle 3.5 at k=1 to preserve the
   `chaseOffsetAt(1) === [0,0,SHIP_VIEW_DEPTH]` invariant the arrival framing depends on —
   the invariant is asserted; keep it).
2. **FOV breathing:** port the legacy behaviour — `camera.fov = BASE_FOV * (1 + FOV_GAIN *
dsdk/2)` with `FOV_GAIN ≈ 0.06`, eased, clamped, reduced-motion = 0. (Legacy reference:
   space-engine.js warp FOV path.) This is THE missing speed cue.
3. Verify streaks (`trailWarpSpeed`), aberration β, and plume intensity all read from
   `dsdk`, not `k` (β already does — babylon-engine.ts:5009-5021; fix any that don't).
4. HUD phase labels: rename decel label to `BRAKING BURN` if not already; the label
   boundaries move with D3.2's window.

### D3.2 Flip choreography

**Measured input from D0.1 ([TR-081](../test-reports/TR-081.md)):** the flip window is ~195 ms
of wall clock on polaris today, and `cosmos:warp` fires once per rendered frame — so on any
frame slower than 195 ms the `flip` phase is never emitted at all (the GAP-17 spec's
intermittent `indexOf("flip") === -1`, and a visitor who never sees a flip). Step 2's screen-time
floor is therefore the load-bearing step, and the E2E consequence is worth asserting explicitly:
after this slice, GAP-17's phase-order test should be robust at any frame rate — if it still
depends on fps, the floor is not doing its job.

1. Constants (babylon-ship.ts:41-42): `WARP_ACCEL_END 0.47 → 0.44`,
   `WARP_DECEL_START 0.53 → 0.56`.
2. **Screen-time floor:** at `_beginWarp`, if `(0.12 × warpDur) < FLIP_MIN_MS (1500)`,
   stretch `warpDur` to `FLIP_MIN_MS / 0.12` (≈ 12.5 s floor never triggers — the real
   effect: short journeys lengthen slightly; home stays snappy via its own
   `WARP_MIN_MS`— compute and record the exact new duration table in the TR). Reduced
   motion unchanged (instant swap, 350 ms journeys).
3. `flipPhase` becomes C² (`smootherstep`: `t³(t(6t−15)+10)`) across the widened window.
4. Plume: `plumeParamsForWarp` (babylon-engine.ts:3928) → intensity 0 across the flip
   window with ~0.3 s eased cutoff/relight shoulders; after flip the plume's forward vector
   opposes travel automatically (it's hull-attached and the hull flipped — verify, don't
   re-derive).
5. RCS puffs: 4 small one-shot sprite bursts (reuse the ember/particle path) at flip
   start/end, hull-attached laterally. Skip under reduced motion.
6. Camera: no change — the chase look damping already keeps the frame steady while the
   hull rotates within it; assert in E2E that camera quaternion rate stays smooth across
   the flip window.

### D3.3 goHome abort + retarget queue (DECIDED — ADR-0010)

1. **Abort:** in `goHome()` (babylon-engine.ts:4738-4749) replace the
   `mode === "warp"/"aim"` early-return with: capture current integrated position
   `cam(k)`, call `_beginWarp(undefined, [0,0,0], true, quiet, 0)` **from that position**
   (`from` = current cam — `_beginWarp` already reads `this.cam`, which `_tickWarp` keeps
   integrated, so this mostly works by construction; verify the hull flip re-choreographs
   cleanly: entering the new warp resets `k=0` so the ship performs a fresh
   accel-flip-brake home — acceptable and cinematic). Emit `cosmos:abort {toHome:true}` +
   HUD `ABORTING · RETURNING HOME`.
2. **Retarget queue:** `travelTo(id)` during `aim`/`warp` sets `this._queuedTargetId = id`
   (last-wins), emits `cosmos:retarget-queued {id}`; HUD `RETARGET QUEUED · {name}`;
   Where-To console shows it (D5.2). At arrival (`k>=1` block, :4959-4963), if
   `_queuedTargetId` → clear it and `travelTo(queued)` on the next tick (not synchronously
   inside the state write). `goHome` clears the queue.
3. **Legacy engine:** archived — do NOT port; document the intentional divergence in the TR
   (the archive is a rollback lever, not a feature target; E2E for these behaviours pins
   `?engine=babylon`-default paths only, per #17's inverse).
4. **E2E:** named updates to the flight-sequence specs; new spec: mid-warp goHome lands at
   home with `arrivedId === null` + abort event seen; mid-warp travelTo queues then arrives
   at the queued body.

**Astra REALISM-AUDIT after D3:** full-journey choreography vs brief §3.2.

---

## D4 — Arrival & cards

← Delivery plan: [Phase D4](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d4--arrival--cards-owner-r7r8)
· Binding UX: [experience review §D4](../experience-design/2026-07-22-pf11-experience-review.md) + D4-AC1..6

### D4.1 Vista dismissal

- `ArrivalVista.tsx`: root → `pointer-events-auto`, `role="dialog"`,
  `aria-label={"Arrival: " + entry.n}`, `tabIndex={-1}`, focused on mount (focus utility),
  restore on close. Click on root (not on the card button) → `onDismiss`. Key handling at
  dialog level: Space/Escape dismiss; the button keeps native Enter/Space activation.
- `SpaceScene.tsx`: remove the 5.5 s `setTimeout` (line ~481) + its ref plumbing (named
  test change for any spec that waited on auto-dismiss); `onDismiss` = `patch({vista:null})`
  ONLY (arrivedId/camera untouched); post-dismiss `aria-live` "Resumed flight at {name}".
- **Click-swallow window:** for 300 ms after dismissal, the scene's canvas click handler
  ignores clicks (D4-AC2's double-click protection) — implement in SpaceScene's click
  gate, not the engine.
- Escape stack: one `useEscapeStack` in the focus utility — order: card → vista →
  suggestions → sectionOpen (replaces the blanket handler at SpaceScene.tsx:488-491).
- Hint line: `CLICK ANYWHERE OR PRESS SPACE TO RESUME FLIGHT`; pointer-media query swaps
  the hover-vitals line on touch.

### D4.2 Field-object travel parity (Babylon `fs-` branch)

Port space-engine.js:1482-1497 semantics into `travelTo` (babylon-engine.ts:4719-4722):
on `id.startsWith("fs-")`, parse index `i`, read position from the retained `_field`
(positions/meta arrays, :1588-1592 — the same store `fieldInfo(i)`/hover uses), synthesize
`{pos, dir: normalize(pos), ly: derived from the field's depth convention (legacy uses
L*3.9 — match the legacy-derived value so the two engines agree on synthesized `ly`)}`,
then `_beginWarp` + `cosmos:select` exactly like a catalog body. Arrival flows through the
existing vista/card path; `entryForFieldStar` (SpaceScene) revives untouched. E2E = D4-AC4.

### D4.3 Card polish + focus utility

- **New `src/lib/focus-utils.ts`:** `trapFocus(el)`, `moveFocus(el, restoreTo)`,
  `useEscapeStack(layer, handler)` — one implementation, three consumers (D1 LAUNCH, D4
  dialogs, D5 combobox).
- CollectorCard: focus trap + focus move on open; `aria-labelledby` the name heading;
  style dots ≥24 px hit area + `aria-label`/`aria-pressed`; stat-bar divs `aria-hidden`;
  delete the vestigial `e.r === "field"` ternary (CollectorCard.tsx:189).
- Hover hygiene: clear `hover` in both card-open paths (SpaceScene.tsx:469-477, 831-839)
  AND render `HoverTooltip` only when `!cardId && !vista`.
- Naming pass: card = "COLLECTOR CARD" everywhere (hover CTA
  `ON STATION · OPEN COLLECTOR CARD ▸`); "dossier" reserved for section overlays. One
  sweep, one TR note, E2E string updates named.

### D4.4 Content pass (DECIDED — sourced, owner-approved drafts)

- **Do not edit generated catalog files** (#22). New hand-curated overlay module
  `src/data/celestial/celestial-content-overlay.js` (same `window.CELESTIAL` merge pattern,
  applied LAST in SpaceScene's import chain, overriding `f`/`lo` by id) for the 41+ NGC2000
  `[[TODO: content pass…]]` entries and the 25 deferred cluster texts.
- Workflow per batch: generate drafts grounded in official sources (NASA/ESA/IAU/refereed
  literature; SIMBAD/NED for data values) → record per-card source list in
  `docs/analysis/2026-XX-XX-card-content-sources.md` → owner approves batch → land.
- Unit test: no `[[TODO` string remains in the merged catalog; overlay only overrides
  existing ids (no phantom bodies).

---

## D5 — Where-To console v2

← Delivery plan: [Phase D5](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d5--where-to-console-v2-owner-r9r10)
· Binding UX: [experience review §D5](../experience-design/2026-07-22-pf11-experience-review.md) + D5-AC1..6

### D5.1 Renames (APPROVED)

`MissionControlBar.tsx`: RNG → `RANDOM JUMP ▸` (`title`/`aria-label` "Jump to a random
destination"), SOL → `◂ RETURN HOME` ("Return home to Earth orbit"); CollectorCard's
`◂ RETURN TO SOL` → `◂ RETURN HOME`. Sub-400px: `JUMP ▸` / `◂ HOME` via a CSS breakpoint
(text swap by class, full text in aria). E2E selector updates = named test changes.
Post-ship: run the label-comprehension check; result to the TR.

### D5.2 Search v2

- **New pure module `src/lib/destination-search.ts`:**

```ts
export interface SearchEntry {
  id: string;
  name: string;
  designation?: string;
  type: string;
  kind: "body" | "station" | "class";
  ly?: number;
}
export function buildIndex(
  catalog: CelestialEntry[],
  stations: Station[],
): SearchIndex;
export function search(
  index: SearchIndex,
  query: string,
  limit?: number,
): Ranked[];
// rank: exact-name > name-prefix > word-start > substring > id/designation match;
// stations outrank bodies at equal tier; stable, unit-tested against the pinned corpus
```

- Stations: source from the `STATIONS` list in types.ts (audit: registered via
  `setStations`, never searchable) — add them at index build, badged `kind:"station"`.
- Id matching: normalise both sides (`ngc7293` ↔ `NGC 7293`: strip spaces/case in a
  secondary key).
- `SpaceScene.tsx`: replace the inline filter (:709-727) with the module; Enter travels to
  the ACTIVE ranked option; cap 10 + `N MATCHES · SHOWING 10`; empty-query featured list
  (curated const, ≥1 station); no-match state; mid-warp: input stays live, submission
  queues via D3.3 (`RETARGET QUEUED`) — the console renders the queue state from
  `cosmos:retarget-queued`.
- `MissionControlBar.tsx`: combobox ARIA (`role="combobox"`, `aria-expanded`,
  `aria-controls`, listbox/option, `aria-activedescendant`), ArrowUp/Down/Enter/Escape;
  bottom-dock mobile: suggestion list opens upward + `visualViewport` keyboard handling
  (verify the current `top-[calc(100%+8px)]` doesn't open off-screen when bottom-docked —
  if it does, that fix lands here).

### D5.3 Class entries

`kind:"class"` rows (`A WHITE DWARF · NEAREST INSTANCE`) → engine method
`nearestFieldOfType(typeByte)` scanning `_field` meta (typed-array scan, no allocation;
cache per camera position epoch) → `travelTo("fs-"+i)` via D4.2. Depends on D4.2; ships
after.

### D5.4 Missing-body audit

For each of Mimas/Iapetus/Phobos/Triton/Charon: either a real curated entry (real geocentric
ra/dec + rank-honest offsets per the Saturn-moons precedent, TR-079 Part 8d) or remove the
dangling reference; Phobos/Deimos remain NEVER_SPHERE. Each recorded in the TR. The
D5-AC3 audit test (travel surface ⊆ search index) lands here and guards forever.

---

## D6 — PF-10 debt closeout

← Delivery plan: [Phase D6](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d6--pf-10-debt-closeout-from-the-plan-tail--handoff-bc-sections)

### D6.1 Exposure: surge → `refl`, then Reinhard (DECIDED)

In `planet-sphere.ts` + both twins: (1) move the opposition-surge factor out of `uAlbedo`
into the `refl` term over a Bond-albedo base (per the Earth brief's addendum — the surge is
a 2–134 px angular feature the α=0 camera uniquely shows); (2) final radiance
`L' = L / (1 + L)` (Reinhard) immediately before the output encode (after lighting, before
sRGB — order matters with D6.3's decode fix; land D6.3's linear pipeline FIRST or in the
same slice). Ledger entry: 9.0:1 → 2.9:1 compression declared. Verify: the six clipping
bodies (Dione 2.17 … Io 1.21) all land < 1.0; Moon/Mars unchanged within ~5%; unit tests on
the shader SOURCE strings (both twins) per the repo's shader-test convention.

### D6.2 Belt frame re-expression — GO

**Approved (owner, 2026-07-22 — ADR-0010 update).** Re-express the `ASTEROID_BELT` model
math (babylon-asteroids.ts:42-63 spine/pull/density + shader `ORBIT_SUN_Z` rotation) in an
obliquity-inclined basis (`OBLIQUITY_J2000_DEG = 23.439281` already in the pipeline), keep
the m42 showcase-route crossing by re-tuning the route constant, regenerate
`asteroids-dr3.png` with `--frame equatorial`. Concrete sequence:

1. **Basis first, data last.** Introduce a single shared basis constant — the ecliptic
   pole/plane expressed in the scene's equatorial frame (a unit quaternion or 3×3 matrix,
   defined once in `babylon-asteroids.ts` and mirrored in the physics-subset generator) —
   and rewrite `beltPullAccel`/`beltDensityAt`/`beltOrbitPosition` to transform into belt
   space, apply the existing X–Y math unchanged, transform back. The tuned model constants
   (spine radius 170, gaussian widths, pull gains) are preserved exactly; only the frame
   moves.
2. **Shader twins:** the belt branch's orbital rotation axis becomes the inclined pole —
   pass the basis as uniforms (or bake as constants, matching the module's existing style),
   GLSL + WGSL line-parallel; the Kepler rate law (K = 39.823416) reads the true
   heliocentric radius and is frame-invariant — no change.
3. **Data:** regenerate `public/assets/asteroids-dr3.png` and
   `src/data/asteroids-dr3-physics.ts` with `--frame equatorial`; the Kirkwood
   radial-histogram regression (gap minima on the 3:1/5:2/7:3/2:1 resonances) must pass
   UNCHANGED — radii are frame-invariant, so this is the proof the rotation is pure.
4. **Route re-tune:** the m42 showcase-route belt crossing was tuned against the old plane;
   recompute the crossing point against the inclined belt and adjust the route constant;
   verify the warp-slowdown E2E still sees density > 0 on that route.
5. **Astra REALISM-AUDIT closes the slice:** belt-on-the-zodiac verified against real
   ecliptic geometry (the audit that first flagged this, closed by measurement).

#### D6.1 + D6.3 notes as built (2026-07-23, [TR-087](../test-reports/TR-087.md))

Landed as ONE slice, exactly as D6.1's own instruction above allows ("land D6.3's linear pipeline
FIRST or in the same slice"). Four points recorded rather than silently resolved:

1. **The exit criterion needed a free parameter the plan did not name.** "Verify: the six clipping
   bodies all land < 1.0; Moon/Mars unchanged within ~5%" is unachievable with the gain left at
   3.6 — Reinhard alone takes the Moon −22%, and adding the sRGB decode moves it further. The
   criterion is met by **solving** for the gain (3.6 → **1.9**), which is what "re-tune `uAlbedo`
   multipliers against the Astra briefs after the change" is really asking for. A single shared
   `EXPOSURE_GAIN` was preferred over per-body multipliers because per-body gains destroy the
   ratios, which is the one thing this section exists to protect.
2. **Eight bodies were clipping, not six.** Saturn (1.500) and Jupiter (1.207) are absent from
   Astra's A2.3 table, which sampled nine of sixteen shipped bodies. The instrument reproduced
   A2.3 to three decimals on the nine it did cover, so this is an extension of that measurement
   rather than a disagreement with it.
3. **`SELF_SHADOW_ELEV` is gated on relief presence**, so the twelve bodies shipping neither a
   height nor a normal map are bit-identical to before the term existed. The plan says "cheap
   slope-vs-sun term"; what shipped is a solar-elevation threshold, declared SIMPLIFIED, because a
   true slope-vs-sun occlusion test is a ray-march and that is what the plan rules out in the same
   sentence.
4. **`--if-stale` could not deliver the `uAtmosphere` flag**, and that is a general pipeline gap
   rather than a one-off: staleness is judged on image mtimes, so a declaration change that adds a
   manifest field without touching a pixel is invisible to it. Options were a full re-emit of all
   88 images or hand-editing a generated file (CLAUDE.md #22) — both wrong. Fixed properly with a
   `syncManifestMetadata` reconcile pass and a single `METADATA_FIELDS` list shared with the
   full-build path, so the two modes cannot drift.

### D6.3 C4.3 bundle: sRGB, tier gating, self-shadow, uAtmosphere

1. **sRGB decode (B8, do first):** planet twins decode `surfaceTex` samples
   (`pow(c, 2.2)` approximation or exact EOTF — pick one, document) → light in linear →
   encode once at output. Re-tune `uAlbedo` multipliers against the Astra briefs after the
   change (they were fitted to the sRGB-space bug).
2. **Tier gating:** `_tickPlanetSphere`'s texture ladder becomes quality-aware — lite: base
   (2048, finally consumed — the 6.58 MB B5 item), balanced: high, full: high→ultra
   progressive (current behaviour). D9 layer `planet-hires` can force either way.
3. **Self-shadow:** height-map-based terminator softening only (cheap slope-vs-sun term in
   the twins) — full shadow-mapping is out of scope; declared as SIMPLIFIED.
4. **uAtmosphere per-body flag** in `public/assets/planets/manifest.json` (replaces the
   cloud-map-presence proxy, babylon-engine.ts call-site comment).

### D6.4 Earth goHome reveal + home orbit (R16)

Spec base: Earth brief Addendum 2 (sphere at origin, sun direction from the sun's own
catalog entry, park at ra 160/dec 0 → 90.0000° phase: terminator centred, city lights,
twilight band; night-lights assets restored floor-subtracted per the brief).

**Home ORBIT (owner R16):** replace the idle-at-home yaw drift (babylon-engine.ts:1196-area
spec "idle-at-home view drifts") with a slow circular camera orbit about the origin at the
current standoff radius, holding the 90° phase-angle band (orbit in the plane that keeps
the terminator in frame — i.e. orbit axis ≈ the sun direction), look-at origin.
**Period: 180 s screen-time** (declared license vs the real ~92.7 min LEO period at 400 km —
~31× compression; record in the ledger). Reduced motion: static park at the ra160/dec0
vista. `RANDOM JUMP`/nav from orbit works unchanged (`goHome` no-ops if already home —
keep, but "already home" now means "in home orbit").
E2E: goHome → sphere visible + camera position advancing along the orbit + phase angle
90 ± 2° via `sceneStats`. Astra audit: orbit plane/phase-hold correctness.

#### D6.4 notes as built (2026-07-23, [TR-088](../test-reports/TR-088.md))

Four points recorded rather than silently resolved:

1. **The reveal trigger is `_homeOrbit`, not proximity to the origin.** The spec base says "the
   home sphere must be shown at the parked offset, not at the origin itself"; the first
   implementation read that as a radius test, which is true **at boot**, where the camera sits at
   `[0,0,0]` — inside a sphere of radius 26 — and where it also pulled ~2.5 MB of Earth textures
   into startup on every page load. The trigger is arriving home, which is what the slice is named
   after. Recorded because the E2E written before this was found asserted the buggy behaviour.
2. **The orbit phase integrates `_dtWarpS`, not `dt`.** This section did not say which, and the
   clamped `dt` is the obvious choice sitting in scope — but it is `SHIP_MAX_DT`-capped at 0.05 s,
   so below 20 fps the period silently stretches (measured 8× slow at ~2.5 fps). The rule is
   already written twenty lines below in the same function for warp progress: **progress tracks
   wall clock; only the physics step is clamped.** Any later slice adding a timed screen-space
   quantity wants the same distinction — D3's flight model is full of them.
3. **`MAP_TIER_CAP` is new pipeline surface**, not mentioned here, and it exists because the owner
   capped night lights at `high`. It lives in one place consumed by both the builder and
   `--verify`, following the same single-definition discipline `plannedFiles` already had.
4. **A CLAUDE.md #23 hardening rode along.** The canvas-tabindex guard was a per-frame re-assert;
   Babylon's deferred input setup can re-stamp before the first frame ever runs, which an axe scan
   can catch. Now a `MutationObserver`. Out of this slice's nominal scope but squarely inside a
   non-negotiable, and this slice's larger shader made the window more likely to be hit.

**Carried forward, and it belongs to D1.3's prerequisites rather than to D6.4's closeout:**
Earth's `PLANET_LUNAR_L` (0, pure Lambert) and `PLANET_ALBEDO` (0.213, clear-sky) were both fitted
at α = 0. D6.4 renders Earth at α = 90°, and the Lunar-Lambert constant's own source comment says
that choice "becomes a 37-67% error the moment the arrival phase ever changes." Wants Astra's
numbers before D1.3 builds the ascent on the same geometry.

### D6.5 (resolved into D9) · D6.6 atlas cells + Jupiter moons · D6.7 header correction

- D6.6a: atlas is vendored (no build script) — new `scripts/patch-atlas.mjs`: composites
  named 128×128 cells into a copy of `atlas.jpg` from source images + updates
  atlas-map.json; three-mode shape (default/--if-stale/--verify) like the other pipelines;
  never deletes (TR-079 rule). Add Tethys/Dione/Rhea cells from their shipped surface maps.
- D6.6b: Jupiter moon offsets re-ranked rank-honest (Io innermost/least separated →
  Callisto outermost) per the Saturn precedent; data-only change in the curated catalog
  source + named test updates.
- D6.7: PF-10 plan header "221 MB" → additive correction note pointing at 256.01/256.34 MB.

---

## D7 — Memory & runtime optimisation

← Delivery plan: [Phase D7](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d7--memory--runtime-optimisation-owner-r13-audited-opportunities-ranked)

Every slice: before/after numbers (heap snapshot + `?perf=1` fps + `performance.memory`
where available) in the TR. Audited call sites:

| Slice | Change                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Where                                                                    |
| ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| D7.1  | `geometry.clearCachedData()` after upload for the star/SDSS/belt meshes (release ~430 MB CPU). Precondition: verify each mesh stays unpickable and `_field` remains the pick source; guard WebGL context-loss implications (document: context loss now requires re-fetch — acceptable for a portfolio, note in TR)                                                                                                                                                                                                        | babylon-engine.ts:2238-2257, 2344-2365, 2390-2415                        |
| D7.2  | Tier-aware texture ladder (with D6.3.2) + dispose sphere textures on departure (add to the `isVisible=false` branch) + D9 `planet-hires` layer hook                                                                                                                                                                                                                                                                                                                                                                       | babylon-engine.ts:2772-2777 (departure), 2845-2860 (unconditional ultra) |
| D7.3  | SDSS decode → Worker: new `src/workers/catalog-decode.worker.ts` (stride-aware RGBA reader deletes the RGB-strip pass; decode + billboard-build off-main-thread; transfer ArrayBuffers back). **CSP:** `worker-src 'self'` addition in astro.config.mjs — scoped directive + comment + TR (#13). Bonus-merge re-decode of the base catalog eliminated by caching the decoded base field                                                                                                                                   | babylon-engine.ts:2289-2330, 2344-2365; astro.config.mjs                 |
| D7.4  | Allocation sweep: preallocate out-params for `beltPullAccel`/`passageDeflectForce`/`quatRotate`/`travelFrame`/`_projectBody`/`_cameraBasis`; hoist `_pushAberration`'s materials array; **throttle `cosmos:warp` → React to 10 Hz** (internal consumers keep full rate); `Map` for `_tickPlanetSphere`'s per-frame `bodies.find`; plume/ember upload only on param change; VT streamer: replace `toDataURL` re-encode with `RawTexture.update` from the composed canvas' ImageData (or throttle to tile-set changes only) | per the audit's file:line list                                           |
| D7.5  | Havok sleep when furniture faded (lands with D2.1); measure                                                                                                                                                                                                                                                                                                                                                                                                                                                               | babylon-engine.ts `_tickAsteroids`                                       |
| D7.6  | Null out `_bandBuf` after upload; drop `_baseCatalogRgb` after merge                                                                                                                                                                                                                                                                                                                                                                                                                                                      | :3044-3049, bonus-merge path                                             |

---

## D8 — Gaia DR3 Tiny full field

← Delivery plan: [Phase D8](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d8--gaia-dr3-tiny-background-field-owner-r12--the-15-conversation-now-scoped)
· DECIDED: all 2,552,302 stars ship as a D9 layer.

1. **D8.1 ADR (write before code):** chunked asset design — N magnitude-sorted chunks
   (`gaia-tiny-00.png` … ~8 chunks of ~320k stars ≈ 4.8 MB each at 15 B/star), layer
   defaults per device from D0.3 (e.g. desktop-full: all chunks; mid-Android: off), the
   ADR-0009 ceiling raise (+~36 MB assets, never boot-critical), and the vertex-budget
   analysis (15.1× — the layer's cost label in D9 shows real measured fps impact).
2. **D8.2 Pipeline:** `scripts/lib/gaiasky-octree-particles.mjs` (the 6th serialization —
   derive the record layout from Gaia Sky's OctreeLoader source/docs, MPL-licensed —
   reading for format reference is fine, no code copying); dedupe against the shipped field
   **by source id** (tiny includes all Hipparcos stars; fall back to a position+magnitude
   crossmatch for records without a HIP id, with the match radius recorded); emit via the
   existing `starfield-pngpack.mjs` encoder; `npm run gaia:tiny` script; unit round-trip
   against production `decodeStarCatalog`.
3. **D8.3 Runtime:** loads through the D9 layer mechanism (fetch-on-enable, chunk-prefix
   partial enable via `_applyDensity`-style index trimming); merged into its OWN mesh (do
   not rebuild the 541k merged mesh per chunk — ADR-0007 dispose-before-replace and D7.1
   lifecycle apply); E2E per delivery plan.

---

## D9 — Render Console

← Delivery plan: [Phase D9](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d9--render-console-user-configurable-layer-rendering-adr-0010)
· [ADR-0010](../adr/0010-owner-decisions-render-console.md)

### D9.1 Layer registry + engine surface

**New `src/lib/render-layers.ts`** (pure metadata + types; the engine implements, the panel
renders — neither owns the list):

```ts
export type LayerId =
  | "star-field" // base 168,959 — always on (not toggleable off; it IS the scene)
  | "bonus-stars" // WD 359k + CNS5 + Oort + clusters-bg (5.8 MB)
  | "sdss-field" // 3.64M galaxies (47.1 MB)
  | "belt-visual" // 154,662 DR3 (2.08 MB)
  | "belt-physics" // Havok subset
  | "nebula-volumes"
  | "gd1-trail"
  | "constellations"
  | "milky-way-band"
  | "planet-hires" // ultra/VT texture ladder
  | "gaia-tiny"; // D8: 2.55M, chunked
export interface LayerMeta {
  id: LayerId;
  label: string;
  assetBytes: number;
  vertsApprox: number;
  defaultByTier: Record<QualityTier, boolean | number>; // number = chunk prefix
  bootCritical: false;
}
export const LAYERS: LayerMeta[];
export function parseLayersParam(
  v: string | null,
): Partial<Record<LayerId, boolean | number>>;
export function resolveLayers(
  url,
  stored,
  tier,
): Record<LayerId, boolean | number>;
// resolution order: URL ?layers= → localStorage "ij-layers" → device-tier default
```

**Engine:** `setLayers(config)` method + `layers` observed attribute (JSON — follows the
existing `observedAttributes` pattern, babylon-engine.ts:1693-1695). Semantics per layer:

- enable & never-fetched → lazy fetch via the existing post-ready loaders (ADR-0007
  discipline; progress via D1.1's `cosmos:stage`);
- enable & fetched → `mesh.setEnabled(true)` + fade-in via the D2 `uLayerFade` clones;
- disable → fade-out → `setEnabled(false)`; for the heavy meshes additionally release GPU
  - CPU geometry (D7.1's lifecycle — a disabled SDSS layer should cost ~0), re-fetch or
    rebuild-from-cached-decode on re-enable (measure both; pick per layer and record);
- `belt-physics` off → Havok bodies static/asleep (D2.1 mechanism);
- `cosmos:layers {state}` emitted after every apply; `sceneStats().layers` mirror for E2E.

### D9.2 Panel UI

**New `RenderConsole.tsx`** (dossier-format dialog, DATA & LICENSES precedent): rows =
`LAYERS` with checkbox/chunk-slider (gaia-tiny), per-row cost label from `LayerMeta`
(`SDSS DEEP FIELD · 47 MB · 14.6M verts`), live fps readout (perf-telemetry's `renderFps` —
user-facing "measure, don't assert"), presets row (LITE/BALANCED/FULL/EVERYTHING = the
device-policy tier mappings + all-on), RESET TO AUTO. Persistence on apply
(`localStorage "ij-layers"`); `?layers=` always wins and shows a `URL OVERRIDE` chip.
Entry point: a `RENDER ▸` control in the HUD cluster near DATA & LICENSES; keyboard/focus
via the shared utility; `role="dialog"`, focus-trapped; reduced-motion: no fade animations;
no-WebGL: the control is absent (nothing to configure).

### D9.3 Budgets

`budgets.config.mjs`: `bootCriticalDownloadKB` ceiling (gate = sum of boot-critical assets;
new `budget:check` granularity) + per-layer `assetBytes` sourced from the SAME config the
panel reads (one source of truth; a unit test asserts LAYERS metadata matches
budgets.config numbers and on-disk sizes).

### D9.4 Defaults calibration

After D0.3: set `defaultByTier` from measured fps (each preset must hold its tier's fps
floor on the measured device class), record in a TR + ADR-0010 addendum.

**E2E (per layer class):** toggle sdss-field off → mesh disabled + heap drop (via
`sceneStats` proxy metrics); toggle on → fetch + progress events + mesh enabled; reload →
persisted; `?layers=` override wins; belt-physics off → `beltPhysicsAwake false`;
gaia-tiny chunk slider → record-count matches prefix.

---

## Cross-cutting build/test additions (single list for agents)

- New modules: `load-progress.ts`, `funnel.ts`, `focus-utils.ts`,
  `destination-search.ts`, `render-layers.ts`, `catalog-decode.worker.ts`,
  `PreFlight.tsx`, `FunnelOverlay.tsx`, `RenderConsole.tsx`,
  `celestial-content-overlay.js`, `scripts/lib/gaiasky-octree-particles.mjs`,
  `scripts/patch-atlas.mjs`.
- CSP deltas (each = scoped directive + comment + TR): `worker-src 'self'` (D7.3). No
  other CSP change is anticipated; anything else found necessary triggers its own review.
- New/updated npm scripts: `gaia:tiny`, `atlas:patch` (register in package.json AND
  README's scripts table in the same turn — the D6.6a pipeline follows the three-mode
  `--if-stale`/`--verify` convention and joins `assets:verify`).
- Every slice: TR + test-reports README row + timesheet entry + (where a decision was
  made) ADR, per the CLAUDE.md documentation contract. E2E count baseline at PF-11 start:
  **552 unit · 87 E2E** (TR-080).
