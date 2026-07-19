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

## A. Rendering gaps — legacy renders it, Babylon does not

| ID         | Gap                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Sev    | Evidence                                       | Named in docs?                                                                                     |
| ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| **GAP-01** | **Curated bodies not rendered.** Legacy draws every `window.CELESTIAL` entry as a procedurally-shaded beacon with per-type appearance: black hole with photon ring + lensed arcs, galaxy with inclined disc + nucleus, nebula with 3-lobed cloud, globular/open cluster, planet with limb darkening + terminator, star with diffraction spikes (`space-engine.js:187-312, 885-948`). Babylon renders **none** — bodies exist only as travel coordinates (`babylon-engine.ts:1084`). Arrival lands on empty sky. | **S1** | `new Mesh(` inventory: no body mesh exists     | **No — undocumented**                                                                              |
| **GAP-02** | **Photographic DSO layer absent.** Legacy renders real NASA/ESA imagery as camera-facing billboards from a composed atlas, plus equirect-textured _rotating_ planet globes with atmospheric rim glow, Saturn's ring system with Cassini gap, and cosmological redshift with depth (`space-engine.js:391-442, 966-1179`). Babylon has no atlas, no `window.CELESTIAL_IMGMAP` consumer, no photo path.                                                                                                            | **S1** | no `atlas`/`photo` code in babylon path        | **No — undocumented**                                                                              |
| **GAP-03** | **Milky Way band absent.** Legacy generates a 1024×512 procedural integrated-starlight equirect map — disc + bulge, fBm star clouds, named Cygnus/Carina/Scutum clouds, the Great Rift dust lanes, the Coalsack — sampled per view ray behind everything (`space-engine.js:1589-1729`). Babylon has no skybox and no galactic band; background is flat vacuum black (`babylon-engine.ts:1069`).                                                                                                                 | **S2** | no milky-way/band/skybox code                  | **No — undocumented**                                                                              |
| **GAP-04** | **Constellation figures absent.** Legacy draws constellation line-figures at r=720, fading out with relativistic beta, toggled by the `constellations` attribute (`space-engine.js:1180-1201, 2264`). No Babylon equivalent.                                                                                                                                                                                                                                                                                    | **S2** | no constellation code                          | **No — undocumented**                                                                              |
| **GAP-05** | **Warp star trails absent.** Legacy streaks every 3rd star from previous to current camera position above `warpSpeed > 0.4` (`space-engine.js:325-353, 2219-2238`) — the primary visual signature of travel. No Babylon equivalent.                                                                                                                                                                                                                                                                             | **S2** | no trail pass                                  | **No — undocumented**                                                                              |
| **GAP-06** | **Relativistic aberration + Doppler not ported.** Legacy crowds stars toward the travel vector and applies blueshift/beaming ahead, redshift/dimming astern, on stars, trails, photo bodies and the Milky Way (`space-engine.js:166-175, 227-234, 455-472`).                                                                                                                                                                                                                                                    | **S2** | `babylon-engine.ts:461-463` states it verbatim | **Yes** — TR-038/041/042 ("newly possible, still not absorbed"). **Not in ADR-0006's delta list.** |
| **GAP-07** | **Ember sparks + idle bob absent.** Legacy bursts 14 sparks on burn start / 8 on stop, and idle-bobs the hull (`space-engine.js:2540-2541, 2699-2759`). Babylon has plume + shimmer but neither.                                                                                                                                                                                                                                                                                                                | **S3** | no spark/bob code                              | No                                                                                                 |

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

**Suggested ordering:** GAP-01 → GAP-14 → GAP-15 → GAP-10 → GAP-03/04/05 → GAP-08/09/11 →
re-point the pinned specs (GAP-17…20) → GAP-21 → close §A (GAP-22).

**ADR-0006 needs amending regardless of the decision.** Its three-delta list currently
understates the cutover's scope materially, and an ADR that under-reports its own
consequences is the kind of record this repo's history explicitly warns against.

---

## Verification status

This is an INSPECT artefact — no code changed, so no BUILD-VERIFY-REPORT is owed. Every
rendering, event, and API claim was verified by reading source; every test claim by reading
the working-tree diff. **Not verified:** the runtime _visual_ severity of GAP-01/02/03 —
confirming what arrival actually looks like on the Babylon path needs the owner's eyes on
`/?engine=babylon` next to `/?engine=webgl`, which is the fastest way to sanity-check this
document's headline.
