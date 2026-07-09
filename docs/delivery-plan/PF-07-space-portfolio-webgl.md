# PF-07 — Interactive Outerspace Portfolio (WebGL Space Scene)

**Status:** All 6 phases complete and verified (browser-rendered against the real homepage, typecheck/lint/unit/e2e/build all green). `Starfield.tsx`/`StarModal.tsx`/`public/hubble/` retired.
**Branch:** `feature/PF-07/background-v-0-2` (cut fresh from `main` @ `07ed864` — no prior PF-07 work carried over; a previous, smaller "hero background reveal" attempt from an earlier session was never committed and no longer exists on disk)
**Source of truth:** `Interactive Outerspace Portfolio/` prototype folder (unzipped in-repo, untracked), specifically `CLAUDE_CODE_HANDOFF.md`, `Space Portfolio.dc.html`, `space-engine.js`, `celestial-*.js`, `DATA.md`, `FULL-DATASET-PIPELINE.md`
**Mode sequence:** DISCOVER (done) → PLAN (this doc) → IMPLEMENT (phased) → VERIFY per phase → REVIEW → HARDEN → DOCUMENT

---

## 1. What this actually is

Not a background-image feature — a full alternate site experience: a WebGL star-flight scene
(168,883 real objects: full Hipparcos catalog + a typed Gaia/SDSS/NASA deep layer) with relativistic
warp travel between portfolio sections, each docked to a real celestial object. Toggleable back to a
classic scrolling page.

The prototype is **not written in React** — it's a proprietary template DSL (`<x-dc>`, `<sc-for>`,
`<sc-if>`, `{{ }}` bindings, a `class Component extends DCLogic` logic class) built by a sandbox tool
(`support.js`, confirmed to be a generated React wrapper — "GENERATED from dc-runtime/src/\*.ts").
**This means "lift and shift" is accurate for the WebGL engine and data, but the UI layer requires a
genuine hand-translation into JSX/React hooks, not a mechanical port.**

### Verified architecture (full detail: session transcript / re-derivable via the same Explore pass on the prototype folder)

