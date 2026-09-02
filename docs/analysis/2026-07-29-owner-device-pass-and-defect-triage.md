# Owner real-device pass + 7-item defect triage

**Date:** 2026-07-29
**Source:** owner-run real-device measurement and hands-on pass, immediately after
[TR-114](../test-reports/TR-114.md) closed PF-11 D8.
**Status:** TRIAGE — root causes established from code, fixes NOT yet implemented.

This is the pass the whole project has been deferring to (ADR-0008 "ship first, measure
after"; D0.3). It found more in one sitting than the last three automated gates combined,
which is the point — and is worth recording as evidence for how the remaining gaps get closed.

---

## Part 1 — The device readings

| Device           | Backend    | Tier | startup | RenderFPS | host rAF / displayHz | device line                           |
| ---------------- | ---------- | ---- | ------- | --------- | -------------------- | ------------------------------------- |
| Desktop          | **WebGPU** | mid  | 431 ms  | 52        | 37 / 42 Hz           | `windows · 1829x1029 · dpr1.05 · 16c` |
| Galaxy S24 Ultra | **WebGL**  | low  | 1515 ms | 31        | 31 / 61 Hz           | `windows · 384x832 · dpr2.8125 · 8c`  |
| Galaxy S20 FE    | **WebGL**  | low  | 5231 ms | 27        | 27 / 33 Hz           | `windows · 360x800 · dpr3 · 8c`       |

Against the standing budgets (60 fps desktop · ≥40 fps mid-Android · startup ≤2.5–4.0 s):
**desktop misses fps, both phones miss fps, and the S20 FE misses startup by 1.2 s.**

### 1a. FINDING (high confidence): the phones almost certainly fell back to WebGL because the preview was served over plain HTTP

`createEngine` (`src/lib/babylon-engine.ts:1481-1538`) probes `navigator.gpu` before
constructing the WebGPU engine and falls back **silently** if it is absent:

```ts
const gpu = (navigator as Navigator & { gpu?: {...} }).gpu;
let adapter: unknown = null;
if (gpu) { try { adapter = await gpu.requestAdapter(); } catch { adapter = null; } }
if (adapter) { /* WebGPU */ }
return { engine: new Engine(canvas, ...), backend: "webgl2" };   // no log, no event
```

**`navigator.gpu` is only exposed in a secure context.** `http://localhost` is treated as
secure by every browser; `http://192.168.x.x` is **not**. The measurement command used was
`npm run preview -- --host`, which serves plain HTTP on the LAN — so the desktop (localhost)
kept WebGPU and both phones (LAN IP) never had `navigator.gpu` at all.

**This is a measurement-setup defect, not a device capability finding**, and it originated in
this project's own guidance — the LAN-preview instruction given to the owner did not mention
the secure-context requirement. Recorded here rather than quietly corrected.

Consequence: **the two Android rows measure the WebGL2 fallback path, not the shipping path.**
They are valid data about the fallback (which is genuinely worth having — ≥30 fps is that
path's own budget, and 31/27 straddles it) but they say nothing about WebGPU on those devices.

To re-measure the real path, any of: an HTTPS tunnel (`cloudflared tunnel --url http://localhost:4322`),
the Netlify deploy preview, or Chrome's
`chrome://flags/#unsafely-treat-insecure-origin-as-secure` with the LAN origin added.

### 1b. FINDING: `navigator.gpu` absence is invisible — three ways

1. No console output on the `!gpu` and `adapter === null` paths (deliberate, TR-053, to keep
   the strict console-clean spec green — the cost is this blind spot).
2. No `cosmos:*` event.
3. **`PerfSnapshot` has no `backend` field** (`src/lib/perf-telemetry.ts:36-70`) — so the
   `JSON.stringify(window.__ijPerf())` capture that the gate procedure calls "self-documenting"
   _cannot record which backend ran_. That is a hole in the instrument, not just in a run.

### 1c. FINDING: the device signature says `windows` on both Android phones — the instrument is reading a Windows UA

`deviceSignature` (`perf-telemetry.ts:118-133`) is a plain `navigator.userAgent` parse, ordered
`iPhone|iPad → Android → Macintosh → Windows`. `Windows` is checked **last**, so it can only win
if the UA contains none of the earlier tokens. Every Android browser UA contains `Android`.
**Therefore the UA that reached the instrument was a desktop Windows UA** — this is a logical
consequence of the code, not a formatting quirk.

Two secondary defects fall out of the same function:

- **The `⚠LOOKS EMULATED` guard is structurally dead in exactly this case.** It requires
  `/Android|iPhone|iPad/.test(ua)` — with a Windows UA it can never fire, so the one heuristic
  designed to catch this condition is bypassed by the condition itself.
- **The signature prints `screen`, never `viewport`** — but `classifyDeviceTier` keys off
  `innerWidth`. The overlay does not show the number that decided the tier.

**However, the readings do not look emulated.** TR-032/033 voided emulated rows precisely
because they produced desktop-like numbers (135–144 fps). 27 fps and a 5231 ms startup are the
opposite signature. The screen/dpr/core triples are real Android panels, and the S24 Ultra's
`384x832 · dpr2.8125 · 8c` is byte-identical to TR-083's confirmed real-hardware line.

**Verdict: the numbers are probably real; the OS token is definitely wrong.** Three console
values on each phone settle it (see "What the owner needs to capture" below). Per TR-032/033
precedent these rows are held as PROVISIONAL, not voided and not accepted.

> **RESOLVED, same day — owner confirmation (2026-07-29):** _"yes it was all real hardware with
> measurements."_ The three rows are **ACCEPTED as real-hardware readings** and are no longer
> provisional. This closes the provenance question only. **The instrument bug in §1c is
> unaffected and still open**: a genuine Android UA cannot produce the `windows` token given
> `deviceSignature`'s regex order, so something in the capture path is still substituting a
> desktop UA (a remote-debug/inspect surface and a "Desktop site" toggle are both candidates,
> though §1c notes desktop-site mode is inconsistent with the observed `tier low`). The
> practical consequences stand and still need fixing before the next round: the
> `⚠LOOKS EMULATED` guard cannot fire, and the signature prints `screen` rather than the
> `innerWidth` that actually decided the tier. Accepting the data does not repair the
> instrument that reported it.

### 1d. FINDING: device tier is decided by CSS viewport width, so every phone is `low` regardless of silicon

`classifyDeviceTier` (`perf-telemetry.ts:20-27`) takes exactly three inputs — `saveData`,
`deviceMemory`, `innerWidth`:

```ts
if (s.saveData) return "low";
if (s.deviceMemory !== null && s.deviceMemory <= 4) return "low";
if (s.viewportWidth < 768) return "low";
if (s.deviceMemory !== null && s.deviceMemory >= 8 && s.viewportWidth >= 1280)
  return "high";
return "mid";
```

No core count (it is collected for the signature but never fed in), no dpr, no GPU capability.
**No phone in portrait reaches 768 CSS px, so line 3 is an unconditional "every phone is `low`",
and `high` is structurally unreachable on any handheld.** A Snapdragon 8 Gen 3 flagship and a
2020 mid-ranger take the identical branch — which is exactly the anomaly TR-068/069/083 spent
three rounds failing to explain.

Then `resolveQualityTier` (`babylon-tiers.ts:100-112`) compounds it: on WebGL2, only `high`
escapes `lite` — and `high` is unreachable on mobile. **So the phones would land on `lite` even
if the WebGPU fallback were fixed.**

Also worth stating plainly: **the desktop resolved to `mid` → `balanced`, not `full`.** Nobody
in this measurement was running the full-quality scene.

### 1e. FINDING: `lite` has no lever on what actually costs the frame

`QUALITY_BUDGETS.lite` turns off halo/bloom, star trails and heat-shimmer, cuts shooting stars
24→8, nebula raymarch steps 18→9, nebula resolution to ⅓, asteroid bodies 48→20, and pins
planet textures to base. It does **not** touch the star field: `star-field`, `bonus-stars`,
`sdss-field`, `belt-visual`, `nebula-volumes`, `gd1-trail`, `constellations` and
`milky-way-band` are `true` on **every** tier (`render-layers.ts:98-205`).

So a `lite` phone still draws the full 168,959-star field **plus** ~387k bonus stars **plus**
3.64M SDSS galaxies **plus** 154,662 belt rocks. That is where 27–31 fps is going, and the tier
system has no control over any of it. The D9 Render Console is now the only mechanism that
can — which makes D9.4's uncalibrated defaults the highest-leverage open item in the project.

### 1f. Note on the desktop row's `renderFps 52 > displayHz 42`

The written rejection rule says reject when `renderFps > displayHz`; the implemented on-screen
check compares `fps > displayHz + 2` and did not fire. These are different claims. `displayHz`
is a 10th-percentile of the **loaded** rAF stream (`perf-telemetry.ts:162-171`), so it degrades
under load — it is a lower bound on refresh, not a panel property. `fps > displayHz` really is
arithmetically impossible; `renderFps > displayHz` is not.

**Recommendation: the doc's rule is over-broad and should be narrowed to `fps > displayHz`,
matching the code.** The desktop row is not rejected on those grounds. It does have a separate
real inconsistency (`renderFps 52` vs `host rAF 37`, where the render loop is itself rAF-driven
and cannot exceed it) most plausibly explained by mismatched averaging windows — `fps` uses the
last ≤60 deltas, `renderFps` a trailing 2000 ms. Worth a raw `__ijPerf()` capture before 52 is
treated as the gate number.

---

## Part 2 — The seven reported items

### ✅ #4 — DSO arrival overshoot · **CONFIRMED, P0, root cause exact**

The arrival math is not sloppy — it is **precisely correct and size-blind**.
`travelTo` (`babylon-engine.ts:6490-6546`) parks at `body.pos − dir × standoff` where standoff
is one of two constants: `PLANET_ARRIVE_STANDOFF = 80` for planet/moon/dwarf, `ARRIVE_STANDOFF = 38`
for **everything else — including every nebula**. Catalog entries carry no radius field at all.

Meanwhile the raymarched nebula volume is sized `depth × NEBULA_RADIUS_FACTOR (0.14)`
(`nebula-field.ts:645-656`) — **71–91 world units** for the shipped volumes. So the camera parks
at 38 units from a cloud whose radius is ~77:

| id                | volume radius | camera distance from core | **units inside the gas** | standoff ÷ radius |
| ----------------- | ------------- | ------------------------- | ------------------------ | ----------------- |
| m42               | 77.1          | 38                        | **39.1**                 | 0.49              |
| ngc7293           | 71.5          | 38                        | **33.5**                 | 0.53              |
| m1                | 89.3          | 38                        | **51.3**                 | 0.43              |
| ngc2000-hourglass | 90.9          | 38                        | **52.9**                 | 0.42              |

_(all 11 shipped volumes land in the 0.42–0.53 band)_

**The ship flies through the near wall of the cloud and stops roughly half-way to its core**,
inside the full-density shell (`shellInner: 0.55`). The raymarcher handles origin-inside, so the
gas renders all around and behind the camera; the targeted body's own photo billboard is
simultaneously clamped to ≤130 px. That composite is exactly "travels past it and stops way past
it." Zoom cannot recover it — max zoom-out is `38 × 3 = 114`, barely outside a 77–91 unit radius.

**Why no test caught it:** every DSO arrival spec asserts only `arrivedId === "m42"`. The one
distance assertion in the suite (`camera-zoom.spec.ts:107-130`) covers planet-vs-star only. And
`nebula-field.test.ts` pins `radius === depth * NEBULA_RADIUS_FACTOR` — the very number that
causes this — without ever relating it to `ARRIVE_STANDOFF`.

**Fix shape:** a third branch at `babylon-engine.ts:6534`, deriving standoff from the body's
rendered extent (`NEBULA_VOLUMES.find(...)!.radius × k`, k > 1) — precisely mirroring what
TR-103 did for planets. Needs a Vega SHOT-BRIEF on the framing multiplier k (how much of the
frame should a nebula fill on arrival) rather than a guessed constant.

### ✅ #3 — "No abort button mid-flight" · **CONFIRMED, P0 — it exists and is painted over**

`◂ RETURN HOME` is the abort (ADR-0010: goHome = warp abort). It is rendered and clickable
during warp. But:

- the mission bar sits at `bottom-8` (32 px) and is ~45 px tall → occupies **y = 32…77 px**
- the warp overlay's bottom letterbox is `h-16` (**64 px**) of opaque `bg-[#05081a]` at **z-70**,
  vs the bar's **z-62**, rendered later in the DOM

**The bottom ~32 px of the bar — the entire button row — is covered during every warp.** The
_top_ letterbox was accounted for (`HUD.tsx:75` positions readouts at `top-[clamp(72px,12vh,78px)]`);
the bottom one never got the equivalent treatment. Because the overlay is `pointer-events-none`
a click still lands, so the abort _works_ — it is simply invisible in the only state it exists for.

No test catches this: `mid-warp-input.spec.ts` drives abort programmatically via `page.evaluate`,
and Playwright's `toBeVisible()` checks CSS/box visibility, **not occlusion by a higher-z sibling.**
Nothing anywhere clicks that button mid-warp.

Compounding it: the keyboard `H` fallback only fires when `<babylon-scene>` itself has focus
(no window-level handler) — so after picking a destination in the WHERE-TO box, `H` types "h"
into the search field. And the on-screen hint reads `KEYS · … H HOME`, which never says it
aborts a flight in progress.

### ✅ #6 — Generic image on arrival/collector cards · **CONFIRMED, P1, and worse than reported**

Measured against the real catalog: **3,598 of 4,834 bodies (74.4%) have no curated image**,
including 856 galaxies, 41 nebulae, 35 clusters, 5 moons and 4 black holes. Every `fs-` field
object always does (`spaceHelpers.ts:189`).

The fallback is not class-aware. `isStar = !entry.img && !entry.fig` — **ignoring `entry.t`
entirely** — so a galaxy, a nebula, a globular cluster and a black hole all render the same
`/assets/star-tex.jpg` sun-surface texture over a yellow star glow, captioned
`"SPECTRAL RENDER · …"` (`CollectorCard.tsx:74, 261-277, 333`).

The 3D layer's `4834 BODIES (270 PHOTO)` HUD string is the **atlas** count and is unrelated —
the cards never touch the atlas.

A concrete, cheap sub-fix: several famous objects exist twice under different id namespaces and
the prefixed twin has no image — `cluster-pleiades` vs `m45`, `ngc2000-crab-nebula` vs `m1`,
`cluster-beehive` vs `m44`, `minorplanet-ceres` vs `ceres`. Identical coordinates; one shows the
real photograph, the other the generic glyph.

**The missing-imagery state is documented (TR-056, TR-108). The fallback behaviour is not** —
nothing in `docs/` says "a galaxy with no photo renders as a star with a sun texture on it."
That render decision is the actual defect.

### ✅ #7 — Sun and white dwarf have no body · **CONFIRMED, P2, two different causes**

**Sun:** it _is_ in the catalog (`celestial-catalog.js:8`, `t:"star"`, `img:null`), but
`public/assets/planets/manifest.json` lists 16 bodies and **`sun` is not one of them** — nor is
it in `build-planet-textures.mjs`'s `PLANET_SOURCES`. It is _not_ in `NEVER_SPHERE` (which holds
only Phobos/Deimos), so **this is an omission from the texture pipeline, not a decision.** It
falls through to a procedural beacon quad hard-clamped at 110 device px ≈ 55 CSS px on a 2× DPR
display. Also `PHOTO_TYPE` has no `star` key, so it could not get an atlas billboard even with an
image.

**White dwarf:** the searchable "A WHITE DWARF · NEAREST INSTANCE" class row (D5.3) resolves to
an `fs-` id, and `_fieldBody` synthesizes a body it deliberately **never pushes into
`this.bodies`** — so no beacon, no billboard, no sphere. All that remains is its point in the
star-field mesh, whose size is floored at `max(dist, 90.0)` — **flying closer than 90 units makes
it no bigger, and arrival parks at 38.** Computed against the real magnitude bytes: **≈5 CSS px
at ~11% alpha, halo forced to zero.** The owner's report is literally accurate.

TR-063 already flagged the root cause and never solved it: the shared magnitude byte floors at
mag 12.5 while real white dwarfs are G≈18–20, so the whole population saturates to the dimmest
byte. D5.4's audit guard proves _travellable ⊆ searchable_ — the converse (searchable ⇒ has a
body) was never asserted, and this is precisely that gap.

