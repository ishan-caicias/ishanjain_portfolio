<!-- SoxCrunch Strategy Scorecard — auto-generated, do not edit manually -->

Generated: 2026-07-22 03:29:22 UTC
Phase: 5 — milestone
Decision matrix source: CACHED (age: ~8 min) — docs/llm/scorecard-decision-matrix.md

Task context: **PF-11 Cinematic Journey & Scale Honesty** (docs/delivery-plan/ + docs/implementation/),
phases D0–D9, starting at D0 within hours. **Billing surface: Claude Code Max 20x SUBSCRIPTION —
not API.** The optimization target is therefore _plan-quota units and rolling windows_, not
dollars. Owner-supplied telemetry at generation time: session context 533.9k/1M (53%);
5-hour window 5% used (resets in ~4h42m); weekly all-models 11% used; **weekly Fable 18%
used** (both weekly meters reset Tue 11:00 PM); **two other projects share these same
meters concurrently.** Supersedes the 03:21 UTC card (same data, API-billing framing) —
that card's API cost table is retained below as the overflow price list.

---

## Implementation Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SOXCRUNCH STRATEGY CARD
Phase: 5 — milestone (PF-11 D0–D9, Max 20x subscription, 3 concurrent projects)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED STRATEGY: Hybrid (3-tier) — QUOTA-ROUTED, not price-routed

THE BINDING CONSTRAINT
  Weekly Fable quota: 18% consumed vs 11% all-models — Fable is burning
  ~1.6× faster than everything else combined, it has its own dedicated
  meter, and two other projects draw on it. Fable is the scarce resource;
  Opus/Sonnet capacity is comparatively abundant. Route accordingly.

TIER A-RESERVE (scarce — spend deliberately)
  Model:     Claude Fable 5 (claude-fable-5)
  Reasoning: effort high; max only for D6.2 belt-basis math + D3 flight math
  Use for:   ONLY the slices where the accuracy delta over Opus 4.8
             (95.0 vs 88.6 SWE-bench) plausibly prevents a TR-045-class
             defect: D6.2 belt re-expression, D3.1/D3.2 choreography design,
             shader-twin REVIEW passes (not the typing), and any problem
             that survives two Opus VERIFY→fix loops (third strike = Fable)
  Budget:    keep weekly Fable ≤ ~55–60% by Sunday so all three projects
             retain escalation headroom before the Tue 11PM reset;
             PF-11's fair share ≈ 1/3 of the remaining 82%

TIER A-DEFAULT (the actual workhorse orchestrator)
  Model:     Claude Opus 4.8 (claude-opus-4-8)
  Reasoning: effort high (its default); never fast mode for agentic work
  Use for:   D0.1 liveness implementation, D2 fades, D6.1/D6.3 shader
             implementation, D7 perf slices, D8 pipeline, standard VERIFY
             loops, debugging — i.e. everything the 03:21 card gave Fable
             EXCEPT the reserve list above
  Key stat:  SWE-bench 88.6% — the accuracy floor is high enough that
             Fable-always is quota-inefficient for routine hard work

TIER B (volume)
  Model:     Claude Sonnet 5 (claude-sonnet-5)
  Reasoning: thinking auto (8–16k budget) for design; disabled mechanical
  Use for:   D1/D4/D5 React chrome, E2E spec authoring, D4.4 content
             drafts, TR/docs writing, D6.6/D6.7 closeout
  Key stat:  SWE-bench 85.2%, GPQA 96.2% — near-Opus competence at the
             lightest quota draw of any capable tier

TIER C
  Model:     Claude Haiku 4.5 — index rows, formatting passes, triage.

