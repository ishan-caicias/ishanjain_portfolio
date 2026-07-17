# ADR 0002 — In-Engine GLB Ship Renderer (Engine Fork)

**Date:** 2026-07-17
**Status:** Accepted
**Context:** PF-07 ship-v2 ([delivery plan](../delivery-plan/PF-07-spaceship-v2.md) ·
[Codex analysis audit](../analysis/2026-07-17-codex-analysis-audit.md))

## Decision 1 — Render the textured craft inside the custom engine (Option A+)

The Sci-Fi Aircraft | Spaceship Fighter GLB is rendered by a **purpose-built loader/renderer**
(`src/lib/craft-loader.ts`, ~490 lines incl. types) inside the existing WebGL1 engine — not by a
Three.js side-renderer (Option B) and not via an R3F migration (Option C).

Rationale (full comparison in the audit):

- The asset is a single static mesh with four textures; travel/banking/thruster motion stays
  procedural in the engine. A general scene graph buys nothing here.
- World-space integration (P2's realism goal) is native when the ship shares the stars' context,
  projection, and frame loop. A second canvas/context makes it harder.
- Zero runtime dependencies added to the flag-off page. The loader + meshopt decoder are a lazy
  chunk (35 KB raw) fetched only when the `craft` flag is on.
- **Fallback gate result: not triggered.** The P1 proof reached acceptable visual quality
  (textured, normal-mapped, rim-lit hull at wireframe-parity placement), so Option B remains
  unexercised.

The loader is deliberately **not** a general glTF loader: it hard-errors on any shape other than
the pipeline's pinned output (1 mesh/primitive/material, `EXT_meshopt_compression` +
`KHR_mesh_quantization` + `EXT_texture_webp`). Pipeline and loader change together;
`tests/unit/craft-assets.test.ts` and `tests/unit/craft-loader.test.ts` enforce the contract
from both sides.

## Decision 2 — `space-engine.js` is forked from the prototype

The byte-identical-to-prototype constraint (a PF-07 Phase 1 verification device) is retired.
`src/lib/space-engine.js` left the ESLint/Prettier ignore lists, was one-time formatted
(1,469 → 2,302 lines, two dead-code lint fixes), and now evolves under normal review discipline.
Fork point: the commit containing this ADR. The prototype copy under
`resources/Interactive Outerspace Portfolio/` remains the historical reference.

Engine changes in this fork increment: context `depth: false → true` (depth testing enabled
only inside the craft pass), a `craft` attribute (`off`/`1k`/`2k`, default off → wireframe path
untouched), `_loadCraft()` with error-fallback to the wireframe, craft re-upload/retry on
context restore, and load-state observability (`data-craft-state` + `cosmos:craft` events).

## Decision 3 — CSP gains `'wasm-unsafe-eval'`

The meshopt decoder compiles a WASM module, which the TR-010 hash-based CSP blocked (found by
E2E, not prediction). `script-src` now includes `'wasm-unsafe-eval'` — WebAssembly compilation
only, **not** JS `eval()`. Browsers without the keyword (old Safari) block the decoder and the
engine keeps the wireframe: graceful, and acceptable for an opt-in flag. Recorded as a security
posture change against the OWASP audit in `docs/security/`.

## Consequences

- P2/P3 build on the craft pass (world-space staging, thrusters) without new dependencies.
- The 1K tier's simplified mesh and the tuned lighting need a real-device eyeball before the
  flag defaults on (P4/P5).
- Anyone regenerating the GLBs with new extensions (KTX2, Draco) breaks loader-contract tests
  by design — that is the coordination mechanism, not an accident.
