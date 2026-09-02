# PF-11 experience-design review — D1 (pre-flight + launch), D4 (arrival/cards), D5 (console)

**Date:** 2026-07-22
**Produced by:** experience-designer pass over the PF-11 plan draft (paired with Procyon;
companion to the same-day [UX research plan](2026-07-22-pf11-ux-research-plan.md))
**Governing calibration:** the real visitor is a recruiter or engineer spending 1–3 minutes.
Every second of gate, every modal, every unexplained control is spent from that budget. The
cinematic is the demonstration of skill; it must never become the toll booth.
**Voice:** verb-led NASA-ops mono strings with `·` separators and `▸`/`◂` glyphs
("ARRIVAL CONFIRMED", "ALIGNING TRAJECTORY", "◂ RETURN TO SOL") — confirmed in
`WarpOverlay.tsx`, `ArrivalVista.tsx`, `CollectorCard.tsx`, `HUD.tsx`. All recommendations
stay in that voice.

---

## D1 — Pre-flight dossier + LAUNCH + ascent + console reveal

### State machine

```
S0 BOOT        SSR paints; dossier shell visible immediately (static HTML, no JS needed)
   │  cosmos:progress stages stream in
   ▼
S1 LOADING     Dossier: live stage list, real byte/record counters, engine line
   │  boot-critical stages complete            │ any stage fails/stalls > ~10s
   ▼                                           ▼
S2 ARMED       LAUNCH arms, receives focus;    S1e DEGRADED  stage marked "STALLED",
   │           bulk layers shown as                "PROCEED ANYWAY ▸" appears →
   │           "STREAMING IN BACKGROUND"           DOM fallback or best-effort scene
   │  Enter/Space/click LAUNCH   │ "SKIP INTRO ▸" or reduced-motion
   ▼                             ▼
S3 ASCENT      ~8s Earth-surface → space cinematic; "SKIP ▸" visible;
   │           Esc/click/Space skips to S4
   ▼
S4 ON STATION  Home vista; Where-To console reveals in second third; focus → console
```

Returning-visitor branch: a `sessionStorage` flag set after the first completed launch
collapses S1–S3 into a ~1s compressed dossier-flash → S4 (or straight to S4). A recruiter
who reloads or shares the link internally must not sit through the ascent twice.

### Key recommendations

1. **Name the surface "PRE-FLIGHT", not "dossier"** (`PRE-FLIGHT · SYSTEMS CHECK`) —
   "dossier" is already overloaded across three UIs and D1 would make it a fourth. Better
   fiction too: a loading screen _is_ a pre-flight checklist.
2. **Identity first.** Top of the dossier: "ISHAN JAIN" + role line in the hero hierarchy.
   The recruiter must learn whose portfolio this is in the first 2 seconds, before any game
   framing. Under LAUNCH: subcopy `ENTER PORTFOLIO · FLIGHT MODE` — the button must promise
   content, not a game demo.
3. **Three skip affordances (all mandatory, not just reduced-motion):** SKIP ▸ during the
   ascent (Esc/Space/click also skip); a quiet `SKIP INTRO` link during loading routing to
   content as soon as boot-critical stages allow; the returning-visitor bypass. Reduced
   motion must not be the only fast path.
4. **Stage checklist rows** (`STAR CATALOG · 2.02 MB ✓`, `SDSS DEEP FIELD · STREAMING IN
BACKGROUND`), completed rows in the green family; LAUNCH disabled state reads
   `ARMING…` + aggregate percent, never broken. Counters may ease toward the latest real
   value but never ahead of it (honesty extends to the animation). Design the all-green
   ~300ms completed state so fast loads look confident, not glitchy.
5. **Mobile scroll mode never waits** — preserve the current instant-clear semantics
   (`SpaceScene.tsx:177-189`); pre-flight/LAUNCH exists only in travel mode. Toggling into
   travel mid-stream shows the dossier in its current honest state.
6. **Console position is already answered by the codebase:** the at-home dock at `top:54vh`
   (`global.css:339-343`) is inside the second third and deliberately placed. Formalize
   `top: clamp(45vh, 54vh, calc(66vh - <bar height>))`; the D1.3 reveal animates into that
   exact dock (fade + ~12px rise, 0.5–0.7s). Mobile travel mode: bottom-docked with
   `env(safe-area-inset-bottom)` — a mid-screen input collides with the virtual keyboard;
   read "second third" as a desktop/tablet-landscape spec.
7. **Focus order:** S1 heading → `role="status"` stage region → skip link; S2 focus jumps
   to LAUNCH with an `aria-live` "Launch ready"; S4 focus lands on the console _container_
   (`tabindex="-1"`), not the input (auto-focusing an input pops the mobile keyboard).
8. **A11y specifics:** announce stage _completions_ only (never per-byte); ≥24×24px
   targets; verify `#5c6bc0`-family contrast at stage-row sizes (lift to `#9fa8da`+);
   ascent stays under three flashes/second (plume relight is the risk moment); nothing in
   the dossier may disappear on a timer.

### Biggest risk in the whole plan

The gate. On hotel Wi-Fi the boot-critical set could take 10–20s; an unarmed LAUNCH that
long is a bounce. Mitigations in priority order: keep the arm set genuinely minimal (arm on
first-frame-capable; let Havok/craft stream as background if feasible); identity visible
from second zero; SKIP INTRO available pre-arm; keep the 9s failsafe semantics.

---

## D4 — Arrival vista + collector card

### Decisions recommended on the plan's open questions

