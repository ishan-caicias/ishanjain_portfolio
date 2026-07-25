# CI/CD & Deployment Design

Pipeline, runtime, and deployment-gate decisions. Operational runbooks live in
[`../runbooks`](../runbooks); test outcomes live in [`../test-reports`](../test-reports).

| Document                                                                                  | Date       | Outcome                                                                                                                                                                                                                           |
| ----------------------------------------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Node runtime & main branch protection](2026-07-19-node-runtime-and-branch-protection.md) | 2026-07-19 | Node floor declared once (`>=22.12.0`) across CI/Netlify/nvm; `main` ruleset with self-approval rationale                                                                                                                         |
| [E2E shard matrix](2026-07-25-e2e-shard-matrix.md)                                        | 2026-07-25 | Single `e2e` CI job split into a 4-way shard matrix; new `e2e-summary` aggregator job preserves the `"E2E Tests"` required-status-check name so branch protection needs no edit; payoff unverified pending a real CI run (TR-104) |
