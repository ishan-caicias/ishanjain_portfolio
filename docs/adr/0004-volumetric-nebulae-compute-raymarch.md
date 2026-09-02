# ADR-0004 — Volumetric nebulae: tier-gated raymarch producer behind a shared composite

**Date:** 2026-07-19
**Status:** Accepted
**Context:** PF-09 B3 requires "volumetric/raymarched nebulae (WebGPU compute — the 'gaseous'
look)" with the exit criterion "fallback tier still coherent." The delivery plan left the
concrete shape open: "a new post-process or dedicated mesh layer."

## Decision

1. **One shared architecture, tier-gated only at the producer.** A half-resolution offscreen
   texture holds the raymarched nebulae each frame; a fullscreen triangle (`ShaderMaterial`
   GLSL/WGSL twins, additive blend, no depth write) composites it. The producer differs by
   backend: **WebGPU = `ComputeShader` (WGSL) writing an rgba8 storage texture, 40 steps;
   WebGL2 = `ProceduralTexture` (GLSL fragment) rendering the same march, 18 steps.** Nothing
   downstream of the texture knows which tier produced it.
2. **Volume and tuning constants are baked into generated shader sources** by
   `nebula-field.ts` (template generators), not passed as uniforms. Only camera basis, fov/aspect,
   and time are dynamic. The same TS constants drive the JS mirrors the unit tests pin, and the
   generators are string-testable — including a TR-045 reserved-WGSL-identifier guard.
3. **Volumes anchor at real catalog nebulae** (`m42`, `ngc7293`, `veil`, `rosette`) via
   `bodyWorldPosition` — the same placement `travelTo()` uses, so navigation flies into the
   actual volumes.

## Alternatives considered

- **Fragment-shader raymarch on both tiers (no compute).** Rejected: B3 names WebGPU compute as
  the showcase; a fragment-only design abandons the plan's stated point.
- **Per-volume billboard quads raymarched in the fragment shader.** Rejected as the shared
  architecture: it splits the composition path per tier (billboards vs compute texture) and
  makes the WebGL2 path structurally different from WebGPU, doubling divergence surface. The
  chosen design keeps one composite and isolates tier differences to the producer.
- **Per-volume data as uniform arrays/UBO.** Rejected: GLSL/WGSL twins with hand-matched std140
  layouts are exactly the class of silent-divergence risk TR-045 demonstrated; baked constants
  eliminate the binding surface and are directly unit-testable.
- **Full-resolution raymarch.** Rejected: soft gas upsampled bilinearly from half-res is visually
  indistinguishable at ~4× less GPU work; mobile budgets (B5) will want to shrink it further,
  which the single `NEBULA_TEX_SCALE` knob supports.

## Amendment 2026-07-19 — destination-gated visibility (owner direction)

The volumes are **not ambient sky features**: the owner reported the gas appearing during the
acceleration burn the moment a nebula was selected, and directed that it "slowly appear during
deceleration burn and enlarge when the ship stops." Each volume now carries a reveal factor
(one `vec4 uReveal` uniform, component per volume, swizzle baked — the no-uniform-arrays rule
holds): 0 until the warp's decel threshold (k = 0.53, shared with the HUD phase constants),
smoothstep ramp to 0.7 at arrival, ease-out swell to 1.0 over 1.8 s once stopped, damped
fade-out on departure. Reveal scales _density_, so low reveal shrinks the cloud's apparent
extent as well as its brightness — the gas grows in rather than crossfading. Pure envelope in
`nebula-field.ts` (`NEBULA_REVEAL`, `nebulaRevealTarget`), verified with staged real-hardware
screenshots in [TR-047](../test-reports/TR-047.md).

## Amendment 2026-07-20 — generalized shape system + scalable reveal (PF-10 C1, TR-072)

**Context:** PF-10 C1 needs the remaining 8 real NGC2000 "Volume"-archetype nebulae (Helix, Cat's
Eye, Box, Butterfly, Hourglass, Crab, Ring, Trifid) added alongside the 4 showcase volumes above.
Two blockers, both structural:

