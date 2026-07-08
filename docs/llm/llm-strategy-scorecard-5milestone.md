<!-- SoxCrunch Strategy Scorecard — auto-generated, do not edit manually -->
Generated: 2026-07-08 04:15:12 UTC
Phase: 5 — milestone
Decision matrix source: LIVE FETCH — docs/llm/scorecard-decision-matrix.md

---

## Pre-flight: Scope Conflict (read before allocating any budget)

`CLAUDE_CODE_HANDOFF.md` (§1) instructs replacing **both** `Starfield.tsx` and `StarModal.tsx` with a
new `SpaceScene.tsx` WebGL island. In the immediately prior session on this same repo, `StarModal.tsx`
was already retired and replaced with a lighter `HeroBackgroundReveal.tsx` (in-place hero background
crossfade, Starfield canvas kept as-is) — shipped, tested (27 unit + 19 E2E passing), and documented in
`docs/test-reports/TR-001.md`. That work becomes throwaway if the full WebGL scene proceeds. Two things
worth doing before spending any modeled budget below:

1. **Decide**: full WebGL replacement (supersedes last session's work — safe, it's in git history per
   the handoff's own §5 guidance) vs. keep `HeroBackgroundReveal` and shelve the prototype vs. some
   hybrid.
2. **Possible synergy**: `public/hero-dso/manifest.json` (51 license-vetted, deduplicated, WebP-optimized
   DSO images built last session) may be reusable as the new scene's dossier-panel imagery instead of
   whatever asset pipeline the prototype's own `data/` folder implies — worth a 5-minute diff check
   against the prototype's `assets/`/`data/` before treating that as separate net-new work.

---

## Implementation Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SOXCRUNCH STRATEGY CARD
Phase: 5 — milestone (WebGL scene + streaming data pipeline integration)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED STRATEGY: Hybrid (3-tier), Claude-native

PRIMARY / TIER A — hardest sub-tasks only
  Model:     Claude Opus 4.8 (claude-opus-4-8)
  Reasoning: thinking: auto, effort: high
  Use for:   (a) the octree streaming-parser + spatial-index design in §3 of the handoff — silent
             correctness bugs here (wrong bounds, misplaced stars) are hard to catch visually;
             (b) the WebGL-engine-into-React mounting-strategy decision in §1 (custom element vs.
             ref-mounted module) — an architectural call with real trade-offs, not mechanical work.
  Price:     $5 / $25 per MTok · SWE-bench Verified 88.6% (Vellum, 2026-07-08)
  Optional upgrade: Claude Fable 5 (95% SWE-bench, highest Intelligence Index 60) for the octree
  design specifically, if confirmed available on this plan — "limited availability" per Anthropic's
  own pricing page for the newer Mythos tier suggests checking access first rather than assuming it.

WORKHORSE / TIER B — the bulk of the implementation
  Model:     Claude Sonnet 5 (claude-sonnet-5) — what this session is already running
  Reasoning: thinking: disabled for mechanical ports; auto for the nav/theme reconciliation in §2
  Use for:   componentizing the DC into SpaceScene.tsx once the Tier-A mounting decision is made,
             porting celestial-*.js to typed modules, nav/theme reconciliation (§2), e2e fixture
             updates (§4), feature-flag/rollout wiring (§5).
  Price:     $2 / $10 per MTok (intro pricing through 2026-08-31) · SWE-bench Verified 85.2%
  Key stat:  Highest weighted score of any model this run (4.15/5, see Scoring Summary) — only
             ~3 points behind Fable 5 on SWE-bench at a fifth of the cost.

TRIAGE / TIER C — optional, cheap
  Model:     Claude Haiku 4.5 (claude-haiku-4-5-20251001)
  Reasoning: thinking: disabled
  Use for:   Repetitive, already-patterned work only — e.g. once one parser is converted from
             `readFileBinary`/`saveFile` to `fs.createReadStream`, use Haiku to mechanically repeat
             the same conversion across the remaining `data/build/*.js` files in §3.1.
  Price:     $1 / $5 per MTok · agentic-coding benchmark not confirmed live this run (data gap).

ESTIMATED USAGE
  This is a milestone-scale task (WebGL integration + streaming binary parsers + octree construction +
  full e2e regression) — not a single-session task. Plan on 3–5 separate work sessions, not one sitting.
  Current plan state at request time: 5-hour window 13% used (resets in ~4h), weekly all-models 14%
  used, weekly Fable 24% used (resets Tue 11:00 PM) — comfortable headroom, but the octree/streaming
  work in §3 is the part most likely to consume a full 5-hour window on its own if attempted carelessly
  with a weaker model and needs rework. Reserve Tier A budget for that session specifically.

SECURITY POSTURE
  ✅ All recommended models: US-jurisdiction, commercial API terms (no training on your data)
  ✅ No Chinese-jurisdiction hosted APIs considered for this recommendation
  ⚠️  Ensure this session is running via Claude Code / API (Commercial Terms), not the claude.ai
      consumer web chat, given the codebase is proprietary

TOP TOKEN OPTIMISATIONS FOR THIS PHASE
  1. Prompt-cache the prototype's static reference material (`Space Portfolio.dc.html`,
     `FULL-DATASET-PIPELINE.md`, `celestial-*.js`) as a single cache_control block — these get re-read
     across every sub-task in §1 and §3; a 1-hour cache write pays for itself after 2 reads.
  2. Batch API for the mechanical §3.1 parser conversions once the pattern is set (non-interactive,
     50% off) — this is exactly the repeated-pattern work Tier C/Haiku is already earmarked for.
  3. Output-length control: for the octree manifest/parser work, ask for diffs or the specific changed
     function only, not full-file rewrites — output tokens are 5x input cost on Claude.
  4. Don't send `gaia_datasets/` raw data through the model context at all — per the handoff's own
     `.gitignore` convention, only derived `assets/*` outputs should ever enter a prompt; the raw
     catalog is multi-GB and belongs in code (streaming parser), never in context.

