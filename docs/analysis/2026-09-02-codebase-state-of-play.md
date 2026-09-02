# Codebase state of play — features delivered, verification state, open items (2026-09-02)

**Author:** Procyon (INSPECT mode)
**Date:** 2026-09-02
**Nature:** Read-only analysis. No source, test, config, or asset file was changed by this pass.
Two gates were executed in this session to ground the numbers below; everything else is read
from the docs tree and from source, with the file cited.

## Executed in this session (real, not recalled)

| Command              | Result                                                                                                                  |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `npx vitest run`     | 949 passed · 54 files · 0 failed (11.3 s)                                                                               |
| `npm run docs:check` | passed                                                                                                                  |
| `git status`         | branch `feature/PF-07/background-spaceship-v2`, 52 modified + 13 untracked, 51 commits ahead of `origin/main`, no stash |

**Not run here:** `npm run build`, `npm run test:e2e`, `npm run budget:check`. The last recorded
full gate is [TR-117](../test-reports/TR-117.md) (2026-09-02, same working tree minus TR-118's
additive fix): build clean, **944 unit · 178 E2E**, budgets green. TR-118 then ran the unit suite
(949) plus `astro check` but deliberately not E2E. So the E2E count for the tree as it stands is
**178 as recorded, not re-verified**.

## Session model check

The owner asked to verify the session runs Fable 5.1. The harness environment reports model
`claude-fable-5-1`; no `model` key exists in `~/.claude/settings.json`, `.claude/settings.json`,
or `.claude/settings.local.json`, so nothing overrides it. Confirmed.

## Repository and branch state

- **Branch:** `feature/PF-07/background-spaceship-v2` — the long-lived working branch. Its name
  is three milestones stale (PF-07); every PF-08…PF-11 commit sits on it. `origin/main` is at the
  PF-06 merge (`07ed864`). Nothing on this branch has been through a PR.
- **Uncommitted work (all of TR-116/117/118):** 980 insertions across 17 source/test files
  (`spaceHelpers.ts` +216, `CollectorCard.tsx` +159, `ArrivalVista.tsx` +129,
  `babylon-engine.ts` +100), three new TRs, one Vega motion-audit correction, regenerated
  `sdss18.png` / eight `gaia-tiny-NN.png` chunks / `whitedwarfs-edr3.png` / `cns5.png`, a new
  `public/assets/dso4/` photo set (25 files), Sun textures, `budgets.config.mjs` ceilings.
- **Governance gap:** CLAUDE.md #28 and `.github/rulesets/main-protection.json` require five
  named checks on `main`, but the branch has never been pushed as a PR, so CI has only ever
  validated it on push. The ruleset's contexts match `ci.yml` job names exactly (verified).

## What is built — by subsystem, from source

**Engine seam.** `src/lib/engine-select.ts` resolves URL param → stored override → `"babylon"`.
`SpaceScene.tsx` (1,536 lines) mounts either `<babylon-scene>` or the archived `<space-engine>`
(2,766 lines, WebGL1) and the chrome under `islands/space/`. Both engines share the
`travelTo` / `goHome` / `randomBody` / `setStations` surface plus `setLayers` and `sceneStats`
on Babylon (`babylon-engine.ts:2245, 2983, 6560, 6829, 6863, 6869`).

**Event bus.** Twenty distinct `cosmos:*` events are emitted in `src/`: `ready`, `warp`,
`stage`, `select`, `arrive`, `progress`, `perf`, `craft`, `ascent-done`, `hover`, `unhover`,
`home`, `aim`, `layers`, `retarget-queued`, `abort`, and four layer-ready signals
(`sdss-galaxies`, `gaia-tiny`, `bonus-stars`, `asteroid-belt`). The contract is additive by rule.

