import type { WarpPhase } from "./sceneEvents";
import { getSpaceStation } from "./stations";

export interface SpaceTravel {
  phase: WarpPhase;
  scrollBehavior: ScrollBehavior;
  departureMessage: string;
  arrivalMessage: string;
}

export function createSpaceTravel(
  stationId: string,
  reducedMotion: boolean,
): SpaceTravel {
  const station = getSpaceStation(stationId);

  if (!station) {
    throw new Error(`Unknown space station: ${stationId}`);
  }

  return {
    phase: reducedMotion ? "idle" : "warp",
    scrollBehavior: reducedMotion ? "auto" : "smooth",
    departureMessage: `Travelling to ${station.label}.`,
    arrivalMessage: `Arrived at ${station.label}.`,
  };
}