| Piece                                                                                                                                                                                                                                                    | Size                                             | Portability                                                                                                                                                                                                                                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `space-engine.js` — real `customElements.define("space-engine", ...)`, hand-rolled WebGL, custom relativistic-aberration/Doppler shaders, procedural Milky Way texture, hand-parsed `.obj` ship model, adaptive quality tiers, PNG-packed star streaming | 1473 lines                                       | **High** — genuinely portable near-verbatim; mount via `useRef`+`useEffect` from React, per the handoff's own "less invasive" recommendation. Public API is a clean, already-decoupled event/method contract (`cosmos:*` events, `travelTo/goHome/randomBody/setStations/fieldInfo`).                                             |
| `celestial-catalog.js` / `-extra.js` / `-extra2.js` / `-gaia.js` / `-imgmap.js`                                                                                                                                                                          | ~5230 lines                                      | **High** — overwhelmingly flat data tables (arrays of objects/compact rows), not logic. Mechanical conversion to typed `.ts` modules.                                                                                                                                                                                             |
| `assets/*` (38MB: star/deep-layer PNGs, photo atlas, 1203 DSO images across 3 tiers, planet textures, ship OBJ)                                                                                                                                          | 38MB                                             | **High** — direct copy. Kept as `public/assets/` (not renamed) so the dozens of existing relative path references across the engine and data files resolve unchanged — renaming would require hunting down every reference across ~8500 lines.                                                                                    |
| DC template (`Space Portfolio.dc.html` markup body)                                                                                                                                                                                                      | 1818 lines total (template ends ~line 1018)      | **Low** — hand-translate every `{{ }}` binding and `sc-for`/`sc-if` block into JSX.                                                                                                                                                                                                                                               |
| `DCLogic` subclass (`state`, ~18 methods, `renderVals()`'s ~15 computed-property groups)                                                                                                                                                                 | ~800 lines                                       | **Low** — hand-translate into `useState`/`useEffect`/`useMemo`/`useCallback`. This is the single largest and highest-risk piece: a warp-sequencing state machine driven by 9 custom events, 3 collector-card visual variants, 3 section-panel visual variants, mission-control autocomplete, a hand-rolled canvas globe renderer. |
| `data/build/*.js` (streaming parsers for the raw Gaia Sky packs)                                                                                                                                                                                         | 247 lines + missing exec body in `03-curated.js` | **Deferred, likely not needed.** Per `DATA.md`, every runtime asset is already derived and committed — the raw `gaia_datasets/` pipeline is only needed to _regenerate or extend_ the dataset (e.g. the full DR3 octree upgrade `FULL-DATASET-PIPELINE.md` describes). Not required to ship the site as designed.                 |

### Not required for launch

`data/build/`'s streaming/octree work (§3 of the handoff) only matters if you want to go beyond the
already-shipped Hipparcos-full/Gaia-sample dataset to the full 957M-row DR3 octree. That's a distinct,
separately-scoped upgrade — out of this plan unless you ask for it explicitly.

---

## 2. Phase Breakdown

Each phase ends with a working, verified increment — not a partial port. Phases 2 and 3 can be
reordered or Phase 3+ deferred entirely if you'd rather ship "starfield + travel, no cards" first —
flag that if so.

### Phase 1 — Engine + data port, minimal verified render ✅ DONE

- Copied `assets/` → `public/assets/` verbatim (38MB, kept the folder name unchanged so every
  relative path reference across engine + data files resolves with zero rewrites).
- Copied `space-engine.js` → `src/lib/space-engine.js` verbatim (byte-identical, MD5-checked).
- Copied the 5 `celestial-*.js` files → `src/data/celestial/*.js` verbatim (byte-identical except one
  appended no-op `export {};` line per file, needed so TypeScript treats them as modules for dynamic
  `import()` — no data content touched). Typed consumption via one hand-written ambient
  `src/data/celestial/celestial.d.ts` (`CelestialEntry` interface + `Window` global typings) instead of
  hand-converting ~5,200 lines of literal astronomical data, which would have real transcription-error
  risk for no real benefit.
- `SpaceScene.tsx` React island: dynamically imports the engine + data modules inside `useEffect`
  (required — `client:load` islands still execute module-scope code during Astro's SSR pass, and
  `class SpaceEngine extends HTMLElement` crashes in Node; deferring to client-only fixed it), mounts
  `<space-engine>` full-viewport. One ambient `space-engine.d.ts` gives it a typed JSX intrinsic
  (had to augment `declare module "react" { namespace JSX {...} } }`, not the bare global `JSX`
  namespace — React 19's types nest JSX under `React.JSX`).
- Temporary verification route `src/pages/space-test.astro` (bare page, no BaseLayout/header/footer) —
  keeps this phase additive/non-destructive to the live site; remove once Phase 4 wires the real thing
  into `index.astro`. _(This was missed at the time - it stayed on disk through Phases 2-5, building
  into `dist/space-test/` and appearing in the production sitemap with no `noindex`/robots exclusion.
  Caught and removed during a full delivery-plan audit after Phase 6 - see §5.)_
- Also fixed: `astro.config.mjs` didn't read a `PORT` env var, which broke this session's preview
  tooling (unrelated pre-existing gap, fixed opportunistically since it blocked verification).
- **Exit criteria — met**: verified live in a real browser (screenshot: streaming starfield, gold
  constellation lines, wireframe ship, photographic DSO billboards all rendering). Zero console errors,
  all asset requests 200. `npm run check` 0 errors, `npm run test` 25/25 pass (untouched, unaffected),
  `npm run build` succeeds (~26s, `dist/` 43MB including the 38MB asset payload — bundle-size reduction
  is Phase 5's job, not Phase 1's).

### Phase 2 — Core chrome (HUD, mission control, warp overlay, arrival vista) ✅ DONE

Ported as 4 presentational components under `src/components/islands/space/` (HUD, HoverTooltip,
MissionControlBar, WarpOverlay), with the pure computation logic (`fmtDist`, `rarityColor`, `fmtRa`,
`fmtC`, `figGeom`, field-star dossier synthesis) extracted to `src/lib/spaceHelpers.ts` so it's
testable independent of React.

**Deliberate simplification vs. the source**: the mission-control bar is fixed at bottom-center
rather than dynamically tethered below the spaceship every frame (the source's `_sprTick` rAF loop
computes this from `en.ship.x/y` plus a "dodge zone" around hero copy that doesn't exist in this
component yet). Station-sprite positioning and mascot positioning are deferred to Phase 4 entirely,
where that DOM context will exist. `en.setStations(...)` is still called once on mount so
mission-control search can travel _to_ a station even without the visual sprite markers.

**Exit criteria — met**: verified live via the RNG button and direct `cosmos:*` event dispatch
(the preview browser tab runs backgrounded, which throttles `requestAnimationFrame` and froze the
engine's own warp animation at t=0 — confirmed via `document.hidden === true`; this is a testing-
harness artifact, not an app bug, and doesn't affect the real deployed site). HUD showed real live
data (`ONLINE · 168,959 LIVE SOURCES · 2525 CHARTED`), warp overlay correctly resolved a random
destination name (`NGC 752`) and rendered the "ALIGNING TRAJECTORY" phase text.

### Phase 3 — Collector cards + section overlays ✅ DONE

Ported `CollectorCard.tsx` (3 visual variants, globe canvas renderer, constellation figures, stats
bars, sky-lore, style switcher, tilt-on-hover) and `SectionOverlay.tsx` (3 display variants, all 8
section bodies - About/Experience/Achievements/Projects/Skills/Contact/Moon Base/Credits). Content
for About/Experience/Achievements/Projects/Skills is reused from the existing `src/content/*.ts`
modules (word-for-word match confirmed against the prototype's hardcoded copy) rather than
re-duplicated a third time - required extracting `Credibility.astro`'s inline array to a new
`src/content/credibility.ts` and de-duplicating `Achievements.astro`'s local icon-path map into
`src/content/icons.ts`, since both were about to be duplicated a third time otherwise.

**Exit criteria — met**: verified live via synthetic `cosmos:arrive` dispatch to `m42` (Orion
Nebula) - full collector card rendered with correct rarity gems (◆◆◆◆◆ for legendary), stats,
field note, both lore entries, and the NASA image loaded with zero failed network requests.
Confirmed the "re-arrival at the same body opens the dossier directly" branch fires correctly
(exact source behavior). Verified all 3 card style variants (holo/dossier/plate) and 2 of 3 section
display variants (dossier/console) switch correctly via live DOM inspection of the resulting classes.
Verified the Credits section overlay renders all 18 attribution rows with exact source text.

### Phase 4 — Station wiring + content/theme reconciliation (handoff §2) ✅ DONE

Wired header nav links to `travelTo` via document-level click delegation (zero changes needed to
`Header.astro` - it already emits exactly the `#about`/`#experience`/etc. links the delegate
expects), built all 7 station sprite markers with their 6 distinct craft-icon SVGs
(`CraftIcons.tsx`), wired the travel/scroll-mode toggle (added to `HUD.tsx` rather than
`Header.astro`, to avoid touching a shared component for a scene-specific control), and the
scroll-mode `IntersectionObserver` section routing (ship follows the section scrolled into view).

**Theme reconciliation turned out to be a non-issue**: the prototype's hardcoded hex palette
(`#ffd54f`, `#3f51b5`, `#7986cb`, `#0a0e27`, etc.) is bit-for-bit identical to this repo's existing
`global.css` `--color-royal-*`/`--color-gold-*`/`--color-pine-*` tokens - confirmed by direct
comparison, not assumed. The components use raw hex arbitrary values rather than the semantic
Tailwind classes (`text-[#7986cb]` vs. `text-royal-300`) - a real but purely cosmetic cleanup
opportunity for a later polish pass, not a functional risk since the values are identical.

**Deliberately descoped**: the prototype's scroll-mode DOM `<footer>` (moon-landscape SVG) was
**not** ported - it's cosmetically separate from the "Moon Base" travel _station_, which already
has a full experience via `SectionOverlay`'s moonbase panel (Phase 3). The existing Earth-surface
footer + `MissionControl` island already serves the same functional purpose (site info, quick
links) in scroll mode, so swapping the SVG would be pure visual polish, not new functionality.

**`Starfield.tsx`/`StarModal.tsx` are now unused but not deleted** - `Hero.astro` no longer imports
either, and a repo-wide search confirms nothing else does either (both are tree-shaken out of the
production build already). Per the earlier lesson in this same engagement (deleting pre-existing
shipped files needs the user's explicit confirmation, not just a general "continue"), this was left
as an open decision rather than actioned unilaterally - see [TR-003](../test-reports/TR-003.md).
_(Later retired in Phase 6, once the user explicitly directed that phase to completion - see below.)_

**Exit criteria — met**: verified live against the **real homepage** (not just `/space-test`) -
clicking the actual header's "About" link triggered a real warp, arrival, and the correct
`SectionOverlay` content; the travel/scroll toggle correctly shows/hides sections and the footer
both directions; all 7 stations correctly registered with the engine and have live projected
screen coordinates. Station sprite _visual_ positioning could only be verified by tracing the
`show` condition against confirmed live state (not screenshot-observed) due to the same
`document.hidden`-throttling test-harness artifact documented in TR-001/TR-002 - see TR-003's
Known Limitations for the full explanation.

### Phase 5 — Testing & accessibility (handoff §4) ✅ DONE

Verified live: scene mount, catalog data stream, hover/travel/dossier flows, console-clean (dev
smoke test). Bundle-size audit measured directly via live network inspection instead of Lighthouse
(no CLI harness configured in this repo): initial payload ≈7.1-7.3MB (textures + JS, gzip'd),
within the prototype's own "~7-10MB" target; confirmed none of `dso/`/`dso2/`/`dso3/`/`planets/`
(≈31MB of the 38MB asset folder) load until arrival at that specific body. Mobile viewport (375×812)
verified clean. WebGL fallback (`_domFallback()`) verified via a real e2e test that stubs
`getContext` - confirmed it engages and navigation still works via the engine's `noGL` branch.
`prefers-reduced-motion` confirmed on both layers (engine's own halved durations + `global.css`'s
pre-existing blanket CSS rule, which already covered every DC-layer keyframe with no changes
needed).

Replaced `tests/e2e/star-interaction.spec.ts` (tested the now-unmounted `Starfield`/`StarModal`)
with `tests/e2e/space-scene.spec.ts` (10 tests: mount, travel, dossiers, WebGL fallback, reduced
motion). Updated `navigation.spec.ts`/`accessibility.spec.ts` for travel-mode-by-default and fixed
stale content assertions that pre-dated this branch (confirmed via `git diff main` - latent
failures, not introduced here).

**Two real bugs found via the new e2e coverage and fixed** (not worked around): (1)
[HUD.tsx](../../src/components/islands/space/HUD.tsx)'s travel/scroll mode toggle button was
wrapped in `aria-hidden="true"`, hiding a functional keyboard control from assistive tech; (2) HUD
containers had no `z-index`, so roaming station sprites (`z-index: 5`) could paint over and
intercept clicks on HUD controls - fixed by giving both HUD containers `z-10`.

Also fixed, opportunistically (blocking a working `npm run lint`): `eslint.config.js`/
`.prettierignore` never excluded the untracked 39MB prototype folder, the untracked 1.6GB
`gaia_datasets/` dump, the Phase-1 verbatim-ported engine/data files, or the pre-existing
`.claude/`/`coverage/` dirs - full-repo lint was effectively unusable (1000+ false positives,
prettier OOM crash) and TR-001/002/003 had been silently scoping around it rather than fixing it.

**Exit criteria — met**: see [TR-004](../test-reports/TR-004.md) for the full BUILD-VERIFY-REPORT.

### Phase 6 — Rollout (handoff §5) ✅ DONE

Retired `Starfield.tsx`/`StarModal.tsx`/`src/utils/hubble.ts`/`public/hubble/` via a normal commit
(kept in git history per the handoff's instruction, not hard-deleted-and-purged). Removed their
now-dead unit tests, the unused `HubbleEntry` type, the `PUBLIC_NASA_API_KEY`/`.env.example`
plumbing (confirmed unused anywhere else), and updated `README.md`/`docs/architecture.md`/the two
`docs/diagrams/*.mmd` files to describe the space scene instead of the retired canvas starfield.

Deploy-checklist items: `og:image` already resolves to an absolute URL via `new URL(..., Astro.site)`

- confirmed correct, no change needed. Font strategy required no reconciliation - confirmed via
  repo-wide search that the React port never introduced a competing Google Fonts CDN reference; the
  existing self-hosted Inter/Space Grotesk convention was untouched by this work. Added a
  `netlify.toml` `/assets/*` cache-control rule (immutable, 1yr) matching the existing `/fonts/*`
  pattern, and removed the now-dead `/hubble/images/*` rule.

**Not part of this delivery plan** (flagged for separate follow-up, out of scope here): `public/fonts/*.woff2`
and `public/og-image.png` are pre-existing 0-byte placeholder files (present since the initial
"Project setup" commit, unrelated to PF-07) - self-hosted fonts and the social-share preview image
have silently never worked. Flagged as background-task suggestions rather than fixed here since
neither is part of the space-portfolio scope and neither has real content to populate them with.

**Exit criteria — met**: see [TR-005](../test-reports/TR-005.md) for the final BUILD-VERIFY-REPORT.

---

## 3. Open Items — Resolved

- **Theme/hex reconciliation** — resolved in Phase 4: the prototype's hex palette is bit-for-bit
  identical to this repo's existing `global.css` tokens.
- **Font strategy** — resolved in Phase 6: no reconciliation needed, the React port never
  introduced a competing Google Fonts CDN reference.
- **Bundle size** — resolved in Phase 5: ≈7.1-7.3MB initial payload (measured via live network
  inspection), DSO imagery confirmed lazy-on-warp.
- **`data/build/` pipeline** — still deliberately out of scope per §1 unless the full-DR3-octree
  upgrade is wanted later.

## 4. Follow-ups Flagged, Not Fixed (Out of PF-07 Scope)

Discovered incidentally during Phase 5/6 verification; neither blocks this delivery plan nor is
caused by it (both pre-date the branch). Flagged as background-task suggestions rather than
actioned here:

- `public/fonts/inter-var.woff2` and `public/fonts/space-grotesk-var.woff2` are 0-byte placeholder
  files - self-hosted fonts have silently never loaded.
- `public/og-image.png` is a 0-byte placeholder file - the `og:image`/`twitter:image` meta tags
  resolve to a correct absolute URL, but the image itself is empty.

## 5. Post-Phase-6 Audit (full re-verification against actual repo state, not the doc's own claims)

Re-checked every concrete claim in this document against the filesystem, git, and a fresh
typecheck/unit/e2e run rather than trusting the prior session's own summary. Current state
(8/8 unit, 23/23 e2e, 0 typecheck errors) confirmed still green - Phases 1-6's actual
implementation had no regressions. Found and fixed three real gaps, all cleanup/documentation
issues rather than functional defects:

1. **`src/pages/space-test.astro` was never removed** despite Phase 1's own comment saying to
   remove it once Phase 4 wired the real thing in. It built into production `dist/space-test/`
   and - since `robots.txt` has no disallow rule - **was included in the generated sitemap and
   fully crawlable/indexable**, a bare unstyled page with no SEO meta reachable at
   `https://ishanjain.dev/space-test/`. Deleted (was never git-tracked, confirmed via
   `git status`, so no history loss).
2. **`docs/test-reports/README.md`'s index was missing TR-004 and TR-005** (Phase 5/6's reports) -
   added.
3. **Phase 4's section text was self-contradictory** - it still said `Starfield.tsx`/`StarModal.tsx`
   were "unused but not deleted," which the Status line and Phase 6 section both correctly
   contradict (they were deleted in Phase 6). Annotated with a forward-reference rather than
   rewritten, to preserve the historical record of when each decision was actually made.

No other phase's claims were found to be incomplete, pending, or inconsistent with actual repo
state as of this audit.

## 6. Second Audit (post-CI-fix, post-mobile-audit) - Prototype Folder Recovery

A second full audit, re-run after the CI prettier fix and the mobile/classic-view CSS stacking
fixes (both since committed as `5b4fb34` and `57a3f6f`, confirmed pushed to `origin` via a fresh
`git fetch` - an earlier "ahead 1" reading in this audit was stale cached remote-tracking data,
not an actual unpushed-changes gap).

Full re-verification (typecheck, lint, unit, build, e2e) confirmed green with no regressions
(23/23 e2e passing). One real, significant gap found:

**The `Interactive Outerspace Portfolio/` prototype folder - this document's own named "Source of
truth" (see line 5) - was completely gone from disk.** It was always untracked by design (never
committed, treated as disposable reference material), so there was no git history to recover it
from; a full-drive search found no trace. Restored from the user's original copy at
`F:\dev\data\portfolio\Interactive Outerspace Portfolio` (42MB).

Having the source back enabled a full re-verification of Phase 1's port-fidelity claims, this
time by direct comparison rather than trusting the prior session's own record:

- `space-engine.js`: MD5-identical to source, confirmed byte-for-byte (`ca5865774e03248f03c86073c38aed09`
  on both sides).
- All 5 `celestial-*.js` files: differ from source *only* by the documented appended `export {};`
  line - confirmed via direct `diff`, no data content touched.
- `public/assets/`: 1228 files on both sides, zero differences in the file list (verified via
  `diff` of sorted relative paths) - the asset copy is complete, nothing missing or extra.

**One pre-existing data gap confirmed, not a port error:** `assets/dso/HUDF.webp` (Hubble Ultra
Deep Field) is a 0-byte file **in the original prototype source itself**, not something the PF-07
port broke - confirmed by checking the restored source copy, which has the identical empty file.
Fixing it requires sourcing a real replacement image (e.g. from NASA/ESA's public-domain HUDF
release) rather than re-copying, since there's nothing valid to copy from.

**Fixed**: downloaded the official 2004 HUDF release (`heic0611b`) from
[esahubble.org](https://esahubble.org/images/heic0611b/) (screensize JPEG, 1280×1280, CC BY 4.0 -
"NASA, ESA, and S. Beckwith (STScI) and the HUDF Team"), resized/converted to 960×960 WebP via
`sharp` to match the sibling DSO images' convention (`M42.webp` etc.), and replaced the empty file.
No new Credits-section attribution needed - the existing generic entry ("NASA / ESA · Hubble &
JWST archives... public domain per NASA media guidelines," `SectionOverlay.tsx`) already covers
this image. Verified end-to-end: `git lfs status` shows the correct OID transition from the empty
file's hash to the new content's hash; live-dispatched `cosmos:arrive` for `hudf` and confirmed
the collector card renders the image (`fetch('/assets/dso/HUDF.webp')` → 200, `image/webp`, 98,248
bytes, matching the file on disk exactly) with correct alt text, stats, and field note. Full
suite re-verified green after the change: build succeeds, 23/23 e2e passing.
