# Delivery Timesheet — PF-08 Flight v3

Plan: [docs/delivery-plan/PF-08-flight-v3.md](../delivery-plan/PF-08-flight-v3.md)

```json
[
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-08-flight-v3",
    "phase": "F0 — Visual fidelity foundation",
    "detail": "sRGB/tone pipeline (shipped early as TR-021), relight, engine-glow on hull, star bloom",
    "status": "inprogress",
    "start": "2026-07-18T01:10:00Z",
    "end": null,
    "llmStrategy": "docs/llm/llm-strategy-scorecard-5milestone.md",
    "notes": "Start approximate. The sRGB/Reinhard pipeline landed ahead of the plan as the TR-021 hotfix (owner-reported bleached hull, diagnosed by texture measurement). Remaining F0: relight pass, engine-glow cast on rear hull, optional star bloom, owner real-GPU sign-off."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-08-flight-v3",
    "phase": "F1 — Ship flight state",
    "detail": "Orientation quaternion, thrust vector, velocity integration; turn-then-burn toward real RA/Dec directions",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Inverts the v2 model: ship owns flight, camera observes. Integrator to be unit-tested in ship-dynamics.ts."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-08-flight-v3",
    "phase": "F2 — 360° travel choreography + chase camera",
    "detail": "Spring chase camera with look-ahead, live free-look mid-flight, orbit-in arrivals",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Drag input stays authoritative over the chase offsets."
  },
  {
    "project": "ishanjain-portfolio",
    "deliveryPlan": "PF-08-flight-v3",
    "phase": "F3 — Exhaust realism",
    "detail": "Noise-scrolled layered plume, heat shimmer, ember particles; tier-gated for mobile",
    "status": "planned",
    "start": null,
    "end": null,
    "llmStrategy": null,
    "notes": "Replaces the v2 cone quads on the 2K tier; 1K keeps the light version."
  }
]
```
