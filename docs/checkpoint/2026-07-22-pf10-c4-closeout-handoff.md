# Handoff — PF-10 C4 closeout (sessions of 2026-07-21 → 22)

**Purpose:** an exhaustive, honest three-way split of this session's work so the next session can
start without re-deriving state. Written because a status that exists only in chat is exactly what
this session proved unreliable.

**Primary record:** [TR-079](../test-reports/TR-079.md) · [ADR-0009](../adr/0009-asset-weight-budget.md) ·
[Astra's Earth brief](../analysis/2026-07-21-earth-sphere-science-brief.md)

> **✅ COMMITTED.** Both sessions' work is in **`d8aba0f` "Update - fixes from PF-10"** on
> `feature/PF-07/background-spaceship-v2` — TR-078's (VT streamer, Venus descent, ADR-0008) and
> this one's. Verified by `git cat-file` against HEAD for a spread of files including
> `budgets.config.mjs`, `celestial-saturn-moons.js`, `cubemap-equirect.mjs`, `TR-079.md`,
> `earth.jpg` and `venus-cloud.jpg`. Only this handoff document itself remains uncommitted.
>
> _An earlier revision of this file carried a "NOTHING IS COMMITTED" warning. That was true when
> written and became stale when the owner committed mid-session; corrected here rather than edited
> away, per this repo's corrections-are-additive convention._

---

## A. DONE — verified, closed, do not reopen

Each line is something that was executed and observed, not inferred.

### A1. The texture reckoning (deviation #1)

| Item                                                                                         | Evidence                                                            |
| -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| `PACK_RECKONING` accounts for **all 64 pack entries** (31 shipped, 33 recorded with reasons) | `npm run assets:verify` asserts it; fails if a file is unclassified |
| Reckoning is **executable, not prose** — `--verify` fails on any unclassified pack file      | proven by run                                                       |
| **9 normal maps** wired through a new `normalTex` path in **both shader twins**              | twin-parity unit tests; real-GPU spec 3/3 console-clean             |
| Neutral-normal (128,128,255) placeholder, distinct from the shared mid-grey                  | TR-059 discipline; unit test                                        |
| Normal sample is unconditional, gated by `mix()` (TR-047)                                    | unit test asserts no `if (uHasNormal)`                              |
| **Backtick-in-shader-string** hazard converted to a gate                                     | unit test: no shader source contains a backtick                     |
| Milky Way + Planck CMB plates recorded as **deferrals**, not silently dropped                | unit test asserts both present in `PACK_RECKONING`                  |

### A2. Earth's cubemap re-projection

| Item                                                                                              | Evidence                                                                                                 |
| ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `scripts/lib/cubemap-equirect.mjs` — 6-face cubemap → equirect                                    | pure-geometry unit tests (axis→face centre, in-face bounds, seam continuity)                             |
| Orientation **proven by correlation**, not eyeballed                                              | shipped **r = −0.5995** vs −0.2781 nearest wrong variant; script exits non-zero if it ever stops winning |
| **Visually confirmed** — every continent correctly placed and oriented, no mirroring, no seams    | `public/assets/planets/earth.jpg`, inspected                                                             |
| Lanczos pre-reduction filtering defect found and corrected (bilinear was aliasing a 4× downscale) | 1.88 MB → 1.77 MB, the direction that confirms the diagnosis                                             |

### A3. Pipeline registration (deviation #2)

| Item                                                                                                                     | Evidence                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Three-mode shape on both scripts: default / `--if-stale` / `--verify`                                                    | matches `build-craft-assets.mjs --verify` precedent                                                                               |
| npm scripts registered: `assets:planets`, `assets:planets:vt`, `assets:sync`, `assets:verify`, `assets:cubemap:validate` | `package.json`                                                                                                                    |
| `predev` / `prepreview` → `assets:sync`; `prebuild` → `assets:verify`                                                    | uses `pre*` hooks, **not** the `&&` build chain (which CLAUDE.md records short-circuiting on Prettier and leaving a stale `dist`) |
| CI lint job runs `assets:verify` + `budget:check:assets` as **steps in the existing job**                                | keeps branch-protection status-check names valid (TR-034)                                                                         |
| **CI-safe no-op branch proven by execution** — source pack absent → verifies, exits 0                                    | run from a cwd where the relative path cannot resolve                                                                             |
| **Gate proven to fail** — removing one asset → exit 1 with an attributable message                                       | run deliberately                                                                                                                  |
| `venus-cloud.jpg` is now a declared, verified, reproducible `PASSTHROUGH_ASSETS` entry                                   | it had never been in any pipeline                                                                                                 |
| `NEVER_SPHERE` parity asserted across the `.mjs` / `.ts` boundary                                                        | unit test                                                                                                                         |

### A4. Asset budget (deviation #3) — ADR-0009

| Item                                                                                             | Evidence                                             |
| ------------------------------------------------------------------------------------------------ | ---------------------------------------------------- |
| All budgets moved to `budgets.config.mjs` as **data**, separate from measurement                 | JS/WASM ceilings moved too                           |
| `public/assets` gated in **raw bytes** at 3 granularities (total / largest file / per directory) | `budget:check`                                       |
| Build-free (reads `public/`, not `dist/`) so the dev hooks can use it                            | `budget:check:assets`                                |
| **The gate failed 3× on real growth and was raised deliberately each time**                      | 209 → 255.5 → ratcheted down 254.5 → corrected 256.5 |
| Ratchets **down** as well as up                                                                  | night-lights removal walked the ceiling down         |

### A5. The asset-deletion incident — fully recovered and structurally closed

| Item                                                                                                               | Evidence                                                     |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| All **19 deleted assets restored** (18 via `git checkout`, `venus-cloud.jpg` byte-identical from source, 93,299 B) | `git status` shows **zero deletions**                        |
| Delete capability **removed entirely** (owner direction) — `rmSync` gone from the file                             | unit test asserts the **absence** of any delete call         |
| `pruneOrphans()` → `reportUnrecognised()`; classifies and prints, never removes                                    | verified by planting an unknown file: reported, left on disk |
| Catalog-owned assets derived **from the catalogs themselves**, so the 18 are silent                                | `predev` output back to 4 clean lines                        |
| Test: **every `assets/planets/*.jpg` the catalogs reference exists on disk**                                       | derived from the catalogs, cannot drift                      |

### A6. Astra's Earth physics, implemented

| Item                                                | Value shipped                                                                |
| --------------------------------------------------- | ---------------------------------------------------------------------------- |
| Surface albedo — **not** the famous composite 0.434 | **0.213** clear-sky (0.434 double-counts the cloud layer)                    |
| Lunar-Lambert L for Earth                           | **0** — a regolith law does not describe an ocean                            |
| Ocean glint (Cox-Munk / Torrance-Sparrow)           | σ² = 0.03884 at the real 7.0 m/s wind; Fresnel F₀ = 0.02101                  |
| Rayleigh + aerosol (**broken physics to omit**)     | τ = (0.0491, 0.0973, 0.2211), real λ⁻⁴·⁰⁹, real phase fn                     |
| Cloud deck                                          | raw alpha, white cloud, L = 0.9, **locked to surface rotation**              |
| Night lights                                        | **not shipped, assets deleted** — night hemisphere is 100% occluded at α = 0 |
| Blue limb ring                                      | not drawn — limb is 43.155° off-axis vs a 22.92° half-FOV                    |
| Icy-satellite `lunarLambertL`                       | 1.0 (the 0.55 fallback was **Mars's**, and Mars has air)                     |
| Dione rotation period                               | corrected 236,429 → **236,469.5 s** (a 40.5 s slip)                          |

### A7. Three bodies made reachable

`src/data/celestial/celestial-saturn-moons.js` — Tethys, Dione, Rhea. **Verified live**: all three
arrive, correct body dressed, sphere visible and ready, rotation advancing, zero console errors,
zero failed requests. Rhea reaches `ultra`, Tethys/Dione stop at `high` — exactly what their
8192/4096 sources declare. Catalog total **4,829**.

Dossier images are a **declared pipeline output** (`dossier: true`), not hand-placed files.

Positions are a **declared licence with a measured size**: real elongation from Saturn is
47.6″/61.0″/85.1″; the whole inner system fits in 0.11°; Tethys's true separation is 0.040 world
units against a radius-26 sphere. The shipped offsets preserve real _ordering_ and bracket between
the existing Enceladus and Titan.

---

## B. PARTIAL / DEVIATIONS — landed, but with a named gap

**B1. Earth is textured but unreachable.** 10.84 MB of Earth assets ship and cannot render.
Astra ruled a catalog entry **BROKEN PHYSICS** (the frame is geocentric — the Sun is itself a body
at ra 250/dec −20.5, so Earth's direction is 0/0 and its distance is 0). The alternative is
**better and specified**: reveal the sphere via `goHome` at the origin, where the α = 0 arrival lock
does not apply. Parking at **ra 160 / dec 0** gives a verified **90.0000°** phase angle — terminator
dead centre, city lights, twilight band, cloud shadows, for Earth alone, no change to `travelTo`.
Cost: the ocean glint. **Not implemented — it is a new feature, not "add catalog entries".**

**B2. Planetary exposure clips on six of sixteen bodies.** `surface × albedo × (refl × dayside ×
3.6 + 0.06)`; 3.6 was tuned against Mars (0.25) and the Moon (0.28) only. Measured mean output at
`refl = 1`: Dione 2.17, Europa 2.04, Tethys 1.80, Rhea 1.30, Venus 1.25, Io 1.21 — **all clipped**.
C4.1's intended bake-normalisation was never implemented. Fix needs the opposition surge moved out
of `uAlbedo` into `refl`, then an owner choice between bake-normalisation (exact ratios, Moon 2.6×
darker) and a Reinhard curve (never clips, compresses the real 9.0:1 Tethys:Moon ratio to 2.9:1).
Astra's numbers for both routes are in the brief.

**B3. The nine new normal maps contribute ~0% at frame centre.** At α = 0 with L = 1, `refl` ≡ 1 for
any normal; ±16% at the frame edge. Not a defect in the maps — the full-Moon effect, exactly as
predicted — but their visible payoff is gated on the same arrival-geometry decision as B1.

**B4. No pixel confirmation of any planet sphere.** Engine state is provably correct (mesh visible
and enabled, scale 26, camera at exactly the documented 38.0 standoff, ultra tier, VT tiles bound),
but in every automated harness the camera's _look direction_ stays at its initial bearing, so the
sphere is outside the captured frame — on the programmatic path **and** through the real UI.
**Five sessions running, a different mechanism each time.** TR-079 Part 8b records this as the
project's single largest verification gap. The static asset images (`earth.jpg`, `rhea.jpg`,
`tethys.jpg`) were confirmed by eye; the rendered scene was not.

**B5. `base` (2048) tier ships but is never fetched.** 6.58 MB. `babylon-engine.ts` reads only
`.high` and `.ultra`. Kept because C4.3's tier gating is what will consume it; recorded in
`budgets.config.mjs` so it is a known quantity rather than a discovery.

**B6. `uAtmosphere` is keyed off the cloud map's presence.** Earth is currently the only
atmosphere-bearing body with either, so the proxy holds. A second such body needs a real per-body
flag. Commented at the call site.

**B7. Two test edits, named per CLAUDE.md #15.** `counts.celestial` 4826 → **4829** plus a new
per-file `counts.saturnmoons` assertion; and Tethys/Dione/Rhea removed from
`UNREACHABLE_BY_DESIGN` — the latter _forced_ by the companion test rather than merely allowed.
Both are consequences of the feature, not accommodations of it.

**B8. sRGB decoding is not applied to surface textures.** CLAUDE.md #10 requires lighting in linear
space; the planet shader samples `surfaceTex` without decoding. **Pre-existing, not introduced
here**, and it interacts with B2 — noticed while implementing Earth's Rayleigh term and recorded
rather than changed mid-session.

---

## C. NOT DONE AT ALL

**C1. ~~Nothing is committed.~~ Resolved** — both sessions landed in `d8aba0f`. Left in place
struck through rather than deleted, because the next reader should know the state was checked
rather than assumed.

**C2. The ADR-0008 real-device pass.** Desktop, the owner's mid-tier and flagship Android, a tablet
if available. The largest outstanding item for all of PF-10 and the thing ADR-0008 explicitly
defers rather than cancels. Everything in B2/B5 and the asset-weight question wants it first.

**C3. Asset weight decision.** `public/assets` is **256.34 MB**; `planets` 169.31 of it —
base 6.6 / high 28.6 / ultra 69.1 / VT tiles 62.9 / dossier+catalog 2.0. The two levers (`ultra`,
the VT pyramid) both want C2's data.

**C4. The asteroid belt's 23.44° frame offset.** Unchanged owner decision since TR-074.

**C5. C4.3 entirely** — self-shadowing near the terminator, tier/budget gating from real-device
data.

**C6. Earth's night lights, clouds and glint have never been looked at.** The code is in and
console-clean; how it looks is unknown. Blocked behind B1 (Earth unreachable) and B4 (no pixels).

**C7. The E2E cumulative-load problem is unfixed, and it has grown.** The full suite is **80/87**;
the count has drifted 5 → 6 → 7 across sessions while the membership rotates. Every one of the 7 is
individually accounted for above (2 A/B-proven pre-existing, 5 pass in isolation), so nothing is a
regression — but **the root cause has never been investigated**, only triaged, and it now costs a
full-suite run its meaning. Two concrete leads: `GAP-03/04/05` fails on `bandReady` never becoming
true within 20 s (A/B-proven at HEAD), and `perf-budgets` fails on `settled.frames > boot.frames`
(also A/B-proven at HEAD) — both are _frame-production liveness_ assertions, which is probably the
same underlying thing.

**C8. Atlas cells for the new bodies.** Tethys/Dione/Rhea have no `atlas.jpg` cell, so at distance
they render as the documented per-type shaded quad rather than a photographic billboard. The sphere
on arrival is correct. There is no atlas build script — it is a vendored asset — so adding cells is
its own piece of work.

**C9. Jupiter's moon offsets are rank-wrong.** Astra noted in passing that Io is the most-separated
Galilean in the catalog and the least in reality. Untouched — it is shipped data outside this
session's scope.

---

## Verification baseline for the next session

| Gate                        | Value                                                       |
| --------------------------- | ----------------------------------------------------------- |
| `npm run test`              | **552 / 552 unit**                                          |
| `npm run lint`              | clean                                                       |
| `npx astro check`           | 0 errors, 0 warnings, 0 hints                               |
| `npm run assets:verify`     | 16 bodies · 88 files · 1,364 VT tiles · reckoning 64/64     |
| `npm run budget:check`      | JS 1170.4/1200 KB gz · assets 256.34/256.50 MB              |
| `npm run docs:check`        | passes                                                      |
| real-GPU WebGPU spec        | 3/3, zero console output                                    |
| C4 scene specs              | 4/4 (Mars sphere, Venus descent, GAP-02 bodies, GD-1 trail) |
| catalog total               | 4,829                                                       |
| **full `npm run test:e2e`** | **80 / 87 passed** (16.0 min, `--workers=1 --retries=0`)    |

### The 7 E2E failures — each one individually accounted for

The full-suite count moved from TR-078's 5–6 to **7**, so every failure was re-run in isolation
rather than waved at the documented rotating set. **None is caused by this session's changes**, and
two are now A/B-proven against `HEAD` rather than merely argued.

| #   | Failing spec                                      | Status                                                                                     |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| 1   | `accessibility.spec.ts:90` — axe, Babylon path    | **Passes in isolation.** Load-dependent.                                                   |
| 2   | `engine-select.spec.ts:317` — GAP-03/04/05        | **A/B-PROVEN PRE-EXISTING** — fails identically with both engine files reverted to `HEAD`. |
| 3   | `engine-select.spec.ts:905` — GAP-17 flight seq.  | **Passes in isolation** (2/2 with its GAP-08 neighbour).                                   |
| 4   | `engine-select.spec.ts:1555` — C4 Mars sphere     | **Passes in isolation on the current build**, i.e. with the catalog entries in.            |
| 5   | `engine-select.spec.ts:1633` — C4.2 Venus descent | **Passes in isolation on the current build.**                                              |
| 6   | `perf-budgets.spec.ts:41`                         | **A/B-PROVEN PRE-EXISTING** — fails identically at `HEAD`, same test, same assertion.      |
| 7   | `space-scene.spec.ts:210` — mobile menu           | **Passes 4/4, twice, with this session's changes applied.** Pure DOM; untouched by them.   |

**The rotating membership is the diagnostic.** `perf-budgets` failed its `webgl` variant in the full
run and its `babylon` variant in isolation; `space-scene` failed "mode toggle" in the full run and
"Data & Licenses" in isolation. A deterministic regression does not move between sibling tests —
this is TR-052's documented cumulative-load signature, on a machine that had been running builds and
Chrome instances for hours.

**What is genuinely open (see C7):** the _root cause_ of that cumulative-load behaviour is still
unknown, and the count has drifted 5 → 7 across sessions. It deserves its own investigation rather
than another round of triage — but it blocks nothing here, and no failure is a regression from this
work.
