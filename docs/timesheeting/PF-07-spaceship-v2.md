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
    "status": "complete",
    "start": "2026-07-17T14:10:00Z",
    "end": "2026-07-17T15:20:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate (turn segments). TR-018: pure plume system in ship-dynamics.ts (+5 unit tests) + dedicated additive cone pass in the engine; rim uniform uRimCol warms while parked; hero copy dims via body.ij-warping (stations verified already-quiet pre-existing — recorded, not re-implemented). Latent P1 defect fixed (glow attrib enable). Suite destabilization root-caused to 8 parallel SwiftShader workers — bounded to 4 locally, CI untouched; per-frame plume allocation eliminated. Verified: build 0, unit 35/35, E2E 39/39, burn-plume + hero-dim screenshots. Rim tint unit-tested but not isolated in a screenshot — owner eyeball item."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 4 — Adaptive quality and fallback parity",
    "detail": "craft-tier policy (URL → stored override → auto device signals → off default), accessible quality selector, fallback parity",
    "status": "complete",
    "start": "2026-07-17T15:20:00Z",
    "end": "2026-07-17T16:05:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate. TR-019: craft-tier.ts pure policy (+11 unit tests incl. full precedence matrix), Ship-model-quality selector card in Data & Licenses (persists to localStorage, live tier swap via attributeChangedCallback), 4 new E2E (auto→2k desktop, auto→1k narrow, stored override flag-less, no-WebGL fallback with flag). Craft default remains OFF until P5 rollout — deliberate phase gating, not partial completion. Strict console spec hardened: readiness timeout 25s + file retries:2 after capturing that its one recurring failure was the readiness precondition, never a console error. Verified: build 0, unit 46/46, E2E 43/43."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Phase 5 — Verify, harden, release",
    "detail": "Owner hero revision (2.5x center stage), default-on rollout, credits CC-BY row, hardening + rollback docs",
    "status": "complete",
    "start": "2026-07-17T23:30:00Z",
    "end": "2026-07-18T00:20:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate. Owner sign-off received with revision: hero station 2.5x scale + center stage (parked 2x, escort 1.5x — proportionate interpretation, stated for redirect); re-captured and verified. TR-020: default-on via auto policy (two deliberately-named test flips), CC-BY-4.0 credits row, rollback runbook, release validation checklist with post-deploy section. Hardening: shell 0.997 MiB vs 10 MiB budget (GLB lazy 0.412/1.019 MiB), npm audit 0 vulns, SwiftShader frame probe 115.9ms EMA recorded as non-representative. Verified: build 0, unit 47/47, E2E 44/44 incl. default-on + opt-out specs. Plan DELIVERED. Owner actions remaining: commit batch, push/PR, deploy, run post-deploy checklist (Netlify GLB binary check, real-device perf)."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-07-spaceship-v2",
    "phase": "Post-delivery hotfix — hull shading (TR-021)",
    "detail": "Owner-reported bleached-white hull → sRGB/Reinhard shading pipeline in CRAFT_FS",
    "status": "complete",
    "start": "2026-07-18T01:10:00Z",
    "end": "2026-07-18T01:45:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Timestamps approximate. Diagnosed by measurement (hull texture means 71-79/255 — dark blue-gray, not white): the P1/P3 tone curve lit sRGB values directly and compressed midtones to 0.63-0.95, bleaching texture contrast — exposed at the P5 2.5x scale. Fixed with decode(x²)→linear lighting→Reinhard→encode(sqrt). Verified: build 0, unit 47/47, E2E 44/44, capture shows restored gold-brown/gray panel detail. Owner real-GPU confirmation pending; further fidelity is PF-08 F0."
  }
]
```
