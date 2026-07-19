# Legacy WebGL1 → Babylon/WebGPU cutover — post-flip gap analysis

**Date:** 2026-07-19
**Mode:** INSPECT (no code changed)
**Context:** ADR-0006 flipped `resolveEngine`'s default to `"babylon"` on 2026-07-19.
This document is the delta register the owner asked for: what a visitor loses on the
shipping default relative to `?engine=webgl`.

**Status of the flip:** live in the working tree (`src/lib/engine-select.ts:33`), uncommitted.

---

## Headline

ADR-0006 names **three** behaviour deltas at cutover: station sprite markers hidden,
field-star hover absent, free-look drag absent. That list is accurate but **substantially
incomplete**.

Verified against source, the Babylon path renders exactly four mesh classes —
`stars`, `shootingStars`, `nebulaComposite`, `plume` (`grep 'new Mesh(' src/lib/*.ts`) —
plus the ship GLB, instanced asteroid rocks, and a shimmer post-pass. The legacy engine
renders those _plus_ six further visual subsystems that have no Babylon counterpart at all.

**The single most severe finding is not named in any ADR, TR, or checklist:**

> **Curated celestial bodies — the portfolio's actual destinations — are not rendered on
> the Babylon path.** `window.CELESTIAL` is loaded at `babylon-engine.ts:1084` and mapped
> through `placeBody()` into _travel-target coordinates only_. No mesh, sprite, or billboard
> is ever created for them. You warp to Saturn and Saturn is not there.

That is a product-promise regression, not a scope boundary. Everything else below is
secondary to it.

---

## Method

- `src/lib/space-engine.js` (2,764 lines) and `src/lib/babylon-engine.ts` (2,361 lines)
  plus all seven Babylon support modules read in full.
- Event seam cross-checked by grep on both sides and against every consumer in
  `src/components/`.
- Every claim in this document was verified against source directly; inventory findings
  that could not be confirmed by reading the code were dropped rather than reported.
- Test coverage delta taken from the uncommitted `git diff` on `tests/`.

**Severity:** S1 = core product promise broken on the default engine · S2 = visible feature
loss · S3 = degraded or cosmetic · S4 = non-functional, process, or coverage.

---

## Implementation guardrail (added 2026-07-19, before GAP-01/02 work starts)

Before writing code against any GAP item, check for duplication and apply clean-code
discipline — **scoped to what this repo's own conventions actually allow**, stated explicitly
so the scope decision is auditable rather than assumed:

- **`space-engine.js` is archived-in-place and frozen** (ADR-0006, TR-044: "the live WebGL1
  engine stays frozen as the shipping default through B6"). It is no longer the shipping
  default and is kept only as the rollback lever. **Do not refactor it** to share code with
  the Babylon path — that touches a file this repo has explicitly decided stops changing.
  Cross-engine sharing of _business logic_ (type→appearance rules, photometric constants) is
  therefore done by **porting the rule to a new, Babylon-side pure module**, not by extracting
  a shared module both engines import — consistent with how `ship-dynamics.ts`,
  `star-catalog.ts`, and `perf-telemetry.ts` already work (engine-agnostic pure modules that
  happen to be consumed by one engine today).
- **Shader code cannot be shared across engines by construction** — WebGL1 GLSL ES 1.0 and
  Babylon's GLSL/WGSL twins are different languages against different APIs. The DRY target for
  shaders is _within_ the Babylon path: reuse the existing Planckian colour ramp, photometric
  flux math, and billboard-quad vertex layout (`star-field.ts`, `nebula-field.ts`) rather than
  re-deriving them for curated bodies. **Every new shader feature still ships both GLSL and
  WGSL twins**, line-for-line parallel, checked against the reserved-WGSL-identifier list
  (CLAUDE.md #4/#5).
- **Within the new GAP-01/GAP-02 work itself**, curated-body billboards (GAP-01) and
  photographic billboards (GAP-02) are the same underlying primitive — a camera-facing quad
  positioned at a catalog body's world coordinate, differing only in what's sampled
  (procedural per-type shader vs. a texture). Build **one shared billboard mesh/shader
  infrastructure with a per-instance mode flag**, not two parallel systems. This is the
  concrete SOLID/DRY decision for this pass — the alternative (two independent billboard
  pipelines) is the kind of premature-parallel-structure YAGNI exists to prevent.
- **Proportionality over completeness.** Legacy's photo layer includes canvas-composed texture
  atlases, dynamic close-up billboard fetch-on-arrival, and rotating textured planet globes
  with Saturn's rings — a multi-TR subsystem historically (TR-014…021 era). Matching it
  byte-for-byte in one pass is not the target; a real, verified, honestly-scoped first version
  is, following this repo's own established convention (TR-046…050: "visual tuning is a first
  pass, owner taste pass expected"). Anything descoped is named explicitly in the implementing
  TR, not silently dropped.
- **TDD where it earns its keep.** Pure appearance/derivation functions (type → size boost,
  rarity → scale, hex → colour ramp position) get unit tests written against the ported legacy
  behaviour _before_ the Babylon-side shader consumes them — this repo already unit-tests
  shader source as strings (TR-044/045) and pure modules directly (`star-field.ts`,
  `nebula-field.ts` tests), so this is applying the existing pattern, not introducing a new one.
- **No behaviour change to the archived engine, ever, as a side effect of this work.** If a
  Babylon-side fix seems to require touching `space-engine.js`, that is a signal the design is
  wrong, not a reason to touch it.

---

## A. Rendering gaps — legacy renders it, Babylon does not

| ID                                              | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Sev        | Evidence                                                        | Named in docs?                                                                                     |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| ~~**GAP-01**~~ **RESOLVED 2026-07-20 (TR-056)** | ~~**Curated bodies not rendered.** Legacy draws every `window.CELESTIAL` entry as a procedurally-shaded beacon with per-type appearance: black hole with photon ring + lensed arcs, galaxy with inclined disc + nucleus, nebula with 3-lobed cloud, globular/open cluster, planet with limb darkening + terminator, star with diffraction spikes (`space-engine.js:187-312, 885-948`). Babylon renders **none** — bodies exist only as travel coordinates (`babylon-engine.ts:1084`). Arrival lands on empty sky.~~ Fixed: `src/lib/celestial-bodies.ts` ports the per-type shading into GLSL/WGSL billboard twins; ~2,525 bodies render.                                                        | ~~**S1**~~ | `new Mesh(` inventory: no body mesh exists (at time of writing) | **No — undocumented** (at time of writing)                                                         |
| ~~**GAP-02**~~ **RESOLVED 2026-07-20 (TR-056)** | ~~**Photographic DSO layer absent.** Legacy renders real NASA/ESA imagery as camera-facing billboards from a composed atlas, plus equirect-textured _rotating_ planet globes with atmospheric rim glow, Saturn's ring system with Cassini gap, and cosmological redshift with depth (`space-engine.js:391-442, 966-1179`). Babylon has no atlas, no `window.CELESTIAL_IMGMAP` consumer, no photo path.~~ Fixed: the same module reuses the shipped `atlas.jpg`+`atlas-map.json` for 267 bodies — DSO vignette/redshift, rotating lit globes, Saturn's ring. Runtime atlas composition and the arrival-only high-res fallback are named as deliberately descoped in TR-056, not silently dropped. | ~~**S1**~~ | no `atlas`/`photo` code in babylon path (at time of writing)    | **No — undocumented** (at time of writing)                                                         |
| ~~**GAP-03**~~ **RESOLVED 2026-07-20 (TR-057)** | ~~**Milky Way band absent.** Legacy generates a 1024×512 procedural integrated-starlight equirect map — disc + bulge, fBm star clouds, named Cygnus/Carina/Scutum clouds, the Great Rift dust lanes, the Coalsack — sampled per view ray behind everything (`space-engine.js:1589-1729`). Babylon has no skybox and no galactic band; background is flat vacuum black (`babylon-engine.ts:1069`).~~ Fixed: `src/lib/milky-way.ts` ports the texture-build algorithm; sampled via an `infiniteDistance` sphere rather than the archived engine's fullscreen-triangle technique.                                                                                                                   | ~~**S2**~~ | no milky-way/band/skybox code (at time of writing)              | **No — undocumented** (at time of writing)                                                         |
| ~~**GAP-04**~~ **RESOLVED 2026-07-20 (TR-057)** | ~~**Constellation figures absent.** Legacy draws constellation line-figures at r=720, fading out with relativistic beta, toggled by the `constellations` attribute (`space-engine.js:1180-1201, 2264`). No Babylon equivalent.~~ Fixed: `src/lib/constellations.ts`; relativistic fade deferred (GAP-06 dependency).                                                                                                                                                                                                                                                                                                                                                                             | ~~**S2**~~ | no constellation code (at time of writing)                      | **No — undocumented** (at time of writing)                                                         |
| ~~**GAP-05**~~ **RESOLVED 2026-07-20 (TR-057)** | ~~**Warp star trails absent.** Legacy streaks every 3rd star from previous to current camera position above `warpSpeed > 0.4` (`space-engine.js:325-353, 2219-2238`) — the primary visual signature of travel. No Babylon equivalent.~~ Fixed: `src/lib/star-trails.ts`; required solving a real technique gap (Babylon's view matrix bakes in camera translation, unlike the archived engine's manual-subtraction convention).                                                                                                                                                                                                                                                                  | ~~**S2**~~ | no trail pass (at time of writing)                              | **No — undocumented** (at time of writing)                                                         |
| **GAP-06**                                      | **Relativistic aberration + Doppler not ported.** Legacy crowds stars toward the travel vector and applies blueshift/beaming ahead, redshift/dimming astern, on stars, trails, photo bodies and the Milky Way (`space-engine.js:166-175, 227-234, 455-472`).                                                                                                                                                                                                                                                                                                                                                                                                                                     | **S2**     | `babylon-engine.ts:461-463` states it verbatim                  | **Yes** — TR-038/041/042 ("newly possible, still not absorbed"). **Not in ADR-0006's delta list.** |
| **GAP-07**                                      | **Ember sparks + idle bob absent.** Legacy bursts 14 sparks on burn start / 8 on stop, and idle-bobs the hull (`space-engine.js:2540-2541, 2699-2759`). Babylon has plume + shimmer but neither.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | **S3**     | no spark/bob code                                               | No                                                                                                 |

**Balance note — Babylon-only gains.** The flip is not a net loss. Volumetric raymarched
nebulae, GPU shooting stars, the Havok asteroid belt with proximity slowdown/deflection/
impact shake, distance-scaled warp pacing, flip-and-burn thrusters with heat shimmer, and
docking contact all exist _only_ on Babylon (per TR-044…TR-050). GAP-01/02 are the price
paid for that, and they were not consciously priced.

---

## B. Interaction gaps

The Babylon engine registers **zero DOM input listeners** — the only listener in the file is
a `ResizeObserver` (`babylon-engine.ts:1200`). All interaction arrives via imperative calls
from `SpaceScene.tsx`.

| ID         | Gap                                                                                                                                                                                                                                                                                                                                                                                                          | Sev    | Evidence                                 | Named?                                                                                                                                                        |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAP-08** | **Free-look drag absent.** Legacy: 360° yaw, pitch ±83°, with inertia, and drag stays authoritative _mid-warp_ (chase look suspends while pointer is down) (`space-engine.js:1303-1340, 2066-2088`). Babylon: camera is driven solely by the warp state machine; no `attachControl()`.                                                                                                                       | S2     | —                                        | **Yes — ADR-0006**                                                                                                                                            |
| **GAP-09** | **Field-star hover absent.** Legacy picks bodies within 34 px and field stars within a ~0.6° cone, emitting `cosmos:hover`; `fieldInfo(i)` returns RA/Dec/ly/mag/CI/type (`space-engine.js:1349-1441`). Babylon: `fieldInfo()` returns `null`, `skipPointerMovePicking = true`, every mesh `isPickable = false`. `HoverTooltip` never appears.                                                               | S2     | `babylon-engine.ts:2124-2128`            | **Yes — ADR-0006**                                                                                                                                            |
| **GAP-10** | **Canvas keyboard navigation removed — accessibility regression.** Legacy sets `tabIndex=0`, `role="application"`, an instructional `aria-label`, and binds arrows (look), Enter (travel to target nearest screen centre), H (home) (`space-engine.js:1787-1829`). Babylon sets `canvas.tabIndex = -1` twice and adds no ARIA. A keyboard-only visitor loses look control and centre-target travel entirely. | **S2** | `babylon-engine.ts:1048-1053, 1192-1194` | **No.** `accessibility.spec.ts` passes because it asserts only that the _shared React chrome_ stays operable — it does not cover the lost canvas affordances. |
| **GAP-11** | **Station sprite markers hidden**, including the off-screen edge markers (`ex`/`ey`, clamped to a 76 px screen margin) that told you which direction an out-of-view destination lay in. `vis` is hardcoded `false`; `SpaceScene.tsx:631` guards `px != null` so they hide gracefully rather than crash.                                                                                                      | S2     | `babylon-engine.ts:240-292`              | **Yes — ADR-0006**                                                                                                                                            |
| **GAP-12** | **HTML attributes not honoured.** Legacy observes `density`, `constellations`, `ship`, `craft` (`space-engine.js:538-621`). Babylon has no `observedAttributes`/`attributeChangedCallback`; config is URL/localStorage only. Any markup setting these silently no-ops.                                                                                                                                       | S3     | —                                        | No                                                                                                                                                            |
| **GAP-13** | **Scroll-linked ship choreography absent.** Legacy springs the ship between four flight stations — warping, corner-escort when `scrollY > 55vh`, parked-under-dossier, hero (`space-engine.js:2477-2510`) — and halves frame rate when scrolled away. No `scroll` reference exists anywhere in `babylon-engine.ts`.                                                                                          | S2     | `grep scroll` → no match                 | No                                                                                                                                                            |

---

## C. Event-contract gaps — the silent-degradation class

`SpaceScene.tsx` subscribes to 10 `cosmos:*` events. Babylon emits 6. The four it never
emits are subscribed anyway, so nothing errors — the UI just quietly does the wrong thing.

| ID         | Event                             | Sev    | Consequence on the default engine                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------- | --------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **GAP-14** | `cosmos:aim`                      | **S1** | **The HUD displays fabricated coordinates.** `state.aim` is never updated, so the RA/Dec readout renders its initial literal `{ ra: 45, dec: -8 }` (`space/types.ts:60`) for the entire session. This is worse than a missing readout: the HUD asserts a precise, plausible, and permanently wrong sky position. Legacy updates it every 8th frame.                                                                                |
| **GAP-15** | `cosmos:craft`                    | **S2** | `state.craftDone` never becomes `true`, so the landing choreography's intended gate (`state.ready && state.craftDone`) never fires and reveal falls through to the **2.5 s grace timer** (`SpaceScene.tsx:183`). Hero copy + WHERE-TO bar are now timer-driven, not asset-driven — they can appear before or after the ship actually exists. `dataset.craftState` is also never set, which is what the pinned E2E specs waited on. |
| **GAP-16** | `cosmos:hover` / `cosmos:unhover` | S2     | Corollary of GAP-09; `HoverTooltip` is dead code on the default path.                                                                                                                                                                                                                                                                                                                                                              |

None of GAP-14/15/16 appear in ADR-0006.

---

## D. Test-coverage gaps created by the flip

No test was deleted, skipped, or `.fixme`'d — but three whole specs were **re-pointed to
`?engine=webgl`**, which moves them off the shipping default. They now guard the archived
engine while the live one is uncovered.

| ID         | Gap                                                                                                                                                                                                                                                                                                                                                                                                                     | Sev    |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| **GAP-17** | `flight-v3.spec.ts` — all 4 tests pinned. The **entire travel choreography** (burn→flip→brake→arrive, chase pan, launch aim, free-look authority) is unverified on the default.                                                                                                                                                                                                                                         | **S4** |
| **GAP-18** | `craft-ship.spec.ts` — all 7 pinned, including two that were explicitly default-path tests. `"stored quality override applies without any URL flag (P4)"` now passes a URL flag; `"default page loads the craft via the auto policy (P5 rollout)"` no longer tests the default. Traceable to GAP-15: they wait on `data-craft-state`, which Babylon never sets.                                                         | **S4** |
| **GAP-19** | `space-scene.spec.ts` — 10 gotos pinned: mobile scroll-vs-travel, HUD-on-mobile, mission bar, mobile menu + Escape, credits dialog, reduced-motion path, WebGL-fallback banner.                                                                                                                                                                                                                                         | **S4** |
| **GAP-20** | `engine-select.spec.ts` — `expect(snap.frames).toBeGreaterThan(0)` did **not** move to the new default test; it was replaced by a `startupMs !== null` poll and now guards only `?engine=webgl`. **The shipping default no longer asserts the render loop produces frames.** `startupMs` is set on `cosmos:ready`, which Babylon emits before sustained frame production. The poll timeout was also raised 15 s → 20 s. | **S4** |

Residual: the default engine's automated coverage is now engine-select mount, axe, perf
budgets, webgpu-hardware, and a console-error check. The pins are doing double duty as an
archival guard _and_ as concealment of GAP-14/15/16.

---

## E. Non-functional and open-gate items

| ID         | Gap                                                                                                                                                                                                                                              | Sev    | Source                                     |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------------------------------------------ |
| **GAP-21** | **No adaptive quality governor.** Legacy demotes tier after 70 slow frames and re-promotes after 900 good ones — it can buy framerate by shedding quality. Babylon resolves tier **once at boot**; a struggling device stays struggling.         | **S2** | TR-035 ("only one had that lever"), TR-051 |
| **GAP-22** | §A device budget rows **all open** — desktop startup last measured **3.02 s against a 2.5 s budget (a known miss)**; iPad, mid-Android, WebGL2 unmeasured. Accepted as post-flip risk by owner decision.                                         | S4     | ADR-0006 §A, checklist A1–A4               |
| **GAP-23** | First-paint cost rises from the ~150 KB legacy engine to ~330 KB gz Babylon core + on-demand payloads — guarded only by the still-open §A rows.                                                                                                  | S4     | ADR-0006                                   |
| **GAP-24** | `netlify.toml` header-CSP lacks `connect-src blob:`; if header CSP is ever enabled it must mirror `astro.config` or the ship regresses (TR-047 failure mode). Standing hazard, unclosed.                                                         | S4     | checklist C2                               |
| **GAP-25** | Checklist **§E flip/archival rows are all still unchecked** and §B3 contradicts itself (Condition cell says dispositioned, Status cell says "decision needed before flip"). The delivery-plan status header still describes the flip as pending. | S4     | checklist, working tree                    |
| **GAP-26** | `docs/architecture/overview.md` and `component-flow.mmd` describe only `<space-engine>` — the dual-engine seam, `engine-select.ts`, and `<babylon-scene>` are undocumented, despite the seam being the central rollback mechanism.               | S4     | architecture/                              |
| **GAP-27** | Manual screen-reader pass never done; reduced-motion verified at state level only, not perceptually.                                                                                                                                             | S4     | TR-052, TR-042                             |

---

## Explicitly _not_ gaps

Recorded so they don't get re-raised as bugs:

- **Twinkle on field stars** — legacy disables it too ("no twinkle in vacuum").
- **No impact shake on the no-SIMD tier** — tier-consistent by design (TR-050).
- **Shimmer off on `lite`, halo off on `lite`** — deliberate B5 tier budget.
- **Docking contact not a Havok constraint** — deliberate (TR-050).
- **Nebulae invisible until you travel to them** — designed reveal behaviour, not a bug.
- **Star field density** — the ~6× over-density gap (TR-037) was closed in TR-038.

---

## Recommended triage

> **UPDATE 2026-07-20 (TR-056):** GAP-01 and GAP-02 are resolved — see the disposed rows above.
> The owner's actual decision was **option (b) without the temporary revert**: the default
> stayed on Babylon and the fix landed forward in the same working session. That was a
> reasonable call given how quickly it landed, but it means there was a window (the working
> tree between the gap analysis and TR-056) where the shipping default genuinely had this gap
> live — recorded honestly, not smoothed over. The paragraphs below are kept as the record of
> what was recommended at the time.

**Before treating the flip as complete**, GAP-01 and GAP-02 warrant a stop-and-decide. They
are not "bugs to file after cutover" — together they mean the destinations the portfolio is
built around are invisible on the shipping default. The realistic options are (a) revert the
default to `webgl` pending a curated-body render path on Babylon, (b) ship a minimal beacon
billboard pass for curated bodies as a fast follow, or (c) accept and record them in ADR-0006
as deltas of the same class as the other three. **My recommendation is (b) with the default
temporarily reverted** — the seam exists precisely for this, the rollback is one line, and
GAP-01 is very likely to be the first thing a visitor notices.

GAP-14 (fabricated HUD coordinates) is small and independent — wiring `cosmos:aim` is a
contained fix and should not wait on the body-render decision, because displaying confidently
wrong data is worse than displaying none.

GAP-15 is the next cheapest high-value fix and would also un-pin `craft-ship.spec.ts`
(GAP-18), recovering default-path coverage as a side effect.

**Suggested ordering, updated post-TR-057:** ~~GAP-01~~ → ~~GAP-02~~ → ~~GAP-03~~ → ~~GAP-04~~
→ ~~GAP-05~~ → GAP-14 → GAP-15 → GAP-10 → GAP-08/09/11 → re-point the pinned specs
(GAP-17…20) → GAP-21 → close §A (GAP-22).

**ADR-0006 still needs amending** — not for GAP-01/02 anymore, but for the remaining ~23 gaps
this document names that ADR-0006's three-delta list never mentioned. An ADR that
under-reports its own consequences is the kind of record this repo's history explicitly warns
against, and that critique doesn't go away because the two most severe items are now fixed.

---

## Verification status

This is an INSPECT artefact — no code changed, so no BUILD-VERIFY-REPORT is owed. Every
rendering, event, and API claim was verified by reading source; every test claim by reading
the working-tree diff. **Not verified:** the runtime _visual_ severity of GAP-01/02/03 —
confirming what arrival actually looks like on the Babylon path needs the owner's eyes on
`/?engine=babylon` next to `/?engine=webgl`, which is the fastest way to sanity-check this
document's headline.
