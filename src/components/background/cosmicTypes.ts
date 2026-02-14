/**
 * Types and event payloads for the cosmic background (stars, interactive objects, AR-ready).
 */

export type CosmicObjectKind = "star" | "galaxy" | "asteroid" | "comet";

export interface CosmicObject {
  id: string;
  kind: CosmicObjectKind;
  position: [number, number, number];
  rarityTier?: number;
}

export interface CosmicObjectSelectedDetail {
  id: string;
  kind: CosmicObjectKind;
  position: [number, number, number];
  screen: { x: number; y: number };
  timestamp: number;
}

export const COSMIC_OBJECT_SELECTED_EVENT = "cosmic-object-selected" as const;
