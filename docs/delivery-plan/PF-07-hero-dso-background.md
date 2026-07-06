# PF-07 — Hero DSO Background Reveal

**Status:** Implemented — D1 confirmed (retire `StarModal`/Hubble modal), see [TR-001](../test-reports/TR-001.md) for VERIFY results
**Recommended branch:** `feature/PF-07/hero-dso-background`
**Mode sequence:** DISCOVER (done) → PLAN (done) → IMPLEMENT (done) → VERIFY (done, READY TO PROCEED) → REVIEW → HARDEN → DOCUMENT (this update)

---

## 1. Scope

Extend the existing "click a golden star" interaction so it reveals a real astrophotography
image of the corresponding deep-sky object (DSO) **in the hero background itself**, instead of
opening a modal popup — using the ~60-object curated image set that already exists on disk but
has never been wired into the app.

Confirmed with the user:

| Decision    | Answer                                                                                                                                                |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backdrop    | Starfield canvas stays the default background; DSO photos are additional clickable content, not a permanent replacement or a blended always-on layer. |
| Selection   | Not random/rotating — the image shown is exactly the object whose star was clicked.                                                                   |
| Attribution | A small **persistent** credit line while a DSO background is active (not click-to-reveal).                                                            |

Net effect: the existing `starclick` → `StarModal` popup flow is replaced by `starclick` → **in-place
hero background crossfade** to that object's photo, with a small credit line and a way back to the
animated starfield.

## 2. Current State (verified this session)

### Architecture already in place

- `Starfield.tsx` renders 200 regular stars + `specialStarCount` (default **6**) gold "special"
  stars. Each special star gets a `hubbleIndex` (0–5) matching its position in
  `public/hubble/data.json`. Click → `window.dispatchEvent("starclick", { hubbleIndex })`.
- `StarModal.tsx` listens for `starclick`, looks up `hubbleData[hubbleIndex]`, opens a focus-trapped
  modal dialog with image + title + description + credit + source link.
- `src/utils/hubble.ts` loads `/hubble/data.json` at runtime (not a typed content import), with a
  minimal in-code fallback, plus an optional/unused `fetchNasaApod()` for NASA's APOD API.
- Only **6** Hubble entries exist today: Pillars of Creation, Carina Nebula, Deep Field, Orion
  Nebula, Whirlpool Galaxy, Eagle Nebula.

### Git history context

- Current branch `feature/PF-06/init` was already merged to `main` via PR #4 (commit `07ed864`) —
  its committed work ("Update content") is shipped. Everything below is **uncommitted** working-tree
  state sitting on top of that already-merged branch.
- `feature/PF-02/update-theme` is a large (1.2M-line diff) abandoned branch exploring a much more
  elaborate direction — NASA quality filter, cosmic background, spaceship orchestrator, AR card,
  golden-stars variant, logo mark, mercury footer. It was never merged and predates the current
  simpler architecture. **Not a resumption target** — noted only so it isn't mistaken for live work.
- `feature/PF-05/init` has no unique commits; it's an unused placeholder.

### Uncommitted work found in the working tree

1. **Cosmetic-only edits** (unrelated to the background feature): em-dash → hyphen replacements in
   `README.md`, `public/hubble/data.json`, and an AWS service-list correction in
   `Credibility.astro`. Low risk, should ship as their own small commit, separate from this feature.
2. **`docs/project-evaluation.md`** — a self-review scoring the repo 88/100, recommending (a) a CI
   coverage gate and (b) deduplicating StarModal's inline Hubble fallback. Unrelated to this
   milestone; carried forward as backlog (§7).
3. **The actual background work-in-progress:**
   - `public/hero-dso/` — **59** curated DSO images + one `<id>.attribution.json` per image
     (Wikimedia Commons source, pre-filtered to Public Domain / CC0 / CC BY only).
   - `scripts/hero/rejected.json` — 29 candidates logged as rejected, all for
     `LICENSE_NOT_ALLOWED_BY_POLICY` (CC BY-SA / copyleft not allowed by the same policy).
   - **No manifest, loader, type, or UI consumes these yet** — the curation/licensing pass is done;
     integration hasn't started. This is the actual "resume point."

