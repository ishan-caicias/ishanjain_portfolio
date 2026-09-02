/**
 * GAP-03 — galactic starlight band. galacticLB is verified against two known
 * reference points (the galactic centre and the north galactic pole) rather
 * than re-derived from the formula, so the test can't just restate the code.
 */
import { describe, expect, it } from "vitest";
import {
  buildMilkyWayRow,
  fbm,
  galacticLB,
  milkyWayPixel,
  MilkyWayBandBuilder,
  MILKY_WAY_BUILD_MS_PER_SLICE,
  MILKY_WAY_FRAGMENT_GLSL,
  MILKY_WAY_FRAGMENT_WGSL,
  MILKY_WAY_HEIGHT,
  MILKY_WAY_VERTEX_GLSL,
  MILKY_WAY_VERTEX_WGSL,
  MILKY_WAY_WIDTH,
} from "@/lib/milky-way";
import { WGSL_RESERVED_IDENTIFIERS } from "@/lib/nebula-field";

describe("galacticLB", () => {
  it("resolves Sagittarius A* (the galactic centre) to l~0, b~0", () => {
    const { l, b } = galacticLB(266.417, -29.008);
    expect(Math.abs(l)).toBeLessThan(0.5);
    expect(Math.abs(b)).toBeLessThan(0.5);
  });

  it("resolves the North Galactic Pole to b=90", () => {
    const { b } = galacticLB(192.859508, 27.128336);
    expect(b).toBeGreaterThan(89.99);
  });

  it("keeps l within (-180, 180]", () => {
    for (let ra = 0; ra < 360; ra += 37) {
      for (const dec of [-80, -20, 0, 20, 80]) {
        const { l } = galacticLB(ra, dec);
        expect(l).toBeGreaterThan(-180);
        expect(l).toBeLessThanOrEqual(180);
      }
    }
  });
});

describe("fbm", () => {
  it("is deterministic and bounded roughly in [0, 1]", () => {
    for (const [x, y] of [
      [0, 0],
      [1.3, -4.2],
      [50, 50],
    ]) {
      const a = fbm(x, y);
      const b = fbm(x, y);
      expect(a).toBe(b);
      expect(a).toBeGreaterThanOrEqual(-0.1);
      expect(a).toBeLessThanOrEqual(1.1);
    }
  });
});

describe("milkyWayPixel", () => {
  it("is brighter at the galactic centre (l=0,b=0) than far off-plane", () => {
    const [r1, g1, b1] = milkyWayPixel(0, 0);
    const [r2, g2, b2] = milkyWayPixel(0, 85);
    expect(r1 + g1 + b1).toBeGreaterThan(r2 + g2 + b2);
  });

  it("returns byte-range RGB for a spread of galactic coordinates", () => {
    for (let l = -180; l <= 180; l += 45) {
      for (const b of [-80, -10, 0, 10, 80]) {
        const [r, g, bch] = milkyWayPixel(l, b);
        for (const c of [r, g, bch]) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
          expect(Number.isInteger(c)).toBe(true);
        }
      }
    }
  });

  it("the Coalsack dark patch (near l=-57,b=-1.5) is dimmer than its immediate surroundings", () => {
    const [r1, g1, b1] = milkyWayPixel(-57, -1.5);
    const [r2, g2, b2] = milkyWayPixel(-57, -20);
    // the coalsack should not be brighter than a random off-plane sample
    expect(r1 + g1 + b1).toBeLessThan(500);
    expect(r2 + g2 + b2).toBeLessThanOrEqual(r1 + g1 + b1 + 200);
  });
});

describe("buildMilkyWayRow", () => {
  it("fills exactly one row's worth of RGBA bytes at full alpha", () => {
    const width = 64;
    const height = 32;
    const out = new Uint8Array(width * height * 4);
    buildMilkyWayRow(out, 10, width, height);
    for (let i = 0; i < width; i++) {
      const o = (10 * width + i) * 4;
      expect(out[o + 3]).toBe(255); // alpha
    }
    // an untouched row stays zeroed
    expect(out[0]).toBe(0);
  });

  it("defaults to the full 1024x512 dimensions", () => {
    expect(MILKY_WAY_WIDTH).toBe(1024);
    expect(MILKY_WAY_HEIGHT).toBe(512);
  });

  it("is deterministic across repeated builds of the same row", () => {
    const out1 = new Uint8Array(64 * 4);
    const out2 = new Uint8Array(64 * 4);
    buildMilkyWayRow(out1, 0, 64, 1);
    buildMilkyWayRow(out2, 0, 64, 1);
    expect(Array.from(out1)).toEqual(Array.from(out2));
  });
});

