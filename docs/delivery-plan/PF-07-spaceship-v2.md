# PF-07 Spaceship v2 — Textured Hero Ship & Flight Realism

**Date:** 2026-07-17
**Branch:** `feature/PF-07/background-spaceship-v2`
**Status:** IN PROGRESS — P0 ([TR-014](../test-reports/TR-014.md)) · P1 ([TR-015](../test-reports/TR-015.md), [ADR 0002](../adr/0002-in-engine-glb-ship-renderer.md)) · P2 ([TR-017](../test-reports/TR-017.md)) complete · P3 next
**Inputs:** [Codex analysis audit](../analysis/2026-07-17-codex-analysis-audit.md) ·
[Motion realism audit](../analysis/2026-07-16-space-motion-realism-audit.md) ·
[Ship survey](../analysis/2026-07-16-sketchfab-ship-survey.md)
**Interactive report:** [docs/checkpoint/pf-07-spaceship-v2-report.html](../checkpoint/pf-07-spaceship-v2-report.html)

## Objective

Replace the gold wireframe ship (`public/assets/ship.obj`, drawn by `_drawShip()`) with the
selected textured model — **Sci-Fi Aircraft | Spaceship Fighter** by valterjherson1
(CC-BY-4.0) — and close the top realism gaps identified by the motion audit: world-space ship
placement, layered thrusters, inertial camera response, and local arrival cues.

## Ground Truth (verified 2026-07-17)

- Working branch has the complete PF-07 scene; Astro 7 / TS 6 / React 19; 8 unit + 30 E2E green.
- Source asset (`resources/spaceship/`, git-ignored): GLB 43.5 MB raw; **1 mesh, 1 primitive,
  1 material, 0 animations, 31,015 vertices, 4 PNG textures**. All motion stays procedural.
- Engine is a single WebGL1 context created with **`depth: false`** (`space-engine.js:421`) —
  must become `depth: true` at creation; depth testing enabled only during the ship pass.
- `space-engine.js` byte-identical constraint is retired by this plan; the file comes under
  ESLint/Prettier in Phase 1 (one-time format, then normal review discipline).

## Rendering Decision

**Option A+ — minimal in-engine GLB renderer** (~200–300 lines against existing engine
infrastructure). Zero new runtime dependencies; ship shares the stars' projection and frame
loop, which is precisely what the realism audit's #1 fix needs.

**Gated fallback — Option B (Three.js ship layer):** triggered only if the Phase 1 proof fails
its visual-quality acceptance. Phase 0 output is identical for both paths.

## Phases

### Phase 0 — Asset pipeline (offline)

Build a repeatable `gltf-transform` script (`scripts/`): prune → weld → quantize (if budget
requires) → texture resize + WebP. Outputs committed to `public/assets/craft/`:
`sci-fi-fighter-1k.glb` (≤ 0.6 MiB) and `sci-fi-fighter-2k.glb` (≤ 1.2 MiB). Add
`**/*.glb` to the LFS rules in `.gitattributes`. Record the exact attribution line from
`license.txt` for the credits panel.
**Exit:** both GLBs on disk within budget; script re-runs deterministically.
**Outcome (2026-07-17, TR-014):** ✅ 1K = 0.412 MiB / 2K = 1.019 MiB, deterministic. Measurement
gate triggered the recorded deviation: **EXT_meshopt_compression (high)** adopted for both tiers
(quantize-only geometry was 1.036 MiB, over budget), 1K tier additionally simplified (0.5 →
18,600 verts). **P1 consequence:** the loader must decode `EXT_meshopt_compression` via the
self-contained `meshopt_decoder` (~35 KB) in addition to `KHR_mesh_quantization` and
`EXT_texture_webp` — the exact extension set is pinned by `tests/unit/craft-assets.test.ts`.

### Phase 1 — In-engine ship renderer (flagged)

