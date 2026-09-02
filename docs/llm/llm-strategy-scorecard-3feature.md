<!-- SoxCrunch Strategy Scorecard — auto-generated, do not edit manually -->

Generated: 2026-07-19 03:32:02 UTC
Phase: 3 — feature
Decision matrix source: LIVE FETCH (lean refresh) — docs/llm/scorecard-decision-matrix.md

Task context: PF-09 B3 — volumetric/raymarched nebulae (WebGPU compute primary, WebGL2 fragment
fallback, GLSL/WGSL shader twins, vitest unit + Playwright E2E) in an Astro/TypeScript/Babylon.js
portfolio repo. Session surface: Claude Code, Max 20x plan (subscription-billed — API prices below
are for routing judgment, not marginal cost).

---

## Implementation Strategy

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 SOXCRUNCH STRATEGY CARD
Phase: 3 — feature (volumetric nebulae raymarch, tier-gated WebGPU/WebGL2)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

RECOMMENDED STRATEGY: Single-model (session-native), reasoning-tiered

PRIMARY MODEL
  Model:     Claude Fable 5 (claude-fable-5) — the session's active model
  Reasoning: thinking: high for shader/raymarch design and WGSL-WGSL2 twin
             authoring; drop to routine effort for mechanical test scaffolding
  Use for:   the whole increment. This feature is shader-twin-heavy: WGSL has
             no compiler cross-check against GLSL, reserved-word landmines
             (TR-045: `meta`/`ref` blanked the whole scene), and async
             validation that hides failures. That risk profile is exactly
             where the top SWE-bench model earns its premium — a wrong shader
             here costs a real-device debugging session, not a retry.
  Price:     $10 / $50 per MTok (API rate; session is subscription-billed)
  Key stat:  SWE-bench Verified 95.0% (Vellum, fetched 2026-07-19)

WHY NOT HYBRID: on a Max-plan Claude Code session the marginal cost of the
active model is zero; splitting to Sonnet 5 for boilerplate would save weekly
Fable quota (user at 45%) but cost session-context continuity mid-feature.
Delegating self-contained chunks (e.g. test-only passes) to a Sonnet-routed
subagent is the one worthwhile split if quota pressure rises.

ESTIMATED COST
  $0 marginal (Max 20x subscription). Quota impact: one focused feature
  session ≈ 10-20% of the 5-hour window at high thinking. User at 37% 5-hour /
  45% weekly Fable at session start — one increment fits; avoid speculative
  re-reads and full-file dumps to stay inside it.

SECURITY POSTURE
  ✅ Anthropic-only: US jurisdiction, no training on data (Commercial Terms)
  ✅ No Chinese-jurisdiction hosted APIs (hard rule upheld)
  ✅ Product ships zero hosted-LLM dependencies (rule inherited but moot here)

TOP 3 TOKEN OPTIMISATIONS FOR THIS PHASE
  1. Read only the files the increment touches (babylon-engine.ts,
     nebula module, 2 test files) — skip re-reading the 2000-line
     space-engine.js beyond the already-done nebula grep. (~30-40% input saving)
  2. Emit diffs/new files only, never whole-codebase restatements; keep shader
     twins in one module so a re-read is one file. (~20% output saving)
  3. Session prompt-cache continuity: keep working in this session rather than
     restarting (fresh session = cold cache re-read of all context). (~50%+
     effective input saving vs a restart)

BENCHMARK SOURCES
  vellum.ai/llm-leaderboard — fetched 2026-07-19 03:31 UTC
PRICING SOURCES
  platform.claude.com/docs/en/about-claude/pricing — fetched 2026-07-19 03:31 UTC
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

Sonnet 5 wins on raw API value; Fable 5 wins session-adjusted (zero marginal cost + highest
agentic-coding accuracy on the riskiest sub-task class in this feature: uncheckable shader twins).

---

## Cost Projection for This Phase

| Scenario                | Model(s)           | Est. sessions | Tokens/session       | Est. cost                            |
| ----------------------- | ------------------ | ------------- | -------------------- | ------------------------------------ |
| Conservative            | Fable 5 (Max plan) | 1             | ~150K in / ~30K out  | $0 marginal (~10-15% of 5-h quota)   |
| Moderate                | Fable 5 (Max plan) | 1-2           | ~250K in / ~60K out  | $0 marginal (~20-30% quota)          |
| Heavy (regression loop) | Fable 5 (Max plan) | 2-3           | ~400K in / ~100K out | $0 marginal (risk: weekly Fable cap) |

---

## Reasoning Configuration

| Model                    | Reasoning mode                 | Parameter | When to escalate                                                                        |
| ------------------------ | ------------------------------ | --------- | --------------------------------------------------------------------------------------- |
| Claude Fable 5 (session) | thinking: high (user-selected) | —         | Already at the phase-appropriate ceiling for shader-twin work; do NOT lower mid-feature |

---

## Token Optimisation Plan

1. Scoped reads: only files the increment touches; the space-engine.js inspection is already done — cite it, don't re-read. (~30-40% input)
2. Diff-only output; shader twins co-located in one module. (~20% output)
3. Stay in-session for the full pipeline run (VERIFY/REVIEW/DOCUMENT) — a restart pays full cold-context cost. (~50% effective input vs restart)

---

## Data Sources Used

Decision matrix: `docs/llm/scorecard-decision-matrix.md` (Generated: 2026-07-19 03:32:02 UTC)
Benchmark data age: ~1 minute at time of strategy generation (lean refresh; non-Claude rows carried from 2026-07-08)
