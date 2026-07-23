# Implementation Plans

Technical companions to delivery plans: the delivery plan owns WHAT and WHY (scope,
requirements, exit criteria, owner decisions); the implementation plan owns HOW (files,
APIs, schemas, step sequences, test additions) — written for the coding agents executing
slices. Bidirectional links are mandatory: every implementation section links back to its
delivery-plan phase, and the delivery plan links here from its header. If the two disagree,
**the delivery plan wins** and the disagreement is a docs defect fixed in the same turn.

| Plan                                                         | Delivery plan                                                                                            | Status                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [PF-11-implementation-plan.md](PF-11-implementation-plan.md) | [PF-11 Cinematic Journey & Scale Honesty](../delivery-plan/PF-11-cinematic-journey-and-scale-honesty.md) | ACTIVE (2026-07-22) — phases D0–D9 incl. the ADR-0010 Render Console; ALL owner decisions taken (D6.2 belt re-expression approved later same day); **D0.1 delivered ([TR-081](../test-reports/TR-081.md)) — its step 1 corrected additively in place: `setTimeout(0)` chains buy nothing on this page, deadline pacing carries it** |