1. **`uReveal: vec4`'s 4-component swizzle hard-caps the volume count at 4** —
   `revealComponent()` throws past index 3. The naive fix (more vec4 uniforms) doesn't scale: it
   grows the uniform surface linearly with volume count forever.
2. **Every volume was a sphere.** `nebulaDensity`'s shell falloff (`q = length(rel)/radius`)
   assumes a spherical container — real planetary nebulae are rings, bipolar hourglasses, boxes,
   and more; a sphere-only model can't represent them (a licensing constraint on the source
   shader material also independently ruled out porting Gaia Sky's own bespoke per-object
   shaders for these 8 objects — see the science brief below).

**Decision:**

1. **Reveal generalizes to a fixed 2-slot "active + previous" scheme**, not per-volume storage.
   `uVolumeA`/`uRevealA` + `uVolumeB`/`uRevealB` (4 scalars total, replacing the 4-component
   vec4) carry at most the two volumes that can plausibly have nonzero reveal at once — the
   destination being warped-to/arrived-at, and the one just departed (still damping to 0 via the
   existing `fadeOutLambda` decay). Every generated per-volume call computes its own reveal as
   `(i == volA) ? revealA : (i == volB ? revealB : 0.0)` — one cheap integer comparison per
   volume, baked at generation time exactly like the swizzle was, just against a runtime index
   instead of a compile-time component. This is O(1) in uniform count for ANY number of volumes,
   not just 12 — the stated goal ("easily expanded later").
2. **`NebulaVolume.shape` replaces the implicit sphere.** A small closed set of SDF primitives
   (sphere, torus, capped cone, box, thin shell) plus `union`/`subtract` combinators, each with a
   GLSL generator, a WGSL generator, and a JS mirror (matching the existing noise-stack
   convention exactly — `Density → both shader twins → JS mirror → unit test` stays one
   pipeline). `nebulaDensity`'s `q = shapeDistance(shape, rel) / radius` generalizes the old
   `length(rel)/radius` (the sphere primitive reproduces the old formula exactly — the 4
   showcase volumes are unaffected, verified by regression test). Adding a 13th volume, or a 9th
   primitive kind, requires touching only its own descriptor/generator case — the march loop,
   compositing, and reveal plumbing are closed for modification (SOLID open/closed, applied to
   shader code generation rather than runtime polymorphism, since ADR-0004's point 2 above
   already committed this codebase to baked-per-volume generated shaders over uniform arrays).
3. **Shapes are original, not ported from Gaia Sky's per-object shaders.** Those 8 shaders are
   CC-BY-NC-SA (non-commercial) ports of shadertoy material — a real license mismatch for a
   professional portfolio, and the owner declined to accept that risk. Astra produced a real
   SCIENCE-BRIEF (`docs/analysis/2026-07-20-ngc2000-volume-nebula-shapes-science-brief.md`)
   classifying an original SDF-primitive shape per object against real morphology (torus for
   Ring/Helix, opposed capped-cones for Hourglass/Butterfly, a rounded box for Box Nebula — whose
   real Hubble image genuinely IS box-shaped, concentric shells for Cat's Eye, a
   heavily-perturbed ellipsoid + smooth inner glow for Crab reflecting its real dual emission
   mechanism — filamentary shell + synchrotron continuum — subtracted lanes for Trifid's real
   dust extinction). Every recommendation lands ACCURATE or SIMPLIFIED; none needed a declared
   license.

## Consequences

- `webgpuEngine`'s compute support must be loaded explicitly
  (`Engines/WebGPU/Extensions/engine.computeShader`, dynamic-imported beside the engine) — it is
  a side-effect prototype patch that tree-shaking otherwise drops; omitting it kills the render
  loop at boot (found and fixed in [TR-046](../test-reports/TR-046.md)).
- V-orientation is a per-backend-pair contract (WGSL pair flips V at both ends, GLSL pair
  nowhere); documented in `nebula-field.ts` and asserted structurally in unit tests.
- Visual tuning lives entirely in `NEBULA_MARCH`; B5's tier system is the designated place to
  scale steps/resolution per device class.
