# ADR-0006 — Cut the default engine over to Babylon.js + WebGPU

**Date:** 2026-07-19
**Status:** **ACCEPTED 2026-07-19 — owner decision.** The default is Babylon as of this date.
Two gate rows were closed by explicit owner decision rather than measurement, recorded honestly:

- **§B3 (billboard memory): dispositioned Option A** — B2 step 1's −5.2 MiB (24%,
  21.9 → 16.8 MiB) reduction is accepted as satisfying ADR-0003's condition 3. Revisitable in a
  future iteration (the 16-bit quantization path is scoped in TR-notes if ever needed).
- **§A (iPad / mid-Android budget rows): accepted risk — post-flip validation.** The owner chose
  to flip ahead of the device measurements. Mitigations: the per-visitor `?engine=webgl` escape
  and the [rollback runbook](../runbooks/2026-07-19-engine-cutover-rollback.md); the B5 tier
  system bounds worst-case load on constrained devices. **The device pass remains the standing
  post-flip follow-up** (tier badge + `?perf=1`, same instrument).

**Known behaviour deltas at cutover** (named Babylon-path scope boundaries, now live product
deltas — surfaced to the owner before the flip): ~~station sprite markers hidden, field-star
hover absent, free-look drag absent.~~ All three are candidates for future iterations.

> **UPDATE 2026-07-20 (TR-058):** all three closed — station sprite markers (GAP-11),
> field-star hover (GAP-09), and free-look drag (GAP-08) all ship on the Babylon path now,
> alongside eight further gaps from the
> [cutover gap analysis](../analysis/2026-07-19-webgl-babylon-cutover-gap-analysis.md)
> (GAP-06, GAP-07, GAP-10, GAP-12 through GAP-16). Struck through rather than rewritten, per
> this repo's own corrections-are-additive convention — the text above was accurate at the
> Accepted date and is kept as the record of what was true then.

## Context

PF-09 B0–B5 delivered full feature parity-plus on the Babylon path: the photometric 168,959-star
catalog, PF-08 cinematic flight with distance-scaled pacing, GPU shooting stars, destination-
gated volumetric nebulae (WebGPU compute / WebGL2 fragment), the GLB hull with flip-and-burn
thrusters + heat shimmer + docking contact, the Havok asteroid field with proximity slowdown,
deflection, impact shake — all behind a formal quality-tier system (full/balanced/lite) with
reduced-motion and no-WebGL parity, 216 unit / 66 E2E green, CI bundle + perf-regression gates
(TR-027 … TR-052). _(Context written pre-flip: the legacy WebGL1 engine was the shipping
default at that point. It is now archived behind `?engine=webgl` — see the Status header.)_

## Decision (upon acceptance)

1. `resolveEngine`'s default becomes `"babylon"` (`src/lib/engine-select.ts`, one line).
2. `space-engine.js` is **archived-in-place**: still shipped and fully functional behind
   `?engine=webgl` for at least one release; its removal is a separate future decision with its
   own record.
3. The per-visitor and full-deploy rollback paths are the
   [engine-cutover runbook](../runbooks/2026-07-19-engine-cutover-rollback.md).

## Evidence required to accept (the gate)

- Checklist §A: all five device-class budget rows measured on real hardware (owner devices;
  instrument: tier badge + `?perf=1`; the TR-032/033/043 measurement-skepticism rules apply).
- Checklist §B3: an explicit disposition of ADR-0003's billboard-memory condition — either
  accept B2 step 1's −5.2 MiB (24%) reduction as satisfying it, or complete a further
  reduction first. Recorded here, whichever way it lands.
- Full suite + CI gates green at the flip commit.

## Consequences

- First paint cost moves from the ~150 KB-class legacy engine to the lazy Babylon chunk set
  (~330 KB gz engine core + on-demand ship/physics payloads) — the per-device startup budgets
  in §A are exactly the guard on this trade.
- The `netlify.toml` header-CSP hazard (checklist §C2) must be re-verified at flip.
- E2E default-engine expectations change with the flip (named, declared test updates).