SESSION & WINDOW DISCIPLINE (subscription quota scales with tokens
processed, so context hygiene IS the cost lever)
  • One slice = one fresh session. Do NOT carry this 533.9k-token session
    into D0 — open clean with: the plan phase + its implementation section
    + only the files the slice names. Target ≤150–250k working context.
  • The implementation plan is written to be the context — trust its
    file:line pointers instead of re-reading babylon-engine.ts (~5k lines)
    wholesale each session.
  • Subagent/workflow fan-outs bill the same meters: reserve multi-agent
    sweeps for genuine parallel discovery, not for work one context can do.
  • 5-hour window: front-load the heavy Opus/Fable slice at window start;
    push mechanical Tier B/C tail work toward window end. Current window
    is 95% free and resets before D0 starts — no action needed today.
  • Weekly cadence with 3 projects: do PF-11's Fable-reserve slices EARLY
    in the weekly cycle (right after Tue reset) while the meter is empty;
    late-week Fable requests should assume contention.

OVERFLOW VALVE
  If a weekly meter pins before the reset mid-slice: (a) downgrade per the
  tier ladder (Fable→Opus→Sonnet) before stopping work; (b) truly blocked
  urgent work can run API pay-as-you-go at the 03:21 card's rates
  (retained below) — Commercial Terms, no training, same models.

SECURITY POSTURE (unchanged from 03:21 fetch)
  ✅ US jurisdiction, no PRC-hosted APIs; Gemini free tier never
  ✅ Subscription + API both fine for this repo's code

TOP 3 QUOTA OPTIMISATIONS FOR THIS PHASE
  1. Fable-reserve routing (above): at current burn, Fable-always would pin
     its weekly meter mid-week with 3 projects; the reserve list cuts
     PF-11's Fable draw an estimated 60–75% at near-zero accuracy risk
     (Opus reviews escalate on the named triggers).
  2. Fresh-session-per-slice + pointer-driven context: processing 250k
     instead of 533k+ per turn ≈ halves quota burn per session AND keeps
     prompt-cache hits hot within the 5m/1h TTLs.
  3. Plan-first turns (cheap) before implement turns (expensive): rework is
     double quota; the implementation plan's per-slice step lists exist to
     make first-pass implementation land. Diff-only outputs still apply.

BENCHMARK/PRICING SOURCES
  Cached decision matrix (LIVE FETCH 2026-07-22 03:21:08 UTC):
  vellum.ai + artificialanalysis.ai; platform.claude.com,
  developers.openai.com, ai.google.dev pricing pages.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Per-Phase / Per-Slice Model Routing — PF-11 D0–D9

_Added 2026-07-22 03:36 UTC at owner request (the tier prose above lacked the concrete
slice-by-slice table). Slice ids match the
[delivery plan](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md) /
[implementation plan](../implementation/PF-11-implementation-plan.md). "Review" = the
pre-TR REVIEW pass on the diff; **all shader-twin reviews in one phase are BATCHED into a
single Fable pass** to conserve the reserve meter._

