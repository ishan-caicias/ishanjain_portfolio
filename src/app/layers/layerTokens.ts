/**
 * Layer z-index and pointer-events — single source of truth for interactive layers.
 * Use these tokens in layout/components so stacking and hit-testing stay consistent.
 *
 * Stack order (bottom to top): starfield → footer → ship 3D → HUD → panels → modals.
 */

export const STARFIELD_Z = 0;
export const FOOTER_Z = 10;
export const SHIP_3D_Z = 20;
export const HUD_Z = 30;
export const PANELS_Z = 40;
export const MODALS_Z = 50;

/** Pointer-events for starfield (no interaction). */
export const STARFIELD_POINTER_EVENTS = "none" as const;

/** Pointer-events for footer (no interaction on background). */
export const FOOTER_POINTER_EVENTS = "none" as const;

/**
 * Ship canvas: use "auto" only when we need to click the ship; otherwise "none"
 * so clicks pass through to hub/panels.
 */
export const SHIP_3D_POINTER_EVENTS_DEFAULT = "none" as const;
export const SHIP_3D_POINTER_EVENTS_INTERACTIVE = "auto" as const;

export const HUD_POINTER_EVENTS = "auto" as const;
export const PANELS_POINTER_EVENTS = "auto" as const;
export const MODALS_POINTER_EVENTS = "auto" as const;

/** CSS custom property names for use in styles (values must match constants above). */
export const LAYER_CSS_VARS = {
  starfield: "--z-starfield",
  footer: "--z-footer",
  ship3d: "--z-ship-3d",
  hud: "--z-hud",
  panels: "--z-panels",
  modals: "--z-modals",
} as const;