Change context creation to `depth: true`. Add a purpose-built loader for this known GLB shape
(JSON chunk + BIN chunk + embedded textures) and a ship render pass: baseColor × baked AO +
emissive + simplified directional/rim lighting, tone-mapped to match the scene. Feature flag
(same query-param rollback pattern as PF-07): flag off → wireframe path untouched.
**Exit:** textured ship renders at parity positions/scale at 60 fps desktop; flag-off is
pixel-identical to today; full suite green. **This is the Option B gate.**
**Outcome (2026-07-17, TR-015):** ✅ Delivered per ADR 0002 — Option B gate **not triggered**.
Craft renders textured/normal-mapped at parity placement behind `?craft=1k|2k`; flag-off path
untouched (33 pre-existing E2E green); +5 unit +3 E2E; CSP gained `'wasm-unsafe-eval'`;
`space-engine.js` forked under lint. Owner visual sign-off and formal 60 fps instrumentation
carry into P2/P4.

### Phase 2 — World-space flight staging

Replace the NDC post-shift with a view-space transform (audit fix #1). Re-express the
scroll-state targets (home / parked / corner escort) as world-space poses. Add camera lag,
overshoot, and settle (fix #3).
**Exit:** ship occupies the star scene's space; motion has perceptible mass; E2E travel and
mobile-mode specs still pass.
**Outcome (2026-07-17, TR-017):** ✅ Delivered — `ship-dynamics.ts` (pure spring/NDC↔view math,
8 unit tests), `_drawShip` re-placed under the scene projection with FOV-breathing, look-lag,
and velocity banking. Screen composition preserved via legacy-parity constants (test-proven).
30/30 unit · 39/39 E2E. Perspective is now genuinely wide-lens; `SHIP_VIEW_DEPTH` is the
flatness knob if the owner prefers.

### Phase 3 — Thrusters and arrival presence

Layered exhaust: bright nozzle core + cone/billboard plume + phase-dependent flare length +
acceleration jitter (fix #2). Arrival cues: target-tinted rim light, plume response, quieter
overlays during travel (fixes #4–5), honouring `prefers-reduced-motion`.
**Exit:** warp in/out reads as thrust events; overlays no longer dominate travel; a11y specs pass.

### Phase 4 — Adaptive quality and fallback parity

1K/2K selection via GPU tier, `saveData`, `deviceMemory`, viewport — with an accessible manual
override (the audited policy design was sound; the rolled-back implementation is not reused).
No-WebGL DOM fallback and reduced-motion behaviour verified unchanged.
**Exit:** both tiers exercised in tests; fallback parity confirmed.

### Phase 5 — Verify, harden, release

Full suite + new unit/E2E coverage for flag, tiers, credits entry. Payload budget check
(shell excluding GLB stays within the PF-07 hero budget). Credits panel gains the CC-BY-4.0
attribution (title, author, source URL, license URL, "optimized" note). TR-NNN report, ADR for
the engine-fork + rendering decision, delivery-plan status flip, then PR.
**Exit:** READY TO PROCEED verdict; rollback documented (flag off = wireframe).

## Roadmap Context

`main` still carries the pre-PF-07 starfield site. This branch is the delivery vehicle for the
entire feature: **ship v2 lands here → single PR to `main`** ships PF-07 + stack upgrade +
ship v2 together. Physical-device performance validation (Safari, mid-tier Android, sustained
50+ fps) remains an explicit post-merge follow-up — it cannot be measured in this environment.

## Risks

| Risk                                                  | Mitigation                                                                                          |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| In-engine PBR-lite quality disappoints                | Option B gate at Phase 1 exit; Phase 0 output carries over unchanged                                |
| `depth: true` context change perturbs existing passes | Depth test enabled only inside the ship pass; flag-off pixel-parity is the Phase 1 acceptance check |
| GLB budgets miss after quantization                   | Measured at Phase 0 exit before any engine work begins                                              |
| Engine fork loses byte-identical audit trail          | ADR records the fork point (commit + rationale); lint one-time format is its own commit             |
