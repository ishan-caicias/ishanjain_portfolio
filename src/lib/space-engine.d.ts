// Ambient JSX typing for <space-engine>, the vanilla custom element registered as a side
// effect of importing space-engine.js. Not a typed React component - see PF-07 delivery plan.
import type { DetailedHTMLProps, HTMLAttributes } from "react";

declare module "react" {
  namespace JSX {
    interface IntrinsicElements {
      "space-engine": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
      // PF-09 B0: the Babylon renderer (behind ?engine=babylon). Registered as a
      // side effect of importing babylon-engine.ts; implements the same
      // SpaceEngineElement contract (stubbed until B2).
      "babylon-scene": DetailedHTMLProps<
        HTMLAttributes<HTMLElement>,
        HTMLElement
      >;
    }
  }
}

// Runtime shape of a projected body/station, as read by the DC logic layer each frame.
export interface SpaceEngineBody {
  e: { id: string };
  sx: number | null;
  sy: number | null;
  ex: number;
  ey: number;
  vis: boolean;
}

export interface SpaceEngineFieldInfo {
  ra: number;
  dec: number;
  ly: number;
  mg: number;
  ci: number; // color index, used to estimate spectral class
  type: number; // 0-7, deep-layer population byte
}

export interface SpaceEngineShip {
  x: number;
  y: number;
  s: number;
  a: number;
}

// Public surface of the <space-engine> custom element, as called/read by the ported DC logic.
export interface SpaceEngineElement extends HTMLElement {
  travelTo(id: string, quiet?: boolean): void;
  goHome(quiet?: boolean): void;
  randomBody(): void;
  /** PF-11 D1.3: start the launch-from-Earth ascent (Babylon engine only; the archived WebGL
   * engine has no such method — callers null-check). Reduced motion / no-WebGL cut instantly. */
  beginAscent?(): void;
  /** PF-11 D1.3: snap the ascent to its end (the SKIP affordance). */
  skipAscent?(): void;
  setStations(
    list: { id: string; ra: number; dec: number; ly: number }[],
  ): void;
  fieldInfo(index: number): SpaceEngineFieldInfo | null;
  /** PF-11 D5.3 (Babylon engine only — the archived WebGL engine has no field-catalog scan of
   * this kind; readers must null-check): nearest field-catalog index of the given deep-layer
   * population byte to the ship's current position, or -1 if none/not loaded. Feeds the search
   * console's "A WHITE DWARF · NEAREST INSTANCE" class rows. */
  nearestFieldOfType?(typeByte: number): number;
  bodies: SpaceEngineBody[];
  stations: SpaceEngineBody[];
  cam: [number, number, number];
  ship: SpaceEngineShip;
  arrivedId: string | null;
  /** PF-11 D3.3 (ADR-0010): destination picked mid-journey, launched on arrival.
   * Babylon engine only — the archived WebGL engine keeps its silent-no-op
   * behaviour by design (it is a rollback lever, not a feature target), so
   * readers must treat `undefined` as "this engine has no queue". */
  queuedTargetId?: string | null;
  warp: { mode: "idle" | "aim" | "warp" };
  _buildBodies?: () => void;
  _ijStSig?: string;
}

export {};
