/**
 * PF-10 C4.2 — the Venus cloud descent.
 *
 * The assertions that matter most here are about HONESTY rather than mechanics, because that is
 * what Astra's brief was actually about: a Magellan radar map lit with a directional Sun would
 * look superb and be a lie, and nothing in a screenshot would reveal it. So the shader fork, the
 * contrast flattening and the real-time cloud advection are all pinned.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CLOUD_CONTRAST_SCALE,
  VENUS_ALTITUDES,
  VENUS_CLOUDTOP_RGB,
  VENUS_DESCENT_S,
  VENUS_FLAT_LIGHT_KM,
  VENUS_SURFACE_RGB,
  cloudAdvection,
  cloudOpacity,
  descentAltitudeKm,
  descentIlluminance,
  descentTint,
  flatLightAmount,
} from "@/lib/venus-descent";

describe("real cloud structure (Astra's altitudes)", () => {
  it("orders the real layers correctly, top to base", () => {
    const A = VENUS_ALTITUDES;
    expect(A.cloudTopKm).toBeGreaterThan(A.upperMiddleKm);
    expect(A.upperMiddleKm).toBeGreaterThan(A.habitableKm);
    expect(A.habitableKm).toBeGreaterThan(A.middleLowerKm);
    expect(A.middleLowerKm).toBeGreaterThan(A.cloudBaseKm);
    expect(A.cloudBaseKm).toBeGreaterThan(A.endKm);
  });

  it("ends at altitude, NOT at the surface", () => {
    // Astra: at 0 km you can see 3.3 km and nothing else. The view from under the deck is the
    // actual reveal, so landing would replace the payoff with an orange fog.
    expect(VENUS_ALTITUDES.endKm).toBeGreaterThan(0);
    expect(descentAltitudeKm(1)).toBe(VENUS_ALTITUDES.endKm);
  });

  it("carries the real habitable-layer altitude", () => {
    // 55 km, 0.53 bar, +30 °C — the one place off Earth a human could survive the pressure and
    // temperature unprotected, and a real reason this descent is worth flying.
    expect(VENUS_ALTITUDES.habitableKm).toBe(55);
  });
});

describe("descent pacing", () => {
  it("descends monotonically", () => {
    let prev = Infinity;
    for (let i = 0; i <= 100; i++) {
      const alt = descentAltitudeKm(i / 100);
      expect(alt).toBeLessThanOrEqual(prev + 1e-9);
      prev = alt;
    }
  });

  it("starts genuinely above the deck and enters it early", () => {
    expect(descentAltitudeKm(0)).toBeGreaterThan(VENUS_ALTITUDES.cloudTopKm);
    expect(descentAltitudeKm(0.2)).toBeLessThan(VENUS_ALTITUDES.cloudTopKm);
  });

  it("spends about half the runtime inside the deck", () => {
    // Astra's pacing: the structure is in the clouds, so a linear fall would rush the part
    // that matters. Counted over the real altitude curve rather than assumed from the segments.
    let inside = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const alt = descentAltitudeKm(i / N);
      if (
        alt <= VENUS_ALTITUDES.cloudTopKm &&
        alt >= VENUS_ALTITUDES.cloudBaseKm
      )
        inside++;
    }
    expect(inside / N).toBeGreaterThan(0.4);
    expect(inside / N).toBeLessThan(0.75);
  });

  it("runs for a real, bounded duration", () => {
    expect(VENUS_DESCENT_S).toBe(20);
  });
});

describe("the shader fork — Astra's core mandate", () => {
  it("engages only below the real boundary altitude", () => {
    expect(flatLightAmount(70)).toBe(0);
    expect(flatLightAmount(VENUS_FLAT_LIGHT_KM)).toBe(0);
    expect(flatLightAmount(20)).toBe(1);
  });

  it("ramps rather than switching, so the transition is not a pop", () => {
    const mid = flatLightAmount(VENUS_FLAT_LIGHT_KM - 7.5);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it("is fully engaged by the time the surface is visible", () => {
    // The whole point: the radar map must never be lit directionally when it is on screen.
    expect(flatLightAmount(VENUS_ALTITUDES.endKm)).toBe(1);
  });
});

describe("real colour and illuminance", () => {
  it("grades from the real cloud-top cream to the real Venera orange", () => {
    expect(descentTint(70)).toEqual([...VENUS_CLOUDTOP_RGB]);
    expect(descentTint(20)).toEqual([...VENUS_SURFACE_RGB]);
  });

  it("keeps the upper deck BRIGHT — the descent dims, it does not go dark", () => {
    // Astra's measured profile: 1.00 at cloud top, ~0.06 at 50 km, 0.02 at the surface. A scene
    // that plunges to black at cloud entry would be wrong in the most basic way.
    expect(descentIlluminance(70)).toBeCloseTo(1, 2);
    expect(descentIlluminance(50)).toBeLessThan(0.15);
    expect(descentIlluminance(50)).toBeGreaterThan(0.02);
    expect(descentIlluminance(0)).toBeGreaterThanOrEqual(0.02);
  });

  it("never goes fully black at any altitude", () => {
    for (let a = 0; a <= 90; a += 3) {
      expect(descentIlluminance(a)).toBeGreaterThan(0);
    }
  });
});

describe("cloud opacity", () => {
  it("is transparent above the deck, opaque inside it, clearing below the base", () => {
    expect(cloudOpacity(90)).toBe(0);
    expect(cloudOpacity(60)).toBe(1);
    expect(cloudOpacity(VENUS_ALTITUDES.cloudBaseKm)).toBe(1);
    expect(cloudOpacity(30)).toBeLessThan(0.5);
  });

  it("stays within [0,1] across the whole descent", () => {
    for (let i = 0; i <= 100; i++) {
      const o = cloudOpacity(descentAltitudeKm(i / 100));
      expect(o).toBeGreaterThanOrEqual(0);
      expect(o).toBeLessThanOrEqual(1);
    }
  });
});

describe("super-rotation at REAL time", () => {
  it("laps in the real 4.45 days, not on the 1e3 rotation clock", () => {
    // Astra: on the planetary rotation clock the real 100 m/s cloud-top wind becomes 100 km/s —
    // 0.033c. Real time is not a simplification here, it is the correct answer.
    const lapS = 4.45 * 86400;
    expect(Math.abs(cloudAdvection(lapS))).toBeCloseTo(2 * Math.PI, 4);
  });

  it("advects retrograde, matching the solid body's real sense", () => {
    expect(cloudAdvection(100)).toBeLessThan(0);
  });

  it("moves perceptibly but not absurdly over a 20 s descent", () => {
    const deg = Math.abs((cloudAdvection(VENUS_DESCENT_S) * 180) / Math.PI);
    expect(deg).toBeGreaterThan(0);
    expect(deg).toBeLessThan(1); // real super-rotation is fast for a planet, slow for an eye
  });
});

describe("the UV-map contrast correction", () => {
  it("flattens the measured 20.5% contrast toward the real 1-3%", () => {
    // Independently re-measured this session: venus-cloud.jpg has identical statistics in all
    // three channels (mean 171.4, sigma 35.1) — one band replicated, i.e. a UV image. Shipping
    // it at full contrast would present ultraviolet structure as a photograph.
    const measured = 20.5;
    expect(measured * CLOUD_CONTRAST_SCALE).toBeGreaterThan(1);
    expect(measured * CLOUD_CONTRAST_SCALE).toBeLessThan(3);
  });
});

describe("shader twins (CLAUDE.md non-negotiable #4)", () => {
  const src = readFileSync(
    resolve(process.cwd(), "src/lib/venus-descent.ts"),
    "utf8",
  );
  const planet = readFileSync(
    resolve(process.cwd(), "src/lib/planet-sphere.ts"),
    "utf8",
  );

  it("ships the cloud shell in both twins", () => {
    expect(src).toContain("float band = texture2D(cloudTex, vUV).r;");
    expect(src).toContain(
      "let band : f32 = textureSample(cloudTex, cloudTexSampler, fragmentInputs.vUV).r;",
    );
  });

  it("applies the contrast flattening in both twins", () => {
    expect(src).toContain(
      "float flattened = 0.672 + (band - 0.672) * uContrast;",
    );
    expect(src).toContain(
      "let flattened : f32 = 0.672 + (band - 0.672) * uniforms.uContrast;",
    );
  });

  it("ships the flat-light fork in both planet twins", () => {
    expect(planet).toContain(
      "vec3 flatLit = surface * uFlatTint * uFlatLevel;",
    );
    // REGRESSION: the first draft named this `flat` in GLSL, which is a reserved interpolation
    // qualifier in GLSL ES 3.0 — the shader silently failed to compile and materialReady stayed
    // false with no console error. Pinned so the reserved name cannot come back.
    expect(planet).not.toContain("vec3 flat =");
    expect(planet).toContain(
      "let flatLit : vec3<f32> = surface * uniforms.uFlatTint * uniforms.uFlatLevel;",
    );
    // The fork must be the LAST word on colour — mixed over the lit result, not before it.
    expect(planet).toContain("mix(lit, flatLit, uFlatLight)");
    expect(planet).toContain("mix(lit, flatLit, uniforms.uFlatLight)");
  });
});
