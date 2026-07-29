# PF-11 post-D8 — Outstanding Owner Validations

**Date:** 2026-07-29 · **Owner-run** · Every PF-11 phase (D0.1-D9) is now implemented and
green on CI-reachable gates ([TR-114](../test-reports/TR-114.md)). This is the list of what
**cannot** be closed from this environment — either because it needs physical hardware, or
because the MCP Browser pane used for "manual" regression in this sandbox does not composite
real frames (confirmed twice: [D3.3/TR-096](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md#phase-d3--flight-model-v4-graceful-legible-deceleration-owner-r6r11)
and this session's D8 pass) — or because it's a judgment call only the owner can make.

Nothing below is a defect. The automated gate (901 unit · 176 E2E, zero failures) proves the
engine does what it claims; it does not prove it _feels_ right on real hardware, and several
items are explicitly owner-scheduled by standing project decisions (ADR-0008).

---

## 1. Real-device measurement (physical hardware required)

### 1a. Apply D0.3's device numbers to D9's per-tier defaults (D9.4)

**Status: partially done, not fully closed.** D0.3's round-3 device pass ([TR-083](../test-reports/TR-083.md))
already collected real numbers on desktop + Galaxy S20 FE + Galaxy S24 Ultra — that raw data
exists. What's still open is turning it into actual `defaultByTier` values for the Render
Console's layers (`belt-physics` count, `gaia-tiny` chunk-prefix, `planet-hires` threshold).
Every default currently shipped is "current behaviour made visible," not a measured
recommendation ([`render-layers.ts`](../../src/lib/render-layers.ts)'s own header comment says
so explicitly).

- [ ] Decide real per-tier defaults for `belt-physics`, `gaia-tiny`, `planet-hires` from
      TR-083's numbers (or a fresh pass if TR-083 is stale)
- [ ] Re-run `?perf=1` on desktop + both Android devices with the CURRENT full PF-11 build
      (TR-083 predates D1-D9; the scene has grown substantially since)

### 1b. Close PF-09 B6's still-open sub-gates

TR-083 explicitly left these unresolved (`docs/delivery-plan/PF-09-babylon-havok-realism.md`
§B6, cross-referenced from PF-11 D0.3):

- [ ] **A1 (desktop 60fps floor)** — TR-083 measured 45-52fps, still under the 60fps target
- [ ] **A2 (iPad)** — untested this entire project; no device available to any session so far
- [ ] **A4 (WebGL2 fallback path)** — untested on real hardware
- [ ] **The flagship-underperforms-mid-tier anomaly's root cause** — TR-083's round 3 saw the
      S24 Ultra _reverse_ from underperforming to beating the S20 FE, but the
      ENGINE/TIER/device-signature overlay line has failed to capture on **three consecutive
      rounds**, so whether the reversal is tier resolution, backend choice, or device/session
      state is still unconfirmed. Fixing that overlay capture is a prerequisite to explaining
      it, not just re-running the same measurement a fourth time.

### 1c. Real-device heap/VRAM measurement (D7)

Every number in D7's memory-optimisation slice (~361 MB SDSS retained, ~15 MB belt, ~54 MB star
mesh knowingly kept per TR-113's C1 fix) is a **structural estimate from record counts and
buffer strides**, verified against Babylon's source code but never measured on a real device.

- [ ] Chrome DevTools **Memory** tab (heap snapshot) or `performance.memory` before/after
      enabling each heavy layer, on desktop and at least one Android device
- [ ] Specifically worth checking: does the D8 `gaia-tiny` layer's full 8-chunk enable
      (2.44M stars, ~10.2M vertices — "15.1× the vertex stage" the plan's own D8 inventory
      flagged) hold budget on the mid-tier Android? This is the single largest optional
      GPU-memory commitment any layer in this app can make, and it has never been measured on
      anything but this session's desktop preview.

### 1d. Manual regression on a real phone/tablet

Named explicitly as pending in D9.4's own exit criteria, and never closed since:

- [ ] Boot → RENDER ▸ panel → toggle a few layers → travel → arrival → Where-To search, on a
      real phone (not DevTools emulation — TR-083's own history shows why that specifically
      cannot be trusted for this: emulated "mobile" runs on the desktop GPU at desktop refresh
      and reports physically-impossible fps)
- [ ] Confirm the Render Console's **known gap** — no mobile-menu entry point yet (desktop HUD
      cluster only) — is acceptable, or decide whether it needs one (see §4 below; this is
      partly a scope decision, not purely a device check)

---

## 2. Owner-eyes visual confirmation (the sandbox cannot render these)

The MCP Browser pane used in this environment does not composite real animation frames —
confirmed in two separate sessions now (`activeMeshes` stuck at 0 across repeated waits
regardless of real engine state, both times). Anything that needs to be _watched happening_,
not just asserted on via DOM/`sceneStats()`, falls here:

- [ ] **D8: does the gaia-tiny field actually look good at full enable?** Automated coverage
      proves 2,439,455 stars fetch, decode, and render — it does not prove the resulting sky
      density, brightness distribution, or the visible seam (if any) at each chunk boundary
      reads as intentional rather than as a decal.
- [ ] **D3.3: the warp-abort's velocity discontinuity** — implemented exactly as specified
      (restart the profile at `k=0`, 900ms `aim` hold) but never watched. Does the deceleration
      _feel_ like a real abort, or does it read as a stutter?
- [ ] General cinematic pass: launch ascent (D1.3), warp choreography (D3), arrival vistas (D4)
      — all pass their E2E specs (which drive real DOM state through a real Playwright browser
      context, so these ARE exercised correctly) but none has had a human actually watch them
      play in this project's history beyond the owner's own prior sessions.

---

## 3. Scientific realism audits outstanding (Astra)

Two REALISM-AUDITs the plan named but never ran:

- [ ] **D3's full warp journey** — flagged since the D3.3 slice; every individual piece has
      been through Astra review at some point, but the assembled end-to-end journey has not.
- [ ] **D8's `tEff`→B-V colour substitution** ([ADR-0012](../adr/0012-gaia-tiny-chunked-layer.md)) —
      Sun-calibrated (exact at 5778K→B-V 0.650) and cross-checked against Vega/Sirius/
      Betelgeuse/Rigel, but that was done as part of implementation, not as an independent
      Astra pass the way TR-064 reviewed the white-dwarf colour range specifically. Worth a
      real audit given it affects the colour of 2.4M rendered stars.

---

## 4. Judgment calls only the owner can make

- [ ] **`FLIP_MIN_MS` warp-flip duration** (ADR-0011) — explicitly recorded as "owner-flagged,
      tunable." The math is correct; whether the resulting pacing (journeys +1.0-1.3s, home
      1.4→2.7s) _feels_ right is a taste call.
- [ ] **D9.2's mobile Render Console gap** — is desktop-only access to the layer panel
      acceptable long-term, or does it need a mobile-menu entry point (the credits dialog has
      two entry points; Render Console has one)?
- [ ] **D8's residual 4.3% dedup gap** — 5,057 of 117,904 HIP-tagged gaia-tiny stars didn't
      match anything in the shipped base field (plausibly a different Hipparcos edition/cut
      between the two datasets' origins). Quantified, not investigated further. Worth deciding
      whether it's worth chasing, or an accepted cost of the pipeline.

---

## What NOT to re-check

Everything covered by the automated gate is genuinely closed and doesn't need owner
re-verification: 901 unit tests, 176 E2E specs (real Playwright browser context, not
emulation), lint, typecheck, build, budget gates, docs-drift check. If in doubt whether
something above is "done," the test suite passing is not evidence either way — that's exactly
why each item here is listed.