### ⚠️ #5 — Zoom out then in · **BY DESIGN, but with a real, recorded deviation**

Not a bug in the sense of "something broke" — three deliberate, additive camera moves:

1. **Ascent** dollies the camera radially out 29 → 38 units over 8 s (`ascent.ts:27-28`), eased
   `k³` so it reads as thrust. Spec: `docs/experience-design/2026-07-23-pf11-d1.3-ascent-motion-spec.md`.
2. **Warp chase** pulls back 3.0 → 5.8 then pushes in to 3.0 (`ship-dynamics.ts:433-441`).
3. **FOV** widens +6% at peak speed and relaxes (`ship-dynamics.ts:474-482`).

(2) and (3) are deliberately coupled to the same `warpSpeedNorm` driver so no cue disagrees —
which is exactly why the composite reads as one strong OUT-then-IN.

**Your realism question, answered honestly: no, this is not how a real spacecraft transit
looks.** A real crewed transit is first-person — the view does not dolly at all, because there
is no camera behind the ship. The spec concedes this in writing: the chase-dolly and FOV breath
are a _declared cinematic license_, not a physics claim.

**But there is a real deviation.** The D3.1 motion spec prescribes the settle waypoint at
`[0.9, …, 4.3]`; the build ships `[0.92, …, 3.4]` — a **21% closer camera**, moving 2.4 of the
2.8-unit close-in into k 0.72→0.92 instead of spreading it to k=1. TR-093 justified only the
_k_ shift as "perceptually identical" and is **silent on the back-distance change**. "Zero
perceptual cost" was an assertion, not a measurement — and it directly amplifies the zoom-IN
being reported.