- **Remove the 5.5s auto-timeout.** Once explicit dismissal exists the timer only creates
  races (vanishes under the cursor mid-reach; a screen-reader user loses the surface
  mid-read — WCAG 2.2.1). It was a crutch for the missing dismissal. Named test changes for
  the specs that depend on the 5.5s window.
- **Do NOT auto-open the collector card on arrival.** The vista is the cinematic payoff; a
  dense modal in the same beat destroys it, auto-modals after every travel are fatigue for
  the 1–3-minute visitor, and the card already has two discoverable entrances (vista button
  - re-click/hover CTA on the parked body). Strengthen the button instead (~13px, one
    entrance shimmer, suppressed under reduced motion).

### Mechanics

- Vista root becomes `pointer-events-auto`, `role="dialog"`, labelled "Arrival: {name}",
  container focused on mount, previous focus restored on dismissal — this simultaneously
  fixes click-through-launches-a-warp and gives dismissal keys a legitimate home.
- **Visible dismissal hint line:** `CLICK ANYWHERE OR PRESS SPACE TO RESUME FLIGHT`
  (click-anywhere without a hint is mystery meat). On touch, replace the dead
  "HOVER THE BODY FOR VITALS" copy with `TAP THE BODY FOR VITALS` or drop it.
- **Space-key collision resolved in design:** focus the dialog container, not the button —
  Space/Esc at dialog level dismiss; Tab reaches OPEN COLLECTOR CARD where Enter/Space
  activates it (correct native semantics; overriding would be worse). Documented in the TR.
- **Escape stack ordering** (global): card → vista → suggestions → sectionOpen → (D3.3
  abort if adopted). The current blanket handler can't express this.
- Stale tooltip: clear `hover` in both card-open paths AND render `HoverTooltip` only when
  `!cardId && !vista`.
- Dismissal animation faster than entrance (150–200ms fade); reduced motion: instant.
- CollectorCard gains a real focus trap + focus move on open (declares `aria-modal` today
  with neither), `aria-labelledby` the name heading; style-dot buttons get ≥24px hit areas,
  `aria-label` + `aria-pressed`; stat bar divs `aria-hidden`.
- Post-dismiss orientation: `aria-live="polite"` "Resumed flight at {name}".
- Habit change accepted: clicking the next body through the vista now dismisses first; the
  hint line is what makes that read as intentional.
- **Naming convergence:** one word per surface — card = "COLLECTOR CARD" everywhere (hover
  CTA "ON STATION · OPEN COLLECTOR CARD ▸"); "dossier" reserved for section overlays (or
  vice versa), decided once in D4.3.

---

## D5 — Where-To console v2

### Journey

Empty focused input shows a **FEATURED list** ("NOTABLE DESTINATIONS" — 5–6 curated:
Saturn, M42, Andromeda, Pleiades, and at least one portfolio station so content is one
click from empty input). Typing shows ranked results (prefix > word-start > substring > id;
stations included and badged, ranked above sky objects at equal tier). ↑/↓ move the active
option; Enter travels to the ACTIVE option (top-ranked by default — fixes the current
"Enter went somewhere unexpected" hazard). Explicit empty state: `NO CONTACT · TRY "ORION"
OR "SATURN"`. Mid-warp input gives feedback (`IN TRANSIT · ARRIVING AT {dest}`), never a
silent no-op — ties to D3.3's policy either way.

### Control renames (ranked pairs)

1. **`RANDOM JUMP ▸` / `◂ RETURN HOME`** — recommended. Verb-phrases parsed in one fixation
   with zero astronomy/gamer literacy; consistent with the card's `◂ RETURN TO SOL`, which
   should then also become `◂ RETURN HOME` (one phrase per action; "home" beats "Sol" for
   this audience). Below 400px compress to `JUMP ▸` / `◂ HOME` with full text in
   `aria-label`/`title`.
2. `EXPLORE ▸` / `⌂ HOME` — shortest; acceptable if width wins, but "EXPLORE" under-promises
   the instant warp.
3. `RANDOM VECTOR ▸` / `◂ SOL-3 · HOME` — maximum ops flavor, optimizes fiction over
   first-read comprehension; the flavor ceiling, don't ship it.

### Mechanics

- Combobox ARIA pattern (`role="combobox"` + listbox/option + `aria-activedescendant`) IS
  the keyboard-nav work item — spec them as one so visual and ARIA active states can't
  diverge. Announce result counts and travel dispatch politely.
- Result cap ~10, scrollable, with honest truncation (`12 MATCHES · SHOWING 10`).
- Field-object class rows (D5.3) clearly labelled `A WHITE DWARF · NEAREST INSTANCE`,
  visually distinct, gated on D4.2.
- Mobile: bottom-docked; suggestion list must open upward and stay above the soft keyboard
  (`visualViewport`); verify the current `top-[calc(100%+8px)]` behaviour when
  bottom-docked — if it opens downward off-screen that's a live bug to fold into D5.2.
- Contrast: the `#5c6bc0` 11px distance column is the weakest row element — lift it.

---

## Cross-phase notes

- **One focus-management utility, three consumers** (LAUNCH arm, vista dialog + card trap,
  combobox) — build once; three hand-rolled versions is how the current no-trap card
  happened.
- **Per-frame `cosmos:warp` → React setState** (D7.4) directly affects D1/D4 overlay
  smoothness during warp — sequence at least a throttle before the new cinematic surfaces
  layer more React work onto the warp path.
- **E2E impact:** vista-timeout removal, renames, and Enter-targets-ranked-hit each touch
  existing specs — named, justified test changes per CLAUDE.md #15.
- Thinnest areas needing a deeper pass at IMPLEMENT: the S1e degraded/stalled dossier state
  (error taxonomy per stage) and the exact featured-destination list.
