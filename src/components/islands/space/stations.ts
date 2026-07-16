export interface SpaceStation {
  readonly id: string;
  readonly label: string;
  readonly targetId: string;
  readonly visual: string;
  readonly accessibleName: string;
}

export const spaceStations = [
  {
    id: "experience",
    label: "Experience",
    targetId: "experience",
    visual: "relay-satellite",
    accessibleName: "Travel to Experience station",
  },
  {
    id: "projects",
    label: "Projects",
    targetId: "projects",
    visual: "cargo-fragment",
    accessibleName: "Travel to Projects station",
  },
  {
    id: "contact",
    label: "Contact",
    targetId: "contact",
    visual: "communications-buoy",
    accessibleName: "Travel to Contact station",
  },
] as const satisfies readonly SpaceStation[];

export function getSpaceStation(id: string): SpaceStation | undefined {
  return spaceStations.find((station) => station.id === id);
}
