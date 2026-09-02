<!-- SoxCrunch Decision Matrix — auto-generated, do not edit manually -->
<!-- Step 0 reads line 2 for TTL check — do not move or reformat this line -->

Generated: 2026-07-22 03:21:08 UTC
Fetch source: LIVE FETCH

---

## Models Evaluated

| Model                  | API ID                                      | Parent Company | Country | Hosted Jurisdiction | Security Status                                         |
| ---------------------- | ------------------------------------------- | -------------- | ------- | ------------------- | ------------------------------------------------------- |
| Claude Fable 5         | claude-fable-5                              | Anthropic      | USA     | US                  | ✅ Approved                                             |
| Claude Mythos 5        | (limited availability — approved orgs only) | Anthropic      | USA     | US                  | ✅ Approved (not generally orderable)                   |
| Claude Opus 4.8        | claude-opus-4-8                             | Anthropic      | USA     | US                  | ✅ Approved                                             |
| Claude Sonnet 5        | claude-sonnet-5                             | Anthropic      | USA     | US                  | ✅ Approved                                             |
| Claude Haiku 4.5       | claude-haiku-4-5-20251001                   | Anthropic      | USA     | US                  | ✅ Approved                                             |
| GPT-5.6 Sol            | gpt-5.6-sol                                 | OpenAI         | USA     | US (Azure)          | ✅ Approved                                             |
| GPT-5.6 Terra          | gpt-5.6-terra                               | OpenAI         | USA     | US (Azure)          | ✅ Approved                                             |
| GPT-5.6 Luna           | gpt-5.6-luna                                | OpenAI         | USA     | US (Azure)          | ✅ Approved                                             |
| Gemini 3.1 Pro Preview | gemini-3.1-pro-preview                      | Google         | USA     | US/EU               | ✅ Approved (paid tier only — free tier trains on data) |
| Gemini 3.6 Flash       | gemini-3.6-flash                            | Google         | USA     | US/EU               | ✅ Approved (paid tier only)                            |
| Grok 4.5               | (verify)                                    | xAI            | USA     | US                  | ✅ Approved (limited coding-benchmark data this fetch)  |
| Kimi K3 (hosted)       | —                                           | Moonshot AI    | China   | China               | ❌ Blocked (PRC jurisdiction)                           |
| GLM-5.2 (hosted)       | —                                           | Zhipu AI       | China   | China               | ❌ Blocked (PRC jurisdiction)                           |
| DeepSeek (all, hosted) | —                                           | DeepSeek AI    | China   | China               | ❌ Blocked (PRC jurisdiction)                           |

**Status note (contradicts a stale skill-reference claim):** Claude Fable 5 is listed on the
live official pricing page with standard AND batch rates as of this fetch, and is serving
production traffic — it is **available**, not suspended.

---

## Benchmark Scores

| Model             | SWE-bench Verified      | GPQA Diamond | AA Intelligence Index             | Source URL                        |
| ----------------- | ----------------------- | ------------ | --------------------------------- | --------------------------------- |
| Claude Mythos 5   | 95.5%                   | —            | —                                 | vellum.ai/llm-leaderboard         |
| Claude Fable 5    | 95.0%                   | 94.1%        | 60 (top)                          | vellum.ai + artificialanalysis.ai |
| Claude Opus 4.8   | 88.6%                   | —            | 56 (max)                          | vellum.ai + artificialanalysis.ai |
| Claude Opus 4.7   | 87.6%                   | 94.2%        | —                                 | vellum.ai                         |
| Claude Sonnet 5   | 85.2%                   | 96.2% (top)  | 53 (max)                          | vellum.ai + artificialanalysis.ai |
| GPT-5.6 Sol       | — (not in vellum top-5) | —            | 59 (max) / 58 (xhigh) / 56 (high) | artificialanalysis.ai             |
| GPT-5.6 Terra     | —                       | —            | 55 (max) / 52 (xhigh)             | artificialanalysis.ai             |
| GPT-5.6 Luna      | —                       | —            | 51 (max)                          | artificialanalysis.ai             |
| Gemini 3.1 Pro    | —                       | 94.3%        | —                                 | vellum.ai                         |
| Gemini 3.5 Flash  | —                       | —            | 50                                | artificialanalysis.ai             |
| Grok 4.5          | —                       | —            | 54 (high)                         | artificialanalysis.ai             |
| Kimi K3 (blocked) | —                       | —            | 57                                | artificialanalysis.ai             |
| GLM-5.2 (blocked) | —                       | —            | 51 (max)                          | artificialanalysis.ai             |

Benchmark sources fetched (2026-07-22 ~03:20 UTC):

- https://livebench.ai/#/?sort=Agentic+Coding+Average — **FAILED** (JS-rendered SPA, no data
  in fetch); fell through to fallbacks per the skill's source order
- https://artificialanalysis.ai/leaderboards/models — OK (Intelligence Index top 15; its
  "price" column is per-task cost, NOT per-token — not used for pricing)
- https://www.vellum.ai/llm-leaderboard — OK (SWE-bench Verified + GPQA Diamond; AIME not
  displayed this fetch)

---

## Pricing Snapshot