### Data-quality findings from this session's audit (new — not previously documented)

- **8 objects are duplicated under both their Messier and NGC catalog numbers** — same physical
  object, two separate downloaded photos: `M31`/`NGC224` (Andromeda), `M42`/`NGC1976` (Orion
  Nebula), `M51`/`NGC5194` (Whirlpool), `M57`/`NGC6720` (Ring Nebula), `M82`/`NGC3034` (Cigar
  Galaxy), `M101`/`NGC5457` (Pinwheel), `M104`/`NGC4594` (Sombrero), `M106`/`NGC4258`. 59 files
  → **51 unique objects**.
- **`IC1805.jpg` and `IC1848.jpg` are byte-identical** (confirmed via MD5) despite being labelled
  as two different nebulae (Heart vs. Soul Nebula) — a genuine curation bug, not a catalog alias.
  One of the two needs re-sourcing or exclusion.
- **Thematic overlap with the existing 6-entry Hubble set**: Orion Nebula, Whirlpool Galaxy, and
  Carina Nebula already exist there; Eagle Nebula overlaps loosely (Pillars of Creation is a
  feature within it). Running two separate "click a star, see a nebula" systems side by side would
  be confusing — see Decision D1.
- **Assets are unoptimized**: 13MB raw across 59 files (jpg/png/jpeg, up to ~1MB per file), vs. the
  existing Hubble images which are pre-converted to WebP at ~50–80KB each. Needs the same
  treatment before shipping.

## 3. Decisions

**D1 — Retire the modal, or run two systems? (needs your confirmation before IMPLEMENT starts)**
Recommendation: **retire `StarModal`'s popup UX and the 6-entry `public/hubble/data.json` set**,
replacing both with the new in-background reveal driven by the 51 deduplicated DSO objects. The
new set is a superset of the old one's subject matter, and two different "click a star" behaviors
on the same canvas would be confusing. Keep `fetchNasaApod()` — it's unrelated to star-click and
already optional/additive.
_Alternative if you'd rather not remove a shipped, tested feature yet_: keep both, with the 6
original Hubble stars still opening the modal and only the new DSO stars triggering a background
reveal (visually distinguish the two star types). This is more code to maintain long-term.

**D2 — How many special stars are clickable at once.**
Default: cap visible special stars at **24** per page load, drawn as a random sample from the 51
unique objects (reshuffled on reload), rather than lighting up all 51 at once. Reason: 51 gold
stars on one canvas is visually cluttered; images are still lazy-loaded only on click, so this is
a visual/UX cap, not a performance one. Adjustable — flag if you want all 51 clickable.

**D3 — Reveal mechanics.**
On `starclick`: crossfade the Hero section's background from the Starfield canvas to a full-bleed,
scrim-overlaid static image of the clicked object (scrim needed to keep hero heading/CTA text at
WCAG AA contrast — see §6 risk). Small persistent credit line (title + credit + license link when
`attributionRequired: true`) appears bottom-corner while active. Dismiss via Esc, a close control,
or clicking another star — returns to the animated Starfield. Reuses the focus-trap/
reduced-motion/keyboard conventions already established in `StarModal`/`MissionControl`.

## 4. Task Breakdown

1. **Data cleanup script** (`scripts/hero/build-manifest.mjs`): dedupe the 8 catalog-alias pairs to
   one canonical id each (default: keep the Messier-numbered file, drop the NGC duplicate, since
   Messier names are more recognizable), exclude or flag the `IC1805`/`IC1848` collision, and emit
   `public/hero-dso/manifest.json` — same runtime-fetch pattern as `public/hubble/data.json`.
2. **Image optimization**: convert the 51 approved source images to WebP, bounded to a sane max
   width (e.g. 1920px) and quality (~70–75), targeting per-image sizes comparable to the existing
   Hubble WebP assets. Brings ~13MB raw down to an estimated 3–5MB total, still lazy/click-loaded.