| Slice | Work                                                               | Implement with                                                                       | Review with                                                    | Reasoning / notes                                                              |
| ----- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| D0.1  | Band-build decoupling, liveness proof, craft-ceiling recalibration | **Opus 4.8**                                                                         | Opus (self) → Fable on 3rd failed fix loop                     | TR-059-guarded hot path; effort high                                           |
| D0.2  | `aimAt` test hook + pixel E2E                                      | **Sonnet 5**                                                                         | Opus                                                           | Harness + Playwright work; thinking auto 8k                                    |
| D0.3  | Real-device pass                                                   | **Owner + Haiku** (collation) → Sonnet (TR write-up)                                 | —                                                              | Human-run measurement; models only record                                      |
| D1.1  | `load-progress.ts` + fetch wiring + `cosmos:stage`                 | **Sonnet 5** (module) + **Opus** (engine wiring points)                              | Opus                                                           | Split: pure module is Sonnet-grade; `_boot` touchpoints are Opus               |
| D1.2  | PreFlight UI + state machine + skips                               | **Sonnet 5**                                                                         | Sonnet (self) + axe pass                                       | React chrome; thinking auto 8–16k for S1e states                               |
| D1.3  | Ascent mode + camera + sky-colour + console reveal                 | **Opus 4.8**                                                                         | **Fable** (choreography review, batched with D3) + Astra audit | New engine mode; cinematic quality is reserve-worthy at review, not typing     |
| D1.4  | Funnel recorder + `?funnel=1` overlay                              | **Sonnet 5**                                                                         | Sonnet (self)                                                  | Self-contained, no engine surface                                              |
| D2.1  | Furniture fade (material clones, `uLayerFade` twins) + Havok sleep | **Opus 4.8**                                                                         | **Fable** (batched twin review for all of D2)                  | Shader twins + physics — Tier A-default                                        |
| D2.2  | Extragalactic collapse + MW impostor                               | **Opus 4.8**                                                                         | Fable (same batch) + Astra audit                               | Twin work + license-gated asset                                                |
| D2.3  | Constellation dissolve + ledger                                    | **Sonnet 5**                                                                         | Fable (same batch)                                             | One uniform pair — trivial typing, twin review still mandatory                 |
| D3.1  | Decel cues (chase table, FOV breathing, dsdk wiring)               | **Opus 4.8**                                                                         | **Fable** (design + batched review — reserve trigger)          | Choreography math is a named reserve item                                      |
| D3.2  | Flip choreography (window, C² ease, plume, RCS)                    | **Fable 5** (design pass) → **Opus** (implementation)                                | Fable (same batch) + Astra audit                               | The one slice where Fable designs first — smallest, highest-judgment surface   |
| D3.3  | goHome abort + retarget queue                                      | **Opus 4.8** (state machine) + **Sonnet** (HUD/console strings)                      | Opus                                                           | Behavioural E2E updates are named test changes                                 |
| D4.1  | Vista dialog + dismissal + click-swallow                           | **Sonnet 5**                                                                         | Opus                                                           | React state only; engine untouched                                             |
| D4.2  | Babylon `fs-` travel branch                                        | **Opus 4.8**                                                                         | Opus                                                           | Engine travelTo + field-store synthesis                                        |
| D4.3  | Card polish + `focus-utils.ts`                                     | **Sonnet 5**                                                                         | Sonnet + axe                                                   | Shared utility serves D1/D4/D5                                                 |
| D4.4  | Card content drafts (sourced) + overlay module                     | **Sonnet 5** (drafts; Batch API if API-billed) + **Haiku** (merge checks)            | **Owner** (approval gate)                                      | Facts cite official sources; no invention                                      |
| D5.1  | RANDOM JUMP / RETURN HOME renames                                  | **Haiku 4.5**                                                                        | Sonnet                                                         | Mechanical + named E2E selector updates                                        |
| D5.2  | `destination-search.ts` + combobox ARIA                            | **Sonnet 5**                                                                         | Opus (ranking edge cases)                                      | Pure module + UI; unit-test heavy                                              |
| D5.3  | Class entries + `nearestFieldOfType`                               | **Opus 4.8** (engine scan) + Sonnet (UI rows)                                        | Opus                                                           | Typed-array scan in hot-adjacent code                                          |
| D5.4  | Missing-body audit + guard test                                    | **Sonnet 5**                                                                         | Sonnet                                                         | Data + test work                                                               |
| D6.1  | Surge→`refl` + Reinhard (twins)                                    | **Opus 4.8**                                                                         | **Fable** (batched D6 twin review)                             | Decided (ADR-0010); land after/with D6.3 sRGB                                  |
| D6.2  | Belt inclined-basis re-expression                                  | **Fable 5** (basis math + model transform design) → Opus (data regen, route re-tune) | Fable + Astra audit                                            | THE reserve slice — named in ADR-0010; Kirkwood regression must pass unchanged |
| D6.3  | sRGB decode, tier gating, self-shadow, uAtmosphere flag            | **Opus 4.8**                                                                         | Fable (same D6 batch)                                          | Twin work; albedo re-tune follows                                              |
| D6.4  | Earth goHome reveal + home ORBIT (R16)                             | **Opus 4.8**                                                                         | Opus + Astra audit                                             | Spec complete in Earth brief; orbit constants licensed                         |
| D6.6  | Atlas patch pipeline + Jupiter-moon ranks                          | **Sonnet 5**                                                                         | Sonnet                                                         | Script (three-mode shape) + data fix                                           |
| D6.7  | PF-10 header correction                                            | **Haiku 4.5**                                                                        | —                                                              | One additive doc edit                                                          |
| D7.1  | `clearCachedData` lifecycle (~430 MB)                              | **Opus 4.8**                                                                         | Opus                                                           | Context-loss implications documented in TR                                     |
| D7.2  | Planet texture tier-fetch + disposal                               | **Opus 4.8**                                                                         | Opus                                                           | Pairs with D6.3 tier gating                                                    |
| D7.3  | SDSS decode Worker + CSP `worker-src`                              | **Opus 4.8**                                                                         | Opus                                                           | CSP delta = scoped directive + comment + TR                                    |
| D7.4  | Render-loop allocation sweep + cosmos:warp throttle                | **Opus 4.8**                                                                         | Fable if any frame-time regression appears                     | Hot loop — measured before/after                                               |
| D7.5  | Havok sleep measurement                                            | with D2.1 (Opus)                                                                     | —                                                              | Numbers into the TR                                                            |
| D7.6  | One-shot buffer releases                                           | **Haiku 4.5**                                                                        | Sonnet                                                         | Two nulls + a test                                                             |
| D8.1  | DR3 Tiny chunking ADR                                              | **Sonnet 5** (draft) → owner                                                         | Opus                                                           | Decided scope (all 2.55M); ADR formalises chunk design                         |
| D8.2  | OctreeLoader reader + dedupe + PNG-pack                            | **Opus 4.8**                                                                         | Opus                                                           | Sixth binary format; C0 round-trip discipline                                  |
| D8.3  | Runtime layer via D9                                               | **Opus 4.8**                                                                         | Opus                                                           | Own mesh; chunk-prefix enable                                                  |
| D9.1  | Layer registry + engine `setLayers`                                | **Opus 4.8**                                                                         | Opus                                                           | Lifecycle = D7.1/D7.2 foundations                                              |
| D9.2  | Render Console panel UI                                            | **Sonnet 5**                                                                         | Sonnet + axe                                                   | Dossier-format dialog; live fps readout                                        |
| D9.3  | Boot-critical budget + per-layer bytes                             | **Sonnet 5**                                                                         | Sonnet                                                         | Single source with `budgets.config.mjs`                                        |
| D9.4  | Defaults calibration from D0.3                                     | **Sonnet 5** + owner data                                                            | —                                                              | TR + ADR-0010 addendum                                                         |

