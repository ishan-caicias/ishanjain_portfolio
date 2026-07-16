import { describe, expect, it } from "vitest";
import {
  getSpaceStation,
  spaceStations,
} from "@/components/islands/space/stations";

describe("spaceStations", () => {
  it("defines the experience, projects, and contact stations in travel order", () => {
    expect(spaceStations).toEqual([
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
    ]);
  });

  it("looks up the complete projects station", () => {
    expect(getSpaceStation("projects")).toEqual({
      id: "projects",
      label: "Projects",
      targetId: "projects",
      visual: "cargo-fragment",
      accessibleName: "Travel to Projects station",
    });
  });

  it("returns undefined for an unknown station", () => {
    expect(getSpaceStation("unknown")).toBeUndefined();
  });
});