BENCHMARK SOURCES
  vellum.ai/llm-leaderboard (fetched 2026-07-08) — SWE-bench Verified top-5, all Claude models returned
  artificialanalysis.ai/leaderboards/models (fetched 2026-07-08) — Intelligence Index, top 15
  livebench.ai — attempted, no data (client-rendered SPA, static fetch returned empty)

PRICING SOURCES
  platform.claude.com/docs/en/about-claude/pricing (fetched 2026-07-08)
  developers.openai.com/api/docs/pricing (fetched 2026-07-08)
  ai.google.dev/pricing (fetched 2026-07-08)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Scoring Summary

| Model | Agentic Coding (35%) | Reasoning/Math (25%) | Cost Efficiency (25%) | Token Efficiency (15%) | Weighted Score |
|---|---|---|---|---|---|
| Claude Sonnet 5 | 4 | 3 | 5 | 5 | **4.15** |
| Claude Fable 5 | 5 | 5 | 1 | 5 | 4.00 |
| Claude Opus 4.8 | 4 | 4 | 3 | 5 | 3.90 |
| GPT-5.5 (high) | 4* | 4 | 2 | 3 | 3.35 |
| Gemini 3.5 Flash | 2* | 2* | 5 | 4 | 3.05 |
| Claude Haiku 4.5 | 2* | 2* | 5 | 4 | 3.05 |
| GPT-5.3 Codex | 3* | 3* | 4 | 2 | 3.10 |
| Gemini 3.1 Pro Preview | 2* | 2* | 4 | 4 | 2.80 |

`*` = scored from Intelligence Index proxy, not a direct SWE-bench figure — Vellum's fetch only returned
its top-5 slice (all Claude), so non-Claude agentic-coding scores are a genuine data gap this run.
GLM-5.2, Qwen3.7 Max, MiniMax-M3, DeepSeek V4 Pro excluded — PRC-jurisdiction hosted, disqualified by the
security filter before scoring.

---

## Cost Projection for This Phase

Expressed as relative Claude-token cost, not literal spend (this session runs on a Claude Code Max plan
with pooled usage limits, not metered per-token billing — treat these as relative-budget-consumption
estimates, not dollar figures you'll be charged).

| Scenario | Model mix | Est. sessions | Tokens/session (in/out) | Relative cost (@ list price) |
|---|---|---|---|---|
| Conservative | Sonnet 5 only, no Tier A escalation | 3 | 80K in / 15K out | ~$0.63/session |
| Moderate (recommended) | Tier A for §1 mounting + §3 octree (2 sessions), Sonnet 5 elsewhere (3 sessions) | 5 | 100K in / 20K out avg | ~$1.10/session avg (Tier A sessions ~$1.00, Tier B sessions ~$0.36) |
| Heavy | Fable 5 for all architecture/data-pipeline work, Sonnet 5 elsewhere | 5 | 100K in / 20K out avg | ~$2.20/session avg |

---

## Reasoning Configuration

| Model | Reasoning mode | Parameter | When to escalate |
|---|---|---|---|
| Claude Opus 4.8 (Tier A) | thinking: auto | effort: high | Octree/spatial-index design; WebGL↔React mounting decision |
| Claude Sonnet 5 (Tier B) | thinking: disabled (mechanical) / auto (design-adjacent) | — | Escalate to Tier A if a "mechanical" port turns out to hide a real architectural fork (e.g. the custom-element vs. ref-mount choice leaks into it) |
| Claude Haiku 4.5 (Tier C) | thinking: disabled | — | Never for anything touching correctness of the streaming parsers or octree bounds — pattern-repetition only |

---

## Data Sources Used

Decision matrix: `docs/llm/scorecard-decision-matrix.md` (Generated: 2026-07-08 04:14:09 UTC)
Benchmark data age: ~1 minute at time of strategy generation (same-run live fetch)