**Per-task-type legend (applies inside every slice):**

| Task type                                    | Model                                                                                   |
| -------------------------------------------- | --------------------------------------------------------------------------------------- |
| PLAN/INSPECT turns opening a slice           | Same model as the slice's Implement column (context continuity beats a cheaper planner) |
| Astra science briefs / realism audits        | Run on the session's model (Opus default; Fable only if the slice is a reserve slice)   |
| TR / docs / index rows                       | Sonnet (TR), Haiku (index rows) — never Fable                                           |
| Full-gate VERIFY runs (build/test/e2e)       | Whatever model holds the session — the gate is compute, not reasoning                   |
| 3rd consecutive failed fix on one root cause | Escalate one tier (Sonnet→Opus→Fable) per the bounded-retry rule                        |

---

## Scoring Summary (unchanged from the 03:21 fetch — same matrix)

| Model                           | Agentic Coding (35%) | Reasoning/Math (25%) | Cost Efficiency (25%) | Token Efficiency (15%) | Weighted Score |
| ------------------------------- | -------------------- | -------------------- | --------------------- | ---------------------- | -------------- |
| Claude Sonnet 5 (intro pricing) | 4.2                  | 4.8                  | 4.8                   | 4.5                    | **4.55**       |
| Claude Opus 4.8                 | 4.4                  | 4.4                  | 3.5                   | 4.0                    | 4.12           |
| GPT-5.6 Terra                   | 3.8                  | 4.3                  | 4.2                   | 4.0                    | 4.06           |
| Claude Fable 5                  | **5.0**              | 4.7                  | 2.0                   | 4.0                    | 4.03           |
| Gemini 3.1 Pro Preview          | 3.6                  | 4.5                  | 4.3                   | 3.8                    | 4.03           |
| GPT-5.6 Sol                     | 4.0                  | 4.6                  | 3.0                   | 4.0                    | 3.90           |
| Claude Haiku 4.5                | 3.0                  | 3.0                  | 5.0                   | 4.2                    | 3.68           |

