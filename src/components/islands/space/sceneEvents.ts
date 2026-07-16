export type WarpPhase = "aim" | "warp" | "flip" | "decel" | "idle";

export interface WarpEventDetail {
  phase: WarpPhase;
  t: number;
}

const warpPhases: ReadonlySet<string> = new Set([
  "aim",
  "warp",
  "flip",
  "decel",
  "idle",
]);

export function readWarpEvent(event: Event): WarpEventDetail | null {
  const detail = (event as CustomEvent<unknown>).detail;

  if (
    typeof detail !== "object" ||
    detail === null ||
    !Object.hasOwn(detail, "phase") ||
    !Object.hasOwn(detail, "t")
  ) {
    return null;
  }

  const { phase, t } = detail as { phase: unknown; t: unknown };

  if (
    typeof phase !== "string" ||
    !warpPhases.has(phase) ||
    typeof t !== "number"
  ) {
    return null;
  }

  return { phase: phase as WarpPhase, t };
}
