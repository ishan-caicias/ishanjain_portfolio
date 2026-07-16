import { describe, expect, it } from "vitest";
import { isSpaceSceneEnabled } from "../../src/config/features";

describe("isSpaceSceneEnabled", () => {
  it("defaults to the scene and accepts an explicit rollback flag", () => {
    expect(isSpaceSceneEnabled("true")).toBe(true);
    expect(isSpaceSceneEnabled("false")).toBe(false);
    expect(isSpaceSceneEnabled(undefined)).toBe(true);
  });
});
