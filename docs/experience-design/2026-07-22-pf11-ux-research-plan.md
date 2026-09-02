# PF-11 UX Research Plan — solo, unfunded edition

**Date:** 2026-07-22
**Produced by:** design:user-research pass over the PF-11 plan draft (paired with Procyon;
companion to the same-day experience-design review)
**Scope:** the new visitor arc in
[PF-11](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md) — intro dossier +
LAUNCH (D1), destination-aware sky (D2), flip-and-burn travel (D3), arrival/dismissal (D4),
Where-To console v2 (D5).
**Audiences:** primary — recruiters/engineers, 1–3 minute visit; secondary —
astronomy/graphics enthusiasts who linger.
**Method reality check:** at 5–8 participants per round you find most severe usability
problems; you will not get statistics. Everything below is designed to be run by one person
with a laptop, a phone, and friends/colleagues. Test on the **built preview**
(`npm run build && npm run preview`), never `astro dev` — the same rule the repo already has
for perf applies to perceived wait times.

---

## 1. Research Plan

### 1a. Usability test tasks (7 tasks, ~20 min per participant, 5–8 participants)

Run moderated (in person or screen-share). Think-aloud. Note-take against the success
criteria only — don't transcribe. One desktop round and at least 2 participants on a real
phone.

| #                                | Task (what you say)                                                                                                           | What it tests                                                                         | Success criteria                                                                                                                                                                                           | Red flag                                                                                                               |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| T1                               | "Here's a link someone sent you. Do whatever you'd normally do." (no other framing)                                           | D1 cold-start: does the dossier + LAUNCH gate work unprompted                         | Presses LAUNCH within **60 s** of it arming, without asking "what do I do?"; can say "it's a portfolio / a developer's site" within 90 s of landing                                                        | Waits passively for the dossier to "finish" after LAUNCH is armed; asks if the page is stuck; closes tab               |
| T2                               | (During load, before LAUNCH arms) "What do you think is happening right now?"                                                 | D1.1 honesty contract: does real progress _read_ as real                              | Describes it as genuinely loading data/assets (mentions bytes, stages, or "actually loading"); zero "is it frozen?"                                                                                        | Calls it a fake loading bar, an intro animation, or an ad-style splash                                                 |
| T3                               | "Find out what projects this person has built."                                                                               | Whole loop: console discoverability in its new second-third placement, station travel | Reaches the Projects section within **60 s** by any route (search, station click); no more than one wrong turn                                                                                             | Never finds the Where-To console; tries to scroll the page like a normal website and gives up                          |
| T4                               | "Get yourself to the Orion Nebula — it's called M42."                                                                         | D5.2 search + D3 far travel + D2 sky change                                           | Finds it via search in ≤2 query attempts; during travel, when asked "what's the ship doing now?" mid-journey, says something equivalent to "turning around / slowing down / braking"                       | Types a valid name and gets nothing ranked first; describes the flip as a glitch ("it jumped/broke")                   |
| T5                               | (On arrival, vista showing) "Okay, you're done reading that." — nothing more                                                  | D4.1 dismissal instinct                                                               | First instinctive input (click anywhere / Space / Esc) closes the vista; ship stays parked; **no travel event fires within 5 s** of dismissal                                                              | User hunts for an X button > 10 s; dismissal click launches a new warp; user is warped away and doesn't understand why |
| T6                               | "Now get back home to Earth."                                                                                                 | D5.1 renamed controls                                                                 | Finds and presses the renamed home control within **15 s** without hovering-to-read every button; afterwards can say what the _other_ renamed control (random-jump) does                                   | Reads labels aloud in confusion; presses random-jump expecting home                                                    |
| T7                               | (Retrospective, after all tasks) "Think back to when you were at the nebula versus at Mars. Did the sky look different? How?" | D2 frame ladder: noticed vs mis-noticed                                               | Not required to notice. Success = **zero participants describe a sky change as a bug** ("stars disappeared, I think it broke"). Bonus signal if anyone says "the Milky Way was a distant object out there" | Anyone interprets the extragalactic collapse or belt fade as a rendering failure                                       |
| T7b (optional, enthusiasts only) | "Explore for 3 minutes; tell me anything that surprises you."                                                                 | D2/D3 delight for the secondary audience                                              | At least one unprompted positive remark about travel or sky                                                                                                                                                | Boredom; asks "what else is there?" within 60 s                                                                        |

