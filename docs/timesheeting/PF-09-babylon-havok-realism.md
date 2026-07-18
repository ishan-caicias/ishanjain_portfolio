# Delivery Timesheet — PF-09 Babylon + Havok Realism Engine

Plan: [docs/delivery-plan/PF-09-babylon-havok-realism.md](../delivery-plan/PF-09-babylon-havok-realism.md)

```json
[
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B0 — Foundations & dual-engine scaffold",
    "detail": "Babylon deps, ?engine=babylon flag, BabylonScene island, perf-telemetry harness",
    "status": "complete",
    "start": "2026-07-18T01:30:00Z",
    "end": "2026-07-18T02:00:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "COMPLETE (TR-027; start approximate). engine-select.ts (?engine= resolver, default webgl), perf-telemetry.ts (engine-agnostic PerfMonitor → window.__ijPerf() + ?perf=1 overlay; times mount→cosmos:ready, rAF-sampled fps, device tier), babylon-engine.ts (self-registering <babylon-scene>, minimal Babylon WebGL2 scene, contract stubs for B2), SpaceScene post-hydration swap keeping the default path byte-identical. Added @babylonjs/core@^8.56.2 (MIT, US-jurisdiction). VERIFIED: 80/80 unit (+13), 51/51 E2E full suite on the production preview build (+3 B0 specs incl. babylon renders — startupMs-reported requires a real frame), build/lint exit 0. Babylon confirmed isolated in a lazy dynamic-import chunk; default page JS unchanged. Strategy Gate: no 3feature scorecard; milestone card governed (exception). Model Opus 4.8 = card's Tier-A. MEASURED FINDING for B1: @babylonjs/core barrel = 1.1 MB gz (>900 KB budget) — B1 must use tree-shaken subpath imports + WebGPUEngine. Interactive browser-pane visual blocked by pane/dev-server connectivity (chrome-error) + slow 5MB dev-compile — env issue, not a defect; production E2E is the authoritative proof. B0 does NOT supersede ADR-0002 (that is the B1 gate)."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B1 — Renderer parity spike (GO/NO-GO GATE)",
    "detail": "Babylon+WebGPU parity of the hero scene; measure on desktop+Android+iPhone; write superseding ADR",
    "status": "complete",
    "start": "2026-07-18T02:20:00Z",
    "end": "2026-07-18T23:10:00Z",
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "GATE DECIDED 2026-07-18 — CONDITIONAL GO (ADR-0003, end timestamp approximate). Owner confirmed the iPhone/Android rows were Chrome DevTools EMULATION (no physical phone available), which settles the open question from TR-033. DECISION: proceed to B2 on desktop evidence — real Windows hardware, Babylon 140fps/1070ms vs current 142fps/1357ms against a 60fps floor (parity on fps, BETTER on startup), bundle 329KB gz already under the ~900KB budget, default-path JS unchanged at 260KB, 92 unit / 52 E2E green incl. pixel proof. NOT a plain GO: mobile perf is UNMEASURED, not passed — emulation runs on the desktop GPU at desktop refresh (hence the impossible 135-144fps above any iPhone's 120Hz ceiling), so it validated functional/layout behaviour at phone viewports but no performance dimension. Recording it as passed would convert a known unknown into false certainty, and mobile is exactly where a 330KB engine + ~23MB of billboard vertex data + a 168k-star field is most likely to fail. THREE CONDITIONS gate the B6 cutover (not B2 development): (1) real-device mobile fps — one physical Android over chrome://inspect is free and sufficient; (2) confirm the on-canvas badge reads BABYLON WEBGPU, since the gate table's Backend column was pre-filled from my template and NOT observed — the WGSL twin's real-hardware execution remains unproven; (3) billboard memory reduction (~23MB vs the live engine's ~2.7MB). Current WebGL1 engine remains the shipping default throughout B2-B5, so the live site carries no risk; the B0 dual-engine seam keeps reversal near-free if condition 1 fails. ADR-0002's zero-runtime-3D-dependency stance is superseded for the renderer layer only as far as desktop evidence supports. --- GATE ROUND 2 INCONCLUSIVE 2026-07-18 (TR-033): owner re-measured with the v2 instrument. Startup figures now credible (1.0-1.6s, matching CI 840-2626ms) — Round 1's sub-40ms values were fps-at-startup transcribed into the ms column, since corrected. TWO blockers remain. (1) MY BUG: displayHz used the MINIMUM frame delta with a 4ms floor, so one pair of coalesced rAF callbacks latched it to the 250Hz ceiling — the table's 217-250Hz values are artefacts, no such panel exists. Fixed to a 10th-percentile estimate (verified: a 60Hz stream containing one 1ms frame now reports 60Hz, not 250; production estimate dropped from a phantom 106-250Hz to an honest 13Hz). Relabelled as a WEAK self-check since it derives from the same rAF stream as fps. (2) OPEN QUESTION: iPhone rows report RENDER FPS 135 and 144 — physically impossible, since rAF is vsync-locked and iPhone panels cap at 120Hz ProMotion / 60Hz. With all six rows in a 135-144 band across three device classes, leading hypothesis is DevTools device EMULATION rather than physical hardware (emulation changes viewport/UA but runs on the desktop GPU at desktop refresh). NOT yet confirmed — settled by pasting JSON.stringify(window.__ijPerf().device) from the real iPhone. FIX SHIPPED: the overlay previously carried NO hardware information, so a recorded row had no evidence of origin; it now ends with a device signature line and self-flags a UA claiming Android/iPhone while reporting >=12 CPU cores as LOOKS EMULATED. VERIFIED: 92/92 unit (+1), 52/52 E2E, build/lint exit 0, overlay device line confirmed in a real browser. Desktop rows stand; only the two mobile classes need re-running on hardware. B1 REMAINS GATED — no ADR, ADR-0002 stands. --- GATE ROUND 1 VOID 2026-07-18 (TR-032): owner submitted the first device readings; review before deciding found the INSTRUMENT could not produce a valid reading — my defect, not their method. `fps` counted host requestAnimationFrame ticks rather than engine renders (measured 139 host ticks vs 82 real renders, ~1.7x over-report); 140fps on an iPhone is impossible (rAF is vsync-locked; panels are 60/120Hz); 20-39ms startup is impossible for the current engine (cosmos:ready waits on the star stream: >=350ms of chunk timers alone, CI measures 840-1270ms). Instrument v2 adds renderFps (engine's own frame counter over a 2s window — THE gate metric), displayHz (hard ceiling, makes impossible readings self-evident), renderFrames (0/null proves the scene isn't drawing) and a device block (makes rows attributable); overlay shows RENDER FPS with host rAF for contrast. Gate procedure now records Round 1 as VOID with reasons plus a Round 2 table and explicit rejection rules. VERIFIED: 91/91 unit (+5), 52/52 E2E on the final run (3 runs: 51/52, 51/52, 52/52 — two different singles, each green in isolation; TR-025-class parallel-WebGL flakiness, not regression), build/lint exit 0. Also fixed a self-inflicted per-frame document.querySelector inside the measured loop. B1 REMAINS GATED — no ADR, ADR-0002 stands, re-measure needed. --- B1-CONTINUED 2026-07-18 (TR-029): WGSL twin delivered, and it surfaced a technique-level finding — WebGPU has NO gl_PointSize equivalent (WGSL dropped point_size; point-list = 1x1 px; Babylon ignores pointSize on WebGPU), so the live engine's variable-size point-sprite starfield CANNOT port. Stars re-architected as billboard quads in one merged indexed mesh (buildStarBillboards, pure+tested); Babylon thin instances tried and rejected (require a per-instance matrix buffer, else thinInstanceCount stays 0 and nothing draws — proven via the new sceneStats() diagnostic). Tree-shaking gotcha recorded: subpath imports drop prototype augmentation (thinInstanceMesh side-effect import). GLSL+WGSL twins selected by backend via ShaderLanguage. Added a pixel-proof E2E which immediately earned its place — the first attempt booted, emitted cosmos:ready and drew NOTHING. VERIFIED: 86/86 unit (+2), 52/52 E2E (+1), build/lint exit 0, bundle unchanged at 330 KB gz, in-browser 1,013,754 active indices / 675,836 verts / 237,959 lit pixels. HONEST LIMIT: the WGSL path has never run on real WebGPU hardware (CI has no adapter) — the owner's device run is its first execution. Billboards cost ~23 MB vertex data vs ~2.7 MB for point sprites (~8x) — a B2 optimisation target. --- ORIGINAL B1 ENTRY: GATED on owner real-device measurement (TR-028; start approximate). Spike built & CI-verified: tree-shaken subpath imports replacing the B0 barrel, WebGPU primary (dynamic import when navigator.gpu) with WebGL2 fallback, and the fps-critical 168,959-point custom-ShaderMaterial star cloud (star-field.ts, pure+seeded). VERIFIED: 84/84 unit (+4), 51/51 E2E (babylon renders the star cloud + telemetry via WebGL2/SwiftShader fallback, no errors), build/lint exit 0. DECISIVE BUNDLE RESULT: Babylon 329 KB gz tree-shaken (vs 1.1 MB barrel at B0 = 3.4× cut; under the ~900 KB budget) → GO on bundle; default-path JS 260 KB gz unchanged → GO on regression. THE GATE IS NOT FULLY RESOLVABLE IN CI: headless renders WebGL via SwiftShader (CPU, no WebGPU), so representative fps/startup + the WebGPU path require the owner's real desktop/Android/iPhone — procedure at docs/validation-checklist/2026-07-18-pf09-b1-gate-measurement.md. No fps proxy reported (SwiftShader would mislead). ADR-0002 NOT superseded until a GO reading. Strategy Gate: milestone card governed (no 1spike/3feature on disk; exception). Model Opus 4.8 = Tier-A. B1-continued: WGSL shader twin for native WebGPU; real streaming-catalog + photometric port. Owner action: run the gate procedure → GO writes the superseding ADR + proceeds to B2; NO-GO keeps the current engine + cherry-picks."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B2 — Cinematic flight port",
    "detail": "Vertex expansion → catalog swap → flight model → chase camera → distance pacing → reduced-motion",
    "status": "inprogress",
    "start": "2026-07-19T01:25:00Z",
    "end": null,
    "llmStrategy": null,
    "notes": "Started 2026-07-19 after ADR-0003 conditions 1 and 2 were both discharged on real Android hardware. Scope extended with the vertex-index expansion (ADR-0003 condition 3, folded in from B3). Step 1 of 6 COMPLETE (TR-036): quad corner derived from gl_VertexID / vertexInputs.vertexIndex instead of stored, star vertex buffers 21.9 → 16.8 MiB (-5.2 MiB, 24%). Verified 95/95 unit, 52/52 E2E incl. the Babylon pixel proof, build exit 0. HONEST GAP: the pixel proof runs on Playwright chromium which has no WebGPU adapter, so it validates the GLSL twin only; the WGSL twin is evidenced by materialReady=true (effect compiled) + 1,013,754 active indices + zero console errors, but not by pixels — a WebGPU canvas cannot be read back via drawImage locally. Steps 2-6 (real catalog, flight model, chase camera, distance pacing, reduced-motion) NOT started."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B3 — Volumetric & particle rendering",
    "detail": "GPU-particle thrusters/shooting-stars, volumetric nebulae, heat-shimmer post-pass",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Retires the F3 plume; delivers the refraction shimmer deferred from F3. Tier-gated to WebGL2 fallback."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B4 — Havok physics showcase",
    "detail": "Asteroid collisions, proximity slowdown + debris deflection, idle collisions, impact camera shake, docking contact",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "The portfolio centrepiece (owner-requested showcase). Havok lazy-loaded; body counts tier-gated; needs WASM SIMD (iOS ≥16.4) else visual-only."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B5 — Responsiveness & quality tiers",
    "detail": "Per-device tiers, WebGPU→WebGL2 fallback, touch parity, reduced-motion/no-WebGL paths",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Every device class must meet its budget-table fps floor and startup target on real hardware."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B6 — Harden & rollout",
    "detail": "CI perf-budget gates, accessibility re-audit, ?engine cutover, archive WebGL1 engine",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Babylon becomes default; old engine archived behind a flag for one release before removal."
  }
]
```
