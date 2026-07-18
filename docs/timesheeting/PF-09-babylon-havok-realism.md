# Delivery Timesheet — PF-09 Babylon + Havok Realism Engine

Plan: [docs/delivery-plan/PF-09-babylon-havok-realism.md](../delivery-plan/PF-09-babylon-havok-realism.md)

```json
[
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B0 — Foundations & dual-engine scaffold",
    "detail": "Babylon deps, ?engine=babylon flag, BabylonScene island, perf-telemetry harness",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Current space-engine stays default. Sets up the A/B measurement harness for the B1 gate."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B1 — Renderer parity spike (GO/NO-GO GATE)",
    "detail": "Babylon+WebGPU parity of the hero scene; measure on desktop+Android+iPhone; write superseding ADR",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "The only irreversible commitment. Meets budgets → ADR + proceed; misses → keep current engine, cherry-pick. Supersedes ADR-0002 only from measured data."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-09-babylon-havok-realism",
    "phase": "B2 — Cinematic flight port",
    "detail": "PF-08 flight model on Babylon + distance-scaled travel pacing",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Gated behind B1 go. 'Travel feels real' — speed communicates distance via ly-keyed velocity profile."
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
