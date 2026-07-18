/**
 * PF-09 B0 — perf telemetry harness (pure parts + deterministic monitor).
 */
import { describe, expect, it } from "vitest";
import {
  classifyDeviceTier,
  FPS_WINDOW,
  PerfMonitor,
  rollingFps,
  type DeviceContext,
} from "@/lib/perf-telemetry";
import type { TierSignals } from "@/lib/craft-tier";

const DEV: DeviceContext = {
  ua: "test",
  dpr: 2,
  cores: 8,
  memoryGb: 8,
  screen: "1920x1080",
  viewport: "1280x720",
};

const sig = (o: Partial<TierSignals>): TierSignals => ({
  saveData: false,
  deviceMemory: 8,
  viewportWidth: 1440,
  ...o,
});

describe("classifyDeviceTier", () => {
  it("constrained signals → low", () => {
    expect(classifyDeviceTier(sig({ saveData: true }))).toBe("low");
    expect(classifyDeviceTier(sig({ deviceMemory: 4 }))).toBe("low");
    expect(classifyDeviceTier(sig({ viewportWidth: 500 }))).toBe("low");
  });
  it("roomy memory on a wide viewport → high", () => {
    expect(
      classifyDeviceTier(sig({ deviceMemory: 8, viewportWidth: 1280 })),
    ).toBe("high");
  });
  it("otherwise → mid (incl. unknown memory)", () => {
    expect(classifyDeviceTier(sig({ deviceMemory: 6 }))).toBe("mid");
    expect(classifyDeviceTier(sig({ deviceMemory: null }))).toBe("mid");
  });
});

describe("rollingFps", () => {
  it("is 0 for an empty window", () => {
    expect(rollingFps([])).toBe(0);
  });
  it("converts average frame delta to fps", () => {
    expect(rollingFps([16.6667, 16.6667])).toBeCloseTo(60, 1);
    expect(rollingFps([50, 50, 50])).toBeCloseTo(20, 5);
  });
});

describe("PerfMonitor", () => {
  it("times startup from start to markReady", () => {
    const m = new PerfMonitor("webgl", "high", DEV);
    m.start(1000);
    m.markReady(1420);
    expect(m.snapshot().startupMs).toBe(420);
    // first ready wins; later ones ignored
    m.markReady(9999);
    expect(m.snapshot().startupMs).toBe(420);
  });

  it("startup is null until ready", () => {
    const m = new PerfMonitor("babylon", "mid", DEV);
    m.start(0);
    expect(m.snapshot().startupMs).toBeNull();
  });

  it("samples a steady 60fps and reports it", () => {
    const m = new PerfMonitor("webgl", "high", DEV);
    let t = 0;
    m.start(t);
    for (let i = 0; i < 120; i++) {
      t += 1000 / 60;
      m.frame(t);
    }
    const snap = m.snapshot();
    expect(snap.fps).toBe(60);
    expect(snap.frames).toBe(120);
    expect(snap.engine).toBe("webgl");
    expect(snap.tier).toBe("high");
  });

  it("estimates display refresh from the fastest frame, capping plausible fps", () => {
    const m = new PerfMonitor("webgl", "high", DEV);
    let t = 0;
    m.start(t);
    for (let i = 0; i < 90; i++) {
      t += 1000 / 60; // steady 60 Hz panel
      m.frame(t);
    }
    const s = m.snapshot();
    expect(s.displayHz).toBe(60);
    // the invariant that makes a reading self-validating: rAF is vsync-locked,
    // so fps can never exceed the refresh rate
    expect(s.fps).toBeLessThanOrEqual(s.displayHz);
  });

  it("a single coalesced-callback outlier must not poison displayHz", () => {
    // TR-033: the old min-based estimate latched onto one sub-4ms delta and
    // reported 250 Hz on hardware with no such panel.
    const m = new PerfMonitor("webgl", "high", DEV);
    let t = 0;
    m.start(t);
    for (let i = 0; i < 90; i++) {
      // one pathological 1 ms frame among a steady 60 Hz stream
      t += i === 40 ? 1 : 1000 / 60;
      m.frame(t);
    }
    const hz = m.snapshot().displayHz;
    expect(hz).toBe(60);
    expect(hz).toBeLessThan(200); // never the 250 Hz artefact
  });

  it("reports a 144Hz panel distinctly from 60Hz", () => {
    const m = new PerfMonitor("babylon", "high", DEV);
    let t = 0;
    m.start(t);
    for (let i = 0; i < 90; i++) {
      t += 1000 / 144;
      m.frame(t);
    }
    expect(m.snapshot().displayHz).toBe(144);
  });

  it("carries device context and the engine render-frame counter", () => {
    const m = new PerfMonitor("babylon", "high", DEV);
    m.start(0);
    expect(m.snapshot().renderFrames).toBeNull(); // no counter wired yet
    m.setRenderFrames(0, 0);
    expect(m.snapshot().renderFrames).toBe(0); // 0 ⇒ engine is NOT drawing
    m.setRenderFrames(512, 100);
    const s = m.snapshot();
    expect(s.renderFrames).toBe(512);
    expect(s.device).toEqual(DEV);
  });

  it("renderFps measures the ENGINE's rate, not the host rAF cadence", () => {
    const m = new PerfMonitor("webgl", "high", DEV);
    m.start(0);
    // host ticks at 120 Hz while the engine only renders at 30 fps — the
    // exact over-reporting that invalidated the first gate readings
    let engineFrames = 0;
    for (let i = 1; i <= 240; i++) {
      const t = i * (1000 / 120);
      m.frame(t);
      if (i % 4 === 0) engineFrames++; // one render per 4 host ticks = 30 fps
      m.setRenderFrames(engineFrames, t);
    }
    const s = m.snapshot();
    expect(s.fps).toBe(120); // host cadence — misleading on its own
    expect(s.renderFps).toBe(30); // truth: what the engine actually drew
  });

  it("renderFps is null until two samples exist", () => {
    const m = new PerfMonitor("webgl", "mid", DEV);
    m.start(0);
    expect(m.snapshot().renderFps).toBeNull();
    m.setRenderFrames(10, 0);
    expect(m.snapshot().renderFps).toBeNull();
    m.setRenderFrames(20, 1000);
    expect(m.snapshot().renderFps).toBe(10);
  });

  it("drops tab-sleep outliers and bounds the window", () => {
    const m = new PerfMonitor("webgl", "mid", DEV);
    let t = 0;
    m.start(t);
    t += 5000; // a huge gap (tab slept) — must not tank the fps
    m.frame(t);
    for (let i = 0; i < FPS_WINDOW + 40; i++) {
      t += 1000 / 60;
      m.frame(t);
    }
    // window is bounded and reflects the steady rate, not the 5s outlier
    expect(m.snapshot().fps).toBe(60);
  });
});
