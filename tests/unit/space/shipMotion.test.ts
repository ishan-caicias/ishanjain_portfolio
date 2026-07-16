import { describe, expect, it } from "vitest";
import {
  nextShipMotion,
  plumeIntensityForPhase,
  type ShipMotionState,
} from "@/components/islands/space/shipMotion";

describe("nextShipMotion", () => {
  it("moves toward a new bank target without jumping past it", () => {
    const state: ShipMotionState = { bank: 0, bankVelocity: 0 };

    const next = nextShipMotion(state, 0.8, 1 / 60, "warp");

    expect(next.bank).toBeGreaterThan(0);
    expect(next.bank).toBeLessThan(0.8);
    expect(next.bankVelocity).toBeGreaterThan(0);
  });

  it("returns deterministic plume intensities for each travel phase", () => {
    expect(plumeIntensityForPhase("warp")).toBe(1);
    expect(plumeIntensityForPhase("decel")).toBe(0.8);
    expect(plumeIntensityForPhase("aim")).toBe(0.45);
    expect(plumeIntensityForPhase("idle")).toBe(0.25);
    expect(plumeIntensityForPhase("warp")).toBeGreaterThan(
      plumeIntensityForPhase("idle"),
    );
    expect(plumeIntensityForPhase("flip")).toBe(0.65);
  });

  it("does not advance for a zero or negative frame duration", () => {
    const state: ShipMotionState = { bank: 0.2, bankVelocity: 0.4 };

    expect(nextShipMotion(state, 0.8, 0, "aim")).toEqual(state);
    expect(nextShipMotion(state, 0.8, -1, "aim")).toEqual(state);
  });
});