**Babylon engine (`babylon-engine.ts`, 7,471 lines, 85 methods).** Subpath imports only — 30
distinct `@babylonjs/core/...` paths and the lazy Havok WASM URL, no barrel (CLAUDE.md #1 holds).
Uses `ComputeShader`, `ShaderMaterial` with `shaderLanguage` twins, `RawTexture`,
`ProceduralTexture`, `PhysicsBody` (Havok v2), `InstancedMesh`, `UniformBuffer`.

**Shader twins.** Thirteen `src/lib` modules carry WGSL alongside GLSL (`ascent`, `babylon-ship`,
`celestial-bodies`, `constellations`, `gd1-trail`, `milky-way`, `nebula-field`,
`planet-sphere`, `star-catalog`, `star-field`, `star-trails`, `venus-descent`, the engine
itself). Ten unit-test files assert the reserved-identifier guard (CLAUDE.md #5).

**Render layers (`render-layers.ts`, PF-11 D9).** Eleven user-selectable layers with per-tier
defaults: `star-field`, `bonus-stars`, `sdss-field`, `belt-visual`, `belt-physics` (48/32/20
bodies), `nebula-volumes`, `gd1-trail`, `constellations`, `milky-way-band`, `planet-hires`
(full tier only), `gaia-tiny` (default 0 chunks on every tier — awaiting D0.3 calibration).
Tiers are `full | balanced | lite` (`babylon-tiers.ts:29`) with a governor that demotes/promotes.

**Flight and cinematics.** `ship-dynamics.ts` (1,104 lines): damped-spring chase camera,
quaternion slerp, the v4 trapezoid warp profile (ADR-0011) with a genuine coast window, flip
choreography with RCS couples, `CHASE_WAYPOINTS` (settle back-distance restored to the D3.1
spec's 4.3 in TR-117). `ascent.ts` launch-from-Earth; `preflight-state.ts` +
`load-progress.ts` the byte-accurate loading dossier (the D1 honesty contract); mid-warp
`goHome` = abort, `travelTo` = queued retarget (D3.3).

**Sky and data.** `star-catalog.ts` + `catalog-decode.worker.ts` decode the PNG-packed base
field; bonus layers (clusters, CNS5, white dwarfs, Oort cloud, SDSS DR18 3.64M galaxies, GD-1,
NGC2000 volumes) ship as PNG packs under `public/assets/` from the `scripts/gaia-*-pngpack.mjs`
pipelines. Gaia DR3 Tiny (2.55M stars) ships as eight magnitude-sorted chunks (ADR-0012).
`babylon-asteroids.ts` runs the real 154,662-object DR3 belt with Keplerian shear and Kirkwood
gaps, re-expressed in the obliquity-inclined basis (D6.2, TR-109). `planet-sphere.ts` +
`planet-vt.ts` / `planet-vt-stream.ts` render 16 real textured, rotating, self-shadowed
spheres with virtual texturing and the Venus cloud descent; the Sun joined the pipeline in
TR-117.

**Chrome.** `PreFlight`, `HUD`, `WarpOverlay`, `MissionControlBar` (ranked ARIA-combobox
Where-To search via `destination-search.ts`), `CollectorCard` / `ArrivalVista` (class-aware
visual fallback and `[[TODO]]`-marker filtering via `spaceHelpers.ts`, TR-117/118),
`RenderConsole`, `SectionOverlay`, `StationSprites`, `HoverTooltip`, `FunnelOverlay`
(`funnel.ts` instrumentation), `AscentSkip`.

**Celestial data.** Sixteen `src/data/celestial/*.js` modules: the PF-07 base ports plus
additive overlays (`missing-moons`, `saturn-moons`, `content-overlay`, `content-overlay-ngc2000`,
`imgmap`, `dso4-imgmap`, `image-borrow-overlay`) — the overlay-first rule from CLAUDE.md #22 is
being followed for the two new modules in this tree.

## Delivery status by plan (from the plan headers, cross-checked with TRs)

| Plan  | State                                                                                                                                                                                                                                     |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PF-07 | Delivered (TR-001…021): WebGL1 engine port, textured GLB ship.                                                                                                                                                                            |
| PF-08 | Delivered (TR-022…026): 360° flight v3.                                                                                                                                                                                                   |
| PF-09 | B0–B6 delivered, Babylon+WebGPU cut over 2026-07-19 (ADR-0006). GAP-01…27 resolved except hardware-gated residue in GAP-22 (per-device fps rows) and GAP-27 (screen-reader pass). B6 device gate MIXED twice (TR-068/069) and still OPEN. |
| PF-10 | Feature-complete (ADR-0008): NGC2000 volumes, GD-1, SDSS DR18, real DR3 belt, real planet spheres + VT. C4.3 corrected to substantially complete (TR-116); only `ultra`-tier real-hardware confirmation open.                             |
| PF-11 | All phases D0.1–D9 implemented (D8 last, TR-114). Post-delivery owner device pass found 7 defects; both P0s (TR-115) and the P1/P2/#5 set (TR-117) closed. D9.4 defaults calibration and D0.3's real-device pass remain owner-scheduled.  |

Twelve ADRs (0001–0012) and 118 TRs exist; the latest sequence numbers are **TR-118** and
**ADR-0012**. Fifty-four unit files and 27 E2E specs are on disk (the newest E2E spec,
`webgl2-fallback-perf.spec.ts`, is untracked).

## Open items, ordered by consequence

1. **Nothing is committed or on `main`.** Fifty-one commits plus a large dirty tree sit on one
   branch named for PF-07. A disk failure or a bad `git checkout` loses months of work. The G11
   lifecycle in the Procyon skill (feature branch → gate → commit → push → PR) has never
   completed for PF-08 onward. This is the single largest risk in the repository and is not a
   code defect.
2. **E2E not re-run on the current tree.** TR-118's change is small and unit-covered, but the
   178 E2E count is recorded from TR-117, not from this tree. A commit should be preceded by
   the full CLAUDE.md #25 gate.
3. **Three TR-117 items await owner sign-off:** a license-risk finding on the newly fetched
   `dso4` DSS2 photos, the scope reduction on the white-dwarf visual body, and the minor-planet
   exclusion. TR-117 lists them under "Open items needing owner input".
4. **D0.3 real-device pass** is still the one owner-scheduled item across PF-09/10/11. It
   calibrates D9 presets (every `gaia-tiny` default is 0 until then), D6.3 tier gating, B6's
   per-device rows, and the `ultra` planet tier. The 2026-07-29 triage §1a suggests the earlier
   phone readings were WebGL fallbacks because the preview was served over plain HTTP; the
   `backend` field added to `PerfSnapshot` in TR-117 now makes that visible.
5. **Triage §1d — tier chosen by CSS viewport width** (P1, open): every phone lands on `lite`
   regardless of silicon, and `high` is unreachable on mobile. This is the one P1 from the
   owner's device pass not yet actioned, and it directly gates goal 3 (native feel on every
   device).
6. **Triage #2 — gaia-tiny chunk value** (P3, open): whether chunks 4–8 are visually
   distinguishable has not been measured.
7. **Base star-field mid-brightness dimming** (P2b's accepted cost): `stars-hip.png` /
   `deep.png` cannot be regenerated, only reinterpreted; TR-117 recommends an owner-eyes
   side-by-side that was not done.
8. **PF-10 C4.3 self-shadowing** ships as a declared-SIMPLIFIED terminator term, not the
   ray-march Astra's brief recommended (recorded in TR-116, not hidden).
9. **Bundle headroom is thin:** `totalJsGz` ceiling 1225 KB, last measured 1210.7 KB (TR-111),
   raised three times in one week for real feature growth. Next feature slice will likely need
   another deliberate raise or a trim.

## Recommendation

Before any new feature work: run the full gate on this tree, commit the TR-116/117/118 work
with the three sign-off items named in the message, push the branch, and open the PR so
`main` finally carries PF-08…PF-11 and the ruleset actually protects it. Then schedule the
D0.3 device pass over HTTPS with the new `backend` telemetry, since §1d (item 5) cannot be
designed correctly without real per-silicon numbers.
