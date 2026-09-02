/**
 * PF-11 D1.3 — the launch-ascent curves.
 *
 * These pin the properties that make the ascent read as a launch and stay physically honest,
 * each of which is invisible in a screenshot: the camera ease is thrust-shaped (slow then fast),
 * the sky follows the real barometric curve rather than the camera, the star reveal happens in
 * the right altitude band, and the whole thing lands EXACTLY on the home pose so LAUNCH and
 * goHome are the same frame.
 */
import { describe, expect, it } from "vitest";
import {
  ASCENT_END_STANDOFF,
  ASCENT_START_STANDOFF,
  ASCENT_MAX_ALT_KM,
  ATMOSPHERE_SCALE_H_KM,
  ascentAltitudeKm,
  ascentStandoff,
  ascentStateAt,
  easeAlt,
  easeCam,
  limbIntensity,
  skyMix,
  smoothstep,
  starFade,
  DAY_SKY_RGB,
  LIMB_VERTEX_GLSL,
  LIMB_FRAGMENT_GLSL,
  LIMB_VERTEX_WGSL,
  LIMB_FRAGMENT_WGSL,
} from "@/lib/ascent";
import { ARRIVE_STANDOFF } from "@/lib/ship-dynamics";
import { HOME_ORBIT_RADIUS } from "@/lib/planet-sphere";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("endpoints — LAUNCH must be the goHome reveal played forward", () => {
  it("lands on EXACTLY the home standoff, so there is no cut at handoff", () => {
    // The single most important invariant: the ascent ends where the home orbit lives. If these
    // ever diverge the visitor sees a jump at ascent-done.
    expect(ascentStandoff(1)).toBe(ASCENT_END_STANDOFF);
    expect(ASCENT_END_STANDOFF).toBe(ARRIVE_STANDOFF);
    expect(ASCENT_END_STANDOFF).toBe(HOME_ORBIT_RADIUS);
  });

  it("starts just above the surface, not on it", () => {
    // Radius 26; starting at 26.00x clips the near plane and reads as a bug. 29 = 3 units clear.
    expect(ascentStandoff(0)).toBe(ASCENT_START_STANDOFF);
    expect(ASCENT_START_STANDOFF).toBeGreaterThan(26);
    expect(ASCENT_START_STANDOFF).toBeLessThan(ASCENT_END_STANDOFF);
  });

  it("altitude runs 0 at the pad to the full range at handoff", () => {
    expect(ascentAltitudeKm(0)).toBe(0);
    expect(ascentAltitudeKm(1)).toBeCloseTo(ASCENT_MAX_ALT_KM, 6);
  });
});

