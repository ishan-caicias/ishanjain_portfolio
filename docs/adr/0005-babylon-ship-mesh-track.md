# ADR-0005 — Babylon ship-mesh track: glTF loader, self-hosted meshopt decoder, CSP blob: connect-src

**Date:** 2026-07-19
**Status:** Accepted
**Context:** B3's three ship-attached items (thrusters, heat-shimmer, docking polish) were
blocked on "no ship mesh exists on the Babylon path" since the B3 sequencing decision. The owner
unblocked the track (2026-07-19: "having all visuals in place gives more accurate and complete
idea"). The live engine's `craft-loader.ts` is a hand-rolled raw-WebGL GLB parser and does not
port.

## Decision

1. **Load the existing tiered GLBs with `@babylonjs/loaders` (glTF 2.0)** — new runtime
   dependency, dynamic-imported on the ship path only (~100 KB gz lazy chunk). The same
   `craft-tier.ts` quality policy governs (URL param → stored override → device signals;
   `off` keeps the camera-only behaviour). Asset bytes shipped: unchanged (same GLBs).
2. **Self-host the meshopt decoder.** The GLBs are meshopt-compressed; Babylon fetches the
   decoder from `cdn.babylonjs.com` by default, which the site's `script-src 'self'` CSP
   rightly blocks. The identical file from the `meshoptimizer` package (already a dev
   dependency of the asset pipeline) is vendored at `public/assets/craft/meshopt_decoder.js`
   (prettier-ignored) and wired via `MeshoptCompression.Configuration.decoder.url`. No CDN, no
   new origin, no CSP script relaxation; the existing `wasm-unsafe-eval` (ADR-0002) covers its
   WASM instantiation.
3. **CSP: `connect-src 'self' blob:`.** Babylon's glTF loader unpacks embedded GLB textures
   into `blob:` object URLs and _fetches_ them on the WebGPU texture path (`img-src blob:`
   alone covers only image-element loads — the WebGL2 path passed while real WebGPU failed,
   caught by the real-hardware spec). `blob:` URLs can only be minted by same-origin scripts,
   so the external-origin surface is unchanged. Recorded in
   [docs/security](../security/2026-07-19-csp-blob-connect-src.md).
4. **Coordinate/choreography conventions** (in `babylon-ship.ts`): GLB normalized to a unit box
   under a wrapper whose +Z is the nose (Babylon's RH→LH import negates the unit-ship −Z nose);
   plume anchors z-negate into wrapper space; the hull flies at the virtual-ship position the
   chase camera has trailed since B2 step 4 and flips 180° across the HUD's flip window
   (`flipPhase` — thresholds shared with `wphase`, pinned by unit test). Plume geometry and
   phase functions are ship-dynamics.ts's existing pure F3 system, colours baked into the
   GLSL/WGSL twins.
5. **Shimmer is an unconditional-sample post-process.** WGSL forbids `textureSample` in
   non-uniform control flow (hard GPUValidationError on real hardware — TR-047); pass-through
   is achieved by zeroing the displacement, not by branching. This constraint is pinned by unit
   test for both twins.

## Alternatives considered

- **Port craft-loader.ts's raw parser to Babylon buffers.** Rejected: re-implements what the
  maintained loader does, without PBR material wiring, for zero byte savings on assets.
- **Decompress the GLBs at build time to avoid meshopt entirely.** Rejected: trades a 29 KB
  decoder (cached, ship-path only) for permanently larger asset downloads on every visit.
- **Widen CSP `script-src` to the Babylon CDN.** Rejected outright: adds a third-party script
  origin for a file we can serve ourselves.

## Consequences

- `@babylonjs/loaders` version must track `@babylonjs/core` (both pinned 8.56.2).
- The vendored decoder must be refreshed if the meshoptimizer dependency majors (a stale
  decoder fails loudly at GLB load, surfacing as `shipState: "failed"` in `sceneStats`).
- The B6 cutover checklist inherits the CSP `connect-src blob:` requirement for any future
  hosting/header configuration (netlify.toml's commented CSP does not yet include it).
