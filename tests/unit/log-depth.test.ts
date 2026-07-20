/**
 * PF-10 C2 — cross-checks scripts/lib/log-depth.mjs (the build-script copy of ship-dynamics.ts's
 * bodyDepth/raDecToDir, used by gaia-sdss18-pngpack.mjs to compress SDSS DR18's real
 * 32.6M-28.86B ly distance range into the scene's log-scaled world-depth range) against the REAL
 * production functions, value-for-value across a real-shaped input range — not trusting the
 * duplication by inspection, per this module's own stated guarantee.
 */
import { describe, expect, it } from "vitest";
import {
  bodyDepth as realBodyDepth,
  raDecToDir as realRaDecToDir,
} from "@/lib/ship-dynamics";
import { bodyDepth, raDecToDir } from "../../scripts/lib/log-depth.mjs";

describe("log-depth.mjs matches ship-dynamics.ts exactly", () => {
  it("bodyDepth: matches across the real SDSS DR18 distance range (32.6M-28.86B ly) and typical star-field distances", () => {
    const sample = [
      0, 0.001, 1, 34.8, 2399.6, 32_616_217, 1_058.9, 28_862_642_400,
    ];
    for (const ly of sample) {
      expect(bodyDepth(ly)).toBeCloseTo(realBodyDepth(ly), 10);
    }
  });

  it("bodyDepth: matches for null/undefined (the real function's `|| 0.001` floor)", () => {
    expect(bodyDepth(null as unknown as number)).toBeCloseTo(
      realBodyDepth(null as unknown as number),
      10,
    );
    expect(bodyDepth(undefined as unknown as number)).toBeCloseTo(
      realBodyDepth(undefined as unknown as number),
      10,
    );
  });

  it("raDecToDir: matches across a real-shaped ra/dec sample (poles, equator, arbitrary sky points)", () => {
    const sample: [number, number][] = [
      [0, 0],
      [359.99995, -0.0001],
      [0.014, 23.22],
      [180, 90],
      [180, -90],
      [270, 45],
    ];
    for (const [ra, dec] of sample) {
      const a = raDecToDir(ra, dec);
      const b = realRaDecToDir(ra, dec);
      expect(a[0]).toBeCloseTo(b[0], 12);
      expect(a[1]).toBeCloseTo(b[1], 12);
      expect(a[2]).toBeCloseTo(b[2], 12);
    }
  });
});
