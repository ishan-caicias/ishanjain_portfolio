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
  setStations(
    list: { id: string; ra: number; dec: number; ly: number }[],
  ): void;
  fieldInfo(index: number): SpaceEngineFieldInfo | null;
  bodies: SpaceEngineBody[];
  stations: SpaceEngineBody[];
  cam: [number, number, number];
  ship: SpaceEngineShip;
  arrivedId: string | null;
  warp: { mode: "idle" | "aim" | "warp" };
  _buildBodies?: () => void;
  _ijStSig?: string;
}

export {};
