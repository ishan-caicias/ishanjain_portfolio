# CLAUDE.md

Gamified astronomy portfolio: an Astro static site whose hero is a real-time 3D space scene —
fly a ship through a 168,959-object star catalog, warping between portfolio sections docked to
real celestial objects. Treat `src/lib/` as a small game engine, not as page code.

Owner priorities, in order: **rendering/simulation quality → measured performance → native feel
on every device.** The site is the demonstration of engineering skill.

## Orientation — read before trusting anything

This file holds only durable rules. **Everything volatile lives in `docs/` and must be read
there, never assumed:**

| Question                            | Authoritative source                                                         |
| ----------------------------------- | ---------------------------------------------------------------------------- |
| Current phase / what's shipped      | `docs/delivery-plan/` (status header)                                        |
| HOW to build the current plan       | `docs/implementation/` (technical companion; delivery plan wins on conflict) |
| Latest verification + test counts   | `docs/test-reports/README.md` (last row)                                     |
| Why a decision was made             | `docs/adr/` + `docs/adr/README.md`                                           |
| Known gaps between the two engines  | `docs/analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md`             |
| Architecture + the dual-engine seam | `docs/architecture/overview.md`                                              |

**Never quote a test count, version, or phase status from memory or from this file.** Run the
command or read the index. Stale numbers in docs are how the last major drift happened.

## Commands

```bash
npm run build          # prebuild: assets:verify → lint && check && astro build
                       # && short-circuits — a stale asset fails BEFORE lint; lint failure hides typecheck
                       # lint = eslint . && prettier --check .
npm run test           # vitest run
npm run test:e2e       # playwright — REQUIRES a fresh `npm run build` first
npm run budget:check   # CI bundle gate; needs dist/
npm run docs:check     # mechanical doc-drift gate (stale engine-default claims, index/status mismatches)
npm run assets:craft   # regenerate tiered ship GLBs (never hand-edit them)
```

- **Full local gate:** `npm run build && npm run test && npm run test:e2e && npm run budget:check`
- **E2E always needs a fresh build** — Playwright serves the prebuilt `dist/`. A stale `dist/`
  silently tests old code.
- **`dev`/`preview` run `assets:sync` first, `build` runs `assets:verify`** — the same planet
  texture/VT/atlas pipeline, but `sync` regenerates stale artifacts while `verify` fails on them.
  A build that dies before any lint output is this, not your code.
- **Determinism check:** `npx playwright test --workers=1 --retries=0`
- **Perf measurement:** `npm run build && npm run preview`, then `/?perf=1` — cold load, record
  RENDER FPS and the device signature line. **Never measure on `astro dev`** (~4× distortion).
- Runtime escape hatches: `?engine=webgl` · `?craft=off` · `?tier=lite` · `?perf=1`.
  Resolution order everywhere: **URL param → stored override → device policy → default**.

## The dual-engine seam

`src/lib/engine-select.ts` is the single decision point. `<babylon-scene>` (Babylon 8 +
WebGPU, WebGL2 fallback) is the **default**; `<space-engine>` (bespoke WebGL1) is **archived in
place** behind `?engine=webgl` as the rollback lever. Both implement the same `cosmos:*` event
bus and `travelTo`/`goHome`/`randomBody`/`setStations` surface.

**They are NOT at feature parity.** Before assuming a behaviour exists on the default path,
check the gap analysis. Do not change the default engine without an ADR.

## Non-negotiables

Each cost a real defect. Sources in `docs/test-reports/`.

**Bundle**

1. **NEVER import the `@babylonjs/core` barrel** — subpath imports only. The barrel doesn't
   tree-shake (1.1 MB gz vs 329 KB). `budget:check`'s largest-chunk gate is this canary. (TR-027)
2. **Adding a Babylon feature? Import its side-effect module too** (`thinInstanceMesh`,
   `engine.computeShader`, `instancedMesh`). Tree-shaking drops prototype augmentation:
   builds clean, dies at runtime. (TR-029/046/048)