And the design review itself listed this as a pending owner check: _"confirm the pull-back reads
as 'easing back', not 'ship shrinking away'."_ **This report is the negative answer to that
question.** It is a Vega tuning pass, not a defect fix.

### ℹ️ #2 — "gaia-tiny — where am I looking?" · Fair question; partly a real concern

You enabled 2 of 8 chunks = the **brightest ~610k stars**, magnitude ≲9. The layer is a
background _density_ increase, not a landmark — there is nothing to look _at_, only a sky that
gets subtly denser.

To actually see it: point at a dark region **away** from the Milky Way band (or turn the band
layer off so it doesn't wash the field out), then toggle the count 0 ↔ 2 and watch.

**The honest engineering note:** the magnitude histogram is bottom-heavy — 777k stars at mag 11
and 1,004k at mag 12, i.e. **~70% of the dataset sits in the faintest two magnitude bins.**
Through `magToByte` those land in the bottom ~10% of the byte range, which is exactly the
saturation problem TR-063 identified for white dwarfs. So chunks 4–8 add ~1.5M stars that render
at nearly identical minimum brightness. **Whether the last 4 chunks (~18 MB) are worth their
download is a legitimate open question**, and the chunked design means it can be answered by
measurement rather than argued — which is the one part of D8 working exactly as intended.

---

## What the owner needs to capture (settles Part 1)

On **each phone**, in the remote-debug console (`chrome://inspect`):

```js
navigator.userAgent; // must contain "Android" — settles §1c
window.isSecureContext; // expect false over http://192.168.x.x — settles §1a
!!navigator.gpu; // expect false when the above is false
window.innerWidth; // the number that actually decided the tier (§1d)
JSON.stringify(window.__ijPerf());
```

Then re-measure over HTTPS (tunnel / Netlify preview) to get the **real** shipping-path numbers.

---

## Proposed fix order

| #   | Item                                           | Priority | Shape                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Needs                                                                  |
| --- | ---------------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| 1   | ~~#3 abort occluded~~ **✅ DONE**              | ~~P0~~   | **DELIVERED [TR-115](../test-reports/TR-115.md)** — console lifted clear of the letterbox (and the warp readout's floor raised with it; the pairing is arithmetically forced). Occlusion guard added and negative-controlled.                                                                                                                                                                                                                                                                                                                                                                                          | —                                                                      |
| 2   | ~~#4 DSO overshoot~~ **✅ DONE**               | ~~P0~~   | **DELIVERED [TR-115](../test-reports/TR-115.md)** — `NEBULA_ARRIVE_STANDOFF_FACTOR = 3.5`, keyed on volume presence. Astra's 2.5-4.0 R band ∩ Vega's zoom floor (≥3.33) admits exactly one value.                                                                                                                                                                                                                                                                                                                                                                                                                      | ✅ both briefs delivered                                               |
| 3   | §1d tier by viewport                           | **P1**   | Tier must consider more than CSS width; and `high` must be reachable on mobile                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | ADR — this is an architecture change                                   |
| 4   | ~~#6 card fallback~~ **✅ DONE**               | ~~P1~~   | **DELIVERED [TR-117](../test-reports/TR-117.md)** — class-aware `resolveCardVisual()` (shared by both card components) replaces the sun-texture-for-everything fallback with a distinct procedural render + honest caption per class; 51 real duplicate-id twins fixed via a new overlay; 25 real photos sourced for the rest. **License risk on the fetched photos flagged, not resolved** — see TR-117 open item 1.                                                                                                                                                                                                  | Owner sign-off on the license risk (TR-117)                            |
| 5   | ~~§1b backend invisibility~~ **✅ DONE**       | ~~P1~~   | **DELIVERED [TR-117](../test-reports/TR-117.md)** — `backend` added to `PerfSnapshot`, read every rAF tick; also used to close B6's A4 device row (real WebGL2-fallback measurement, no owner hardware needed).                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                      |
| 6   | ~~#7a Sun sphere~~ **✅ DONE**                 | ~~P2~~   | **DELIVERED [TR-117](../test-reports/TR-117.md)** — Sun added to the planet-texture pipeline (Solar System Scope, CC BY 4.0), rendering via the existing Venus flat-light shader fork. Owner-confirmed visually: no terminator line, card correctly still reads as a star.                                                                                                                                                                                                                                                                                                                                             | —                                                                      |
| 7   | ~~#7b white dwarf body~~ **✅ DONE (partial)** | ~~P2~~   | **DELIVERED [TR-117](../test-reports/TR-117.md)** — magnitude encoding rescaled catalog-wide (real WDs were saturating to one byte; now spread across the format's full range); WDs now promote into `this.bodies` on first visit (real position, standoff, pickable, travelable). **No new visual beacon mesh was built** — deferred as too high-risk to verify unattended in that pass; TR-117's design phase found even a correctly-encoded faint point source caps near 15% alpha/8px in the shared point-sprite model, so a dedicated mesh (not shipped) is the only mechanism that makes them obviously visible. | Owner sign-off on whether the beacon-mesh follow-up is wanted (TR-117) |
| 8   | ~~#5 warp settle~~ **✅ DONE**                 | ~~P3~~   | **DELIVERED [TR-117](../test-reports/TR-117.md)** — reverted to the D3.1 spec's 4.3 back-distance; confirmed no test or code depended on the drifted 3.4 value.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | —                                                                      |
| 9   | #2 gaia-tiny chunk value                       | **P3**   | Measure whether chunks 4–8 are visually distinguishable                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Owner eyes                                                             |

**Both P0 items are closed ([TR-115](../test-reports/TR-115.md), 905 unit · 177 E2E, zero failures). Items 4-8 are now also closed ([TR-117](../test-reports/TR-117.md), 944 unit · 178 E2E, zero failures) — three of them (4, 7) carry an owner sign-off flag rather than being unconditionally closed; see TR-117's "Open items needing owner input." Items 3 and 9 remain open — both are P1/P3 items outside this session's scope (item 3 is an architecture-change ADR candidate; item 9 needs owner eyes on a live build, folded into the standing real-device pass).**

**Instrument fixes (§1b, §1c, §1f) should land before the re-measurement**, not after — every
prior round of this measurement was compromised by its own instrument, and doing it a fourth
time on a signature that cannot report Android or backend would repeat that exactly.