**Per-participant close:** "Would you interview / refer the person who built this? Why?" —
the single question that measures the site's actual job.

### 1b. Three-minute hallway-test protocol

For coffee-line / coworker / family testing. One sheet, one stopwatch, one URL.

- **0:00 – Setup (10 s):** Hand over device with the site _not yet loaded_. Say only: "Try
  this site and think out loud. I can't help you."
- **0:00 – 1:15 — Watch the gate.** Load the page. Record: ☐ read the dossier ☐ pressed
  LAUNCH unprompted ☐ time from LAUNCH-armed to press: ___ s ☐ tried to click/skip during
  cinematic ☐ said "stuck/slow" ☐ found console after arrival.
- **1:15 – 2:15 — Two micro-tasks.** "Find their projects." then "Now go somewhere far away,
  then close whatever pops up when you arrive." Record: ☐ projects found ☐ vista dismissed
  with first input ☐ accidental warp on dismiss (the T5 red flag).
- **2:15 – 3:00 — Three questions, verbatim answers:**
  1. "What is this site, and whose is it?"
  2. "What one word describes the loading screen at the start?"
  3. "Did anything happen that you didn't mean to make happen?"
- **Scoring:** Each checkbox is binary. 5 hallway runs where ≥4 pass the LAUNCH-unprompted,
  projects-found, and clean-dismiss boxes = ship-confidence for that slice. Any two people
  hitting the same red flag = a defect, file it like one.

### 1c. Five screener-free remote-feedback questions

For posting the preview URL to friends/colleagues/a Slack channel. No screener, no
scheduling; works async. (Pair with the `?funnel=1` diagnostics copy button from §3 and ask
people to paste the blob.)

1. **"Before you scroll back: what does the person behind this site do for a living, and
   would you put them in front of your team? One sentence why or why not."** (Credibility —
   the site's actual KPI.)
2. **"The loading screen at the start: did you (a) read it, (b) wait it out, (c) almost
   leave? Roughly how long did it _feel_?"** (Perceived vs actual wait — compare against the
   funnel timestamps.)
3. **"Did anything ever happen that you didn't intend — moving somewhere you didn't ask to
   go, something you couldn't close, a screen that seemed stuck? Describe the moment."**
   (Catches accidental warps, dismissal failures, liveness stalls without leading.)
4. **"Use the search box to visit two places — one you type the name of yourself. What
   exactly did you type, and did you end up where you meant?"** (D5 ranking + id-matching in
   the wild; the verbatim query strings are the gold here.)
5. **"What device and browser were you on, and did anything feel choppy or slow? If you're
   willing: add `?funnel=1` to the URL and paste what the COPY DIAGNOSTICS button gives
   you."** (Ties every subjective report to a real device signature and timeline.)

---

## 2. Top 5 riskiest UX assumptions (impact × uncertainty, 1–5 each)

