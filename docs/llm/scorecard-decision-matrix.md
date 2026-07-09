<!-- SoxCrunch Decision Matrix — auto-generated, do not edit manually -->
<!-- Step 0 reads line 2 for TTL check — do not move or reformat this line -->

Generated: 2026-07-08 04:14:09 UTC
Fetch source: LIVE FETCH

---

## Models Evaluated

| Model                  | API ID                    | Parent Company | Country | Hosted Jurisdiction | Security Status                                                  |
| ---------------------- | ------------------------- | -------------- | ------- | ------------------- | ---------------------------------------------------------------- |
| Claude Fable 5         | claude-fable-5            | Anthropic      | USA     | US                  | ✅ Approved                                                      |
| Claude Mythos 5        | — (limited availability)  | Anthropic      | USA     | US                  | ✅ Approved (access-gated, not confirmed available on this plan) |
| Claude Opus 4.8        | claude-opus-4-8           | Anthropic      | USA     | US                  | ✅ Approved                                                      |
| Claude Opus 4.7        | —                         | Anthropic      | USA     | US                  | ✅ Approved                                                      |
| Claude Sonnet 5        | claude-sonnet-5           | Anthropic      | USA     | US                  | ✅ Approved                                                      |
| Claude Haiku 4.5       | claude-haiku-4-5-20251001 | Anthropic      | USA     | US                  | ✅ Approved                                                      |
| GPT-5.5                | —                         | OpenAI         | USA     | US                  | ✅ Approved                                                      |
| GPT-5.3-Codex          | —                         | OpenAI         | USA     | US                  | ✅ Approved                                                      |
| Gemini 3.1 Pro Preview | —                         | Google         | USA     | US/EU (Vertex)      | ✅ Approved                                                      |
| Gemini 3.5 Flash       | —                         | Google         | USA     | US/EU (Vertex)      | ✅ Approved                                                      |
| GLM-5.2                | —                         | Zhipu AI       | China   | China               | ❌ Blocked (PRC-jurisdiction hosted)                             |
| Qwen3.7 Max            | —                         | Alibaba Cloud  | China   | China               | ❌ Blocked (PRC-jurisdiction hosted)                             |
| MiniMax-M3             | —                         | MiniMax        | China   | China               | ❌ Blocked (PRC-jurisdiction hosted)                             |
| DeepSeek V4 Pro        | —                         | DeepSeek AI    | China   | China               | ❌ Blocked (PRC-jurisdiction hosted)                             |

---

## Benchmark Scores

| Model                  | SWE-bench Verified (Vellum) | AA Intelligence Index | Source URL                                                           |
| ---------------------- | --------------------------- | --------------------- | -------------------------------------------------------------------- |
| Claude Mythos 5        | 95.5%                       | not listed            | vellum.ai/llm-leaderboard, artificialanalysis.ai/leaderboards/models |
| Claude Fable 5         | 95%                         | 60                    | same                                                                 |
| Claude Opus 4.8        | 88.6%                       | 56                    | same                                                                 |
| Claude Opus 4.7        | 87.6%                       | 54                    | same                                                                 |
| Claude Sonnet 5        | 85.2%                       | 53                    | same                                                                 |
| Claude Haiku 4.5       | not in top-5 slice returned | not listed            | data gap — not confirmed live this run                               |
| GPT-5.5 (xhigh)        | not in top-5 slice returned | 55                    | artificialanalysis.ai                                                |
| GPT-5.5 (high)         | not in top-5 slice returned | 53                    | artificialanalysis.ai                                                |
| GPT-5.3 Codex (xhigh)  | not in top-5 slice returned | 44                    | artificialanalysis.ai                                                |
| GLM-5.2 (max)          | not in top-5 slice returned | 51                    | artificialanalysis.ai — disqualified, scored for reference only      |
| Gemini 3.5 Flash       | not in top-5 slice returned | 50                    | artificialanalysis.ai                                                |
| Qwen3.7 Max            | not in top-5 slice returned | 46                    | artificialanalysis.ai — disqualified, scored for reference only      |
| Gemini 3.1 Pro Preview | not in top-5 slice returned | 46                    | artificialanalysis.ai                                                |
| MiniMax-M3             | not in top-5 slice returned | 44                    | artificialanalysis.ai — disqualified, scored for reference only      |
| DeepSeek V4 Pro (max)  | not in top-5 slice returned | 44                    | artificialanalysis.ai — disqualified, scored for reference only      |

Note: LiveBench.ai is a client-rendered SPA and returned no table data via static fetch (primary source
skipped this run). Vellum's leaderboard only returned its top-5 "Best in Agentic Coding" slice, all Claude
models — GPT-5.5/Codex/Gemini SWE-bench figures are a genuine data gap this run, not a zero score.

Benchmark sources fetched: vellum.ai/llm-leaderboard (2026-07-08), artificialanalysis.ai/leaderboards/models
(2026-07-08). livebench.ai attempted, no data (SPA).

---

## Pricing Snapshot

