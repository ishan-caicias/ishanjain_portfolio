/**
 * PF-11 D9.1 — the Render Console's layer registry (pure).
 */
import { describe, expect, it } from "vitest";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import {
  LAYERS,
  parseLayersParam,
  serializeLayersParam,
  tierDefaults,
  resolveLayers,
  LAYERS_STORAGE_KEY,
  formatBytes,
  formatVerts,
  type LayerId,
} from "@/lib/render-layers";
import { layerBytes } from "../../budgets.config.mjs";

describe("LAYERS registry", () => {
  it("every entry has a unique id, a non-empty label, and non-negative bytes/verts", () => {
    const seen = new Set<string>();
    for (const l of LAYERS) {
      expect(seen.has(l.id)).toBe(false);
      seen.add(l.id);
      expect(l.label.length).toBeGreaterThan(0);
      expect(l.assetBytes).toBeGreaterThanOrEqual(0);
      expect(l.vertsApprox).toBeGreaterThanOrEqual(0);
      expect(l.bootCritical).toBe(false);
    }
  });

  it("every entry declares a default for all three tiers", () => {
    for (const l of LAYERS) {
      expect(l.defaultByTier).toHaveProperty("full");
      expect(l.defaultByTier).toHaveProperty("balanced");
      expect(l.defaultByTier).toHaveProperty("lite");
    }
  });

  it("star-field and bonus-stars are marked not-yet-toggleable, matching the documented architectural reasons", () => {
    const star = LAYERS.find((l) => l.id === "star-field")!;
    const bonus = LAYERS.find((l) => l.id === "bonus-stars")!;
    expect(star.implemented).toBe(false);
    expect(bonus.implemented).toBe(false);
  });

  it("gaia-tiny defaults to off on every tier (D8 hasn't shipped the data)", () => {
    const tiny = LAYERS.find((l) => l.id === "gaia-tiny")!;
    expect(tiny.implemented).toBe(false);
    expect(tiny.defaultByTier.full).toBe(false);
    expect(tiny.defaultByTier.balanced).toBe(false);
    expect(tiny.defaultByTier.lite).toBe(false);
  });

  it("belt-physics's default mirrors QUALITY_BUDGETS[tier].asteroids exactly", async () => {
    const { QUALITY_BUDGETS } = await import("@/lib/babylon-tiers");
    const beltPhysics = LAYERS.find((l) => l.id === "belt-physics")!;
    for (const tier of ["full", "balanced", "lite"] as const) {
      expect(beltPhysics.defaultByTier[tier]).toBe(
        QUALITY_BUDGETS[tier].asteroids,
      );
    }
  });

  it("planet-hires's default mirrors QUALITY_BUDGETS[tier].planetTexture === ultra-progressive", async () => {
    const { QUALITY_BUDGETS } = await import("@/lib/babylon-tiers");
    const planetHires = LAYERS.find((l) => l.id === "planet-hires")!;
    for (const tier of ["full", "balanced", "lite"] as const) {
      expect(planetHires.defaultByTier[tier]).toBe(
        QUALITY_BUDGETS[tier].planetTexture === "ultra-progressive",
      );
    }
  });
});

describe("parseLayersParam / serializeLayersParam", () => {
  it("parses boolean 1/0 entries", () => {
    expect(parseLayersParam("sdss-field:0,belt-visual:1")).toEqual({
      "sdss-field": false,
      "belt-visual": true,
    });
  });

  it("parses a numeric count entry", () => {
    expect(parseLayersParam("belt-physics:16")).toEqual({
      "belt-physics": 16,
    });
  });

  it("returns an empty object for null/empty input", () => {
    expect(parseLayersParam(null)).toEqual({});
    expect(parseLayersParam("")).toEqual({});
  });

  it("silently skips unknown ids and malformed entries", () => {
    expect(
      parseLayersParam("not-a-real-layer:1,sdss-field,belt-visual:1"),
    ).toEqual({ "belt-visual": true });
  });

  it("round-trips through serializeLayersParam", () => {
    const config: Partial<Record<LayerId, boolean | number>> = {
      "sdss-field": false,
      "belt-physics": 32,
    };
    const serialized = serializeLayersParam(config);
    expect(parseLayersParam(serialized)).toEqual(config);
  });
});

describe("tierDefaults", () => {
  it("returns every LayerId's default for the given tier", () => {
    const full = tierDefaults("full");
    for (const l of LAYERS) expect(full[l.id]).toBe(l.defaultByTier.full);
  });
});

