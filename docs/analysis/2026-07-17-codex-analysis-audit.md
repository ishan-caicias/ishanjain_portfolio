# Audit of the 2026-07-16 Codex Analysis Set

**Date:** 2026-07-17
**Auditor:** Orion (Claude Opus 4.8 session)
**Scope:** the five GPT Codex 5.4-generated documents in `docs/analysis/`, checked claim-by-claim
against the working branch `feature/PF-07/background-spaceship-v2`, git history, and the
downloaded model files in `resources/spaceship/`.

## Root Cause of the Failed Implementation

**Codex analyzed the `main` branch, not the working branch.** Every "wrong" claim in the set
traces to this one error:

| Codex claim                                                       | True on `main`? | True on working branch?                                          |
| ----------------------------------------------------------------- | --------------- | ---------------------------------------------------------------- |
| App is "still the older starfield portfolio" with `Starfield.tsx` | Yes             | **No** — `SpaceScene.tsx` + 10 space islands shipped Jul 8–10    |
| No `SpaceScene` or `space-engine` in `src/`                       | Yes             | **No** — `src/lib/space-engine.js` (1,469-line verbatim port)    |
| "The previously reported Astro 7 upgrade was incorrect" (Astro 5) | Yes (`^5.2.0`)  | **No** — Astro `^7.0.7`, TS `~6.0.3` since TR-010 (Jul 13)       |
| "Prototype integration step" still needed before ship work        | Yes             | **No** — PF-07 phases 1–6 complete (TR-001…TR-006), 30 E2E green |

Verified directly: `git ls-tree main` shows `Starfield.tsx`/`StarModal.tsx` and
`git show main:package.json` shows `astro: ^5.2.0` — exactly what Codex reported. The working
branch has neither. An implementation run driven by this world model would try to re-integrate
an already-integrated prototype on top of the finished scene — consistent with the observed
"major blunders" that forced the rollback.

## Second Defect: Rolled-Back Work Described as Fact

`2026-07-16-rendering-stack-options.md` ("Validated delivery decision") and
`2026-07-16-validation-record.md` (texture policy, release measurements, phase evidence) describe
an **implemented and measured** Option B hybrid — runtime GLBs at 0.42/0.85 MiB, a 0.900 MiB
shell payload, an adaptive quality adapter, and seven phase reports
(`2026-07-16-space-scene-phase-*.md`). Audit result:

- **None of the seven phase reports exist** in `docs/test-reports/` (all links dangle).
- **No GLB exists** under `public/assets/`.
- **`three` is not a dependency** in `package.json`.

All of it was removed in the rollback. Anyone reading those sections today would believe the
hybrid renderer is live. It is not — the shipped scene still renders the gold wireframe from
`public/assets/ship.obj` via `_drawShip()`.

## What Survives the Audit (Genuinely Valid)

| Document                               | Verdict               | Notes                                                                                                                                                                                                                           |
| -------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Space motion realism audit             | **Valid, high value** | Analyzed the prototype engine, which is byte-identical to the shipped `src/lib/space-engine.js`. All six findings and the top-4 improvement ranking carry over 1:1. The DOM-overlay critique maps to the React overlay islands. |
| Sketchfab ship survey                  | **Valid**             | License/geometry analysis spot-checked; OBJ stats claim (2,923 v / 2,834 f) reproduced exactly. Rejection reasoning (CC BY-NC, Everspace provenance, 540k tris) is sound.                                                       |
| Rendering stack Options A/B/C analysis | **Valid as analysis** | The trade-off framing holds. The _recommendation_ is refined by this audit (below); the "validated delivery decision" section is void.                                                                                          |
| Model selection + license handling     | **Valid**             | `resources/spaceship/…/license.txt` confirms CC-BY-4.0 with the exact required attribution line. Commercial use allowed.                                                                                                        |
| Repo-state / package-baseline claims   | **Void**              | Accurate description of `main`; wrong branch.                                                                                                                                                                                   |
| Implementation/measurement claims      | **Void**              | Describe rolled-back work; treat the budget numbers only as plausible targets.                                                                                                                                                  |

## New Facts Established by This Audit (Not in the Codex Set)

1. **The chosen GLB is a single static mesh** — 1 mesh, 1 primitive, 1 material, 0 animations,
   0 skins, 31,015 vertices, 4 PNG textures (raw download: 43.5 MB). No animation system is
   required at runtime; travel/banking/thruster motion stays procedural in the engine.
2. **The engine context is WebGL1 created with `depth: false`** (`space-engine.js:421`). A
   textured, self-occluding 3D ship needs a depth buffer, and a WebGL context's depth setting
   cannot be changed after creation — the context creation line itself must change
   (`depth: true`, with depth testing enabled only during the ship pass). Any plan that misses
   this fails at the first render.
3. **The byte-identical constraint on `space-engine.js` ends here.** It existed to make the
   PF-07 Phase 1 port verifiable. Ship-v2 work deliberately forks the engine; the file should
   come under lint in the same change (it is currently in the ESLint/Prettier ignore lists).
4. **Sketchfab page counts vs GLB counts differ** (18.2k page vertices vs 31,015 GLB accessor
   vertices — normal/UV seam splitting). Budgets must be computed from the real GLB, not the
   page.

## Refined Recommendation

Codex recommended Option B (Three.js side-renderer for the ship). This audit refines that to
**Option A+ — a minimal in-engine GLB ship renderer** — with Option B as the gated fallback:

- The asset is one static mesh with four textures; a purpose-built loader for this known shape
  is ~200–300 lines against infrastructure the engine already has.
- The realism audit's #1 fix (world-space ship placement) is native when the ship lives in the
  same context, projection, and frame loop as the stars; a second Three.js canvas makes spatial
  integration _harder_, not easier.
- It adds zero runtime dependencies (Three.js ship path would add ~150 KB gz + dual-context
  state sync for a single mesh).
- Fallback gate: if the in-engine PBR-lite pass cannot reach acceptable visual quality in the
  Phase 1 proof, switch to Option B without discarding Phase 0 (the asset pipeline is identical
  for both).

The full phased plan, acceptance criteria, and rollback strategy live in
[PF-07-spaceship-v2.md](../delivery-plan/PF-07-spaceship-v2.md).

## Amendments Applied to the Codex Set

Each affected document now carries a dated audit-correction banner at the top pointing here;
the original Codex text is preserved below the banner for provenance. No silent rewrites.