describe("easing — thrust vs sky, deliberately different shapes", () => {
  it("camera ease is slow-out (k³): barely moves early, leaves fast late", () => {
    expect(easeCam(0)).toBe(0);
    expect(easeCam(1)).toBe(1);
    // At the half-way point the camera has covered only 1/8 of its travel — the 'still on the pad'
    // read. A linear ease would be at 1/2 here.
    expect(easeCam(0.5)).toBeCloseTo(0.125, 6);
    // Monotone increasing.
    let prev = -1;
    for (let k = 0; k <= 1.0001; k += 0.1) {
      const v = easeCam(k);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it("altitude ease is smoothstep, and runs AHEAD of the camera in the first half", () => {
    expect(easeAlt(0)).toBe(0);
    expect(easeAlt(1)).toBe(1);
    expect(easeAlt(0.5)).toBeCloseTo(0.5, 6);
    // The point of using two curves: for the whole first half the sky (easeAlt) is further along
    // than the camera (easeCam), so the colour change leads the motion.
    for (let k = 0.05; k < 0.5; k += 0.05)
      expect(easeAlt(k)).toBeGreaterThan(easeCam(k));
  });

  it("both eases clamp outside [0,1]", () => {
    expect(easeCam(-1)).toBe(0);
    expect(easeCam(2)).toBe(1);
    expect(easeAlt(-1)).toBe(0);
    expect(easeAlt(2)).toBe(1);
  });
});

describe("smoothstep helper", () => {
  it("is 0 below, 1 above, 0.5 at the midpoint", () => {
    expect(smoothstep(0, 10, -5)).toBe(0);
    expect(smoothstep(0, 10, 15)).toBe(1);
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 6);
  });
  it("does not divide by zero on a degenerate edge pair", () => {
    expect(smoothstep(5, 5, 4)).toBe(0);
    expect(smoothstep(5, 5, 6)).toBe(1);
  });
});

describe("sky colour — the real barometric curve, keyed to altitude not the camera", () => {
  it("is full daytime tint at the pad and near-black by 40 km", () => {
    expect(skyMix(0)).toBeCloseTo(1, 6);
    // exp(-40/8.5) = exp(-4.7) ≈ 0.009 — the 'violet-black by 40-50 km' beat.
    expect(skyMix(40)).toBeLessThan(0.01);
    expect(skyMix(120)).toBeLessThan(1e-5);
  });

  it("e-folds every scale height, which is the physical claim", () => {
    // Consecutive scale heights must drop by exactly 1/e — this is what makes it 'barometric'
    // rather than a hand-drawn fade.
    const a = skyMix(ATMOSPHERE_SCALE_H_KM);
    const b = skyMix(2 * ATMOSPHERE_SCALE_H_KM);
    expect(a).toBeCloseTo(Math.exp(-1), 6);
    expect(b / a).toBeCloseTo(Math.exp(-1), 6);
  });

  it("blends between space-black and the day tint, matching endpoints exactly", () => {
    const black: [number, number, number] = [0.01, 0.02, 0.05];
    const pad = ascentStateAt(0, black);
    const top = ascentStateAt(1, black);
    for (let i = 0; i < 3; i++) {
      expect(pad.sky[i]).toBeCloseTo(DAY_SKY_RGB[i], 5); // pad = full day tint
      expect(top.sky[i]).toBeCloseTo(black[i], 4); // handoff = space black
    }
  });
});

describe("star reveal and limb ring — the honest thresholds", () => {
  it("no stars while the sky is bright, full field once high", () => {
    expect(starFade(0)).toBe(0);
    expect(starFade(40)).toBe(0); // still below the 50 km low edge
    expect(starFade(65)).toBeGreaterThan(0); // crossing in
    expect(starFade(65)).toBeLessThan(1);
    expect(starFade(90)).toBe(1); // full field above 80 km
  });

  it("the limb ring is absent on the pad, present near the Kármán line, GONE at handoff", () => {
    expect(limbIntensity(0)).toBe(0);
    expect(limbIntensity(ASCENT_MAX_ALT_KM)).toBe(0); // gone by the top — arrival geometry never inherits it
    // A real bump somewhere in the 80-120 km window.
    expect(limbIntensity(100)).toBeGreaterThan(0.3);
  });

  it("the limb ring is a single bump, never a strobe (monotone up then down)", () => {
    const vals: number[] = [];
    for (let h = 0; h <= 120; h += 5) vals.push(limbIntensity(h));
    const peak = vals.indexOf(Math.max(...vals));
    for (let i = 1; i <= peak; i++)
      expect(vals[i]).toBeGreaterThanOrEqual(vals[i - 1]);
    for (let i = peak + 1; i < vals.length; i++)
      expect(vals[i]).toBeLessThanOrEqual(vals[i - 1]);
  });
});

describe("limb-glow shader twins (CLAUDE.md #4/#5)", () => {
  const glsl = [LIMB_VERTEX_GLSL, LIMB_FRAGMENT_GLSL].join("\n");
  const wgsl = [LIMB_VERTEX_WGSL, LIMB_FRAGMENT_WGSL].join("\n");

  it("both twins carry the same load-bearing identifiers, line-parallel", () => {
    for (const src of [glsl, wgsl]) {
      // The fresnel rim + the sun-gate + the visibility uniform are the whole shader; a twin
      // missing any one of them is a silent divergence no compiler cross-checks.
      expect(src).toContain("fresnel");
      expect(src).toContain("dayFac");
      expect(src).toContain("uLimb");
      expect(src).toContain("uSunDir");
    }
  });

  it("has NO reserved WGSL identifier in the limb WGSL (TR-045 — a reserved id blanks the scene)", () => {
    const reserved: readonly string[] = WGSL_RESERVED_IDENTIFIERS;
    for (const id of [
      "fresnel",
      "dayFac",
      "rim",
      "viewDir",
      "uLimb",
      "uSunDir",
      "uColor",
    ])
      expect(reserved.includes(id), `${id} is reserved`).toBe(false);
  });

  it("has no literal backtick (TR-078 Part 5's silent-compile trap)", () => {
    for (const [name, src] of [
      ["GLSL", glsl],
      ["WGSL", wgsl],
    ] as const)
      expect(src.includes("`"), `${name} contains a backtick`).toBe(false);
  });

  it("emits additive glow proportional to uLimb — colour * rim, alpha = rim", () => {
    // Both twins must output vec4(color*rim, rim) so a fully-faded ring (uLimb 0) is invisible.
    for (const src of [glsl, wgsl]) {
      expect(src).toMatch(/uColor \* rim/);
      expect(src).toMatch(
        /fresnel \* dayFac \* u(niforms\.)?uLimb|fresnel \* dayFac \* uLimb/,
      );
    }
  });
});

describe("ascentStateAt — the per-frame bundle", () => {
  it("is internally consistent with the individual curves", () => {
    const black: [number, number, number] = [0, 0, 0];
    for (const k of [0, 0.25, 0.5, 0.75, 1]) {
      const s = ascentStateAt(k, black);
      expect(s.altitudeKm).toBeCloseTo(ascentAltitudeKm(k), 6);
      expect(s.standoff).toBeCloseTo(ascentStandoff(k), 6);
      expect(s.starFade).toBeCloseTo(starFade(ascentAltitudeKm(k)), 6);
      expect(s.limb).toBeCloseTo(limbIntensity(ascentAltitudeKm(k)), 6);
    }
  });
});
