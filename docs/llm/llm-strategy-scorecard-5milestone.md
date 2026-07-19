<!-- SoxCrunch Strategy Scorecard — auto-generated, do not edit manually -->

Generated: 2026-07-19 05:25:24 UTC
Phase: 5 — milestone
Decision matrix source: CACHED (age: ~113 min) — docs/llm/scorecard-decision-matrix.md

Task context: PF-09 B4 — Havok physics showcase (the plan's ⭐ portfolio centrepiece): lazy-loaded
Havok WASM, tier-gated asteroid/debris fields with rigid-body collisions, proximity slowdown +
deflection, idle collisions, impact camera shake, docking contact. Multi-increment phase on the
Babylon path. Session surface: Claude Code, Max 20x plan (subscription-billed). Supersedes the
2026-07-08 5milestone scorecard (different milestone, pre-dated the Claude 5 family rows).

---

## Implementation Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SOXCRUNCH STRATEGY CARD
Phase: 5 — milestone (B4 Havok physics showcase, staged increments)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED STRATEGY: Single-model (session-native), full reasoning

PRIMARY MODEL
  Model:     Claude Fable 5 (claude-fable-5) — the session's active model
  Reasoning: thinking: high (milestone phases benefit most from full reasoning
             — long-horizon staging, physics/render integration seams, and the
             same uncheckable WGSL-twin risk class as B3)
  Use for:   the whole phase. B4 integrates a WASM physics runtime with the
             existing custom-shader scene — cross-cutting failure modes
             (physics step vs render loop, CSP/WASM loading, tier gating)
             reward the top agentic-coding model.
  Price:     $10 / $50 per MTok (API rate; session is subscription-billed)
  Key stat:  SWE-bench Verified 95.0% (Vellum, fetched 2026-07-19)

ESTIMATED COST
  $0 marginal (Max 20x). B4 staged across multiple sessions/increments; each
  increment ≈ 10-25% of a 5-hour window at high thinking. Continue in-session
  where possible (prompt-cache continuity); a fresh session per increment is
  acceptable at phase boundaries.

SECURITY POSTURE
  ✅ Anthropic-only, US jurisdiction, no training on data
  ✅ No Chinese-jurisdiction hosted APIs (hard rule upheld)
  ✅ Havok WASM ships from our own origin (lazy chunk), no third-party CDN —
     consistent with ADR-0005's no-CDN stance

TOP 3 TOKEN OPTIMISATIONS FOR THIS PHASE
  1. Stage increments; verify each before the next (avoids monolithic
     regression loops — the costliest failure mode at milestone scale).
  2. Reuse this session's already-hot context for step 1; scoped reads only
     (babylon-engine integration points are already in context). (~30% input)
  3. Diff-only output; pure-module pattern keeps physics math testable without
     booting browsers. (~20% output)

BENCHMARK SOURCES
  vellum.ai/llm-leaderboard — fetched 2026-07-19 03:31 UTC (cached matrix)
PRICING SOURCES
  platform.claude.com/docs/en/about-claude/pricing — fetched 2026-07-19 03:31 UTC (cached matrix)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Scoring Summary

| Model            | Agentic Coding (35%) | Reasoning/Math (25%) | Cost Efficiency (25%)   | Token Efficiency (15%) | Weighted Score               |
| ---------------- | -------------------- | -------------------- | ----------------------- | ---------------------- | ---------------------------- |
| Claude Fable 5   | 5.0                  | 4.8                  | 3.5 (subscription: 5.0) | 5.0                    | 4.58 (session-adjusted 4.95) |
| Claude Opus 4.8  | 4.4                  | 4.5                  | 4.5                     | 5.0                    | 4.55                         |
| Claude Sonnet 5  | 4.0                  | 5.0                  | 5.0                     | 5.0                    | 4.65                         |
| Claude Haiku 4.5 | 3.0                  | 3.5                  | 5.0                     | 4.0                    | 3.78                         |

Session-adjusted, Fable 5 leads for milestone work (zero marginal cost + highest agentic-coding
accuracy on cross-cutting integration seams).

---

## Cost Projection for This Phase

| Scenario     | Model(s)           | Est. sessions | Tokens/session      | Est. cost                            |
| ------------ | ------------------ | ------------- | ------------------- | ------------------------------------ |
| Conservative | Fable 5 (Max plan) | 2             | ~200K in / ~50K out | $0 marginal (~15-25% quota each)     |
| Moderate     | Fable 5 (Max plan) | 3-4           | ~250K in / ~60K out | $0 marginal                          |
| Heavy        | Fable 5 (Max plan) | 5+            | ~350K in / ~90K out | $0 marginal (watch weekly Fable cap) |

---

## Reasoning Configuration

| Model                    | Reasoning mode                 | Parameter | When to escalate                              |
| ------------------------ | ------------------------------ | --------- | --------------------------------------------- |
| Claude Fable 5 (session) | thinking: high (user-selected) | —         | Already at the milestone-phase recommendation |

---

## Token Optimisation Plan

1. Staged increments with per-increment VERIFY (bounded regression scope). (~30-50% vs monolith)
2. Scoped reads; integration points already hot in this session's context. (~30% input)
3. Diff-only output; pure modules keep physics math browser-free in tests. (~20% output)

---

## Data Sources Used

Decision matrix: `docs/llm/scorecard-decision-matrix.md` (Generated: 2026-07-19 03:32:02 UTC)
Benchmark data age: ~113 minutes at time of strategy generation (within the 180-min TTL — no live fetch)