3. **Types**: add `HeroDsoEntry` to `src/types/index.ts` (id, label, imagePath, credit,
   attributionRequired, sourceUrl, license).
4. **Loader**: `src/utils/heroDso.ts` mirroring `hubble.ts` (fetch manifest, fallback on failure).
5. **`Starfield.tsx`**: replace the fixed `specialStarCount=6`/positional-index scheme with a
   manifest-driven mapping (§D2 sampling), dispatch `starclick` with the DSO `id` instead of a
   numeric index (id is more robust than position), update the `aria-label` copy.
6. **Reveal UI**: repurpose `StarModal.tsx` into a `HeroBackgroundReveal` component implementing §D3
   (crossfade, scrim, persistent credit line, dismiss). If D1's alternative is chosen instead,
   this becomes an addition alongside the existing modal rather than a replacement.
7. **Retire old Hubble modal path** (only if D1's primary recommendation is confirmed): remove
   `StarModal.tsx`'s popup rendering and `public/hubble/data.json`'s role in the star-click flow.
8. **Accessibility pass**: verify text-over-photo contrast across a representative sample of the
   51 images with the chosen scrim treatment; this is a real risk since backgrounds now vary by
   image brightness (see §6).
9. **Tests**: unit tests for `heroDso.ts` (mirroring `hubble-utils.test.ts`), updated Starfield
   click-mapping tests, reveal-component tests (mirroring `StarModal.test.tsx`), E2E updates to
   `star-interaction.spec.ts` for the new reveal + credit line, and an axe re-run given the new
   photographic backgrounds.
10. **Docs**: update `docs/architecture.md`'s data-flow section and the README's "Interactive
    Features" list; add a short licensing/provenance note for `hero-dso` (mirroring the existing
    Hubble images note) so the CC BY/PD constraint is documented for future maintainers.

## 5. Acceptance Criteria

- Clicking any visible gold star crossfades the hero background to that object's real photo within
  one interaction, with no layout shift.
- A visible credit line (title, credit, and license link when required) is present for the entire
  time a DSO background is active, and disappears cleanly on dismiss.
- Keyboard-only users can trigger, read, and dismiss a reveal without a mouse (parity with existing
  `StarModal` keyboard support).
- `prefers-reduced-motion` still renders a static (non-animated) starfield and reveals still work
  without crossfade animation.
- No manifest entry points to a missing image or a duplicate catalog id; `IC1805`/`IC1848`
  collision is resolved, not silently shipped as-is.
- Total hero-related image payload for a single reveal stays in the same order of magnitude as the
  current Hubble images (~50–150KB), not the raw 13MB source set.
- Full test suite green via `quality-engineer`'s BUILD-VERIFY-REPORT (unit + E2E + axe).

## 6. Risks

- **Accessibility risk**: hero heading/CTA currently sit on a dark canvas gradient tuned for
  contrast; 51 photographic backgrounds will vary widely in brightness/color, and a single fixed
  scrim may not guarantee WCAG AA across all of them without spot-checking.
- **Curation trust**: the rejected/approved split came from an automated license-policy filter
  whose source script isn't in the repo (only its JSON outputs are) — worth a manual spot-check of
  a few `attributionRequired: false` entries before treating the policy as fully trustworthy.
- **Scope creep risk on D1**: retiring a shipped, tested feature (`StarModal`/Hubble modal) is a
  bigger change than "wire up new images" — confirm before IMPLEMENT to avoid rework.

## 7. Out of Scope / Backlog Carried Forward

Not part of this milestone, but already identified and worth not losing:

- CI coverage gate (`npm run test:coverage` failing the pipeline below threshold) —
  from `docs/project-evaluation.md`.
- Existing StarModal DRY issue (duplicated Hubble fallback object) — moot if D1's primary
  recommendation is taken, since the component is retired; otherwise still applies.
- The unrelated cosmetic text fixes already sitting in the working tree (README/hubble
  data/Credibility) — recommend committing separately, first, before this feature branch starts.
