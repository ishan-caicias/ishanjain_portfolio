# Delivery Timesheet — PF-07 Spaceship v2

Plan: [docs/delivery-plan/PF-07-spaceship-v2.md](../delivery-plan/PF-07-spaceship-v2.md)

```json
[
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 0 — Asset pipeline (offline)",
    "detail": "Deterministic gltf-transform pipeline: raw 43.5MB Sketchfab GLB → committed 1K/2K runtime GLBs + attribution",
    "status": "complete",
    "start": "2026-07-17T05:57:00Z",
    "end": "2026-07-17T06:40:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate (turn-start/turn-end of the implementing session). Delivered scripts/build-craft-assets.mjs (npm run assets:craft): dedup/prune/weld → simplify 0.5 (1K tier only) → meshopt high → WebP q82 textures. Outputs 0.412 MiB (1K, budget 0.6) and 1.019 MiB (2K, budget 1.2), sha256-proven deterministic. Plan deviation recorded in TR-014: EXT_meshopt_compression adopted at the P0 measurement gate (quantize-only geometry was 1.036 MiB, over both budgets); P1 loader takes the ~35KB meshopt_decoder as a consequence. Safety: resources/ (255MB source downloads) was untracked-but-NOT-ignored — now git-ignored; **/*.glb added to LFS rules. New test layer (LFS-pointer-aware): 9 vitest asset-integrity tests incl. exact loader-contract extension pinning, 3 Playwright served-asset tests. Verified, not just built: build exit 0, unit 17/17, E2E 33/33. Scorecard is the stale 2026-07-08 5-milestone card (predates ship-v2; no fresh 3-feature card generated mid-run — session on Fable 5, above the card's Opus tier-A recommendation). Artefacts: TR-014, docs/test-strategy/2026-07-17-craft-asset-integrity.md. Visual quality of the simplified 1K mesh is unreviewable until P1 renders it."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 1 — In-engine ship renderer (flagged)",
    "detail": "depth:true context, purpose-built GLB loader (meshopt+quantization+WebP), flagged ship pass",
    "status": "complete",
    "start": "2026-07-17T10:45:00Z",
    "end": "2026-07-17T12:05:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate (turn boundaries). Delivered per ADR-0002: src/lib/craft-loader.ts (pure parser + CraftShip GL half), engine fork under lint (one-time format 1469→2302 lines), craft attribute (?craft=1k|2k, default off = wireframe untouched), depth:true context with craft-pass-only depth testing, error→wireframe fallback with context-restore retry, data-craft-state/cosmos:craft observability, CSP + 'wasm-unsafe-eval'. Four real defects found AND fixed by the new E2E during VERIFY: CSP wasm block, illegal GLSL const initializer (ANGLE-only rejection), context-loss latching error state, fade-as-exposure making the hull a silhouette. Verified, not just built: lint 0, astro check 0 errors, build exit 0, unit 22/22 (+5 parser), E2E 36/36 (+3 craft), runtime ready-state with 31,015 verts / 24-bit depth / glError 0, before/after screenshots for the quality gate. Lazy craft chunk 35,192 B; flag-off payload unchanged. Option B fallback gate NOT triggered. Open: owner visual sign-off (npm run preview → /?craft=2k), formal 60fps instrumentation deferred to P4. Scorecard: stale 5-milestone card again (session on Fable 5, above its Opus tier-A recommendation)."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 2 — World-space flight staging",
    "detail": "View-space transform replacing NDC post-shift; world-space pose targets; camera lag/overshoot/settle",
    "status": "complete",
    "start": "2026-07-17T12:55:00Z",
    "end": "2026-07-17T13:45:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate (turn boundaries). Opened with the requested P0/P1 leftover audit — closed the TR-014 1K-eyeball item (indistinguishable from 2K at ship size); confirmed all deviations documented; owner visual sign-off remains open by design for P4/P5. Delivered TR-017: src/lib/ship-dynamics.ts (pure spring integrator + NDC↔view conversion + legacy-parity constants, 8 unit tests incl. projection round-trip and parity proofs), _drawShip placement rewritten for both craft and wireframe paths — view-space object at depth 3 under the scene's warp-breathing 70° projection, under-damped spring glide (ω3.2 ζ0.72) with look-lag and lateral-velocity banking, reduced-motion snaps. ship.{x,y,s,a} semantics preserved. Verified, not just built: lint 0, check 0 errors, build exit 0, unit 30/30, E2E 39/39 (+1 warp-with-craft spec); home + mid-warp screenshots captured (mid-warp shows the craft mid-flip inside the trail field). One order-dependent flake of page-load-console.spec disclosed in TR-017 (passed isolated + on rerun; CI has retries:2). Scorecard: stale 5-milestone card (Fable 5 session, above its tier-A recommendation)."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 3 — Thrusters and arrival presence",
    "detail": "Layered exhaust (core + plume + phase flare + accel jitter); target-tinted rim light; quieter overlays in travel",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Realism-audit fixes #2, #4, #5. Tuning knobs staged in ship-dynamics.ts and the craft shader uniforms (uEmiBoost, rim term)."
  }
]
```