describe("resolveLayers (URL -> stored -> tier default)", () => {
  it("falls back to the tier default when nothing else is set", () => {
    const resolved = resolveLayers(null, null, "lite");
    expect(resolved).toEqual(tierDefaults("lite"));
  });

  it("stored localStorage config overrides the tier default", () => {
    const stored = JSON.stringify({ "sdss-field": false });
    const resolved = resolveLayers(null, stored, "full");
    expect(resolved["sdss-field"]).toBe(false);
    // everything else still comes from the tier default
    expect(resolved["belt-visual"]).toBe(tierDefaults("full")["belt-visual"]);
  });

  it("URL param overrides both stored and the tier default", () => {
    const stored = JSON.stringify({ "sdss-field": false });
    const resolved = resolveLayers("sdss-field:1", stored, "full");
    expect(resolved["sdss-field"]).toBe(true);
  });

  it("a partial URL override leaves every other layer at its stored/tier value", () => {
    const stored = JSON.stringify({ "belt-visual": false });
    const resolved = resolveLayers("sdss-field:0", stored, "full");
    expect(resolved["sdss-field"]).toBe(false); // from URL
    expect(resolved["belt-visual"]).toBe(false); // from stored
    expect(resolved["milky-way-band"]).toBe(
      tierDefaults("full")["milky-way-band"],
    ); // from tier default
  });

  it("tolerates malformed localStorage JSON without throwing", () => {
    const resolved = resolveLayers(null, "{not json", "balanced");
    expect(resolved).toEqual(tierDefaults("balanced"));
  });

  it("tolerates a non-object localStorage value without throwing", () => {
    const resolved = resolveLayers(null, "42", "balanced");
    expect(resolved).toEqual(tierDefaults("balanced"));
  });

  it("uses the same storage key the panel is expected to persist under", () => {
    expect(LAYERS_STORAGE_KEY).toBe("ij-layers");
  });
});

describe("formatBytes / formatVerts (panel cost labels)", () => {
  it("formats zero as a plain unit", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatVerts(0)).toBe("0 verts");
  });

  it("formats sub-KB byte counts", () => {
    expect(formatBytes(512)).toBe("512 B");
  });

  it("formats KB-range byte counts", () => {
    expect(formatBytes(2048)).toBe("2.0 KB");
  });

  it("formats MB-range byte counts, matching the real SDSS/belt asset sizes", () => {
    expect(formatBytes(47_125_068)).toBe("44.94 MB");
    expect(formatBytes(2_081_206)).toBe("1.98 MB");
  });

  it("formats sub-1000 vertex counts as a plain count", () => {
    expect(formatVerts(200)).toBe("200 verts");
  });

  it("formats large vertex counts in K", () => {
    expect(formatVerts(675_836)).toBe("675.8K verts");
  });
});

describe("D9.3 — LAYERS' assetBytes is single-sourced from budgets.config.mjs's layerBytes", () => {
  it("every LAYERS entry with a real network fetch reads its bytes from layerBytes, not a duplicate literal", () => {
    const byId = (id: LayerId) => LAYERS.find((l) => l.id === id)!;
    expect(byId("star-field").assetBytes).toBe(layerBytes.starField);
    expect(byId("bonus-stars").assetBytes).toBe(layerBytes.bonusStars);
    expect(byId("sdss-field").assetBytes).toBe(layerBytes.sdssField);
    expect(byId("belt-visual").assetBytes).toBe(layerBytes.beltVisual);
    expect(byId("planet-hires").assetBytes).toBe(layerBytes.planetHires);
  });

  // Real on-disk sizes, not the recorded numbers — a future asset regen that changes a size
  // must update budgets.config.mjs's layerBytes deliberately or this fails loudly, exactly
  // the discipline the boot-critical-download test above already applies to BOOT_CRITICAL_ASSETS.
  it("layerBytes.starField matches the real stars-hip.png + deep.png on disk", () => {
    const hip = statSync(
      resolve(process.cwd(), "public/assets/stars-hip.png"),
    ).size;
    const deep = statSync(
      resolve(process.cwd(), "public/assets/deep.png"),
    ).size;
    expect(hip + deep).toBe(layerBytes.starField);
  });

  it("layerBytes.bonusStars matches the real 4 bonus chunk files on disk", () => {
    const files = [
      "whitedwarfs-edr3.png",
      "cns5.png",
      "oortcloud.png",
      "clusters-bg.png",
    ];
    const total = files.reduce(
      (sum, f) =>
        sum + statSync(resolve(process.cwd(), "public/assets", f)).size,
      0,
    );
    expect(total).toBe(layerBytes.bonusStars);
  });

  it("layerBytes.sdssField matches the real sdss18.png on disk", () => {
    const size = statSync(
      resolve(process.cwd(), "public/assets/sdss18.png"),
    ).size;
    expect(size).toBe(layerBytes.sdssField);
  });

  it("layerBytes.beltVisual matches the real asteroids-dr3.png on disk", () => {
    const size = statSync(
      resolve(process.cwd(), "public/assets/asteroids-dr3.png"),
    ).size;
    expect(size).toBe(layerBytes.beltVisual);
  });
});
