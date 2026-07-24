# ADR-0011 — Warp velocity profile v4: coast plateau + flip screen-time floor via an in-window rate multiplier

**Date:** 2026-07-24
**Status:** Accepted (design pass for PF-11 D3.2; implementation follows in the D3.2 slice)
**Deciders:** Procyon (engineering), with Astra §3.2 as the binding science and Vega's D3.2
SHOT-BRIEF as the binding choreography
**Context:** PF-11 Phase D3 (flight model v4), slice D3.2 (flip choreography) ·
[delivery plan D3.2](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#d32-flip-choreography)
· [implementation companion D3.2](../implementation/PF-11-implementation-plan.md#d32-flip-choreography)
· [Astra sky-frames brief §3.2](../analysis/2026-07-22-pf11-sky-frames-and-travel-science-brief.md)
· [Vega D3.2 SHOT-BRIEF](../experience-design/2026-07-24-pf11-d3.2-flip-choreography-motion-spec.md)
· Measured input: [TR-081](../test-reports/TR-081.md) (the ~195 ms flip window is skipped
whenever one frame outlasts it — the GAP-17 `indexOf("flip") === -1` flake, and a visitor who
never sees a flip)

---

## Problem

The delivery plan requires the flip to occupy k∈[0.44, 0.56] with a **screen-time floor of
≥ 1.5 s** on non-reduced paths. Two candidate mechanisms fail:

1. **The implementation plan's prescribed formula is broken as written.** It says: at
   `_beginWarp`, if `(0.12 × warpDur) < FLIP_MIN_MS (1500)`, stretch `warpDur` to
   `FLIP_MIN_MS / 0.12`, with a parenthetical claiming the "≈ 12.5 s floor never triggers".
   The arithmetic is backwards: `warpDur` spans **1,400–4,200 ms** (`warpDurationForLy`), so
   `0.12 × warpDur` spans **168–504 ms — always below 1,500 ms**. The condition fires on
   **every** journey and sets **every** warp to 12.5 s (a 3–9× stretch; a 3.2 s polaris hop
   becomes 12.5 s). This is a docs defect in the implementation plan (corrected there with a
   dated note pointing here); the delivery plan's WHAT (floor ≥ 1.5 s) is unaffected.
2. **Naively dilating k through the window lurches.** Slowing `dk/dt` inside the flip window by
   `r` while keeping the current eased position curve drops the ship's **world velocity** by
   `1/r` (~4× at polaris) the instant the window opens, and snaps it back at the close. An
   engine-cut coast must hold velocity constant — a mid-journey brake-wall with the engines off
   is exactly the CONTRADICTS class D3.1 just removed from the chase.

There is also a standing profile defect the delivery plan's own audit names: the velocity
profile is a **pure triangle** (`dsdk = 4k / 4(1−k)`, no cruise), so today the HUD velocity and
every speed cue _fall_ through the flip — while the narrative says the engines are cut and the
ship is coasting. Astra §3.2's choreography is explicit: **burn cutoff → coast at constant
velocity while rotating → relight**. The triangle cannot express that.

## Decision

Replace the warp position profile with **v4: a trapezoid velocity profile with a genuine coast
plateau across the flip window, plus an in-window k-rate multiplier that enforces the
screen-time floor with exact world-velocity continuity.** Constants: `KA = WARP_ACCEL_END =
0.44`, `KD = WARP_DECEL_START = 0.56`, `W = 0.12`, `FLIP_MIN_MS = 1500`.

**1. Rate multiplier (the floor).** In `advanceWarpProgress`'s caller, k advances at
`(dt/warpDur)·slow·rate(k)` where

```
rate(k) = k ∈ [KA, KD] ? r : 1,   r = min(1, 0.12 · warpDur / FLIP_MIN_MS)
```

so the window's wall-clock is `0.12·warpDur / r = max(0.12·warpDur, 1500 ms)` — the floor,
exactly, with no effect on journeys long enough to clear it naturally (none currently are; see
the table).

**2. Position profile `warpEaseV4(k, r)`** — piecewise, C¹-by-construction in _world time_:

```
m = 1 / (0.44 + 0.12/r)                    // peak normalized ds/dk in the burn segments
accel  k ∈ [0, KA]:  s = m·k²/(2·KA)       // quadratic burn, s'(0)=0 … s'(KA)=m
coast  k ∈ [KA, KD]: s = s(KA) + (m/r)·(k−KA)   // linear, slope m/r
brake  k ∈ [KD, 1]:  s = 1 − m·(1−k)²/(2·(1−KD))
```

The coast slope `m/r` is the load-bearing subtlety: `ds/dk` jumps by `1/r` at the window edges
**exactly where `dk/dt` drops by `r`**, so world velocity `s'(k)·dk/dt` is **continuous** — the
ship burns slightly more gently (`m` shrinks as `r` does), coasts longer at that peak, and
covers the same total distance. This is precisely what a real flip-and-burn with a mandated
coast time does. At `r = 1` the profile is a pure C¹ trapezoid. The profile is symmetric —
`s(0.5) = 0.5` for **every** r (algebraic identity), so the existing midpoint/monotonicity/
ease-shape unit pins on `warpEase` survive; any pin on the exact quadratic values is a named
test change (#15).

**3. Cue driver `warpSpeedNorm(k)`** — normalized world velocity, replacing the inline `dsdk`
triangle for every speed cue:

```
u(k) = k/KA on [0,KA] · 1 on [KA,KD] · (1−k)/(1−KD) on [KD,1]      // ∈ [0,1]
```

β becomes `0.88·u` (peak preserved), D3.1's FOV becomes `1 + WARP_FOV_GAIN·u` (same 1.06 peak),
and the HUD `vC` derives from the true world velocity — all three now **hold peak through the
coast** (engines cut, no forces — Astra §3.2's beat 2) instead of sagging through the flip as
the triangle does today. This _corrects_ the cues' physics, it does not merely restyle them.

## Consequences

**Duration table (floor active on every destination — record in the D3.2 TR):**

| Journey                        | warpDur today | v4 total `0.88·dur + max(0.12·dur, 1500)` | Δ      |
| ------------------------------ | ------------- | ----------------------------------------- | ------ |
| Home / solar-system (1,400 ms) | 1,400         | **2,732 ms**                              | +1,332 |
| Sirius 8.6 ly (~2,088 ms)      | 2,088         | **3,337 ms**                              | +1,249 |
| Polaris 433 ly (~3,246 ms)     | 3,246         | **4,357 ms**                              | +1,111 |
| M42 1,344 ly (~3,590 ms)       | 3,590         | **4,659 ms**                              | +1,069 |
| Extragalactic (4,200 ms cap)   | 4,200         | **5,196 ms**                              | +996   |

- **Owner-visible pacing change:** every journey grows ~1.0–1.3 s; **home roughly doubles**
  (1.4 → 2.7 s). The implementation plan's "home stays snappy via its own `WARP_MIN_MS`" is
  false under any correct floor — no proportional window can give a fixed wall-clock floor
  without this. Proceeding with a uniform floor (the flip is the owner's own R6 complaint, and
  home journeys show the flip too); flagged for the owner at the D3.2 gate — trivially tunable
  via `FLIP_MIN_MS` if 1.5 s reads long on the home hop.
- **Reduced motion is exempt** (delivery plan: floor on "non-reduced paths") — the fixed-short
  350 ms profile and instant hull swap are unchanged (#24).
- **GAP-17 becomes frame-rate-robust:** the flip phase now lasts ≥ 1,500 ms wall-clock, so no
  single slow frame can skip it — the `indexOf("flip") === -1` flake class dies with this
  slice, and the plan requires asserting that explicitly.
- **L15 ledger update:** Astra's warp-duration compression magnitudes shift (~1.2×10⁵× → ~0.6×10⁵×
  at Mars, etc.); the post-D3 REALISM-AUDIT re-states L15's numbers.
- **Event contract unchanged** (#3): `cosmos:warp` keeps `{t, ly, vC, phase, …}`; only the
  values follow the new profile.

**Blast radius (k-threshold consumers — the reason thresholds stay fixed in k):**

| Consumer                                                    | Impact                                                                                                                                                                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `flipPhase` (babylon-ship)                                  | Widens to [0.44, 0.56] + C² `smootherstep` — D3.2 proper                                                                                                                                                                                |
| `wphase` HUD boundaries                                     | Already sourced from `WARP_ACCEL_END/DECEL_START` (D3.1) — moves automatically                                                                                                                                                          |
| `NEBULA_REVEAL.decelStart` = 0.53 literal (nebula-field.ts) | **Hidden 4th consumer** — must re-key to 0.56 (import or mirror the constant) or the gas reveals mid-flip                                                                                                                               |
| Chase waypoints (k-keyed)                                   | Valid unchanged; the 0.55 row now sits inside the flip window — the camera drifts _slowly_ through its pan during the dilated window, which is the "camera eases a few degrees" behaviour §3.2 asks for. Vega's call on nudging the row |
| Frame-ladder fades (out ≤ 0.35, in ≥ 0.6)                   | Outside the window on both sides — unaffected                                                                                                                                                                                           |
| `warpEase` unit pins                                        | Shape-generic pins (endpoints, s(0.5)=0.5, monotone, ease-in/out inequalities) survive v4 by symmetry; exact-value pins are named changes (#15)                                                                                         |
| Legacy engine                                               | Untouched (rollback lever, ADR-0006) — divergence documented in the D3.2 TR                                                                                                                                                             |

**Plume/RCS seam (design note for the SHOT-BRIEF):** the plume phase functions are hard
booleans today (`burning`/`coasting` snap: alpha 0.9→0.15, throttle 0.85→0.06 in one frame).
D3.2 adds an eased **burn envelope** scalar threaded through `PlumeParams` **additively** (new
optional field; absent = current boolean behaviour, so existing pins hold) — cutoff falls over
Astra's ~0.3 s at flip start, relight rises ~0.3 s after `KD`, and the relight direction is
automatic (the hull has flipped; the plume is hull-attached). RCS puffs reuse the ember
buffer (`MAX_EMBERS` 48, one mesh) — Vega specs count/velocity/timing; if ember coloring
(diesel-orange) reads wrong for cold-gas puffs, a tint parameter is the fallback, weighed at
IMPLEMENT against #1's bundle discipline.

## Options considered and rejected

1. **Impl-plan global stretch (`warpDur → 12,500 ms`)** — rejected: 3–9× journey inflation,
   destroys travel pacing, breaks dozens of E2E timing budgets, contradicts L15.
2. **k-dilation without profile change** — rejected: 1/r world-velocity lurch at both window
   edges; an engine-off coast that visibly brakes is BROKEN PHYSICS-adjacent and the exact cue
   contradiction D3 exists to remove.
3. **Wall-clock flip decoupled from k** (hull rotation on its own ≥1.5 s timer) — rejected: at
   current durations the decel burn relights while the hull is still rotating — thrust through
   a rotating hull is off-axis nonsense, and the choreography's whole point is cut → rotate →
   relight in order.
4. **Trapezoid + rate multiplier (chosen)** — the only option that is simultaneously: honest
   physics (constant-velocity coast, §3.2), exact floor, world-velocity continuous, fixed
   k-thresholds (small blast radius), and pure/unit-testable.