| Rank | Assumption                                                                                                                                                                                                                                                                      | Impact | Uncert. | Score   | Cheapest validation                                                                                                                                                                                                                                                                                                                                                                                              |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1    | **Recruiters will wait for — let alone enjoy — a LAUNCH gate before any content.** The gate sits on the critical path of a 1–3 min visit; D1 as first-drafted had _no skip affordance_.                                                                                         | 5      | 4       | **20**  | 5 hallway runs (§1b) with a stopwatch on _time-to-first-content_; count unprompted "can I skip this?" utterances. Cost: one afternoon, zero code. If ≥2 of 5 stall or ask to skip, the "SKIP ▸" / press-any-key escape is mandatory before the full cinematic is built. Also test the returning-visitor case: does anyone tolerate the gate _twice_?                                                             |
| 2    | **Real-progress dossier reads as engineering credibility, not friction.** The whole "honesty contract" of D1.1 is a bet that visitors perceive the difference from a fake bar.                                                                                                  | 4      | 4       | **16**  | Preference probe before building UI polish: two screenshots/mockups (real-stage dossier vs generic spinner) shown to 5 engineer-adjacent friends — "which site's author seems more competent? which wait feels longer?" 30 min total. Then T2 verbally confirms it live. If nobody can tell it's real, the credibility payoff needs explicit signaling (e.g. filenames/byte counts visible), not more animation. |
| 3    | **Click-anywhere dismiss won't cause accidental warp launches.** D4.1's pointer-events-auto shield covers the _dismissing_ click, but the residual risks are the impatient double-click (second click lands on canvas post-dismiss) and muscle-memory clicks right after close. | 4      | 3       | **12**  | Two-part: (a) an E2E spec that double-clicks and rapid-clicks the vista and asserts no `travelTo` fires within ~300 ms of dismissal — an hour of Playwright; (b) T5 with instructed rapid clickers ("close it fast"). If either fails, add a short post-dismiss click-swallow window and re-run.                                                                                                                 |
| 4    | **Renamed buttons are more discoverable than RNG/SOL.** Renaming (D5.1) assumes the labels were the problem, not the console's visibility or placement.                                                                                                                         | 3      | 4       | **12**  | 30-second label comprehension test, no build needed: static screenshot of `MissionControlBar` with each candidate label set ("EXPLORE ▸ / ⌂ HOME" vs "RANDOM JUMP / RETURN HOME" vs current RNG/SOL as control); 5 people per set answer "what does each button do?" Gate: ≥4/5 correct on both buttons. Doubles as the owner-approval input the plan already requires.                                          |
| 5    | **The frame-ladder sky changes are noticed at all** — D2 is a large engineering spend whose recruiter-visible payoff is unproven; worse, an _unexplained_ star-field collapse at SDSS scale could read as a rendering bug.                                                      | 3      | 5       | **15**† | Retrospective probe T7 (free) plus one targeted question to enthusiast testers. Success is asymmetric: nobody needs to notice, but _nobody may mis-read it as breakage_. If anyone does, the fix is narrative not physics — one HUD line at extragalactic arrival ("LOCAL FIELD BELOW RESOLUTION · MILKY WAY ASTERN") makes the honesty legible. Cost of validation: zero incremental.                           |

† Scores 15 vs 12 — listed 5th because its mitigation (a HUD caption) is trivial regardless
of finding, whereas 3 and 4 change what gets built. Validate 1 and 2 **before** D1.3's
cinematic is fully built; they're the only two that can invalidate scope rather than tune it.

---

## 3. Instrumentation — static site, no backend, strict CSP

**Recommendation first: do NOT add analytics services.** Any third-party script (GA,
Plausible-cloud, Sentry) violates the repo's own posture three ways — no CDN deps
(ADR-0005), hash-based CSP with no external `connect-src`, and the plan's honesty brand. It
would also buy nothing: this site's traffic will never reach statistical significance, and
the questions that matter (§2) are answerable with n=5 moderated sessions. The absence of
tracking is itself a credential for the audience this site targets — consider stating it in
the site footer.

What to build instead — all first-party, no network, no PII:

1. **Session funnel recorder (~50 lines).** A module subscribing to the existing `cosmos:*`
   bus (which both engines already implement) plus D1.1's new per-stage progress events.
   Append `{event, t: performance.now()}` to a ring buffer; persist the last ~10 sessions
   under one localStorage key with a hard size cap. Milestones worth timestamping:
   `dossier-visible → launch-armed → launch-pressed → cinematic-done → first-travel →
first-arrival → vista-dismissed → first-search-keystroke → first-search-travel`. Derived
   flags: `armed-to-press delta` (assumption 1), `travelTo within 1 s of vista dismissal`
   (the accidental-warp detector for assumption 3), `search queries that returned zero
results` (D5, store the query string — it's the user's own input on their own machine).
2. **Debug overlay behind `?funnel=1`**, following the existing escape-hatch convention and
   resolution order (URL param → stored override → default). Renders the funnel timeline and
   flags, alongside the `?perf=1` style already established. CSP constraint applies: overlay
   styles live in `global.css`, dynamic values set post-hydration via `el.style.prop` —
   never an SSR `style=""` attribute or injected `<style>` (non-negotiable #12).
3. **A COPY DIAGNOSTICS button** in that overlay emitting one JSON blob (funnel timeline +
   the perf-telemetry device-signature line + engine/tier resolution). This is the
   solo-owner "backend": remote testers paste it into chat/email (remote question 5). Reuse
   the perf-telemetry validity discipline — reject blobs where timestamps are non-monotone
   or the device block repeats verbatim across supposedly different testers, the exact
   instrument-fabrication class the repo has been burned by three times.
4. **Returning-visitor flags:** `launchCount`, `introSeen` in localStorage. Costs nothing
   now, and makes the "should a second visit skip the gate?" decision (assumption 1's
   sequel) decidable from data plus one hallway retest instead of taste.
5. **What you knowingly cannot learn this way** — written down so nobody fakes it later:
   abandonment rates (people who close the tab leave no blob), aggregate funnels, or
   unbiased samples (everyone who reports is a friend). Treat every remote blob as a
   _case_, not a data point.

---

## 4. Acceptance-criteria additions — D1 / D4 / D5, as testable user behaviors

Phrased to drop into each slice's exit criteria; each is either a Playwright assertion, an
axe check, or a named manual/human gate for the slice's regression checklist (CLAUDE.md
#25). Per non-negotiable #18, all are behaviors driven through the real UI, not readiness
flags.

### D1 (intro dossier + LAUNCH + cinematic)

- **D1-AC1 (no frozen first paint):** On a network throttled to Fast-3G class, some visible
  progress value changes within 2 s of first paint, and no visible counter ever stalls
  > 4 s while its stage is incomplete. _(E2E with CDP throttling.)_
- **D1-AC2 (keyboard-first gate):** A visitor who only ever presses Tab and Enter gets from
  page load to an in-scene, focused Where-To console. Focus moves to LAUNCH the moment it
  arms; Enter launches. _(E2E.)_
- **D1-AC3 (impatience is never silent):** Any click or keypress during the cinematic
  produces a visible response — skip, acknowledgment, or progress cue. A recorded no-op is
  a failure. _(E2E: dispatch input mid-cinematic, assert observable DOM/HUD change.)_ A skip
  is scoped outright per assumption 1.
- **D1-AC4 (honesty is checkable by a human):** The dossier's displayed byte totals for at
  least stars-hip, Havok WASM, and craft GLB match the on-disk asset sizes shown in
  `budgets.config.mjs`/dist — verified in the manual checklist, so a human can catch the
  instrument lying even if the unit test rots.
- **D1-AC5 (nobody strands):** With JS delayed or LAUNCH never pressed, the visitor still
  reaches content — the 9 s failsafe path is walked manually every slice and its
  destination described in the TR (blank screen = fail).
- **D1-AC6 (reduced-motion parity):** A `prefers-reduced-motion` visitor reaches the
  interactive scene with console visible, no ascent animation, and total wall-clock time no
  worse than the cinematic path. _(E2E with emulated media.)_
- **D1-AC7 (no-WebGL):** With WebGL unavailable, no LAUNCH button is ever shown armed over
  a scene that cannot start; the DOM fallback's navigation is reachable. _(E2E,
  forced-fallback context.)_

### D4 (arrival vista dismissal + field-object parity)

- **D4-AC1 (first-instinct dismissal):** With the vista shown, each of {click anywhere,
  Space, Escape} — tested separately — closes the vista, and afterwards `arrivedId`, camera
  pose, and travel state are unchanged. _(E2E ×3 inputs.)_