3. Keep `vite.optimizeDeps.exclude: ["@babylonjs/core"]` in `astro.config.mjs`. Switching to
   `include` breaks hydration site-wide via a 504 re-optimize. (TR-031)

**Shaders — YOU MUST**

4. **Ship both twins.** Every shader feature lands in GLSL _and_ WGSL, line-for-line parallel
   with identical identifier names, or is explicitly tier-gated. No compiler cross-checks them —
   unit tests assert the shader **source strings**. (TR-044/045)
5. **Never use `meta`, `ref`, `filter`, `common`, `handle`, `auto`, `typedef`, `union` as WGSL
   identifiers.** They're reserved; Chrome rejects the module and **the entire scene blanks**.
   A unit test guards this list — keep it. (TR-045)
6. **`materialReady: true` proves nothing.** WebGPU validates shader modules _asynchronously_;
   failures appear only as console errors. Real-hardware specs must assert **zero console
   output**. That assertion is the only thing catching this class. (TR-045)
7. WebGPU has **no `gl_PointSize`** — variable-size sprites must be billboard quads. (TR-029)
8. WGSL `textureSample` must be in **uniform control flow** — never branch around it; zero the
   offset instead. (TR-047)
9. **Every declared sampler needs a real texture object bound before that mesh ever draws** —
   not before the content is ready, before the JS object exists. `material.isReady()` checks
   shader compilation, not whether every sampler has a resource; on WebGPU an empty binding is
   a hard, uncaught exception building the bind group that kills `scene.render()` for the
   **entire frame**, not just that mesh (WebGL2 only warns). If a texture builds asynchronously
   or in chunks, bind a placeholder immediately and swap it once real content lands. (TR-059)
10. Light textures in **linear space** (decode sRGB → light → tone-map → encode). (TR-021)
11. Pixel evidence on WebGPU comes from `page.screenshot()`, **never** `drawImage`+`getImageData`
    (a WebGPU canvas reads back transparent regardless of correctness). (TR-036)

**Security**

12. CSP is **hash-based with no `unsafe-inline`, ever.** React islands must never SSR a
    `style="…"` attribute or inject a runtime `<style>` — put CSS in `global.css` and set
    styles post-hydration via `el.style.prop`. (TR-016)
13. `astro.config.mjs` is the single source of CSP truth. New capabilities get a scoped
    directive + a comment + usually a TR. **No CDN dependencies** — self-host decoders/WASM.
    (ADR-0005)

**Testing**

14. **Never `test.fixme`/skip a failing test to unblock.** Root-cause it. Quarantine once
    nearly buried a real signal _and_ two further defects. (TR-054)
15. **No test may be modified to make the suite pass** unless the change is named and justified
    in the TR. An unexplained test edit is equivalent to a build failure.
16. Playwright `workers: 1` locally and in CI — GPU-heavy specs time-slice one SwiftShader
    emulator; more workers produce rotating phantom failures. (TR-052)
17. Specs guarding the archived engine must pin **every** `page.goto` with `?engine=webgl`.
    Specs asserting engine-agnostic mechanisms must accept `"space-engine, babylon-scene"`.
    (TR-054)
18. Assert **behaviour, not readiness**. `cosmos:ready` fires happily over a scene drawing
    nothing. Drive the real UI rather than calling engine methods directly. (TR-029/040)

**Platform & data**

19. Windows dev box. Playwright spawns `node ./node_modules/astro/bin/astro.mjs preview` — the
    `npm.cmd` shim crashes with `0xC0000409`. LF enforced via `.gitattributes`. (TR-012/013)
20. Node **≥ 22.12.0** in `package.json`, `.nvmrc`, CI, and `netlify.toml` — raising it is a
    4-file change or CI red-fails before parsing anything. (TR-034)
21. TypeScript pinned `~6.0.3`. **Do not upgrade to TS 7** — breaks `astro check` and typed
    lint. (ADR-0001)
