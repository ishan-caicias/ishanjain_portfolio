# ADR-0007 — Background bulk-layer merge: post-boot lazy fetch, tier-gated, idle-gated rebuild

**Date:** 2026-07-20
**Status:** Accepted
**Context:** PF-10 C1 left 3 real bulk populations (white dwarfs, CNS5, Oort cloud) with a
proven Track B PNG-pack mechanism but no rendering wiring (TR-063/065). The natural integration
point — `CATALOG_CHUNKS` in `star-catalog.ts` — already generalizes cleanly to an arbitrary
number of PNG chunks decoded into one merged `StarField` (`decodeStarCatalog`), and object-type
bytes 0/3/7 (star/galaxy/oort dust) are already real, distinct shader branches. The naive move —
append the new asset paths to `CATALOG_CHUNKS` — was rejected: those chunks fetch synchronously
before the first frame and gate `cosmos:ready`, and white dwarfs alone is a real ~5.4 MB asset
(359,073 records). Fetching that eagerly would directly threaten the PF-09/PF-10 startup budgets
(≤2.5–4.0 s by device class).

## Decision

1. **Fetch bonus layers AFTER `cosmos:ready`, never awaited, never gating startup** — the same
   non-blocking philosophy this file already applies to the ship GLB and the Milky Way band's
   texture. `_loadBonusStarLayers()` runs once per boot, triggered from the render loop's first
   frame.
2. **Merge via a full re-decode, not a hand-written field-merge function.** The base catalog's
   raw RGB chunks are retained (`_baseCatalogRgb`) from the initial `loadStarField()` call;
   `_loadBonusStarLayers` calls `decodeStarCatalog([...base, ...bonus])` once, reusing the exact
   tested decode path instead of a second, parallel merge implementation.
3. **Gate the expensive geometry rebuild on ship-idle, not just on the fetch/decode completing.**
   Rebuilding billboard geometry for 500k+ merged records and re-uploading GPU vertex buffers is
   genuine main-thread + GPU work. `_waitForWarpIdle()` polls `this.warp.mode === "idle"` once
   per animation frame (capped at 8 s) before calling the actual rebuild, so the one-time
   enhancement never competes with an active warp for frame time.
4. **Explicitly dispose the outgoing VertexBuffer before creating its replacement.**
   `mesh.setVerticesBuffer(new VertexBuffer(...))` replaces the JS-side reference but does not
   dispose the old GPU buffer object — a real, measured leak (not theoretical): a single leaked
   "starMeta" buffer measurably degraded every subsequent frame under SwiftShader. Fixed in
   `_applyStarFieldGeometry` (`this._stars.getVertexBuffer("starMeta")?.dispose()` before the
   replacement).
5. **Tier-gate the dominant-cost chunk (white dwarfs) to `full` only**, not `balanced`/`lite`.
   Real measurement this session: merging white dwarfs roughly triples total billboard vertex
   count (675,836 → 2,174,968) and, under SwiftShader/WebGL2 (a reasonable stand-in for a real
   mid-tier or no-WebGPU device), turned a 350ms-configured reduced-motion warp into a 6+ second
   real-world completion — evidence read as per-frame-dt-clamped warp-progress integration
   compounding real frame-time cost into disproportionate wall-clock delay, not a linear cost.
   CNS5 + Oort cloud (small, ~80 KB / ~136 KB combined, 15,564 records) stay on every tier.

## Alternatives considered

- **Add the new PNG paths directly to `CATALOG_CHUNKS`.** Rejected: blocks `cosmos:ready` on a
  multi-MB fetch, directly threatening startup budgets.
- **A new GPU-instanced particle system per bulk population.** Assumed necessary by the original
  PF-10 plan for Oort cloud specifically; rejected once real investigation found the shader
  already reserves object-type byte 7 for exactly this population — the existing star-record
  format and shader already support it, no new rendering primitive needed.
- **Hand-write a `StarField` merge function** (concatenate positions/meta typed arrays, sum
  counts) instead of re-decoding all chunks together. Rejected: `decodeStarCatalog` already does
  this correctly and is unit-tested; a second implementation is a second thing that can drift
  from the shipped format.
- **Skip the idle-gate and just eat the mesh-rebuild hitch.** Rejected once measured: the
  rebuild's cost is not confined to the rebuild instant — a larger settled mesh has a real,
  ongoing per-frame cost under constrained rendering, so gating the moment of rebuild alone would
  not have been sufficient by itself; it remains valuable as defense against colliding the
  rebuild's own transient cost with an active warp regardless.

## Consequences

- A visitor on a real weak/no-WebGPU device gets CNS5 + Oort cloud but not white dwarfs, by
  design — an explicit, tier-scoped reduction, not a silent drop (`_loadBonusStarLayers`'s own
  comment states the real measured reasoning).
- `sceneStats().starCount` is no longer a fixed constant after boot — it can grow once, later,
  from 168,959 to a tier-dependent total (168,959 / 184,523 / 543,742, per real chunk sizes).
  Any future test or code asserting an exact post-boot count must treat this as a floor or force
  a specific tier via `?tier=`, not assume the base-catalog constant (this bit two existing E2E
  assertions this session — both fixed, named in TR-066).
- This same pattern (fetch-after-ready, tier-gate the dominant cost, idle-gate the rebuild,
  dispose-before-replace) is the template for any future bulk background-layer addition — most
  directly, SDSS DR18 (PF-10 C2), though that population needs its own separate mesh rather than
  merging into this one (see `scripts/gaia-sdss18-pngpack.mjs`'s header: SDSS's real comoving
  distances require log-depth-compressed positions, incompatible with this mesh's linear-ly
  convention).
