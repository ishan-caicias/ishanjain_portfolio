import { describe, expect, it } from "vitest";
import { createSpaceTravel } from "@/components/islands/space/spaceTravel";

describe("createSpaceTravel", () => {
  it("creates the normal-motion projects travel sequence", () => {
    expect(createSpaceTravel("projects", false)).toEqual({
      phase: "warp",
      scrollBehavior: "smooth",
      departureMessage: "Travelling to Projects.",
      arrivalMessage: "Arrived at Projects.",
    });
  });

  it("creates the reduced-motion contact travel sequence", () => {
    expect(createSpaceTravel("contact", true)).toEqual({
      phase: "idle",
      scrollBehavior: "auto",
      departureMessage: "Travelling to Contact.",
      arrivalMessage: "Arrived at Contact.",
    });
  });

  it("throws for an unknown station", () => {
    expect(() => createSpaceTravel("unknown", false)).toThrow(
      "Unknown space station: unknown",
    );
  });
});
