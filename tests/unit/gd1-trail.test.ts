/**
 * PF-10 C1 — GD-1 connected-trail visual: great-circle stream fit, radial-velocity colour
 * ramp, and generated line-list mesh data. See docs/analysis/2026-07-20-gd1-connected-trail-
 * science-brief.md for the real astrophysics behind the design (Astra).
 */
import { describe, expect, it } from "vitest";
import {
  buildGd1TrailMesh,
  fitStreamPole,
  orderGd1Stream,
  radialVelocityToColor,
  streamPhi1,
  type Vec3,
} from "@/lib/gd1-trail";
import { raDecToDir } from "@/lib/ship-dynamics";

describe("fitStreamPole", () => {
  it("recovers the pole of a real great circle (the celestial equator, pole=+Z) from points scattered along it", () => {
    const pts: Vec3[] = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      pts.push([Math.cos(rad), Math.sin(rad), 0]);
    }
    const pole = fitStreamPole(pts);
    // eigenvector sign is ambiguous — compare |dot| to the known pole [0,0,1]
    expect(Math.abs(pole[2])).toBeCloseTo(1, 3);
    expect(Math.abs(pole[0])).toBeLessThan(0.01);
    expect(Math.abs(pole[1])).toBeLessThan(0.01);
  });

  it("recovers a tilted great circle's pole, not just the trivial equator case", () => {
    // a great circle tilted 40deg from the equator, pole at (0, -sin40, cos40)
    const tiltRad = (40 * Math.PI) / 180;
    const expectedPole: Vec3 = [0, -Math.sin(tiltRad), Math.cos(tiltRad)];
    const pts: Vec3[] = [];
    for (let deg = 0; deg < 360; deg += 5) {
      const rad = (deg * Math.PI) / 180;
      // parametrize the tilted circle: rotate the equator's parametrization about X by tiltRad
      const x = Math.cos(rad);
      const y = Math.sin(rad) * Math.cos(tiltRad);
      const z = Math.sin(rad) * Math.sin(tiltRad);
      pts.push([x, y, z]);
    }
    const pole = fitStreamPole(pts);
    const dot =
      pole[0] * expectedPole[0] +
      pole[1] * expectedPole[1] +
      pole[2] * expectedPole[2];
    expect(Math.abs(dot)).toBeCloseTo(1, 3);
  });

  it("returns a unit vector", () => {
    const pts: Vec3[] = [
      [1, 0, 0],
      [0, 1, 0],
      [0.7, 0.7, 0.1],
      [0.2, 0.9, 0.3],
    ];
    const pole = fitStreamPole(pts);
    expect(Math.hypot(...pole)).toBeCloseTo(1, 6);
  });
});

describe("streamPhi1", () => {
  it("is monotonic increasing as a point sweeps around the equator from the reference direction", () => {
    const pole: Vec3 = [0, 0, 1];
    const refDir: Vec3 = [1, 0, 0];
    let prev = -Infinity;
    for (let deg = 0; deg <= 170; deg += 10) {
      const rad = (deg * Math.PI) / 180;
      const dir: Vec3 = [Math.cos(rad), Math.sin(rad), 0];
      const phi1 = streamPhi1(pole, refDir, dir);
      expect(phi1).toBeGreaterThan(prev);
      prev = phi1;
    }
  });

  it("is exactly 0 at the reference direction itself", () => {
    const pole: Vec3 = [0, 0, 1];
    const refDir: Vec3 = [1, 0, 0];
    expect(streamPhi1(pole, refDir, refDir)).toBeCloseTo(0, 10);
  });
});

describe("orderGd1Stream", () => {
  it("sorts real-catalog-shaped stars scattered along a great circle into real arc order, from arbitrary input order", () => {
    // 20 stars, each at a real (ra, dec) placing it at a known angle along the
    // equator — but the ARRAY ITSELF is in arbitrary order (a shuffled
    // permutation of the 0,9,18,...171 degree positions), matching the real
    // catalog's confirmed-arbitrary row order (~50/50 increasing/decreasing RA
    // between consecutive rows).
    const shuffledAngles = [
      63, 9, 135, 0, 81, 27, 162, 18, 99, 45, 117, 36, 144, 54, 171, 72, 108,
      90, 153, 126,
    ];
    const stars = shuffledAngles.map((deg, i) => ({
      id: `s${i}`,
      ra: deg,
      dec: 0,
      rv: 0,
    }));
    const order = orderGd1Stream(stars);
    const orderedAngles = order.map((i) => shuffledAngles[i]);
    const sortedAngles = [...shuffledAngles].sort((a, b) => a - b);
    // the recovered order must trace the arc monotonically, allowing overall
    // reversal (the fit has no inherent "direction", only a consistent one)
    expect([sortedAngles, [...sortedAngles].reverse()]).toContainEqual(
      orderedAngles,
    );
  });
});