- **D4-AC2 (the double-click test):** A double-click and a 5-rapid-click burst on the vista
  close it and cause **zero** `travelTo`/warp initiation within 300 ms of dismissal.
  _(E2E; the direct test of assumption 3's residual risk.)_
- **D4-AC3 (post-dismiss world is live and clean):** After dismissal, hovering a body shows
  a fresh `HoverTooltip`, and no stale tooltip is present under or after any
  `CollectorCard` modal. _(E2E hover assertion.)_
- **D4-AC4 (field objects keep their promise, default engine):** On `babylon-scene` (no
  `?engine` param), clicking a field object whose tooltip says "CLICK TO TRAVEL ▸" begins a
  warp within 1 s and ends in the full vista → collector-card flow. The tooltip CTA and the
  click outcome must never disagree — a no-op with that CTA shown is a defect, not a gap.
  _(E2E; closes the R7 seam as a user behavior.)_
- **D4-AC5 (auto-timeout can't ambush):** If the 5.5 s auto-timeout survives the design
  pass, its firing while the user is mid-read (pointer over vista or focus within it) is
  suppressed or the timeout dismissal is behaviorally identical to D4-AC1 (ship parked, no
  side effects). _(E2E either way; decision recorded.)_
- **D4-AC6 (assistive-tech arrival):** The vista is announced on arrival (live region), and
  dismissal returns focus to a documented, useful target (console or canvas with
  `tabindex` still `-1` per non-negotiable #23). _(axe + manual screen-reader pass once per
  slice.)_

### D5 (Where-To console v2)

- **D5-AC1 (exact names win):** For a pinned corpus — at minimum `Mars`, `Helix Nebula`,
  `ngc7293`, `NGC 7293`, `M42`, `Projects`, `About` — the intended body/station is rank 1
  and Enter travels to it. _(Unit test on ranking + one E2E per class: planet, DSO,
  id-form, station.)_
- **D5-AC2 (stations are destinations):** Typing any of the 7 nav-station names and
  pressing Enter warps to that station — the R10 "every travelable destination" claim,
  exercised through the UI. _(E2E.)_
- **D5-AC3 (nothing travelable is unsearchable):** An automated audit test enumerates the
  travel surface (stations + catalog + D5.3 class entries once D4.2 lands) against the
  search index and fails on any unreachable destination — so R10 can't silently rot when
  bodies are added. _(Unit test.)_
- **D5-AC4 (keyboard loop):** ArrowUp/Down move the result highlight, Enter travels to the
  highlighted result (not blindly the first), Escape closes the list leaving the ship
  untouched. _(E2E.)_
- **D5-AC5 (label comprehension gate — human):** Before the rename ships, ≥4 of 5
  first-time viewers shown the console state the correct function of both renamed controls
  from their labels alone (§2 rank 4 protocol). Result and label set recorded in the slice
  TR; `title`/aria text matches the visible label. _(Manual gate + E2E for the attribute
  parity; the E2E rename is a named test change per non-negotiable #17/#15.)_
- **D5-AC6 (mobile reality):** On a real phone (not DevTools emulation, per measurement
  discipline): the console is operable without pinch-zoom, the result list remains
  scrollable and tappable with the soft keyboard open, and a result tap travels. _(Manual
  checklist item with the device named in the TR.)_

---

### How to run this without it becoming a project

Week 1: label comprehension screenshots (§2 rank 4) + dossier-vs-spinner probe (§2 rank 2)
— both need zero new code and directly feed D1.2/D5.1 decisions the plan already lists as
open. Week 2: funnel recorder + `?funnel=1` overlay (one evening) so every later test
self-instruments. Then 5 hallway runs per shipped slice as part of the manual regression
checklist CLAUDE.md #25 already mandates — research becomes a bullet on an existing gate
rather than a parallel program. Total cost: roughly three evenings and eight favors.
