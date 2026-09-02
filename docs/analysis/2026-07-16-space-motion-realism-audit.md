# Space Motion Realism Audit

> **✓ Audit status (2026-07-17):** this document **survives audit in full**. It analyzed the
> prototype engine, which is byte-identical to the shipped `src/lib/space-engine.js`, so all six
> findings and the top-4 improvement ranking apply directly to the live scene (the DOM-overlay
> critique maps to the React overlay islands). It is the primary input to
> [PF-07-spaceship-v2.md](../delivery-plan/PF-07-spaceship-v2.md).

## Scope

This audit focuses on the actual spaceship-travel prototype:

- `Interactive Outerspace Portfolio/space-engine.js`
- `Interactive Outerspace Portfolio/Space Portfolio.dc.html`
- `Interactive Outerspace Portfolio/assets/ship.obj`

It also uses the handoff and data docs to understand intended product direction.

## What Already Works Well

- Real celestial coordinates and catalog-driven destinations give the travel concept genuine depth.
- The warp sequence already has a clear cinematic structure: aim, acceleration, flip, deceleration.
- The renderer includes meaningful space-specific effects such as aberration, Doppler shifts, radial trails, and a Milky Way layer.
- The ship has some attitude feedback already: bob, bank, and flip-and-burn.

So the issue is not "nothing is physical." The issue is that the most visible foreground elements are not governed by the same spatial rules as the star scene behind them.

## Why It Feels 2D

### 1. The ship is rendered in clip space, not in scene space

The ship is not treated as a real nearby object occupying the same world as the catalog bodies. In `_drawShip()`, the engine:

- picks a target screen position based on scroll state and arrival state,
- interpolates `ship.x`, `ship.y`, `ship.s`, and `ship.a`,
- then applies an NDC shift before drawing the ship wireframe.

That gives a polished hero-prop effect, but it also makes the ship feel composited on top of the universe instead of flying inside it.

### 2. Several important "space objects" are actually DOM overlays

In `Space Portfolio.dc.html`, the following are fixed-screen UI layers rather than world-space objects:

- station markers
- hover tooltip
- warp overlay
- arrival vista
- mission command bar
- section overlays

The star scene is 3D, but much of the user's interaction loop is still driven by flat screen-space elements. That layer break is visible.

### 3. Camera travel is cinematic easing, not physically integrated motion

The warp path uses eased interpolation between `from` and `to` camera positions. The "physics" labels are strong, but the system is not integrating thrust, inertia, or orientation from forces over time. Even `vC` is computed as display telemetry from distance and duration, not from a simulation state.

That is totally valid for UX, but it makes the motion feel authored rather than lived-in.

### 4. The ship does not participate in body-relative lighting or occlusion

The bodies and deep-sky billboards exist in the rendered scene, but the ship does not visibly:

- catch light from a nearby destination,
- darken when crossing bright backgrounds,
- pass behind or in front of scene objects with meaningful depth cues,
- react to arrival proximity beyond UI state changes.

Without those relationships, the ship reads more like a HUD mascot than a vehicle.

### 5. Exhaust and thrust read too simply

The engine glow is just three point sprites with opacity and size changes. The ship banks and flips, but there is no layered exhaust behavior such as:

- inner hot core plus outer plume
- motion streaking tied to burn phase
- jitter or vibration during acceleration
- transient bloom or heat distortion

That keeps the ship readable, but not especially convincing.

### 6. Scroll-state logic leaks into flight staging

The ship moves between presentation states based on `window.scrollY` and home/arrival conditions:

- home position near lower center
- parked position near center
- corner escort position when scrolled

That is clever from a layout perspective, but it weakens the illusion that one continuous vehicle is being flown.

## Highest-Value Improvements Without A Full Rewrite

### 1. Move the ship from clip space to near-camera world space

Keep the ship near the camera, but give it a real transform in view space rather than a screen-anchored post-shift. That alone would improve depth cues more than most cosmetic effects.

### 2. Add a real thruster stack

Replace the three point-sprite glow with:

- a bright nozzle core
- a soft cone or billboard plume
- a phase-dependent flare length
- subtle turbulence during acceleration and deceleration

### 3. Add camera-lag and mass cues

The ship and camera should not respond instantly to look and route changes. Small lag, overshoot, and settle behavior would give the motion more perceived weight.

### 4. Let nearby destinations affect the ship

On arrival or close approach:

- tint the ship rim light from the target body color
- slightly scale plume brightness to destination type
- increase parallax dust or local particle density

This creates the feeling that the ship is entering a place, not just switching overlays.

### 5. Reduce overlay dominance during travel

The current overlays are useful, but the more time the user spends looking at fixed-screen boxes, the less the flight reads as immersive. The interaction loop would feel more physical if:

- station labels were quieter,
- arrival UI revealed in layers,
- some information lived closer to the ship or target instead of at the screen edge.

## Improvements That Need A Better Asset Path

These are realistic only if the ship stops being OBJ-wireframe-only:

- textured hull materials
- emissive engine channels
- animated control surfaces or greebles
- landing or brake-flap motions
- damage or wear pass

That pushes the project toward glTF support or a Three.js/R3F sub-renderer.

## Recommendation

The best realism return per unit of effort is:

1. world-space ship placement,
2. better thruster rendering,
3. more inertial camera response,
4. stronger local arrival cues.

Those four changes would make the experience feel much less flat even before any framework or dependency shift.