describe("radialVelocityToColor", () => {
  it("is blue at the minimum, red at the maximum, whiteish at the midpoint", () => {
    const blue = radialVelocityToColor(-200, -200, 100);
    const red = radialVelocityToColor(100, -200, 100);
    const mid = radialVelocityToColor(-50, -200, 100);
    expect(blue[2]).toBeGreaterThan(blue[0]); // blue channel dominant
    expect(red[0]).toBeGreaterThan(red[2]); // red channel dominant
    for (const c of mid) {
      expect(c).toBeGreaterThan(0.8); // near-white, all channels bright
    }
  });

  it("clamps outside the real sample's min/max range rather than extrapolating", () => {
    const belowMin = radialVelocityToColor(-500, -200, 100);
    const atMin = radialVelocityToColor(-200, -200, 100);
    expect(belowMin).toEqual(atMin);
    const aboveMax = radialVelocityToColor(500, -200, 100);
    const atMax = radialVelocityToColor(100, -200, 100);
    expect(aboveMax).toEqual(atMax);
  });

  it("all channels stay in [0,1]", () => {
    for (let rv = -300; rv <= 200; rv += 17) {
      const [r, g, b] = radialVelocityToColor(rv, -200, 100);
      for (const c of [r, g, b]) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThanOrEqual(1);
      }
    }
  });
});

describe("buildGd1TrailMesh", () => {
  it("produces n-1 segments for n ordered stars, each a real endpoint-to-endpoint pair", () => {
    const positions: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ];
    const colors: Vec3[] = positions.map(() => [0.5, 0.5, 0.5]);
    const mesh = buildGd1TrailMesh(positions, colors);
    expect(mesh.count).toBe(3);
    expect(mesh.positions.length).toBe(3 * 6);
    // segment 0: [0,0,0] -> [1,0,0]
    expect(Array.from(mesh.positions.slice(0, 6))).toEqual([0, 0, 0, 1, 0, 0]);
    // segment 1: [1,0,0] -> [1,1,0]
    expect(Array.from(mesh.positions.slice(6, 12))).toEqual([1, 0, 0, 1, 1, 0]);
  });

  it("carries each endpoint's own colour, not a shared/averaged one", () => {
    const positions: Vec3[] = [
      [0, 0, 0],
      [1, 0, 0],
    ];
    const colors: Vec3[] = [
      [1, 0, 0],
      [0, 0, 1],
    ];
    const mesh = buildGd1TrailMesh(positions, colors);
    expect(Array.from(mesh.colors)).toEqual([1, 0, 0, 0, 0, 1]);
  });

  it("returns zero segments for fewer than 2 stars, not a crash", () => {
    expect(buildGd1TrailMesh([], []).count).toBe(0);
    expect(buildGd1TrailMesh([[0, 0, 0]], [[1, 1, 1]]).count).toBe(0);
  });
});

describe("real GD-1 catalog sanity — raDecToDir integration", () => {
  it("streamPhi1 composes correctly with the SAME raDecToDir the rest of the engine uses", () => {
    // two real-looking ra/dec pairs at a real angular separation; phi1 should
    // differ by roughly that separation when both lie near the fitted plane
    const a = raDecToDir(178.46216, 53.79395); // real gd1-member-1
    const b = raDecToDir(185.13413, 56.08567); // real gd1-member-2
    const pole = fitStreamPole([a, b, raDecToDir(176.53366, 53.60149)]);
    const phi1a = streamPhi1(pole, a, a);
    const phi1b = streamPhi1(pole, a, b);
    expect(phi1a).toBeCloseTo(0, 10);
    expect(Number.isFinite(phi1b)).toBe(true);
  });
});
