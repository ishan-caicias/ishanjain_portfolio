import { describe, expect, it } from "vitest";
import { isSpaceSceneEnabled } from "../../src/config/features";

describe("isSpaceSceneEnabled", () => {
  it("enables the scene only for the exact true flag value", () => {
    expect(isSpaceSceneEnabled("true")).toBe(true);
    expect(isSpaceSceneEnabled("false")).toBe(false);
    expect(isSpaceSceneEnabled(undefined)).toBe(false);
  });
});