Subscription reading: the "cost efficiency" column now proxies _quota draw per unit of
work_, which strengthens the same conclusion — Sonnet carries volume, Opus is the default
orchestrator, and Fable's uncontested accuracy lead is spent only where it buys defect
prevention (its dedicated weekly meter makes over-use self-punishing in a way API billing
never did). Non-Claude rows stay for completeness; they are outside the Max plan entirely
(separate spend + workflow switch — not recommended mid-milestone).

---

## Cost Projection for This Phase

**Subscription basis (primary):** marginal dollar cost ≈ $0 until a meter pins. The
projection that matters is quota: with the reserve routing, PF-11's estimated draw is
roughly 10–15% of weekly all-models and 10–20% of weekly Fable per full-tempo week —
compatible with two sibling projects if they run similar discipline. Watch the two weekly
meters mid-week; the tier ladder is the throttle.

**API overflow basis (from the 03:21 card, unchanged):** session ≈ 600k fresh + 2.4M
cache-read + 150k out → Fable ≈ $15.90 · Opus ≈ $7.95 · Sonnet (intro, to 2026-08-31) ≈
$3.18 · Haiku ≈ $1.59. Whole-of-PF-11 at API rates: ~$205 / ~$340 / ~$650
(conservative/moderate/heavy) — now with a lower Fable share, the moderate case trends
toward ~$280 if fully API-billed.

---

## Reasoning Configuration

| Model                     | Reasoning mode | Parameter                                             | When to escalate                                                                                              |
| ------------------------- | -------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Claude Fable 5 (reserve)  | effort: high   | max for D6.2 basis math, D3 flight math               | n/a — Fable IS the escalation                                                                                 |
| Claude Opus 4.8 (default) | effort: high   | its default                                           | to Fable on the reserve triggers: shader-twin review, 3rd VERIFY→fix loop on one root cause, belt/flight math |
| Claude Sonnet 5           | thinking: auto | budget_tokens 8000–16000 design / disabled mechanical | to Opus rather than raising budget past 16k                                                                   |
| Claude Haiku 4.5          | disabled       | —                                                     | any ambiguity → Sonnet                                                                                        |

---

## Token (Quota) Optimisation Plan

1. **Fable-reserve routing** — est. 60–75% cut in PF-11's Fable-meter draw vs the 03:21
   card's routing; the accuracy backstop is the named escalation triggers, not hope.
2. **Fresh session per slice, ≤250k working context** — pointer-driven context from the
   implementation plan instead of wholesale engine-file reads; ~2× quota-per-session
   reduction vs continuing half-megatoken sessions (this one is at 533.9k — hand off, don't
   continue).
3. **Plan-first, implement-second turn structure + diff-only outputs** — rework is the
   most expensive quota event (everything reprocessed twice).
4. **Weekly choreography across 3 projects** — Fable-reserve slices right after the Tue
   11PM reset; mechanical/Batch-able work late-week; if a sibling project has a Fable-heavy
   week, PF-11 defers its reserve slices rather than racing the meter.

---

## Data Sources Used

Decision matrix: `docs/llm/scorecard-decision-matrix.md` (Generated: 2026-07-22 03:21:08 UTC)
Benchmark data age: ~8 minutes at time of strategy generation (cache hit)
Plan-limit telemetry: owner-supplied at 2026-07-22 03:29 UTC (session 533.9k/1M; 5h window
5%; weekly all-models 11%; weekly Fable 18%; resets Tue 11:00 PM; 3 concurrent projects)
