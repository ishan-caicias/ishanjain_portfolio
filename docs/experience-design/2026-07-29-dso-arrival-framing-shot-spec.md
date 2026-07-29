# DSO Arrival Framing — SHOT-BRIEF

**Author:** Vega (cinematographer / motion designer), for Procyon
**Date:** 2026-07-29
**Mode:** SHOT-BRIEF (feeds a P0 defect fix; a MOTION-AUDIT should follow the build)
**Class:** P0 defect — owner-reported: _"if I click on Orion nebula and travel, the ship travels
past it and then stops way past it. This happens with almost all travellable DSOs. The spaceship
should warp and arrival needs to be precise so it ends up exactly next to the DSO."_

**Continuous with:**
[D3.1 deceleration-legibility SHOT-BRIEF](2026-07-24-pf11-d3.1-deceleration-legibility-motion-spec.md)
(the braking cue stack this arrival is the end of) ·
[D3.2 flip-choreography SHOT-BRIEF](2026-07-24-pf11-d3.2-flip-choreography-motion-spec.md)
(the `decelStart = 0.56` coupling) ·
[D1.3 ascent MOTION-SPEC](2026-07-23-pf11-d1.3-ascent-motion-spec.md)
(why `ARRIVE_STANDOFF` is untouchable) ·
[TR-103](../test-reports/TR-103.md) (the planet-class standoff precedent, and the zoom feature
whose bounds this brief reuses).

---

## 1. What this shot must communicate

**"We have stopped, and _that_ is the thing we came to see."**

An arrival is a reveal, and a reveal has exactly one requirement: the subject must be legible as
an object, with the frame around it. Everything else about the arrival shot — aim, standoff,
zoom bounds, the gas reveal ramp — serves that one sentence.

The current build fails it in the most complete way available: for the eleven nebulae that ship a
raymarched gas volume, the ship does not arrive _at_ the subject, it arrives _inside_ it. There is
no subject in frame because the subject is the frame. The owner reads that as "travelled past it
and stopped way past it," which is exactly right — a viewer with no silhouette to fix on has no
way to tell "inside" from "beyond," and the brain picks the more familiar of the two.

## 2. The defect, measured

`travelTo` (`babylon-engine.ts` ~6534) parks the camera at `body.pos − dir × standoff`, with
`standoff` chosen from exactly two constants in `ship-dynamics.ts`:

| Constant                 | Value | Applied to                                               |
| ------------------------ | ----- | -------------------------------------------------------- |
| `ARRIVE_STANDOFF`        | 38    | stars, **all DSOs**, stations, `fs-` field objects, home |
| `PLANET_ARRIVE_STANDOFF` | 80    | `t === "planet" \| "moon" \| "dwarf"` only (TR-103)      |

Meanwhile every shipped nebula volume has world-space radius `R = depth × NEBULA_RADIUS_FACTOR`
(`nebula-field.ts`, factor `0.14`), with `depth = 150 + 128·log₁₀(ly + 1.5)`. For the eleven
shipped volumes `R` runs **71.5 – 91.4 world units**. The ship parks at **38**.

**So the camera comes to rest at 0.42 – 0.53 R from the volume centre** — past the near wall, past
`shellInner = 0.55` (where the radial falloff even begins), sitting in the full-density core.

Approach profile for Orion (M42, `ly = 1344`, `depth = 550.5`, `R = 77.1`), computed from
`warpEaseV4` with the real v4 rate (`warpDur = 3590 ms`, flip rate `r = 0.287`, ≈ 4.66 s screen
time), distance expressed in volume radii:

| k    | path covered | distance from centre | gas rim subtends | frame height | reveal |
| ---- | ------------ | -------------------- | ---------------- | ------------ | ------ |
| 0.56 | 74.4 %       | 160 (2.07 R)         | 57.7°            | 1.30×        | 0.00   |
| 0.70 | 88.1 %       | 95 (1.23 R)          | 109.2°           | 3.33×        | 0.17   |
| 0.85 | 97.0 %       | 52 (**0.68 R**)      | — _inside_       | —            | 0.51   |
| 1.00 | 100 %        | 38 (**0.49 R**)      | — _inside_       | —            | 0.70   |

Three separate defects fall out of that one table, and they compound:

1. **The subject has no silhouette from k ≈ 0.72 onward.** By the time the gas is bright enough
   to notice (reveal ≈ 0.17), it already overflows the frame 3.3×. It never reads as an object at
   any point in the journey — it goes straight from invisible to ambient.
2. **The reveal is inverted against the geometry.** The gas reaches its _brightest_ (reveal 0.7,
   swelling to 1.0) exactly when the camera is deepest inside the core, which is the one place the
   volume carries no shape information.
3. **The closure cue lies.** D3.1's whole braking design rests on "nothing in the frame may grow
   toward the camera faster than it did while cruising." The nebula rim grows from 58° to
   _enveloping_ across the braking phase. That is the textbook **CONTRADICTS** class, and it is
   the largest instance of it left in the scene — larger than the chase-loom D3.1 fixed.

The eleven volumes and the ids they attach to (all verified present in the catalogs —
`celestial-catalog.js`, `celestial-extra.js`, `celestial-ngc2000.js`; none orphaned):

`m42` · `ngc7293` · `veil` · `rosette` · `ngc6543` · `ngc6302` · `ngc6514` · `m57` · `m1` ·
`ngc2000-box-nebula` · `ngc2000-hourglass-nebula`.

> **Data note.** The radius supplied to me for `ngc2000-box-nebula` (85.6) does not match the
> shipped source: `nebula-field.ts` gives it `ly = 8515.82` → `depth = 653.1` → **`R = 91.4`**. The
> table in §3.1 uses values recomputed from the shipped `ly`. This is one more reason the standoff
> must be **derived from `volume.radius` at runtime, never typed in per body.**

## 3. Framing rule for volumetric nebulae

### 3.1 The rule

```
NEBULA_ARRIVE_K = 3.5
standoff(volumetric DSO) = max(ARRIVE_STANDOFF, NEBULA_ARRIVE_K × volume.radius)
```

The `max` is a cheap invariant, not a live case: the smallest shipped `R` is 71.5, so
`3.5 R = 250` and the floor never binds today. It exists so a future small volume can never
produce a standoff that puts the camera behind the old one.

**What that frames** (camera base FOV `0.8 rad = 45.84°`; "frame height" = fraction of the
vertical frame the feature occupies, `tan(θ/2) / tan(fov/2)`):

| Feature                               | Radius  | Subtends at 3.5 R | Frame height |
| ------------------------------------- | ------- | ----------------- | ------------ |
| Geometric rim (the raymarch bound)    | 1.00 R  | **33.2°**         | **0.71**     |
| Visible edge (where the gas dies out) | ≈0.80 R | 26.4°             | 0.56         |
| Solid body (inside `shellInner`)      | 0.55 R  | 18.1°             | 0.38         |

("Visible edge ≈ 0.8 R" is derived, not asserted: at `q = 0.8` the density threshold has risen to
`0.32 + 0.3·0.8² = 0.512` _and_ the shell term has fallen to 0.42; by `q = 0.9` the shell term is
0.13 and the gas is effectively gone. The geometric rim is a bound, not an edge.)

**Per-volume standoffs** (all derived, nothing hand-set):

