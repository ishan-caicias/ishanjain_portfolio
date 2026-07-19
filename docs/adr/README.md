# Architecture Decision Records

Numbered, immutable records of significant technical decisions. Superseded ADRs stay on disk and
are marked as such.

| ADR                                                 | Date       | Decision                                                                                                                                                                      | Status                                                   |
| --------------------------------------------------- | ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| [0001](0001-dependency-and-framework-upgrade.md)    | 2026-07-13 | Dependency & framework upgrade; TypeScript pinned at 6.0.3 (TS 7 deferred pending toolchain support)                                                                          | Accepted                                                 |
| [0002](0002-in-engine-glb-ship-renderer.md)         | 2026-07-17 | In-engine GLB ship renderer (no Three.js); space-engine.js forked from prototype; CSP + 'wasm-unsafe-eval'                                                                    | Accepted — renderer stance partly superseded by 0003     |
| [0003](0003-babylon-webgpu-renderer-adoption.md)    | 2026-07-18 | Adopt Babylon.js + WebGPU as the renderer; proceed to B2 on desktop evidence. **Mobile condition discharged 2026-07-19** on real Android; conditions 2–3 still gate cutover   | Accepted (conditional — 1 of 3 conditions cleared)       |
| [0004](0004-volumetric-nebulae-compute-raymarch.md) | 2026-07-19 | B3 volumetric nebulae: tier-gated raymarch producer (WebGPU compute / WebGL2 ProceduralTexture) behind one shared half-res texture + composite; constants baked, not uniforms | Accepted — amended 2026-07-19 (destination-gated reveal) |
| [0005](0005-babylon-ship-mesh-track.md)             | 2026-07-19 | B3 ship track: @babylonjs/loaders for the tiered GLBs, self-hosted meshopt decoder (no CDN), CSP `connect-src blob:`, flip-and-burn choreography conventions                  | Accepted                                                 |
