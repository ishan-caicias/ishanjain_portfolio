# F2 Ship Views & Placement Reference

**Date:** 2026-07-18 · Companion to [PF-08 F2](../delivery-plan/PF-08-flight-v3.md) /
[TR-024](../test-reports/TR-024.md). Interactive placement sandbox was rendered in-session;
this file is the durable record of the view vocabulary and tuning knobs.

## Station views (idle — NDC screen anchors in `_drawShip`)

Springs (`SHIP_SPRING_OMEGA/ZETA`) glide the ship between these; drawn at
`ndc.y + SHIP_NDC_Y_OFFSET (−0.201)`, depth 3.

| View          | When                          | ndc (x, y)   | scale | alpha |
| ------------- | ----------------------------- | ------------ | ----- | ----- |
| Hero          | Landing / at home             | (0, 0.5)     | 1.3   | 0.55  |
| Parked        | Arrived at body, dossier open | (0, −0.16)   | 0.72  | 0.58  |
| Corner escort | Scrolled into page content    | (0.72, −0.6) | 0.4   | 0.42  |

## Chase views (warp — `CHASE_WAYPOINTS` in `ship-dynamics.ts`)

Camera offset from the ship in the route frame: `cam = ship − (right·r + up·u + dir·back)`.
Look aims `CHASE_LOOK_AHEAD` (1.1) past the ship. Ship drawn at `SHIP_WARP_SCALE` (0.9).

**Owner retune (2026-07-18, supersedes the v1 flank-swing table):** one consistent
behind-the-thruster view held exactly **30° above the thrust axis** (`CHASE_ELEVATION`,
`u = −tan 30°·back` at every interior waypoint), panning OUT through cruise/flip and closing
back in for arrival. Verified in-page: 30.0° held across k ∈ [0.10, 0.92].

| k    | [r, u, back]      | Reads as                                 |
| ---- | ----------------- | ---------------------------------------- |
| 0.00 | [0, 0, 3.0]       | Astern seam (cam(0) = warp.from)         |
| 0.10 | [0, −1.50, 2.6]   | Climb to 30° behind the thrusters, tight |
| 0.35 | [0, −2.60, 4.5]   | Panned out — cruise                      |
| 0.55 | [0.6, −3.06, 5.3] | Widest at the flip (slight r depth cue)  |
| 0.80 | [0.3, −2.02, 3.5] | Closing — brake                          |
| 0.92 | [0, −1.27, 2.2]   | Tight on the thrusters — final approach  |
| 1.00 | [0, 0, 3.0]       | Astern seam (cam(1) = warp.to)           |

## Launch behaviour (owner amendment, 2026-07-18)

Clicking a target no longer swings the camera onto it first. The **ship** turns toward the
route during the aim phase (its on-screen direction = where the clicked object sits on
screen) while the view holds still; the burn then starts and the chase look pans after the
ship (damped, λ = 3.0). `_warpDir` is set at `travelTo`/`goHome` time so the turn begins
immediately.

### Knob semantics

- **r (right)**: which flank you see. Positive = port-side view, ship drifts right-of-frame;
  negative = starboard, drifts left.
- **u (up)**: negative = high camera looking down (the current 30° chase); positive = low
  camera looking up. Current interior waypoints derive as `u = −tan(CHASE_ELEVATION)·back`.
- **back**: chase distance → apparent size (size ∝ 3/depth vs the depth-3 stations).
  Keep ≥ 2 (unit-tested safe distance).
- **look-ahead**: how far past the ship the camera aims — pushes the ship off-center toward
  the trailing edge of frame; 0 = dead-center always.

### Screen-position math (used by the sandbox, mirrors the engine)

`f = normalize([r, u, back+ahead])`, view basis `rv = normalize(cross([0,1,0], f))`,
`uv = cross(f, rv)`; `depth = P·f`; `ndc = (P·rv / (depth·tan35°·aspect), P·uv / (depth·tan35°))`
with `P = [r, u, back]`.

## Pans available

Free-look drag (360° yaw, ±83° pitch — live and authoritative mid-flight), arrow-key pan,
damped chase look (λ = 3.0), aim ease at departure. Not available: roll, zoom (FOV fixed 70°
apart from warp breathing).

## Tuning workflow

Dial `[r, u, back, look-ahead]` in the sandbox → read the `[k, r, u, b]` tuple → edit
`CHASE_WAYPOINTS` in `src/lib/ship-dynamics.ts`. Constraints: first/last rows must stay
`[0,0,SHIP_VIEW_DEPTH]` (arrival/launch continuity, unit-tested), back ≥ 2, k strictly
ascending.