22. Generated/vendored files are **never hand-edited**: `src/data/asteroids-dr3-physics.ts` and
    the other `scripts/`-emitted data modules, `public/assets/craft/*.glb`,
    `meshopt_decoder.js`. Regeneration goes through the pipeline that owns them.

    **`src/data/celestial/*.js` is a different case, clarified 2026-07-29** (PF-11 D6.6b
    hand-edited `celestial-catalog.js` while D5.4 in the same session used a new overlay module
    for the same class of change — rule and practice had diverged, which is itself the drift
    class this repo treats as a defect). These files are **hand-curated data verbatim-ported
    from the PF-07 prototype**, not machine output — nothing regenerates them, so "never
    hand-edited" was never enforceable and a wrong RA/Dec had nowhere to be fixed. The real,
    enforceable rules:
    - **Prefer an overlay module** for anything additive (new bodies, text/content overrides) —
      `celestial-missing-moons.js`, `celestial-saturn-moons.js`, `celestial-content-overlay.js`
      are the precedents. Overlays keep the base ports byte-identical to the prototype.
    - **A direct edit to the base ports is allowed only to correct data that is factually
      wrong**, must be the minimal field change, and must be named in a TR with the source that
      establishes the correct value. Anything larger, or anything additive, is an overlay.
    - They stay lint- and prettier-ignored either way; byte-identity with the prototype is now
      a strong default rather than an invariant (see `.prettierignore` / `eslint.config.js`).

**Accessibility — regression-tested, must not regress**

23. Babylon stamps `tabindex="1"` on its canvas; set `-1` at boot **and re-assert on first
    rendered frame** (deferred input setup re-stamps it). (TR-052)
24. `prefers-reduced-motion` is a per-feature contract on **both** engines and composes with
    any quality tier — it is not a tier. Every visual feature defines its reduced-motion and
    no-WebGL behaviour at design time. (TR-042/051)

**Delivery gate — vertical slices**

25. **Every vertical feature slice ends with the full gate executed and a manual regression
    pass — before the slice is called delivered.** Concretely: `npm run build && npm run test
&& npm run test:e2e && npm run budget:check` green at the end of EACH slice (not batched
    at phase end), plus a hands-on manual regression on the built preview (`npm run preview`):
    boot console-clean, travel to one near and one far body, arrival dossier open/dismiss,
    where-to search, classic-view toggle, and reduced-motion. A slice with failing or unrun
    tests is not done; unverified behaviour is how incidents ship. Test-count deltas and the
    manual-regression checklist go in the slice's TR.

**Verification economics** — added 2026-07-22 after the D0.1 run audit (TR-081): that slice
took 3h01m, of which **67% was the E2E suite running** and ~45 min was thrown away on a load
harness nobody had validated. The full suite is ~13 min at `workers: 1` and dominates every
slice from here on. These two rules are about not paying that twice.

26. **Calibrate a harness before you let it gate anything.** Any load generator, timing
    ceiling, or measurement rig you introduce gets ONE baseline validation run first — on the
    unchanged build — proving the suite is green under it. An uncalibrated instrument that
    goes red tells you nothing about your change. This is rule "an instrument needs its own
    validity checks" (below) applied to test harnesses, not just to `perf-telemetry`. D0.1
    ran three full suites (43 min) under an 8-worker load that a later control showed fails
    on the pre-change build too. (TR-081)
27. **Budget three full-suite runs per slice** — a mid-slice check, the final gate, and one
    spare. **Never run the full suite to characterize a single failing spec**: run that spec
    in isolation ×3-4, and against a `git stash`-ed baseline when you need to know whether
    it is yours. D0.1 spent 122 min across six full runs where isolation answered the same
    questions in three. Corollary: `npx prettier --write` the files you touched BEFORE
    `npm run build` — lint short-circuits the chain, so each miss costs a whole cycle.