| Model                                       | Input $/MTok | Output $/MTok       | Cache write (5m)              | Cache read      | Batch input | Batch output | Context window            | Pricing URL                                      |
| ------------------------------------------- | ------------ | ------------------- | ----------------------------- | --------------- | ----------- | ------------ | ------------------------- | ------------------------------------------------ |
| Claude Fable 5                              | $10          | $50                 | $12.50                        | $1              | $5          | $25          | 1M                        | platform.claude.com/docs/en/about-claude/pricing |
| Claude Opus 4.8                             | $5           | $25                 | $6.25                         | $0.50           | $2.50       | $12.50       | 1M                        | same                                             |
| Claude Opus 4.7                             | $5           | $25                 | $6.25                         | $0.50           | $2.50       | $12.50       | 1M                        | same                                             |
| Claude Sonnet 5 (intro, through 2026-08-31) | $2           | $10                 | $2.50                         | $0.20           | $1          | $5           | 1M                        | same                                             |
| Claude Sonnet 5 (from 2026-09-01)           | $3           | $15                 | $3.75                         | $0.30           | $1.50       | $7.50        | 1M                        | same                                             |
| Claude Haiku 4.5                            | $1           | $5                  | $1.25                         | $0.10           | $0.50       | $2.50        | 200K (not confirmed live) | same                                             |
| GPT-5.5 (standard)                          | $5           | $30                 | —                             | $0.50 (cached)  | $2.50       | $15          | 922K (AA)                 | developers.openai.com/api/docs/pricing           |
| GPT-5.3-Codex (standard)                    | $1.75        | $14                 | —                             | $0.175 (cached) | $0.875      | $7           | 400K (AA)                 | same                                             |
| Gemini 3.1 Pro Preview (≤200K)              | $2           | $12                 | $0.20 + $4.50/Mtok/hr storage | —               | $1          | $6           | 1M                        | ai.google.dev/pricing                            |
| Gemini 3.5 Flash                            | $1.50        | $9 (incl. thinking) | $0.15 + $1/Mtok/hr storage    | —               | $0.75       | $4.50        | 1M                        | same                                             |

Pricing sources fetched: platform.claude.com/docs/en/about-claude/pricing (2026-07-08),
developers.openai.com/api/docs/pricing (2026-07-08), ai.google.dev/pricing (2026-07-08).

---

## Feature Matrix

| Model            | Prompt caching    | Batch API | Extended thinking     | Effort controls        | Tool use | 1M context | Data residency options     |
| ---------------- | ----------------- | --------- | --------------------- | ---------------------- | -------- | ---------- | -------------------------- |
| Claude Fable 5   | ✅                | ✅        | ✅                    | thinking budget_tokens | ✅       | ✅         | US/global                  |
| Claude Opus 4.8  | ✅                | ✅        | ✅                    | thinking budget_tokens | ✅       | ✅         | US/global, `inference_geo` |
| Claude Sonnet 5  | ✅                | ✅        | ✅                    | thinking budget_tokens | ✅       | ✅         | US/global, `inference_geo` |
| Claude Haiku 4.5 | ✅                | ✅        | limited               | thinking budget_tokens | ✅       | ❌ (200K)  | US/global                  |
| GPT-5.5          | ✅ (cached input) | ✅        | ✅                    | reasoning_effort       | ✅       | ❌ (922K)  | US (Azure)                 |
| GPT-5.3-Codex    | ✅ (cached input) | ✅        | ✅                    | reasoning_effort       | ✅       | ❌ (400K)  | US (Azure)                 |
| Gemini 3.1 Pro   | ✅                | ✅        | not confirmed         | not confirmed          | ✅       | ✅         | US/EU (Vertex)             |
| Gemini 3.5 Flash | ✅                | ✅        | ✅ (billed as output) | not confirmed          | ✅       | ✅         | US/EU (Vertex)             |

---

## Security & Privacy

| Model                                             | Training on API data  | Notes                                                                                                                                                                                                  |
| ------------------------------------------------- | --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| All Anthropic models (API)                        | No (commercial terms) | Consumer claude.ai web UI defaults to opt-in training as of Sep 2025 — use API/Claude Code (not web chat) for proprietary code                                                                         |
| GPT-5.5 / GPT-5.3-Codex (API)                     | No (commercial terms) |                                                                                                                                                                                                        |
| Gemini (Vertex AI)                                | No (commercial terms) | Use Vertex AI, not the free consumer Gemini app                                                                                                                                                        |
| GLM-5.2, Qwen3.7 Max, MiniMax-M3, DeepSeek V4 Pro | N/A — disqualified    | PRC-jurisdiction hosted APIs; CCP data-access risk per National Intelligence Law. Self-hosted open-weight use on Western-region cloud is a separate, conditionally-acceptable case not evaluated here. |

Disqualified models (hosted API): GLM-5.2 (Zhipu AI, China), Qwen3.7 Max (Alibaba, China), MiniMax-M3
(MiniMax, China), DeepSeek V4 Pro (DeepSeek AI, China) — all excluded per the hard security filter.

---

## Raw Source URLs

- https://livebench.ai/#/?sort=Agentic+Coding+Average (attempted, no data — client-rendered SPA)
- https://artificialanalysis.ai/leaderboards/models
- https://www.vellum.ai/llm-leaderboard
- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.openai.com/api/docs/pricing
- https://ai.google.dev/pricing
