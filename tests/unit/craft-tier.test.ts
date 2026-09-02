/**
 * PF-07 ship-v2 P4 — unit tests for the adaptive craft-quality policy.
 */
import { describe, expect, it } from "vitest";
import {
  parseStoredQuality,
  resolveCraftAttribute,
  resolveCraftTier,
  type TierSignals,
} from "@/lib/craft-tier";

const ok: TierSignals = {
  saveData: false,
  deviceMemory: 8,
  viewportWidth: 1280,
};

describe("resolveCraftTier (device policy)", () => {
  it("gives capable devices the 2k tier", () => {
    expect(resolveCraftTier(ok)).toBe("2k");
  });
  it("honors data saver", () => {
    expect(resolveCraftTier({ ...ok, saveData: true })).toBe("1k");
  });
  it("downgrades low-memory devices", () => {
    expect(resolveCraftTier({ ...ok, deviceMemory: 4 })).toBe("1k");
    expect(resolveCraftTier({ ...ok, deviceMemory: 2 })).toBe("1k");
  });
  it("treats unknown deviceMemory as capable (Safari/Firefox)", () => {
    expect(resolveCraftTier({ ...ok, deviceMemory: null })).toBe("2k");
  });
  it("downgrades narrow viewports", () => {
    expect(resolveCraftTier({ ...ok, viewportWidth: 700 })).toBe("1k");
    expect(resolveCraftTier({ ...ok, viewportWidth: 768 })).toBe("2k");
  });
});

describe("parseStoredQuality", () => {
  it("accepts the four valid values", () => {
    for (const v of ["1k", "2k", "off", "auto"] as const) {
      expect(parseStoredQuality(v)).toBe(v);
    }
  });
  it("rejects garbage and null", () => {
    expect(parseStoredQuality("4k")).toBeNull();
    expect(parseStoredQuality("")).toBeNull();
    expect(parseStoredQuality(null)).toBeNull();
  });
});

describe("resolveCraftAttribute (full precedence)", () => {
  it("URL param wins over everything", () => {
    expect(resolveCraftAttribute("1k", "2k", ok)).toBe("1k");
    expect(resolveCraftAttribute("off", "2k", ok)).toBeNull();
  });
  it("stored explicit override applies without a URL param", () => {
    expect(resolveCraftAttribute(null, "1k", ok)).toBe("1k");
    expect(resolveCraftAttribute(null, "off", ok)).toBeNull();
  });
  it("?craft=on and stored auto route through the device policy", () => {
    expect(resolveCraftAttribute("on", null, ok)).toBe("2k");
    expect(resolveCraftAttribute("on", null, { ...ok, saveData: true })).toBe(
      "1k",
    );
    expect(resolveCraftAttribute(null, "auto", ok)).toBe("2k");
  });
  // Deliberately changed at the P5 rollout (TR-020): the pre-P5 assertion was
  // "nothing set → null (wireframe)". Default is now the auto device policy.
  it("nothing set → auto device policy (default-on since P5)", () => {
    expect(resolveCraftAttribute(null, null, ok)).toBe("2k");
    expect(resolveCraftAttribute(null, null, { ...ok, saveData: true })).toBe(
      "1k",
    );
    expect(resolveCraftAttribute("bogus", null, ok)).toBe("2k");
  });
  it("explicit opt-outs still restore the wireframe", () => {
    expect(resolveCraftAttribute("off", null, ok)).toBeNull();
    expect(resolveCraftAttribute(null, "off", ok)).toBeNull();
  });
});
