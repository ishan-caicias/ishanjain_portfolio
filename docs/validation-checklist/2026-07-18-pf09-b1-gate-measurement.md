# PF-09 B1 Gate — Real-Device Measurement Procedure

**Date:** 2026-07-18 · **Owner-run** · Feeds the [PF-09 B1](../delivery-plan/PF-09-babylon-havok-realism.md)
go/no-go decision and the superseding ADR ([TR-028](../test-reports/TR-028.md)).

## Why this is owner-run

The B1 gate compares Babylon against the current engine on **real GPUs**. Headless CI renders
WebGL through SwiftShader (CPU) and has no WebGPU, so it cannot produce representative fps or
exercise the WebGPU path. Only your physical devices can. The bundle dimension is already
measured (see below); this procedure captures the fps + startup dimension.

## Already measured (CI, deterministic)

| Dimension       | Result                                            | Budget        | Verdict |
| --------------- | ------------------------------------------------- | ------------- | ------- |
| Babylon JS (gz) | **329 KB** tree-shaken (was 1.1 MB barrel at B0)  | ≤ ~900 KB     | ✅ GO   |
| Default-path JS | **260 KB gz** — unchanged (Babylon is fully lazy) | no regression | ✅ GO   |

## What you measure (per device)

Run on **three device classes**: a desktop (WebGPU), an iPhone (Safari 26+, WebGPU), and a
mid-range Android (Chrome). For each, record the numbers below for BOTH engines.

### ⛔ Use a PRODUCTION build — never `astro dev`

**`npm run dev` numbers are invalid for this gate and must not be recorded.** Dev serves
unbundled modules with HMR overhead and no minification; measured on the same machine, startup
was **3517 ms in dev vs 843 ms in preview** — a 4× distortion that would sink a passing engine.

```bash
npm run build && npm run preview     # then measure against the preview URL
```

(Or measure the deployed site.) Dev mode is also where the Vite dep-optimizer breakage of TR-031
lived — if the page shows only the title and paragraph with no starfield, you are on dev, or the
dep cache is stale: `rm -rf node_modules/.vite/deps` and restart.

### Steps (per device, per engine)

1. Open the **production preview / deployed site** (never dev) at:
   - Current engine: `https://<site>/?perf=1`
   - Babylon spike: `https://<site>/?engine=babylon&perf=1`
2. Read the on-screen perf overlay (top-left). It shows
   `RENDER FPS n (host rAF m / kHz)` plus `STARTUP` and `RENDERED`. Let it settle ~10 s, then
   record **RENDER FPS** (not the host-rAF figure) and **STARTUP**.
3. For a precise snapshot, open the console and run `window.__ijPerf()` — it returns
   `{ engine, tier, startupMs, fps, renderFps, displayHz, renderFrames, frames, device }`.
4. On the Babylon page, confirm the badge reads `BABYLON WEBGPU · …` on WebGPU-capable
   browsers (it reads `WEBGL2` on the fallback). If it says WEBGL2 on a device you expect to
   support WebGPU, note that — it is a finding.

### Round 1 (2026-07-18) — ⚠️ VOID, instrument defect. Do not use.

Recorded in good faith, but **the v1 instrument could not produce a valid reading** and these
numbers must not decide the gate (see TR-032):

| Device class         | Engine  | Backend | Startup (ms) | "fps"   |
| -------------------- | ------- | ------- | ------------ | ------- |
| Desktop              | current | webgl2  | 39           | 140     |
| Desktop              | babylon | webgpu  | 50           | 135-150 |
| iPhone (Safari 26+)  | current | webgl2  | 20-30        | 130-140 |
| iPhone (Safari 26+)  | babylon | webgpu  | 80           | 140     |
| Mid Android (Chrome) | current | webgl2  | 20-30        | 130     |
| Mid Android (Chrome) | babylon | webgpu  | 80           | 140-145 |

Why void:

1. **The "fps" field measured host `requestAnimationFrame` ticks, not engine renders.** Measured
   on the production build: **139 host ticks against only 82 real renders** — a ~1.7× structural
   over-report. v2 adds `renderFps`, computed from the engine's own frame counter.
2. **140 fps is impossible on an iPhone.** rAF is vsync-locked, so fps can never exceed the panel
   refresh: iPhone is 60 Hz, or 120 Hz on ProMotion. v2 records `displayHz` so this is
   self-evident on screen.
3. **20–39 ms startup is impossible for the current engine.** `cosmos:ready` fires only after the
   star stream completes — 168,959 stars in 8,000-star chunks at `setTimeout(…, 16)` is **≥350 ms
   of timer delay alone**, before fetching/decoding 2.9 MB of PNGs. CI measures ~840–1270 ms on
   the same build. A sub-40 ms reading means the page was already warm, or `cosmos:ready` fired
   before the monitor attached.
4. Near-identical numbers across a desktop, an iPhone and a mid-range Android is not how real
   hardware behaves — a further sign the readings weren't isolating per-device render cost.

### Round 2 — record with the v2 instrument

`window.__ijPerf()` now returns `renderFps`, `displayHz`, `renderFrames` and a `device` block.
**`RENDER FPS` is the number the gate is decided on**; host-rAF fps is shown only for contrast.

