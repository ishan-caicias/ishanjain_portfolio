import { describe, expect, it } from "vitest";
import { readWarpEvent } from "@/components/islands/space/sceneEvents";

describe("readWarpEvent", () => {
  it("returns null when a warp event has no timing data", () => {
    const event = new CustomEvent("cosmos:warp", {
      detail: { phase: "warp" },
    });

    expect(readWarpEvent(event)).toBeNull();
  });

  it("returns the recognised phase and timestamp", () => {
    const event = new CustomEvent("cosmos:warp", {
      detail: { phase: "aim", t: 125 },
    });

    expect(readWarpEvent(event)).toEqual({ phase: "aim", t: 125 });
  });

  it("rejects unknown phases", () => {
    const event = new CustomEvent("cosmos:warp", {
      detail: { phase: "launch", t: 125 },
    });

    expect(readWarpEvent(event)).toBeNull();
  });
});
