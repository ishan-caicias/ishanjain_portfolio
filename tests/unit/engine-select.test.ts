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
  // Default flipped webgl -> babylon at the B6 cutover (ADR-0006, owner
  // decision 2026-07-19) — a declared test change, not a drive-by.
  it("defaults to babylon (the ADR-0006 cutover)", () => {
    expect(resolveEngine(null)).toBe("babylon");
    expect(resolveEngine(null, null)).toBe("babylon");
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
