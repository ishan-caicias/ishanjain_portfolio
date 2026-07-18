/**
 * PF-09 B0 — dual-engine selection policy (pure).
 */
import { describe, expect, it } from "vitest";
import {
  parseEngineValue,
  resolveEngine,
  type EngineKind,
} from "@/lib/engine-select";

describe("parseEngineValue", () => {
  it("accepts the two known engines, rejects everything else", () => {
    expect(parseEngineValue("webgl")).toBe("webgl");
    expect(parseEngineValue("babylon")).toBe("babylon");
    for (const bad of ["", "three", "WEBGL", "babylon ", null])
      expect(parseEngineValue(bad)).toBeNull();
  });
});

describe("resolveEngine", () => {
  it("defaults to the current engine (webgl)", () => {
    expect(resolveEngine(null)).toBe("webgl");
    expect(resolveEngine(null, null)).toBe("webgl");
  });

  it("URL param wins over stored and default", () => {
    expect(resolveEngine("babylon", "webgl")).toBe("babylon");
    expect(resolveEngine("webgl", "babylon")).toBe("webgl");
  });

  it("falls back to the stored override when no valid URL param", () => {
    expect(resolveEngine(null, "babylon")).toBe("babylon");
    expect(resolveEngine("bogus", "babylon" as EngineKind)).toBe("babylon");
  });
});