| id                         | ly      | depth | R    | standoff (3.5 R) | camera \|pos\| |
| -------------------------- | ------- | ----- | ---- | ---------------- | -------------- |
| `ngc7293` (Helix)          | 655     | 510.6 | 71.5 | **250**          | 260            |
| `m42` (Orion)              | 1344    | 550.5 | 77.1 | **270**          | 281            |
| `m57` (Ring)               | 2280    | 579.9 | 81.2 | **284**          | 296            |
| `veil` (Cygnus Loop)       | 2400    | 582.7 | 81.6 | **286**          | 297            |
| `ngc6543` (Cat's Eye)      | 3300    | 600.4 | 84.1 | **294**          | 306            |
| `ngc6302` (Butterfly)      | 3400    | 602.1 | 84.3 | **295**          | 307            |
| `ngc6514` (Trifid)         | 4100    | 612.5 | 85.7 | **300**          | 312            |
| `rosette`                  | 5200    | 625.7 | 87.6 | **307**          | 319            |
| `m1` (Crab)                | 6500    | 638.1 | 89.3 | **313**          | 325            |
| `ngc2000-hourglass-nebula` | 8000    | 649.6 | 90.9 | **318**          | 331            |
| `ngc2000-box-nebula`       | 8515.82 | 653.1 | 91.4 | **320**          | 333            |

### 3.2 Why 3.5, and why not the planet's 3.08

The planet precedent is `PLANET_ARRIVE_STANDOFF / PLANET_SPHERE_RADIUS = 80 / 26 = 3.08 ×`,
subtending 37.9°. The question the task poses is the right one: does a diffuse gas cloud read the
same as a solid lit sphere? **No — it wants more space, for four reasons, and one of them is a hard
constraint rather than a preference.**

1. **Soft edges lose their objecthood at the frame boundary.** A hard-edged sphere reads as an
   object at almost any frame share, because the silhouette does the work — the eye finds the edge
   instantly even if it touches the frame. A volumetric cloud has no edge, only a falloff, and the
   falloff _is_ the information. If the outer fringes reach the frame boundary, the brain stops
   parsing "cloud with an outside" and starts parsing "atmosphere I am in" — which is precisely the
   perceptual failure the current 38 produces in its extreme form. The gas must visibly _end_
   against sky, all the way round, or the fix is only partial.
2. **The starfield ring is the only scale reference in the shot.** PF-11 is titled _scale
   honesty_. A nebula has no familiar size, no lit limb, no terminator; the one thing that tells
   the visitor how big it is, is how much sky it does not cover. The planet does not need this
   (a lit sphere with a terminator is self-scaling), so it can afford 0.81 of frame height. The
   nebula cannot.
3. **The volume is additive emission and it swells to reveal 1.0 at rest.** Solid angle covered
   scales as the square of apparent radius: at 3.08 R the gas covers ~29 % more of the frame than
   at 3.5 R. That difference is bright additive colour sitting underneath the ArrivalVista dossier
   and the HUD for as long as the visitor stays. Backing off is the cheapest legibility win
   available for the overlay text on top of it.
4. **Hard constraint — the zoom floor.** TR-103 gave point-like targets a _multiplicative_ zoom
   floor, `ZOOM_MIN_MULT = 0.3 × restDist`. That is a fine policy while the target has no physical
   extent; a volumetric nebula has one. The floor lands inside the gas unless
   **`k ≥ 1 / ZOOM_MIN_MULT = 3.333`**. At `k = 3.5` the closest the visitor can zoom is
   **`0.3 × 3.5 R = 1.05 R`** — just outside the near wall, frame completely filled with gas, still
   outside it. This is the number that makes 3.5 the right answer rather than a taste call: it is
   the smallest sensible `k` that keeps the _entire zoom range_ outside the volume, with a 5 %
   margin. **Do not add a new floor policy for this** — the existing one is already correct once
   `k` clears 3.33.

**Zoom range at `k = 3.5`, for the record:**

| Zoom        | Distance | Rim subtends | Frame height | Reads as                           |
| ----------- | -------- | ------------ | ------------ | ---------------------------------- |
| 0.3× (min)  | 1.05 R   | 144.5°       | 7.4×         | pressed against the near wall      |
| 1.0× (rest) | 3.50 R   | 33.2°        | 0.71         | **the arrival framing**            |
| 3.0× (max)  | 10.50 R  | 10.9°        | 0.23         | the cloud in its starfield context |

That is a genuinely good zoom range — a deliberate "fly up to the gas" at one end and a wide
context shot at the other — and it comes for free from the existing constants.

### 3.3 An additive correction to TR-103's stated rationale

TR-103 justified `PLANET_ARRIVE_STANDOFF = 80` as producing `2·asin(26/80) ≈ 37.7°`, "roughly half
the FOV." **That comparison is against `SHIP_BASE_FOV = 70°`, which is never assigned to the
camera** — it is used only for ship-mesh scale math. The scene camera runs at Babylon's default
`fov = 0.8 rad = 45.84°`; this is the same integration trap the D3.1 brief flagged in §4 and
TR-103 did not carry across. At the real camera FOV, a planet at 80 units fills **~0.81 of frame
height**, not half of it.

I am recording this rather than editing it, per this repo's additive-corrections rule. Two
consequences:

- The shipped `80` is still defensible — 0.81 of frame height for a hard-edged, self-scaling,
  detail-rewarding sphere is a legitimate hero framing, and it is a large improvement on the 86.3°
  overflow it replaced. Nothing here asks for it to change.
- But it means my nebula `k` is calibrated against a precedent that is closer than its own
  documentation claims. If owner eyes report Mars/Earth reading too large at rest, revisit the
  planet standoff in its own slice — **and if that happens, `NEBULA_ARRIVE_K` does not follow it
  downward**, because the 3.33 zoom-floor constraint binds it from below regardless.

### 3.4 Non-spherical volumes get the same `k`

Four volumes (`ngc6543`, `ngc6514`, the box, the hourglass) use SDF shapes that occupy well under
their bounding sphere. They will read smaller at 3.5 R than the spherical ones. **That is correct
and deliberate:** the shape _is_ the subject for those bodies, per-shape occupancy is not computed
anywhere in the engine, and the bounding sphere is what the raymarch already treats as the volume.
A shaped nebula sitting in a generous frame is the shot. Note the two most strongly shaped ones
(box, hourglass) also carry `img: null` — no photo billboard — so they get the frame entirely to
themselves.

If owner eyes say the hourglass reads too small, the honest lever is a per-volume `frameRadius`
override in `NEBULA_SOURCES`, **not** a change to `NEBULA_ARRIVE_K`. Do not add it speculatively.

## 4. Non-volumetric DSOs — 38 is correct, do not touch it

**Verdict: no change. Galaxies, clusters, volume-less nebulae, stars and `fs-` field objects keep
`ARRIVE_STANDOFF = 38`.** This is not "out of scope," it is the right answer, and the reason
generalises into the rule that should govern every future body class.

A body with no shipped volume renders as a **photographic billboard whose size is specified in
screen pixels, not world units** (`celestial-bodies.ts`, `PHOTO_BODY_VERTEX_*`):

```
px = clamp((10 + sizeBoost·0.05) · 240 / max(dist, 14), 12, 130) · rarityTypeBoost
```

Two things follow, and they invert the entire logic of §3:

- **Moving the camera back strictly shrinks the subject, with no compensating gain.** There is no
  near wall to clear, no volume to be swallowed by, and no world-space silhouette to fit in frame.
  A larger standoff for these bodies would be pure loss.
- **The 130-px pre-boost clamp means 38 is already at the saturation point.** For a legendary DSO
  (`sizeBoost = 235`), the clamp engages at `dist ≤ 40.2`. Arriving at 38 puts the billboard at its
  maximum possible size; arriving at 25 would look identical. The current constant is sitting, by
  accident or by inheritance from `space-engine.js`, exactly where it should be.

**The principle, stated so it survives the next body class:**

> The arrival standoff is a function of how the target's size is _specified_.
> **World-space extent** (planet sphere, nebula volume) → standoff is a multiple of that extent.
> **Screen-space extent** (photo billboard, point sprite, procedural beacon) → standoff is the
> fixed `ARRIVE_STANDOFF`, because distance does not change the subject's size.

### ⚠ The implementation trap this creates

**The branch must key on "this body has a shipped volume", NOT on `t === "nebula"`.** The catalogs
carry far more nebulae than the eleven with volumes (27 in `celestial-catalog.js` alone, plus
`celestial-extra.js` and `celestial-ngc2000.js`). Typing the branch on `"nebula"` would fling every
volume-less nebula out to 250–320 units, where its billboard shrinks from ~354 px to ~50 px and the
arrival lands on a speck. The predicate is `NEBULA_VOLUMES.find(v => v.id === id)`, and the standoff
is computed from that volume's own `radius`.

## 5. Does the reveal envelope need re-keying?

**Partly. `decelStart` stays at 0.56. The tail moves.**

### 5.1 `decelStart = 0.56` must not move — in either direction

- **Earlier is forbidden.** D3.2/ADR-0011 re-keyed it 0.53 → 0.56 precisely so the gas cannot start
  appearing while the hull is still mid-rotation. It is a fourth consumer of the warp-phase
  thresholds and it is coupled on purpose.
- **Later is unnecessary**, and I checked the thing that would have argued for it. The retro relight
  also fires at k = 0.56 with a ~0.3 s shoulder (k ≈ 0.56 → 0.64 on the M42 journey), so on paper
  the gas onset and the relight collide — a staging violation. They do not collide in practice,
  because `nebulaRevealTarget` ramps through `smooth01`, whose slope is **zero** at t = 0: reveal is
  still under 0.05 at k = 0.63 and does not become perceptible until k ≈ 0.70. The smoothstep is
  already performing the stagger. **Keep it.** Replacing that ramp with a linear or ease-out curve
  would put the gas onset on top of the relight and would be a real regression — flagging it because
  "make the reveal snappier" is exactly the kind of tuning that looks harmless.

### 5.2 The tail does need re-keying

New approach profile at `standoff = 3.5 R` (M42; the other ten are within ±2 % of these, since the
geometry is scale-invariant once expressed in R):

| k    | distance from centre | rim subtends | frame height | reveal |
| ---- | -------------------- | ------------ | ------------ | ------ |
| 0.56 | 4.31 R               | 26.8°        | 0.56         | 0.00   |
| 0.70 | 3.88 R               | 29.9°        | 0.63         | 0.17   |
| 0.85 | 3.59 R               | 32.3°        | 0.69         | 0.51   |
| 1.00 | 3.50 R               | 33.2°        | 0.71         | 0.70   |

Two changes, both value-only:

```
NEBULA_REVEAL.decelMax     : 0.7 → 0.85
NEBULA_REVEAL.arriveSwellS : 1.8 → 1.2
```

**Why.** Under the old geometry the post-arrival swell happened while the camera sat inside the
core, where reveal is a brightness knob on an already-saturated frame — a bloom, essentially
invisible as a size change. Under the new geometry the cloud is a discrete object in frame, and
`marchNebula`'s own doc comment states the consequence: low reveal "both dims the gas **and shrinks
its apparent extent** (thin fringes drop below visibility first) — reads as the cloud growing in."
So the swell is now a **visible growth** of the subject that continues for 1.8 s _after the ship has
come to rest_, underneath the ArrivalVista dossier animating in. That is two important motions at
once, and worse, an object still growing after the ship stops mildly contradicts "we are at rest."

At `decelMax = 0.85` the cloud is essentially at final size and brightness the instant the ship
stops, and the residual 15 % settles over 1.2 s as follow-through rather than as a second event.

**Do not take `decelMax` to 1.0.** Some settle must remain — an arrival with zero follow-through is
a hard stop, and the "swells to full strength once the ship stops" behaviour is owner-directed
(ADR-0004 amendment). Reducing its amplitude honours the intent; deleting it does not.

The C¹ break at the arrival instant survives and should: reveal slope is 0 approaching k = 1
(smoothstep) and `3(1−decelMax)/arriveSwellS = 0.375/s` leaving it. That onset is the arrival's
punctuation. It is currently 0.5/s; 0.375/s is the gentler, correct version now that the subject is
in frame rather than around the camera.

### 5.3 Considered and rejected: keying the reveal to distance instead of k

Tempting — a distance-keyed reveal (`f(dist/R)`) would be scale-honest and identical for every
volume regardless of journey length. Rejected for this slice: it decouples the gas from the flip
window that D3.2 deliberately coupled it to, and it would make short and long journeys reveal at
different points in the choreography, which is the opposite of the cue-agreement discipline D3
established. Recording it as a considered option, not a follow-up.

## 6. Continuity with D3.1 / D3.2 — what breaks and what does not

**The chase settle does not break.** `chaseOffsetAt(k)` returns an offset in the ship-relative
travel frame (`[right, up, back]`, back 3.0 → 5.8 → 3.4 → 3.0). It positions the camera relative to
the _ship_, not relative to the destination. Changing where the journey ends changes the endpoint,
not the settle. The `chaseOffsetAt(1) === [0, 0, SHIP_VIEW_DEPTH]` invariant and its test are
untouched. ✓

If anything the settle becomes _more_ legible: the final approach now covers ~62 world units
instead of ~122 (M42), so the 2.8 units of chase-settle motion are 4.5 % of the residual approach
instead of 2.3 % — the designed braking cue gets proportionally larger against a quieter background.

**Three real consequences, none of them blockers:**

| #   | Consequence                                                                                                                                                                                                                     | Verdict                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **Path length halves.** M42's `D_total` falls 474 → 243 while `warpDurationForLy` is unchanged (3590 ms; it reads `ly`, not distance). World velocity therefore halves for these eleven targets.                                | **Acceptable, and honest.** β, the FOV breath and the HUD all read `warpSpeedNorm` (normalized) and are unchanged. Star streaks read real frame-to-frame camera displacement (D3.1 §5) and will be ~half as long. That is not a new contradiction — the normalized cues have always been identical for a 2.7 s home hop and a 5 s deep run — but it _is_ a visible change: the M42 run will read as a calmer journey. **Owner-eyes item.**         |
| 2   | **The closure cue weakens a lot.** The old approach grew the gas from 58° to enveloping and the photo billboard from 42 px to 575 px (13.7×). The new one grows the rim 26.8° → 33.2° (1.24×) and the photo 42 px → 86 px (2×). | **This is the price of the fix, and it must be paid.** The looming _was_ the defect. The arrival is now carried by the reveal ramp (which supplies real apparent growth via the fringe effect, §5.2) plus D3.1's two unchanged carriers — the chase pull-back/settle and the FOV relax. Note the reveal ramp is thereby **promoted from gas-visibility management to a third deceleration cue**; treat it as part of the D3 cue stack from now on. |
| 3   | **Every nebula already subtends ~16° from home** (that is exactly what `NEBULA_RADIUS_FACTOR` is tuned for). The journey now takes it 16° → 33°, a 2× growth.                                                                   | Stated so nobody later "discovers" it as a bug. A nebula's angular-growth cue is inherently weak in this scene; that is a property of the log-depth placement, not of this change.                                                                                                                                                                                                                                                                 |

**If owner eyes say the arrival lacks impact, the tuning knob is `decelMax`/`arriveSwellS` shaping —
never the standoff.** Going back in is the defect.

**Plumbing continuity** (Procyon's, listed so nothing is missed): `travelTo` already computes a
single local `standoff`; TR-102's arrival aim block and TR-103's `_camBearing` / `_parkedTargetPos`
/ `_zoomRestDist` all consume it downstream. If the new branch lands in the same expression, zoom
bounds and arrival aim follow automatically. `_zoomIsPlanet` stays **false** for nebulae — §3.2's
whole argument is that the existing multiplicative floor is the correct policy here.

## 7. Reduced motion & tiers

- **The standoff is a framing constant, not an animation.** It applies identically under
  `prefers-reduced-motion`. This is the per-feature contract, not a tier: reduced-motion visitors
  get the same _composition_, they just do not get the journey to it.
- **Reduced motion is a straight improvement here, with no change required.** `_updateNebulaReveal`
  snaps (`arrivedIdx === i ? 1 : 0`) and the reduced-motion journey is an instant swap. Today that
  means a reduced-motion visitor is teleported into the middle of a full-density cloud with no
  journey to explain it — the defect in its purest form. After the fix they are teleported to a
  correctly framed 33° nebula. Nothing in the reduced-motion path needs re-specifying.
- **Separable refinement, recommended but not required:** under reduced motion the gas currently
  goes 0 → 1 in a single frame, which is a large additive luminance step across ~71 % of frame
  height. A ≤ 200 ms **opacity-only** fade is explicitly inside this repo's reduced-motion
  convention (no parallax, no zoom, no rotation, no scale sweep — just alpha) and would remove a
  flash without reintroducing motion. Marked separable because it changes reduced-motion behaviour
  and therefore wants its own test; do not fold it into the P0 fix silently.
- **Tiers:** unchanged everywhere. The standoff is one number in a branch. The raymarch step count
  is fixed per volume segment (`stepsCompute = 40` / `stepsFragment = 18`) and the segment is
  bounded by `raySphere`, so image quality at 3.5 R is identical to quality at 0.49 R.

## 8. Frame budget & envelope

- **Cost: negative.** This is that rare fix that buys frame budget. The nebula raymarch is
  per-pixel over the volume's screen coverage; the volume drops from filling the frame (and beyond)
  to ~0.71 of frame height, so the number of rays that hit the volume at rest falls by roughly half.
  The half-res offscreen pass (`NEBULA_TEX_SCALE = 0.5`) is bandwidth/ALU-bound, so that is a real
  saving on exactly the tier that needs it. **Procyon should confirm rather than take my word.**
- **`raySphere` already handles the camera being inside** (`tA = max(hit[0], 0)`), so nothing about
  the current behaviour is a rendering error — it is purely a framing error. No shader change is
  implied by this brief. No new sampler, no new pass, no new uniform. (CLAUDE.md shader rules 4–9
  are not engaged by this change; say so explicitly in the TR.)
- **Astra ledger:** no new entry expected. Arrival standoff is a framing/lens decision inside the
  standing "cinematic flight-feel" license that already covers the damped-spring chase and the
  planet standoff. The change makes the shot _more_ scale-honest, not less — the visitor can now see
  how big the cloud is against the sky. Flagged for Astra to confirm or ledger in the next
  REALISM-AUDIT.

## 9. Flags — things I would not do, and things that need owner eyes

**Would not do (each of these is a plausible next idea that is wrong):**

1. **Do not change `ARRIVE_STANDOFF`.** It is simultaneously `ASCENT_END_STANDOFF` and
   `HOME_ORBIT_RADIUS`, both asserted equal to it by live unit tests. Retuning it silently retunes
   the launch cinematic and the home orbit. This is the same trap TR-103 documented; a third
   constant is the answer, again.
2. **Do not type the branch on `t === "nebula"`.** See §4's trap box. Key on volume presence.
3. **Do not hand-write per-body standoffs.** One `k`, times `volume.radius`. The brief I was handed
   already contained one wrong radius (§2); a table of eleven literals would embed it.
4. **Do not widen the FOV to fit the cloud.** Beyond ~6 % a FOV change reads as a lens change, not
   a framing change — the ceiling D3.1 set and TR-103 respected for zoom. Distance is the only
   correct control.
5. **Do not shrink `NEBULA_RADIUS_FACTOR` to make 38 work.** The 0.14 factor is what holds every
   nebula at ~16° from home; it is a scale-honesty property, not a framing knob.
6. **Do not special-case the arrival camera for nebulae** (no cut, no ship fade, no orbit). Arrival
   grammar consistency across body classes is worth more than any one shot.

**Needs owner eyes — I cannot judge these on paper:**

- **The headline: does 33.2° / 0.71 frame height read as "next to the Orion Nebula"?** This is the
  whole brief. If it reads small, the band 3.35–3.5 is available (3.35 is the hard zoom-floor
  limit). If it reads large, 3.75–4.0 is available. I would not move it before seeing it.
- **The photo billboard double-representation.** M42 renders a photographic billboard _and_ a
  volumetric cloud at the same point. At 38 the photo was ~575 device px and dominated; at 270 it
  is ~86 px, sitting at the centre of the gas. My expectation is that it now reads as the bright
  core and this is an improvement — but it might equally read as a small wrong-looking sprite pasted
  in the middle. **Cheap reversible fix if so:** cross-fade the photo billboard out as `reveal`
  rises, for bodies that have a volume. Do not build it pre-emptively.
- **Journey pacing after the path halves** (§6, consequence 1). Does the M42 run still feel like a
  long haul with half the world displacement in the same 4.7 s? If not, the honest lever is
  `warpDurationForLy`, and I would advise against touching it — duration is keyed to `ly` on purpose
  so distance communicates.
- **Whether the shaped volumes (hourglass, box, Cat's Eye, Trifid) read too small** at the shared
  `k` (§3.4).

**Pre-existing, out of scope, flagged so it is on the record:** billboard size is specified in
**device pixels** (`uViewport` = `engine.getRenderWidth/Height()`), so a DSO's share of the frame
varies by 2–3× across DPR — a legendary DSO fills ~50 % of frame height on a DPR-1 desktop and
~22 % on a DPR-3 phone. Nothing in this brief causes or worsens it, and the volumetric framing in
§3 is immune to it (world units, not pixels). Worth its own slice.

## 10. Constant appendix (ready to implement)

```ts
// ship-dynamics.ts — next to ARRIVE_STANDOFF / PLANET_ARRIVE_STANDOFF.
//
// Volumetric-DSO arrival standoff, as a multiple of the volume's own radius.
// 3.5 puts the geometric rim at 2*asin(1/3.5) = 33.2deg -- 0.71 of frame height at
// the camera's real 0.8 rad FOV -- with the visible edge (~0.8R) at 26.4deg. Larger
// than the planet's 3.08x on purpose: a soft-edged additive volume needs sky all the
// way round it to read as an object rather than as atmosphere, and the starfield ring
// is the only scale reference the shot has. HARD LOWER BOUND 1/ZOOM_MIN_MULT = 3.333 --
// below that the existing multiplicative zoom floor lands INSIDE the gas. At 3.5 the
// closest zoom is 0.3*3.5R = 1.05R, just outside the near wall.
export const NEBULA_ARRIVE_K = 3.5;

// babylon-engine.ts, travelTo -- replace the two-way standoff choice with three ways.
// NOTE: keyed on "has a shipped volume", NOT on b.e.t === "nebula" (the catalogs carry
// many more nebulae than the 11 shipped volumes; typing on "nebula" would fling every
// volume-less one out to ~300 units where its billboard is a speck).
const vol = NEBULA_VOLUMES.find((v) => v.id === b.e.id);
const standoff = vol
  ? Math.max(ARRIVE_STANDOFF, NEBULA_ARRIVE_K * vol.radius)
  : b.e.t === "planet" || b.e.t === "moon" || b.e.t === "dwarf"
    ? PLANET_ARRIVE_STANDOFF
    : ARRIVE_STANDOFF;
// _zoomIsPlanet stays false for volumetric DSOs: the multiplicative floor is correct.

// nebula-field.ts -- NEBULA_REVEAL, two value changes, decelStart UNCHANGED:
decelStart:   0.56,   // unchanged -- coupled to the D3.2 flip window (ADR-0011)
decelMax:     0.85,   // was 0.7  -- gas essentially complete at the instant of rest
arriveSwellS: 1.2,    // was 1.8  -- residual settle reads as follow-through, not a 2nd event
```

**Test impact, so it can be stated honestly in the TR:** `tests/unit/nebula-field.test.ts`
references `NEBULA_REVEAL.decelMax` / `.arriveSwellS` **symbolically**, not as literals, so the
value changes require no test edits and nothing is loosened (CLAUDE.md testing rule 15 satisfied).
The new unit surface worth adding: `NEBULA_ARRIVE_K ≥ 1 / ZOOM_MIN_MULT` (the §3.2 constraint,
re-derived rather than restated), and `3.5 × min(volume radius) > ARRIVE_STANDOFF` so the `max`
guard is proven inert today. E2E: an M42 arrival parks measurably farther than a Sirius arrival
_and_ farther than `volume.radius` — the machine-checkable half of "outside the cloud."

**Continuity classes:** the standoff is a constant, not a curve — C^inf trivially. The reveal ramp
keeps `smooth01` (C¹, zero slope at both ends of the k-window) and the post-arrival cubic ease-out;
the deliberate C¹ break at k = 1 survives at reduced amplitude as the arrival's punctuation.

## 11. Owner-eyes checklist (the preview must show these — E2E cannot judge them)

Build fresh (`npm run build && npm run preview`; a stale `dist/` silently tests old code — TR-103
lost a run to exactly this). Travel to **M42**, then **`ngc2000-hourglass-nebula`** (shaped, no
photo billboard), then one **volume-less DSO** (any galaxy) as the control:

1. **The ship stops outside the cloud.** The nebula is an object in front of you with sky visible
   all the way around it. This is the defect gone, and it is binary — no judgement needed.
2. **The cloud sits comfortably inside the frame**, roughly two-thirds of the frame height, with a
   ring of stars around it. Not touching the edges; not a distant blob.
3. **The last quarter of the journey reads as arriving, not as fading up.** The gas should become
   perceptible around 70 % of the way in and grow/brighten into place — the growth should feel
   continuous with the approach, not like a dissolve laid over a static object.
4. **Nothing important moves after the ship stops.** With `decelMax = 0.85` the cloud should be
   essentially complete at rest, with only a quiet settle underneath the dossier appearing. If the
   gas is visibly still swelling while you read the dossier, `decelMax` needs to go higher.
5. **No collision between the retro relight and the gas onset.** At the moment the plume relights
   retrograde, the destination should still be dark; the gas should arrive a beat later.
6. **Zoom bounds behave.** Wheel all the way in — you should end up pressed against the near wall of
   the cloud, filling the frame, but **never inside it**. Wheel all the way out — the cloud should
   sit small in a wide starfield. Zoom must not change orientation (TR-103's invariant).
7. **The control body is unchanged.** The galaxy arrival should look exactly as it did before this
   slice. If it moved, the branch was typed on `"nebula"` instead of on volume presence.
8. **Reduced motion:** enable it, travel to M42 — you should land on the same composition
   instantly, with the gas present and correctly framed. Note whether the single-frame appearance
   of the gas reads as a flash (that is the §7 separable refinement's trigger).
9. **The photo billboard question** (§9): at M42, is the photographic sprite at the cloud's centre
   reading as a bright core, or as a pasted-on sprite?

---

_Vega does not write production code; this brief is the design, Procyon owns the implementation and
the gate. Corrections to this document are appended and dated, never edited away._