| Device class         | Engine  | Backend | Startup (ms) | **RENDER FPS** | displayHz | renderFrames >0? | Budget fps | Pass? |
| -------------------- | ------- | ------- | ------------ | -------------- | --------- | ---------------- | ---------- | ----- |
| Desktop              | current | webgl2  | 1357         | 142            | 233       | Yes              | 60         |       |
| Desktop              | babylon | webgpu  | 1070         | 140            | 217       | Yes              | 60         |       |
| iPhone (Safari 26+)  | current | webgl2  | 1598         | 135            | 250       | Yes              | 60         |       |
| iPhone (Safari 26+)  | babylon | webgpu  | 1254         | 144            | 238       | Yes              | 60         |       |
| Mid Android (Chrome) | current | webgl2  | 1534         | 143            | 250       | Yes              | ≥ 40       |       |
| Mid Android (Chrome) | babylon | webgpu  | 1157         | 139            | 238       | Yes              | ≥ 40       |       |

**Round 2 FINAL (2026-07-18) — owner confirmed: the iPhone and Android rows were taken with
Chrome DevTools emulation; no physical phone was available.**

- ✅ **Desktop rows are valid** (real Windows hardware, 16 cores) and decide the gate:
  Babylon **140 fps / 1070 ms** vs current **142 fps / 1357 ms**, against a 60 fps floor.
- ⛔ **Mobile rows are NOT performance data.** Emulation runs on the desktop GPU at desktop
  refresh — which is why they read 135–144 fps, above any iPhone's 120 Hz ceiling. They are
  retained below as a **functional/layout** result (the scene mounts, renders and behaves
  correctly at phone viewports, no errors) — which is genuinely useful, just not fps.
- ➡️ Outcome: **conditional GO** — [ADR-0003](../adr/0003-babylon-webgpu-renderer-adoption.md).
  B2 proceeds; Babylon does **not** become default until a real device is measured.
- 📱 Cheapest way to close the gap later: a physical **Android** over `chrome://inspect` (free),
  or a cloud device lab. Also confirm the badge reads `BABYLON WEBGPU` — the `Backend` column
  below was pre-filled from the template, not observed, so the WGSL twin's real-hardware
  execution is still unconfirmed.

---

**Earlier assessment (TR-033), retained: DESKTOP ROWS STAND · MOBILE ROWS INCONCLUSIVE.**

- ✅ **Startup figures are now credible** (1.0–1.6 s, matching CI's 840–2626 ms).
- 🐛 **`displayHz` 217–250 was an instrument bug** (min-delta estimator latching onto one
  coalesced-callback frame). Fixed to a 10th-percentile estimate; those Hz values are void, but
  they did not affect the RENDER FPS readings.
- ⛔ **iPhone rows are physically impossible.** `RENDER FPS` 135 and 144 exceed every iPhone panel
  (120 Hz ProMotion max, else 60 Hz), and rAF is vsync-locked. Combined with all six rows sitting
  in a 135–144 band, the leading hypothesis is **DevTools device emulation rather than physical
  hardware** — emulation changes viewport/UA but runs on the desktop GPU at desktop refresh.

**To settle it,** re-read one Babylon row on the real iPhone and paste
`JSON.stringify(window.__ijPerf().device)`. A real phone reports `iOS`, a phone-sized screen,
dpr 2–3 and a low core count; emulation reports desktop cores and now self-flags
`⚠LOOKS EMULATED` in the overlay.

**Reject any row where:** `renderFps > displayHz` (impossible) · `renderFrames` is 0 or null (the
scene is not drawing) · `startupMs` < 300 for the _current_ engine (page was warm — hard-reload
with cache disabled) · the `device` block is identical across rows that claim different hardware ·
`renderFps` exceeds the device's known panel ceiling (60/120 Hz phones) · the overlay's device line
shows `⚠LOOKS EMULATED`.

Paste the raw `JSON.stringify(window.__ijPerf())` per row if in doubt — it self-documents the
device.

## Decision rule (the gate)

- **GO** → Babylon meets every device row's fps floor and its startup target
  ([budget table](../delivery-plan/PF-09-babylon-havok-realism.md#budgets--platform)), at a
  bundle already under budget. Write the superseding ADR (supersedes ADR-0002) and proceed to
  B2.
- **NO-GO** → any device class misses its floor and can't be tuned within the spike. Keep the
  current engine as default, record the negative result in the ADR, and cherry-pick isolated
  Babylon upgrades instead of a full migration.

## Caveats to note while measuring

- The spike renders a **representative** 168k-star field (procedural), not the full catalog +
  photometric/relativistic shaders — so its fps is an **upper bound** on the real scene. Treat a
  marginal pass as a fail.
- **WGSL twin is now in place** (TR-029) so a WebGPU device runs native WGSL — but it has
  **never executed on real WebGPU hardware** (CI has no adapter). Your run is its first. If the
  Babylon page errors or the badge reads `WEBGL2` on a WebGPU-capable browser, capture the
  console output — that is a finding, and the fps reading for that device is not yet valid.
- Stars are **billboard quads**, not point sprites — WebGPU has no `gl_PointSize` (TR-029). This
  costs ~23 MB of vertex data vs ~2.7 MB for the live engine, and is a known B2 optimisation
  target; it makes this fps reading somewhat pessimistic on memory-constrained phones.
- Useful in the console: `document.querySelector("babylon-scene").sceneStats()` reports the
  backend, star count, active indices and material readiness — handy if a device looks wrong.

### Sanity check before you record anything

On a correct page you should see the perf overlay top-left and a rendered scene. Confirm in the
console:

```js
window.__ijPerf(); // → { engine, tier, startupMs, renderFps, displayHz, renderFrames, device, … }
```

If `__ijPerf` is `undefined`, the React island did not hydrate — **the numbers on screen are not
real**. Check the console for errors (`_jsxDEV is not a function` means a stale dev dep-cache,
TR-031) and fix that before measuring. Reference readings from headless CI on a production build
(SwiftShader, so fps is meaningless — startup is the useful part): current engine
`startupMs 843`, Babylon `startupMs 883`.