**Also from that audit, not rules but true:** probe an environmental assumption before
implementing on top of it (a 60-second probe disproved D0.1's prescribed mechanism after the
implementation was already written), and pin under-specified exit criteria at PLAN time — "green
under load" with no load level named is what sent D0.1 down the wrong path.

**CI/CD**

28. **A CI job's `name:` and the branch-protection ruleset's `required_status_checks` context
    must match exactly, and change together.** A mismatch never fails loudly — the stale
    context simply stops reporting, so every future PR waits forever on a check that no longer
    exists. Found live 2026-07-29: `.github/rulesets/main-protection.json` still required
    `"E2E Tests"` four days after TR-106 renamed the job to `"E2E Smoke Tests"` — undetected
    only because `main` had never actually had the ruleset applied (`gh api` showed zero live
    protection despite the file existing since 2026-07-19). Renaming a `ci.yml` job is a
    two-file change: the workflow AND the ruleset, re-applied via `gh api` (see
    `.github/rulesets/README.md`). Also: every CI job that reads real files under
    `public/assets/` needs its own Git-LFS-pull step, not just the jobs that already have one —
    a default `actions/checkout` gets ~130-byte pointer stubs, not real bytes, and a job added
    later (D9.3's on-disk asset-size unit tests, added to `unit-test`) can reach that gap even
    though older jobs already worked around it. (docs/cicd/2026-07-29-cicd-devops-audit.md)

## Measurement discipline

**Measure, don't assert.** Perf claims come from `perf-telemetry.ts` on the device class in
question. DevTools emulation is a layout test, not a perf test.

**An instrument needs its own validity checks.** Reject any reading where `renderFps >
displayHz`, `renderFrames` is 0/null, `startupMs < 300`, or the device block repeats across
rows claiming different hardware. Three gate rounds were voided by instrument bugs, not by bad
data collection. "Consistent across heterogeneous hardware" is a warning sign. (TR-032/033/043)

**Read what the failing system actually says** before fixing what looks broken — the CI log,
the live page, the vendor's source. Verify a patch landed in the file _and_ in the rendered
output. (TR-034)

## Documentation contract

Documentation drift here is a defect, not untidiness — it caused a full re-audit. **When you
change these, update their doc in the same turn:**

| Change                                                 | Also update                                             |
| ------------------------------------------------------ | ------------------------------------------------------- |
| Any verification pass                                  | New `docs/test-reports/TR-NNN.md` + a row in its README |
| Engine default, renderer, CSP posture, new runtime dep | An ADR + `docs/adr/README.md`                           |
| A delivery-plan phase advances                         | Plan status header + `docs/timesheeting/<plan>.md`      |
| Architecture, data flow, or the engine seam            | `docs/architecture/overview.md` + `component-flow.mmd`  |
| Anything contradicting the root `README.md`            | `README.md`                                             |

**Corrections are additive.** Never edit a wrong claim away — supersede it in a new TR, or
strike it through in place with a dated forward pointer. TRs and ADRs are dated records of
what was believed at the time; the history is load-bearing. Rewriting it silently is the one
unforgivable move in this repo.

Run `npm run docs:check` to catch the mechanical drift class (stale engine-default claims,
index/status mismatches).

## Conventions

- Astro islands: `client:load` only for SpaceScene; `client:idle`/`client:visible` otherwise.
- Portfolio content lives in typed `src/content/*.ts`; celestial data in `src/data/celestial/`.
- Tailwind v4 CSS-first `@theme` tokens in `src/styles/global.css` — no config file.
- Frame budget: 16.6 ms desktop / 25 ms mid-Android. No per-frame allocation in the render loop.
- Smallest coherent change. Preserve existing intent. Patterns only when they pay for a
  present problem.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:

- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).
- `graphify-out/` is **generated** — never hand-edit it; regenerate via `graphify update .`. It is
  gitignored (7.4 MB of derived output that would churn on every commit); `.graphifyignore` is the
  hand-maintained input and belongs in the repo.
