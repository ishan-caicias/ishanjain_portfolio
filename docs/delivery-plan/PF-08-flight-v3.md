# PF-08 Flight v3 — True 360° Flight Model & Graphics Fidelity

**Date:** 2026-07-18
**Status:** IN PROGRESS — F0+F1 complete ([TR-022](../test-reports/TR-022.md), incl. owner-directed landing-experience amendment) · F2/F3 next
**Baseline:** PF-07 ship-v2 DELIVERED ([plan](PF-07-spaceship-v2.md), TR-014…TR-021) —
custom WebGL1 engine, zero runtime deps (ADR 0002), textured craft default-on, 47 unit /
44 E2E green.

## Owner Feedback Driving This Plan (2026-07-18)

1. Travel feels **linear/choreographed** — ship plays a fixed animation, then the _camera_
   flies a straight eased line while the ship holds a screen station. Wanted: real-world
   360° — the **ship itself** orients, thrusts, and travels in any 3D direction.
2. Thrust is **not realistic** — the additive cone quads read as a sprite, not exhaust.
3. Richer graphics overall (hull fidelity addressed first via the TR-021 hotfix).

## Honest Statement of the Current Model (what v3 changes)

Today the **camera** owns travel (eased warp between catalog coordinates; free 360° look via
drag) while the **ship** is a view-space hero prop gliding between three fixed screen
stations with procedural bank/flip. v3 inverts this: the ship gets a real flight state
(orientation quaternion, thrust, velocity) and the camera becomes a chase observer — the
engine's coordinate space, catalog, and renderer all stay.

## Phases

### F0 — Visual fidelity foundation

sRGB/tone pipeline (✅ delivered early as TR-021 hotfix) · key/fill/rim relight against the
restored linear pipeline · engine-glow light cast onto the rear hull (cheap point-light term
fed by plume phase) · optional star-bloom behind the ship.
**Exit:** owner sign-off on hull fidelity at 2.5× on a real GPU.
**Outcome (2026-07-18, TR-022):** ✅ Amended + delivered — landing/loading choreography (ship-first reveal, WHERE-TO docked, 1-line title / 2-line copy), engine-glow-on-hull. Star bloom deferred (optional). Owner GPU sign-off pending.

### F1 — Ship flight state

`ship-dynamics.ts` grows a true flight model: orientation quaternion + angular velocity
(slerp-damped), thrust vector, velocity integration (capped, arcade-tuned). Departure = turn
toward the destination's real RA/Dec direction, then burn; flip-and-burn happens on the true
travel vector, not screen-space. Unit-test the integrator (orientation convergence, energy
boundedness, reduced-motion snap).
**Exit:** ship visibly yaws/pitches/rolls toward any 3D target before thrusting; suite green.
**Outcome (2026-07-18, TR-022):** ✅ Delivered — damped-quaternion orientation onto the view-space travel vector; emergent flip; 51/51 unit · 44/44 E2E.

### F2 — 360° travel choreography + chase camera

During warp the camera detaches from its fixed forward frame and chases the ship (offset
spring, look-ahead), giving departure/cruise/arrival views from changing angles; free-look
drag stays live mid-flight (the existing 360° look). Arrival = decelerating orbit-in rather
than a screen-station snap.
**Exit:** a full journey reads as: turn → burn → cruise with parallax → flip → brake →
arrive, from any start to any destination direction; E2E travel specs extended.

### F3 — Exhaust realism

Replace cone quads with a layered system: noise-scrolled plume texture (generated, no new
deps), inner white-hot core + outer diesel-orange sheath, length/turbulence from acceleration,
heat-shimmer offset pass behind the nozzle, ember particles on burn start/stop reusing the
engine's point-sprite infrastructure.
**Exit:** burn/coast/brake are visually distinct and read as propulsion, not sprites; owner
sign-off.

## Constraints Carried Forward

Zero new runtime dependencies (in-engine per ADR 0002) · wireframe fallback preserved ·
reduced-motion parity · budgets: shell Δ ≤ +50 KB across v3 · every phase lands with unit +
E2E coverage per the established pattern.

## Risks

| Risk                                                    | Mitigation                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Chase camera fights the free-look drag UX               | F2 keeps drag authoritative — chase offsets, never overrides, user input |
| Flight model feels floaty/sim-like instead of cinematic | Arcade tuning constants in ship-dynamics.ts, owner-eyeballed per phase   |
| Noise plume costs mobile fps                            | Tier-gated: 1K tier keeps the simpler cone plume                         |