/** PF-11 D0.1 — the builder is what decouples the band build from frame
 * delivery, so these tests pin the two properties that matter for that:
 * it always makes forward progress (however slow the machine), and it
 * completes the whole grid across however many slices that takes. The clock
 * is injected, so "a slow tick" is simulated rather than waited for. */
describe("MilkyWayBandBuilder", () => {
  /** Clock that charges `msPerRow` for every row the builder builds. */
  const fakeClock = (msPerRow: number) => {
    const clock = { t: 0, calls: 0 };
    return {
      clock,
      now: () => {
        // buildSlice reads the clock once before the loop, then once after
        // each row — so charging on every read after the first models a row
        // costing msPerRow.
        if (clock.calls > 0) clock.t += msPerRow;
        clock.calls++;
        return clock.t;
      },
    };
  };

  it("builds every row of the full grid across simulated slow ticks", () => {
    // 50ms per row against a 6ms budget = the worst case the render loop can
    // hand it; a generous deadline keeps the pacing term out of the way.
    const { now } = fakeClock(50);
    const b = new MilkyWayBandBuilder({
      width: 8,
      height: 24,
      deadlineMs: 1e6,
      now,
    });
    let slices = 0;
    while (!b.buildSlice()) {
      slices++;
      expect(slices).toBeLessThan(1000); // never spins without progressing
    }
    expect(b.row).toBe(24);
    expect(b.done).toBe(true);
    expect(b.progress).toBe(1);
    // every row actually written (alpha 255 is buildMilkyWayRow's signature)
    for (let row = 0; row < 24; row++) {
      expect(b.buf[(row * 8 + 0) * 4 + 3]).toBe(255);
    }
  });

  it("always advances at least one row per slice, even when one row overruns the whole budget", () => {
    const { now } = fakeClock(MILKY_WAY_BUILD_MS_PER_SLICE * 100);
    const b = new MilkyWayBandBuilder({
      width: 8,
      height: 4,
      deadlineMs: 1e6,
      now,
    });
    b.buildSlice();
    expect(b.row).toBe(1);
  });

  /** D0.1's actual exit criterion: build wall-time must not scale with 1/fps.
   * The measured failure was a saturated main thread delivering ~2 slices a
   * second; with a fixed per-slice budget that is a 65s build. */
  it("holds its wall-clock deadline when the driver is slow (D0.1 exit criterion)", () => {
    // A row costs 0.5ms, but slices only arrive every 500ms — the measured
    // ~2-slices-per-second cadence of a saturated SwiftShader page. With a
    // fixed 6ms budget that is ~12 rows per slice = ~43 slices = ~21s.
    const { clock, now } = fakeClock(0.5);
    const b = new MilkyWayBandBuilder({
      width: 8,
      height: 512,
      deadlineMs: 8000,
      maxSliceMs: 1e6, // isolate the deadline from the frame-health cap here
      now,
    });
    let slices = 0;
    while (!b.buildSlice()) {
      clock.t += 500; // the gap between slices on a ~2fps page
      slices++;
      expect(slices).toBeLessThan(200);
    }
    expect(b.done).toBe(true);
    expect(clock.t).toBeLessThan(9000); // the deadline held, not 21s
  });

  it("drops back to the plain time budget when the caller is not paced (mid-warp)", () => {
    // Same slow cadence as the deadline test, but the engine reports a warp
    // in flight: the slice must NOT inflate to hold the deadline.
    const { clock, now } = fakeClock(0.5);
    const b = new MilkyWayBandBuilder({
      width: 8,
      height: 512,
      deadlineMs: 8000,
      now,
    });
    b.buildSlice(false);
    clock.t += 500;
    const before = b.row;
    b.buildSlice(false);
    // 6ms budget / 0.5ms per row = ~12 rows, not the ~34 the deadline wants.
    expect(b.row - before).toBeLessThanOrEqual(14);
  });

  it("keeps a single slice under the frame-health cap even when the deadline demands more", () => {
    // One row costs 5ms and the driver stalls a full second between slices:
    // the deadline term wants every remaining row at once, and maxSliceMs
    // must win — TR-059's frames-keep-producing contract outranks it.
    const { clock, now } = fakeClock(5);
    const b = new MilkyWayBandBuilder({
      width: 8,
      height: 512,
      deadlineMs: 2000,
      maxSliceMs: 50,
      now,
    });
    b.buildSlice(); // first slice: no cadence sample yet
    clock.t += 1000;
    const before = b.row;
    b.buildSlice();
    expect(b.row - before).toBeLessThanOrEqual(11); // 50ms / 5ms per row + 1
  });

  it("builds many rows in one slice when rows are cheap", () => {
    const { now } = fakeClock(0.01);
    const b = new MilkyWayBandBuilder({ width: 8, height: 64, now });
    b.buildSlice();
    expect(b.row).toBeGreaterThan(1);
  });

  it("stops at the grid end and stays done when called again", () => {
    const { now } = fakeClock(0);
    const b = new MilkyWayBandBuilder({ width: 4, height: 3, now });
    expect(b.buildSlice()).toBe(true);
    expect(b.row).toBe(3);
    expect(b.buildSlice()).toBe(true);
    expect(b.row).toBe(3); // no overrun past the buffer
  });

  it("two drivers sharing one builder never duplicate a row's work", () => {
    // The engine calls buildSlice from BOTH the render loop and a
    // setTimeout(0) chain; the shared cursor is what makes that safe.
    const { now } = fakeClock(50);
    const b = new MilkyWayBandBuilder({ width: 8, height: 10, now });
    const rows: number[] = [];
    while (!b.done) {
      rows.push(b.row);
      b.buildSlice();
    }
    expect(rows).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("defaults to the full 1024x512 grid and the shipped time budget", () => {
    const b = new MilkyWayBandBuilder();
    expect(b.width).toBe(MILKY_WAY_WIDTH);
    expect(b.height).toBe(MILKY_WAY_HEIGHT);
    expect(b.buf.length).toBe(MILKY_WAY_WIDTH * MILKY_WAY_HEIGHT * 4);
    expect(b.progress).toBe(0);
    expect(MILKY_WAY_BUILD_MS_PER_SLICE).toBeLessThan(16.6); // frame budget
  });
});

describe("shader source", () => {
  it("TR-045 guard: no reserved WGSL identifiers appear as words", () => {
    for (const src of [MILKY_WAY_VERTEX_WGSL, MILKY_WAY_FRAGMENT_WGSL]) {
      for (const word of WGSL_RESERVED_IDENTIFIERS) {
        expect(src).not.toMatch(new RegExp(`\\b${word}\\b`));
      }
    }
  });

  it("samples the texture exactly once, unconditionally (no branch to worry about, but pinned anyway)", () => {
    expect(MILKY_WAY_FRAGMENT_WGSL.match(/textureSample\(/g)).toHaveLength(1);
    expect(MILKY_WAY_FRAGMENT_GLSL.match(/texture2D\(/g)).toHaveLength(1);
  });

  it("both twins are plain UV samplers — no camera-basis reconstruction (infiniteDistance sphere, not a fullscreen triangle)", () => {
    for (const src of [MILKY_WAY_FRAGMENT_GLSL, MILKY_WAY_FRAGMENT_WGSL]) {
      expect(src).not.toContain("uRight");
      expect(src).not.toContain("uFwd");
    }
  });

  it("vertex twins apply the standard world/view/projection transform and pass uv through", () => {
    expect(MILKY_WAY_VERTEX_GLSL).toContain("projection * view * world");
    expect(MILKY_WAY_VERTEX_GLSL).toContain("vUV = uv");
    expect(MILKY_WAY_VERTEX_WGSL).toContain(
      "uniforms.projection * uniforms.view * uniforms.world",
    );
    expect(MILKY_WAY_VERTEX_WGSL).toContain(
      "vertexOutputs.vUV = vertexInputs.uv",
    );
  });
});