| Model                                         | Input $/MTok            | Output $/MTok             | Cache write $/MTok        | Cache read $/MTok    | Batch input $/MTok | Batch output $/MTok | Context window                           | Pricing URL                                      |
| --------------------------------------------- | ----------------------- | ------------------------- | ------------------------- | -------------------- | ------------------ | ------------------- | ---------------------------------------- | ------------------------------------------------ |
| Claude Fable 5                                | $10                     | $50                       | $12.50 (5m) / $20 (1h)    | $1.00                | $5                 | $25                 | 1M (standard pricing across full window) | platform.claude.com/docs/en/about-claude/pricing |
| Claude Opus 4.8                               | $5                      | $25                       | $6.25 (5m) / $10 (1h)     | $0.50                | $2.50              | $12.50              | 1M standard                              | same                                             |
| Claude Opus 4.8 (fast mode, research preview) | $10                     | $50                       | multipliers stack         | —                    | n/a                | n/a                 | full window                              | same                                             |
| Claude Sonnet 5 (INTRO until 2026-08-31)      | $2                      | $10                       | $2.50 (5m) / $4 (1h)      | $0.20                | $1                 | $5                  | 1M standard                              | same                                             |
| Claude Sonnet 5 (from 2026-09-01)             | $3                      | $15                       | $3.75 / $6                | $0.30                | $1.50              | $7.50               | 1M                                       | same                                             |
| Claude Haiku 4.5                              | $1                      | $5                        | $1.25 / $2                | $0.10                | $0.50              | $2.50               | 200k                                     | same                                             |
| GPT-5.6 Sol                                   | $5                      | $30                       | —                         | $0.50 (cached input) | 50% off            | 50% off             | 1M (per AA)                              | developers.openai.com/api/docs/pricing           |
| GPT-5.6 Terra                                 | $2.50                   | $15                       | —                         | $0.25                | 50% off            | 50% off             | 1M                                       | same                                             |
| GPT-5.6 Luna                                  | $1                      | $6                        | —                         | $0.10                | 50% off            | 50% off             | 1M                                       | same                                             |
| Gemini 3.1 Pro Preview                        | $2 (≤200k) / $4 (>200k) | $12 (≤200k) / $18 (>200k) | $0.15 + $1/MTok/h storage | —                    | $1 / $2            | $6 / $9             | >200k tiered                             | ai.google.dev/pricing                            |
| Gemini 3.6 Flash                              | $1.50                   | $7.50                     | $0.15 + storage           | —                    | $0.75              | $3.75               | 1M                                       | same                                             |

**Tokenizer note (material to cost):** Claude Fable 5, Mythos 5, Opus 4.7+, and Sonnet 5 use
a newer tokenizer producing **~30% more tokens for the same text**; Sonnet 4.6 and earlier
use the previous tokenizer. Cost comparisons must account for this.

Pricing sources fetched (2026-07-22 ~03:20 UTC):

- https://platform.claude.com/docs/en/about-claude/pricing — OK (authoritative, full table)
- https://developers.openai.com/api/docs/pricing — OK
- https://ai.google.dev/gemini-api/docs/billing — no table (points to /pricing);
  https://ai.google.dev/pricing — OK

---

## Feature Matrix

| Model            | Prompt caching            | Batch API | Extended thinking / effort           | Tool use | 1M context                | Data residency options        |
| ---------------- | ------------------------- | --------- | ------------------------------------ | -------- | ------------------------- | ----------------------------- |
| Claude Fable 5   | ✅ (hit = 10% of input)   | ✅ (50%)  | ✅ effort controls                   | ✅       | ✅ standard pricing       | `inference_geo: "us"` at 1.1× |
| Claude Opus 4.8  | ✅                        | ✅        | ✅ effort (default high) + fast mode | ✅       | ✅                        | 1.1× US-only                  |
| Claude Sonnet 5  | ✅                        | ✅        | ✅ thinking budgets                  | ✅       | ✅                        | 1.1× US-only                  |
| Claude Haiku 4.5 | ✅                        | ✅        | ✅                                   | ✅       | ❌ (200k)                 | —                             |
| GPT-5.6 family   | ✅ (cached input)         | ✅        | ✅ reasoning_effort (low→max)        | ✅       | ✅                        | Azure regions                 |
| Gemini 3.x       | ✅ (+ hourly storage fee) | ✅        | ✅                                   | ✅       | ✅ (Flash/1M; Pro tiered) | Vertex regions                |

---

## Security & Privacy

| Model family                        | Training on API data                                                                                         | Notes                                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Claude (API, Commercial Terms)      | No by default                                                                                                | claude.ai consumer UI defaults differ — use the API for proprietary code                                     |
| OpenAI (API)                        | No by default                                                                                                | —                                                                                                            |
| Gemini                              | **Paid tier: no. FREE tier: "content used to improve our products"** — never use the free tier for this repo | confirmed on live pricing page this fetch                                                                    |
| Kimi K3 / GLM-5.2 / DeepSeek hosted | —                                                                                                            | ❌ Disqualified: PRC-jurisdiction hosted APIs (National Intelligence Law exposure; multiple government bans) |

Disqualified models (hosted API): DeepSeek (all), Kimi K3 (Moonshot), GLM-5.2 (Zhipu) — PRC jurisdiction.

---

## Raw Source URLs

- https://livebench.ai/#/?sort=Agentic+Coding+Average (failed — SPA)
- https://artificialanalysis.ai/leaderboards/models
- https://www.vellum.ai/llm-leaderboard
- https://platform.claude.com/docs/en/about-claude/pricing
- https://developers.openai.com/api/docs/pricing
- https://ai.google.dev/gemini-api/docs/billing
- https://ai.google.dev/pricing
