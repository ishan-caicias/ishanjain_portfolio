import { describe, expect, it } from "vitest";
import {
  getResponsiveShipScale,
  shipTransform,
} from "@/components/islands/space/ShipRenderer";

describe("shipTransform", () => {
  it("keeps the selected ship within the camera-relative framing", () => {
    expect(shipTransform).toEqual({
      forwardOffset: 3.2,
      upwardOffset: -0.7,
      basePitch: -0.08,
      modelScale: 0.6,
    });
  });
});

describe("getResponsiveShipScale", () => {
  it("preserves desktop scale and fits the ship within a portrait viewport", () => {
    expect(getResponsiveShipScale(1440 / 900)).toBe(shipTransform.modelScale);

    const portraitAspect = 390 / 844;
    const portraitScale = getResponsiveShipScale(portraitAspect);
    const usableHalfWidth =
      0.85 *
      (shipTransform.forwardOffset - 2.00247 * portraitScale) *
      Math.tan((45 * Math.PI) / 360) *
      portraitAspect;

    expect(portraitScale).toBeLessThan(shipTransform.modelScale);
    expect(1.40462 * portraitScale).toBeLessThanOrEqual(usableHalfWidth);
  });
});
