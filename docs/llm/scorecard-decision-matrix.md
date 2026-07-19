<!-- SoxCrunch Decision Matrix — auto-generated, do not edit manually -->
<!-- Step 0 reads line 2 for TTL check — do not move or reformat this line -->

Generated: 2026-07-19 03:32:02 UTC
Fetch source: LIVE FETCH (lean refresh — Claude family fresh; non-Claude rows CARRIED FORWARD from the 2026-07-08 matrix, marked ◇, and should be re-fetched before being relied on)

---

## Models Evaluated

| Model             | API ID                                 | Parent Company | Country | Hosted Jurisdiction | Security Status        |
| ----------------- | -------------------------------------- | -------------- | ------- | ------------------- | ---------------------- |
| Claude Fable 5    | claude-fable-5                         | Anthropic      | USA     | US                  | ✅ Approved            |
| Claude Mythos 5   | claude-mythos-5 (limited availability) | Anthropic      | USA     | US                  | ✅ Approved            |
| Claude Opus 4.8   | claude-opus-4-8                        | Anthropic      | USA     | US                  | ✅ Approved            |
| Claude Sonnet 5   | claude-sonnet-5                        | Anthropic      | USA     | US                  | ✅ Approved            |
| Claude Haiku 4.5  | claude-haiku-4-5-20251001              | Anthropic      | USA     | US                  | ✅ Approved            |
| GPT-5.x tier ◇    | (carried)                              | OpenAI         | USA     | US (Azure)          | ✅ Approved            |
| Gemini 3.1 Pro ◇  | (carried)                              | Google         | USA     | US/EU               | ✅ Approved            |
| DeepSeek (hosted) | —                                      | DeepSeek AI    | China   | China               | ❌ Blocked (hard rule) |

---

## Benchmark Scores

| Model           | SWE-bench Verified | GPQA Diamond | Source URL                             |
| --------------- | ------------------ | ------------ | -------------------------------------- |
| Claude Mythos 5 | 95.5%              | not shown    | vellum.ai/llm-leaderboard (2026-07-19) |
| Claude Fable 5  | 95.0%              | 94.1%        | vellum.ai/llm-leaderboard (2026-07-19) |
| Claude Opus 4.8 | 88.6%              | not shown    | vellum.ai/llm-leaderboard (2026-07-19) |
| Claude Opus 4.7 | 87.6%              | 94.2%        | vellum.ai/llm-leaderboard (2026-07-19) |
| Claude Sonnet 5 | 85.2%              | 96.2%        | vellum.ai/llm-leaderboard (2026-07-19) |

Benchmark sources fetched: https://www.vellum.ai/llm-leaderboard (2026-07-19 03:31 UTC). livebench.ai not fetched this run (lean refresh). No GPT/Gemini models appeared in the top SWE-bench Verified positions on the fetched leaderboard.

---

## Pricing Snapshot

| Model                             | Input $/MTok | Output $/MTok | Cache write (5m) $/MTok | Cache read $/MTok | Batch input $/MTok | Batch output $/MTok | Context window   | Pricing URL                                      |
| --------------------------------- | ------------ | ------------- | ----------------------- | ----------------- | ------------------ | ------------------- | ---------------- | ------------------------------------------------ |
| Claude Fable 5                    | $10          | $50           | $12.50                  | $1                | $5                 | $25                 | 1M (std pricing) | platform.claude.com/docs/en/about-claude/pricing |
| Claude Mythos 5                   | $10          | $50           | $12.50                  | $1                | $5                 | $25                 | 1M (std pricing) | (same)                                           |
| Claude Opus 4.8                   | $5           | $25           | $6.25                   | $0.50             | $2.50              | $12.50              | 1M (std pricing) | (same)                                           |
| Claude Sonnet 5 (thru 2026-08-31) | $2           | $10           | $2.50                   | $0.20             | $1                 | $5                  | 1M (std pricing) | (same)                                           |
| Claude Haiku 4.5                  | $1           | $5            | $1.25                   | $0.10             | $0.50              | $2.50               | 200K             | (same)                                           |

Notes: Fable 5 / Mythos 5 / Opus 4.7+ / Sonnet 5 use the newer tokenizer (~30% more tokens for the same text). Fast mode: Opus 4.8 at $10/$50 (research preview). Pricing fetched 2026-07-19 03:31 UTC.

---

## Feature Matrix

| Model            | Prompt caching | Batch API | Extended thinking | Effort controls | Tool use | 1M context |
| ---------------- | -------------- | --------- | ----------------- | --------------- | -------- | ---------- |
| Claude Fable 5   | ✅             | ✅        | ✅                | ✅              | ✅       | ✅         |
| Claude Opus 4.8  | ✅             | ✅        | ✅                | ✅              | ✅       | ✅         |
| Claude Sonnet 5  | ✅             | ✅        | ✅                | ✅              | ✅       | ✅         |
| Claude Haiku 4.5 | ✅             | ✅        | ✅                | ✅              | ✅       | ❌         |

---

## Security & Privacy

| Model                          | Training on API data | Notes                                                                |
| ------------------------------ | -------------------- | -------------------------------------------------------------------- |
| Claude family (API/Commercial) | No                   | Max-plan Claude Code sessions are subscription-billed, not per-token |

Disqualified models (hosted API): DeepSeek all versions, Kimi/Moonshot, PRC-jurisdiction operators — Chinese-jurisdiction data routing (hard rule, never bypass).

---

## Raw Source URLs

https://www.vellum.ai/llm-leaderboard
https://platform.claude.com/docs/en/about-claude/pricing
